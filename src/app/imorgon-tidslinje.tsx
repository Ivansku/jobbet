import { EmptyState } from '@/components/ui/empty-state'
import type { UppgiftDetaljerad, Kund } from './idag-flode'

// Samma dot-och-linje-visuella språk som IdagTimeline, men utan checkbox och
// fokus-kant. Imorgondagens uppgifter hämtas med hela fältuppsättningen
// (samma som Dagens tidslinje), så klick öppnar formuläret direkt.
export function ImorgonTidslinje({
  uppgifter,
  kunder,
  onOpenDetalj,
}: {
  uppgifter: UppgiftDetaljerad[]
  kunder: Kund[]
  onOpenDetalj: (u: UppgiftDetaljerad) => void
}) {
  const kundMap = new Map(kunder.map((k) => [k.id, k.namn]))

  if (uppgifter.length === 0) {
    return <EmptyState title="Inget planerat imorgon ännu" />
  }

  return (
    <div className="flex flex-col">
      {uppgifter.map((u, i) => {
        const meta = u.outlook_event_id ? 'Möte' : u.kund_id ? kundMap.get(u.kund_id) : null

        return (
          <div key={u.id} className="grid grid-cols-[52px_20px_1fr]">
            <span className="pt-3.5 pr-2.5 text-right text-xs text-stone-400 tabular-nums">
              {u.klockslag?.slice(0, 5)}
            </span>
            <div className="flex flex-col items-center">
              <span className={`w-px flex-1 ${i === 0 ? 'bg-transparent' : 'bg-border-subtle'}`} />
              <span className="my-1 h-2 w-2 shrink-0 rounded-full border-2 border-surface bg-stone-400" />
              <span className={`w-px flex-1 ${i === uppgifter.length - 1 ? 'bg-transparent' : 'bg-border-subtle'}`} />
            </div>
            <div className="pb-2">
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
                className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border-subtle px-3.5 py-2.5 text-sm hover:bg-stone-50 dark:hover:bg-stone-800"
              >
                <span className="min-w-0 flex-1 truncate">{u.titel}</span>
                {meta && <span className="shrink-0 text-xs text-stone-400">{meta}</span>}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
