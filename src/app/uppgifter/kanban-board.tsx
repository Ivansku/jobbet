'use client'

import { useState, useTransition } from 'react'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  skapaUppgift,
  skapaUppgiftSerie,
  uppdateraUppgift,
  flyttaUppgift,
  uppdateraStatus,
  taBortUppgift,
} from './actions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Field } from '@/components/ui/field'
import { Input, Textarea, Select } from '@/components/ui/input'
import { VeckodagValjare } from './veckodag-valjare'
import { SerieVy } from './serie-vy'

type Person = { id: string; namn: string }
type Kund = { id: string; namn: string }
type Typ = { id: string; namn: string }
type Uppgift = {
  id: string
  titel: string
  beskrivning: string | null
  status: string
  prioritet: string
  deadline: string | null
  person_id: string | null
  kund_id: string | null
  typ_id: string | null
}
type Serie = {
  id: string
  titel: string
  beskrivning: string | null
  person_id: string | null
  kund_id: string | null
  typ_id: string | null
  prioritet: string
  veckodagar: number[]
  intervall_veckor: number
  slut_datum: string | null
}
type Kolumn = { key: string; label: string; datum: string | null }

const VECKODAGAR = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag']

const PRIORITET_META: Record<
  string,
  { label: string; tone: 'neutral' | 'warning' | 'danger'; border: string }
> = {
  lag: { label: 'Låg', tone: 'neutral', border: 'border-l-stone-300 dark:border-l-stone-600' },
  medel: { label: 'Medel', tone: 'warning', border: 'border-l-amber-400 dark:border-l-amber-500' },
  hog: { label: 'Hög', tone: 'danger', border: 'border-l-red-400 dark:border-l-red-500' },
}

function kortDatum(iso: string) {
  const [, m, d] = iso.split('-')
  return `${parseInt(d, 10)}/${parseInt(m, 10)}`
}

export function KanbanBoard({
  weekDates,
  today,
  uppgifter,
  personer,
  kunder,
  typer,
  serier,
  currentPersonId,
  prevVeckaHref,
  nextVeckaHref,
  idagHref,
}: {
  weekDates: string[]
  today: string
  uppgifter: Uppgift[]
  personer: Person[]
  kunder: Kund[]
  typer: Typ[]
  serier: Serie[]
  currentPersonId: string | null
  prevVeckaHref: string
  nextVeckaHref: string
  idagHref: string
}) {
  const [, startTransition] = useTransition()
  const [redigerar, setRedigerar] = useState<Uppgift | 'ny' | null>(null)
  const [aktivId, setAktivId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  )

  const personMap = new Map(personer.map((p) => [p.id, p.namn]))
  const kundMap = new Map(kunder.map((k) => [k.id, k.namn]))
  const typMap = new Map(typer.map((t) => [t.id, t.namn]))
  const weekDateSet = new Set(weekDates)

  const kolumner: Kolumn[] = [
    { key: 'oplanerad', label: 'Oplanerad', datum: null },
    ...weekDates.map((datum, i) => ({ key: datum, label: VECKODAGAR[i], datum })),
  ]

  const aktivUppgift = aktivId ? (uppgifter.find((u) => u.id === aktivId) ?? null) : null

  function handleDragStart(event: DragStartEvent) {
    setAktivId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setAktivId(null)
    const { active, over } = event
    if (!over) return
    const kolumn = kolumner.find((k) => k.key === over.id)
    if (!kolumn) return
    startTransition(() => {
      flyttaUppgift(String(active.id), kolumn.datum)
    })
  }

  function toggleStatus(u: Uppgift) {
    startTransition(() => {
      uppdateraStatus(u.id, u.status === 'klar' ? 'oppen' : 'klar')
    })
  }

  return (
    <DndContext
      id="uppgifter-kanban"
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <a
              href={prevVeckaHref}
              className="inline-flex items-center justify-center rounded-lg border border-stone-300 bg-surface px-3 py-1.5 text-sm font-medium shadow-sm transition-colors hover:border-stone-400 hover:bg-stone-100 dark:border-stone-600 dark:hover:bg-stone-800"
            >
              ← Föregående
            </a>
            <a
              href={idagHref}
              className="inline-flex items-center justify-center rounded-lg border border-stone-300 bg-surface px-3 py-1.5 text-sm font-medium shadow-sm transition-colors hover:border-stone-400 hover:bg-stone-100 dark:border-stone-600 dark:hover:bg-stone-800"
            >
              Denna vecka
            </a>
            <a
              href={nextVeckaHref}
              className="inline-flex items-center justify-center rounded-lg border border-stone-300 bg-surface px-3 py-1.5 text-sm font-medium shadow-sm transition-colors hover:border-stone-400 hover:bg-stone-100 dark:border-stone-600 dark:hover:bg-stone-800"
            >
              Nästa →
            </a>
          </div>
          <div className="flex gap-2">
            <SerieVy serier={serier} personer={personer} kunder={kunder} typer={typer} />
            <Button variant="primary" onClick={() => setRedigerar('ny')}>
              Ny uppgift
            </Button>
          </div>
        </div>

        <div className="grid grid-flow-col auto-cols-[85%] gap-4 overflow-x-auto pb-2 snap-x snap-mandatory sm:auto-cols-[280px] md:grid-flow-row md:auto-cols-auto md:grid-cols-6 md:overflow-visible">
          {kolumner.map((kol) => (
            <KanbanColumn
              key={kol.key}
              kol={kol}
              today={today}
              uppgifter={uppgifter.filter((u) =>
                kol.datum === null ? !u.deadline || !weekDateSet.has(u.deadline) : u.deadline === kol.datum
              )}
              personMap={personMap}
              kundMap={kundMap}
              typMap={typMap}
              onSelect={setRedigerar}
              onToggleStatus={toggleStatus}
            />
          ))}
        </div>
      </div>

      <DragOverlay>
        {aktivUppgift ? (
          <div
            className={`rounded-xl border border-border-subtle border-l-4 bg-surface p-3 shadow-lg ${
              (PRIORITET_META[aktivUppgift.prioritet] ?? PRIORITET_META.medel).border
            }`}
          >
            <p className="text-sm font-medium break-words text-foreground">{aktivUppgift.titel}</p>
            <KortBadges
              uppgift={aktivUppgift}
              today={today}
              personMap={personMap}
              kundMap={kundMap}
              typMap={typMap}
            />
          </div>
        ) : null}
      </DragOverlay>

      {redigerar && (
        <UppgiftFormular
          existing={redigerar === 'ny' ? null : redigerar}
          personer={personer}
          kunder={kunder}
          typer={typer}
          currentPersonId={currentPersonId}
          onClose={() => setRedigerar(null)}
        />
      )}
    </DndContext>
  )
}

function KanbanColumn({
  kol,
  today,
  uppgifter,
  personMap,
  kundMap,
  typMap,
  onSelect,
  onToggleStatus,
}: {
  kol: Kolumn
  today: string
  uppgifter: Uppgift[]
  personMap: Map<string, string>
  kundMap: Map<string, string>
  typMap: Map<string, string>
  onSelect: (u: Uppgift) => void
  onToggleStatus: (u: Uppgift) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: kol.key })
  const arIdag = kol.datum === today

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[220px] snap-start flex-col gap-2 rounded-xl border p-3 transition-colors ${
        isOver
          ? 'border-accent-400 bg-accent-50 dark:bg-accent-950/40'
          : 'border-border-subtle bg-white dark:bg-stone-800/60'
      }`}
    >
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-stone-500">
        {kol.label}
        {kol.datum && <span className="font-normal text-stone-400">{kortDatum(kol.datum)}</span>}
        {arIdag && <span className="h-1.5 w-1.5 rounded-full bg-accent-600" aria-label="Idag" />}
      </h2>

      <div className="flex max-h-[65vh] flex-col gap-2 overflow-y-auto">
        {uppgifter.length === 0 ? (
          <p className="py-4 text-center text-xs text-stone-400">Inga uppgifter</p>
        ) : (
          uppgifter.map((u) => (
            <KanbanCard
              key={u.id}
              uppgift={u}
              today={today}
              personMap={personMap}
              kundMap={kundMap}
              typMap={typMap}
              onSelect={onSelect}
              onToggleStatus={onToggleStatus}
            />
          ))
        )}
      </div>
    </div>
  )
}

function KanbanCard({
  uppgift: u,
  today,
  personMap,
  kundMap,
  typMap,
  onSelect,
  onToggleStatus,
}: {
  uppgift: Uppgift
  today: string
  personMap: Map<string, string>
  kundMap: Map<string, string>
  typMap: Map<string, string>
  onSelect: (u: Uppgift) => void
  onToggleStatus: (u: Uppgift) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: u.id })
  const meta = PRIORITET_META[u.prioritet] ?? PRIORITET_META.medel
  const klar = u.status === 'klar'

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onSelect(u)}
      className={`cursor-pointer rounded-xl border border-border-subtle border-l-4 bg-surface p-3 shadow-sm transition-shadow hover:shadow-md ${meta.border} ${
        klar ? 'opacity-60' : ''
      } ${isDragging ? 'opacity-30' : ''}`}
    >
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <p className={`text-sm font-medium break-words text-foreground ${klar ? 'line-through' : ''}`}>
          {u.titel}
        </p>
        <input
          type="checkbox"
          checked={klar}
          aria-label={klar ? 'Markera som ej klar' : 'Markera som klar'}
          className="mt-0.5 h-4 w-4 shrink-0 accent-success-600"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onChange={() => onToggleStatus(u)}
        />
      </div>
      <KortBadges uppgift={u} today={today} personMap={personMap} kundMap={kundMap} typMap={typMap} />
    </div>
  )
}

function KortBadges({
  uppgift: u,
  today,
  personMap,
  kundMap,
  typMap,
}: {
  uppgift: Uppgift
  today: string
  personMap: Map<string, string>
  kundMap: Map<string, string>
  typMap: Map<string, string>
}) {
  const meta = PRIORITET_META[u.prioritet] ?? PRIORITET_META.medel
  const forsenad = !!u.deadline && u.deadline < today && u.status !== 'klar'

  return (
    <div className="flex flex-wrap gap-1">
      {forsenad && <Badge tone="danger">Försenad</Badge>}
      <Badge tone={meta.tone}>{meta.label}</Badge>
      {u.typ_id && typMap.get(u.typ_id) && <Badge tone="neutral">{typMap.get(u.typ_id)}</Badge>}
      {u.person_id && personMap.get(u.person_id) && <Badge tone="accent">{personMap.get(u.person_id)}</Badge>}
      {u.kund_id && kundMap.get(u.kund_id) && <Badge tone="neutral">{kundMap.get(u.kund_id)}</Badge>}
    </div>
  )
}

function UppgiftFormular({
  existing,
  personer,
  kunder,
  typer,
  currentPersonId,
  onClose,
}: {
  existing: Uppgift | null
  personer: Person[]
  kunder: Kund[]
  typer: Typ[]
  currentPersonId: string | null
  onClose: () => void
}) {
  const [titel, setTitel] = useState(existing?.titel ?? '')
  const [beskrivning, setBeskrivning] = useState(existing?.beskrivning ?? '')
  const [personId, setPersonId] = useState(existing?.person_id ?? currentPersonId ?? '')
  const [kundId, setKundId] = useState(existing?.kund_id ?? '')
  const [typId, setTypId] = useState(existing?.typ_id ?? '')
  const [prioritet, setPrioritet] = useState(existing?.prioritet ?? 'lag')
  const [deadline, setDeadline] = useState(existing?.deadline ?? '')
  const [status, setStatus] = useState(existing?.status ?? 'oppen')
  const [aterkommande, setAterkommande] = useState(false)
  const [veckodagar, setVeckodagar] = useState<number[]>([])
  const [intervallVeckor, setIntervallVeckor] = useState(1)
  const [slutDatum, setSlutDatum] = useState('')
  const [sparar, setSparar] = useState(false)
  const [visaBekraftelse, setVisaBekraftelse] = useState(false)
  const [tarBort, setTarBort] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!titel.trim()) return
    if (!existing && aterkommande && (!deadline || veckodagar.length === 0)) return
    setSparar(true)

    if (existing) {
      await uppdateraUppgift(existing.id, {
        titel: titel.trim(),
        beskrivning,
        personId,
        kundId,
        typId,
        prioritet,
        deadline: deadline || null,
        status,
      })
    } else if (aterkommande) {
      await skapaUppgiftSerie({
        titel: titel.trim(),
        beskrivning,
        personId,
        kundId,
        typId,
        prioritet,
        startDatum: deadline,
        veckodagar,
        intervallVeckor,
        slutDatum: slutDatum || null,
      })
    } else {
      await skapaUppgift({
        titel: titel.trim(),
        beskrivning,
        personId,
        kundId,
        typId,
        prioritet,
        deadline: deadline || null,
      })
    }

    setSparar(false)
    onClose()
  }

  async function handleTaBort() {
    if (!existing) return
    setTarBort(true)
    await taBortUppgift(existing.id)
    setTarBort(false)
    onClose()
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

  return (
    <Modal onClose={onClose} labelledBy="uppgift-formular-title">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <h2 id="uppgift-formular-title" className="text-lg font-semibold">
          {existing ? 'Redigera uppgift' : 'Ny uppgift'}
        </h2>

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
          <Textarea
            id="uppgift-beskrivning"
            value={beskrivning ?? ''}
            onChange={(e) => setBeskrivning(e.target.value)}
            rows={3}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Ansvarig" htmlFor="uppgift-person">
            <Select
              id="uppgift-person"
              value={personId ?? ''}
              onChange={(e) => setPersonId(e.target.value)}
            >
              <option value="">Ingen</option>
              {personer.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.namn}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Kund" htmlFor="uppgift-kund">
            <Select id="uppgift-kund" value={kundId ?? ''} onChange={(e) => setKundId(e.target.value)}>
              <option value="">Ingen</option>
              {kunder.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.namn}
                </option>
              ))}
            </Select>
          </Field>

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

          <Field label="Prioritet" htmlFor="uppgift-prioritet">
            <Select
              id="uppgift-prioritet"
              value={prioritet}
              onChange={(e) => setPrioritet(e.target.value)}
            >
              <option value="lag">Låg</option>
              <option value="medel">Medel</option>
              <option value="hog">Hög</option>
            </Select>
          </Field>

          <Field label={aterkommande ? 'Startdatum' : 'Dag'} htmlFor="uppgift-deadline">
            <Input
              type="date"
              id="uppgift-deadline"
              value={deadline ?? ''}
              onChange={(e) => setDeadline(e.target.value)}
              required={aterkommande}
            />
          </Field>
        </div>

        {existing && (
          <Field label="Status" htmlFor="uppgift-status">
            <Select id="uppgift-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="oppen">Öppen</option>
              <option value="pagar">Pågår</option>
              <option value="klar">Klar</option>
            </Select>
          </Field>
        )}

        {!existing && (
          <div className="rounded-lg border border-border-subtle p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={aterkommande}
                onChange={(e) => setAterkommande(e.target.checked)}
                className="h-4 w-4 accent-accent-600"
              />
              Återkommande uppgift
            </label>

            {aterkommande && (
              <div className="mt-3 flex flex-col gap-3">
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
                  <p className="text-xs text-stone-400">Lämna tomt för att köra utan slutdatum</p>
                </Field>
              </div>
            )}
          </div>
        )}

        <div className="mt-1 flex items-center justify-between gap-2">
          {existing ? (
            <Button type="button" variant="danger" size="sm" onClick={() => setVisaBekraftelse(true)}>
              Ta bort
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Avbryt
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={sparar}
              disabled={
                !titel.trim() || (!existing && aterkommande && (!deadline || veckodagar.length === 0))
              }
            >
              {existing ? 'Spara' : 'Skapa'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
