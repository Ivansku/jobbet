'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function OnboardingPage() {
  const supabase = createClient()
  const router = useRouter()
  const [namn, setNamn] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!namn.trim()) return

    setLoading(true)
    setError(null)

    const { error } = await supabase.rpc('create_foretag', { p_namn: namn.trim() })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold">Skapa ditt företag</h1>
        <p className="max-w-sm text-sm text-neutral-600">
          Du blir automatiskt admin för företaget du skapar.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="text"
          value={namn}
          onChange={(e) => setNamn(e.target.value)}
          placeholder="Företagsnamn"
          className="w-72 rounded-md border px-3 py-2"
          autoFocus
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading || !namn.trim()}
          className="rounded-md bg-black px-4 py-2 text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {loading ? 'Skapar…' : 'Skapa företag'}
        </button>
      </form>
    </main>
  )
}
