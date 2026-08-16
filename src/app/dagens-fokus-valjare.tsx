'use client'

import type { Uppgift } from './idag-flode'

const MAX_FOKUS = 3

export function DagensFokusValjare({
  kandidater,
  valda,
  onChange,
}: {
  kandidater: Uppgift[]
  valda: string[]
  onChange: (nyValda: string[]) => void
}) {
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
    <div className="flex flex-col gap-1.5">
      {kandidater.map((u) => {
        const vald = valda.includes(u.id)
        return (
          <label
            key={u.id}
            className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-sm ${
              vald
                ? 'border-accent-500 bg-accent-50 dark:bg-accent-950'
                : 'border-border-subtle hover:bg-stone-50 dark:hover:bg-stone-800'
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
          </label>
        )
      })}
    </div>
  )
}
