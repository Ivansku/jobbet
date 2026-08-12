import type { ReactNode } from 'react'

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-semibold tracking-wide text-accent-600 uppercase dark:text-accent-400">
      {children}
    </p>
  )
}
