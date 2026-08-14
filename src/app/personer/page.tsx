import { createClient } from '@/lib/supabase/server'
import { AppNav } from '../nav'
import { PersonerVy } from './personer-vy'

export default async function PersonerPage() {
  const supabase = await createClient()
  const { data: kontaktpersoner } = await supabase
    .from('kontaktperson')
    .select(
      'id, fornamn, efternamn, epost, senast_kontaktad, kund_id, kund(namn), uppgift_deltagare(uppgift(deadline, status))'
    )
    .order('senast_kontaktad', { ascending: true, nullsFirst: true })

  return (
    <>
      <AppNav />
      <main className="mx-auto w-full max-w-3xl flex-1 p-6 md:p-8">
        <PersonerVy kontaktpersoner={kontaktpersoner ?? []} />
      </main>
    </>
  )
}
