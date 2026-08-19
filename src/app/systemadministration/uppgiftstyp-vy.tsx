'use client'

import { useState } from 'react'
import { skapaUppgiftstyp, uppdateraUppgiftstyp, taBortUppgiftstyp } from './actions'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { DeleteIconButton } from '@/components/ui/delete-icon-button'

type Uppgiftstyp = {
  id: string
  namn: string
  anteckningsmall_id: string | null
  skapa_uppgifter_vid_klar: boolean
}
type Anteckningsmall = { id: string; namn: string }

export function UppgiftstypVy({
  typer,
  anteckningsmallar,
}: {
  typer: Uppgiftstyp[]
  anteckningsmallar: Anteckningsmall[]
}) {
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
          anteckningsmallar={anteckningsmallar}
          onClose={() => setRedigerar(null)}
        />
      )}
    </>
  )
}

function TypFormular({
  existing,
  anteckningsmallar,
  onClose,
}: {
  existing: Uppgiftstyp | null
  anteckningsmallar: Anteckningsmall[]
  onClose: () => void
}) {
  const [namn, setNamn] = useState(existing?.namn ?? '')
  const [anteckningsmallId, setAnteckningsmallId] = useState(existing?.anteckningsmall_id ?? '')
  const [skapaUppgifterVidKlar, setSkapaUppgifterVidKlar] = useState(
    existing?.skapa_uppgifter_vid_klar ?? false
  )
  const [sparar, setSparar] = useState(false)
  const [visaBekraftelse, setVisaBekraftelse] = useState(false)
  const [tarBort, setTarBort] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!namn.trim()) return
    setSparar(true)

    const mallId = anteckningsmallId || null
    if (existing) {
      await uppdateraUppgiftstyp(existing.id, namn, mallId, skapaUppgifterVidKlar)
    } else {
      await skapaUppgiftstyp(namn, mallId, skapaUppgifterVidKlar)
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
        <Field label="Visa anteckningar" htmlFor="typ-anteckningsmall">
          <Select
            id="typ-anteckningsmall"
            value={anteckningsmallId}
            onChange={(e) => {
              const varde = e.target.value
              setAnteckningsmallId(varde)
              if (!varde) setSkapaUppgifterVidKlar(false)
            }}
          >
            <option value="">Visa inte anteckningar</option>
            {anteckningsmallar.map((m) => (
              <option key={m.id} value={m.id}>
                {m.namn}
              </option>
            ))}
          </Select>
        </Field>
        {anteckningsmallId && (
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
