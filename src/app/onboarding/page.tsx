'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SignOutButton } from '../sign-out-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { Eyebrow } from '@/components/ui/eyebrow'

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
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="w-full max-w-sm rounded-xl border border-border-subtle bg-surface p-8 shadow-sm">
        <div className="text-center">
          <Eyebrow>Kom igång</Eyebrow>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">Skapa ditt företag</h1>
          <p className="mt-1 text-sm text-stone-500">
            Du blir automatiskt admin för företaget du skapar.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <Field label="Företagsnamn" htmlFor="foretag-namn" error={error ?? undefined}>
            <Input
              id="foretag-namn"
              value={namn}
              onChange={(e) => setNamn(e.target.value)}
              placeholder="T.ex. Mitt AB"
              autoFocus
            />
          </Field>
          <Button type="submit" variant="primary" loading={loading} disabled={!namn.trim()}>
            Skapa företag
          </Button>
        </form>
      </div>
      <SignOutButton />
    </main>
  )
}
