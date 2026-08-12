'use client'

import { useState } from 'react'
import { skapaKund, uppdateraKund, taBortKund } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'

type Kund = { id: string; namn: string }

export function KundVy({ kunder }: { kunder: Kund[] }) {
  const [redigerar, setRedigerar] = useState<Kund | 'ny' | null>(null)

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Kunder</h1>
        <Button variant="primary" onClick={() => setRedigerar('ny')}>
          Lägg till kund
        </Button>
      </div>

      {kunder.length === 0 ? (
        <EmptyState title="Inga kunder ännu" description="Lägg till din första kund för att komma igång." />
      ) : (
        <ul className="divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-subtle bg-surface">
          {kunder.map((k) => (
            <li key={k.id}>
              <button
                onClick={() => setRedigerar(k)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors hover:bg-stone-50 dark:hover:bg-stone-800"
              >
                <span className="truncate">{k.namn}</span>
                <span className="text-xs text-stone-400">Redigera</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {redigerar && (
        <KundFormular
          existing={redigerar === 'ny' ? null : redigerar}
          onClose={() => setRedigerar(null)}
        />
      )}
    </>
  )
}

function KundFormular({ existing, onClose }: { existing: Kund | null; onClose: () => void }) {
  const [namn, setNamn] = useState(existing?.namn ?? '')
  const [sparar, setSparar] = useState(false)
  const [visaBekraftelse, setVisaBekraftelse] = useState(false)
  const [tarBort, setTarBort] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!namn.trim()) return
    setSparar(true)

    if (existing) {
      await uppdateraKund(existing.id, namn)
    } else {
      await skapaKund(namn)
    }

    setSparar(false)
    onClose()
  }

  async function handleTaBort() {
    if (!existing) return
    setTarBort(true)
    await taBortKund(existing.id)
    setTarBort(false)
    onClose()
  }

  if (visaBekraftelse && existing) {
    return (
      <ConfirmDialog
        title={`Ta bort kunden "${existing.namn}"?`}
        description="Uppgifter taggade med den här kunden behåller sin övriga information, men mister kundtaggen."
        loading={tarBort}
        onConfirm={handleTaBort}
        onCancel={() => setVisaBekraftelse(false)}
      />
    )
  }

  return (
    <Modal onClose={onClose} labelledBy="kund-formular-title">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <h2 id="kund-formular-title" className="text-lg font-semibold">
          {existing ? 'Redigera kund' : 'Ny kund'}
        </h2>
        <Field label="Namn" htmlFor="kund-namn">
          <Input
            id="kund-namn"
            value={namn}
            onChange={(e) => setNamn(e.target.value)}
            placeholder="Kundnamn"
            required
            autoFocus
          />
        </Field>
        <div className="flex items-center justify-between gap-2">
          {existing ? (
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => setVisaBekraftelse(true)}
            >
              Ta bort
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Avbryt
            </Button>
            <Button type="submit" variant="primary" loading={sparar} disabled={!namn.trim()}>
              {existing ? 'Spara' : 'Skapa'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
