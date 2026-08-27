'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  skapaProjekt,
  uppdateraProjekt,
  taBortProjekt,
  taBortProjektMedUppgifter,
  hamtaProjektUppgifter,
  skapaUppgifterFranMall,
} from './actions'
import { UppgiftFormular } from '../uppgifter/uppgift-formular'
import type {
  Uppgift,
  Typ,
  Anteckningsblock,
  Kategori,
  Projekt as FormularProjekt,
  Serie,
  Kontaktperson,
  OppenPlaceholder,
  Person,
} from '../uppgifter/uppgift-formular'
import type { TidigareMote } from '../uppgifter/tidigare-moten-sektion'
import { ProjektAnteckningarSektion } from './projekt-anteckningar-sektion'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { MarkdownEditor } from '@/components/ui/markdown-editor'
import { Field } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge } from '@/components/ui/badge'
import { DeleteIconButton } from '@/components/ui/delete-icon-button'
import { KundValjare } from '../uppgifter/kund-valjare'
import { PROJEKT_FARGER } from '@/lib/projekt-farg'

type Kund = { id: string; namn: string }
type Mall = { id: string; namn: string; anteckningsmall_id: string | null }
type Projekt = {
  id: string
  namn: string
  status: string
  beskrivning: string | null
  startdatum: string
  kundId: string | null
  kundNamn: string | null
  mallProjektId: string | null
  farg: string | null
  antalUppgifter: number
  antalKlara: number
  uppgifter: ProjektUppgift[]
  projektAnteckningar: { block_id: string; innehall: string }[]
}

type ProjektUppgift = Uppgift & { ansvarigNamn: string | null; mall_uppgift_id: string | null }

const STATUS_LABEL: Record<string, string> = {
  planerat: 'Planerat',
  aktivt: 'Aktivt',
  pausat: 'Pausat',
  avslutat: 'Avslutat',
}
const STATUS_TONE: Record<string, 'success' | 'warning' | 'neutral' | 'accent'> = {
  planerat: 'neutral',
  aktivt: 'success',
  pausat: 'warning',
  avslutat: 'accent',
}

// Kortens ordning inom varje kolumn: Aktiva → Pausat → Planerat → Avslutat, och
// inom samma status högst klar-procent överst. Avviker medvetet från STATUS_LABEL/
// STATUS_TONE-ordningen ovan, som bara styr etikett/färg och inte sorteringen.
const STATUS_SORTORDNING: Record<string, number> = { aktivt: 0, pausat: 1, planerat: 2, avslutat: 3 }

function projektFramsteg(p: Projekt) {
  return p.antalUppgifter > 0 ? p.antalKlara / p.antalUppgifter : 0
}

export function ProjektVy({
  projekt,
  kunder,
  mallar,
  typer,
  block,
  kategori,
  projektLista,
  serier,
  kontaktpersoner,
  placeholders,
  personer,
  tidigareDialoger,
}: {
  projekt: Projekt[]
  kunder: Kund[]
  mallar: Mall[]
  typer: Typ[]
  block: Anteckningsblock[]
  kategori: Kategori[]
  projektLista: FormularProjekt[]
  serier: Serie[]
  kontaktpersoner: Kontaktperson[]
  placeholders: OppenPlaceholder[]
  personer: Person[]
  tidigareDialoger: Record<string, TidigareMote[]>
}) {
  const [redigerar, setRedigerar] = useState<Projekt | 'ny' | null>(null)
  const [nyMallId, setNyMallId] = useState<string | null>(null)

  function oppnaNy(mallId: string | null) {
    setNyMallId(mallId)
    setRedigerar('ny')
  }

  const sorteradeProjekt = [...projekt].sort((a, b) => {
    const statusDiff = (STATUS_SORTORDNING[a.status] ?? 99) - (STATUS_SORTORDNING[b.status] ?? 99)
    return statusDiff !== 0 ? statusDiff : projektFramsteg(b) - projektFramsteg(a)
  })

  const mallIdSet = new Set(mallar.map((m) => m.id))
  const utanMall = sorteradeProjekt.filter((p) => !p.mallProjektId || !mallIdSet.has(p.mallProjektId))

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Projekt</h1>
        <Button variant="primary" onClick={() => oppnaNy(null)}>
          Nytt projekt
        </Button>
      </div>

      {mallar.length === 0 ? (
        <EmptyState
          title="Inga projektmallar ännu"
          description="Skapa en projektmall under Systemadministration → Projektmallar för att kunna lägga till projekt här."
        />
      ) : (
        <div className="flex items-start gap-4 overflow-x-auto pb-2">
          {mallar.map((mall) => (
            <ProjektKolumn
              key={mall.id}
              namn={mall.namn}
              projekt={sorteradeProjekt.filter((p) => p.mallProjektId === mall.id)}
              onSelect={setRedigerar}
              onAddNew={() => oppnaNy(mall.id)}
            />
          ))}
          {utanMall.length > 0 && (
            <ProjektKolumn namn="Utan mall" projekt={utanMall} onSelect={setRedigerar} />
          )}
        </div>
      )}

      {redigerar && (
        <ProjektFormular
          kunder={kunder}
          mallar={mallar}
          typer={typer}
          block={block}
          kategori={kategori}
          projektLista={projektLista}
          serier={serier}
          kontaktpersoner={kontaktpersoner}
          placeholders={placeholders}
          personer={personer}
          tidigareDialoger={tidigareDialoger}
          existing={redigerar === 'ny' ? null : redigerar}
          initialMallId={nyMallId}
          onClose={() => setRedigerar(null)}
        />
      )}
    </>
  )
}

function ProjektKolumn({
  namn,
  projekt,
  onSelect,
  onAddNew,
}: {
  namn: string
  projekt: Projekt[]
  onSelect: (p: Projekt) => void
  onAddNew?: () => void
}) {
  return (
    <div className="flex min-h-[160px] w-72 shrink-0 flex-col gap-2 rounded-xl border border-border-subtle bg-white p-3 dark:bg-stone-800/60">
      <div className="flex items-center justify-between gap-2">
        <h2 className="truncate text-sm font-semibold text-stone-500">{namn}</h2>
        <span className="shrink-0 text-xs font-medium text-stone-400">{projekt.length}</span>
      </div>

      <div className="flex flex-col gap-2">
        {projekt.length === 0 ? (
          <p className="py-4 text-center text-xs text-stone-400">Inga projekt</p>
        ) : (
          projekt.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p)}
              className="flex flex-col gap-1 rounded-lg border border-border-subtle bg-surface p-3 text-left text-sm shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  {p.farg && (
                    <span
                      aria-hidden
                      className={`h-2 w-2 shrink-0 rounded-full ${PROJEKT_FARGER.find((f) => f.value === p.farg)?.dot ?? ''}`}
                    />
                  )}
                  <span className="truncate font-medium">{p.kundNamn ?? 'Internt'}</span>
                </span>
                <Badge tone={STATUS_TONE[p.status] ?? 'neutral'}>{STATUS_LABEL[p.status] ?? p.status}</Badge>
              </div>
              <div className="flex items-center justify-between gap-2 text-xs text-stone-400">
                <span className="truncate">{p.namn}</span>
                <span className="shrink-0">
                  {p.antalKlara} av {p.antalUppgifter} klara
                </span>
              </div>
            </button>
          ))
        )}

        {onAddNew && (
          <button
            type="button"
            onClick={onAddNew}
            className="mt-auto rounded-lg px-2 py-1.5 text-center text-xs text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-stone-700 dark:hover:text-stone-300"
          >
            + Nytt projekt
          </button>
        )}
      </div>
    </div>
  )
}

// Fast palett av namngivna toner istället för en fri hex-väljare — säkerställer att
// varje val redan har ljust/mörkt-läge-varianter definierade och matchar databasens
// CHECK-constraint (se @/lib/projekt-farg). "Ingen" nollställer till standardytan.
//
// Markeringen ritas som en ring (box-shadow) direkt på swatchen istället för en
// nästlad border+prick-struktur — en nästlad prick centrerades inte pålitligt i alla
// browsers, medan en ring alltid beräknas utifrån elementets egen box och därför
// garanterat blir koncentrisk.
function FargValjare({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const RING_VALD = 'ring-2 ring-accent-500 ring-offset-2 ring-offset-surface'
  const RING_OVALD =
    'ring-1 ring-inset ring-black/10 hover:ring-2 hover:ring-stone-300 hover:ring-offset-2 hover:ring-offset-surface dark:ring-white/10'

  return (
    <div role="group" aria-label="Färg" className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(null)}
        aria-pressed={value === null}
        title="Ingen färg"
        className={`h-7 w-7 rounded-full bg-stone-100 transition-shadow dark:bg-stone-800 ${
          value === null ? RING_VALD : RING_OVALD
        }`}
      >
        <span className="sr-only">Ingen färg</span>
      </button>
      {PROJEKT_FARGER.map((f) => (
        <button
          key={f.value}
          type="button"
          onClick={() => onChange(f.value)}
          aria-pressed={value === f.value}
          title={f.label}
          className={`h-7 w-7 rounded-full transition-shadow ${f.dot} ${
            value === f.value ? RING_VALD : RING_OVALD
          }`}
        >
          <span className="sr-only">{f.label}</span>
        </button>
      ))}
    </div>
  )
}

function idagISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function ProjektFormular({
  kunder,
  mallar,
  typer,
  block,
  kategori,
  projektLista,
  serier,
  kontaktpersoner,
  placeholders,
  personer,
  tidigareDialoger,
  existing,
  initialMallId,
  onClose,
}: {
  kunder: Kund[]
  mallar: Mall[]
  typer: Typ[]
  block: Anteckningsblock[]
  kategori: Kategori[]
  projektLista: FormularProjekt[]
  serier: Serie[]
  kontaktpersoner: Kontaktperson[]
  placeholders: OppenPlaceholder[]
  personer: Person[]
  tidigareDialoger: Record<string, TidigareMote[]>
  existing: Projekt | null
  initialMallId: string | null
  onClose: () => void
}) {
  const router = useRouter()
  const [mallId, setMallId] = useState(initialMallId ?? '')
  const [namn, setNamn] = useState(existing?.namn ?? '')
  const [kundId, setKundId] = useState(existing?.kundId ?? '')
  const [status, setStatus] = useState(existing?.status ?? 'aktivt')
  const [startdatum, setStartdatum] = useState(existing?.startdatum ?? idagISO())
  const [beskrivning, setBeskrivning] = useState(existing?.beskrivning ?? '')
  const [farg, setFarg] = useState<string | null>(existing?.farg ?? null)
  const [uppgifter, setUppgifter] = useState<ProjektUppgift[]>(existing?.uppgifter ?? [])
  const [redigerarUppgift, setRedigerarUppgift] = useState<ProjektUppgift | null>(null)
  const [sparar, setSparar] = useState(false)
  const [bekraftaTaBort, setBekraftaTaBort] = useState<'kopplaLoss' | 'medUppgifter' | null>(null)
  const [tarBort, setTarBort] = useState(false)
  const [skapaUppgifterLaddar, setSkapaUppgifterLaddar] = useState(false)

  const projektAnteckningsmallId =
    mallar.find((m) => m.id === existing?.mallProjektId)?.anteckningsmall_id ?? null
  const projektMallBlock = block.filter((b) => b.anteckningsmall_id === projektAnteckningsmallId)
  const harMallUppgifter = uppgifter.some((u) => u.mall_uppgift_id)

  async function laddaOmUppgifter() {
    if (!existing) return
    setUppgifter(await hamtaProjektUppgifter(existing.id))
  }

  async function handleSkapaUppgifterFranMall() {
    if (!existing) return
    setSkapaUppgifterLaddar(true)
    await skapaUppgifterFranMall(existing.id)
    await laddaOmUppgifter()
    setSkapaUppgifterLaddar(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!namn.trim() || !startdatum) return
    if (!existing && !mallId) return
    setSparar(true)

    if (existing) {
      await uppdateraProjekt(existing.id, { namn, status, beskrivning, kundId, startdatum, farg })
    } else {
      await skapaProjekt({ kundId, namn, status, beskrivning, startdatum, mallProjektId: mallId, farg })
    }

    setSparar(false)
    onClose()
  }

  async function handleTaBort() {
    if (!existing || !bekraftaTaBort) return
    setTarBort(true)
    if (bekraftaTaBort === 'medUppgifter') {
      await taBortProjektMedUppgifter(existing.id)
    } else {
      await taBortProjekt(existing.id)
    }
    setTarBort(false)
    onClose()
  }

  if (redigerarUppgift && existing) {
    return (
      <UppgiftFormular
        existing={redigerarUppgift}
        placeholders={placeholders}
        personer={personer}
        kunder={kunder}
        typer={typer}
        kategori={kategori}
        projekt={projektLista}
        serier={serier}
        kontaktpersoner={kontaktpersoner}
        block={block}
        tidigareDialoger={tidigareDialoger}
        currentPersonId={null}
        initialDeadline={null}
        onEditSerie={() => router.push('/uppgifter')}
        onClose={() => setRedigerarUppgift(null)}
        onChanged={laddaOmUppgifter}
      />
    )
  }

  if (bekraftaTaBort && existing) {
    const medUppgifter = bekraftaTaBort === 'medUppgifter'
    return (
      <ConfirmDialog
        title={
          medUppgifter
            ? `Ta bort projektet "${existing.namn}" och alla dess uppgifter?`
            : `Ta bort projektet "${existing.namn}"?`
        }
        description={
          medUppgifter
            ? `Detta raderar även alla ${existing.antalUppgifter} uppgifter som hör till projektet. Går inte att ångra.`
            : 'Uppgifter som hör till projektet behåller sin övriga information, men mister kopplingen till projektet.'
        }
        confirmLabel="Ta bort"
        loading={tarBort}
        onConfirm={handleTaBort}
        onCancel={() => setBekraftaTaBort(null)}
      />
    )
  }

  return (
    <Modal onClose={onClose} labelledBy="projekt-formular-title">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h2 id="projekt-formular-title" className="text-lg font-semibold">
            {existing ? 'Redigera projekt' : 'Nytt projekt'}
          </h2>
          {existing && (
            <DeleteIconButton
              label={`Ta bort projektet "${existing.namn}"`}
              onClick={() => setBekraftaTaBort('kopplaLoss')}
            />
          )}
        </div>

        {!existing && (
          <Field label="Projektmall" htmlFor="projekt-mall">
            {mallar.length === 0 ? (
              <p className="text-xs text-stone-400">
                Inga projektmallar finns än — skapa en under Systemadministration → Projektmallar först.
              </p>
            ) : (
              <Select id="projekt-mall" value={mallId} onChange={(e) => setMallId(e.target.value)} required>
                <option value="">Välj mall…</option>
                {mallar.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.namn}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}

        <Field label="Namn" htmlFor="projekt-namn">
          <Input id="projekt-namn" value={namn} onChange={(e) => setNamn(e.target.value)} required autoFocus />
        </Field>

        <Field label="Kund" htmlFor="projekt-kund">
          <KundValjare id="projekt-kund" kunder={kunder} value={kundId} onChange={setKundId} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Status" htmlFor="projekt-status">
            <Select id="projekt-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="planerat">Planerat</option>
              <option value="aktivt">Aktivt</option>
              <option value="pausat">Pausat</option>
              <option value="avslutat">Avslutat</option>
            </Select>
          </Field>

          <Field label="Startdatum" htmlFor="projekt-startdatum">
            <Input
              type="date"
              id="projekt-startdatum"
              value={startdatum}
              onChange={(e) => setStartdatum(e.target.value)}
              required
            />
          </Field>
        </div>

        <Field label="Beskrivning" htmlFor="projekt-beskrivning">
          <MarkdownEditor id="projekt-beskrivning" value={beskrivning} onChange={setBeskrivning} />
        </Field>

        <Field label="Färg" htmlFor="projekt-farg">
          <FargValjare value={farg} onChange={setFarg} />
        </Field>

        {existing && projektAnteckningsmallId && (
          <ProjektAnteckningarSektion
            projektId={existing.id}
            blocks={projektMallBlock}
            initialAnteckningar={existing.projektAnteckningar}
          />
        )}

        {existing && (
          <div className="border-t border-border-subtle pt-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-500">Uppgifter</h3>
              <span className="text-xs text-stone-400">
                {uppgifter.filter((u) => u.status === 'klar').length} av {uppgifter.length} klara
              </span>
            </div>

            {/* Mallens uppgifter kan aktiveras även när projektet redan har lösa
                uppgifter kopplade (t.ex. via "Koppla till placeholder") — kollar
                därför specifikt om någon uppgift kommer från mallen, inte bara om
                listan är tom. */}
            {existing.mallProjektId && !harMallUppgifter && (
              <div className="mb-3 flex flex-col items-start gap-2">
                <p className="text-xs text-stone-400">
                  Inga malluppgifter skapade än — mallen är kopplad men väntar på att aktiveras.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  loading={skapaUppgifterLaddar}
                  onClick={handleSkapaUppgifterFranMall}
                >
                  Skapa uppgifter från mall
                </Button>
              </div>
            )}

            {uppgifter.length === 0 ? (
              !existing.mallProjektId && <p className="text-xs text-stone-400">Inga uppgifter i projektet ännu.</p>
            ) : (
              <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle">
                {uppgifter.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => setRedigerarUppgift(u)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-stone-50 dark:hover:bg-stone-800"
                    >
                      <span className={`truncate ${u.status === 'klar' ? 'text-stone-400 line-through' : ''}`}>
                        {u.titel}
                      </span>
                      <span className="shrink-0 text-xs text-stone-400">
                        {u.ansvarigNamn ?? ''} {u.deadline ?? ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              onClick={() => setBekraftaTaBort('medUppgifter')}
              className="mt-2 text-xs font-medium text-red-600 hover:underline dark:text-red-400"
            >
              Ta bort projekt och alla uppgifter
            </button>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Avbryt
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={sparar}
            disabled={!namn.trim() || !startdatum || (!existing && !mallId)}
          >
            {existing ? 'Spara' : 'Skapa'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
