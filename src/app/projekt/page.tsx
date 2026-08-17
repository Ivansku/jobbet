import { createClient } from '@/lib/supabase/server'
import { AppNav } from '../nav'
import { enTillRelation } from '@/lib/postgrest'
import { ProjektVy } from './projekt-vy'

export default async function ProjektPage() {
  const supabase = await createClient()
  const [{ data: projekt }, { data: kunder }, { data: mallar }] = await Promise.all([
    supabase
      .from('projekt')
      .select(
        'id, namn, status, beskrivning, startdatum, kund_id, kund:kund_id(namn), uppgift(id, titel, status, deadline, person:person_id(namn))'
      )
      .order('namn'),
    supabase.from('kund').select('id, namn').order('namn'),
    supabase.from('mall_projekt').select('id, namn').order('namn'),
  ])

  // Uppgifterna hämtas färdigt här (server-side) istället för att ProjektVy
  // ska hämta dem själv vid öppning — annars syns en fördröjning varje gång
  // ett projekt öppnas.
  const projektRader = (projekt ?? []).map((p) => {
    const uppgifter = [...p.uppgift]
      .sort((a, b) => {
        if (!a.deadline && !b.deadline) return 0
        if (!a.deadline) return 1
        if (!b.deadline) return -1
        return a.deadline.localeCompare(b.deadline)
      })
      .map((u) => ({
        id: u.id,
        titel: u.titel,
        status: u.status,
        deadline: u.deadline,
        ansvarigNamn: enTillRelation(u.person)?.namn ?? null,
      }))

    return {
      id: p.id,
      namn: p.namn,
      status: p.status,
      beskrivning: p.beskrivning,
      startdatum: p.startdatum,
      kundId: p.kund_id,
      kundNamn: enTillRelation(p.kund)?.namn ?? null,
      antalUppgifter: uppgifter.length,
      antalKlara: uppgifter.filter((u) => u.status === 'klar').length,
      uppgifter,
    }
  })

  return (
    <>
      <AppNav />
      <main className="mx-auto w-full max-w-2xl flex-1 p-6 md:p-8">
        <ProjektVy projekt={projektRader} kunder={kunder ?? []} mallar={mallar ?? []} />
      </main>
    </>
  )
}
