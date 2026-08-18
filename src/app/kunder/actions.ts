'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { enTillRelation } from '@/lib/postgrest'

export async function skapaKund(namn: string) {
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
    .insert({ foretag_id: person.foretag_id, namn: namnTrimmat })
    .select('id, namn')
    .single()

  revalidatePath('/kunder')
  revalidatePath('/uppgifter')
  return kund
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

// Hämtar mötesanteckningar för samtliga angivna kunder i en enda rundtripp —
// anropas server-side från sidan (page.tsx) tillsammans med kunder/kontaktpersoner
// så att kundkortet kan visa anteckningarna direkt utan en egen klientfördröjning
// när kortet öppnas.
export async function hamtaMotesanteckningarForKunder(kundIds: string[]) {
  if (kundIds.length === 0) return {}

  const supabase = await createClient()
  const { data } = await supabase
    .from('uppgift')
    .select(
      'id, kund_id, titel, deadline, typ:typ_id!inner(anteckningsmall_id), uppgift_anteckning!uppgift_anteckning_uppgift_id_fkey(innehall, block:block_id(namn, sortordning))'
    )
    .in('kund_id', kundIds)
    .not('typ.anteckningsmall_id', 'is', null)
    .order('deadline', { ascending: false })

  const perKund: Record<string, { id: string; titel: string; deadline: string | null; block: { namn: string; sortordning: number; innehall: string }[] }[]> = {}

  for (const u of data ?? []) {
    if (!u.kund_id) continue
    const mote = {
      id: u.id,
      titel: u.titel,
      deadline: u.deadline,
      block: (u.uppgift_anteckning ?? [])
        .filter((a) => a.innehall?.trim())
        .map((a) => {
          const block = enTillRelation(a.block)
          return {
            namn: block?.namn ?? '',
            sortordning: block?.sortordning ?? 0,
            innehall: a.innehall ?? '',
          }
        })
        .sort((a, b) => a.sortordning - b.sortordning),
    }
    ;(perKund[u.kund_id] ??= []).push(mote)
  }

  return perKund
}
