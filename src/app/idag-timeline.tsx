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
        <div key={u.id} className="grid grid-cols-[52px_20px_1fr] items-start">
          <span className="pt-3.5 pr-2.5 text-right text-xs text-stone-400 tabular-nums">
            {u.klockslag!.slice(0, 5)}
          </span>
          <span className="relative flex justify-center pt-4">
            {i < tidsatta.length - 1 && <span className="absolute top-2 bottom-[-8px] w-px bg-border-subtle" />}
            <span
              className={`relative h-2 w-2 shrink-0 rounded-full border-2 border-surface ${dotTone(u, fokusUppgiftIds, klaraIds)}`}
            />
          </span>
          <div className="mb-2 ml-3">
            <Kort
              u={u}
              fokus={fokusUppgiftIds.includes(u.id)}
              klar={klaraIds.has(u.id)}
              onToggle={onToggle}
              kundMap={kundMap}
            />
          </div>
        </div>
      ))}
      {otidsatta.length > 0 && (
        <div className="flex flex-col gap-2 pl-[72px]">
          {otidsatta.map((u) => (
            <Kort
              key={u.id}
              u={u}
              fokus={fokusUppgiftIds.includes(u.id)}
              klar={klaraIds.has(u.id)}
              onToggle={onToggle}
              kundMap={kundMap}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function dotTone(u: Uppgift, fokusUppgiftIds: string[], klaraIds: Set<string>) {
  if (klaraIds.has(u.id)) return 'bg-success-600'
  if (fokusUppgiftIds.includes(u.id)) return 'bg-accent-500'
  return 'bg-stone-400'
}

function Kort({
  u,
  fokus,
  klar,
  onToggle,
  kundMap,
}: {
  u: Uppgift
  fokus: boolean
  klar: boolean
  onToggle: (u: Uppgift) => void
  kundMap: Map<string, string>
}) {
  const meta = u.outlook_event_id
    ? 'Möte'
    : u.kund_id
      ? kundMap.get(u.kund_id)
      : fokus
        ? 'Fokus'
        : null

  return (
    <label
      className={`flex cursor-pointer items-center gap-2.5 rounded-xl border-y border-r border-border-subtle border-l-2 px-3.5 py-2.5 text-sm hover:bg-stone-50 dark:hover:bg-stone-800 ${
        fokus ? 'border-l-accent-500' : 'border-l-border-subtle'
      }`}
    >
      <input
        type="checkbox"
        checked={klar}
        onChange={() => onToggle(u)}
        className="h-4 w-4 shrink-0 accent-accent-500"
      />
      <span className={`min-w-0 flex-1 truncate ${klar ? 'text-stone-400 line-through' : ''}`}>{u.titel}</span>
      {meta && <span className="shrink-0 text-xs text-stone-400">{meta}</span>}
    </label>
  )
}
