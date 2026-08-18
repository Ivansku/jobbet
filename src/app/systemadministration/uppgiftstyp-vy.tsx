'use client'

import { useState } from 'react'
import { skapaUppgiftstyp, uppdateraUppgiftstyp, taBortUppgiftstyp } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { DeleteIconButton } from '@/components/ui/delete-icon-button'

type Uppgiftstyp = {
  id: string
  namn: string
  visar_motesanteckningar: boolean
  skapa_uppgifter_vid_klar: boolean
  visar_mailinnehall: boolean
}

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
  const [visarMotesanteckningar, setVisarMotesanteckningar] = useState(
    existing?.visar_motesanteckningar ?? false
  )
  const [skapaUppgifterVidKlar, setSkapaUppgifterVidKlar] = useState(
    existing?.skapa_uppgifter_vid_klar ?? false
  )
  const [visarMailinnehall, setVisarMailinnehall] = useState(existing?.visar_mailinnehall ?? false)
  const [sparar, setSparar] = useState(false)
  const [visaBekraftelse, setVisaBekraftelse] = useState(false)
  const [tarBort, setTarBort] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!namn.trim()) return
    setSparar(true)

    if (existing) {
      await uppdateraUppgiftstyp(existing.id, namn, visarMotesanteckningar, skapaUppgifterVidKlar, visarMailinnehall)
    } else {
      await skapaUppgiftstyp(namn, visarMotesanteckningar, skapaUppgifterVidKlar, visarMailinnehall)
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
        <div className="flex items-center justify-between gap-2">
          <h2 id="typ-formular-title" className="text-lg font-semibold">
            {existing ? 'Redigera uppgiftstyp' : 'Ny uppgiftstyp'}
          </h2>
          {existing && (
            <DeleteIconButton
              label={`Ta bort uppgiftstypen "${existing.namn}"`}
              onClick={() => setVisaBekraftelse(true)}
            />
          )}
        </div>
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
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={visarMotesanteckningar}
            onChange={(e) => {
              const varde = e.target.checked
              setVisarMotesanteckningar(varde)
              if (!varde) setSkapaUppgifterVidKlar(false)
            }}
            className="h-4 w-4 accent-accent-600"
          />
          Visa mötesanteckningar på uppgifter
        </label>
        {visarMotesanteckningar && (
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={skapaUppgifterVidKlar}
              onChange={(e) => setSkapaUppgifterVidKlar(e.target.checked)}
              className="h-4 w-4 accent-accent-600"
            />
            Skapa uppföljningsuppgifter automatiskt vid klar
          </label>
        )}
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={visarMailinnehall}
            onChange={(e) => setVisarMailinnehall(e.target.checked)}
            className="h-4 w-4 accent-accent-600"
          />
          Visa mailinnehåll på uppgifter
        </label>
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
