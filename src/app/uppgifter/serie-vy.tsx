'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { EmptyState } from '@/components/ui/empty-state'
import type { Serie } from './uppgift-formular'

const VECKODAGAR_KORT = ['Mån', 'Tis', 'Ons', 'Tors', 'Fre']

function veckodagarText(dagar: number[]) {
  return [...dagar]
    .sort()
    .map((d) => VECKODAGAR_KORT[d - 1])
    .join(', ')
}

function upprepningText(s: Serie) {
  if (s.serie_typ === 'dag') {
    return s.intervall > 1 ? `Var ${s.intervall}:e dag` : 'Varje dag'
  }
  if (s.serie_typ === 'manad') {
    const dagIManad = Number(s.start_datum.slice(8, 10))
    const manadText = s.intervall > 1 ? `var ${s.intervall}:e månad` : 'varje månad'
    return `Dag ${dagIManad} i månaden, ${manadText}`
  }
  return `${s.intervall > 1 ? `Var ${s.intervall}:e vecka: ` : ''}${veckodagarText(s.veckodagar)}`
}

export function SerieVy({
  serier,
  onNewSerie,
  onSelectSerie,
}: {
  serier: Serie[]
  onNewSerie: () => void
  onSelectSerie: (serie: Serie) => void
}) {
  const [visaLista, setVisaLista] = useState(false)

  return (
    <>
      <Button variant="secondary" onClick={() => setVisaLista(true)}>
        Serier
      </Button>

      {visaLista && (
        <Modal onClose={() => setVisaLista(false)} labelledBy="serier-title">
          <h2 id="serier-title" className="mb-4 text-lg font-semibold">
            Återkommande serier
          </h2>
          {serier.length === 0 ? (
            <EmptyState
              title="Inga serier ännu"
              description="Skapa en ny serie för att se den här."
            />
          ) : (
            <ul className="max-h-[60vh] divide-y divide-border-subtle overflow-y-auto rounded-xl border border-border-subtle">
              {serier.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => {
                      setVisaLista(false)
                      onSelectSerie(s)
                    }}
                    className="flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left text-sm transition-colors hover:bg-stone-50 dark:hover:bg-stone-800"
                  >
                    <span className="font-medium">{s.titel}</span>
                    <span className="text-xs text-stone-400">
                      {upprepningText(s)} · Från {s.start_datum} ·{' '}
                      {s.slut_datum ? `till ${s.slut_datum}` : 'inget slutdatum'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex items-center justify-between">
            <Button
              variant="primary"
              onClick={() => {
                setVisaLista(false)
                onNewSerie()
              }}
            >
              Ny serie
            </Button>
            <Button variant="secondary" onClick={() => setVisaLista(false)}>
              Stäng
            </Button>
          </div>
        </Modal>
      )}
    </>
  )
}
