'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  skapaFlexelPost,
  uppdateraFlexelPost,
  taBortFlexelPost,
  skapaKvotjustering,
  uppdateraKvotjustering,
  taBortKvotjustering,
} from './actions'
import { Button } from '@/components/ui/button'
import { Input, Textarea, Select } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { DeleteIconButton } from '@/components/ui/delete-icon-button'
import { ROD_DAG_STREGMONSTER_KLASS, HALVDAG_MASK_KLASS } from '@/lib/svenska-dagar'

type AktivModul = { modul: string; label: string; veckokvotTimmar: number }
type Saldo = { modul: string; label: string; saldo: number; dennaManaden: number }
type ForaldraledigInfo = {
  veckokvot: number
  kvotSaldo: number
  visadManad: string
  dennaManadensKvot: number
  dennaManadensUttag: number
} | null
type Post = { id: string; modul: string; datum: string; timmar: number; motivering: string }
type DagRad = { datum: string; post: Post | null; rodDag: boolean; helgdag: string | null; halvdag: boolean }
type VeckoGrupp = {
  veckonummer: number
  totalTimmar: number
  totalPerModul: { modul: string; timmar: number }[]
  dagar: DagRad[]
}
type Justering = { id: string; manad: string; justering_timmar: number; kommentar: string | null }

const MANADER_LANGA = [
  'januari',
  'februari',
  'mars',
  'april',
  'maj',
  'juni',
  'juli',
  'augusti',
  'september',
  'oktober',
  'november',
  'december',
]

function manadKort(manadISO: string) {
  const [y, m] = manadISO.split('-').map(Number)
  return `${MANADER_LANGA[m - 1]} ${y}`
}

const MANADNAV_KLASS =
  'inline-flex items-center justify-center rounded-lg border border-stone-300 bg-surface px-3 py-1.5 text-sm font-medium shadow-sm transition-colors hover:border-stone-400 hover:bg-stone-100 dark:border-stone-600 dark:hover:bg-stone-800'

function kortDatum(iso: string) {
  const [, m, d] = iso.split('-')
  return `${parseInt(d, 10)}/${parseInt(m, 10)}`
}

function todayLocalISO(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatTimmar(t: number): string {
  const rundat = Number(t.toFixed(1))
  return rundat > 0 ? `+${rundat}` : rundat.toString()
}

function formatPositivTimmar(t: number): string {
  return Number(Math.max(0, t).toFixed(1)).toString()
}

export function FlexelVy({
  aktivaModuler,
  saldon,
  foraldraledigInfo,
  manadEtikett,
  prevManadHref,
  nextManadHref,
  idagHref,
  manad,
  valdModul,
  veckoGrupper,
  modulLabel,
  senasteJusteringar,
}: {
  aktivaModuler: AktivModul[]
  saldon: Saldo[]
  foraldraledigInfo: ForaldraledigInfo
  manadEtikett: string
  prevManadHref: string
  nextManadHref: string
  idagHref: string
  manad: string
  valdModul: string
  veckoGrupper: VeckoGrupp[]
  modulLabel: Record<string, string>
  senasteJusteringar: Justering[]
}) {
  const router = useRouter()
  const [nyttDatum, setNyttDatum] = useState<string | null>(null)
  const [redigerar, setRedigerar] = useState<Post | null>(null)
  const [visaKvotpanel, setVisaKvotpanel] = useState(false)
  const [redigerarJustering, setRedigerarJustering] = useState<Justering | 'ny' | null>(null)

  return (
    <div className="flex flex-col gap-6">
      {visaKvotpanel && foraldraledigInfo && (
        <Modal onClose={() => setVisaKvotpanel(false)} labelledBy="kvotpanel-title">
          <div className="flex items-center justify-between gap-2">
            <h2 id="kvotpanel-title" className="text-lg font-semibold">
              Föräldraledig-kvot
            </h2>
            <Button size="sm" variant="secondary" onClick={() => setRedigerarJustering('ny')}>
              Justera månadens kvot
            </Button>
          </div>
          {senasteJusteringar.length > 0 ? (
            <ul className="mt-3 flex flex-col divide-y divide-border-subtle border-t border-border-subtle">
              {senasteJusteringar.map((j) => (
                <li key={j.id}>
                  <button
                    onClick={() => setRedigerarJustering(j)}
                    className="flex w-full items-center justify-between gap-2 py-1.5 text-left text-xs text-stone-500 transition-colors hover:bg-stone-50 dark:hover:bg-stone-800"
                  >
                    <span className="truncate">
                      {manadKort(j.manad)}
                      {j.kommentar ? ` · ${j.kommentar}` : ''}
                    </span>
                    <span className="shrink-0 font-medium text-stone-600 dark:text-stone-300">
                      {formatTimmar(j.justering_timmar)} h
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-stone-400">Inga justeringar ännu.</p>
          )}
        </Modal>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Link href={prevManadHref} className={MANADNAV_KLASS}>
            ← Föregående
          </Link>
          <Link href={idagHref} className={MANADNAV_KLASS}>
            Denna månad
          </Link>
          <Link href={nextManadHref} className={MANADNAV_KLASS}>
            Nästa →
          </Link>
        </div>
        {aktivaModuler.length > 1 && (
          <Select
            aria-label="Typ"
            value={valdModul}
            onChange={(e) => router.push(`/rapporter/flexel?manad=${manad}&modul=${e.target.value}`)}
            className="!w-auto"
          >
            <option value="alla">Alla typer</option>
            {aktivaModuler.map((m) => (
              <option key={m.modul} value={m.modul}>
                {m.label}
              </option>
            ))}
          </Select>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {saldon.map((s) => {
          const arForaldraledig = s.modul === 'foraldraledig' && foraldraledigInfo
          const dennaManaden = arForaldraledig
            ? foraldraledigInfo!.dennaManadensKvot - foraldraledigInfo!.dennaManadensUttag
            : s.dennaManaden
          const totalSaldo = arForaldraledig ? foraldraledigInfo!.kvotSaldo : s.saldo
          return (
            <div key={s.modul} className="rounded-xl border border-border-subtle bg-surface p-4">
              <p className="text-xs text-stone-500">{s.label}</p>
              <p
                className={`text-xl font-semibold ${
                  dennaManaden < 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground'
                }`}
              >
                {formatTimmar(dennaManaden)} h
                {arForaldraledig && (
                  <span className="ml-1 text-sm font-normal text-stone-400">
                    ({formatPositivTimmar(foraldraledigInfo!.dennaManadensUttag)}h/
                    {foraldraledigInfo!.dennaManadensKvot}h)
                  </span>
                )}
              </p>
              <p className="mt-1 text-xs text-stone-400">{formatTimmar(totalSaldo)} h totalt</p>
              {arForaldraledig && (
                <button
                  onClick={() => setVisaKvotpanel(true)}
                  className="mt-1 text-xs font-medium text-accent-700 hover:underline dark:text-accent-300"
                >
                  Kvotjusteringar
                </button>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-sm text-stone-500">{manadEtikett}</p>

      {veckoGrupper.length === 0 ? (
        <EmptyState title="Inga vardagar den här månaden" />
      ) : (
        <ul className="flex flex-col gap-4">
          {veckoGrupper.map((g) => (
            <li key={g.veckonummer} className="overflow-hidden rounded-xl border border-border-subtle bg-surface">
              <div className="flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium">
                <span>Vecka {g.veckonummer}</span>
                <span className="text-stone-400">
                  {valdModul === 'alla'
                    ? g.totalPerModul
                        .map((t) => `${modulLabel[t.modul]} ${formatTimmar(t.timmar)} h`)
                        .join(' · ')
                    : `${formatTimmar(g.totalTimmar)} h`}
                </span>
              </div>
              <ul className="divide-y divide-border-subtle border-t border-border-subtle bg-stone-50/50 dark:bg-stone-900/30">
                {g.dagar.map((d, i) => {
                  // Samma diagonala streckmönster som Uppgifter-kolumnerna, för konsekvent
                  // röd dag/halvdag-markering över sidorna. Mönstret ligger i ett eget
                  // dekorativt lager bakom radens innehåll (inte mask-image direkt på <li>)
                  // — mask-image maskar annars hela radens renderade innehåll, inte bara
                  // bakgrunden, och klippte bort halva raden på halvdagar.
                  const visaMonster = d.rodDag || d.halvdag
                  const monsterLager = visaMonster && (
                    <div
                      aria-hidden
                      className={`pointer-events-none absolute inset-0 -z-10 ${ROD_DAG_STREGMONSTER_KLASS} ${d.halvdag ? HALVDAG_MASK_KLASS : ''}`}
                    />
                  )
                  const monsterLinje = d.halvdag && (
                    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 border-t border-border-subtle" />
                  )
                  return d.post ? (
                    <li key={d.post.id} className="relative isolate overflow-hidden">
                      {monsterLager}
                      {monsterLinje}
                      <button
                        onClick={() => setRedigerar(d.post!)}
                        className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors hover:bg-stone-100 dark:hover:bg-stone-800"
                      >
                        <span className="w-12 shrink-0 tabular-nums text-sm font-medium text-stone-600 dark:text-stone-300">
                          {kortDatum(d.datum)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{d.post.motivering}</span>
                          <span className="block text-xs text-stone-400">{modulLabel[d.post.modul]}</span>
                        </span>
                        <span
                          className={`shrink-0 text-sm font-medium ${
                            d.post.timmar < 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-accent-700 dark:text-accent-300'
                          }`}
                        >
                          {formatTimmar(d.post.timmar)} h
                        </span>
                      </button>
                    </li>
                  ) : (
                    <li key={`tom-${d.datum}-${i}`} className="relative isolate overflow-hidden">
                      {monsterLager}
                      {monsterLinje}
                      <button
                        onClick={() => setNyttDatum(d.datum)}
                        className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-stone-400 transition-colors hover:bg-stone-100 dark:hover:bg-stone-800"
                      >
                        <span className="w-12 shrink-0 tabular-nums text-sm font-medium text-stone-400">
                          {kortDatum(d.datum)}
                        </span>
                        <span className="flex-1 italic">
                          {d.rodDag ? (d.helgdag ?? 'Röd dag') : d.halvdag ? 'Halvdag' : 'Ingen registrering'}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {(nyttDatum || redigerar) && (
        <FlexelPostFormular
          existing={redigerar}
          initialDatum={nyttDatum ?? todayLocalISO()}
          aktivaModuler={aktivaModuler}
          onClose={() => {
            setNyttDatum(null)
            setRedigerar(null)
          }}
        />
      )}
      {redigerarJustering && foraldraledigInfo && (
        <KvotjusteringFormular
          existing={redigerarJustering === 'ny' ? null : redigerarJustering}
          manad={foraldraledigInfo.visadManad}
          onClose={() => setRedigerarJustering(null)}
        />
      )}
    </div>
  )
}

const MODUL_PILL_KLASS = (aktiv: boolean) =>
  `rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
    aktiv
      ? 'border-accent-500 bg-accent-50 text-accent-700 dark:bg-accent-950 dark:text-accent-300'
      : 'border-border-subtle text-stone-500 hover:bg-stone-50 dark:text-stone-400 dark:hover:bg-stone-800'
  }`

function FlexelPostFormular({
  existing,
  initialDatum,
  aktivaModuler,
  onClose,
}: {
  existing: Post | null
  initialDatum: string
  aktivaModuler: AktivModul[]
  onClose: () => void
}) {
  const [datum, setDatum] = useState(existing?.datum ?? initialDatum)
  const [timmar, setTimmar] = useState(existing ? String(existing.timmar) : '0')
  const [motivering, setMotivering] = useState(existing?.motivering ?? '')
  const [modul, setModul] = useState(existing?.modul ?? aktivaModuler[0]?.modul ?? '')
  const [sparar, setSparar] = useState(false)
  const [fel, setFel] = useState<string | null>(null)
  const [visaBekraftelse, setVisaBekraftelse] = useState(false)
  const [tarBort, setTarBort] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const timmarTal = Number(timmar.replace(',', '.'))
    setSparar(true)
    setFel(null)

    const input = { datum, timmar: timmarTal, motivering, modul }
    const { error } = existing ? await uppdateraFlexelPost(existing.id, input) : await skapaFlexelPost(input)

    setSparar(false)
    if (error) {
      setFel(error)
      return
    }
    onClose()
  }

  async function handleTaBort() {
    if (!existing) return
    setTarBort(true)
    await taBortFlexelPost(existing.id)
    setTarBort(false)
    onClose()
  }

  if (visaBekraftelse && existing) {
    return (
      <ConfirmDialog
        title="Ta bort raden?"
        loading={tarBort}
        onConfirm={handleTaBort}
        onCancel={() => setVisaBekraftelse(false)}
      />
    )
  }

  return (
    <Modal onClose={onClose} labelledBy="flexel-post-title">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h2 id="flexel-post-title" className="text-lg font-semibold">
            {existing ? 'Redigera rad' : 'Ny rad'}
          </h2>
          {existing && <DeleteIconButton label="Ta bort raden" onClick={() => setVisaBekraftelse(true)} />}
        </div>

        {aktivaModuler.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-stone-700 dark:text-stone-300">Modul</span>
            <div role="group" aria-label="Modul" className="flex flex-wrap gap-1.5">
              {aktivaModuler.map((m) => (
                <button
                  key={m.modul}
                  type="button"
                  onClick={() => setModul(m.modul)}
                  aria-pressed={m.modul === modul}
                  className={MODUL_PILL_KLASS(m.modul === modul)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <Field label="Datum" htmlFor="flexel-datum">
          <Input
            id="flexel-datum"
            type="date"
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
            required
            autoFocus
          />
        </Field>
        <Field label="Timmar (negativt vid uttag)" htmlFor="flexel-timmar">
          <Input
            id="flexel-timmar"
            type="number"
            step="0.25"
            value={timmar}
            onChange={(e) => setTimmar(e.target.value)}
            required
          />
        </Field>
        <Field label="Motivering" htmlFor="flexel-motivering">
          <Textarea
            id="flexel-motivering"
            rows={2}
            value={motivering}
            onChange={(e) => setMotivering(e.target.value)}
            required
          />
        </Field>
        {fel && <p className="text-sm text-red-600">{fel}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Avbryt
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={sparar}
            disabled={!motivering.trim() || !timmar || !modul}
          >
            {existing ? 'Spara' : 'Skapa'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function KvotjusteringFormular({
  existing,
  manad,
  onClose,
}: {
  existing: Justering | null
  manad: string
  onClose: () => void
}) {
  const [manadValue, setManadValue] = useState((existing?.manad ?? manad).slice(0, 7))
  const [justering, setJustering] = useState(existing ? String(existing.justering_timmar) : '')
  const [kommentar, setKommentar] = useState(existing?.kommentar ?? '')
  const [sparar, setSparar] = useState(false)
  const [fel, setFel] = useState<string | null>(null)
  const [visaBekraftelse, setVisaBekraftelse] = useState(false)
  const [tarBort, setTarBort] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const tal = Number(justering.replace(',', '.'))
    setSparar(true)
    setFel(null)

    const input = { manad: `${manadValue}-01`, justeringTimmar: tal, kommentar }
    const { error } = existing
      ? await uppdateraKvotjustering(existing.id, input)
      : await skapaKvotjustering(input)

    setSparar(false)
    if (error) {
      setFel(error)
      return
    }
    onClose()
  }

  async function handleTaBort() {
    if (!existing) return
    setTarBort(true)
    await taBortKvotjustering(existing.id)
    setTarBort(false)
    onClose()
  }

  if (visaBekraftelse && existing) {
    return (
      <ConfirmDialog
        title="Ta bort justeringen?"
        loading={tarBort}
        onConfirm={handleTaBort}
        onCancel={() => setVisaBekraftelse(false)}
      />
    )
  }

  return (
    <Modal onClose={onClose} labelledBy="kvotjustering-title">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h2 id="kvotjustering-title" className="text-lg font-semibold">
            {existing ? 'Redigera justering' : 'Justera månadens kvot'}
          </h2>
          {existing && <DeleteIconButton label="Ta bort justeringen" onClick={() => setVisaBekraftelse(true)} />}
        </div>
        <Field label="Månad" htmlFor="kvotjustering-manad">
          <Input
            id="kvotjustering-manad"
            type="month"
            value={manadValue}
            onChange={(e) => setManadValue(e.target.value)}
            required
            autoFocus
          />
        </Field>
        <Field label="Justering, timmar (t.ex. -8 vid en månad med röda dagar)" htmlFor="kvotjustering-timmar">
          <Input
            id="kvotjustering-timmar"
            type="number"
            step="0.5"
            value={justering}
            onChange={(e) => setJustering(e.target.value)}
            required
          />
        </Field>
        <Field label="Kommentar" htmlFor="kvotjustering-kommentar">
          <Input
            id="kvotjustering-kommentar"
            value={kommentar}
            onChange={(e) => setKommentar(e.target.value)}
            placeholder="T.ex. Jullov"
          />
        </Field>
        {fel && <p className="text-sm text-red-600">{fel}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Avbryt
          </Button>
          <Button type="submit" variant="primary" loading={sparar} disabled={!justering}>
            {existing ? 'Spara' : 'Skapa'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
