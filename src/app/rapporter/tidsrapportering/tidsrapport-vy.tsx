'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { EmptyState } from '@/components/ui/empty-state'
import { PersonValjare } from './person-valjare'

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
type Grupp = { kundNamn: string; timmar: number; uppgifter: Rad[] }
type KategoriTotal = { kategoriId: string; kategoriNamn: string; timmar: number }

const VECKONAV_KLASS =
  'inline-flex items-center justify-center rounded-lg border border-stone-300 bg-surface px-3 py-1.5 text-sm font-medium shadow-sm transition-colors hover:border-stone-400 hover:bg-stone-100 dark:border-stone-600 dark:hover:bg-stone-800'

function kortDatum(iso: string) {
  const [, m, d] = iso.split('-')
  return `${parseInt(d, 10)}/${parseInt(m, 10)}`
}

export function TidsrapportVy({
  veckoetikett,
  prevVeckaHref,
  nextVeckaHref,
  idagHref,
  personer,
  valdPersonId,
  initialKategoriId,
  kategoriTotaler,
  vecka,
  alleRader,
}: {
  veckoetikett: string
  prevVeckaHref: string
  nextVeckaHref: string
  idagHref: string
  personer: Person[]
  valdPersonId: string
  initialKategoriId: string
  kategoriTotaler: KategoriTotal[]
  vecka: string
  alleRader: Rad[]
}) {
  // Kategorifiltret hålls som lokalt state istället för att gå via URL/servern —
  // annars krävs en hel sidladdning (nya Supabase-anrop) för varje klick på en
  // kategoribox, vilket kändes segt jämfört med en direkt UI-toggle.
  const [valdKategoriId, setValdKategoriId] = useState(initialKategoriId)

  const { grupper, totalTimmar } = useMemo(() => {
    const filtrerade = alleRader.filter((r) => valdKategoriId === 'alla' || r.kategoriId === valdKategoriId)

    const grupper = new Map<string, Grupp>()
    let totalTimmar = 0
    for (const r of filtrerade) {
      if (!grupper.has(r.kundNamn)) grupper.set(r.kundNamn, { kundNamn: r.kundNamn, timmar: 0, uppgifter: [] })
      const grupp = grupper.get(r.kundNamn)!
      grupp.timmar += r.timmar
      grupp.uppgifter.push(r)
      totalTimmar += r.timmar
    }

    for (const g of grupper.values()) {
      g.uppgifter.sort((a, b) => a.dag.localeCompare(b.dag))
    }

    // "Utan kund" hamnar sist oavsett bokstavsordning — den är en undantagsgrupp,
    // inte ett riktigt kundnamn, och ska inte blandas in bland de alfabetiska.
    const sorteradeGrupper = [...grupper.values()].sort((a, b) => {
      if (a.kundNamn === 'Utan kund') return 1
      if (b.kundNamn === 'Utan kund') return -1
      return a.kundNamn.localeCompare(b.kundNamn, 'sv')
    })

    return { grupper: sorteradeGrupper, totalTimmar }
  }, [alleRader, valdKategoriId])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Link href={prevVeckaHref} className={VECKONAV_KLASS}>
            ← Föregående
          </Link>
          <Link href={idagHref} className={VECKONAV_KLASS}>
            Denna vecka
          </Link>
          <Link href={nextVeckaHref} className={VECKONAV_KLASS}>
            Nästa →
          </Link>
        </div>
        <PersonValjare
          personer={personer}
          valdPersonId={valdPersonId}
          vecka={vecka}
          kategoriId={valdKategoriId}
        />
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
        <p className="text-sm text-stone-500">{veckoetikett}</p>
        <p className="text-sm font-medium">
          Totalt: <span className="text-accent-700 dark:text-accent-300">{totalTimmar} h</span>
        </p>
      </div>

      {grupper.length === 0 ? (
        <EmptyState
          title="Ingen registrerad tid"
          description="Inga uppgifter med tidsåtgång hittades för den här veckan och personen."
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {grupper.map((g) => (
            <li key={g.kundNamn} className="overflow-hidden rounded-xl border border-border-subtle bg-surface">
              <div className="px-4 py-3 text-sm font-medium">
                {g.kundNamn} <span className="text-stone-400">({g.timmar} h)</span>
              </div>
              <ul className="divide-y divide-border-subtle border-t border-border-subtle bg-stone-50/50 dark:bg-stone-900/30">
                {g.uppgifter.map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-2 px-4 py-2 pl-6 text-xs">
                    <span className="truncate font-medium text-stone-700 dark:text-stone-200">{u.titel}</span>
                    <span className="flex shrink-0 items-center gap-2 text-stone-400">
                      {u.typNamn && <span>{u.typNamn}</span>}
                      {u.kategoriNamn && <span>{u.kategoriNamn}</span>}
                      <span>{kortDatum(u.dag)}</span>
                      <span className="font-medium text-stone-600 dark:text-stone-300">{u.timmar} h</span>
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
