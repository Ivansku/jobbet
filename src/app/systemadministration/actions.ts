'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function skapaUppgiftstyp(namn: string) {
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

  await supabase.from('uppgiftstyp').insert({ foretag_id: person.foretag_id, namn: namnTrimmat })
  revalidatePath('/systemadministration')
}

export async function uppdateraUppgiftstyp(id: string, namn: string) {
  const namnTrimmat = namn.trim()
  if (!namnTrimmat) return

  const supabase = await createClient()
  await supabase.from('uppgiftstyp').update({ namn: namnTrimmat }).eq('id', id)
  revalidatePath('/systemadministration')
}

export async function taBortUppgiftstyp(id: string) {
  const supabase = await createClient()
  await supabase.from('uppgiftstyp').delete().eq('id', id)
  revalidatePath('/systemadministration')
}
