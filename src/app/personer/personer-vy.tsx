'use client'

import { useState } from 'react'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'

type Kontaktperson = {
  id: string
  fornamn: string | null
  efternamn: string | null
  epost: string | null
  senast_kontaktad: string | null
  kund_id: string
  kund: { namn: string }[]
  uppgift_deltagare: { uppgift: { deadline: string | null; status: string }[] }[]
}

function kontaktNamn(k: Kontaktperson) {
  const namn = [k.fornamn, k.efternamn].filter(Boolean).join(' ')
  return namn || k.epost || 'Namnlös kontakt'
}

function kundNamn(k: Kontaktperson) {
  return k.kund[0]?.namn ?? ''
}

// Tidigaste ej slutförda möte/maildialog personen är kopplad till — visas som
// en separat "Planerat"-markering så man ser att kontakt är på väg även om
// Senast kontaktad ligger långt bak i tiden.
function planeratDatum(k: Kontaktperson): string | null {
  const datum = k.uppgift_deltagare
    .flatMap((d) => d.uppgift)
    .filter((u) => u.status !== 'klar' && !!u.deadline)
    .map((u) => u.deadline as string)
    .sort()
  return datum[0] ?? null
}

export function PersonerVy({ kontaktpersoner }: { kontaktpersoner: Kontaktperson[] }) {
  const [sok, setSok] = useState('')

  const sokterm = sok.trim().toLowerCase()
  const filtrerade = kontaktpersoner.filter(
    (k) => kontaktNamn(k).toLowerCase().includes(sokterm) || kundNamn(k).toLowerCase().includes(sokterm)
  )

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Personer</h1>
      </div>

      {kontaktpersoner.length === 0 ? (
        <EmptyState
          title="Inga kontaktpersoner ännu"
          description="Lägg till kontaktpersoner via en kund, eller låt Outlook-webhooken skapa dem automatiskt."
        />
      ) : (
        <>
          <Input
            value={sok}
            onChange={(e) => setSok(e.target.value)}
            placeholder="Sök namn eller kund…"
            className="mb-4"
          />

          <ul className="divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-subtle bg-surface">
            {filtrerade.map((k) => {
              const planerat = planeratDatum(k)
              return (
                <li key={k.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{kontaktNamn(k)}</p>
                    <p className="truncate text-xs text-stone-400">{kundNamn(k)}</p>
                  </div>
                  <div className="shrink-0 text-right text-xs">
                    <p className={k.senast_kontaktad ? 'text-stone-500' : 'text-stone-400'}>
                      {k.senast_kontaktad ? `Kontaktad ${k.senast_kontaktad}` : 'Aldrig kontaktad'}
                    </p>
                    {planerat && <p className="text-accent-600 dark:text-accent-400">Planerat {planerat}</p>}
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </>
  )
}
