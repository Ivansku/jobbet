'use client'

import type { Uppgift, Kund } from './idag-flode'

const MAX_FOKUS = 3

export function DagensFokusValjare({
  kandidater,
  valda,
  onChange,
  kunder,
}: {
  kandidater: Uppgift[]
  valda: string[]
  onChange: (nyValda: string[]) => void
  kunder: Kund[]
}) {
  const kundMap = new Map(kunder.map((k) => [k.id, k.namn]))

  if (kandidater.length === 0) {
    return <p className="text-sm text-stone-400">Inga uppgifter att välja bland idag.</p>
  }

  function toggle(id: string) {
    const nyValda = valda.includes(id)
      ? valda.filter((x) => x !== id)
      : valda.length >= MAX_FOKUS
        ? valda
        : [...valda, id]
    onChange(nyValda)
  }

  return (
    <div className="flex flex-col">
      {kandidater.map((u) => {
        const vald = valda.includes(u.id)
        const kundNamn = u.kund_id ? kundMap.get(u.kund_id) : null
        return (
          <label
            key={u.id}
            className={`flex cursor-pointer items-center gap-2 border-t border-border-subtle py-2 text-sm first:border-t-0 ${
              vald ? 'bg-accent-50 dark:bg-accent-950' : 'hover:bg-stone-50 dark:hover:bg-stone-800'
            }`}
          >
            <input
              type="checkbox"
              checked={vald}
              disabled={!vald && valda.length >= MAX_FOKUS}
              onChange={() => toggle(u.id)}
              className="h-4 w-4 shrink-0 accent-accent-500 disabled:opacity-40"
            />
            <span className="min-w-0 flex-1 truncate">{u.titel}</span>
            {kundNamn && <span className="shrink-0 text-xs text-stone-400">{kundNamn}</span>}
            <span className="shrink-0 text-xs text-stone-400 tabular-nums">{u.klockslag?.slice(0, 5)}</span>
          </label>
        )
      })}
    </div>
  )
}
