import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppNav } from '../nav'
import { UppgiftstypVy } from './uppgiftstyp-vy'

export default async function SystemadministrationPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: person } = await supabase
    .from('person')
    .select('roll')
    .eq('auth_user_id', user?.id ?? '')
    .single()

  if (person?.roll !== 'admin') {
    redirect('/')
  }

  const { data: typer } = await supabase.from('uppgiftstyp').select('id, namn').order('namn')

  return (
    <>
      <AppNav />
      <main className="mx-auto w-full max-w-xl flex-1 p-6 md:p-8">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Systemadministration</h1>
        <UppgiftstypVy typer={typer ?? []} />
      </main>
    </>
  )
}
