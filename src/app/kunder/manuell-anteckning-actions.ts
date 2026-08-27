'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { currentForetagId } from '@/lib/foretag'

export type ManuellAnteckning = {
  id: string
  kund_id: string
  titel: string
  datum: string
  innehall: string
  kontaktperson_ids: string[]
}

const KOLUMNER = 'id, kund_id, titel, datum, innehall'
const KOLUMNER_MED_DELTAGARE = `${KOLUMNER}, kund_anteckning_deltagare(kontaktperson_id)`

// Skriver alltid över hela deltagarlistan för anteckningen (radera + återskapa) —
// samma mönster som synkaDeltagare för uppgift_deltagare i uppgifter/actions.ts.
async function synkaAnteckningDeltagare(
  supabase: Awaited<ReturnType<typeof createClient>>,
  anteckningId: string,
  foretagId: string,
  kontaktpersonIds: string[]
) {
  await supabase.from('kund_anteckning_deltagare').delete().eq('kund_anteckning_id', anteckningId)
  if (kontaktpersonIds.length === 0) return
  await supabase.from('kund_anteckning_deltagare').insert(
    kontaktpersonIds.map((kontaktpersonId) => ({
      kund_anteckning_id: anteckningId,
      kontaktperson_id: kontaktpersonId,
      foretag_id: foretagId,
    }))
  )
}

// Hämtar manuella anteckningar för samtliga angivna kunder i en enda rundtripp —
// anropas server-side från sidan så att kundkortet slipper en egen klientfördröjning
// när det öppnas.
export async function hamtaManuellaAnteckningarForKunder(kundIds: string[]) {
  if (kundIds.length === 0) return {}

  const supabase = await createClient()
  const { data } = await supabase
    .from('kund_anteckning')
    .select(KOLUMNER_MED_DELTAGARE)
    .in('kund_id', kundIds)
    .order('datum', { ascending: false })

  const perKund: Record<string, ManuellAnteckning[]> = {}
  for (const a of data ?? []) {
    const anteckning: ManuellAnteckning = {
      id: a.id,
      kund_id: a.kund_id,
      titel: a.titel,
      datum: a.datum,
      innehall: a.innehall,
      kontaktperson_ids: (a.kund_anteckning_deltagare ?? []).map((d) => d.kontaktperson_id),
    }
    ;(perKund[a.kund_id] ??= []).push(anteckning)
  }
  return perKund
}

export async function skapaManuellAnteckning(input: {
  kundId: string
  titel: string
  datum: string
  innehall: string
  kontaktpersonIds: string[]
}) {
  const titelTrimmad = input.titel.trim()
  if (!titelTrimmad || !input.datum) return null

  const foretagId = await currentForetagId()
  if (!foretagId) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from('kund_anteckning')
    .insert({
      foretag_id: foretagId,
      kund_id: input.kundId,
      titel: titelTrimmad,
      datum: input.datum,
      innehall: input.innehall,
    })
    .select(KOLUMNER)
    .single()

  if (data) {
    await synkaAnteckningDeltagare(supabase, data.id, foretagId, input.kontaktpersonIds)
  }

  revalidatePath('/kunder')
  return data
}

export async function uppdateraManuellAnteckning(
  id: string,
  input: { titel: string; datum: string; innehall: string; kontaktpersonIds: string[] }
) {
  const titelTrimmad = input.titel.trim()
  if (!titelTrimmad || !input.datum) return null

  const foretagId = await currentForetagId()
  if (!foretagId) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from('kund_anteckning')
    .update({ titel: titelTrimmad, datum: input.datum, innehall: input.innehall })
    .eq('id', id)
    .select(KOLUMNER)
    .single()

  if (data) {
    await synkaAnteckningDeltagare(supabase, id, foretagId, input.kontaktpersonIds)
  }

  revalidatePath('/kunder')
  return data
}

export async function taBortManuellAnteckning(id: string) {
  const supabase = await createClient()
  await supabase.from('kund_anteckning').delete().eq('id', id)
  revalidatePath('/kunder')
}
