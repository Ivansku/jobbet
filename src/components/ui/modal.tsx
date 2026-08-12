'use client'

import { useEffect, type ReactNode } from 'react'

export function Modal({
  onClose,
  children,
  labelledBy,
}: {
  onClose: () => void
  children: ReactNode
  labelledBy?: string
}) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="w-full max-w-md rounded-xl border border-border-subtle bg-surface p-6 shadow-lg"
      >
        {children}
      </div>
    </div>
  )
}
