'use client'

import { useState } from 'react'
import { skapaUppgiftsprojekt, uppdateraUppgiftsprojekt, taBortUppgiftsprojekt } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { DeleteIconButton } from '@/components/ui/delete-icon-button'

type Uppgiftsprojekt = { id: string; namn: string }

export function UppgiftsprojektVy({ projekt }: { projekt: Uppgiftsprojekt[] }) {
  const [redigerar, setRedigerar] = useState<Uppgiftsprojekt | 'ny' | null>(null)

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Projekttyper</h2>
        <Button variant="primary" onClick={() => setRedigerar('ny')}>
          Lägg till typ
        </Button>
      </div>

      {projekt.length === 0 ? (
        <EmptyState
          title="Inga projekt ännu"
          description="Lägg till det första projektet för att kunna kategorisera uppgifter."
        />
      ) : (
        <ul className="divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-subtle bg-surface">
          {projekt.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => setRedigerar(p)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors hover:bg-stone-50 dark:hover:bg-stone-800"
              >
                <span className="truncate">{p.namn}</span>
                <span className="text-xs text-stone-400">Redigera</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {redigerar && (
        <ProjektFormular
          existing={redigerar === 'ny' ? null : redigerar}
          onClose={() => setRedigerar(null)}
        />
      )}
    </>
  )
}

function ProjektFormular({
  existing,
  onClose,
}: {
  existing: Uppgiftsprojekt | null
  onClose: () => void
}) {
  const [namn, setNamn] = useState(existing?.namn ?? '')
  const [sparar, setSparar] = useState(false)
  const [visaBekraftelse, setVisaBekraftelse] = useState(false)
  const [tarBort, setTarBort] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!namn.trim()) return
    setSparar(true)

    if (existing) {
      await uppdateraUppgiftsprojekt(existing.id, namn)
    } else {
      await skapaUppgiftsprojekt(namn)
    }

    setSparar(false)
    onClose()
  }

  async function handleTaBort() {
    if (!existing) return
    setTarBort(true)
    await taBortUppgiftsprojekt(existing.id)
    setTarBort(false)
    onClose()
  }

  if (visaBekraftelse && existing) {
    return (
      <ConfirmDialog
        title={`Ta bort projektet "${existing.namn}"?`}
        description="Uppgifter i det här projektet behåller sin övriga information, men mister projekt-taggen."
        loading={tarBort}
        onConfirm={handleTaBort}
        onCancel={() => setVisaBekraftelse(false)}
      />
    )
  }

  return (
    <Modal onClose={onClose} labelledBy="projekt-formular-title">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h2 id="projekt-formular-title" className="text-lg font-semibold">
            {existing ? 'Redigera projekt' : 'Nytt projekt'}
          </h2>
          {existing && (
            <DeleteIconButton
              label={`Ta bort projektet "${existing.namn}"`}
              onClick={() => setVisaBekraftelse(true)}
            />
          )}
        </div>
        <Field label="Namn" htmlFor="projekt-namn">
          <Input
            id="projekt-namn"
            value={namn}
            onChange={(e) => setNamn(e.target.value)}
            placeholder="T.ex. Uppgradering"
            required
            autoFocus
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Avbryt
          </Button>
          <Button type="submit" variant="primary" loading={sparar} disabled={!namn.trim()}>
            {existing ? 'Spara' : 'Skapa'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
