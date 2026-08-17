'use client'

import { useState } from 'react'
import { skapaKategori, uppdateraKategori, taBortKategori } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { DeleteIconButton } from '@/components/ui/delete-icon-button'

type Kategori = { id: string; namn: string }

export function KategoriVy({ kategori }: { kategori: Kategori[] }) {
  const [redigerar, setRedigerar] = useState<Kategori | 'ny' | null>(null)

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Kategorier</h2>
        <Button variant="primary" onClick={() => setRedigerar('ny')}>
          Lägg till kategori
        </Button>
      </div>

      {kategori.length === 0 ? (
        <EmptyState
          title="Inga kategorier ännu"
          description="Lägg till den första kategorin för att kunna kategorisera uppgifter."
        />
      ) : (
        <ul className="divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-subtle bg-surface">
          {kategori.map((k) => (
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
        <KategoriFormular
          existing={redigerar === 'ny' ? null : redigerar}
          onClose={() => setRedigerar(null)}
        />
      )}
    </>
  )
}

function KategoriFormular({
  existing,
  onClose,
}: {
  existing: Kategori | null
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
      await uppdateraKategori(existing.id, namn)
    } else {
      await skapaKategori(namn)
    }

    setSparar(false)
    onClose()
  }

  async function handleTaBort() {
    if (!existing) return
    setTarBort(true)
    await taBortKategori(existing.id)
    setTarBort(false)
    onClose()
  }

  if (visaBekraftelse && existing) {
    return (
      <ConfirmDialog
        title={`Ta bort kategorin "${existing.namn}"?`}
        description="Uppgifter med den här kategorin behåller sin övriga information, men mister kategori-taggen."
        loading={tarBort}
        onConfirm={handleTaBort}
        onCancel={() => setVisaBekraftelse(false)}
      />
    )
  }

  return (
    <Modal onClose={onClose} labelledBy="kategori-formular-title">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h2 id="kategori-formular-title" className="text-lg font-semibold">
            {existing ? 'Redigera kategori' : 'Ny kategori'}
          </h2>
          {existing && (
            <DeleteIconButton
              label={`Ta bort kategorin "${existing.namn}"`}
              onClick={() => setVisaBekraftelse(true)}
            />
          )}
        </div>
        <Field label="Namn" htmlFor="kategori-namn">
          <Input
            id="kategori-namn"
            value={namn}
            onChange={(e) => setNamn(e.target.value)}
            placeholder="T.ex. Bokföring"
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
