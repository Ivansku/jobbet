import { createClient } from '@/lib/supabase/server'
import { AppNav } from '../nav'
import { KundVy } from './kund-vy'
import { hamtaMotesanteckningarForKunder } from './actions'
import { hamtaManuellaAnteckningarForKunder } from './manuell-anteckning-actions'

export default async function KunderPage() {
  const supabase = await createClient()
  const [{ data: kunder }, { data: kontaktpersoner }] = await Promise.all([
    supabase.from('kund').select('id, namn').order('namn'),
    supabase
      .from('kontaktperson')
      .select('id, kund_id, fornamn, efternamn, epost, senast_kontaktad, uppgift_deltagare(uppgift(deadline, status))')
      .order('fornamn'),
  ])

  const kundIds = (kunder ?? []).map((k) => k.id)
  const [motesanteckningar, manuellaAnteckningar] = await Promise.all([
    hamtaMotesanteckningarForKunder(kundIds),
    hamtaManuellaAnteckningarForKunder(kundIds),
  ])

  return (
    <>
      <AppNav />
      <main className="mx-auto w-full max-w-2xl flex-1 p-6 md:p-8">
        <KundVy
          kunder={kunder ?? []}
          kontaktpersoner={kontaktpersoner ?? []}
          motesanteckningar={motesanteckningar}
          manuellaAnteckningar={manuellaAnteckningar}
        />
      </main>
    </>
  )
}
