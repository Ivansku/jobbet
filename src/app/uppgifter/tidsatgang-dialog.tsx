'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

export function TidsatgangDialog({
  titel,
  initialTimmar,
  onConfirm,
  onCancel,
}: {
  titel: string
  initialTimmar: number | null
  onConfirm: (timmar: number | null) => void
  onCancel: () => void
}) {
  const [tidsatgang, setTidsatgang] = useState(initialTimmar?.toString() ?? '')

  function handleConfirm(e: React.FormEvent) {
    e.preventDefault()
    onConfirm(tidsatgang.trim() ? Number(tidsatgang) : null)
  }

  return (
    <Modal onClose={onCancel} labelledBy="tidsatgang-dialog-title">
      <form onSubmit={handleConfirm} className="flex flex-col gap-4">
        <h2 id="tidsatgang-dialog-title" className="text-lg font-semibold">
          Klarmarkera &quot;{titel}&quot;
        </h2>
        <Field label="Tidsåtgång (timmar)" htmlFor="tidsatgang-dialog-timmar">
          <Input
            type="number"
            id="tidsatgang-dialog-timmar"
            min={0}
            step={0.5}
            value={tidsatgang}
            onChange={(e) => setTidsatgang(e.target.value)}
            placeholder="T.ex. 0.5"
            autoFocus
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Avbryt
          </Button>
          <Button type="submit" variant="primary">
            Klarmarkera
          </Button>
        </div>
      </form>
    </Modal>
  )
}
