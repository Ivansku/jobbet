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
import { flyttaUppgift, uppdateraStatus } from './actions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { ROD_DAG_STREGMONSTER_KLASS, HALVDAG_MASK_KLASS } from '@/lib/svenska-dagar'
import { SerieVy, SerieFormular } from './serie-vy'
import { UppgiftFormular } from './uppgift-formular'
import type {
  Person,
  Kund,
  Typ,
  Kategori,
  Projekt,
  Anteckningsblock,
  OppenPlaceholder,
  Uppgift,
  Kontaktperson,
  Serie,
} from './uppgift-formular'
import { projektKortBakgrund } from '@/lib/projekt-farg'

type Kolumn = { key: string; label: string; datum: string | null }
type DagInfo = { rodDag: boolean; helgdag: string | null; halvdag: boolean }

const VECKODAGAR = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag']
const ARBETSDAGAR_PER_VECKA = 5

function formatTimmar(timmar: number): string {
  return Number(timmar.toFixed(1)).toString()
}

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

function BeskrivningIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 3v5a1 1 0 0 0 1 1h5" />
      <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </svg>
  )
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
  dagInfo,
  today,
  uppgifter,
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
  foretagId,
  arbetstimmarPerVecka,
  prevVeckaHref,
  nextVeckaHref,
  idagHref,
}: {
  weekDates: string[]
  dagInfo: Record<string, DagInfo>
  today: string
  uppgifter: Uppgift[]
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
  foretagId: string | null
  arbetstimmarPerVecka: number
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
          const arPlaceholder = (rad.ar_placeholder as boolean | undefined) ?? false
          const horHemma = !arPlaceholder && (deadline === null || inomVisadVecka(deadline, mandagTid, sondagTid))

          setLiveUppgifter((state) => {
            const befintlig = state.find((u) => u.id === rad.id)
            if (!horHemma) {
              // Hör inte hemma i vyn — antingen placeholder (visas aldrig) eller en
              // annan veckas uppgift. Ta bort om den redan fanns, lägg aldrig till en ny.
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
              kategori_id: (rad.kategori_id as string | null) ?? null,
              projekt_id: (rad.projekt_id as string | null) ?? null,
              serie_id: (rad.serie_id as string | null) ?? null,
              sortordning: rad.sortordning as number,
              tidsatgang_timmar: (rad.tidsatgang_timmar as number | null) ?? null,
              klockslag: (rad.klockslag as string | null) ?? null,
              ar_placeholder: (rad.ar_placeholder as boolean | undefined) ?? false,
              anteckningsmall_id: (rad.anteckningsmall_id as string | null) ?? null,
              utan_anteckningsmall: (rad.utan_anteckningsmall as boolean | undefined) ?? false,
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
  const kategoriMap = new Map(kategori.map((k) => [k.id, k.namn]))
  const projektFargMap = new Map(projekt.map((p) => [p.id, p.farg]))
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
            <SerieVy serier={serier} personer={personer} kunder={kunder} typer={typer} kategori={kategori} />
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
              dag={kol.datum ? dagInfo[kol.datum] : undefined}
              today={today}
              uppgifter={uppgifterVy
                .filter((u) => kolumnForUppgift(u) === kol.datum)
                .sort((a, b) => a.sortordning - b.sortordning)}
              personMap={personMap}
              kundMap={kundMap}
              typMap={typMap}
              kategoriMap={kategoriMap}
              projektFargMap={projektFargMap}
              currentPersonId={currentPersonId}
              kapacitetPerDag={arbetstimmarPerVecka / ARBETSDAGAR_PER_VECKA}
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
            className={`rounded-xl border border-border-subtle border-l-4 p-3 shadow-lg ${projektKortBakgrund(
              aktivUppgift.projekt_id ? projektFargMap.get(aktivUppgift.projekt_id) : null
            )} ${PRIORITET_BORDER[aktivUppgift.prioritet] ?? PRIORITET_BORDER.medel} ${
              aktivUppgift.status === 'klar' ? 'opacity-60' : ''
            }`}
          >
            <KortInnehall
              uppgift={aktivUppgift}
              today={today}
              personMap={personMap}
              kundMap={kundMap}
              typMap={typMap}
              kategoriMap={kategoriMap}
            />
          </div>
        ) : null}
      </DragOverlay>

      {redigerar && (
        <UppgiftFormular
          existing={redigerar === 'ny' ? null : redigerar}
          placeholders={placeholders}
          personer={personer}
          kunder={kunder}
          typer={typer}
          kategori={kategori}
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
          kategori={kategori}
          onClose={() => setRedigerarSerie(null)}
        />
      )}
    </DndContext>
  )
}

function KanbanColumn({
  kol,
  dag,
  today,
  uppgifter,
  personMap,
  kundMap,
  typMap,
  kategoriMap,
  projektFargMap,
  currentPersonId,
  kapacitetPerDag,
  onSelect,
  onToggleStatus,
  onAddNew,
}: {
  kol: Kolumn
  dag?: DagInfo
  today: string
  uppgifter: Uppgift[]
  personMap: Map<string, string>
  kundMap: Map<string, string>
  typMap: Map<string, string>
  kategoriMap: Map<string, string>
  projektFargMap: Map<string, string | null>
  currentPersonId: string | null
  kapacitetPerDag: number
  onSelect: (u: Uppgift) => void
  onToggleStatus: (u: Uppgift) => void
  onAddNew: (datum: string | null) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: kol.key })
  const arIdag = kol.datum === today
  // Planerat/kapacitet är personligt (bara inloggad användares egna uppgifter den dagen) —
  // till skillnad från kolumnens övriga innehåll, som visar allas uppgifter.
  const planeratTimmar = uppgifter
    .filter((u) => u.person_id === currentPersonId)
    .reduce((sum, u) => sum + (u.tidsatgang_timmar ?? 0), 0)

  // Röd dag/halvdag markeras med diagonala streck ovanpå standardbakgrunden istället för
  // en egen kulör (både rött och grönt krockade visuellt med danger-/success-färgerna
  // som redan betyder något annat i appen). Röd dag täcker hela kolumnen (inklusive
  // rubrikraden), medan halvdag bara ligger bakom kortytan (listan med kort + "Ny
  // uppgift"), eftersom halvdagens gräns ska räknas utifrån ytan där kort kan ligga,
  // inte hela kolumnens höjd. Mönstret ligger i ett eget dekorativt lager bakom det
  // riktiga innehållet (inte som mask-image direkt på elementet) — mask-image maskar
  // annars HELA elementets renderade innehåll, inte bara bakgrunden, vilket klippte
  // bort halva korten. "isolate" + "-z-10" håller lagret innanför sin egen stapling
  // istället för att läcka in bakom grannkolumner.
  const visaHeldagsMonster = !isOver && dag?.rodDag
  const visaHalvdagsMonster = !isOver && dag?.halvdag

  return (
    <div
      ref={setNodeRef}
      className={`relative isolate flex min-h-[220px] snap-start flex-col gap-2 overflow-hidden rounded-xl border p-3 transition-colors ${
        isOver ? 'border-accent-400 bg-accent-50 dark:bg-accent-950/40' : 'border-border-subtle bg-white dark:bg-stone-800/60'
      }`}
    >
      {visaHeldagsMonster && (
        <div aria-hidden className={`pointer-events-none absolute inset-0 -z-10 ${ROD_DAG_STREGMONSTER_KLASS}`} />
      )}
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-stone-500">
          {dag?.helgdag ?? kol.label}
          {kol.datum && <span className="font-normal text-stone-400">{kortDatum(kol.datum)}</span>}
          {arIdag && <span className="h-1.5 w-1.5 rounded-full bg-accent-600" aria-label="Idag" />}
        </h2>
        {kol.datum && !dag?.rodDag && (
          <span className="shrink-0 text-xs font-medium text-stone-400">
            {formatTimmar(planeratTimmar)}h/{formatTimmar(dag?.halvdag ? 4 : kapacitetPerDag)}h
          </span>
        )}
      </div>

      {/* Positioneringsomslag med samma höjd som skrollytan under (enda barnet, flex-1
          i båda), så halvdagsmönstret kan räkna sin 50%-gräns utifrån just kortytans
          höjd men ändå blöda ut i kolumnens padding på alla fyra håll (-top-3/-bottom-3/
          -left-3/-right-3) för att nå ända ut till kanterna — klipps snyggt av yttre
          overflow-hidden precis som heldagsmönstret. Blödningen är symmetrisk (lika
          mycket upp som ner) så 50%-linjen ändå hamnar exakt mitt i kortytan, inte
          förskjuten. Skrollytans egen overflow-y-auto skulle annars klippt bort den
          del av mönstret som sticker ut i paddingen. */}
      <div className="relative isolate flex flex-1 flex-col">
        {visaHalvdagsMonster && (
          <div
            aria-hidden
            className={`pointer-events-none absolute -top-3 -bottom-3 -left-3 -right-3 -z-10 ${ROD_DAG_STREGMONSTER_KLASS} ${HALVDAG_MASK_KLASS}`}
          />
        )}
        {visaHalvdagsMonster && (
          <div aria-hidden className="pointer-events-none absolute -left-3 -right-3 top-1/2 -z-10 border-t border-border-subtle" />
        )}
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
                kategoriMap={kategoriMap}
                projektFargMap={projektFargMap}
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
    </div>
  )
}

function KanbanCard({
  uppgift: u,
  today,
  personMap,
  kundMap,
  typMap,
  kategoriMap,
  projektFargMap,
  onSelect,
  onToggleStatus,
}: {
  uppgift: Uppgift
  today: string
  personMap: Map<string, string>
  kundMap: Map<string, string>
  typMap: Map<string, string>
  kategoriMap: Map<string, string>
  projektFargMap: Map<string, string | null>
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
  const bakgrund = projektKortBakgrund(u.projekt_id ? projektFargMap.get(u.projekt_id) : null)
  const klar = u.status === 'klar'

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onSelect(u)}
      className={`cursor-pointer rounded-xl border border-border-subtle border-l-4 p-3 shadow-sm transition-shadow hover:shadow-md ${bakgrund} ${border} ${
        klar ? 'opacity-60' : ''
      } ${isDragging ? 'opacity-30' : ''} ${isOver ? 'ring-2 ring-accent-400' : ''}`}
    >
      <KortInnehall
        uppgift={u}
        today={today}
        personMap={personMap}
        kundMap={kundMap}
        typMap={typMap}
        kategoriMap={kategoriMap}
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
  kategoriMap,
  onToggleStatus,
}: {
  uppgift: Uppgift
  today: string
  personMap: Map<string, string>
  kundMap: Map<string, string>
  typMap: Map<string, string>
  kategoriMap: Map<string, string>
  onToggleStatus?: (u: Uppgift) => void
}) {
  const klar = u.status === 'klar'
  const vantar = u.status === 'vantar'
  const forsenad = !!u.deadline && u.deadline < today && u.status !== 'klar'
  const ansvarigNamn = u.person_id ? personMap.get(u.person_id) : undefined
  const harBeskrivning =
    !!u.beskrivning?.trim() || u.uppgift_anteckning.some((a) => !!a.innehall?.trim())

  // Kompakt "brödsmula" (Kund · Kategori · Typ) istället för en badge per fält —
  // ger samma överblick som den gamla "Kunden: Projekt: Typ - text"-konventionen,
  // men som kontext ovanför titeln snarare än utspritt i badges. Visar kategorin
  // oavsett om uppgiften hör till ett projekt — projektets eget namn är redundant
  // här eftersom det redan syns via kundnamnet.
  const kontext = [
    u.kund_id && kundMap.get(u.kund_id),
    u.kategori_id && kategoriMap.get(u.kategori_id),
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
      {(forsenad || vantar || ansvarigNamn || u.tidsatgang_timmar || harBeskrivning) && (
        <div className="mt-1.5 flex items-center justify-between gap-1">
          <div className="flex flex-wrap gap-1">
            {forsenad && <Badge tone="danger">Försenad</Badge>}
            {vantar && <Badge tone="warning">Väntar</Badge>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {harBeskrivning && (
              <span title="Har beskrivning eller anteckning">
                <BeskrivningIcon className="h-3 w-3 text-stone-400" />
              </span>
            )}
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
