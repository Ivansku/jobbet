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

export async function skapaKontaktperson(input: {
  kundId: string
  fornamn: string
  efternamn: string
  epost: string
}) {
  const foretagId = await currentForetagId()
  if (!foretagId) return null

  const supabase = await createClient()
  const { data: kontaktperson } = await supabase
    .from('kontaktperson')
    .insert({
      foretag_id: foretagId,
      kund_id: input.kundId,
      fornamn: input.fornamn.trim() || null,
      efternamn: input.efternamn.trim() || null,
      epost: input.epost.trim() || null,
    })
    .select('id, kund_id, fornamn, efternamn, epost, senast_kontaktad')
    .single()

  revalidatePath('/kunder')
  revalidatePath('/uppgifter')
  revalidatePath('/personer')
  return kontaktperson
}

export async function uppdateraKontaktperson(
  id: string,
  input: { fornamn: string; efternamn: string; epost: string; senastKontaktad: string | null }
) {
  const supabase = await createClient()
  await supabase
    .from('kontaktperson')
    .update({
      fornamn: input.fornamn.trim() || null,
      efternamn: input.efternamn.trim() || null,
      epost: input.epost.trim() || null,
      senast_kontaktad: input.senastKontaktad || null,
    })
    .eq('id', id)

  revalidatePath('/kunder')
  revalidatePath('/uppgifter')
  revalidatePath('/personer')
}

export async function taBortKontaktperson(id: string) {
  const supabase = await createClient()
  await supabase.from('kontaktperson').delete().eq('id', id)

  revalidatePath('/kunder')
  revalidatePath('/uppgifter')
  revalidatePath('/personer')
}
