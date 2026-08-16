'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const MODULER = ['flex', 'overtid', 'foraldraledig', 'ledighet']

type FlexelPostInput = {
  datum: string
  timmar: number
  motivering: string
  modul: string
}

function validateraFlexelPost(input: FlexelPostInput): string | null {
  if (!input.datum) return 'Datum krävs.'
  if (!Number.isFinite(input.timmar)) return 'Timmar måste vara ett tal.'
  if (!input.motivering.trim()) return 'Motivering krävs.'
  if (!MODULER.includes(input.modul)) return 'Ogiltig modul.'
  return null
}

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

export async function skapaFlexelPost(input: FlexelPostInput) {
  const fel = validateraFlexelPost(input)
  if (fel) return { error: fel }

  const person = await hamtaPerson()
  if (!person) return { error: 'Kunde inte identifiera person.' }

  const supabase = await createClient()
  const { error } = await supabase.from('flexel_post').insert({
    foretag_id: person.foretag_id,
    person_id: person.id,
    datum: input.datum,
    timmar: input.timmar,
    motivering: input.motivering.trim(),
    modul: input.modul,
  })

  if (error) return { error: error.message }
  revalidatePath('/rapporter/flexel')
  return { error: null }
}

export async function uppdateraFlexelPost(id: string, input: FlexelPostInput) {
  const fel = validateraFlexelPost(input)
  if (fel) return { error: fel }

  const supabase = await createClient()
  const { error } = await supabase
    .from('flexel_post')
    .update({
      datum: input.datum,
      timmar: input.timmar,
      motivering: input.motivering.trim(),
      modul: input.modul,
    })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/rapporter/flexel')
  return { error: null }
}

export async function taBortFlexelPost(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('flexel_post').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/rapporter/flexel')
  return { error: null }
}

type KvotjusteringInput = {
  manad: string
  justeringTimmar: number
  kommentar: string
}

export async function skapaKvotjustering(input: KvotjusteringInput) {
  if (!input.manad) return { error: 'Månad krävs.' }
  if (!Number.isFinite(input.justeringTimmar) || input.justeringTimmar === 0) {
    return { error: 'Justering måste vara ett tal skilt från noll.' }
  }

  const person = await hamtaPerson()
  if (!person) return { error: 'Kunde inte identifiera person.' }

  const supabase = await createClient()
  const { error } = await supabase.from('flexel_kvotjustering').insert({
    foretag_id: person.foretag_id,
    person_id: person.id,
    manad: input.manad,
    justering_timmar: input.justeringTimmar,
    kommentar: input.kommentar.trim() || null,
  })

  if (error) return { error: error.message }
  revalidatePath('/rapporter/flexel')
  return { error: null }
}

export async function uppdateraKvotjustering(id: string, input: KvotjusteringInput) {
  if (!input.manad) return { error: 'Månad krävs.' }
  if (!Number.isFinite(input.justeringTimmar) || input.justeringTimmar === 0) {
    return { error: 'Justering måste vara ett tal skilt från noll.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('flexel_kvotjustering')
    .update({
      manad: input.manad,
      justering_timmar: input.justeringTimmar,
      kommentar: input.kommentar.trim() || null,
    })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/rapporter/flexel')
  return { error: null }
}

export async function taBortKvotjustering(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('flexel_kvotjustering').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/rapporter/flexel')
  return { error: null }
}
