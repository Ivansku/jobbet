'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  skapaFlexelPost,
  uppdateraFlexelPost,
  taBortFlexelPost,
  skapaKvotjustering,
  taBortKvotjustering,
} from './actions'
import { Button } from '@/components/ui/button'
import { Input, Textarea, Select } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { DeleteIconButton } from '@/components/ui/delete-icon-button'

type AktivModul = { modul: string; label: string; veckokvotTimmar: number }
type Saldo = { modul: string; label: string; saldo: number }
type ForaldraledigInfo = {
  veckokvot: number
  kvotSaldo: number
  dennaVeckansKvot: number
  dennaVeckansUttag: number
} | null
type Post = { id: string; modul: string; datum: string; timmar: number; motivering: string }
type Justering = { id: string; vecka: string; justering_timmar: number; kommentar: string | null }

const VECKONAV_KLASS =
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

export function FlexelVy({
  aktivaModuler,
  saldon,
  foraldraledigInfo,
  veckoetikett,
  prevVeckaHref,
  nextVeckaHref,
  idagHref,
  vecka,
  valdModul,
  poster,
  modulLabel,
  senasteJusteringar,
}: {
  aktivaModuler: AktivModul[]
  saldon: Saldo[]
  foraldraledigInfo: ForaldraledigInfo
  veckoetikett: string
  prevVeckaHref: string
  nextVeckaHref: string
  idagHref: string
  vecka: string
  valdModul: string
  poster: Post[]
  modulLabel: Record<string, string>
  senasteJusteringar: Justering[]
}) {
  const router = useRouter()
  const [nyRad, setNyRad] = useState(false)
  const [redigerar, setRedigerar] = useState<Post | null>(null)
  const [visaJustering, setVisaJustering] = useState(false)
  const [taBortJustering, setTaBortJustering] = useState<Justering | null>(null)
  const [tarBortJustering, setTarBortJustering] = useState(false)

  async function handleTaBortJustering() {
    if (!taBortJustering) return
    setTarBortJustering(true)
    await taBortKvotjustering(taBortJustering.id)
    setTarBortJustering(false)
    setTaBortJustering(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {saldon.map((s) => (
          <div key={s.modul} className="rounded-xl border border-border-subtle bg-surface p-4">
            <p className="text-xs text-stone-500">{s.label}</p>
            <p
              className={`text-xl font-semibold ${
                s.saldo < 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground'
              }`}
            >
              {formatTimmar(s.saldo)} h
            </p>
            {s.modul === 'foraldraledig' && foraldraledigInfo && (
              <p className="mt-1 text-xs text-stone-400">
                {formatTimmar(foraldraledigInfo.dennaVeckansUttag)} / {foraldraledigInfo.dennaVeckansKvot} h denna
                vecka
              </p>
            )}
          </div>
        ))}
      </div>

      {foraldraledigInfo && (
        <div className="rounded-xl border border-border-subtle bg-surface p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Föräldraledig-kvot</p>
            <Button size="sm" variant="secondary" onClick={() => setVisaJustering(true)}>
              Justera veckans kvot
            </Button>
          </div>
          {senasteJusteringar.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5 border-t border-border-subtle pt-3">
              {senasteJusteringar.map((j) => (
                <li key={j.id} className="flex items-center justify-between gap-2 text-xs text-stone-500">
                  <span className="truncate">
                    {kortDatum(j.vecka)}
                    {j.kommentar ? ` · ${j.kommentar}` : ''}
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <span className="font-medium text-stone-600 dark:text-stone-300">
                      {formatTimmar(j.justering_timmar)} h
                    </span>
                    <DeleteIconButton label="Ta bort justeringen" onClick={() => setTaBortJustering(j)} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

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
        <div className="flex items-center gap-2">
          {aktivaModuler.length > 1 && (
            <Select
              aria-label="Filtrera modul"
              value={valdModul}
              onChange={(e) => router.push(`/rapporter/flexel?vecka=${vecka}&modul=${e.target.value}`)}
              className="w-auto"
            >
              <option value="alla">Alla moduler</option>
              {aktivaModuler.map((m) => (
                <option key={m.modul} value={m.modul}>
                  {m.label}
                </option>
              ))}
            </Select>
          )}
          <Button variant="primary" onClick={() => setNyRad(true)}>
            Lägg till rad
          </Button>
        </div>
      </div>

      <p className="text-sm text-stone-500">{veckoetikett}</p>

      {poster.length === 0 ? (
        <EmptyState title="Inga rader den här veckan" />
      ) : (
        <ul className="divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-subtle bg-surface">
          {poster.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => setRedigerar(p)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-stone-50 dark:hover:bg-stone-800"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.motivering}</span>
                  <span className="block text-xs text-stone-400">
                    {modulLabel[p.modul]} · {kortDatum(p.datum)}
                  </span>
                </span>
                <span
                  className={`shrink-0 text-sm font-medium ${
                    p.timmar < 0 ? 'text-red-600 dark:text-red-400' : 'text-accent-700 dark:text-accent-300'
                  }`}
                >
                  {formatTimmar(p.timmar)} h
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {(nyRad || redigerar) && (
        <FlexelPostFormular
          existing={redigerar}
          aktivaModuler={aktivaModuler}
          onClose={() => {
            setNyRad(false)
            setRedigerar(null)
          }}
        />
      )}
      {visaJustering && <KvotjusteringFormular vecka={vecka} onClose={() => setVisaJustering(false)} />}
      {taBortJustering && (
        <ConfirmDialog
          title="Ta bort justeringen?"
          loading={tarBortJustering}
          onConfirm={handleTaBortJustering}
          onCancel={() => setTaBortJustering(null)}
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
  aktivaModuler,
  onClose,
}: {
  existing: Post | null
  aktivaModuler: AktivModul[]
  onClose: () => void
}) {
  const [datum, setDatum] = useState(existing?.datum ?? todayLocalISO())
  const [timmar, setTimmar] = useState(existing ? String(existing.timmar) : '')
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

function KvotjusteringFormular({ vecka, onClose }: { vecka: string; onClose: () => void }) {
  const [justering, setJustering] = useState('')
  const [kommentar, setKommentar] = useState('')
  const [sparar, setSparar] = useState(false)
  const [fel, setFel] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const tal = Number(justering.replace(',', '.'))
    setSparar(true)
    setFel(null)

    const { error } = await skapaKvotjustering({ vecka, justeringTimmar: tal, kommentar })

    setSparar(false)
    if (error) {
      setFel(error)
      return
    }
    onClose()
  }

  return (
    <Modal onClose={onClose} labelledBy="kvotjustering-title">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <h2 id="kvotjustering-title" className="text-lg font-semibold">
          Justera veckans kvot
        </h2>
        <Field label="Justering, timmar (t.ex. -8 vid semestervecka)" htmlFor="kvotjustering-timmar">
          <Input
            id="kvotjustering-timmar"
            type="number"
            step="0.5"
            value={justering}
            onChange={(e) => setJustering(e.target.value)}
            required
            autoFocus
          />
        </Field>
        <Field label="Kommentar" htmlFor="kvotjustering-kommentar">
          <Input
            id="kvotjustering-kommentar"
            value={kommentar}
            onChange={(e) => setKommentar(e.target.value)}
            placeholder="T.ex. Semester"
          />
        </Field>
        {fel && <p className="text-sm text-red-600">{fel}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Avbryt
          </Button>
          <Button type="submit" variant="primary" loading={sparar} disabled={!justering}>
            Spara
          </Button>
        </div>
      </form>
    </Modal>
  )
}
