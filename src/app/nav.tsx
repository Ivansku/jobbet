'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SignOutButton } from './sign-out-button'

const LANKAR = [
  { href: '/', label: 'Hem' },
  { href: '/uppgifter', label: 'Uppgifter' },
  { href: '/kunder', label: 'Kunder' },
  { href: '/rapporter', label: 'Rapporter' },
  { href: '/systemadministration', label: 'Systemadministration' },
]

export function AppNav() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center justify-between border-b border-border-subtle bg-surface px-6 py-3">
      <div className="flex gap-1 text-sm font-medium">
        {LANKAR.map((l) => {
          const aktiv = l.href === '/' ? pathname === '/' : pathname.startsWith(l.href)
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-1.5 transition-colors ${
                aktiv
                  ? 'bg-accent-50 text-accent-700 dark:bg-accent-950 dark:text-accent-300'
                  : 'text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800'
              }`}
            >
              {l.label}
            </Link>
          )
        })}
      </div>
      <SignOutButton />
    </nav>
  )
}
