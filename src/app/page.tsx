import { createClient } from '@/lib/supabase/server'
import { SignOutButton } from './sign-out-button'

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
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">jobbet</h1>
      <p>
        Inloggad som {person?.namn ?? user?.email} ({person?.roll ?? 'okänd roll'})
      </p>
      <SignOutButton />
    </main>
  )
}
