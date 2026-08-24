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
  anteckningar?: { blockId: string; innehall: string }[]
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

  if (nyUppgift && input.anteckningar && input.anteckningar.length > 0) {
    await supabase.from('uppgift_anteckning').insert(
      input.anteckningar.map((a) => ({
        uppgift_id: nyUppgift.id,
        block_id: a.blockId,
        foretag_id: foretagId,
        innehall: a.innehall,
        uppdaterad_at: new Date().toISOString(),
      }))
    )
  }

  revalidatePath('/uppgifter')
}

// Adopterar alla Outlook-synkade uppgifter i samma Outlook-serie in i den
// kopplade uppgift_serie: sätter serie_id och ärver kategori/typ/kund
// därifrån (seriens kund vinner över Outlook-synkens ämnesradstolkning,
// eftersom den är ett explicit val). Körs både när kopplingen skapas
// (fångar redan synkade förekomster) och vid varje uppdatering av serien
// (håller adopterade rader i synk). Rör aldrig fält Outlook själv äger
// (titel, deadline, klockslag osv).
// Om synkFranDatum är satt raderas först alla matchande förekomster äldre än
// det datumet (spökposter från innan mötesserien "på riktigt" drog igång) —
// samma gräns som webhooken sedan använder för att aldrig återskapa dem.
async function synkaOutlookSerieUppgifter(
  supabase: Awaited<ReturnType<typeof createClient>>,
  foretagId: string,
  serieId: string,
  outlookSeriesId: string,
  kundId: string | null,
  kategoriId: string | null,
  typId: string | null,
  synkFranDatum: string | null
) {
  if (synkFranDatum) {
    await supabase
      .from('uppgift')
      .delete()
      .eq('foretag_id', foretagId)
      .eq('outlook_series_id', outlookSeriesId)
      .not('outlook_event_id', 'is', null)
      .lt('deadline', synkFranDatum)
  }

  await supabase
    .from('uppgift')
    .update({
      serie_id: serieId,
      ...(kundId ? { kund_id: kundId } : {}),
      ...(kategoriId ? { kategori_id: kategoriId } : {}),
      ...(typId ? { typ_id: typId } : {}),
    })
    .eq('foretag_id', foretagId)
    .eq('outlook_series_id', outlookSeriesId)
    .not('outlook_event_id', 'is', null)
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
  outlookSeriesId: string | null
  synkFranDatum: string | null
}) {
  const outlookKopplad = !!input.outlookSeriesId
  if (!outlookKopplad && input.veckodagar.length === 0) return
  const foretagId = await currentForetagId()
  if (!foretagId) return

  const supabase = await createClient()
  const { data: nySerie } = await supabase
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
      outlook_series_id: input.outlookSeriesId,
      synk_fran_datum: outlookKopplad ? input.synkFranDatum : null,
    })
    .select('id')
    .single()

  if (outlookKopplad && nySerie) {
    await synkaOutlookSerieUppgifter(
      supabase,
      foretagId,
      nySerie.id,
      input.outlookSeriesId!,
      input.kundId || null,
      input.kategoriId || null,
      input.typId || null,
      input.synkFranDatum
    )
  } else {
    await supabase.rpc('generera_serie_forekomster', { p_foretag_id: foretagId })
  }

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
    synkFranDatum: string | null
  }
) {
  const foretagId = await currentForetagId()
  if (!foretagId) return

  const supabase = await createClient()
  const idag = todayISODate()

  const { data: befintligSerie } = await supabase
    .from('uppgift_serie')
    .select('outlook_series_id')
    .eq('id', id)
    .single()
  const outlookSeriesId = befintligSerie?.outlook_series_id ?? null

  if (!outlookSeriesId && input.veckodagar.length === 0) return

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
      ...(outlookSeriesId ? { synk_fran_datum: input.synkFranDatum } : {}),
    })
    .eq('id', id)

  if (outlookSeriesId) {
    await synkaOutlookSerieUppgifter(
      supabase,
      foretagId,
      id,
      outlookSeriesId,
      input.kundId || null,
      input.kategoriId || null,
      input.typId || null,
      input.synkFranDatum
    )
  } else {
    // rensa bort ej pabörjade framtida förekomster som byggdes enligt den gamla regeln —
    // redan klara/pågående lämnas orörda. Nästa generering (vid sidladdning) bygger om
    // resten enligt den nya regeln. outlook_event_id-raderna rörs aldrig här — de ägs
    // av Outlook-synken, inte av generatorn.
    await supabase
      .from('uppgift')
      .delete()
      .eq('serie_id', id)
      .eq('status', 'oppen')
      .gt('deadline', idag)
      .is('outlook_event_id', null)

    await supabase.rpc('generera_serie_forekomster', { p_foretag_id: foretagId })
  }

  revalidatePath('/uppgifter')
}

export async function avslutaSerie(id: string) {
  const foretagId = await currentForetagId()
  if (!foretagId) return

  const supabase = await createClient()
  const idag = todayISODate()

  await supabase.from('uppgift_serie').update({ slut_datum: idag }).eq('id', id)
  await supabase
    .from('uppgift')
    .delete()
    .eq('serie_id', id)
    .eq('status', 'oppen')
    .gt('deadline', idag)
    .is('outlook_event_id', null)

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

  revalidatePath('/uppgifter')
  revalidatePath('/')
  revalidatePath('/projekt')
  revalidatePath('/rapporter/tidsrapportering')
}

export async function flyttaUppgift(id: string, deadline: string | null, sortordning: number) {
  const supabase = await createClient()
  await supabase.from('uppgift').update({ deadline, sortordning }).eq('id', id)
  revalidatePath('/uppgifter')
}

export async function uppdateraStatus(id: string, status: string, tidsatgangTimmar?: number | null) {
  const supabase = await createClient()
  await supabase
    .from('uppgift')
    .update(tidsatgangTimmar === undefined ? { status } : { status, tidsatgang_timmar: tidsatgangTimmar })
    .eq('id', id)

  revalidatePath('/uppgifter')
  revalidatePath('/')
  revalidatePath('/projekt')
}

export async function taBortUppgift(id: string) {
  const supabase = await createClient()
  await supabase.from('uppgift').delete().eq('id', id)
  revalidatePath('/uppgifter')
  revalidatePath('/')
  revalidatePath('/projekt')
  revalidatePath('/rapporter/tidsrapportering')
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
