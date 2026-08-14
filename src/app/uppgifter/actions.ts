'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { beraknaSortordning } from '@/lib/sortordning'

async function currentForetagId() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: person } = await supabase
    .from('person')
    .select('foretag_id')
    .eq('auth_user_id', user.id)
    .single()

  return person?.foretag_id ?? null
}

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
      prioritet: input.prioritet,
      deadline: input.deadline,
      status: input.status,
      tidsatgang_timmar: input.tidsatgangTimmar,
      klockslag: input.klockslag,
      ...(sortordning !== undefined ? { sortordning } : {}),
    })
    .eq('id', id)

  await synkaDeltagare(supabase, id, foretagId, input.deltagareIds)

  revalidatePath('/uppgifter')
}

export async function flyttaUppgift(id: string, deadline: string | null, sortordning: number) {
  const supabase = await createClient()
  await supabase.from('uppgift').update({ deadline, sortordning }).eq('id', id)
  revalidatePath('/uppgifter')
}

export async function uppdateraStatus(id: string, status: string) {
  const supabase = await createClient()
  await supabase.from('uppgift').update({ status }).eq('id', id)
  revalidatePath('/uppgifter')
}

export async function taBortUppgift(id: string) {
  const supabase = await createClient()
  await supabase.from('uppgift').delete().eq('id', id)
  revalidatePath('/uppgifter')
}
