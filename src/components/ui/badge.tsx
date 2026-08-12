import type { ReactNode } from 'react'

type Tone = 'neutral' | 'accent' | 'warning' | 'danger' | 'success'

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300',
  accent: 'bg-accent-50 text-accent-700 dark:bg-accent-950 dark:text-accent-300',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  danger: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
  success: 'bg-success-50 text-success-700 dark:bg-success-950 dark:text-success-100',
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  )
}
