'use client'

import type { Uppgift, Kund } from './idag-flode'

export function IdagTimeline({
  uppgifter,
  fokusUppgiftIds,
  klaraIds,
  onToggle,
  kunder,
}: {
  uppgifter: Uppgift[]
  fokusUppgiftIds: string[]
  klaraIds: Set<string>
  onToggle: (u: Uppgift) => void
  kunder: Kund[]
}) {
  const kundMap = new Map(kunder.map((k) => [k.id, k.namn]))
  const tidsatta = [...uppgifter]
    .filter((u) => u.klockslag)
    .sort((a, b) => (a.klockslag ?? '').localeCompare(b.klockslag ?? ''))
  const otidsatta = uppgifter.filter((u) => !u.klockslag)

  if (uppgifter.length === 0) {
    return <p className="text-sm text-stone-400">Inget planerat idag.</p>
  }

  return (
    <div className="flex flex-col">
      {tidsatta.map((u, i) => (
        <Rad
          key={u.id}
          u={u}
          klockslag={u.klockslag!.slice(0, 5)}
          harLinje={i < tidsatta.length - 1}
          fokus={fokusUppgiftIds.includes(u.id)}
          klar={klaraIds.has(u.id)}
          onToggle={onToggle}
          kundMap={kundMap}
        />
      ))}
      {otidsatta.map((u) => (
        <Rad
          key={u.id}
          u={u}
          klockslag={null}
          harLinje={false}
          fokus={fokusUppgiftIds.includes(u.id)}
          klar={klaraIds.has(u.id)}
          onToggle={onToggle}
          kundMap={kundMap}
        />
      ))}
    </div>
  )
}

function Rad({
  u,
  klockslag,
  harLinje,
  fokus,
  klar,
  onToggle,
  kundMap,
}: {
  u: Uppgift
  klockslag: string | null
  harLinje: boolean
  fokus: boolean
  klar: boolean
  onToggle: (u: Uppgift) => void
  kundMap: Map<string, string>
}) {
  const dotTone = klar ? 'bg-success-600' : fokus ? 'bg-accent-500' : 'bg-stone-400'

  return (
    <div className="grid grid-cols-[52px_20px_1fr] items-start">
      <span className="pt-3.5 pr-2.5 text-right text-xs text-stone-400 tabular-nums">{klockslag}</span>
      <span className="relative flex justify-center pt-4">
        {harLinje && <span className="absolute top-2 bottom-[-8px] w-px bg-border-subtle" />}
        <span className={`relative h-2 w-2 shrink-0 rounded-full ${dotTone}`} />
      </span>
      <label className="mb-2 ml-3 flex cursor-pointer items-center gap-2.5 rounded-xl border border-border-subtle bg-surface px-3.5 py-2.5 text-sm hover:bg-stone-50 dark:hover:bg-stone-800">
        <input
          type="checkbox"
          checked={klar}
          onChange={() => onToggle(u)}
          className="h-4 w-4 shrink-0 accent-accent-500"
        />
        <span className={`min-w-0 flex-1 truncate ${klar ? 'text-stone-400 line-through' : ''}`}>{u.titel}</span>
        {u.kund_id && <span className="shrink-0 text-xs text-stone-400">{kundMap.get(u.kund_id)}</span>}
      </label>
    </div>
  )
}
