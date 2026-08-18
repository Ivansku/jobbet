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
  skapaAnteckningsmall,
  uppdateraAnteckningsmall,
  taBortAnteckningsmall,
  hamtaAnteckningsblockForMall,
  skapaAnteckningsblock,
  uppdateraAnteckningsblock,
  sattAnteckningsblockAktiv,
  omordnaAnteckningsblock,
} from './anteckningsmall-actions'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge } from '@/components/ui/badge'
import { DeleteIconButton } from '@/components/ui/delete-icon-button'

type Anteckningsblock = {
  id: string
  namn: string
  beskrivning: string | null
  sortordning: number
  aktiv: boolean
  genererar_uppgift: boolean
  uppgift_titel_mall: string | null
  uppgift_typ_id: string | null
  deadline_dagar_efter_motet: number | null
  kundvisning_standard: boolean
}
type Anteckningsmall = { id: string; namn: string; block: Anteckningsblock[] }
type Uppgiftstyp = { id: string; namn: string }

export function AnteckningsmallVy({ mallar, typer }: { mallar: Anteckningsmall[]; typer: Uppgiftstyp[] }) {
  const [redigerar, setRedigerar] = useState<Anteckningsmall | 'ny' | null>(null)

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Anteckningsmallar</h2>
        <Button variant="primary" onClick={() => setRedigerar('ny')}>
          Ny anteckningsmall
        </Button>
      </div>

      {mallar.length === 0 ? (
        <EmptyState
          title="Inga anteckningsmallar ännu"
          description="Skapa en mall, t.ex. Standard, och lägg till de block som ska visas på uppgifter."
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
                <span className="text-xs text-stone-400">{m.block.length} block</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {redigerar && (
        <AnteckningsmallFormular
          existing={redigerar === 'ny' ? null : redigerar}
          typer={typer}
          onClose={() => setRedigerar(null)}
        />
      )}
    </>
  )
}

function AnteckningsmallFormular({
  existing,
  typer,
  onClose,
}: {
  existing: Anteckningsmall | null
  typer: Uppgiftstyp[]
  onClose: () => void
}) {
  const [mall, setMall] = useState(existing)
  const [namn, setNamn] = useState(existing?.namn ?? '')
  const [block, setBlock] = useState<Anteckningsblock[]>(existing?.block ?? [])
  const [redigerarBlock, setRedigerarBlock] = useState<Anteckningsblock | 'ny' | null>(null)
  const [sparar, setSparar] = useState(false)
  const [visaBekraftelse, setVisaBekraftelse] = useState(false)
  const [tarBort, setTarBort] = useState(false)
  const [aktivId, setAktivId] = useState<string | null>(null)

  async function laddaOmBlock() {
    if (!mall) return
    setBlock(await hamtaAnteckningsblockForMall(mall.id))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!namn.trim()) return
    setSparar(true)

    if (mall) {
      await uppdateraAnteckningsmall(mall.id, namn)
      setSparar(false)
      onClose()
    } else {
      const ny = await skapaAnteckningsmall(namn)
      setSparar(false)
      if (ny) setMall({ id: ny.id, namn: ny.namn, block: [] })
    }
  }

  async function handleTaBort() {
    if (!mall) return
    setTarBort(true)
    await taBortAnteckningsmall(mall.id)
    setTarBort(false)
    onClose()
  }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  )

  if (visaBekraftelse && mall) {
    return (
      <ConfirmDialog
        title={`Ta bort anteckningsmallen "${mall.namn}"?`}
        description="Blocken i den här mallen tas bort samtidigt. Uppgiftstyper som har den som standard mister sin koppling."
        loading={tarBort}
        onConfirm={handleTaBort}
        onCancel={() => setVisaBekraftelse(false)}
      />
    )
  }

  if (redigerarBlock && mall) {
    return (
      <AnteckningsblockFormular
        anteckningsmallId={mall.id}
        existing={redigerarBlock === 'ny' ? null : redigerarBlock}
        typer={typer}
        onClose={() => setRedigerarBlock(null)}
        onChanged={laddaOmBlock}
      />
    )
  }

  const sorterade = [...block].sort((a, b) => a.sortordning - b.sortordning)

  const aktivIndex = aktivId ? sorterade.findIndex((b) => b.id === aktivId) : -1
  const aktivBlock = aktivIndex >= 0 ? sorterade[aktivIndex] : null

  function handleDragStart(event: DragStartEvent) {
    setAktivId(String(event.active.id))
  }

  // Samma "släpp före/efter beroende på pekarens position"-princip som
  // mall-vy.tsx och Kanban-tavlan använder. sortordning sätts lokalt till
  // nya indexet direkt, annars sorterar `sorterade` om sig till den gamla
  // ordningen igen vid nästa render (den härleds alltid från sortordning).
  function handleDragEnd(event: DragEndEvent) {
    setAktivId(null)
    const { active, over } = event
    if (!over) return
    const id = String(active.id)
    const overId = String(over.id)
    if (id === overId) return

    const fran = sorterade.findIndex((b) => b.id === id)
    const malIndex = sorterade.findIndex((b) => b.id === overId)
    if (fran === -1 || malIndex === -1) return

    const activeRect = active.rect.current.translated
    const overRect = over.rect
    const infogaEfter =
      !!activeRect && activeRect.top + activeRect.height / 2 > overRect.top + overRect.height / 2

    let till = infogaEfter ? malIndex + 1 : malIndex
    if (fran < till) till -= 1

    const nyOrdning = [...sorterade]
    const [flyttat] = nyOrdning.splice(fran, 1)
    nyOrdning.splice(till, 0, flyttat)

    const nyttBlock = nyOrdning.map((b, i) => ({ ...b, sortordning: i }))
    setBlock(nyttBlock)
    omordnaAnteckningsblock(nyttBlock.map((b) => b.id))
  }

  return (
    <Modal onClose={onClose} labelledBy="anteckningsmall-formular-title">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h2 id="anteckningsmall-formular-title" className="text-lg font-semibold">
            {mall ? 'Redigera anteckningsmall' : 'Ny anteckningsmall'}
          </h2>
          {mall && (
            <DeleteIconButton
              label={`Ta bort anteckningsmallen "${mall.namn}"`}
              onClick={() => setVisaBekraftelse(true)}
            />
          )}
        </div>

        <Field label="Namn" htmlFor="anteckningsmall-namn">
          <Input
            id="anteckningsmall-namn"
            value={namn}
            onChange={(e) => setNamn(e.target.value)}
            placeholder="T.ex. Standard"
            required
            autoFocus
          />
        </Field>

        {mall && (
          <div className="border-t border-border-subtle pt-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-500">Block i mallen</h3>
              <Button type="button" variant="secondary" size="sm" onClick={() => setRedigerarBlock('ny')}>
                Lägg till block
              </Button>
            </div>

            {sorterade.length === 0 ? (
              <p className="text-xs text-stone-400">Inga block i mallen ännu.</p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle">
                  {sorterade.map((b) => (
                    <AnteckningsblockRad key={b.id} block={b} onSelect={() => setRedigerarBlock(b)} />
                  ))}
                </ul>

                <DragOverlay>
                  {aktivBlock ? (
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-border-subtle bg-surface px-2 py-1.5 text-sm shadow-lg">
                      <span className="truncate">{aktivBlock.namn}</span>
                      <div className="flex items-center gap-2">
                        {!aktivBlock.aktiv && <Badge>Inaktiv</Badge>}
                        <span className="text-xs text-stone-400">Redigera</span>
                      </div>
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
// — samma mönster som MallUppgiftRad i mall-vy.tsx och KanbanCard i
// uppgifter/kanban-board.tsx.
function AnteckningsblockRad({ block: b, onSelect }: { block: Anteckningsblock; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id: b.id })
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: b.id })
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
      className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm transition-colors hover:bg-stone-50 dark:hover:bg-stone-800 ${
        isDragging ? 'opacity-30' : ''
      } ${isOver ? 'ring-2 ring-inset ring-accent-400' : ''}`}
    >
      <span className="truncate">{b.namn}</span>
      <div className="flex items-center gap-2">
        {!b.aktiv && <Badge>Inaktiv</Badge>}
        <span className="text-xs text-stone-400">Redigera</span>
      </div>
    </li>
  )
}

function AnteckningsblockFormular({
  anteckningsmallId,
  existing,
  typer,
  onClose,
  onChanged,
}: {
  anteckningsmallId: string
  existing: Anteckningsblock | null
  typer: Uppgiftstyp[]
  onClose: () => void
  onChanged: () => void
}) {
  const [namn, setNamn] = useState(existing?.namn ?? '')
  const [beskrivning, setBeskrivning] = useState(existing?.beskrivning ?? '')
  const [genererarUppgift, setGenererarUppgift] = useState(existing?.genererar_uppgift ?? false)
  const [uppgiftTitelMall, setUppgiftTitelMall] = useState(existing?.uppgift_titel_mall ?? '')
  const [uppgiftTypId, setUppgiftTypId] = useState(existing?.uppgift_typ_id ?? '')
  const [deadlineDagarEfterMotet, setDeadlineDagarEfterMotet] = useState(
    existing?.deadline_dagar_efter_motet != null ? String(existing.deadline_dagar_efter_motet) : ''
  )
  const [kundvisningStandard, setKundvisningStandard] = useState(existing?.kundvisning_standard ?? false)
  const [aktiv, setAktiv] = useState(existing?.aktiv ?? true)
  const [sparar, setSparar] = useState(false)
  const [fel, setFel] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSparar(true)
    setFel(null)

    const input = {
      namn,
      beskrivning,
      genererarUppgift,
      uppgiftTitelMall,
      uppgiftTypId,
      deadlineDagarEfterMotet: deadlineDagarEfterMotet.trim() === '' ? null : Number(deadlineDagarEfterMotet),
      kundvisningStandard,
    }

    const resultat = existing
      ? await uppdateraAnteckningsblock(existing.id, input)
      : await skapaAnteckningsblock({ ...input, anteckningsmallId })

    if (resultat?.error) {
      setFel(resultat.error)
      setSparar(false)
      return
    }

    if (existing && existing.aktiv !== aktiv) {
      await sattAnteckningsblockAktiv(existing.id, aktiv)
    }

    setSparar(false)
    await onChanged()
    onClose()
  }

  return (
    <Modal onClose={onClose} labelledBy="block-formular-title">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <h2 id="block-formular-title" className="text-lg font-semibold">
          {existing ? 'Redigera anteckningsblock' : 'Nytt anteckningsblock'}
        </h2>

        <Field label="Namn" htmlFor="block-namn">
          <Input
            id="block-namn"
            value={namn}
            onChange={(e) => setNamn(e.target.value)}
            placeholder="T.ex. TODO"
            required
            autoFocus
          />
        </Field>

        <Field label="Beskrivning" htmlFor="block-beskrivning">
          <Textarea
            id="block-beskrivning"
            value={beskrivning}
            onChange={(e) => setBeskrivning(e.target.value)}
            placeholder="T.ex. Fråga efter budget och tidsplan innan mötet avslutas"
            rows={2}
          />
        </Field>

        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={genererarUppgift}
            onChange={(e) => setGenererarUppgift(e.target.checked)}
            className="h-4 w-4 accent-accent-600"
          />
          Genererar uppföljningsuppgift
        </label>

        {genererarUppgift && (
          <>
            <Field label="Titel på genererad uppgift" htmlFor="block-titel-mall">
              <Input
                id="block-titel-mall"
                value={uppgiftTitelMall}
                onChange={(e) => setUppgiftTitelMall(e.target.value)}
                placeholder="T.ex. Följ upp – {kund}"
                required={genererarUppgift}
              />
            </Field>
            <Field label="Uppgiftstyp på genererad uppgift" htmlFor="block-typ">
              <Select
                id="block-typ"
                value={uppgiftTypId}
                onChange={(e) => setUppgiftTypId(e.target.value)}
                required={genererarUppgift}
              >
                <option value="">Välj typ...</option>
                {typer.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.namn}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Deadline (dagar efter mötet, tomt = ingen deadline)" htmlFor="block-deadline">
              <Input
                id="block-deadline"
                type="number"
                value={deadlineDagarEfterMotet}
                onChange={(e) => setDeadlineDagarEfterMotet(e.target.value)}
                placeholder="T.ex. 0"
              />
            </Field>
          </>
        )}

        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={kundvisningStandard}
            onChange={(e) => setKundvisningStandard(e.target.checked)}
            className="h-4 w-4 accent-accent-600"
          />
          Ibockad som standard i kundsammanfattningen
        </label>

        {existing && (
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={aktiv}
              onChange={(e) => setAktiv(e.target.checked)}
              className="h-4 w-4 accent-accent-600"
            />
            Aktiv
          </label>
        )}

        {fel && <p className="text-sm text-red-600">{fel}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Avbryt
          </Button>
          <Button type="submit" variant="primary" loading={sparar} disabled={!namn.trim()}>
            {existing ? 'Spara' : 'Skapa'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
