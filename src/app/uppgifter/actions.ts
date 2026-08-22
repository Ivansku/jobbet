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

// Skriver alltid över hela deltagarlistan för uppgiften (radera + återskapa)
// istället för att diffa — enklast att hålla korrekt när man kan både lägga
// till och ta bort deltagare i samma redigering.
// Nya uppgifter utan klockslag ska hamna sist i sin kolumns lista (samma beteende
// som drag-and-drop redan ger), inte högst upp eller på en godtycklig plats.
async function sistaSortordningForNyUppgift(
  supabase: Awaited<ReturnType<typeof createClient>>,
  foretagId: string,
  deadline: string | null
): Promise<number> {
  let query = supabase
    .from('uppgift')
    .select('sortordning')
    .eq('foretag_id', foretagId)
    .order('sortordning', { ascending: false })
    .limit(1)
  query = deadline ? query.eq('deadline', deadline) : query.is('deadline', null)
  const { data } = await query
  return data && data.length > 0 ? data[0].sortordning + 1 : 0
}

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
  kategoriId: string
  projektId: string
  prioritet: string
  deadline: string | null
  status: string
  tidsatgangTimmar: number | null
  klockslag: string | null
  deltagareIds: string[]
  arPlaceholder: boolean
}) {
  const foretagId = await currentForetagId()
  if (!foretagId) return

  const supabase = await createClient()
  const sortordning =
    beraknaSortordning(input.deadline, input.klockslag) ??
    (await sistaSortordningForNyUppgift(supabase, foretagId, input.deadline))
  const { data: nyUppgift } = await supabase
    .from('uppgift')
    .insert({
      foretag_id: foretagId,
      titel: input.titel,
      beskrivning: input.beskrivning || null,
      person_id: input.personId || null,
      kund_id: input.kundId || null,
      typ_id: input.typId || null,
      kategori_id: input.kategoriId || null,
      projekt_id: input.projektId || null,
      prioritet: input.prioritet,
      deadline: input.deadline,
      status: input.status,
      tidsatgang_timmar: input.tidsatgangTimmar,
      klockslag: input.klockslag,
      ar_placeholder: input.arPlaceholder,
      sortordning,
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
  kategoriId: string
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
    kategori_id: input.kategoriId || null,
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
    kategoriId: string
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
      kategori_id: input.kategoriId || null,
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
      kategori_id: input.kategoriId || null,
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
    kategoriId: string
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
      kategori_id: input.kategoriId || null,
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

// Explicit, separat åtgärd: raderar även alla uppgifter som skapats av serien.
export async function taBortSerieMedUppgifter(id: string) {
  const supabase = await createClient()
  await supabase.from('uppgift').delete().eq('serie_id', id)
  await supabase.from('uppgift_serie').delete().eq('id', id)
  revalidatePath('/uppgifter')
}

export async function raknaSerieUppgifter(id: string) {
  const supabase = await createClient()
  const { count } = await supabase
    .from('uppgift')
    .select('id', { count: 'exact', head: true })
    .eq('serie_id', id)
  return count ?? 0
}

export async function uppdateraUppgift(
  id: string,
  input: {
    titel: string
    beskrivning: string
    personId: string
    kundId: string
    typId: string
    kategoriId: string
    projektId: string
    prioritet: string
    deadline: string | null
    status: string
    tidsatgangTimmar: number | null
    klockslag: string | null
    deltagareIds: string[]
    arPlaceholder: boolean
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
      kategori_id: input.kategoriId || null,
      projekt_id: input.projektId || null,
      prioritet: input.prioritet,
      deadline: input.deadline,
      status: input.status,
      tidsatgang_timmar: input.tidsatgangTimmar,
      klockslag: input.klockslag,
      ar_placeholder: input.arPlaceholder,
      ...(sortordning !== undefined ? { sortordning } : {}),
    })
    .eq('id', id)

  await synkaDeltagare(supabase, id, foretagId, input.deltagareIds)

  if (input.status === 'klar') {
    await fyllINedstromsBeskrivningarFranAnteckningar(supabase, id)
  }

  revalidatePath('/uppgifter')
  revalidatePath('/')
  revalidatePath('/projekt')
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
    await fyllINedstromsBeskrivningarFranAnteckningar(supabase, id)
  }

  revalidatePath('/uppgifter')
  revalidatePath('/')
  revalidatePath('/projekt')
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

// Fyller i beskrivningen på andra uppgifter i samma projekt (t.ex. "Konfigurera")
// med anteckningar från en mötesuppgift, enligt mappningen admin satt upp i mallen
// (mall_uppgift_anteckningskalla: vilken mall-uppgift som ska ha vilka block).
// Skriver bara in text när mottagarens beskrivning fortfarande är tom — rör
// aldrig ett fält någon redan fyllt i manuellt, samma princip som
// kopplaTillPlaceholder använder för kategori/anteckningsmall.
async function fyllINedstromsBeskrivningarFranAnteckningar(
  supabase: Awaited<ReturnType<typeof createClient>>,
  motesUppgiftId: string
) {
  const { data: mote } = await supabase
    .from('uppgift')
    .select('projekt_id')
    .eq('id', motesUppgiftId)
    .single()
  if (!mote?.projekt_id) return

  const { data: anteckningar } = await supabase
    .from('uppgift_anteckning')
    .select('block_id, innehall, block:block_id(namn)')
    .eq('uppgift_id', motesUppgiftId)

  const ifyllda = (anteckningar ?? [])
    .map((a) => ({
      block_id: a.block_id,
      innehall: (a.innehall ?? '').trim(),
      namn: enTillRelation(a.block)?.namn ?? '',
    }))
    .filter((a) => a.innehall)
  if (ifyllda.length === 0) return

  const { data: kallor } = await supabase
    .from('mall_uppgift_anteckningskalla')
    .select('mall_uppgift_id, block_id, sortordning')
    .in(
      'block_id',
      ifyllda.map((a) => a.block_id)
    )
  if (!kallor || kallor.length === 0) return

  const perMallUppgift = new Map<string, typeof kallor>()
  for (const k of kallor) {
    perMallUppgift.set(k.mall_uppgift_id, [...(perMallUppgift.get(k.mall_uppgift_id) ?? []), k])
  }

  for (const [mallUppgiftId, blockRefs] of perMallUppgift) {
    const { data: mal } = await supabase
      .from('uppgift')
      .select('id, beskrivning')
      .eq('projekt_id', mote.projekt_id)
      .eq('mall_uppgift_id', mallUppgiftId)
      .maybeSingle()
    if (!mal || (mal.beskrivning ?? '').trim()) continue

    const text = blockRefs
      .slice()
      .sort((a, b) => a.sortordning - b.sortordning)
      .map((ref) => ifyllda.find((a) => a.block_id === ref.block_id))
      .filter((a): a is (typeof ifyllda)[number] => !!a)
      .map((a) => `# ${a.namn}\n${a.innehall}`)
      .join('\n\n')
    if (!text) continue

    await supabase.from('uppgift').update({ beskrivning: text }).eq('id', mal.id)
  }
}

export async function hamtaTidigareMoten(kundId: string, excludeUppgiftId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('uppgift')
    .select(
      'id, titel, deadline, typ:typ_id!inner(anteckningsmall_id), uppgift_anteckning!uppgift_anteckning_uppgift_id_fkey(innehall, block:block_id(namn))'
    )
    .eq('kund_id', kundId)
    .not('typ.anteckningsmall_id', 'is', null)
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

// Kopplar en riktig uppgift till en väntande placeholder i samma projekt: skriver
// projekt_id (från det projekt som var valt i formuläret när kopplingen gjordes) och
// fyller i kategori_id/anteckningsmall_id om de är tomma på den riktiga uppgiften och
// placeholdern hade ett värde — skriver annars aldrig över redan ifyllda fält. Tar också
// över placeholderns sortordning, så den riktiga uppgiften hamnar på samma plats i
// projektlistan som placeholdern hade (mallens tänkta ordning) istället för att sortera
// om baserat på det verkliga mötets datum, som ofta avviker från vad mallen planerade.
// Raderar sedan placeholder-raden. projektId kommer från formulärets (osparade) val,
// inte från databasen — "Koppla" är en egen åtgärd som sparar oberoende av formulärets
// "Spara"-knapp, så den riktiga uppgiftens projekt_id kan fortfarande vara tomt i
// databasen när det här körs.
export async function kopplaTillPlaceholder(riktigUppgiftId: string, projektId: string, placeholderId: string) {
  const supabase = await createClient()

  const { data: riktig } = await supabase
    .from('uppgift')
    .select('id, kategori_id, anteckningsmall_id')
    .eq('id', riktigUppgiftId)
    .single()
  if (!riktig) return { success: false as const }

  const { data: placeholder } = await supabase
    .from('uppgift')
    .select('id, projekt_id, kategori_id, sortordning, anteckningsmall_id, utan_anteckningsmall')
    .eq('id', placeholderId)
    .eq('ar_placeholder', true)
    .single()
  if (!placeholder || placeholder.projekt_id !== projektId) return { success: false as const }

  // Felet loggas men avbryter inte längre tyst — tidigare kunde en misslyckad update
  // (t.ex. en constraint) ändå resultera i success:true och en borttagen placeholder.
  const { error: updateError } = await supabase
    .from('uppgift')
    .update({
      projekt_id: projektId,
      sortordning: placeholder.sortordning,
      ...(riktig.kategori_id == null && placeholder.kategori_id != null
        ? { kategori_id: placeholder.kategori_id }
        : {}),
      ...(riktig.anteckningsmall_id == null && placeholder.anteckningsmall_id != null
        ? { anteckningsmall_id: placeholder.anteckningsmall_id }
        : {}),
      // Bara ärvd när placeholdern uttryckligen sattes till "Ingen mall" — en
      // falsk placeholder-flagga betyder bara "aldrig satt" och ska aldrig kunna
      // slå tillbaka en riktig uppgifts egen true till false.
      ...(placeholder.utan_anteckningsmall ? { utan_anteckningsmall: true } : {}),
    })
    .eq('id', riktigUppgiftId)
  if (updateError) {
    console.error('[kopplaTillPlaceholder] update misslyckades', updateError)
    return { success: false as const }
  }

  const { error: deleteError } = await supabase.from('uppgift').delete().eq('id', placeholderId)
  if (deleteError) {
    console.error('[kopplaTillPlaceholder] delete av placeholder misslyckades', deleteError)
  }

  revalidatePath('/uppgifter')
  return { success: true as const }
}
