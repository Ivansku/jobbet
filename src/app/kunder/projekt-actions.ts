'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { currentForetagId } from '@/lib/foretag'
import { enTillRelation } from '@/lib/postgrest'

export async function hamtaProjektForKund(kundId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('projekt')
    .select('id, namn, status, beskrivning, uppgift(id, status)')
    .eq('kund_id', kundId)
    .order('namn')

  return (data ?? []).map((p) => ({
    id: p.id,
    namn: p.namn,
    status: p.status,
    beskrivning: p.beskrivning,
    antalUppgifter: p.uppgift.length,
    antalKlara: p.uppgift.filter((u) => u.status === 'klar').length,
  }))
}

export async function hamtaUppgifterForProjekt(projektId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('uppgift')
    .select('id, titel, status, deadline, person:person_id(namn)')
    .eq('projekt_id', projektId)
    .order('deadline', { ascending: true, nullsFirst: false })

  return (data ?? []).map((u) => ({
    id: u.id,
    titel: u.titel,
    status: u.status,
    deadline: u.deadline,
    ansvarigNamn: enTillRelation(u.person)?.namn ?? null,
  }))
}

export async function skapaProjekt(input: {
  kundId: string
  namn: string
  status: string
  beskrivning: string
}) {
  const namnTrimmat = input.namn.trim()
  if (!namnTrimmat) return null

  const foretagId = await currentForetagId()
  if (!foretagId) return null

  const supabase = await createClient()
  const { data: projekt } = await supabase
    .from('projekt')
    .insert({
      foretag_id: foretagId,
      kund_id: input.kundId || null,
      namn: namnTrimmat,
      status: input.status,
      beskrivning: input.beskrivning || null,
    })
    .select('id, namn')
    .single()

  revalidatePath('/kunder')
  revalidatePath('/uppgifter')
  return projekt
}

export async function uppdateraProjekt(
  id: string,
  input: { namn: string; status: string; beskrivning: string }
) {
  const namnTrimmat = input.namn.trim()
  if (!namnTrimmat) return

  const supabase = await createClient()
  await supabase
    .from('projekt')
    .update({ namn: namnTrimmat, status: input.status, beskrivning: input.beskrivning || null })
    .eq('id', id)

  revalidatePath('/kunder')
  revalidatePath('/uppgifter')
}

// Kopplar bara loss projektets uppgifter (projekt_id sätts till null via FK:ns
// ON DELETE SET NULL) — uppgifterna med sin egen data finns kvar.
export async function taBortProjekt(id: string) {
  const supabase = await createClient()
  await supabase.from('projekt').delete().eq('id', id)
  revalidatePath('/kunder')
  revalidatePath('/uppgifter')
}

// Explicit, separat åtgärd: raderar även alla uppgifter som hör till projektet.
export async function taBortProjektMedUppgifter(id: string) {
  const supabase = await createClient()
  await supabase.from('uppgift').delete().eq('projekt_id', id)
  await supabase.from('projekt').delete().eq('id', id)
  revalidatePath('/kunder')
  revalidatePath('/uppgifter')
}
