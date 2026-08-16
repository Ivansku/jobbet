'use client'

import { useState, useTransition } from 'react'
import { uppdateraStatus } from './uppgifter/actions'
import { Eyebrow } from '@/components/ui/eyebrow'
import { EmptyState } from '@/components/ui/empty-state'
import type { Uppgift, Kund, Typ } from './idag-flode'

export function MittPaDagen({
  dagensUppgifter,
  fokusUppgiftIds,
  kunder,
}: {
  dagensUppgifter: Uppgift[]
  fokusUppgiftIds: string[]
  kunder: Kund[]
  typer: Typ[]
}) {
  const kundMap = new Map(kunder.map((k) => [k.id, k.namn]))
  const [klara, setKlara] = useState<Set<string>>(
    new Set(dagensUppgifter.filter((u) => u.status === 'klar').map((u) => u.id))
  )
  const [, startTransition] = useTransition()

  const attGora = dagensUppgifter.filter((u) => !u.outlook_event_id)

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

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border-subtle bg-surface p-5 md:p-6">
      <div>
        <Eyebrow>Mitt på dagen</Eyebrow>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Vad är redan klart?</h1>
        <p className="mt-1 text-sm text-stone-500">
          Bocka av det som är avklarat, så blir kvällens lista kortare.
        </p>
      </div>

      {attGora.length === 0 ? (
        <EmptyState title="Inga uppgifter idag" />
      ) : (
        <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle">
          {attGora.map((u) => {
            const klar = klara.has(u.id)
            const fokus = fokusUppgiftIds.includes(u.id)
            return (
              <li key={u.id}>
                <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-stone-50 dark:hover:bg-stone-800">
                  <input
                    type="checkbox"
                    checked={klar}
                    onChange={() => toggleKlar(u)}
                    className="h-4 w-4 shrink-0 accent-accent-500"
                  />
                  <span className={`min-w-0 flex-1 truncate ${klar ? 'text-stone-400 line-through' : ''}`}>
                    {fokus && '★ '}
                    {u.titel}
                  </span>
                  {u.kund_id && (
                    <span className="shrink-0 text-xs text-stone-400">{kundMap.get(u.kund_id)}</span>
                  )}
                </label>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
