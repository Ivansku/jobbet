'use client'

import { useState } from 'react'
import { MarkdownViewer } from '@/components/ui/markdown-viewer'

export type Mote = {
  id: string
  titel: string
  deadline: string | null
  block: { namn: string; innehall: string }[]
}

// Data kommer numera som en prop från sidans server-fetch (page.tsx) istället för
// att hämtas här i en useEffect — annars hann kundkortet visas tomt innan
// nätverksanropet hunnit svara.
export function KundMotesanteckningarSektion({ moten }: { moten: Mote[] }) {
  const [oppna, setOppna] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setOppna((state) => {
      const nasta = new Set(state)
      if (nasta.has(id)) nasta.delete(id)
      else nasta.add(id)
      return nasta
    })
  }

  if (moten.length === 0) return null

  return (
    <div className="border-t border-border-subtle pt-4">
      <h3 className="mb-2 text-sm font-semibold text-stone-500">Mötesanteckningar</h3>
      <ul className="flex flex-col gap-2">
        {moten.map((m) => (
          <li key={m.id} className="rounded-lg border border-border-subtle">
            <button
              type="button"
              onClick={() => toggle(m.id)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-stone-50 dark:hover:bg-stone-800"
            >
              <span className="truncate">{m.titel}</span>
              <span className="shrink-0 text-xs text-stone-400">{m.deadline ?? ''}</span>
            </button>
            {oppna.has(m.id) && (
              <div className="flex flex-col gap-2 border-t border-border-subtle px-3 py-2">
                {m.block.length === 0 ? (
                  <p className="text-xs text-stone-400">Inga anteckningar.</p>
                ) : (
                  m.block.map((b, i) => (
                    <div key={i}>
                      <p className="text-xs font-semibold text-stone-500">{b.namn}</p>
                      <MarkdownViewer value={b.innehall} className="text-xs text-stone-600 dark:text-stone-300" />
                    </div>
                  ))
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
