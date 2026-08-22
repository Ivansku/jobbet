'use client'

import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
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
  hamtaMallUppgifter,
  skapaMallProjekt,
  uppdateraMallProjekt,
  taBortMallProjekt,
  skapaMallUppgift,
  uppdateraMallUppgift,
  taBortMallUppgift,
  omordnaMallUppgifter,
} from './mall-actions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input, Select } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { DeleteIconButton } from '@/components/ui/delete-icon-button'
import { MarkdownEditor } from '@/components/ui/markdown-editor'

type Typ = { id: string; namn: string; anteckningsmall_id: string | null }
type Kategori = { id: string; namn: string }
type Person = { id: string; namn: string }
type Anteckningsmall = { id: string; namn: string }
type MallUppgift = {
  id: string
  titel: string
  beskrivning: string | null
  typ_id: string | null
  kategori_id: string | null
  prioritet: string
  status: string
  person_id: string | null
  tidsatgang_timmar: number | null
  dagar_efter_start: number
  sortordning: number
  ar_placeholder: boolean
  anteckningsmall_id: string | null
  utan_anteckningsmall: boolean
}
type MallProjekt = {
  id: string
  namn: string
  kategori_id: string | null
  anteckningsmall_id: string | null
  antalUppgifter: number
  uppgifter: MallUppgift[]
}

export function MallVy({
  mallar,
  typer,
  kategori,
  personer,
  currentPersonId,
  anteckningsmallar,
}: {
  mallar: MallProjekt[]
  typer: Typ[]
  kategori: Kategori[]
  personer: Person[]
  currentPersonId: string | null
  anteckningsmallar: Anteckningsmall[]
}) {
  const [redigerar, setRedigerar] = useState<MallProjekt | 'ny' | null>(null)

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Projektmallar</h2>
        <Button variant="primary" onClick={() => setRedigerar('ny')}>
          Ny mall
        </Button>
      </div>

      {mallar.length === 0 ? (
        <EmptyState
          title="Inga mallar ännu"
          description="Skapa en mall, t.ex. Uppstart, för att kunna generera hela projekt med ett klick."
        />
      ) : (
        <ul className="divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-subtle bg-surface">
          {mallar.map((m) => (
            <li key={m.id}>
              <button
                onClick={() => setRedigerar(m)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors hover:bg-stone-50 dark:hover:bg-stone-800"
              >
                <span className="truncate font-medium">{m.namn}</span>
                <span className="text-xs text-stone-400">
                  {m.antalUppgifter} {m.antalUppgifter === 1 ? 'uppgift' : 'uppgifter'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {redigerar && (
        <MallFormular
          existing={redigerar === 'ny' ? null : redigerar}
          typer={typer}
          kategori={kategori}
          personer={personer}
          currentPersonId={currentPersonId}
          anteckningsmallar={anteckningsmallar}
          onClose={() => setRedigerar(null)}
        />
      )}
    </>
  )
}

function MallFormular({
  existing,
  typer,
  kategori,
  personer,
  currentPersonId,
  anteckningsmallar,
  onClose,
}: {
  existing: MallProjekt | null
  typer: Typ[]
  kategori: Kategori[]
  personer: Person[]
  currentPersonId: string | null
  anteckningsmallar: Anteckningsmall[]
  onClose: () => void
}) {
  // Lokal kopia av mallen — startar som prop:en, men uppdateras till det nyss
  // skapade objektet direkt efter "Skapa" istället för att stänga modalen, så
  // man kan börja lägga till uppgifter i samma flöde utan att öppna mallen igen.
  const [mall, setMall] = useState(existing)
  const [namn, setNamn] = useState(existing?.namn ?? '')
  const [kategoriId, setKategoriId] = useState(existing?.kategori_id ?? '')
  const [anteckningsmallId, setAnteckningsmallId] = useState(existing?.anteckningsmall_id ?? '')
  const [uppgifter, setUppgifter] = useState<MallUppgift[]>(existing?.uppgifter ?? [])
  const [redigerarUppgift, setRedigerarUppgift] = useState<MallUppgift | 'ny' | null>(null)
  const [sparar, setSparar] = useState(false)
  const [visaBekraftelse, setVisaBekraftelse] = useState(false)
  const [tarBort, setTarBort] = useState(false)
  const [aktivId, setAktivId] = useState<string | null>(null)

  async function laddaOmUppgifter() {
    if (!mall) return
    setUppgifter(await hamtaMallUppgifter(mall.id))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!namn.trim()) return
    setSparar(true)

    const kategoriIdVarde = kategoriId || null
    const anteckningsmallIdVarde = anteckningsmallId || null

    if (mall) {
      await uppdateraMallProjekt(mall.id, namn, kategoriIdVarde, anteckningsmallIdVarde)
      setSparar(false)
      onClose()
    } else {
      const ny = await skapaMallProjekt(namn, kategoriIdVarde, anteckningsmallIdVarde)
      setSparar(false)
      if (ny)
        setMall({
          id: ny.id,
          namn: ny.namn,
          kategori_id: ny.kategori_id,
          anteckningsmall_id: ny.anteckningsmall_id,
          antalUppgifter: 0,
          uppgifter: [],
        })
    }
  }

  async function handleTaBort() {
    if (!mall) return
    setTarBort(true)
    await taBortMallProjekt(mall.id)
    setTarBort(false)
    onClose()
  }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  )

  // Omordnar lokalt direkt (optimistiskt) utifrån vilken halva av mål-raden
  // man släppte på, sparar sedan hela den nya ordningen till servern —
  // samma "släpp före/efter beroende på pekarens position"-princip som
  // Kanban-tavlans drag-and-drop i uppgifter/kanban-board.tsx.
  function handleDragStart(event: DragStartEvent) {
    setAktivId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setAktivId(null)
    const { active, over } = event
    if (!over) return
    const id = String(active.id)
    const overId = String(over.id)
    if (id === overId) return

    const fran = uppgifter.findIndex((u) => u.id === id)
    const malIndex = uppgifter.findIndex((u) => u.id === overId)
    if (fran === -1 || malIndex === -1) return

    const activeRect = active.rect.current.translated
    const overRect = over.rect
    const infogaEfter =
      !!activeRect && activeRect.top + activeRect.height / 2 > overRect.top + overRect.height / 2

    let till = infogaEfter ? malIndex + 1 : malIndex
    if (fran < till) till -= 1

    const nyOrdning = [...uppgifter]
    const [flyttad] = nyOrdning.splice(fran, 1)
    nyOrdning.splice(till, 0, flyttad)

    setUppgifter(nyOrdning)
    omordnaMallUppgifter(nyOrdning.map((u) => u.id))
  }

  if (visaBekraftelse && mall) {
    return (
      <ConfirmDialog
        title={`Ta bort mallen "${mall.namn}"?`}
        description="Uppgiftsmallarna i den här mallen tas bort samtidigt. Projekt som redan skapats från mallen påverkas inte."
        loading={tarBort}
        onConfirm={handleTaBort}
        onCancel={() => setVisaBekraftelse(false)}
      />
    )
  }

  if (redigerarUppgift && mall) {
    // Första uppgiften i mallen räknas från projektstart, alla efterföljande
    // räknas från den föregående uppgiften — avgörs av nuvarande position i
    // listan, inte lagrat separat.
    const arForsta =
      redigerarUppgift === 'ny' ? uppgifter.length === 0 : uppgifter[0]?.id === redigerarUppgift.id

    return (
      <MallUppgiftFormular
        mallProjektId={mall.id}
        existing={redigerarUppgift === 'ny' ? null : redigerarUppgift}
        mallKategoriId={mall.kategori_id}
        arForsta={arForsta}
        typer={typer}
        kategori={kategori}
        personer={personer}
        currentPersonId={currentPersonId}
        anteckningsmallar={anteckningsmallar}
        onClose={() => setRedigerarUppgift(null)}
        onChanged={laddaOmUppgifter}
      />
    )
  }

  // Kumulativ dag-räkning för visning i listan — samma uträkning som
  // genereringslogiken i projekt/actions.ts använder (startdatum + summan av
  // varje uppgifts "dagar efter föregående" i tur och ordning).
  const kumulativaDagar = uppgifter.reduce<number[]>((acc, u) => {
    acc.push((acc[acc.length - 1] ?? 0) + u.dagar_efter_start)
    return acc
  }, [])

  const aktivIndex = aktivId ? uppgifter.findIndex((u) => u.id === aktivId) : -1
  const aktivUppgift = aktivIndex >= 0 ? uppgifter[aktivIndex] : null

  return (
    <Modal onClose={onClose} labelledBy="mall-formular-title">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h2 id="mall-formular-title" className="text-lg font-semibold">
            {mall ? 'Redigera mall' : 'Ny mall'}
          </h2>
          {mall && (
            <DeleteIconButton label={`Ta bort mallen "${mall.namn}"`} onClick={() => setVisaBekraftelse(true)} />
          )}
        </div>

        <Field label="Namn" htmlFor="mall-namn">
          <Input
            id="mall-namn"
            value={namn}
            onChange={(e) => setNamn(e.target.value)}
            placeholder="T.ex. Uppstart"
            required
            autoFocus
          />
        </Field>

        <Field label="Kategori" htmlFor="mall-kategori">
          <Select id="mall-kategori" value={kategoriId} onChange={(e) => setKategoriId(e.target.value)}>
            <option value="">Ingen</option>
            {kategori.map((k) => (
              <option key={k.id} value={k.id}>
                {k.namn}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Anteckningsmall" htmlFor="mall-anteckningsmall">
          <Select
            id="mall-anteckningsmall"
            value={anteckningsmallId}
            onChange={(e) => setAnteckningsmallId(e.target.value)}
          >
            <option value="">Ingen</option>
            {anteckningsmallar.map((a) => (
              <option key={a.id} value={a.id}>
                {a.namn}
              </option>
            ))}
          </Select>
        </Field>

        {mall && (
          <div className="border-t border-border-subtle pt-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-500">Uppgifter i mallen</h3>
              <Button type="button" variant="secondary" size="sm" onClick={() => setRedigerarUppgift('ny')}>
                Lägg till uppgift
              </Button>
            </div>

            {uppgifter.length === 0 ? (
              <p className="text-xs text-stone-400">Inga uppgifter i mallen ännu.</p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle">
                  {uppgifter.map((u, i) => (
                    <MallUppgiftRad
                      key={u.id}
                      uppgift={u}
                      dag={kumulativaDagar[i]}
                      onSelect={() => setRedigerarUppgift(u)}
                    />
                  ))}
                </ul>

                <DragOverlay>
                  {aktivUppgift ? (
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm shadow-lg">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate">{aktivUppgift.titel}</span>
                        {aktivUppgift.ar_placeholder && <Badge tone="neutral">Placeholder</Badge>}
                      </span>
                      <span className="shrink-0 text-xs text-stone-400">Dag {kumulativaDagar[aktivIndex]}</span>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {mall ? 'Stäng' : 'Avbryt'}
          </Button>
          <Button type="submit" variant="primary" loading={sparar} disabled={!namn.trim()}>
            {mall ? 'Spara' : 'Skapa'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// Hela raden är draggable/droppable och öppnar redigeringsformuläret vid klick
// — samma mönster som KanbanCard i uppgifter/kanban-board.tsx (dnd-kits
// aktiveringsavstånd gör att ett vanligt klick utan rörelse inte tolkas som drag).
function MallUppgiftRad({
  uppgift: u,
  dag,
  onSelect,
}: {
  uppgift: MallUppgift
  dag: number
  onSelect: () => void
}) {
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id: u.id })
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: u.id })
  const setNodeRef = (node: HTMLElement | null) => {
    setDragRef(node)
    setDropRef(node)
  }

  return (
    <li
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onSelect}
      className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm transition-colors ${
        u.ar_placeholder ? 'bg-stone-50 dark:bg-stone-800/50' : ''
      } ${isDragging ? 'opacity-30' : ''} ${isOver ? 'ring-2 ring-inset ring-accent-400' : ''}`}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate">{u.titel}</span>
        {u.ar_placeholder && <Badge tone="neutral">Placeholder</Badge>}
      </span>
      <span className="shrink-0 text-xs text-stone-400">Dag {dag}</span>
    </li>
  )
}

function MallUppgiftFormular({
  mallProjektId,
  existing,
  mallKategoriId,
  arForsta,
  typer,
  kategori,
  personer,
  currentPersonId,
  anteckningsmallar,
  onClose,
  onChanged,
}: {
  mallProjektId: string
  existing: MallUppgift | null
  mallKategoriId: string | null
  arForsta: boolean
  typer: Typ[]
  kategori: Kategori[]
  personer: Person[]
  currentPersonId: string | null
  anteckningsmallar: Anteckningsmall[]
  onClose: () => void
  onChanged: () => void
}) {
  const [titel, setTitel] = useState(existing?.titel ?? '')
  const [beskrivning, setBeskrivning] = useState(existing?.beskrivning ?? '')
  const [typId, setTypId] = useState(existing?.typ_id ?? '')
  // Nya uppgiftsmallar förifylls med mallens kategori (satt en gång på mall_projekt)
  // istället för att behöva taggas för hand här varje gång.
  const [kategoriId, setKategoriId] = useState(existing?.kategori_id ?? mallKategoriId ?? '')
  const [prioritet, setPrioritet] = useState(existing?.prioritet ?? 'lag')
  const [status, setStatus] = useState(existing?.status ?? 'oppen')
  const [personId, setPersonId] = useState(existing?.person_id ?? currentPersonId ?? '')
  const [tidsatgang, setTidsatgang] = useState(existing?.tidsatgang_timmar?.toString() ?? '')
  const [dagarEfterStart, setDagarEfterStart] = useState(existing?.dagar_efter_start?.toString() ?? '0')
  const [arPlaceholder, setArPlaceholder] = useState(existing?.ar_placeholder ?? false)
  const [anteckningsmallId, setAnteckningsmallId] = useState(existing?.anteckningsmall_id ?? '')
  const [utanAnteckningsmall, setUtanAnteckningsmall] = useState(existing?.utan_anteckningsmall ?? false)
  const [sparar, setSparar] = useState(false)
  const [tarBort, setTarBort] = useState(false)

  // Bara typer som har anteckningar aktiverade kan få en override — annars
  // finns ingen standardmall att avvika från.
  const valdTyp = typer.find((t) => t.id === typId)
  const visaAnteckningsmallValjare = Boolean(valdTyp?.anteckningsmall_id)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!titel.trim()) return
    setSparar(true)

    const input = {
      titel: titel.trim(),
      beskrivning,
      typId,
      kategoriId,
      prioritet,
      status,
      personId,
      tidsatgangTimmar: tidsatgang.trim() ? Number(tidsatgang) : null,
      dagarEfterStart: Math.max(0, Number(dagarEfterStart) || 0),
      arPlaceholder,
      anteckningsmallId: visaAnteckningsmallValjare && !utanAnteckningsmall ? anteckningsmallId || null : null,
      utanAnteckningsmall: visaAnteckningsmallValjare && utanAnteckningsmall,
    }

    if (existing) {
      await uppdateraMallUppgift(existing.id, input)
    } else {
      await skapaMallUppgift({ mallProjektId, ...input })
    }

    setSparar(false)
    await onChanged()
    onClose()
  }

  async function handleTaBort() {
    if (!existing) return
    setTarBort(true)
    await taBortMallUppgift(existing.id)
    setTarBort(false)
    await onChanged()
    onClose()
  }

  return (
    <Modal onClose={onClose} labelledBy="mall-uppgift-formular-title">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="mall-uppgift-formular-title" className="text-lg font-semibold">
            {existing ? 'Redigera uppgiftsmall' : 'Ny uppgiftsmall'}
          </h2>
          {existing && (
            <DeleteIconButton
              label={`Ta bort uppgiftsmallen "${existing.titel}"`}
              onClick={handleTaBort}
              loading={tarBort}
            />
          )}
        </div>

        <Field label="Titel" htmlFor="mall-uppgift-titel">
          <Input id="mall-uppgift-titel" value={titel} onChange={(e) => setTitel(e.target.value)} required autoFocus />
        </Field>

        <Field label="Beskrivning" htmlFor="mall-uppgift-beskrivning">
          <MarkdownEditor id="mall-uppgift-beskrivning" value={beskrivning ?? ''} onChange={setBeskrivning} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Typ" htmlFor="mall-uppgift-typ">
            <Select id="mall-uppgift-typ" value={typId} onChange={(e) => setTypId(e.target.value)}>
              <option value="">Ingen</option>
              {typer.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.namn}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Kategori" htmlFor="mall-uppgift-kategori">
            <Select id="mall-uppgift-kategori" value={kategoriId} onChange={(e) => setKategoriId(e.target.value)}>
              <option value="">Ingen</option>
              {kategori.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.namn}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Ansvarig (standard)" htmlFor="mall-uppgift-person">
            <Select id="mall-uppgift-person" value={personId} onChange={(e) => setPersonId(e.target.value)}>
              <option value="">Ingen</option>
              {personer.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.namn}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Prioritet" htmlFor="mall-uppgift-prioritet">
            <Select id="mall-uppgift-prioritet" value={prioritet} onChange={(e) => setPrioritet(e.target.value)}>
              <option value="lag">Låg</option>
              <option value="medel">Medel</option>
              <option value="hog">Hög</option>
            </Select>
          </Field>

          <Field label="Status" htmlFor="mall-uppgift-status">
            <Select id="mall-uppgift-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="oppen">Öppen</option>
              <option value="pagar">Pågår</option>
              <option value="vantar">Väntar</option>
              <option value="klar">Klar</option>
            </Select>
          </Field>

          <Field
            label={arForsta ? 'Dagar efter projektstart' : 'Dagar efter föregående uppgift'}
            htmlFor="mall-uppgift-dagar"
          >
            <Input
              type="number"
              id="mall-uppgift-dagar"
              min={0}
              value={dagarEfterStart}
              onChange={(e) => setDagarEfterStart(e.target.value)}
            />
          </Field>

          <Field label="Tidsåtgång (timmar)" htmlFor="mall-uppgift-tidsatgang">
            <Input
              type="number"
              id="mall-uppgift-tidsatgang"
              min={0}
              step={0.5}
              value={tidsatgang}
              onChange={(e) => setTidsatgang(e.target.value)}
              placeholder="T.ex. 1"
            />
          </Field>
        </div>

        {visaAnteckningsmallValjare && (
          <Field label="Anteckningsmall" htmlFor="mall-uppgift-anteckningsmall">
            <Select
              id="mall-uppgift-anteckningsmall"
              value={utanAnteckningsmall ? '__ingen__' : anteckningsmallId}
              onChange={(e) => {
                const varde = e.target.value
                setUtanAnteckningsmall(varde === '__ingen__')
                setAnteckningsmallId(varde === '__ingen__' ? '' : varde)
              }}
            >
              <option value="__ingen__">Ingen mall</option>
              <option value="">Använd typens standard</option>
              {anteckningsmallar.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.namn}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={arPlaceholder}
            onChange={(e) => setArPlaceholder(e.target.checked)}
            className="h-4 w-4 accent-accent-600"
          />
          Detta är en placeholder
        </label>
        {arPlaceholder && (
          <p className="text-xs text-stone-400">
            När mallen används för att skapa ett riktigt projekt blir den här uppgiften en väntande
            placeholder-rad i projektet, redo att kopplas till en riktig uppgift senare (t.ex. ett
            Outlook-möte som ännu inte är bokat).
          </p>
        )}

        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Avbryt
          </Button>
          <Button type="submit" variant="primary" loading={sparar} disabled={!titel.trim()}>
            {existing ? 'Spara' : 'Lägg till'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
