'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { EmptyState } from '@/components/ui/empty-state'
import { PersonValjare } from './person-valjare'
import { PeriodValjare } from './period-valjare'
import type { Period } from './page'
import { UppgiftFormular } from '../../uppgifter/uppgift-formular'
import type {
  Uppgift,
  Kund,
  Typ,
  Kategori,
  Projekt,
  Serie,
  Kontaktperson,
  OppenPlaceholder,
  Anteckningsblock,
} from '../../uppgifter/uppgift-formular'

type Person = { id: string; namn: string }
type Rad = {
  id: string
  titel: string
  typNamn: string | null
  kategoriId: string
  kategoriNamn: string | null
  kundNamn: string
  dag: string
  timmar: number
}
type KategoriTotal = { kategoriId: string; kategoriNamn: string; timmar: number }

const VECKONAV_KLASS =
  'inline-flex items-center justify-center rounded-lg border border-stone-300 bg-surface px-3 py-1.5 text-sm font-medium shadow-sm transition-colors hover:border-stone-400 hover:bg-stone-100 dark:border-stone-600 dark:hover:bg-stone-800'

function kortDatum(iso: string) {
  const [, m, d] = iso.split('-')
  return `${parseInt(d, 10)}/${parseInt(m, 10)}`
}

export function TidsrapportVy({
  periodEtikett,
  idagLabel,
  prevPeriodHref,
  nextPeriodHref,
  idagHref,
  personer,
  valdPersonId,
  initialKategoriId,
  kategoriTotaler,
  period,
  datum,
  alleRader,
  uppgifterFulla,
  kunder,
  typer,
  kategoriLista,
  projekt,
  serier,
  kontaktpersoner,
  placeholders,
  block,
}: {
  periodEtikett: string
  idagLabel: string
  prevPeriodHref: string
  nextPeriodHref: string
  idagHref: string
  personer: Person[]
  valdPersonId: string
  initialKategoriId: string
  kategoriTotaler: KategoriTotal[]
  period: Period
  datum: string
  alleRader: Rad[]
  uppgifterFulla: Uppgift[]
  kunder: Kund[]
  typer: Typ[]
  kategoriLista: Kategori[]
  projekt: Projekt[]
  serier: Serie[]
  kontaktpersoner: Kontaktperson[]
  placeholders: OppenPlaceholder[]
  block: Anteckningsblock[]
}) {
  // Kategorifiltret hålls som lokalt state istället för att gå via URL/servern —
  // annars krävs en hel sidladdning (nya Supabase-anrop) för varje klick på en
  // kategoribox, vilket kändes segt jämfört med en direkt UI-toggle.
  const router = useRouter()
  const [valdKategoriId, setValdKategoriId] = useState(initialKategoriId)
  const [redigerarId, setRedigerarId] = useState<string | null>(null)
  const uppgifterMap = useMemo(() => new Map(uppgifterFulla.map((u) => [u.id, u])), [uppgifterFulla])
  const redigerar = redigerarId ? (uppgifterMap.get(redigerarId) ?? null) : null

  const { rader, totalTimmar } = useMemo(() => {
    const filtrerade = alleRader.filter((r) => valdKategoriId === 'alla' || r.kategoriId === valdKategoriId)
    const rader = [...filtrerade].sort((a, b) => a.dag.localeCompare(b.dag) || a.titel.localeCompare(b.titel, 'sv'))
    const totalTimmar = filtrerade.reduce((sum, r) => sum + r.timmar, 0)
    return { rader, totalTimmar }
  }, [alleRader, valdKategoriId])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Link href={prevPeriodHref} className={VECKONAV_KLASS}>
            ← Föregående
          </Link>
          <Link href={idagHref} className={VECKONAV_KLASS}>
            {idagLabel}
          </Link>
          <Link href={nextPeriodHref} className={VECKONAV_KLASS}>
            Nästa →
          </Link>
        </div>
        <div className="flex gap-2">
          <PeriodValjare period={period} datum={datum} personId={valdPersonId} kategoriId={valdKategoriId} />
          <PersonValjare
            personer={personer}
            valdPersonId={valdPersonId}
            datum={datum}
            period={period}
            kategoriId={valdKategoriId}
          />
        </div>
      </div>

      {kategoriTotaler.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {kategoriTotaler.map((k) => {
            const aktiv = valdKategoriId === k.kategoriId
            return (
              <button
                key={k.kategoriId}
                type="button"
                onClick={() => setValdKategoriId(aktiv ? 'alla' : k.kategoriId)}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  aktiv
                    ? 'border-accent-500 bg-accent-50 dark:bg-accent-950'
                    : 'border-border-subtle bg-surface hover:border-stone-400 dark:hover:border-stone-600'
                }`}
              >
                <p className={`text-xs ${aktiv ? 'text-accent-700 dark:text-accent-300' : 'text-stone-500'}`}>
                  {k.kategoriNamn}
                </p>
                <p className="text-xl font-semibold text-foreground">{k.timmar} h</p>
              </button>
            )
          })}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-500">{periodEtikett}</p>
        <p className="text-sm font-medium">
          Totalt: <span className="text-accent-700 dark:text-accent-300">{totalTimmar} h</span>
        </p>
      </div>

      {rader.length === 0 ? (
        <EmptyState
          title="Ingen registrerad tid"
          description="Inga uppgifter med tidsåtgång hittades för den här perioden och personen."
        />
      ) : (
        <ul className="divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-subtle bg-surface">
          {rader.map((u) => (
            <li
              key={u.id}
              role="button"
              tabIndex={0}
              onClick={() => setRedigerarId(u.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setRedigerarId(u.id)
                }
              }}
              className="flex cursor-pointer items-center justify-between gap-2 px-4 py-2.5 text-sm hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              <span className="truncate font-medium text-stone-700 dark:text-stone-200">{u.titel}</span>
              <span className="flex shrink-0 items-center gap-1 text-xs text-stone-400">
                <span>{[u.kundNamn, u.typNamn, u.kategoriNamn, kortDatum(u.dag)].filter(Boolean).join(' · ')} ·</span>
                <span className="font-medium text-stone-600 dark:text-stone-300">{u.timmar} h</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {redigerar && (
        <UppgiftFormular
          existing={redigerar}
          placeholders={placeholders}
          personer={personer}
          kunder={kunder}
          typer={typer}
          kategori={kategoriLista}
          projekt={projekt}
          serier={serier}
          kontaktpersoner={kontaktpersoner}
          block={block}
          currentPersonId={null}
          initialDeadline={null}
          onEditSerie={() => router.push('/uppgifter')}
          onClose={() => setRedigerarId(null)}
        />
      )}
    </div>
  )
}
