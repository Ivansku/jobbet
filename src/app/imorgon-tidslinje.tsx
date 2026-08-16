import { EmptyState } from '@/components/ui/empty-state'
import type { Uppgift, Kund } from './idag-flode'

// Samma dot-och-linje-visuella språk som IdagTimeline, men skrivskyddad —
// ingen checkbox, ingen klick-till-redigera, ingen fokus-kant. Imorgondagens
// uppgifter hämtas med det magra fältsettet (inte UppgiftDetaljerad), så det
// finns inget att öppna ett redigeringsformulär mot ändå.
export function ImorgonTidslinje({ uppgifter, kunder }: { uppgifter: Uppgift[]; kunder: Kund[] }) {
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
              <div className="flex items-center gap-2.5 rounded-xl border border-border-subtle px-3.5 py-2.5 text-sm">
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
