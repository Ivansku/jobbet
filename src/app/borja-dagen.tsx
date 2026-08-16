'use client'

import { useState, useTransition } from 'react'
import { sattDagensFokus } from './idag-actions'
import { Badge } from '@/components/ui/badge'
import { Eyebrow } from '@/components/ui/eyebrow'
import type { Uppgift, Kund, Typ } from './idag-flode'

const MAX_FOKUS = 3

function kortDatum(iso: string) {
  const [, m, d] = iso.split('-')
  return `${parseInt(d, 10)}/${parseInt(m, 10)}`
}

export function BorjaDagen({
  personNamn,
  idag,
  dagensUppgifter,
  eftersläpning,
  fokusUppgiftIds,
  kunder,
}: {
  personNamn: string
  idag: string
  dagensUppgifter: Uppgift[]
  eftersläpning: Uppgift[]
  fokusUppgiftIds: string[]
  kunder: Kund[]
  typer: Typ[]
}) {
  const kundMap = new Map(kunder.map((k) => [k.id, k.namn]))
  const [valda, setValda] = useState<string[]>(fokusUppgiftIds)
  const [, startTransition] = useTransition()

  const moten = dagensUppgifter
    .filter((u) => u.outlook_event_id)
    .sort((a, b) => (a.klockslag ?? '').localeCompare(b.klockslag ?? ''))
  const fokusKandidater = dagensUppgifter.filter((u) => !u.outlook_event_id && u.status !== 'klar')

  function toggleFokus(id: string) {
    const nyValda = valda.includes(id)
      ? valda.filter((x) => x !== id)
      : valda.length >= MAX_FOKUS
        ? valda
        : [...valda, id]
    setValda(nyValda)
    startTransition(() => {
      sattDagensFokus(idag, nyValda)
    })
  }

  return (
    <section className="flex flex-col gap-6 rounded-xl border border-border-subtle bg-surface p-5 md:p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">God morgon, {personNamn.split(' ')[0]}</h1>
        <p className="mt-1 text-sm text-stone-500">
          {dagensUppgifter.length} uppgift{dagensUppgifter.length === 1 ? '' : 'er'} idag
          {eftersläpning.length > 0 && ` · ${eftersläpning.length} försenad${eftersläpning.length === 1 ? '' : 'e'}`}
        </p>
      </div>

      {eftersläpning.length > 0 && (
        <div className="flex flex-col gap-2">
          <Eyebrow>Gårdagens försenat</Eyebrow>
          <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle">
            {eftersläpning.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="truncate">{u.titel}</span>
                <Badge tone="danger">{u.deadline && kortDatum(u.deadline)}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Eyebrow>Dagens fokus (valfritt, max {MAX_FOKUS})</Eyebrow>
        {fokusKandidater.length === 0 ? (
          <p className="text-sm text-stone-400">Inga uppgifter att välja bland idag.</p>
        ) : (
          <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle">
            {fokusKandidater.map((u) => {
              const vald = valda.includes(u.id)
              return (
                <li key={u.id}>
                  <label
                    className={`flex cursor-pointer items-center gap-2.5 px-3 py-2.5 text-sm transition-colors ${
                      vald ? 'bg-accent-50 dark:bg-accent-950' : 'hover:bg-stone-50 dark:hover:bg-stone-800'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={vald}
                      disabled={!vald && valda.length >= MAX_FOKUS}
                      onChange={() => toggleFokus(u.id)}
                      className="h-4 w-4 shrink-0 accent-accent-500 disabled:opacity-40"
                    />
                    <span className="truncate">{u.titel}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {moten.length > 0 && (
        <div className="flex flex-col gap-2">
          <Eyebrow>Dagens möten</Eyebrow>
          <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle">
            {moten.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="truncate">{m.titel}</span>
                <span className="shrink-0 text-xs text-stone-400">
                  {m.klockslag?.slice(0, 5)}
                  {m.kund_id && ` · ${kundMap.get(m.kund_id)}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
