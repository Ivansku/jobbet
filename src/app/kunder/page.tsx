import { createClient } from '@/lib/supabase/server'
import { AppNav } from '../nav'
import { KundVy } from './kund-vy'

export default async function KunderPage() {
  const supabase = await createClient()
  const { data: kunder } = await supabase.from('kund').select('id, namn').order('namn')

  return (
    <>
      <AppNav />
      <main className="mx-auto w-full max-w-xl flex-1 p-6 md:p-8">
        <KundVy kunder={kunder ?? []} />
      </main>
    </>
  )
}
