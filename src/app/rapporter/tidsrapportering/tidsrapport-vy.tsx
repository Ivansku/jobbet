import Link from 'next/link'
import { EmptyState } from '@/components/ui/empty-state'
import { PersonValjare } from './person-valjare'

type Person = { id: string; namn: string }
type Rad = {
  id: string
  titel: string
  typNamn: string | null
  projektNamn: string | null
  dag: string
  timmar: number
}
type Grupp = { kundNamn: string; timmar: number; uppgifter: Rad[] }

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
  vecka,
  grupper,
  totalTimmar,
}: {
  veckoetikett: string
  prevVeckaHref: string
  nextVeckaHref: string
  idagHref: string
  personer: Person[]
  valdPersonId: string
  vecka: string
  grupper: Grupp[]
  totalTimmar: number
}) {
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
        <PersonValjare personer={personer} valdPersonId={valdPersonId} vecka={vecka} />
      </div>

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
                      {u.projektNamn && <span>{u.projektNamn}</span>}
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
