'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { currentForetagId } from '@/lib/foretag'

export async function skapaMallProjekt(namn: string) {
  const namnTrimmat = namn.trim()
  if (!namnTrimmat) return null

  const foretagId = await currentForetagId()
  if (!foretagId) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from('mall_projekt')
    .insert({ foretag_id: foretagId, namn: namnTrimmat })
    .select('id, namn')
    .single()

  revalidatePath('/systemadministration')
  return data
}

export async function uppdateraMallProjekt(id: string, namn: string) {
  const namnTrimmat = namn.trim()
  if (!namnTrimmat) return

  const supabase = await createClient()
  await supabase.from('mall_projekt').update({ namn: namnTrimmat }).eq('id', id)
  revalidatePath('/systemadministration')
}

export async function taBortMallProjekt(id: string) {
  const supabase = await createClient()
  await supabase.from('mall_projekt').delete().eq('id', id)
  revalidatePath('/systemadministration')
}

export async function hamtaMallUppgifter(mallProjektId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('mall_uppgift')
    .select(
      'id, titel, beskrivning, typ_id, kategori_id, prioritet, status, person_id, tidsatgang_timmar, dagar_efter_start, sortordning, ar_placeholder, anteckningsmall_id'
    )
    .eq('mall_projekt_id', mallProjektId)
    .order('sortordning')
  return data ?? []
}

export async function skapaMallUppgift(input: {
  mallProjektId: string
  titel: string
  beskrivning: string
  typId: string
  kategoriId: string
  prioritet: string
  status: string
  personId: string
  tidsatgangTimmar: number | null
  dagarEfterStart: number
  arPlaceholder: boolean
  anteckningsmallId: string | null
}) {
  const titelTrimmad = input.titel.trim()
  if (!titelTrimmad) return

  const foretagId = await currentForetagId()
  if (!foretagId) return

  const supabase = await createClient()
  const { data: sistaUppgift } = await supabase
    .from('mall_uppgift')
    .select('sortordning')
    .eq('mall_projekt_id', input.mallProjektId)
    .order('sortordning', { ascending: false })
    .limit(1)
    .maybeSingle()

  await supabase.from('mall_uppgift').insert({
    foretag_id: foretagId,
    mall_projekt_id: input.mallProjektId,
    titel: titelTrimmad,
    beskrivning: input.beskrivning || null,
    typ_id: input.typId || null,
    kategori_id: input.kategoriId || null,
    prioritet: input.prioritet,
    status: input.status,
    person_id: input.personId || null,
    tidsatgang_timmar: input.tidsatgangTimmar,
    dagar_efter_start: input.dagarEfterStart,
    ar_placeholder: input.arPlaceholder,
    anteckningsmall_id: input.anteckningsmallId,
    sortordning: (sistaUppgift?.sortordning ?? 0) + 1,
  })
  revalidatePath('/systemadministration')
}

export async function uppdateraMallUppgift(
  id: string,
  input: {
    titel: string
    beskrivning: string
    typId: string
    kategoriId: string
    prioritet: string
    status: string
    personId: string
    tidsatgangTimmar: number | null
    dagarEfterStart: number
    arPlaceholder: boolean
    anteckningsmallId: string | null
  }
) {
  const titelTrimmad = input.titel.trim()
  if (!titelTrimmad) return

  const supabase = await createClient()
  await supabase
    .from('mall_uppgift')
    .update({
      titel: titelTrimmad,
      beskrivning: input.beskrivning || null,
      typ_id: input.typId || null,
      kategori_id: input.kategoriId || null,
      prioritet: input.prioritet,
      status: input.status,
      person_id: input.personId || null,
      tidsatgang_timmar: input.tidsatgangTimmar,
      dagar_efter_start: input.dagarEfterStart,
      ar_placeholder: input.arPlaceholder,
      anteckningsmall_id: input.anteckningsmallId,
    })
    .eq('id', id)
  revalidatePath('/systemadministration')
}

export async function taBortMallUppgift(id: string) {
  const supabase = await createClient()
  await supabase.from('mall_uppgift').delete().eq('id', id)
  revalidatePath('/systemadministration')
}

// Sätter sortordning till indexet i den ordnade listan — anropas efter en
// drag-and-drop-omordning i mall-vy.tsx, som redan känner till hela den nya
// ordningen (till skillnad från ett enstaka upp/ner-steg).
export async function omordnaMallUppgifter(ordnadeIds: string[]) {
  const supabase = await createClient()
  await Promise.all(
    ordnadeIds.map((id, i) => supabase.from('mall_uppgift').update({ sortordning: i }).eq('id', id))
  )
  revalidatePath('/systemadministration')
}
