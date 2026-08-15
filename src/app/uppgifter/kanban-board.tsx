'use client'

import { useEffect, useOptimistic, useState, useTransition } from 'react'
import Link from 'next/link'
import {
  closestCenter,
  pointerWithin,
  rectIntersection,
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  skapaUppgift,
  skapaUppgiftSerie,
  gorUppgiftAterkommande,
  uppdateraUppgift,
  flyttaUppgift,
  uppdateraStatus,
  taBortUppgift,
} from './actions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DeleteIconButton } from '@/components/ui/delete-icon-button'
import { Field } from '@/components/ui/field'
import { Input, Select } from '@/components/ui/input'
import { MarkdownEditor } from '@/components/ui/markdown-editor'
import { createClient } from '@/lib/supabase/client'
import { VeckodagValjare } from './veckodag-valjare'
import { KundValjare } from './kund-valjare'
import { DeltagareValjare } from './deltagare-valjare'
import { SerieVy, SerieFormular } from './serie-vy'
import { MotesanteckningarSektion } from './motesanteckningar-sektion'
import { TidigareMotenSektion } from './tidigare-moten-sektion'

type Person = { id: string; namn: string }
type Kund = { id: string; namn: string }
type Typ = {
  id: string
  namn: string
  visar_motesanteckningar: boolean
  skapa_uppgifter_vid_klar: boolean
}
type Projekt = { id: string; namn: string }
type Anteckningsblock = { id: string; namn: string; genererar_uppgift: boolean }
type UppgiftAnteckning = {
  block_id: string
  innehall: string
  uppgift_id_genererad: string | null
  genererad: { titel: string; deadline: string | null }[] | null
}
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
  uppgiftsprojekt_id: string | null
  serie_id: string | null
  sortordning: number
  tidsatgang_timmar: number | null
  klockslag: string | null
  skapa_uppgifter_vid_klar: boolean | null
  uppgift_deltagare: { kontaktperson_id: string }[]
  uppgift_anteckning: UppgiftAnteckning[]
}
type Kontaktperson = {
  id: string
  kund_id: string
  fornamn: string | null
  efternamn: string | null
  epost: string | null
}
type Serie = {
  id: string
  titel: string
  beskrivning: string | null
  person_id: string | null
  kund_id: string | null
  typ_id: string | null
  uppgiftsprojekt_id: string | null
  prioritet: string
  start_datum: string
  veckodagar: number[]
  intervall_veckor: number
  slut_datum: string | null
  tidsatgang_timmar: number | null
  klockslag: string | null
}
type Kolumn = { key: string; label: string; datum: string | null }

const VECKODAGAR = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag']

// Prioritet syns bara som en dämpad kantfärg på kortet (ingen separat badge/text) —
// tillräckligt urskiljbart utan att konkurrera om uppmärksamhet med resten av kortet.
const PRIORITET_BORDER: Record<string, string> = {
  lag: 'border-l-stone-300 dark:border-l-stone-600',
  medel: 'border-l-amber-400 dark:border-l-amber-500',
  hog: 'border-l-red-400 dark:border-l-red-500',
}

function kortDatum(iso: string) {
  const [, m, d] = iso.split('-')
  return `${parseInt(d, 10)}/${parseInt(m, 10)}`
}

function initialer(namn: string) {
  const delar = namn.trim().split(/\s+/)
  if (delar.length === 1) return delar[0].slice(0, 2).toUpperCase()
  return (delar[0][0] + delar[delar.length - 1][0]).toUpperCase()
}

function isoTillUTC(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

// Servern skickar bara med uppgifter inom veckan som visas (mån-sön) eller utan
// datum — realtime-händelser har ingen sådan gräns inbyggd (t.ex. genererar
// Outlook-webhooken eller serie-genereringen ofta förekomster för helt andra
// veckor). Utan den här kontrollen läcker sånt rakt in i Oplanerad-listan.
function inomVisadVecka(deadline: string, mandagTid: number, sondagTid: number): boolean {
  const datum = isoTillUTC(deadline)
  return datum >= mandagTid && datum <= sondagTid
}

export function KanbanBoard({
  weekDates,
  today,
  uppgifter,
  personer,
  kunder,
  typer,
  projekt,
  serier,
  kontaktpersoner,
  block,
  currentPersonId,
  foretagId,
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
  projekt: Projekt[]
  serier: Serie[]
  kontaktpersoner: Kontaktperson[]
  block: Anteckningsblock[]
  currentPersonId: string | null
  foretagId: string | null
  prevVeckaHref: string
  nextVeckaHref: string
  idagHref: string
}) {
  const [, startTransition] = useTransition()
  const [redigerar, setRedigerar] = useState<Uppgift | 'ny' | null>(null)
  const [nyDatum, setNyDatum] = useState<string | null>(null)
  const [aktivId, setAktivId] = useState<string | null>(null)
  const [redigerarSerie, setRedigerarSerie] = useState<Serie | null>(null)

  function oppnaSerieRedigering(serieId: string) {
    const serie = serier.find((s) => s.id === serieId)
    if (serie) {
      setRedigerar(null)
      setRedigerarSerie(serie)
    }
  }

  // liveUppgifter är den bekräftade "sanningen" — startar från serverns props,
  // men hålls sedan i synk live via Supabase Realtime (se nedan) så att t.ex.
  // Outlook-webhooken kan skapa/ändra/ta bort kort utan att man trycker F5.
  // Nollställs när props-listan faktiskt byts ut (t.ex. vid vecko-navigering) —
  // justerat under rendering istället för i en effekt, enligt Reacts eget mönster
  // för att återspegla en ändrad prop i lokalt state.
  const [tidigareUppgifter, setTidigareUppgifter] = useState(uppgifter)
  const [liveUppgifter, setLiveUppgifter] = useState(uppgifter)
  if (uppgifter !== tidigareUppgifter) {
    setTidigareUppgifter(uppgifter)
    setLiveUppgifter(uppgifter)
  }

  const mandagTid = isoTillUTC(weekDates[0])
  const sondagTid = mandagTid + 6 * 86400000

  useEffect(() => {
    if (!foretagId) return
    const supabase = createClient()

    const kanal = supabase
      .channel(`uppgift-live-${foretagId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'uppgift', filter: `foretag_id=eq.${foretagId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const borttagenId = (payload.old as { id?: string }).id
            if (!borttagenId) return
            setLiveUppgifter((state) => state.filter((u) => u.id !== borttagenId))
            return
          }

          const rad = payload.new as Record<string, unknown>
          const deadline = (rad.deadline as string | null) ?? null
          const horHemma = deadline === null || inomVisadVecka(deadline, mandagTid, sondagTid)

          setLiveUppgifter((state) => {
            const befintlig = state.find((u) => u.id === rad.id)
            if (!horHemma) {
              // Hör inte hemma i den här veckans vy — ta bort om den redan fanns
              // (t.ex. flyttad till en annan vecka), lägg aldrig till en ny.
              return befintlig ? state.filter((u) => u.id !== rad.id) : state
            }

            // postgres_changes har ingen koppling till uppgift_deltagare/uppgift_anteckning
            // (egna tabeller) — behåll det vi redan visste om kortet, eller tomt för ett
            // helt nytt kort (uppdateras vid nästa sidladdning).
            const uppdaterad: Uppgift = {
              id: rad.id as string,
              titel: rad.titel as string,
              beskrivning: (rad.beskrivning as string | null) ?? null,
              status: rad.status as string,
              prioritet: rad.prioritet as string,
              deadline,
              person_id: (rad.person_id as string | null) ?? null,
              kund_id: (rad.kund_id as string | null) ?? null,
              typ_id: (rad.typ_id as string | null) ?? null,
              uppgiftsprojekt_id: (rad.uppgiftsprojekt_id as string | null) ?? null,
              serie_id: (rad.serie_id as string | null) ?? null,
              sortordning: rad.sortordning as number,
              tidsatgang_timmar: (rad.tidsatgang_timmar as number | null) ?? null,
              klockslag: (rad.klockslag as string | null) ?? null,
              skapa_uppgifter_vid_klar: (rad.skapa_uppgifter_vid_klar as boolean | null) ?? null,
              uppgift_deltagare: befintlig?.uppgift_deltagare ?? [],
              uppgift_anteckning: befintlig?.uppgift_anteckning ?? [],
            }

            return befintlig
              ? state.map((u) => (u.id === uppdaterad.id ? uppdaterad : u))
              : [...state, uppdaterad]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(kanal)
    }
  }, [foretagId, mandagTid, sondagTid])

  // Optimistisk lokal patch ovanpå liveUppgifter så ett kort hamnar rätt direkt
  // vid drag/klarmarkering, istället för att hoppa tillbaka i väntan på serverns svar.
  const [uppgifterVy, patchUppgiftOptimistiskt] = useOptimistic(
    liveUppgifter,
    (state, { id, patch }: { id: string; patch: Partial<Uppgift> }) =>
      state.map((u) => (u.id === id ? { ...u, ...patch } : u))
  )

  function oppnaNy(datum: string | null) {
    setNyDatum(datum)
    setRedigerar('ny')
  }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  )

  const personMap = new Map(personer.map((p) => [p.id, p.namn]))
  const kundMap = new Map(kunder.map((k) => [k.id, k.namn]))
  const typMap = new Map(typer.map((t) => [t.id, t.namn]))
  const projektMap = new Map(projekt.map((p) => [p.id, p.namn]))
  const weekDateSet = new Set(weekDates)

  // Vilken kolumn en uppgift hör hemma i just nu — samma regel som filtreringen
  // nedan använder, men som en delad funktion så drag-and-drop-logiken kan fråga
  // "vilken lista tillhör kortet jag släppte på?".
  function kolumnForUppgift(u: Uppgift): string | null {
    return u.deadline && weekDateSet.has(u.deadline) ? u.deadline : null
  }

  const kolumner: Kolumn[] = [
    { key: 'oplanerad', label: 'Oplanerad', datum: null },
    ...weekDates.map((datum, i) => ({ key: datum, label: VECKODAGAR[i], datum })),
  ]
  const kolumnNycklar = new Set(kolumner.map((k) => k.key))

  // Kolumnen är ett droppbart mål lika stort som hela listan, vilket annars kan "vinna"
  // över ett specifikt kort när man släpper mellan två kort — man hamnar då längst ner
  // i stället för mellan korten. Prioriterar därför träffar på kort (via pekarens
  // position) före hela kolumnen, och faller bara tillbaka på kolumnen när inget
  // kort träffas alls (dvs. verkligen tom yta).
  const collisionDetectionStrategy: CollisionDetection = (args) => {
    const kortContainers = args.droppableContainers.filter((c) => !kolumnNycklar.has(String(c.id)))
    const kortTraffar = pointerWithin({ ...args, droppableContainers: kortContainers })
    if (kortTraffar.length > 0) return kortTraffar

    const traffar = rectIntersection(args)
    if (traffar.length > 0) return traffar

    return closestCenter(args)
  }

  const aktivUppgift = aktivId ? (uppgifterVy.find((u) => u.id === aktivId) ?? null) : null

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

    // Släppt direkt i en kolumn (tom yta eller "+ Ny uppgift"-området) — lägg sist i den listan.
    // Släppt på ett annat kort — kliv in före eller efter det beroende på vilken halva av
    // kortet du släppte på (annars gick det aldrig att flytta ett kort förbi sin närmaste
    // granne, bara "framför" — att släppa ovanpå nästa kort blev då en no-op).
    const kolumnTraff = kolumner.find((k) => k.key === overId)
    let malDatum: string | null
    let sorteradeIKolumn: Uppgift[]
    let nyOrdning: number

    if (kolumnTraff) {
      malDatum = kolumnTraff.datum
      sorteradeIKolumn = uppgifterVy
        .filter((u) => u.id !== id && kolumnForUppgift(u) === malDatum)
        .sort((a, b) => a.sortordning - b.sortordning)
      const sista = sorteradeIKolumn[sorteradeIKolumn.length - 1]
      nyOrdning = sista ? sista.sortordning + 1 : 0
    } else {
      const malUppgift = uppgifterVy.find((u) => u.id === overId)
      if (!malUppgift) return
      malDatum = kolumnForUppgift(malUppgift)
      sorteradeIKolumn = uppgifterVy
        .filter((u) => u.id !== id && kolumnForUppgift(u) === malDatum)
        .sort((a, b) => a.sortordning - b.sortordning)
      const malIndex = sorteradeIKolumn.findIndex((u) => u.id === overId)

      const activeRect = active.rect.current.translated
      const overRect = over.rect
      const infogaEfter =
        !!activeRect && activeRect.top + activeRect.height / 2 > overRect.top + overRect.height / 2

      if (infogaEfter) {
        const nasta = sorteradeIKolumn[malIndex + 1]
        nyOrdning = nasta ? (malUppgift.sortordning + nasta.sortordning) / 2 : malUppgift.sortordning + 1
      } else {
        const foregaende = sorteradeIKolumn[malIndex - 1]
        nyOrdning = foregaende ? (foregaende.sortordning + malUppgift.sortordning) / 2 : malUppgift.sortordning - 1
      }
    }

    startTransition(() => {
      patchUppgiftOptimistiskt({ id, patch: { deadline: malDatum, sortordning: nyOrdning } })
      flyttaUppgift(id, malDatum, nyOrdning)
    })
  }

  function toggleStatus(u: Uppgift) {
    const nyStatus = u.status === 'klar' ? 'oppen' : 'klar'
    startTransition(() => {
      patchUppgiftOptimistiskt({ id: u.id, patch: { status: nyStatus } })
      uppdateraStatus(u.id, nyStatus)
    })
  }

  return (
    <DndContext
      id="uppgifter-kanban"
      sensors={sensors}
      collisionDetection={collisionDetectionStrategy}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Link
              href={prevVeckaHref}
              className="inline-flex items-center justify-center rounded-lg border border-stone-300 bg-surface px-3 py-1.5 text-sm font-medium shadow-sm transition-colors hover:border-stone-400 hover:bg-stone-100 dark:border-stone-600 dark:hover:bg-stone-800"
            >
              ← Föregående
            </Link>
            <Link
              href={idagHref}
              className="inline-flex items-center justify-center rounded-lg border border-stone-300 bg-surface px-3 py-1.5 text-sm font-medium shadow-sm transition-colors hover:border-stone-400 hover:bg-stone-100 dark:border-stone-600 dark:hover:bg-stone-800"
            >
              Denna vecka
            </Link>
            <Link
              href={nextVeckaHref}
              className="inline-flex items-center justify-center rounded-lg border border-stone-300 bg-surface px-3 py-1.5 text-sm font-medium shadow-sm transition-colors hover:border-stone-400 hover:bg-stone-100 dark:border-stone-600 dark:hover:bg-stone-800"
            >
              Nästa →
            </Link>
          </div>
          <div className="flex gap-2">
            <SerieVy serier={serier} personer={personer} kunder={kunder} typer={typer} projekt={projekt} />
            <Button variant="primary" onClick={() => oppnaNy(null)}>
              Ny uppgift
            </Button>
          </div>
        </div>

        <div className="grid grid-flow-col auto-cols-[85%] items-start gap-4 overflow-x-auto pb-2 snap-x snap-mandatory sm:auto-cols-[280px] md:grid-flow-row md:auto-cols-auto md:grid-cols-6 md:overflow-visible">
          {kolumner.map((kol) => (
            <KanbanColumn
              key={kol.key}
              kol={kol}
              today={today}
              uppgifter={uppgifterVy
                .filter((u) => kolumnForUppgift(u) === kol.datum)
                .sort((a, b) => a.sortordning - b.sortordning)}
              personMap={personMap}
              kundMap={kundMap}
              typMap={typMap}
              projektMap={projektMap}
              onSelect={setRedigerar}
              onToggleStatus={toggleStatus}
              onAddNew={oppnaNy}
            />
          ))}
        </div>
      </div>

      <DragOverlay>
        {aktivUppgift ? (
          <div
            className={`rounded-xl border border-border-subtle border-l-4 bg-surface p-3 shadow-lg ${
              (PRIORITET_BORDER[aktivUppgift.prioritet] ?? PRIORITET_BORDER.medel)
            } ${aktivUppgift.status === 'klar' ? 'opacity-60' : ''}`}
          >
            <KortInnehall
              uppgift={aktivUppgift}
              today={today}
              personMap={personMap}
              kundMap={kundMap}
              typMap={typMap}
              projektMap={projektMap}
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
          projekt={projekt}
          serier={serier}
          kontaktpersoner={kontaktpersoner}
          block={block}
          currentPersonId={currentPersonId}
          initialDeadline={nyDatum}
          onEditSerie={oppnaSerieRedigering}
          onClose={() => setRedigerar(null)}
        />
      )}

      {redigerarSerie && (
        <SerieFormular
          serie={redigerarSerie}
          personer={personer}
          kunder={kunder}
          typer={typer}
          projekt={projekt}
          onClose={() => setRedigerarSerie(null)}
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
  projektMap,
  onSelect,
  onToggleStatus,
  onAddNew,
}: {
  kol: Kolumn
  today: string
  uppgifter: Uppgift[]
  personMap: Map<string, string>
  kundMap: Map<string, string>
  typMap: Map<string, string>
  projektMap: Map<string, string>
  onSelect: (u: Uppgift) => void
  onToggleStatus: (u: Uppgift) => void
  onAddNew: (datum: string | null) => void
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

      <div className="flex max-h-[65vh] flex-1 flex-col gap-2 overflow-y-auto">
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
              projektMap={projektMap}
              onSelect={onSelect}
              onToggleStatus={onToggleStatus}
            />
          ))
        )}

        <button
          type="button"
          onClick={() => onAddNew(kol.datum)}
          className="mt-auto rounded-lg px-2 py-1.5 text-center text-xs text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-stone-700 dark:hover:text-stone-300"
        >
          + Ny uppgift
        </button>
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
  projektMap,
  onSelect,
  onToggleStatus,
}: {
  uppgift: Uppgift
  today: string
  personMap: Map<string, string>
  kundMap: Map<string, string>
  typMap: Map<string, string>
  projektMap: Map<string, string>
  onSelect: (u: Uppgift) => void
  onToggleStatus: (u: Uppgift) => void
}) {
  // Klockslagsatta kort positioneras automatiskt i kronologisk ordning — att låta dem
  // dras skulle bara resultera i att de studsar tillbaka till sin klockslags-plats,
  // vilket känns trasigt snarare än avsiktligt. De går fortfarande att flytta till en
  // annan dag, men bara via formuläret (Dag-fältet), inte genom att dra kortet.
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: u.id,
    disabled: !!u.klockslag,
  })
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: u.id })
  const setNodeRef = (node: HTMLElement | null) => {
    setDragRef(node)
    setDropRef(node)
  }
  const border = PRIORITET_BORDER[u.prioritet] ?? PRIORITET_BORDER.medel
  const klar = u.status === 'klar'

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onSelect(u)}
      className={`cursor-pointer rounded-xl border border-border-subtle border-l-4 bg-surface p-3 shadow-sm transition-shadow hover:shadow-md ${border} ${
        klar ? 'opacity-60' : ''
      } ${isDragging ? 'opacity-30' : ''} ${isOver ? 'ring-2 ring-accent-400' : ''}`}
    >
      <KortInnehall
        uppgift={u}
        today={today}
        personMap={personMap}
        kundMap={kundMap}
        typMap={typMap}
        projektMap={projektMap}
        onToggleStatus={onToggleStatus}
      />
    </div>
  )
}

function KortInnehall({
  uppgift: u,
  today,
  personMap,
  kundMap,
  typMap,
  projektMap,
  onToggleStatus,
}: {
  uppgift: Uppgift
  today: string
  personMap: Map<string, string>
  kundMap: Map<string, string>
  typMap: Map<string, string>
  projektMap: Map<string, string>
  onToggleStatus?: (u: Uppgift) => void
}) {
  const klar = u.status === 'klar'
  const vantar = u.status === 'vantar'
  const forsenad = !!u.deadline && u.deadline < today && u.status !== 'klar'
  const ansvarigNamn = u.person_id ? personMap.get(u.person_id) : undefined

  // Kompakt "brödsmula" (Kund · Projekt · Typ) istället för en badge per fält —
  // ger samma överblick som den gamla "Kunden: Projekt: Typ - text"-konventionen,
  // men som kontext ovanför titeln snarare än utspritt i badges.
  const kontext = [
    u.kund_id && kundMap.get(u.kund_id),
    u.uppgiftsprojekt_id && projektMap.get(u.uppgiftsprojekt_id),
    u.typ_id && typMap.get(u.typ_id),
  ].filter((v): v is string => Boolean(v))

  return (
    <>
      {kontext.length > 0 && (
        <p className="mb-0.5 truncate text-[11px] font-medium tracking-wide text-stone-400">
          {kontext.join(' · ')}
        </p>
      )}
      <div className="flex items-start justify-between gap-2">
        <p className={`text-sm font-medium break-words text-foreground ${klar ? 'line-through' : ''}`}>
          {u.klockslag && (
            <span className="mr-1.5 font-normal text-stone-400">{u.klockslag.slice(0, 5)}</span>
          )}
          {u.titel}
        </p>
        <input
          type="checkbox"
          checked={klar}
          readOnly={!onToggleStatus}
          aria-label={klar ? 'Markera som ej klar' : 'Markera som klar'}
          className="mt-0.5 h-4 w-4 shrink-0 accent-success-600"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onChange={onToggleStatus ? () => onToggleStatus(u) : undefined}
        />
      </div>
      {(forsenad || vantar || ansvarigNamn || u.tidsatgang_timmar) && (
        <div className="mt-1.5 flex items-center justify-between gap-1">
          <div className="flex flex-wrap gap-1">
            {forsenad && <Badge tone="danger">Försenad</Badge>}
            {vantar && <Badge tone="warning">Väntar</Badge>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {!!u.tidsatgang_timmar && (
              <span className="text-[10px] font-medium text-stone-400">{u.tidsatgang_timmar}h</span>
            )}
            {ansvarigNamn && (
              <span
                title={ansvarigNamn}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-100 text-[10px] font-semibold text-accent-700 dark:bg-accent-900 dark:text-accent-300"
              >
                {initialer(ansvarigNamn)}
              </span>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function UppgiftFormular({
  existing,
  personer,
  kunder,
  typer,
  projekt,
  serier,
  kontaktpersoner,
  block,
  currentPersonId,
  initialDeadline,
  onEditSerie,
  onClose,
}: {
  existing: Uppgift | null
  personer: Person[]
  kunder: Kund[]
  typer: Typ[]
  projekt: Projekt[]
  serier: Serie[]
  kontaktpersoner: Kontaktperson[]
  block: Anteckningsblock[]
  currentPersonId: string | null
  initialDeadline: string | null
  onEditSerie: (serieId: string) => void
  onClose: () => void
}) {
  const [titel, setTitel] = useState(existing?.titel ?? '')
  const [beskrivning, setBeskrivning] = useState(existing?.beskrivning ?? '')
  const [personId, setPersonId] = useState(existing?.person_id ?? currentPersonId ?? '')
  const [kundId, setKundId] = useState(existing?.kund_id ?? '')
  const [typId, setTypId] = useState(existing?.typ_id ?? '')
  const [deltagareIds, setDeltagareIds] = useState<string[]>(
    existing?.uppgift_deltagare.map((d) => d.kontaktperson_id) ?? []
  )
  const [uppgiftsprojektId, setUppgiftsprojektId] = useState(existing?.uppgiftsprojekt_id ?? '')
  const [prioritet, setPrioritet] = useState(existing?.prioritet ?? 'lag')
  const [deadline, setDeadline] = useState(existing?.deadline ?? initialDeadline ?? '')
  const [status, setStatus] = useState(existing?.status ?? 'oppen')
  const [tidsatgang, setTidsatgang] = useState(existing?.tidsatgang_timmar?.toString() ?? '')
  const [klockslag, setKlockslag] = useState(existing?.klockslag?.slice(0, 5) ?? '')
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
    if (aterkommande && (!deadline || veckodagar.length === 0)) return
    setSparar(true)

    const tidsatgangTimmar = tidsatgang.trim() ? Number(tidsatgang) : null
    const klockslagVarde = klockslag || null

    if (existing && aterkommande) {
      await gorUppgiftAterkommande(existing.id, {
        titel: titel.trim(),
        beskrivning,
        personId,
        kundId,
        typId,
        uppgiftsprojektId,
        prioritet,
        startDatum: deadline,
        veckodagar,
        intervallVeckor,
        slutDatum: slutDatum || null,
        tidsatgangTimmar,
        klockslag: klockslagVarde,
      })
    } else if (existing) {
      await uppdateraUppgift(existing.id, {
        titel: titel.trim(),
        beskrivning,
        personId,
        kundId,
        typId,
        uppgiftsprojektId,
        prioritet,
        deadline: deadline || null,
        status,
        tidsatgangTimmar,
        klockslag: klockslagVarde,
        deltagareIds,
      })
    } else if (aterkommande) {
      await skapaUppgiftSerie({
        titel: titel.trim(),
        beskrivning,
        personId,
        kundId,
        typId,
        uppgiftsprojektId,
        prioritet,
        startDatum: deadline,
        veckodagar,
        intervallVeckor,
        slutDatum: slutDatum || null,
        tidsatgangTimmar,
        klockslag: klockslagVarde,
      })
    } else {
      await skapaUppgift({
        titel: titel.trim(),
        beskrivning,
        personId,
        kundId,
        typId,
        uppgiftsprojektId,
        prioritet,
        deadline: deadline || null,
        status,
        tidsatgangTimmar,
        klockslag: klockslagVarde,
        deltagareIds,
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
        <div className="flex items-center justify-between gap-2">
          <h2 id="uppgift-formular-title" className="text-lg font-semibold">
            {existing ? 'Redigera uppgift' : 'Ny uppgift'}
          </h2>
          {existing && (
            <DeleteIconButton
              label={`Ta bort uppgiften "${existing.titel}"`}
              onClick={() => setVisaBekraftelse(true)}
            />
          )}
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
            <KundValjare id="uppgift-kund" kunder={kunder} value={kundId ?? ''} onChange={setKundId} />
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

          <Field label="Projekt" htmlFor="uppgift-projekt">
            <Select
              id="uppgift-projekt"
              value={uppgiftsprojektId ?? ''}
              onChange={(e) => setUppgiftsprojektId(e.target.value)}
            >
              <option value="">Inget</option>
              {projekt.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.namn}
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

          {!aterkommande && (
            <Field label="Status" htmlFor="uppgift-status">
              <Select id="uppgift-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="oppen">Öppen</option>
                <option value="pagar">Pågår</option>
                <option value="vantar">Väntar</option>
                <option value="klar">Klar</option>
              </Select>
            </Field>
          )}

          <Field
            label={aterkommande ? 'Tidsåtgång (standard för serien)' : 'Tidsåtgång (timmar)'}
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
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label={aterkommande ? 'Startdatum' : 'Dag'} htmlFor="uppgift-deadline">
            <Input
              type="date"
              id="uppgift-deadline"
              value={deadline ?? ''}
              onChange={(e) => setDeadline(e.target.value)}
              required={aterkommande}
            />
          </Field>

          <Field label={aterkommande ? 'Klockslag (för alla förekomster)' : 'Klockslag'} htmlFor="uppgift-klockslag">
            <Input
              type="time"
              id="uppgift-klockslag"
              value={klockslag}
              onChange={(e) => setKlockslag(e.target.value)}
            />
          </Field>
        </div>

        {!existing?.serie_id && (
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
            {existing && aterkommande && (
              <p className="mt-1 text-xs text-stone-400">
                Den här uppgiften blir den första förekomsten i en ny serie.
              </p>
            )}

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
                </Field>
              </div>
            )}
          </div>
        )}

        {!aterkommande &&
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

        {existing?.id && typer.find((t) => t.id === typId)?.visar_motesanteckningar && (
          <MotesanteckningarSektion
            uppgiftId={existing.id}
            blocks={block}
            status={status}
            initialAnteckningar={existing.uppgift_anteckning}
            initialAutoSkapaUppgifterVidKlar={
              existing.skapa_uppgifter_vid_klar ??
              typer.find((t) => t.id === typId)?.skapa_uppgifter_vid_klar ??
              false
            }
          />
        )}

        {existing?.id && kundId && typer.find((t) => t.id === typId)?.visar_motesanteckningar && (
          <TidigareMotenSektion
            kundId={kundId}
            excludeUppgiftId={existing.id}
            kundNamn={kunder.find((k) => k.id === kundId)?.namn ?? ''}
          />
        )}

        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Avbryt
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={sparar}
            disabled={!titel.trim() || (aterkommande && (!deadline || veckodagar.length === 0))}
          >
            {existing ? 'Spara' : 'Skapa'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
