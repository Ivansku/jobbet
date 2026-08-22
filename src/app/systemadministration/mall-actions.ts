'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { currentForetagId } from '@/lib/foretag'

export async function skapaMallProjekt(namn: string, kategoriId: string | null, anteckningsmallId: string | null) {
  const namnTrimmat = namn.trim()
  if (!namnTrimmat) return null

  const foretagId = await currentForetagId()
  if (!foretagId) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from('mall_projekt')
    .insert({ foretag_id: foretagId, namn: namnTrimmat, kategori_id: kategoriId, anteckningsmall_id: anteckningsmallId })
    .select('id, namn, kategori_id, anteckningsmall_id')
    .single()

  revalidatePath('/systemadministration')
  return data
}

export async function uppdateraMallProjekt(
  id: string,
  namn: string,
  kategoriId: string | null,
  anteckningsmallId: string | null
) {
  const namnTrimmat = namn.trim()
  if (!namnTrimmat) return

  const supabase = await createClient()
  await supabase
    .from('mall_projekt')
    .update({ namn: namnTrimmat, kategori_id: kategoriId, anteckningsmall_id: anteckningsmallId })
    .eq('id', id)
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
      'id, titel, beskrivning, typ_id, kategori_id, prioritet, status, person_id, tidsatgang_timmar, dagar_efter_start, sortordning, ar_placeholder, anteckningsmall_id, utan_anteckningsmall, mall_uppgift_anteckningskalla(block_id, sortordning)'
    )
    .eq('mall_projekt_id', mallProjektId)
    .order('sortordning')

  return (data ?? []).map(({ mall_uppgift_anteckningskalla, ...u }) => ({
    ...u,
    anteckningskallor: [...mall_uppgift_anteckningskalla]
      .sort((a, b) => a.sortordning - b.sortordning)
      .map((k) => k.block_id),
  }))
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
  utanAnteckningsmall: boolean
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

  const { data: nyUppgift } = await supabase
    .from('mall_uppgift')
    .insert({
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
      utan_anteckningsmall: input.utanAnteckningsmall,
      sortordning: (sistaUppgift?.sortordning ?? 0) + 1,
    })
    .select('id')
    .single()

  revalidatePath('/systemadministration')
  return nyUppgift ?? null
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
    utanAnteckningsmall: boolean
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
      utan_anteckningsmall: input.utanAnteckningsmall,
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

// Skriver alltid över hela listan (radera + återskapa) istället för att diffa
// — samma mönster som synkaDeltagare i uppgifter/actions.ts. sortordning sätts
// till vald ordning i UI:t, den ordningen blockens innehåll konkateneras i när
// beskrivningen fylls i.
export async function sparaAnteckningskallor(mallUppgiftId: string, blockIds: string[]) {
  const foretagId = await currentForetagId()
  if (!foretagId) return

  const supabase = await createClient()
  await supabase.from('mall_uppgift_anteckningskalla').delete().eq('mall_uppgift_id', mallUppgiftId)
  if (blockIds.length === 0) return
  await supabase.from('mall_uppgift_anteckningskalla').insert(
    blockIds.map((blockId, i) => ({
      mall_uppgift_id: mallUppgiftId,
      block_id: blockId,
      foretag_id: foretagId,
      sortordning: i,
    }))
  )
}
