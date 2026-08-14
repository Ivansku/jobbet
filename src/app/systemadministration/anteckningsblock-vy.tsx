'use client'

import { useState } from 'react'
import {
  skapaAnteckningsblock,
  uppdateraAnteckningsblock,
  sattAnteckningsblockAktiv,
  flyttaAnteckningsblock,
} from './actions'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge } from '@/components/ui/badge'

type Anteckningsblock = {
  id: string
  namn: string
  sortordning: number
  aktiv: boolean
  genererar_uppgift: boolean
  uppgift_titel_mall: string | null
  uppgift_typ_id: string | null
  deadline_dagar_efter_motet: number | null
  kundvisning_standard: boolean
}

type Uppgiftstyp = { id: string; namn: string }

function ChevronUpIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 15l-6-6-6 6" />
    </svg>
  )
}

function ChevronDownIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

export function AnteckningsblockVy({
  block,
  typer,
}: {
  block: Anteckningsblock[]
  typer: Uppgiftstyp[]
}) {
  const [redigerar, setRedigerar] = useState<Anteckningsblock | 'ny' | null>(null)
  const sorterade = [...block].sort((a, b) => a.sortordning - b.sortordning)

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Anteckningsblock</h2>
        <Button variant="primary" onClick={() => setRedigerar('ny')}>
          Lägg till block
        </Button>
      </div>

      {sorterade.length === 0 ? (
        <EmptyState
          title="Inga anteckningsblock ännu"
          description="Lägg till block som ska visas på mötesuppgifter."
        />
      ) : (
        <ul className="divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-subtle bg-surface">
          {sorterade.map((b, i) => (
            <li key={b.id} className="flex items-center gap-1 px-2 py-1.5">
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => flyttaAnteckningsblock(b.id, 'upp')}
                  disabled={i === 0}
                  aria-label={`Flytta "${b.namn}" upp`}
                  className="rounded p-1 text-stone-400 transition-colors hover:bg-stone-100 disabled:opacity-30 dark:hover:bg-stone-800"
                >
                  <ChevronUpIcon className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => flyttaAnteckningsblock(b.id, 'ner')}
                  disabled={i === sorterade.length - 1}
                  aria-label={`Flytta "${b.namn}" ner`}
                  className="rounded p-1 text-stone-400 transition-colors hover:bg-stone-100 disabled:opacity-30 dark:hover:bg-stone-800"
                >
                  <ChevronDownIcon className="h-3.5 w-3.5" />
                </button>
              </div>
              <button
                onClick={() => setRedigerar(b)}
                className="flex flex-1 items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-stone-50 dark:hover:bg-stone-800"
              >
                <span className="truncate">{b.namn}</span>
                <div className="flex items-center gap-2">
                  {!b.aktiv && <Badge>Inaktiv</Badge>}
                  <span className="text-xs text-stone-400">Redigera</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {redigerar && (
        <AnteckningsblockFormular
          existing={redigerar === 'ny' ? null : redigerar}
          typer={typer}
          onClose={() => setRedigerar(null)}
        />
      )}
    </>
  )
}

function AnteckningsblockFormular({
  existing,
  typer,
  onClose,
}: {
  existing: Anteckningsblock | null
  typer: Uppgiftstyp[]
  onClose: () => void
}) {
  const [namn, setNamn] = useState(existing?.namn ?? '')
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
      genererarUppgift,
      uppgiftTitelMall,
      uppgiftTypId,
      deadlineDagarEfterMotet: deadlineDagarEfterMotet.trim() === '' ? null : Number(deadlineDagarEfterMotet),
      kundvisningStandard,
    }

    const resultat = existing
      ? await uppdateraAnteckningsblock(existing.id, input)
      : await skapaAnteckningsblock(input)

    if (resultat?.error) {
      setFel(resultat.error)
      setSparar(false)
      return
    }

    if (existing && existing.aktiv !== aktiv) {
      await sattAnteckningsblockAktiv(existing.id, aktiv)
    }

    setSparar(false)
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
