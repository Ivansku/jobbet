'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { currentForetagId } from '@/lib/foretag'
import { enTillRelation } from '@/lib/postgrest'
import { PROJEKT_UPPGIFT_FALT } from './uppgift-falt'

function erVardag(date: Date): boolean {
  const veckodag = date.getUTCDay()
  return veckodag !== 0 && veckodag !== 6
}

// Ren datumaritmetik i UTC, för att räkna ut varje genererad uppgifts deadline
// utifrån projektets startdatum + mallens "dagar efter start". Helger finns
// inte i appen (visas ingenstans i kalender/kanban), så "dagar" räknas i
// vardagar — lördag/söndag hoppas över både under räkningen och som
// slutresultat, så en genererad deadline aldrig kan hamna på en helgdag.
function leggTillDagar(iso: string, dagar: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  let kvar = dagar
  while (kvar > 0) {
    date.setUTCDate(date.getUTCDate() + 1)
    if (erVardag(date)) kvar--
  }
  while (!erVardag(date)) {
    date.setUTCDate(date.getUTCDate() + 1)
  }
  const yy = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function epokForDatum(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / 1000
}

export async function skapaProjekt(input: {
  kundId: string
  namn: string
  status: string
  beskrivning: string
  startdatum: string
  mallProjektId: string
  farg: string | null
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
      mall_projekt_id: input.mallProjektId,
      farg: input.farg,
    })
    .select('id, namn')
    .single()

  if (!projekt) return null

  revalidatePath('/projekt')
  return projekt
}

// Instansierar mallens uppgiftsmallar som riktiga uppgifter kopplade till ett
// befintligt projekt. Separat, explicit åtgärd (egen knapp i UI) istället för
// en automatisk bieffekt av att skapa projektet eller ändra dess status —
// vissa projekt (t.ex. "planerade men ej fastställda") ska kunna existera med
// en mall kopplad utan att direkt få tiotals uppgifter med okända datum.
// Guardas mot att köras igen: instansierar bara om projektet saknar uppgifter.
export async function skapaUppgifterFranMall(projektId: string) {
  const supabase = await createClient()
  const { data: projekt } = await supabase
    .from('projekt')
    .select('foretag_id, kund_id, startdatum, mall_projekt_id')
    .eq('id', projektId)
    .single()

  if (!projekt || !projekt.mall_projekt_id) return null

  const { count } = await supabase
    .from('uppgift')
    .select('id', { count: 'exact', head: true })
    .eq('projekt_id', projektId)

  if (count && count > 0) return null

  // Första uppgiftens "dagar efter start" räknas från projektets
  // startdatum — varje efterföljande uppgifts "dagar efter föregående"
  // räknas kedjat från den uppgiften innan (inte alltid från startdatum),
  // så datumet ackumuleras genom hela listan i tur och ordning.
  const { data: mallUppgifter } = await supabase
    .from('mall_uppgift')
    .select(
      'id, titel, beskrivning, typ_id, kategori_id, prioritet, status, person_id, tidsatgang_timmar, dagar_efter_start, ar_placeholder, anteckningsmall_id, utan_anteckningsmall'
    )
    .eq('mall_projekt_id', projekt.mall_projekt_id)
    .order('sortordning')

  if (!mallUppgifter || mallUppgifter.length === 0) return null

  let foregaendeDatum = projekt.startdatum
  // sortordning sätts explicit istället för att förlita sig på kolumnens
  // clock_timestamp()-standardvärde — annars avgörs den inbördes ordningen
  // mellan flera mall-uppgifter som hamnar på samma dag av när varje rad
  // råkar bli infogad, inte av ordningen de har i mallen.
  const nyaUppgifter = mallUppgifter.map((m, index) => {
    const deadline = leggTillDagar(foregaendeDatum, m.dagar_efter_start)
    foregaendeDatum = deadline
    return {
      foretag_id: projekt.foretag_id,
      projekt_id: projektId,
      mall_uppgift_id: m.id,
      kund_id: projekt.kund_id,
      titel: m.titel,
      beskrivning: m.beskrivning,
      typ_id: m.typ_id,
      kategori_id: m.kategori_id,
      prioritet: m.prioritet,
      person_id: m.person_id,
      tidsatgang_timmar: m.tidsatgang_timmar,
      deadline,
      status: m.status,
      ar_placeholder: m.ar_placeholder,
      anteckningsmall_id: m.anteckningsmall_id,
      utan_anteckningsmall: m.utan_anteckningsmall,
      sortordning: epokForDatum(deadline) + index,
    }
  })
  await supabase.from('uppgift').insert(nyaUppgifter)

  revalidatePath('/projekt')
  revalidatePath('/uppgifter')
  return true
}

export async function uppdateraProjekt(
  id: string,
  input: {
    namn: string
    status: string
    beskrivning: string
    kundId: string
    startdatum: string
    farg: string | null
  }
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
      farg: input.farg,
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

// Uppdaterar bara den öppna projekt-modalens egen lista efter att en uppgift
// redigerats i uppgiftsformuläret — samma mönster som hamtaMallUppgifter i
// systemadministration/mall-actions.ts (lokal state, inte automatiskt synkad
// från nya server-props när modalen redan är öppen). Samma fältlista som
// page.tsx använder vid första sidladdningen, så formen på datan matchar.
// Projektanteckningar — separat modul från uppgift_anteckning (se
// projekt-anteckningar-sektion.tsx). Blocken kommer från projektets mall
// (mall_projekt.anteckningsmall_id), innehållet lagras per projekt så att
// alla uppgifter i projektet delar samma anteckningar. Initialt innehåll
// hämtas server-side av respektive sidas page.tsx, inte här — se
// nedan bara sparningen (autosave, ingen initial hämtning behövs client-side).
//
// Ingen revalidatePath här — autosparas medan användaren skriver, se
// sparaAnteckning i uppgifter/actions.ts för samma resonemang.
export async function sparaProjektAnteckning(projektId: string, blockId: string, innehall: string) {
  const foretagId = await currentForetagId()
  if (!foretagId) return

  const supabase = await createClient()
  await supabase.from('projekt_anteckning').upsert(
    {
      projekt_id: projektId,
      block_id: blockId,
      foretag_id: foretagId,
      innehall,
      uppdaterad_at: new Date().toISOString(),
    },
    { onConflict: 'projekt_id,block_id' }
  )
}

export async function hamtaProjektUppgifter(projektId: string) {
  const supabase = await createClient()
  // Samma sortering som page.tsx: deadline (utan datum sist), sortordning som
  // tiebreak inom samma datum — se kommentaren i projekt/page.tsx.
  const { data } = await supabase
    .from('uppgift')
    .select(PROJEKT_UPPGIFT_FALT)
    .eq('projekt_id', projektId)
    .order('deadline', { ascending: true, nullsFirst: false })
    .order('sortordning', { ascending: true })

  return (data ?? []).map((u) => ({
    ...u,
    ansvarigNamn: enTillRelation(u.person)?.namn ?? null,
  }))
}
