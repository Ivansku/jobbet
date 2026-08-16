'use client'

import { useState, useTransition } from 'react'
import { uppdateraStatus } from './uppgifter/actions'
import { EmptyState } from '@/components/ui/empty-state'
import type { Uppgift, Kund, Typ } from './idag-flode'

export function DagensUppgiftslista({
  uppgifter,
  fokusUppgiftIds,
  kunder,
  typer,
}: {
  uppgifter: Uppgift[]
  fokusUppgiftIds: string[]
  kunder: Kund[]
  typer: Typ[]
}) {
  const kundMap = new Map(kunder.map((k) => [k.id, k.namn]))
  const typMap = new Map(typer.map((t) => [t.id, t.namn]))
  const [klara, setKlara] = useState<Set<string>>(
    new Set(uppgifter.filter((u) => u.status === 'klar').map((u) => u.id))
  )
  const [, startTransition] = useTransition()

  function toggleKlar(u: Uppgift) {
    const nyStatus = klara.has(u.id) ? 'oppen' : 'klar'
    setKlara((prev) => {
      const next = new Set(prev)
      if (nyStatus === 'klar') next.add(u.id)
      else next.delete(u.id)
      return next
    })
    startTransition(() => {
      uppdateraStatus(u.id, nyStatus)
    })
  }

  const sorterade = [...uppgifter].sort((a, b) => (a.klockslag ?? '').localeCompare(b.klockslag ?? ''))

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">Dagens uppgifter</h2>
      {sorterade.length === 0 ? (
        <EmptyState title="Inget planerat idag" description="Njut av en lugn dag." />
      ) : (
        <ul className="divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-subtle bg-surface">
          {sorterade.map((u) => {
            const klar = klara.has(u.id)
            const fokus = fokusUppgiftIds.includes(u.id)
            const kontext = [u.kund_id && kundMap.get(u.kund_id), u.typ_id && typMap.get(u.typ_id)]
              .filter((v): v is string => Boolean(v))
              .join(' · ')
            return (
              <li key={u.id}>
                <label className="flex cursor-pointer items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-stone-50 dark:hover:bg-stone-800">
                  <input
                    type="checkbox"
                    checked={klar}
                    onChange={() => toggleKlar(u)}
                    className="h-4 w-4 shrink-0 accent-accent-500"
                  />
                  <span className="min-w-0 flex-1">
                    {kontext && <span className="block truncate text-[11px] text-stone-400">{kontext}</span>}
                    <span className={`block truncate ${klar ? 'text-stone-400 line-through' : ''}`}>
                      {fokus && '★ '}
                      {u.klockslag && (
                        <span className="mr-1.5 font-normal text-stone-400">{u.klockslag.slice(0, 5)}</span>
                      )}
                      {u.titel}
                    </span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
