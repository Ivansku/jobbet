'use client'

import { useEffect, useState } from 'react'
import {
  hamtaUppgifterForProjekt,
  skapaProjekt,
  uppdateraProjekt,
  taBortProjekt,
  taBortProjektMedUppgifter,
} from './actions'
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
  antalUppgifter: number
  antalKlara: number
}

type ProjektUppgift = {
  id: string
  titel: string
  status: string
  deadline: string | null
  ansvarigNamn: string | null
}

const STATUS_LABEL: Record<string, string> = { aktivt: 'Aktivt', pausat: 'Pausat', avslutat: 'Avslutat' }
const STATUS_TONE: Record<string, 'success' | 'warning' | 'neutral'> = {
  aktivt: 'success',
  pausat: 'warning',
  avslutat: 'neutral',
}

export function ProjektVy({ projekt, kunder, mallar }: { projekt: Projekt[]; kunder: Kund[]; mallar: Mall[] }) {
  const [redigerar, setRedigerar] = useState<Projekt | 'ny' | null>(null)

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Projekt</h1>
        <Button variant="primary" onClick={() => setRedigerar('ny')}>
          Nytt projekt
        </Button>
      </div>

      {projekt.length === 0 ? (
        <EmptyState title="Inga projekt ännu" description="Lägg till ditt första projekt för att komma igång." />
      ) : (
        <ul className="divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-subtle bg-surface">
          {projekt.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => setRedigerar(p)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors hover:bg-stone-50 dark:hover:bg-stone-800"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-medium">{p.namn}</span>
                  <Badge tone={STATUS_TONE[p.status] ?? 'neutral'}>{STATUS_LABEL[p.status] ?? p.status}</Badge>
                </span>
                <span className="flex shrink-0 items-center gap-3 text-xs text-stone-400">
                  <span>{p.kundNamn ?? 'Internt'}</span>
                  <span>
                    {p.antalKlara} av {p.antalUppgifter} klara
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {redigerar && (
        <ProjektFormular
          kunder={kunder}
          mallar={mallar}
          existing={redigerar === 'ny' ? null : redigerar}
          onClose={() => setRedigerar(null)}
        />
      )}
    </>
  )
}

function idagISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function ProjektFormular({
  kunder,
  mallar,
  existing,
  onClose,
}: {
  kunder: Kund[]
  mallar: Mall[]
  existing: Projekt | null
  onClose: () => void
}) {
  const [mallId, setMallId] = useState('')
  const [namn, setNamn] = useState(existing?.namn ?? '')
  const [kundId, setKundId] = useState(existing?.kundId ?? '')
  const [status, setStatus] = useState(existing?.status ?? 'aktivt')
  const [startdatum, setStartdatum] = useState(existing?.startdatum ?? idagISO())
  const [beskrivning, setBeskrivning] = useState(existing?.beskrivning ?? '')
  const [uppgifter, setUppgifter] = useState<ProjektUppgift[] | null>(null)
  const [sparar, setSparar] = useState(false)
  const [bekraftaTaBort, setBekraftaTaBort] = useState<'kopplaLoss' | 'medUppgifter' | null>(null)
  const [tarBort, setTarBort] = useState(false)

  useEffect(() => {
    if (!existing) return
    let aktiv = true
    hamtaUppgifterForProjekt(existing.id).then((rader) => {
      if (aktiv) setUppgifter(rader)
    })
    return () => {
      aktiv = false
    }
  }, [existing])

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
              {uppgifter && (
                <span className="text-xs text-stone-400">
                  {uppgifter.filter((u) => u.status === 'klar').length} av {uppgifter.length} klara
                </span>
              )}
            </div>

            {!uppgifter || uppgifter.length === 0 ? (
              <p className="text-xs text-stone-400">Inga uppgifter i projektet ännu.</p>
            ) : (
              <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle">
                {uppgifter.map((u) => (
                  <li key={u.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className={`truncate ${u.status === 'klar' ? 'text-stone-400 line-through' : ''}`}>
                      {u.titel}
                    </span>
                    <span className="shrink-0 text-xs text-stone-400">
                      {u.ansvarigNamn ?? ''} {u.deadline ?? ''}
                    </span>
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
