'use client'

import { useState } from 'react'
import {
  skapaProjekt,
  uppdateraProjekt,
  taBortProjekt,
  taBortProjektMedUppgifter,
  hamtaProjektUppgifter,
  skapaUppgifterFranMall,
} from './actions'
import { ProjektUppgiftFormular, type ProjektUppgiftDetaljerad, type Typ, type Anteckningsblock } from './projekt-uppgift-formular'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge } from '@/components/ui/badge'
import { DeleteIconButton } from '@/components/ui/delete-icon-button'
import { KundValjare } from '../uppgifter/kund-valjare'

type Kund = { id: string; namn: string }
type Mall = { id: string; namn: string }
type Projekt = {
  id: string
  namn: string
  status: string
  beskrivning: string | null
  startdatum: string
  kundId: string | null
  kundNamn: string | null
  mallProjektId: string | null
  antalUppgifter: number
  antalKlara: number
  uppgifter: ProjektUppgift[]
}

type ProjektUppgift = ProjektUppgiftDetaljerad & { ansvarigNamn: string | null }

const STATUS_LABEL: Record<string, string> = {
  planerat: 'Planerat',
  aktivt: 'Aktivt',
  pausat: 'Pausat',
  avslutat: 'Avslutat',
}
const STATUS_TONE: Record<string, 'success' | 'warning' | 'neutral'> = {
  planerat: 'neutral',
  aktivt: 'success',
  pausat: 'warning',
  avslutat: 'neutral',
}

export function ProjektVy({
  projekt,
  kunder,
  mallar,
  typer,
  block,
}: {
  projekt: Projekt[]
  kunder: Kund[]
  mallar: Mall[]
  typer: Typ[]
  block: Anteckningsblock[]
}) {
  const [redigerar, setRedigerar] = useState<Projekt | 'ny' | null>(null)
  const [nyMallId, setNyMallId] = useState<string | null>(null)

  function oppnaNy(mallId: string | null) {
    setNyMallId(mallId)
    setRedigerar('ny')
  }

  const mallIdSet = new Set(mallar.map((m) => m.id))
  const utanMall = projekt.filter((p) => !p.mallProjektId || !mallIdSet.has(p.mallProjektId))

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
              projekt={projekt.filter((p) => p.mallProjektId === mall.id)}
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
                <span className="truncate font-medium">{p.namn}</span>
                <Badge tone={STATUS_TONE[p.status] ?? 'neutral'}>{STATUS_LABEL[p.status] ?? p.status}</Badge>
              </div>
              <div className="flex items-center justify-between gap-2 text-xs text-stone-400">
                <span className="truncate">{p.kundNamn ?? 'Internt'}</span>
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

function idagISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function ProjektFormular({
  kunder,
  mallar,
  typer,
  block,
  existing,
  initialMallId,
  onClose,
}: {
  kunder: Kund[]
  mallar: Mall[]
  typer: Typ[]
  block: Anteckningsblock[]
  existing: Projekt | null
  initialMallId: string | null
  onClose: () => void
}) {
  const [mallId, setMallId] = useState(initialMallId ?? '')
  const [namn, setNamn] = useState(existing?.namn ?? '')
  const [kundId, setKundId] = useState(existing?.kundId ?? '')
  const [status, setStatus] = useState(existing?.status ?? 'aktivt')
  const [startdatum, setStartdatum] = useState(existing?.startdatum ?? idagISO())
  const [beskrivning, setBeskrivning] = useState(existing?.beskrivning ?? '')
  const [uppgifter, setUppgifter] = useState<ProjektUppgift[]>(existing?.uppgifter ?? [])
  const [redigerarUppgift, setRedigerarUppgift] = useState<ProjektUppgift | null>(null)
  const [sparar, setSparar] = useState(false)
  const [bekraftaTaBort, setBekraftaTaBort] = useState<'kopplaLoss' | 'medUppgifter' | null>(null)
  const [tarBort, setTarBort] = useState(false)
  const [skapaUppgifterLaddar, setSkapaUppgifterLaddar] = useState(false)

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
      await uppdateraProjekt(existing.id, { namn, status, beskrivning, kundId, startdatum })
    } else {
      await skapaProjekt({ kundId, namn, status, beskrivning, startdatum, mallProjektId: mallId })
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
      <ProjektUppgiftFormular
        uppgift={redigerarUppgift}
        projektId={existing.id}
        typer={typer}
        block={block}
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
          <Textarea
            id="projekt-beskrivning"
            value={beskrivning ?? ''}
            onChange={(e) => setBeskrivning(e.target.value)}
            rows={3}
          />
        </Field>

        {existing && (
          <div className="border-t border-border-subtle pt-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-500">Uppgifter</h3>
              <span className="text-xs text-stone-400">
                {uppgifter.filter((u) => u.status === 'klar').length} av {uppgifter.length} klara
              </span>
            </div>

            {uppgifter.length === 0 ? (
              existing.mallProjektId ? (
                <div className="flex flex-col items-start gap-2">
                  <p className="text-xs text-stone-400">
                    Inga uppgifter skapade än — mallen är kopplad men väntar på att aktiveras.
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
              ) : (
                <p className="text-xs text-stone-400">Inga uppgifter i projektet ännu.</p>
              )
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
