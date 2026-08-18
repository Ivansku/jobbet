import type { ReactNode } from 'react'

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-stone-700 dark:text-stone-300">
        {label}
      </label>
      {hint && <p className="-mt-1 text-xs text-stone-400">{hint}</p>}
      {children}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
