'use server'

import { createClient } from '@/lib/supabase/server'

export type MailMote = {
  id: string
  titel: string
  deadline: string | null
  mailinnehall: string
}

// Hämtar mailanteckningar för samtliga angivna kunder i en enda rundtripp,
// samma mönster som hamtaMotesanteckningarForKunder — anropas server-side från
// sidan så att kundkortet slipper en egen klientfördröjning när det öppnas.
export async function hamtaMailanteckningarForKunder(kundIds: string[]) {
  if (kundIds.length === 0) return {}

  const supabase = await createClient()
  const { data } = await supabase
    .from('uppgift')
    .select('id, kund_id, titel, deadline, mailinnehall, typ:typ_id!inner(visar_mailinnehall)')
    .in('kund_id', kundIds)
    .eq('typ.visar_mailinnehall', true)
    .order('deadline', { ascending: false })

  const perKund: Record<string, MailMote[]> = {}
  for (const u of data ?? []) {
    if (!u.kund_id) continue
    if (!u.mailinnehall?.trim()) continue
    const mote: MailMote = {
      id: u.id,
      titel: u.titel,
      deadline: u.deadline,
      mailinnehall: u.mailinnehall,
    }
    ;(perKund[u.kund_id] ??= []).push(mote)
  }
  return perKund
}
