'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { currentForetagId } from '@/lib/foretag'
import { enTillRelation } from '@/lib/postgrest'

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

// Ren datumaritmetik i UTC — samma mönster som motsvarande hjälpfunktion i
// uppgifter/actions.ts, för att räkna ut varje genererad uppgifts deadline
// utifrån projektets startdatum + mallens "dagar efter start".
function leggTillDagar(iso: string, dagar: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() + dagar)
  const yy = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

export async function skapaProjekt(input: {
  kundId: string
  namn: string
  status: string
  beskrivning: string
  startdatum: string
  mallProjektId: string
}) {
  const namnTrimmat = input.namn.trim()
  if (!namnTrimmat || !input.mallProjektId || !input.startdatum) return null

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
      startdatum: input.startdatum,
    })
    .select('id, namn')
    .single()

  if (!projekt) return null

  // Instansierar mallens uppgiftsmallar som riktiga uppgifter kopplade till
  // det nya projektet — deadline räknas ut från projektets startdatum.
  const { data: mallUppgifter } = await supabase
    .from('mall_uppgift')
    .select('titel, beskrivning, typ_id, kategori_id, prioritet, person_id, tidsatgang_timmar, dagar_efter_start')
    .eq('mall_projekt_id', input.mallProjektId)
    .order('sortordning')

  if (mallUppgifter && mallUppgifter.length > 0) {
    await supabase.from('uppgift').insert(
      mallUppgifter.map((m) => ({
        foretag_id: foretagId,
        projekt_id: projekt.id,
        kund_id: input.kundId || null,
        titel: m.titel,
        beskrivning: m.beskrivning,
        typ_id: m.typ_id,
        kategori_id: m.kategori_id,
        prioritet: m.prioritet,
        person_id: m.person_id,
        tidsatgang_timmar: m.tidsatgang_timmar,
        deadline: leggTillDagar(input.startdatum, m.dagar_efter_start),
        status: 'oppen',
      }))
    )
  }

  revalidatePath('/projekt')
  revalidatePath('/uppgifter')
  return projekt
}

export async function uppdateraProjekt(
  id: string,
  input: { namn: string; status: string; beskrivning: string; kundId: string; startdatum: string }
) {
  const namnTrimmat = input.namn.trim()
  if (!namnTrimmat) return

  const supabase = await createClient()
  await supabase
    .from('projekt')
    .update({
      namn: namnTrimmat,
      status: input.status,
      beskrivning: input.beskrivning || null,
      kund_id: input.kundId || null,
      startdatum: input.startdatum,
    })
    .eq('id', id)

  revalidatePath('/projekt')
  revalidatePath('/uppgifter')
}

// Kopplar bara loss projektets uppgifter (projekt_id sätts till null via FK:ns
// ON DELETE SET NULL) — uppgifterna med sin egen data finns kvar.
export async function taBortProjekt(id: string) {
  const supabase = await createClient()
  await supabase.from('projekt').delete().eq('id', id)
  revalidatePath('/projekt')
  revalidatePath('/uppgifter')
}

// Explicit, separat åtgärd: raderar även alla uppgifter som hör till projektet.
export async function taBortProjektMedUppgifter(id: string) {
  const supabase = await createClient()
  await supabase.from('uppgift').delete().eq('projekt_id', id)
  await supabase.from('projekt').delete().eq('id', id)
  revalidatePath('/projekt')
  revalidatePath('/uppgifter')
}
