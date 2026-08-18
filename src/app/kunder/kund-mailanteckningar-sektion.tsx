'use client'

import { useState } from 'react'
import { MarkdownViewer } from '@/components/ui/markdown-viewer'
import type { MailMote } from './mail-actions'

// Läsvy över uppgifter av en typ med "Visa mailinnehåll" ibockad — precis som
// KundMotesanteckningarSektion är detta bara en filtrerad vy över uppgiftsdata,
// redigering sker på själva uppgiften. Data kommer som prop från sidans
// server-fetch (page.tsx), inte via en egen useEffect-hämtning.
export function KundMailanteckningarSektion({ moten }: { moten: MailMote[] }) {
  const [oppna, setOppna] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setOppna((state) => {
      const nasta = new Set(state)
      if (nasta.has(id)) nasta.delete(id)
      else nasta.add(id)
      return nasta
    })
  }

  return (
    <div className="border-t border-border-subtle pt-4">
      <h3 className="mb-2 text-sm font-semibold text-stone-500">Mailanteckningar</h3>
      {moten.length === 0 ? (
        <p className="text-xs text-stone-400">Inga anteckningar ännu.</p>
      ) : (
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
                <div className="border-t border-border-subtle px-3 py-2">
                  <MarkdownViewer value={m.mailinnehall} className="text-xs text-stone-600 dark:text-stone-300" />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
