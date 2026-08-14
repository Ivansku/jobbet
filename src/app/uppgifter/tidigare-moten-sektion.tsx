'use client'

import { useEffect, useState } from 'react'
import { hamtaTidigareMoten } from './actions'
import { mondagAvVecka } from './vecka-helpers'

type TidigareMote = { id: string; titel: string; deadline: string; utdrag: string[] }

export function TidigareMotenSektion({
  kundId,
  excludeUppgiftId,
  kundNamn,
}: {
  kundId: string
  excludeUppgiftId: string
  kundNamn: string
}) {
  const [moten, setMoten] = useState<TidigareMote[] | null>(null)

  useEffect(() => {
    let aktiv = true
    hamtaTidigareMoten(kundId, excludeUppgiftId).then((rader) => {
      if (aktiv) setMoten(rader)
    })
    return () => {
      aktiv = false
    }
  }, [kundId, excludeUppgiftId])

  if (!moten || moten.length === 0) return null

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border-subtle p-3">
      <h3 className="text-sm font-semibold">Tidigare möten med {kundNamn}</h3>
      <ul className="flex flex-col gap-2">
        {moten.map((m) => (
          <li key={m.id} className="text-xs">
            <a
              href={`/uppgifter?vecka=${mondagAvVecka(m.deadline)}`}
              className="font-medium text-accent-600 hover:underline dark:text-accent-400"
            >
              {m.titel} ({m.deadline})
            </a>
            {m.utdrag.length > 0 && <p className="mt-0.5 truncate text-stone-400">{m.utdrag.join(' · ')}</p>}
          </li>
        ))}
      </ul>
    </div>
  )
}
