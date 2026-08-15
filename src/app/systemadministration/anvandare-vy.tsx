'use client'

import { useState } from 'react'
import { uppdateraPerson } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'

type Person = {
  id: string
  namn: string
  epost: string
  epost_outlook: string | null
  roll: string | null
  arbetstimmar_per_vecka: number
}

const ROLL_PILLS = [
  { value: 'medlem', label: 'Medlem' },
  { value: 'admin', label: 'Admin' },
]

export function AnvandareVy({ personer }: { personer: Person[] }) {
  const [redigerar, setRedigerar] = useState<Person | null>(null)

  return (
    <>
      <div className="mb-6">
        <h2 className="text-lg font-semibold tracking-tight">Användare</h2>
        <p className="mt-1 text-sm text-stone-500">
          Roll, Outlook-mail och arbetstimmar per vecka styr bland annat kapacitetsvisningen i
          Uppgifter-vyn.
        </p>
      </div>

      <ul className="divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-subtle bg-surface">
        {personer.map((p) => (
          <li key={p.id}>
            <button
              onClick={() => setRedigerar(p)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-stone-50 dark:hover:bg-stone-800"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{p.namn}</span>
                <span className="block truncate text-xs text-stone-400">{p.epost}</span>
              </span>
              <span className="shrink-0 text-xs text-stone-400">
                {p.roll === 'admin' ? 'Admin' : 'Medlem'} · {p.arbetstimmar_per_vecka} h/vecka
              </span>
            </button>
          </li>
        ))}
      </ul>

      {redigerar && <AnvandareFormular person={redigerar} onClose={() => setRedigerar(null)} />}
    </>
  )
}

function AnvandareFormular({ person, onClose }: { person: Person; onClose: () => void }) {
  const [namn, setNamn] = useState(person.namn)
  const [roll, setRoll] = useState(person.roll ?? 'medlem')
  const [epostOutlook, setEpostOutlook] = useState(person.epost_outlook ?? '')
  const [arbetstimmar, setArbetstimmar] = useState(String(person.arbetstimmar_per_vecka))
  const [sparar, setSparar] = useState(false)
  const [fel, setFel] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const timmar = Number(arbetstimmar.replace(',', '.'))
    if (!namn.trim()) {
      setFel('Namn krävs.')
      return
    }
    setSparar(true)
    setFel(null)

    const { error } = await uppdateraPerson(person.id, {
      namn,
      roll,
      epostOutlook,
      arbetstimmarPerVecka: timmar,
    })

    setSparar(false)
    if (error) {
      setFel(error)
      return
    }
    onClose()
  }

  return (
    <Modal onClose={onClose} labelledBy="anvandare-formular-title">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <h2 id="anvandare-formular-title" className="text-lg font-semibold">
          Redigera användare
        </h2>
        <Field label="Namn" htmlFor="anvandare-namn">
          <Input
            id="anvandare-namn"
            value={namn}
            onChange={(e) => setNamn(e.target.value)}
            required
            autoFocus
          />
        </Field>
        <Field label="Inloggningsmail" htmlFor="anvandare-epost">
          <Input id="anvandare-epost" value={person.epost} disabled />
        </Field>
        <Field label="Outlook-mail" htmlFor="anvandare-epost-outlook">
          <Input
            id="anvandare-epost-outlook"
            type="email"
            value={epostOutlook}
            onChange={(e) => setEpostOutlook(e.target.value)}
            placeholder="namn@foretag.se"
          />
        </Field>
        <Field label="Arbetstimmar per vecka" htmlFor="anvandare-arbetstimmar">
          <Input
            id="anvandare-arbetstimmar"
            type="number"
            min="0"
            max="168"
            step="0.5"
            value={arbetstimmar}
            onChange={(e) => setArbetstimmar(e.target.value)}
            required
          />
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-stone-700 dark:text-stone-300">Roll</span>
          <div role="group" aria-label="Roll" className="flex flex-wrap gap-1.5">
            {ROLL_PILLS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRoll(opt.value)}
                aria-pressed={opt.value === roll}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  opt.value === roll
                    ? 'border-accent-500 bg-accent-50 text-accent-700 dark:bg-accent-950 dark:text-accent-300'
                    : 'border-border-subtle text-stone-500 hover:bg-stone-50 dark:text-stone-400 dark:hover:bg-stone-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {fel && <p className="text-sm text-red-600">{fel}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Avbryt
          </Button>
          <Button type="submit" variant="primary" loading={sparar} disabled={!namn.trim()}>
            Spara
          </Button>
        </div>
      </form>
    </Modal>
  )
}
