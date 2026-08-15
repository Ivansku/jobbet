'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { currentForetagId } from '@/lib/foretag'

export async function skapaUppgiftstyp(
  namn: string,
  visarMotesanteckningar: boolean,
  skapaUppgifterVidKlar: boolean
) {
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
    visar_motesanteckningar: visarMotesanteckningar,
    skapa_uppgifter_vid_klar: skapaUppgifterVidKlar,
  })
  revalidatePath('/systemadministration')
}

export async function uppdateraUppgiftstyp(
  id: string,
  namn: string,
  visarMotesanteckningar: boolean,
  skapaUppgifterVidKlar: boolean
) {
  const namnTrimmat = namn.trim()
  if (!namnTrimmat) return

  const supabase = await createClient()
  await supabase
    .from('uppgiftstyp')
    .update({
      namn: namnTrimmat,
      visar_motesanteckningar: visarMotesanteckningar,
      skapa_uppgifter_vid_klar: skapaUppgifterVidKlar,
    })
    .eq('id', id)
  revalidatePath('/systemadministration')
}

export async function taBortUppgiftstyp(id: string) {
  const supabase = await createClient()
  await supabase.from('uppgiftstyp').delete().eq('id', id)
  revalidatePath('/systemadministration')
}

export async function skapaUppgiftsprojekt(namn: string) {
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

  await supabase.from('uppgiftsprojekt').insert({ foretag_id: person.foretag_id, namn: namnTrimmat })
  revalidatePath('/systemadministration')
}

export async function uppdateraUppgiftsprojekt(id: string, namn: string) {
  const namnTrimmat = namn.trim()
  if (!namnTrimmat) return

  const supabase = await createClient()
  await supabase.from('uppgiftsprojekt').update({ namn: namnTrimmat }).eq('id', id)
  revalidatePath('/systemadministration')
}

export async function taBortUppgiftsprojekt(id: string) {
  const supabase = await createClient()
  await supabase.from('uppgiftsprojekt').delete().eq('id', id)
  revalidatePath('/systemadministration')
}

type AnteckningsblockInput = {
  namn: string
  genererarUppgift: boolean
  uppgiftTitelMall: string
  uppgiftTypId: string
  deadlineDagarEfterMotet: number | null
  kundvisningStandard: boolean
}

function validateraAnteckningsblock(input: AnteckningsblockInput): string | null {
  if (!input.namn.trim()) return 'Namn krävs.'
  if (input.genererarUppgift && !input.uppgiftTitelMall.trim()) {
    return 'Titel på genererad uppgift krävs när blocket ska generera en uppgift.'
  }
  if (input.genererarUppgift && !input.uppgiftTypId) {
    return 'Uppgiftstyp krävs när blocket ska generera en uppgift.'
  }
  return null
}

export async function skapaAnteckningsblock(input: AnteckningsblockInput) {
  const fel = validateraAnteckningsblock(input)
  if (fel) return { error: fel }

  const foretagId = await currentForetagId()
  if (!foretagId) return { error: 'Kunde inte identifiera företag.' }

  const supabase = await createClient()
  const { data: sistaBlock } = await supabase
    .from('anteckningsblock')
    .select('sortordning')
    .eq('foretag_id', foretagId)
    .order('sortordning', { ascending: false })
    .limit(1)
    .maybeSingle()

  await supabase.from('anteckningsblock').insert({
    foretag_id: foretagId,
    namn: input.namn.trim(),
    genererar_uppgift: input.genererarUppgift,
    uppgift_titel_mall: input.uppgiftTitelMall.trim() || null,
    uppgift_typ_id: input.uppgiftTypId || null,
    deadline_dagar_efter_motet: input.deadlineDagarEfterMotet,
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
      genererar_uppgift: input.genererarUppgift,
      uppgift_titel_mall: input.uppgiftTitelMall.trim() || null,
      uppgift_typ_id: input.uppgiftTypId || null,
      deadline_dagar_efter_motet: input.deadlineDagarEfterMotet,
      kundvisning_standard: input.kundvisningStandard,
      uppdaterad_at: new Date().toISOString(),
    })
    .eq('id', id)
  revalidatePath('/systemadministration')
  return { error: null }
}

export async function uppdateraPerson(
  id: string,
  input: {
    namn: string
    roll: string
    epostOutlook: string
    arbetstimmarPerVecka: number
  }
) {
  const namnTrimmat = input.namn.trim()
  if (!namnTrimmat) return { error: 'Namn krävs.' }
  if (!Number.isFinite(input.arbetstimmarPerVecka) || input.arbetstimmarPerVecka < 0) {
    return { error: 'Arbetstimmar per vecka måste vara ett positivt tal.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('person')
    .update({
      namn: namnTrimmat,
      roll: input.roll,
      epost_outlook: input.epostOutlook.trim() || null,
      arbetstimmar_per_vecka: input.arbetstimmarPerVecka,
    })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/systemadministration')
  revalidatePath('/uppgifter')
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

export async function sattAnteckningsblockAktiv(id: string, aktiv: boolean) {
  const supabase = await createClient()
  await supabase.from('anteckningsblock').update({ aktiv }).eq('id', id)
  revalidatePath('/systemadministration')
}

export async function flyttaAnteckningsblock(id: string, riktning: 'upp' | 'ner') {
  const foretagId = await currentForetagId()
  if (!foretagId) return

  const supabase = await createClient()
  const { data: block } = await supabase
    .from('anteckningsblock')
    .select('sortordning')
    .eq('id', id)
    .single()
  if (!block) return

  const grannQuery = supabase
    .from('anteckningsblock')
    .select('id, sortordning')
    .eq('foretag_id', foretagId)

  const { data: granne } = await (riktning === 'upp'
    ? grannQuery.lt('sortordning', block.sortordning).order('sortordning', { ascending: false })
    : grannQuery.gt('sortordning', block.sortordning).order('sortordning', { ascending: true })
  )
    .limit(1)
    .maybeSingle()
  if (!granne) return

  await supabase.from('anteckningsblock').update({ sortordning: granne.sortordning }).eq('id', id)
  await supabase.from('anteckningsblock').update({ sortordning: block.sortordning }).eq('id', granne.id)
  revalidatePath('/systemadministration')
}
