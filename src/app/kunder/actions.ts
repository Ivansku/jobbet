'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

function stadaDomaner(domains: string[]): string[] {
  return [...new Set(domains.map((d) => d.trim().toLowerCase()).filter(Boolean))]
}

export async function skapaKund(namn: string, domains: string[] = []) {
  const namnTrimmat = namn.trim()
  if (!namnTrimmat) return null

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

  if (!person?.foretag_id) return null

  const { data: kund } = await supabase
    .from('kund')
    .insert({ foretag_id: person.foretag_id, namn: namnTrimmat, domains: stadaDomaner(domains) })
    .select('id, namn')
    .single()

  revalidatePath('/kunder')
  revalidatePath('/uppgifter')
  return kund
}

export async function uppdateraKund(id: string, namn: string, domains: string[]) {
  const namnTrimmat = namn.trim()
  if (!namnTrimmat) return

  const supabase = await createClient()
  await supabase.from('kund').update({ namn: namnTrimmat, domains: stadaDomaner(domains) }).eq('id', id)
  revalidatePath('/kunder')
}

export async function taBortKund(id: string) {
  const supabase = await createClient()
  await supabase.from('kund').delete().eq('id', id)
  revalidatePath('/kunder')
}
