'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { currentForetagId } from '@/lib/foretag'

export async function skapaUppgiftstyp(namn: string, anteckningsmallId: string | null) {
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

  await supabase.from('uppgiftstyp').insert({
    foretag_id: person.foretag_id,
    namn: namnTrimmat,
    anteckningsmall_id: anteckningsmallId,
  })
  revalidatePath('/systemadministration')
}

export async function uppdateraUppgiftstyp(id: string, namn: string, anteckningsmallId: string | null) {
  const namnTrimmat = namn.trim()
  if (!namnTrimmat) return

  const supabase = await createClient()
  await supabase
    .from('uppgiftstyp')
    .update({
      namn: namnTrimmat,
      anteckningsmall_id: anteckningsmallId,
    })
    .eq('id', id)
  revalidatePath('/systemadministration')
}

export async function taBortUppgiftstyp(id: string) {
  const supabase = await createClient()
  await supabase.from('uppgiftstyp').delete().eq('id', id)
  revalidatePath('/systemadministration')
}

export async function skapaKategori(namn: string) {
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

  await supabase.from('kategori').insert({ foretag_id: person.foretag_id, namn: namnTrimmat })
  revalidatePath('/systemadministration')
}

export async function uppdateraKategori(id: string, namn: string) {
  const namnTrimmat = namn.trim()
  if (!namnTrimmat) return

  const supabase = await createClient()
  await supabase.from('kategori').update({ namn: namnTrimmat }).eq('id', id)
  revalidatePath('/systemadministration')
}

export async function taBortKategori(id: string) {
  const supabase = await createClient()
  await supabase.from('kategori').delete().eq('id', id)
  revalidatePath('/systemadministration')
}

export async function uppdateraPerson(
  id: string,
  input: {
    namn: string
    roll: string
    epostOutlook: string
    arbetstimmarPerVecka: number
    dagsflodeMorgonSlut: string
    dagsflodeMittSlut: string
  }
) {
  const namnTrimmat = input.namn.trim()
  if (!namnTrimmat) return { error: 'Namn krävs.' }
  if (!Number.isFinite(input.arbetstimmarPerVecka) || input.arbetstimmarPerVecka < 0) {
    return { error: 'Arbetstimmar per vecka måste vara ett positivt tal.' }
  }
  if (input.dagsflodeMorgonSlut >= input.dagsflodeMittSlut) {
    return { error: '"Börja dagen" måste sluta före "Mitt på dagen".' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('person')
    .update({
      namn: namnTrimmat,
      roll: input.roll,
      epost_outlook: input.epostOutlook.trim() || null,
      arbetstimmar_per_vecka: input.arbetstimmarPerVecka,
      dagsflode_morgon_slut: input.dagsflodeMorgonSlut,
      dagsflode_mitt_slut: input.dagsflodeMittSlut,
    })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/systemadministration')
  revalidatePath('/uppgifter')
  revalidatePath('/')
  return { error: null }
}

type FlexelModulInput = { modul: string; aktiv: boolean; veckokvotTimmar: number | null }

export async function uppdateraFlexelModuler(personId: string, moduler: FlexelModulInput[]) {
  const foretagId = await currentForetagId()
  if (!foretagId) return { error: 'Kunde inte identifiera företag.' }

  const supabase = await createClient()
  const { error } = await supabase.from('flexel_installning').upsert(
    moduler.map((m) => ({
      foretag_id: foretagId,
      person_id: personId,
      modul: m.modul,
      aktiv: m.aktiv,
      veckokvot_timmar: m.veckokvotTimmar,
    })),
    { onConflict: 'person_id,modul' }
  )

  if (error) return { error: error.message }
  revalidatePath('/systemadministration')
  revalidatePath('/rapporter/flexel')
  return { error: null }
}

