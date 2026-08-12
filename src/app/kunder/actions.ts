'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function skapaKund(namn: string) {
  const namnTrimmat = namn.trim()
  if (!namnTrimmat) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const { data: person } = await supabase
    .from('person')
    .select('foretag_id')
    .eq('auth_user_id', user.id)
    .single()

  if (!person?.foretag_id) return

  await supabase.from('kund').insert({ foretag_id: person.foretag_id, namn: namnTrimmat })
  revalidatePath('/kunder')
}

export async function uppdateraKund(id: string, namn: string) {
  const namnTrimmat = namn.trim()
  if (!namnTrimmat) return

  const supabase = await createClient()
  await supabase.from('kund').update({ namn: namnTrimmat }).eq('id', id)
  revalidatePath('/kunder')
}

export async function taBortKund(id: string) {
  const supabase = await createClient()
  await supabase.from('kund').delete().eq('id', id)
  revalidatePath('/kunder')
}
