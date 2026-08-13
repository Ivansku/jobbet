'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

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
}) {
  const foretagId = await currentForetagId()
  if (!foretagId) return

  const supabase = await createClient()
  await supabase.from('uppgift').insert({
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
  })

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
      // hindrar att startdatumet genereras en gång till — den befintliga
      // uppgiften utgör redan den förekomsten
      senast_genererad_datum: input.startDatum,
    })
    .select('id')
    .single()

  if (!serie) return

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
    veckodagar: number[]
    intervallVeckor: number
    slutDatum: string | null
  }
) {
  if (input.veckodagar.length === 0) return
  const foretagId = await currentForetagId()
  if (!foretagId) return

  const supabase = await createClient()
  const idag = todayISODate()

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
      veckodagar: input.veckodagar,
      intervall_veckor: input.intervallVeckor,
      slut_datum: input.slutDatum,
      senast_genererad_datum: idag,
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
  }
) {
  const supabase = await createClient()
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
    })
    .eq('id', id)

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
