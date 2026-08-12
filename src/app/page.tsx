import { createClient } from '@/lib/supabase/server'
import { AppNav } from './nav'

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: person } = await supabase
    .from('person')
    .select('namn, roll')
    .eq('auth_user_id', user?.id ?? '')
    .single()

  return (
    <>
      <AppNav />
      <main className="flex flex-1 flex-col items-center justify-center gap-1 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">jobbet</h1>
        <p className="text-sm text-stone-500">
          Inloggad som {person?.namn ?? user?.email} · {person?.roll ?? 'okänd roll'}
        </p>
      </main>
    </>
  )
}
