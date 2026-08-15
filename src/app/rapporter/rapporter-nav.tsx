'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const FLIKAR = [
  { href: '/rapporter/tidsrapportering', label: 'Tidsrapportering' },
  { href: '/rapporter/flexel', label: 'Flexel' },
]

export function RapporterNav() {
  const pathname = usePathname()

  return (
    <div className="mb-6 flex gap-1 border-b border-border-subtle text-sm font-medium">
      {FLIKAR.map((f) => {
        const aktiv = pathname.startsWith(f.href)
        return (
          <Link
            key={f.href}
            href={f.href}
            className={`-mb-px border-b-2 px-3 py-2 transition-colors ${
              aktiv
                ? 'border-accent-500 text-accent-700 dark:text-accent-300'
                : 'border-transparent text-stone-500 hover:text-foreground'
            }`}
          >
            {f.label}
          </Link>
        )
      })}
    </div>
  )
}
