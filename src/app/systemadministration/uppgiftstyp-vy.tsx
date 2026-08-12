'use client'

import { useState } from 'react'
import { skapaUppgiftstyp, uppdateraUppgiftstyp, taBortUppgiftstyp } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'

type Uppgiftstyp = { id: string; namn: string }

export function UppgiftstypVy({ typer }: { typer: Uppgiftstyp[] }) {
  const [redigerar, setRedigerar] = useState<Uppgiftstyp | 'ny' | null>(null)

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Uppgiftstyper</h2>
        <Button variant="primary" onClick={() => setRedigerar('ny')}>
          Lägg till typ
        </Button>
      </div>

      {typer.length === 0 ? (
        <EmptyState
          title="Inga uppgiftstyper ännu"
          description="Lägg till den första typen för att kunna kategorisera uppgifter."
        />
      ) : (
        <ul className="divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-subtle bg-surface">
          {typer.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => setRedigerar(t)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors hover:bg-stone-50 dark:hover:bg-stone-800"
              >
                <span className="truncate">{t.namn}</span>
                <span className="text-xs text-stone-400">Redigera</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {redigerar && (
        <TypFormular
          existing={redigerar === 'ny' ? null : redigerar}
          onClose={() => setRedigerar(null)}
        />
      )}
    </>
  )
}

function TypFormular({ existing, onClose }: { existing: Uppgiftstyp | null; onClose: () => void }) {
  const [namn, setNamn] = useState(existing?.namn ?? '')
  const [sparar, setSparar] = useState(false)
  const [visaBekraftelse, setVisaBekraftelse] = useState(false)
  const [tarBort, setTarBort] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!namn.trim()) return
    setSparar(true)

    if (existing) {
      await uppdateraUppgiftstyp(existing.id, namn)
    } else {
      await skapaUppgiftstyp(namn)
    }

    setSparar(false)
    onClose()
  }

  async function handleTaBort() {
    if (!existing) return
    setTarBort(true)
    await taBortUppgiftstyp(existing.id)
    setTarBort(false)
    onClose()
  }

  if (visaBekraftelse && existing) {
    return (
      <ConfirmDialog
        title={`Ta bort uppgiftstypen "${existing.namn}"?`}
        description="Uppgifter av den här typen behåller sin övriga information, men mister typ-taggen."
        loading={tarBort}
        onConfirm={handleTaBort}
        onCancel={() => setVisaBekraftelse(false)}
      />
    )
  }

  return (
    <Modal onClose={onClose} labelledBy="typ-formular-title">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <h2 id="typ-formular-title" className="text-lg font-semibold">
          {existing ? 'Redigera uppgiftstyp' : 'Ny uppgiftstyp'}
        </h2>
        <Field label="Namn" htmlFor="typ-namn">
          <Input
            id="typ-namn"
            value={namn}
            onChange={(e) => setNamn(e.target.value)}
            placeholder="T.ex. Support"
            required
            autoFocus
          />
        </Field>
        <div className="flex items-center justify-between gap-2">
          {existing ? (
            <Button type="button" variant="danger" size="sm" onClick={() => setVisaBekraftelse(true)}>
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
