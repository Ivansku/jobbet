'use client'

import { Modal } from './modal'
import { Button } from './button'

export function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Ta bort',
  loading = false,
  onConfirm,
  onCancel,
}: {
  title: string
  description?: string
  confirmLabel?: string
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal onClose={onCancel} labelledBy="confirm-dialog-title">
      <h2 id="confirm-dialog-title" className="text-lg font-semibold">
        {title}
      </h2>
      {description && <p className="mt-1 text-sm text-stone-500">{description}</p>}
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={loading}>
          Avbryt
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
