'use client'

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  skapaUppgift,
  skapaUppgiftSerie,
  uppdateraUppgift,
  taBortUppgift,
  uppdateraSerie,
  avslutaSerie,
  taBortSerie,
  taBortSerieMedUppgifter,
  raknaSerieUppgifter,
} from './actions'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DeleteIconButton } from '@/components/ui/delete-icon-button'
import { Field } from '@/components/ui/field'
import { Input, Select } from '@/components/ui/input'
import { MarkdownEditor } from '@/components/ui/markdown-editor'
import { VeckodagValjare } from './veckodag-valjare'
import { KundValjare } from './kund-valjare'
import { DeltagareValjare } from './deltagare-valjare'
import { MotesanteckningarSektion } from './motesanteckningar-sektion'
import { ProjektAnteckningarSektion } from '../projekt/projekt-anteckningar-sektion'
import { TidigareMotenSektion } from './tidigare-moten-sektion'
import { KopplaPlaceholderSektion } from './koppla-placeholder-sektion'

export type Person = { id: string; namn: string }
export type Kund = { id: string; namn: string }
export type Typ = {
  id: string
  namn: string
  anteckningsmall_id: string | null
}
export type Kategori = { id: string; namn: string }
export type Projekt = {
  id: string
  namn: string
  kund_id: string | null
  farg: string | null
  mallProjektKategoriId: string | null
  mallProjektAnteckningsmallId: string | null
  projektAnteckningar: { block_id: string; innehall: string }[]
}
export type Anteckningsblock = {
  id: string
  namn: string
  beskrivning: string | null
  anteckningsmall_id: string
}
export type UppgiftAnteckning = {
  block_id: string
  innehall: string
  uppgift_id_genererad: string | null
  genererad: { titel: string; deadline: string | null }[] | null
}
export type OppenPlaceholder = {
  id: string
  titel: string
  deadline: string | null
  projekt_id: string | null
  typ_id: string | null
}
export type Uppgift = {
  id: string
  titel: string
  beskrivning: string | null
  status: string
  prioritet: string
  deadline: string | null
  person_id: string | null
  kund_id: string | null
  typ_id: string | null
  kategori_id: string | null
  projekt_id: string | null
  serie_id: string | null
  sortordning: number
  tidsatgang_timmar: number | null
  klockslag: string | null
  ar_placeholder: boolean
  anteckningsmall_id: string | null
  utan_anteckningsmall: boolean
  uppgift_deltagare: { kontaktperson_id: string }[]
  uppgift_anteckning: UppgiftAnteckning[]
}
export type Kontaktperson = {
  id: string
  kund_id: string
  fornamn: string | null
  efternamn: string | null
  epost: string | null
}
export type Serie = {
  id: string
  titel: string
  beskrivning: string | null
  person_id: string | null
  kund_id: string | null
  typ_id: string | null
  kategori_id: string | null
  prioritet: string
  start_datum: string
  veckodagar: number[]
  intervall_veckor: number
  slut_datum: string | null
  tidsatgang_timmar: number | null
  klockslag: string | null
  outlook_series_id: string | null
  synk_fran_datum: string | null
}
export type OutlookSerie = { outlookSeriesId: string; label: string }

// Startdatum är irrelevant för en Outlook-kopplad serie (Outlook äger datumen),
// men kolumnen är NOT NULL — dagens datum duger som platshållare.
function todayISO() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export const PRIORITET_PILLS = [
  { value: 'lag', label: 'Låg' },
  { value: 'medel', label: 'Medel' },
  { value: 'hog', label: 'Hög' },
]

export const STATUS_PILLS = [
  { value: 'oppen', label: 'Öppen' },
  { value: 'pagar', label: 'Pågår' },
  { value: 'vantar', label: 'Väntar' },
  { value: 'klar', label: 'Klar' },
]

export function FormularSektion({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-t border-border-subtle pt-3">
      {label && <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">{label}</p>}
      {children}
    </div>
  )
}

export function PillGrupp({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-stone-700 dark:text-stone-300">{label}</span>
      <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={opt.value === value}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              opt.value === value
                ? 'border-accent-500 bg-accent-50 text-accent-700 dark:bg-accent-950 dark:text-accent-300'
                : 'border-border-subtle text-stone-500 hover:bg-stone-50 dark:text-stone-400 dark:hover:bg-stone-800'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function AnsvarigAvatar({
  personer,
  value,
  onChange,
}: {
  personer: Person[]
  value: string
  onChange: (id: string) => void
}) {
  const [oppen, setOppen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOppen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const vald = personer.find((p) => p.id === value)
  const initialer = vald
    ? vald.namn
        .split(/\s+/)
        .filter(Boolean)
        .map((d) => d[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : '?'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOppen((o) => !o)}
        title={vald ? `Ansvarig: ${vald.namn}` : 'Ingen ansvarig'}
        aria-label={vald ? `Byt ansvarig, nuvarande ${vald.namn}` : 'Välj ansvarig'}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-50 text-xs font-semibold text-accent-700 hover:ring-2 hover:ring-accent-500/40 dark:bg-accent-950 dark:text-accent-300"
      >
        {initialer}
      </button>
      {oppen && (
        <div className="absolute right-0 z-10 mt-1 w-44 overflow-hidden rounded-lg border border-border-subtle bg-surface py-1 shadow-lg">
          <button
            type="button"
            onClick={() => {
              onChange('')
              setOppen(false)
            }}
            className="block w-full px-3 py-2 text-left text-sm hover:bg-stone-50 dark:hover:bg-stone-800"
          >
            Ingen
          </button>
          {personer.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onChange(p.id)
                setOppen(false)
              }}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-stone-50 dark:hover:bg-stone-800 ${
                p.id === value ? 'font-medium text-accent-700 dark:text-accent-300' : ''
              }`}
            >
              {p.namn}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function UppgiftFormular({
  existing,
  existingSerie = null,
  placeholders,
  personer,
  kunder,
  typer,
  kategori,
  projekt,
  serier,
  kontaktpersoner,
  block,
  currentPersonId,
  initialDeadline,
  serieLage = false,
  outlookSerier,
  onEditSerie,
  onClose,
  onChanged,
}: {
  existing: Uppgift | null
  existingSerie?: Serie | null
  placeholders: OppenPlaceholder[]
  personer: Person[]
  kunder: Kund[]
  typer: Typ[]
  kategori: Kategori[]
  projekt: Projekt[]
  serier: Serie[]
  kontaktpersoner: Kontaktperson[]
  block: Anteckningsblock[]
  currentPersonId: string | null
  initialDeadline: string | null
  serieLage?: boolean
  outlookSerier?: OutlookSerie[]
  onEditSerie: (serieId: string) => void
  onClose: () => void
  onChanged?: () => void
}) {
  const serieModus = serieLage || !!existingSerie

  const [titel, setTitel] = useState(existingSerie?.titel ?? existing?.titel ?? '')
  const [beskrivning, setBeskrivning] = useState(existingSerie?.beskrivning ?? existing?.beskrivning ?? '')
  const [personId, setPersonId] = useState(
    existingSerie?.person_id ?? existing?.person_id ?? currentPersonId ?? ''
  )
  const [kundId, setKundId] = useState(existingSerie?.kund_id ?? existing?.kund_id ?? '')
  const [typId, setTypId] = useState(existingSerie?.typ_id ?? existing?.typ_id ?? '')
  const [deltagareIds, setDeltagareIds] = useState<string[]>(
    existing?.uppgift_deltagare.map((d) => d.kontaktperson_id) ?? []
  )
  const [kategoriId, setKategoriId] = useState(existingSerie?.kategori_id ?? existing?.kategori_id ?? '')
  const [projektId, setProjektId] = useState(existing?.projekt_id ?? '')
  const [prioritet, setPrioritet] = useState(existingSerie?.prioritet ?? existing?.prioritet ?? 'lag')
  const [deadline, setDeadline] = useState(
    existingSerie?.start_datum ?? existing?.deadline ?? initialDeadline ?? ''
  )
  const [status, setStatus] = useState(existing?.status ?? 'oppen')
  const [tidsatgang, setTidsatgang] = useState(
    (existingSerie?.tidsatgang_timmar ?? existing?.tidsatgang_timmar)?.toString() ?? ''
  )
  const [klockslag, setKlockslag] = useState(
    (existingSerie?.klockslag ?? existing?.klockslag)?.slice(0, 5) ?? ''
  )
  // Sätts aldrig manuellt här — placeholders skapas via Uppgiftsmallar och ärvs vid
  // projektgenerering. Behålls oförändrat vid spara; styr bara om
  // "Koppla till placeholder" ska visas nedan.
  const arPlaceholder = existing?.ar_placeholder ?? false
  const [veckodagar, setVeckodagar] = useState<number[]>(existingSerie?.veckodagar ?? [])
  const [intervallVeckor, setIntervallVeckor] = useState(existingSerie?.intervall_veckor ?? 1)
  const [slutDatum, setSlutDatum] = useState(existingSerie?.slut_datum ?? '')
  const [valtOutlookSeriesId, setValtOutlookSeriesId] = useState('')
  // Kopplingen sätts bara vid skapande — en redan kopplad serie visas som
  // låst (den byter aldrig Outlook-serie i efterhand, bara kategori/typ).
  const outlookKopplad = existingSerie ? !!existingSerie.outlook_series_id : !!valtOutlookSeriesId
  const [synkFranDatum, setSynkFranDatum] = useState(existingSerie?.synk_fran_datum ?? '')
  const [sparar, setSparar] = useState(false)
  const [visaBekraftelse, setVisaBekraftelse] = useState(false)
  const [tarBort, setTarBort] = useState(false)
  const [visaAvslutaSerie, setVisaAvslutaSerie] = useState(false)
  const [visaTaBortSerie, setVisaTaBortSerie] = useState<'kopplaLoss' | 'medUppgifter' | null>(null)
  const [antalSerieUppgifter, setAntalSerieUppgifter] = useState<number | null>(null)
  const [serieArbetar, setSerieArbetar] = useState(false)
  // Buffrade mötesanteckningar för en uppgift som ännu inte finns i databasen —
  // skickas med i skapaUppgift och sparas i samma åtgärd som uppgiften skapas.
  const [nyaAnteckningar, setNyaAnteckningar] = useState<Record<string, string>>({})

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!titel.trim()) return
    if (serieModus && !outlookKopplad && (!deadline || veckodagar.length === 0)) return
    setSparar(true)

    const tidsatgangTimmar = tidsatgang.trim() ? Number(tidsatgang) : null
    const klockslagVarde = klockslag || null

    if (existingSerie) {
      await uppdateraSerie(existingSerie.id, {
        titel: titel.trim(),
        beskrivning,
        personId,
        kundId,
        typId,
        kategoriId,
        prioritet,
        startDatum: deadline,
        veckodagar,
        intervallVeckor,
        slutDatum: slutDatum || null,
        tidsatgangTimmar,
        klockslag: klockslagVarde,
        synkFranDatum: synkFranDatum || null,
      })
    } else if (serieLage) {
      await skapaUppgiftSerie({
        titel: titel.trim(),
        beskrivning,
        personId,
        kundId,
        typId,
        kategoriId,
        prioritet,
        startDatum: outlookKopplad ? deadline || todayISO() : deadline,
        veckodagar,
        intervallVeckor,
        slutDatum: slutDatum || null,
        tidsatgangTimmar,
        klockslag: klockslagVarde,
        outlookSeriesId: valtOutlookSeriesId || null,
        synkFranDatum: synkFranDatum || null,
      })
    } else if (existing) {
      await uppdateraUppgift(existing.id, {
        titel: titel.trim(),
        beskrivning,
        personId,
        kundId,
        typId,
        kategoriId,
        projektId,
        prioritet,
        deadline: deadline || null,
        status,
        tidsatgangTimmar,
        klockslag: klockslagVarde,
        deltagareIds,
        arPlaceholder,
      })
    } else {
      await skapaUppgift({
        titel: titel.trim(),
        beskrivning,
        personId,
        kundId,
        typId,
        kategoriId,
        projektId,
        prioritet,
        deadline: deadline || null,
        status,
        tidsatgangTimmar,
        klockslag: klockslagVarde,
        deltagareIds,
        arPlaceholder,
        anteckningar: Object.entries(nyaAnteckningar)
          .filter(([, innehall]) => innehall.trim())
          .map(([blockId, innehall]) => ({ blockId, innehall })),
      })
    }

    setSparar(false)
    await onChanged?.()
    onClose()
  }

  async function handleTaBort() {
    if (!existing) return
    setTarBort(true)
    await taBortUppgift(existing.id)
    setTarBort(false)
    await onChanged?.()
    onClose()
  }

  async function handleAvslutaSerie() {
    if (!existingSerie) return
    setSerieArbetar(true)
    await avslutaSerie(existingSerie.id)
    setSerieArbetar(false)
    onClose()
  }

  async function handleTaBortSerie() {
    if (!existingSerie || !visaTaBortSerie) return
    setSerieArbetar(true)
    if (visaTaBortSerie === 'medUppgifter') {
      await taBortSerieMedUppgifter(existingSerie.id)
    } else {
      await taBortSerie(existingSerie.id)
    }
    setSerieArbetar(false)
    onClose()
  }

  async function handleVisaTaBortSerieMedUppgifter() {
    if (!existingSerie) return
    const antal = await raknaSerieUppgifter(existingSerie.id)
    setAntalSerieUppgifter(antal)
    setVisaTaBortSerie('medUppgifter')
  }

  if (visaBekraftelse && existing) {
    return (
      <ConfirmDialog
        title={`Ta bort uppgiften "${existing.titel}"?`}
        loading={tarBort}
        onConfirm={handleTaBort}
        onCancel={() => setVisaBekraftelse(false)}
      />
    )
  }

  if (visaAvslutaSerie && existingSerie) {
    return (
      <ConfirmDialog
        title={`Avsluta serien "${existingSerie.titel}"?`}
        description="Inga fler förekomster genereras efter idag. Redan skapade uppgifter påverkas inte."
        confirmLabel="Avsluta serien"
        loading={serieArbetar}
        onConfirm={handleAvslutaSerie}
        onCancel={() => setVisaAvslutaSerie(false)}
      />
    )
  }

  if (visaTaBortSerie && existingSerie) {
    const medUppgifter = visaTaBortSerie === 'medUppgifter'
    return (
      <ConfirmDialog
        title={
          medUppgifter
            ? `Ta bort serien "${existingSerie.titel}" och alla dess uppgifter?`
            : `Ta bort serien "${existingSerie.titel}"?`
        }
        description={
          medUppgifter
            ? `Detta raderar även alla ${antalSerieUppgifter ?? 0} uppgifter som skapats av serien. Går inte att ångra.`
            : 'Själva serien tas bort, men uppgifter som redan skapats av den finns kvar som vanliga uppgifter.'
        }
        confirmLabel="Ta bort"
        loading={serieArbetar}
        onConfirm={handleTaBortSerie}
        onCancel={() => setVisaTaBortSerie(null)}
      />
    )
  }

  // Uppgiftens egen anteckningsmall (satt vid projektgenerering) går före
  // typens standard — men går aldrig att byta här, bara i Projektmallar.
  const valdTyp = typer.find((t) => t.id === typId)
  const effektivMallId = existing?.utan_anteckningsmall
    ? null
    : (existing?.anteckningsmall_id ?? valdTyp?.anteckningsmall_id ?? null)
  const mallBlock = block.filter((b) => b.anteckningsmall_id === effektivMallId)
  const valtProjekt = projekt.find((p) => p.id === projektId)
  const projektAnteckningsmallId = valtProjekt?.mallProjektAnteckningsmallId ?? null
  const projektMallBlock = block.filter((b) => b.anteckningsmall_id === projektAnteckningsmallId)

  return (
    <Modal onClose={onClose} labelledBy="uppgift-formular-title">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="uppgift-formular-title" className="text-lg font-semibold">
            {existing ? 'Redigera uppgift' : existingSerie ? 'Redigera serie' : serieLage ? 'Ny serie' : 'Ny uppgift'}
          </h2>
          <div className="flex shrink-0 items-center gap-1.5">
            <AnsvarigAvatar personer={personer} value={personId ?? ''} onChange={setPersonId} />
            {existing && (
              <DeleteIconButton
                label={`Ta bort uppgiften "${existing.titel}"`}
                onClick={() => setVisaBekraftelse(true)}
              />
            )}
            {existingSerie && (
              <DeleteIconButton
                label={`Ta bort serien "${existingSerie.titel}"`}
                onClick={() => setVisaTaBortSerie('kopplaLoss')}
              />
            )}
          </div>
        </div>

        {existing?.serie_id && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-stone-50 px-3 py-2 text-xs text-stone-500 dark:bg-stone-800">
            <span>
              Del av serien &quot;{serier.find((s) => s.id === existing.serie_id)?.titel ?? ''}&quot;. Ändringar här
              gäller bara den här uppgiften.
            </span>
            <button
              type="button"
              onClick={() => {
                const serieId = existing.serie_id
                onClose()
                if (serieId) onEditSerie(serieId)
              }}
              className="shrink-0 font-medium text-orange-600 hover:underline dark:text-orange-400"
            >
              Redigera serie
            </button>
          </div>
        )}

        <Field label="Titel" htmlFor="uppgift-titel">
          <Input
            id="uppgift-titel"
            value={titel}
            onChange={(e) => setTitel(e.target.value)}
            required
            autoFocus
          />
        </Field>

        <Field label="Beskrivning" htmlFor="uppgift-beskrivning">
          <MarkdownEditor id="uppgift-beskrivning" value={beskrivning ?? ''} onChange={setBeskrivning} />
        </Field>

        <FormularSektion label="Kund">
          <Field label="Kund" htmlFor="uppgift-kund">
            <KundValjare id="uppgift-kund" kunder={kunder} value={kundId ?? ''} onChange={setKundId} />
          </Field>

          {!serieModus && (
            <Field label="Projekt" htmlFor="uppgift-projekt">
              <Select
                id="uppgift-projekt"
                value={projektId ?? ''}
                onChange={(e) => {
                  const valtProjektId = e.target.value
                  setProjektId(valtProjektId)
                  // Förvälj kategori från projektets mall — men bara om fältet fortfarande
                  // är tomt, så ett redan gjort kategorival aldrig skrivs över.
                  if (!kategoriId) {
                    const valtProjekt = projekt.find((p) => p.id === valtProjektId)
                    if (valtProjekt?.mallProjektKategoriId) setKategoriId(valtProjekt.mallProjektKategoriId)
                  }
                }}
              >
                <option value="">Inget</option>
                {projekt
                  .filter((p) => !kundId || !p.kund_id || p.kund_id === kundId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.namn}
                    </option>
                  ))}
              </Select>
            </Field>
          )}

          {!serieModus &&
            kundId &&
            ['Möte', 'Maildialog'].includes(typer.find((t) => t.id === typId)?.namn ?? '') && (
              <Field label="Deltagare" htmlFor="uppgift-deltagare">
                <DeltagareValjare
                  kontaktpersoner={kontaktpersoner}
                  kundId={kundId}
                  value={deltagareIds}
                  onChange={setDeltagareIds}
                />
              </Field>
            )}
        </FormularSektion>

        <FormularSektion label="Kategorisering">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Typ" htmlFor="uppgift-typ">
              <Select id="uppgift-typ" value={typId ?? ''} onChange={(e) => setTypId(e.target.value)}>
                <option value="">Ingen</option>
                {typer.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.namn}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Kategori" htmlFor="uppgift-kategori">
              <Select
                id="uppgift-kategori"
                value={kategoriId ?? ''}
                onChange={(e) => setKategoriId(e.target.value)}
              >
                <option value="">Ingen</option>
                {kategori.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.namn}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <PillGrupp label="Prioritet" value={prioritet} onChange={setPrioritet} options={PRIORITET_PILLS} />
          {!serieModus && (
            <PillGrupp label="Status" value={status} onChange={setStatus} options={STATUS_PILLS} />
          )}
        </FormularSektion>

        {existing && !arPlaceholder && projektId && (
          <KopplaPlaceholderSektion
            uppgiftId={existing.id}
            projektId={projektId}
            typId={typId}
            placeholders={placeholders}
            onLinked={onClose}
          />
        )}

        {((serieLage && !existingSerie && outlookSerier && outlookSerier.length > 0) ||
          existingSerie?.outlook_series_id) && (
          <FormularSektion label="Outlook-koppling">
            {serieLage && !existingSerie && outlookSerier && outlookSerier.length > 0 && (
              <Field label="Koppla mot Outlook-serie" htmlFor="serie-outlook">
                <Select
                  id="serie-outlook"
                  value={valtOutlookSeriesId}
                  onChange={(e) => setValtOutlookSeriesId(e.target.value)}
                >
                  <option value="">Ingen koppling (vanlig serie)</option>
                  {outlookSerier.map((o) => (
                    <option key={o.outlookSeriesId} value={o.outlookSeriesId}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            {existingSerie?.outlook_series_id && (
              <p className="text-xs text-stone-400">Kopplad till en Outlook-serie.</p>
            )}

            {outlookKopplad && (
              <>
                <p className="text-xs text-stone-400">
                  Outlook äger datum, tid och titel för de här mötena — bara kategori och typ nedan
                  tillämpas, på alla befintliga och framtida förekomster.
                </p>
                <Field label="Synka från datum" htmlFor="serie-synk-fran">
                  <Input
                    type="date"
                    id="serie-synk-fran"
                    value={synkFranDatum}
                    onChange={(e) => setSynkFranDatum(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-stone-400">
                    Förekomster äldre än detta datum raderas direkt och skapas aldrig igen av
                    Outlook-synken. Lämna tomt för ingen gräns.
                  </p>
                </Field>
              </>
            )}
          </FormularSektion>
        )}

        {!outlookKopplad && (
          <FormularSektion label="Tid">
            <div className="grid grid-cols-2 gap-3">
              <Field label={serieModus ? 'Startdatum' : 'Dag'} htmlFor="uppgift-deadline">
                <Input
                  type="date"
                  id="uppgift-deadline"
                  value={deadline ?? ''}
                  onChange={(e) => setDeadline(e.target.value)}
                  required={serieModus}
                />
              </Field>

              <Field
                label="Klockslag"
                htmlFor="uppgift-klockslag"
              >
                <Input
                  type="time"
                  id="uppgift-klockslag"
                  value={klockslag}
                  onChange={(e) => setKlockslag(e.target.value)}
                />
              </Field>
            </div>

            <Field
              label={serieModus ? 'Tidsåtgång (standard för serien)' : 'Tidsåtgång (timmar)'}
              htmlFor="uppgift-tidsatgang"
            >
              <Input
                type="number"
                id="uppgift-tidsatgang"
                min={0}
                step={0.5}
                value={tidsatgang}
                onChange={(e) => setTidsatgang(e.target.value)}
                placeholder="T.ex. 0.5"
              />
            </Field>
          </FormularSektion>
        )}

        {serieModus && !outlookKopplad && (
          <FormularSektion label="Upprepning">
            <Field label="Upprepa på" htmlFor="serie-veckodagar">
              <VeckodagValjare value={veckodagar} onChange={setVeckodagar} />
            </Field>

            <Field label="Upprepa var" htmlFor="serie-intervall">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  id="serie-intervall"
                  min={1}
                  value={intervallVeckor}
                  onChange={(e) => setIntervallVeckor(Math.max(1, Number(e.target.value)))}
                  className="w-16"
                />
                <span className="text-sm text-stone-500">vecka</span>
              </div>
            </Field>

            <Field label="Pågår till" htmlFor="serie-slutdatum">
              <Input
                type="date"
                id="serie-slutdatum"
                value={slutDatum}
                min={deadline || undefined}
                onChange={(e) => setSlutDatum(e.target.value)}
              />
            </Field>
          </FormularSektion>
        )}

        {existingSerie && (
          <button
            type="button"
            onClick={handleVisaTaBortSerieMedUppgifter}
            className="self-start text-xs font-medium text-red-600 hover:underline dark:text-red-400"
          >
            Ta bort serien och alla uppgifter
          </button>
        )}

        {effektivMallId && !serieModus && (
          <FormularSektion label="Mötesanteckningar">
            <MotesanteckningarSektion
              uppgiftId={existing?.id ?? null}
              blocks={mallBlock}
              initialAnteckningar={existing?.uppgift_anteckning ?? []}
              onLocalChange={
                existing
                  ? undefined
                  : (blockId, innehall) =>
                      setNyaAnteckningar((bas) => ({ ...bas, [blockId]: innehall }))
              }
            />
          </FormularSektion>
        )}

        {existing?.id && projektId && projektAnteckningsmallId && (
          <FormularSektion label="Projektanteckningar">
            <ProjektAnteckningarSektion
              projektId={projektId}
              blocks={projektMallBlock}
              initialAnteckningar={valtProjekt?.projektAnteckningar ?? []}
            />
          </FormularSektion>
        )}

        {existing?.id && effektivMallId && kundId && (
          <FormularSektion label="Tidigare möten">
            <TidigareMotenSektion
              kundId={kundId}
              excludeUppgiftId={existing.id}
              kundNamn={kunder.find((k) => k.id === kundId)?.namn ?? ''}
            />
          </FormularSektion>
        )}

        {existingSerie ? (
          <div className="mt-1 flex items-center justify-between gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setVisaAvslutaSerie(true)}>
              Avsluta serien
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>
                Avbryt
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={sparar}
                disabled={!titel.trim() || (!outlookKopplad && (!deadline || veckodagar.length === 0))}
              >
                Spara
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Avbryt
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={sparar}
              disabled={
                !titel.trim() || (serieLage && !outlookKopplad && (!deadline || veckodagar.length === 0))
              }
            >
              {existing ? 'Spara' : serieLage ? 'Skapa serie' : 'Skapa'}
            </Button>
          </div>
        )}
      </form>
    </Modal>
  )
}
