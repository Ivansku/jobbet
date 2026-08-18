'use client'

import { useState } from 'react'
import {
  skapaManuellAnteckning,
  uppdateraManuellAnteckning,
  taBortManuellAnteckning,
  type ManuellAnteckning,
} from './manuell-anteckning-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { DeleteIconButton } from '@/components/ui/delete-icon-button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { MarkdownEditor } from '@/components/ui/markdown-editor'
import { DeltagareValjare } from '../uppgifter/deltagare-valjare'

type Kontaktperson = {
  id: string
  kund_id: string
  fornamn: string | null
  efternamn: string | null
  epost: string | null
}

function idagSomDatum() {
  return new Date().toISOString().slice(0, 10)
}

// Klick på en rad expanderar den direkt i redigeringsläge — ingen separat
// läsvy/Redigera-knapp, samma mönster som blocken i uppgifternas
// mötesanteckningar (motesanteckningar-sektion.tsx) där man alltid redigerar
// direkt istället för att växla mellan visa/redigera.
export function KundManuellaAnteckningarSektion({
  kundId,
  anteckningar,
  kontaktpersoner,
}: {
  kundId: string
  anteckningar: ManuellAnteckning[]
  kontaktpersoner: Kontaktperson[]
}) {
  const [oppenId, setOppenId] = useState<string | 'ny' | null>(null)
  const [tarBort, setTarBort] = useState<ManuellAnteckning | null>(null)
  const [tarBortPagar, setTarBortPagar] = useState(false)

  function toggle(id: string) {
    setOppenId((nuvarande) => (nuvarande === id ? null : id))
  }

  async function handleTaBort() {
    if (!tarBort) return
    setTarBortPagar(true)
    await taBortManuellAnteckning(tarBort.id)
    setTarBortPagar(false)
    if (oppenId === tarBort.id) setOppenId(null)
    setTarBort(null)
  }

  return (
    <div className="border-t border-border-subtle pt-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-stone-500">Anteckningar</h3>
        <Button type="button" variant="secondary" size="sm" onClick={() => setOppenId('ny')}>
          Lägg till
        </Button>
      </div>

      {anteckningar.length === 0 && oppenId !== 'ny' ? (
        <p className="text-xs text-stone-400">Inga anteckningar ännu.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {anteckningar.map((a) => (
            <li key={a.id} className="rounded-lg border border-border-subtle">
              {oppenId === a.id ? (
                <ManuellAnteckningFormular
                  kundId={kundId}
                  existing={a}
                  kontaktpersoner={kontaktpersoner}
                  onClose={() => setOppenId(null)}
                />
              ) : (
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => toggle(a.id)}
                    className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left text-sm transition-colors hover:text-accent-600 dark:hover:text-accent-400"
                  >
                    <span className="truncate">{a.titel}</span>
                    <span className="shrink-0 text-xs text-stone-400">{a.datum}</span>
                  </button>
                  <DeleteIconButton label={`Ta bort anteckningen "${a.titel}"`} onClick={() => setTarBort(a)} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {oppenId === 'ny' && (
        <div className="mt-2 rounded-lg border border-border-subtle">
          <ManuellAnteckningFormular
            kundId={kundId}
            existing={null}
            kontaktpersoner={kontaktpersoner}
            onClose={() => setOppenId(null)}
          />
        </div>
      )}

      {tarBort && (
        <ConfirmDialog
          title={`Ta bort anteckningen "${tarBort.titel}"?`}
          loading={tarBortPagar}
          onConfirm={handleTaBort}
          onCancel={() => setTarBort(null)}
        />
      )}
    </div>
  )
}

function ManuellAnteckningFormular({
  kundId,
  existing,
  kontaktpersoner,
  onClose,
}: {
  kundId: string
  existing: ManuellAnteckning | null
  kontaktpersoner: Kontaktperson[]
  onClose: () => void
}) {
  const [titel, setTitel] = useState(existing?.titel ?? '')
  const [datum, setDatum] = useState(existing?.datum ?? idagSomDatum())
  const [innehall, setInnehall] = useState(existing?.innehall ?? '')
  const [kontaktpersonIds, setKontaktpersonIds] = useState<string[]>(existing?.kontaktperson_ids ?? [])
  const [sparar, setSparar] = useState(false)

  async function handleSpara() {
    if (!titel.trim() || !datum) return
    setSparar(true)
    if (existing) {
      await uppdateraManuellAnteckning(existing.id, { titel, datum, innehall, kontaktpersonIds })
    } else {
      await skapaManuellAnteckning({ kundId, titel, datum, innehall, kontaktpersonIds })
    }
    setSparar(false)
    onClose()
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Titel" htmlFor="anteckning-titel">
          <Input
            id="anteckning-titel"
            value={titel}
            onChange={(e) => setTitel(e.target.value)}
            placeholder="Titel"
            autoFocus
          />
        </Field>
        <Field label="Datum" htmlFor="anteckning-datum">
          <Input type="date" id="anteckning-datum" value={datum} onChange={(e) => setDatum(e.target.value)} />
        </Field>
      </div>
      <Field label="Kontaktpersoner" htmlFor="anteckning-deltagare">
        <DeltagareValjare
          kontaktpersoner={kontaktpersoner}
          kundId={kundId}
          value={kontaktpersonIds}
          onChange={setKontaktpersonIds}
        />
      </Field>
      <Field label="Anteckning" htmlFor="anteckning-innehall">
        <MarkdownEditor id="anteckning-innehall" value={innehall} onChange={setInnehall} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>
          Avbryt
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          loading={sparar}
          disabled={!titel.trim() || !datum}
          onClick={handleSpara}
        >
          Spara
        </Button>
      </div>
    </div>
  )
}
