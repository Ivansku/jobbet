'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { currentForetagId } from '@/lib/foretag'

export async function skapaAnteckningsmall(namn: string) {
  const namnTrimmat = namn.trim()
  if (!namnTrimmat) return null

  const foretagId = await currentForetagId()
  if (!foretagId) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from('anteckningsmall')
    .insert({ foretag_id: foretagId, namn: namnTrimmat })
    .select('id, namn')
    .single()

  revalidatePath('/systemadministration')
  return data
}

export async function uppdateraAnteckningsmall(id: string, namn: string) {
  const namnTrimmat = namn.trim()
  if (!namnTrimmat) return

  const supabase = await createClient()
  await supabase.from('anteckningsmall').update({ namn: namnTrimmat }).eq('id', id)
  revalidatePath('/systemadministration')
}

export async function taBortAnteckningsmall(id: string) {
  const supabase = await createClient()
  await supabase.from('anteckningsmall').delete().eq('id', id)
  revalidatePath('/systemadministration')
}

export async function hamtaAnteckningsblockForMall(anteckningsmallId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('anteckningsblock')
    .select('id, namn, beskrivning, sortordning, aktiv, kundvisning_standard')
    .eq('anteckningsmall_id', anteckningsmallId)
    .order('sortordning')
  return data ?? []
}

type AnteckningsblockInput = {
  namn: string
  beskrivning: string
  kundvisningStandard: boolean
}

function validateraAnteckningsblock(input: AnteckningsblockInput): string | null {
  if (!input.namn.trim()) return 'Namn krävs.'
  return null
}

export async function skapaAnteckningsblock(input: AnteckningsblockInput & { anteckningsmallId: string }) {
  const fel = validateraAnteckningsblock(input)
  if (fel) return { error: fel }

  const foretagId = await currentForetagId()
  if (!foretagId) return { error: 'Kunde inte identifiera företag.' }

  const supabase = await createClient()
  const { data: sistaBlock } = await supabase
    .from('anteckningsblock')
    .select('sortordning')
    .eq('anteckningsmall_id', input.anteckningsmallId)
    .order('sortordning', { ascending: false })
    .limit(1)
    .maybeSingle()

  await supabase.from('anteckningsblock').insert({
    foretag_id: foretagId,
    anteckningsmall_id: input.anteckningsmallId,
    namn: input.namn.trim(),
    beskrivning: input.beskrivning.trim() || null,
    kundvisning_standard: input.kundvisningStandard,
    sortordning: (sistaBlock?.sortordning ?? 0) + 1,
  })
  revalidatePath('/systemadministration')
  return { error: null }
}

export async function uppdateraAnteckningsblock(id: string, input: AnteckningsblockInput) {
  const fel = validateraAnteckningsblock(input)
  if (fel) return { error: fel }

  const supabase = await createClient()
  await supabase
    .from('anteckningsblock')
    .update({
      namn: input.namn.trim(),
      beskrivning: input.beskrivning.trim() || null,
      kundvisning_standard: input.kundvisningStandard,
      uppdaterad_at: new Date().toISOString(),
    })
    .eq('id', id)
  revalidatePath('/systemadministration')
  return { error: null }
}

export async function sattAnteckningsblockAktiv(id: string, aktiv: boolean) {
  const supabase = await createClient()
  await supabase.from('anteckningsblock').update({ aktiv }).eq('id', id)
  revalidatePath('/systemadministration')
}

// Sätter sortordning till indexet i den ordnade listan — anropas efter en
// drag-and-drop-omordning i anteckningsmall-vy.tsx, som redan känner till hela
// den nya ordningen. Samma mönster som omordnaMallUppgifter i mall-actions.ts.
export async function omordnaAnteckningsblock(ordnadeIds: string[]) {
  const supabase = await createClient()
  await Promise.all(
    ordnadeIds.map((id, i) => supabase.from('anteckningsblock').update({ sortordning: i }).eq('id', id))
  )
  revalidatePath('/systemadministration')
}
