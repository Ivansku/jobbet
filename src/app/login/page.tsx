'use client'

import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const supabase = createClient()

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">jobbet</h1>
      <button
        onClick={signInWithGoogle}
        className="rounded-md bg-black px-4 py-2 text-white hover:bg-neutral-800"
      >
        Logga in med Google
      </button>
    </main>
  )
}
