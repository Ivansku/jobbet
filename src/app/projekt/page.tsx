import { createClient } from '@/lib/supabase/server'
import { AppNav } from '../nav'
import { enTillRelation } from '@/lib/postgrest'
import { ProjektVy } from './projekt-vy'

export default async function ProjektPage() {
  const supabase = await createClient()
  const [{ data: projekt }, { data: kunder }] = await Promise.all([
    supabase
      .from('projekt')
      .select('id, namn, status, beskrivning, kund_id, kund:kund_id(namn), uppgift(id, status)')
      .order('namn'),
    supabase.from('kund').select('id, namn').order('namn'),
  ])

  const projektRader = (projekt ?? []).map((p) => ({
    id: p.id,
    namn: p.namn,
    status: p.status,
    beskrivning: p.beskrivning,
    kundId: p.kund_id,
    kundNamn: enTillRelation(p.kund)?.namn ?? null,
    antalUppgifter: p.uppgift.length,
    antalKlara: p.uppgift.filter((u) => u.status === 'klar').length,
  }))

  return (
    <>
      <AppNav />
      <main className="mx-auto w-full max-w-2xl flex-1 p-6 md:p-8">
        <ProjektVy projekt={projektRader} kunder={kunder ?? []} />
      </main>
    </>
  )
}
