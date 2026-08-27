'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

export function FlyttaDatumDialog({
  titel,
  initialDatum,
  onConfirm,
  onCancel,
}: {
  titel: string
  initialDatum: string | null
  onConfirm: (datum: string | null) => void
  onCancel: () => void
}) {
  const [datum, setDatum] = useState(initialDatum ?? '')

  function handleConfirm(e: React.FormEvent) {
    e.preventDefault()
    onConfirm(datum.trim() ? datum : null)
  }

  return (
    <Modal onClose={onCancel} labelledBy="flytta-datum-dialog-title">
      <form onSubmit={handleConfirm} className="flex flex-col gap-4">
        <h2 id="flytta-datum-dialog-title" className="text-lg font-semibold">
          Flytta &quot;{titel}&quot;
        </h2>
        <Field label="Dag" htmlFor="flytta-datum-dialog-datum">
          <Input
            type="date"
            id="flytta-datum-dialog-datum"
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
            autoFocus
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Avbryt
          </Button>
          <Button type="submit" variant="primary">
            Flytta
          </Button>
        </div>
      </form>
    </Modal>
  )
}
