'use client'

import type { UppgiftDetaljerad, Kund } from './idag-flode'

export function IdagTimeline({
  uppgifter,
  fokusUppgiftIds,
  klaraIds,
  onToggle,
  onOpenDetalj,
  kunder,
}: {
  uppgifter: UppgiftDetaljerad[]
  fokusUppgiftIds: string[]
  klaraIds: Set<string>
  onToggle: (u: UppgiftDetaljerad) => void
  onOpenDetalj: (u: UppgiftDetaljerad) => void
  kunder: Kund[]
}) {
  // Ingen omsortering här — uppgifter kommer redan i sortordning-ordning från
  // page.tsx:s .order('sortordning'), samma fält Kanban-vyns drag-and-drop
  // skriver till, och samma ordning ska gälla här: tidsatta och otidsatta
  // rader blandas fritt i en enda lista, precis som i Kanban. Varje rad får
  // en punkt oavsett klockslag så linjen blir sammanhängande genom hela
  // listan — klockslagskolumnen är bara tom för otidsatta rader.
  const kundMap = new Map(kunder.map((k) => [k.id, k.namn]))

  if (uppgifter.length === 0) {
    return <p className="text-sm text-stone-400">Inget planerat idag.</p>
  }

  return (
    <div className="flex flex-col">
      {uppgifter.map((u, i) => {
        const fokus = fokusUppgiftIds.includes(u.id)
        const klar = klaraIds.has(u.id)

        return (
          // Ingen items-start här — raden ska sträcka sig (grid-standard) så att
          // linje-kolumnen får radens fulla höjd att fördela sina två flex-segment
          // (ovanför/under punkten) över. Annars blir strecket avklippt eftersom
          // dess behållare bara blir så hög som punkten själv.
          <div key={u.id} className="grid grid-cols-[52px_20px_1fr]">
            <span className="pt-3.5 pr-2.5 text-right text-xs text-stone-400 tabular-nums">
              {u.klockslag?.slice(0, 5)}
            </span>
            <div className="flex flex-col items-center">
              <span className={`w-px flex-1 ${i === 0 ? 'bg-transparent' : 'bg-border-subtle'}`} />
              <span
                className={`my-1 h-2 w-2 shrink-0 rounded-full border-2 border-surface ${dotTone(u, fokusUppgiftIds, klaraIds)}`}
              />
              <span className={`w-px flex-1 ${i === uppgifter.length - 1 ? 'bg-transparent' : 'bg-border-subtle'}`} />
            </div>
            <div className="pb-2">
              <Kort u={u} fokus={fokus} klar={klar} onToggle={onToggle} onOpenDetalj={onOpenDetalj} kundMap={kundMap} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function dotTone(u: UppgiftDetaljerad, fokusUppgiftIds: string[], klaraIds: Set<string>) {
  if (klaraIds.has(u.id)) return 'bg-success-600'
  if (fokusUppgiftIds.includes(u.id)) return 'bg-accent-500'
  return 'bg-stone-400'
}

function Kort({
  u,
  fokus,
  klar,
  onToggle,
  onOpenDetalj,
  kundMap,
}: {
  u: UppgiftDetaljerad
  fokus: boolean
  klar: boolean
  onToggle: (u: UppgiftDetaljerad) => void
  onOpenDetalj: (u: UppgiftDetaljerad) => void
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
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpenDetalj(u)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpenDetalj(u)
        }
      }}
      className={`flex cursor-pointer items-center gap-2.5 rounded-xl border-y border-r border-border-subtle border-l-[3px] px-3.5 py-2.5 text-sm hover:bg-stone-50 dark:hover:bg-stone-800 ${
        fokus ? 'border-l-accent-500' : 'border-l-border-subtle'
      }`}
    >
      <input
        type="checkbox"
        checked={klar}
        aria-label={u.titel}
        onChange={() => onToggle(u)}
        onClick={(e) => e.stopPropagation()}
        className="h-4 w-4 shrink-0 cursor-pointer accent-accent-500"
      />
      <span className={`min-w-0 flex-1 truncate ${klar ? 'text-stone-400 line-through' : ''}`}>{u.titel}</span>
      {meta && <span className="shrink-0 text-xs text-stone-400">{meta}</span>}
    </div>
  )
}
