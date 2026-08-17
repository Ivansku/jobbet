'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { beraknaSortordning } from '@/lib/sortordning'
import { currentForetagId } from '@/lib/foretag'
import { enTillRelation } from '@/lib/postgrest'

function todayISODate() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function leggTillDagar(iso: string, dagar: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() + dagar)
  const yy = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

// Ersätter platshållaren "{kund}" i en uppgift_titel_mall. Om mötesuppgiften saknar
// kund städas platshållaren (och ett eventuellt inledande tankstreck) bort istället
// för att lämna kvar den bokstavliga texten "{kund}" i den genererade titeln.
function fyllTitelMall(mall: string, kundNamn: string | null): string {
  if (kundNamn) return mall.replace('{kund}', kundNamn)
  return mall.replace(/\s*[–-]?\s*\{kund\}/, '').trim()
}

// Skriver alltid över hela deltagarlistan för uppgiften (radera + återskapa)
// istället för att diffa — enklast att hålla korrekt när man kan både lägga
// till och ta bort deltagare i samma redigering.
async function synkaDeltagare(
  supabase: Awaited<ReturnType<typeof createClient>>,
  uppgiftId: string,
  foretagId: string,
  deltagareIds: string[]
) {
  await supabase.from('uppgift_deltagare').delete().eq('uppgift_id', uppgiftId)
  if (deltagareIds.length === 0) return
  await supabase.from('uppgift_deltagare').insert(
    deltagareIds.map((kontaktpersonId) => ({
      uppgift_id: uppgiftId,
      kontaktperson_id: kontaktpersonId,
      foretag_id: foretagId,
      typ: 'obligatorisk',
    }))
  )
}


export async function skapaUppgift(input: {
  titel: string
  beskrivning: string
  personId: string
  kundId: string
  typId: string
  uppgiftsprojektId: string
  projektId: string
  prioritet: string
  deadline: string | null
  status: string
  tidsatgangTimmar: number | null
  klockslag: string | null
  deltagareIds: string[]
}) {
  const foretagId = await currentForetagId()
  if (!foretagId) return

  const supabase = await createClient()
  const sortordning = beraknaSortordning(input.deadline, input.klockslag)
  const { data: nyUppgift } = await supabase
    .from('uppgift')
    .insert({
      foretag_id: foretagId,
      titel: input.titel,
      beskrivning: input.beskrivning || null,
      person_id: input.personId || null,
      kund_id: input.kundId || null,
      typ_id: input.typId || null,
      uppgiftsprojekt_id: input.uppgiftsprojektId || null,
      projekt_id: input.projektId || null,
      prioritet: input.prioritet,
      deadline: input.deadline,
      status: input.status,
      tidsatgang_timmar: input.tidsatgangTimmar,
      klockslag: input.klockslag,
      ...(sortordning !== undefined ? { sortordning } : {}),
    })
    .select('id')
    .single()

  if (nyUppgift && input.deltagareIds.length > 0) {
    await synkaDeltagare(supabase, nyUppgift.id, foretagId, input.deltagareIds)
  }

  revalidatePath('/uppgifter')
}

export async function skapaUppgiftSerie(input: {
  titel: string
  beskrivning: string
  personId: string
  kundId: string
  typId: string
  uppgiftsprojektId: string
  prioritet: string
  startDatum: string
  veckodagar: number[]
  intervallVeckor: number
  slutDatum: string | null
  tidsatgangTimmar: number | null
  klockslag: string | null
}) {
  if (input.veckodagar.length === 0) return
  const foretagId = await currentForetagId()
  if (!foretagId) return

  const supabase = await createClient()
  await supabase.from('uppgift_serie').insert({
    foretag_id: foretagId,
    titel: input.titel,
    beskrivning: input.beskrivning || null,
    person_id: input.personId || null,
    kund_id: input.kundId || null,
    typ_id: input.typId || null,
    uppgiftsprojekt_id: input.uppgiftsprojektId || null,
    prioritet: input.prioritet,
    start_datum: input.startDatum,
    veckodagar: input.veckodagar,
    intervall_veckor: input.intervallVeckor,
    slut_datum: input.slutDatum,
    tidsatgang_timmar: input.tidsatgangTimmar,
    klockslag: input.klockslag,
  })

  await supabase.rpc('generera_serie_forekomster', { p_foretag_id: foretagId })

  revalidatePath('/uppgifter')
}

export async function gorUppgiftAterkommande(
  uppgiftId: string,
  input: {
    titel: string
    beskrivning: string
    personId: string
    kundId: string
    typId: string
    uppgiftsprojektId: string
    prioritet: string
    startDatum: string
    veckodagar: number[]
    intervallVeckor: number
    slutDatum: string | null
    tidsatgangTimmar: number | null
    klockslag: string | null
  }
) {
  if (input.veckodagar.length === 0) return
  const foretagId = await currentForetagId()
  if (!foretagId) return

  const supabase = await createClient()

  const { data: serie } = await supabase
    .from('uppgift_serie')
    .insert({
      foretag_id: foretagId,
      titel: input.titel,
      beskrivning: input.beskrivning || null,
      person_id: input.personId || null,
      kund_id: input.kundId || null,
      typ_id: input.typId || null,
      uppgiftsprojekt_id: input.uppgiftsprojektId || null,
      prioritet: input.prioritet,
      start_datum: input.startDatum,
      veckodagar: input.veckodagar,
      intervall_veckor: input.intervallVeckor,
      slut_datum: input.slutDatum,
      tidsatgang_timmar: input.tidsatgangTimmar,
      klockslag: input.klockslag,
      // hindrar att startdatumet genereras en gång till — den befintliga
      // uppgiften utgör redan den förekomsten
      senast_genererad_datum: input.startDatum,
    })
    .select('id')
    .single()

  if (!serie) return

  const sortordning = beraknaSortordning(input.startDatum, input.klockslag)
  await supabase
    .from('uppgift')
    .update({
      serie_id: serie.id,
      titel: input.titel,
      beskrivning: input.beskrivning || null,
      person_id: input.personId || null,
      kund_id: input.kundId || null,
      typ_id: input.typId || null,
      uppgiftsprojekt_id: input.uppgiftsprojektId || null,
      prioritet: input.prioritet,
      deadline: input.startDatum,
      klockslag: input.klockslag,
      ...(sortordning !== undefined ? { sortordning } : {}),
    })
    .eq('id', uppgiftId)

  await supabase.rpc('generera_serie_forekomster', { p_foretag_id: foretagId })

  revalidatePath('/uppgifter')
}

export async function uppdateraSerie(
  id: string,
  input: {
    titel: string
    beskrivning: string
    personId: string
    kundId: string
    typId: string
    uppgiftsprojektId: string
    prioritet: string
    startDatum: string
    veckodagar: number[]
    intervallVeckor: number
    slutDatum: string | null
    tidsatgangTimmar: number | null
    klockslag: string | null
  }
) {
  if (input.veckodagar.length === 0) return
  const foretagId = await currentForetagId()
  if (!foretagId) return

  const supabase = await createClient()
  const idag = todayISODate()

  // En serie som ännu inte börjat (startdatum efter idag) har inget att
  // "redan ha genererat" — nollställs istället för att sättas till idag, annars
  // trodde generera_serie_forekomster att allt fram till idag redan fanns och
  // skulle (innan skyddet i själva SQL-funktionen) kunna börja generera
  // förekomster före det tänkta startdatumet.
  const senastGenererat = input.startDatum > idag ? null : idag

  await supabase
    .from('uppgift_serie')
    .update({
      titel: input.titel,
      beskrivning: input.beskrivning || null,
      person_id: input.personId || null,
      kund_id: input.kundId || null,
      typ_id: input.typId || null,
      uppgiftsprojekt_id: input.uppgiftsprojektId || null,
      prioritet: input.prioritet,
      start_datum: input.startDatum,
      veckodagar: input.veckodagar,
      intervall_veckor: input.intervallVeckor,
      slut_datum: input.slutDatum,
      tidsatgang_timmar: input.tidsatgangTimmar,
      klockslag: input.klockslag,
      senast_genererad_datum: senastGenererat,
    })
    .eq('id', id)

  // rensa bort ej pabörjade framtida förekomster som byggdes enligt den gamla regeln —
  // redan klara/pågående lämnas orörda. Nästa generering (vid sidladdning) bygger om
  // resten enligt den nya regeln.
  await supabase.from('uppgift').delete().eq('serie_id', id).eq('status', 'oppen').gt('deadline', idag)

  await supabase.rpc('generera_serie_forekomster', { p_foretag_id: foretagId })

  revalidatePath('/uppgifter')
}

export async function avslutaSerie(id: string) {
  const foretagId = await currentForetagId()
  if (!foretagId) return

  const supabase = await createClient()
  const idag = todayISODate()

  await supabase.from('uppgift_serie').update({ slut_datum: idag }).eq('id', id)
  await supabase.from('uppgift').delete().eq('serie_id', id).eq('status', 'oppen').gt('deadline', idag)

  revalidatePath('/uppgifter')
}

export async function taBortSerie(id: string) {
  const supabase = await createClient()
  await supabase.from('uppgift_serie').delete().eq('id', id)
  revalidatePath('/uppgifter')
}

export async function uppdateraUppgift(
  id: string,
  input: {
    titel: string
    beskrivning: string
    personId: string
    kundId: string
    typId: string
    uppgiftsprojektId: string
    projektId: string
    prioritet: string
    deadline: string | null
    status: string
    tidsatgangTimmar: number | null
    klockslag: string | null
    deltagareIds: string[]
  }
) {
  const foretagId = await currentForetagId()
  if (!foretagId) return

  const supabase = await createClient()
  const sortordning = beraknaSortordning(input.deadline, input.klockslag)
  await supabase
    .from('uppgift')
    .update({
      titel: input.titel,
      beskrivning: input.beskrivning || null,
      person_id: input.personId || null,
      kund_id: input.kundId || null,
      typ_id: input.typId || null,
      uppgiftsprojekt_id: input.uppgiftsprojektId || null,
      projekt_id: input.projektId || null,
      prioritet: input.prioritet,
      deadline: input.deadline,
      status: input.status,
      tidsatgang_timmar: input.tidsatgangTimmar,
      klockslag: input.klockslag,
      ...(sortordning !== undefined ? { sortordning } : {}),
    })
    .eq('id', id)

  await synkaDeltagare(supabase, id, foretagId, input.deltagareIds)

  if (input.status === 'klar') {
    await genereraOmAktiverat(supabase, id, foretagId)
  }

  revalidatePath('/uppgifter')
  revalidatePath('/')
}

export async function flyttaUppgift(id: string, deadline: string | null, sortordning: number) {
  const supabase = await createClient()
  await supabase.from('uppgift').update({ deadline, sortordning }).eq('id', id)
  revalidatePath('/uppgifter')
}

export async function uppdateraStatus(id: string, status: string) {
  const supabase = await createClient()
  await supabase.from('uppgift').update({ status }).eq('id', id)

  if (status === 'klar') {
    const foretagId = await currentForetagId()
    if (foretagId) await genereraOmAktiverat(supabase, id, foretagId)
  }

  revalidatePath('/uppgifter')
  revalidatePath('/')
}

export async function taBortUppgift(id: string) {
  const supabase = await createClient()
  await supabase.from('uppgift').delete().eq('id', id)
  revalidatePath('/uppgifter')
}

// Ingen revalidatePath här — autosparas var 1,5:e sekund medan användaren skriver,
// och en tvingad omhämtning av sidans serverdata skulle bara störa skrivfokus i
// onödan. Lokalt state i formuläret redan speglar det som sparas.
export async function sparaAnteckning(uppgiftId: string, blockId: string, innehall: string) {
  const foretagId = await currentForetagId()
  if (!foretagId) return

  const supabase = await createClient()
  await supabase.from('uppgift_anteckning').upsert(
    {
      uppgift_id: uppgiftId,
      block_id: blockId,
      foretag_id: foretagId,
      innehall,
      uppdaterad_at: new Date().toISOString(),
    },
    { onConflict: 'uppgift_id,block_id' }
  )
}

export async function hamtaAnteckningarForUppgift(uppgiftId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('uppgift_anteckning')
    .select(
      'block_id, innehall, uppgift_id_genererad, genererad:uppgift!uppgift_anteckning_uppgift_id_genererad_fkey(titel, deadline)'
    )
    .eq('uppgift_id', uppgiftId)

  return (data ?? []).map((rad) => {
    const genererad = enTillRelation(rad.genererad)
    return {
      block_id: rad.block_id,
      innehall: rad.innehall ?? '',
      uppgift_id_genererad: rad.uppgift_id_genererad,
      genererad_titel: genererad?.titel ?? null,
      genererad_deadline: genererad?.deadline ?? null,
    }
  })
}

// Går att klicka/köra flera gånger utan att skapa dubbletter — spårningen sker per
// block via uppgift_anteckning.uppgift_id_genererad, som hoppas över när den redan
// är satt. Delad kärna: anropas både av den manuella knappen och av automatiken när
// status sätts till klar (se genereraOmAktiverat nedan).
async function genereraUppgifterKarna(
  supabase: Awaited<ReturnType<typeof createClient>>,
  uppgiftId: string,
  foretagId: string
): Promise<number> {
  const { data: mote } = await supabase
    .from('uppgift')
    .select('kund_id, person_id, deadline, kund:kund_id(namn)')
    .eq('id', uppgiftId)
    .single()
  if (!mote) return 0

  const { data: anteckningar } = await supabase
    .from('uppgift_anteckning')
    .select(
      'id, innehall, uppgift_id_genererad, block:block_id(genererar_uppgift, aktiv, uppgift_titel_mall, uppgift_typ_id, deadline_dagar_efter_motet)'
    )
    .eq('uppgift_id', uppgiftId)

  const kundNamn = enTillRelation(mote.kund)?.namn ?? null

  const attGenerera = (anteckningar ?? [])
    .map((a) => ({ ...a, block: enTillRelation(a.block) }))
    .filter(
      (a) => a.block?.genererar_uppgift && a.block.aktiv && !a.uppgift_id_genererad && (a.innehall ?? '').trim()
    )

  let antalGenererade = 0

  for (const anteckning of attGenerera) {
    const block = anteckning.block!
    const titel = fyllTitelMall(block.uppgift_titel_mall ?? '', kundNamn)
    const deadline =
      block.deadline_dagar_efter_motet != null && mote.deadline
        ? leggTillDagar(mote.deadline, block.deadline_dagar_efter_motet)
        : null

    const { data: nyUppgift } = await supabase
      .from('uppgift')
      .insert({
        foretag_id: foretagId,
        titel,
        beskrivning: anteckning.innehall,
        kund_id: mote.kund_id,
        person_id: mote.person_id,
        typ_id: block.uppgift_typ_id,
        deadline,
        status: 'oppen',
        prioritet: 'lag',
        genererad_fran_uppgift_id: uppgiftId,
      })
      .select('id')
      .single()

    if (nyUppgift) {
      await supabase
        .from('uppgift_anteckning')
        .update({ uppgift_id_genererad: nyUppgift.id })
        .eq('id', anteckning.id)
      antalGenererade++
    }
  }

  return antalGenererade
}

export async function genereraUppgifterFranAnteckningar(uppgiftId: string) {
  const foretagId = await currentForetagId()
  if (!foretagId) return { antalGenererade: 0 }

  const supabase = await createClient()
  const antalGenererade = await genereraUppgifterKarna(supabase, uppgiftId, foretagId)
  if (antalGenererade > 0) revalidatePath('/uppgifter')
  return { antalGenererade }
}

// Körs varje gång en uppgift sätts till klar (dropdown i formuläret eller
// kryssrutan på Kanban-kortet) — genererar bara om det effektiva värdet
// (uppgiftens egen inställning, annars typens standard) är påslaget.
async function genereraOmAktiverat(
  supabase: Awaited<ReturnType<typeof createClient>>,
  uppgiftId: string,
  foretagId: string
) {
  const { data: uppgift } = await supabase
    .from('uppgift')
    .select('skapa_uppgifter_vid_klar, typ:typ_id(skapa_uppgifter_vid_klar)')
    .eq('id', uppgiftId)
    .single()
  if (!uppgift) return

  const typStandard = enTillRelation(uppgift.typ)?.skapa_uppgifter_vid_klar ?? false
  const aktiverat = uppgift.skapa_uppgifter_vid_klar ?? typStandard
  if (aktiverat) {
    await genereraUppgifterKarna(supabase, uppgiftId, foretagId)
  }
}

export async function uppdateraAutoSkapaUppgifter(uppgiftId: string, varde: boolean) {
  const supabase = await createClient()
  await supabase.from('uppgift').update({ skapa_uppgifter_vid_klar: varde }).eq('id', uppgiftId)
}

export async function byggKundsammanfattning(uppgiftId: string) {
  const supabase = await createClient()

  const { data: mote } = await supabase
    .from('uppgift')
    .select(
      'titel, deadline, kund:kund_id(namn), uppgift_deltagare(kontaktperson:kontaktperson_id(epost))'
    )
    .eq('id', uppgiftId)
    .single()
  if (!mote) return null

  const { data: anteckningar } = await supabase
    .from('uppgift_anteckning')
    .select(
      'innehall, block:block_id(namn, kundvisning_standard), genererad:uppgift!uppgift_anteckning_uppgift_id_genererad_fkey(titel, status)'
    )
    .eq('uppgift_id', uppgiftId)

  const kundNamn = enTillRelation(mote.kund)?.namn ?? ''
  const till = (mote.uppgift_deltagare ?? [])
    .map((d) => enTillRelation(d.kontaktperson)?.epost)
    .filter((epost): epost is string => !!epost)

  const rader = (anteckningar ?? []).map((a) => ({
    innehall: a.innehall,
    block: enTillRelation(a.block),
    genererad: enTillRelation(a.genererad),
  }))

  const kundvisningsBlock = rader.filter((a) => a.block?.kundvisning_standard && a.innehall?.trim())
  const klaraGenererade = rader
    .map((a) => a.genererad)
    .filter((g): g is { titel: string; status: string } => !!g && g.status === 'klar')

  const brodtextDelar = kundvisningsBlock.map((a) => `${a.block!.namn}\n${a.innehall}`)
  if (klaraGenererade.length > 0) {
    brodtextDelar.push(`Genomfört:\n${klaraGenererade.map((g) => `- ${g.titel}`).join('\n')}`)
  }

  const amne = `Sammanfattning – ${kundNamn} – ${mote.titel} ${mote.deadline ?? ''}`.trim()
  const brodtext = brodtextDelar.join('\n\n')

  await supabase
    .from('uppgift')
    .update({ sammanfattning_skickad_at: new Date().toISOString() })
    .eq('id', uppgiftId)

  return { till, amne, brodtext }
}

export async function hamtaTidigareMoten(kundId: string, excludeUppgiftId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('uppgift')
    .select(
      'id, titel, deadline, typ:typ_id!inner(visar_motesanteckningar), uppgift_anteckning!uppgift_anteckning_uppgift_id_fkey(innehall, block:block_id(namn))'
    )
    .eq('kund_id', kundId)
    .eq('typ.visar_motesanteckningar', true)
    .neq('id', excludeUppgiftId)
    .not('deadline', 'is', null)
    .order('deadline', { ascending: false })
    .limit(10)

  return (data ?? []).map((u) => ({
    id: u.id,
    titel: u.titel,
    deadline: u.deadline as string,
    utdrag: (u.uppgift_anteckning ?? [])
      .filter((a) => a.innehall?.trim())
      .slice(0, 2)
      .map((a) => `${enTillRelation(a.block)?.namn}: ${(a.innehall ?? '').slice(0, 80)}`),
  }))
}
