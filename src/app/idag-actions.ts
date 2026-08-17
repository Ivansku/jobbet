'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { beraknaSortordning } from '@/lib/sortordning'

const MAX_FOKUSUPPGIFTER = 3

async function hamtaPerson() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: person } = await supabase
    .from('person')
    .select('id, foretag_id')
    .eq('auth_user_id', user.id)
    .single()

  return person
}

// Skriver alltid över hela fokuslistan för dagen (radera + återskapa) istället
// för att diffa — samma val som synkaDeltagare i uppgifter/actions.ts, och här
// finns aldrig fler än tre rader att skriva om.
export async function sattDagensFokus(datum: string, uppgiftIds: string[]) {
  if (uppgiftIds.length > MAX_FOKUSUPPGIFTER) {
    return { error: `Max ${MAX_FOKUSUPPGIFTER} fokusuppgifter per dag.` }
  }

  const person = await hamtaPerson()
  if (!person) return { error: 'Kunde inte identifiera person.' }

  const supabase = await createClient()
  await supabase.from('dagsfokus').delete().eq('person_id', person.id).eq('datum', datum)

  if (uppgiftIds.length > 0) {
    const { error } = await supabase.from('dagsfokus').insert(
      uppgiftIds.map((uppgiftId) => ({
        person_id: person.id,
        foretag_id: person.foretag_id,
        datum,
        uppgift_id: uppgiftId,
      }))
    )
    if (error) return { error: error.message }
  }

  revalidatePath('/')
  return { error: null }
}

export async function skapaReflektionstanke(
  dagsavslutId: string,
  text: string,
  gorTillUppgift: boolean,
  imorgonDatum: string
) {
  const textTrimmad = text.trim()
  if (!textTrimmad) return { error: 'Text krävs.' }

  const person = await hamtaPerson()
  if (!person) return { error: 'Kunde inte identifiera person.' }

  const supabase = await createClient()
  let uppgiftIdSkapad: string | null = null

  if (gorTillUppgift) {
    const sortordning = beraknaSortordning(imorgonDatum, null)
    const { data: nyUppgift } = await supabase
      .from('uppgift')
      .insert({
        foretag_id: person.foretag_id,
        titel: textTrimmad,
        person_id: person.id,
        deadline: imorgonDatum,
        ...(sortordning !== undefined ? { sortordning } : {}),
      })
      .select('id')
      .single()
    uppgiftIdSkapad = nyUppgift?.id ?? null
  }

  const { error } = await supabase.from('dagsavslut_tanke').insert({
    dagsavslut_id: dagsavslutId,
    person_id: person.id,
    foretag_id: person.foretag_id,
    text: textTrimmad,
    uppgift_id_skapad: uppgiftIdSkapad,
  })

  if (error) return { error: error.message }
  revalidatePath('/')
  return { error: null }
}
