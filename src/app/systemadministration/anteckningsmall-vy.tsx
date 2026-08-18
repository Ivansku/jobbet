'use client'

import { useState } from 'react'
import {
  skapaAnteckningsmall,
  uppdateraAnteckningsmall,
  taBortAnteckningsmall,
  hamtaAnteckningsblockForMall,
  skapaAnteckningsblock,
  uppdateraAnteckningsblock,
  sattAnteckningsblockAktiv,
  flyttaAnteckningsblock,
} from './anteckningsmall-actions'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge } from '@/components/ui/badge'
import { DeleteIconButton } from '@/components/ui/delete-icon-button'

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
type Anteckningsmall = { id: string; namn: string; block: Anteckningsblock[] }
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

  async function handleFlytta(id: string, riktning: 'upp' | 'ner') {
    await flyttaAnteckningsblock(id, riktning)
    await laddaOmBlock()
  }

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
              <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle">
                {sorterade.map((b, i) => (
                  <li key={b.id} className="flex items-center gap-1 px-2 py-1.5">
                    <div className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => handleFlytta(b.id, 'upp')}
                        disabled={i === 0}
                        aria-label={`Flytta "${b.namn}" upp`}
                        className="rounded p-1 text-stone-400 transition-colors hover:bg-stone-100 disabled:opacity-30 dark:hover:bg-stone-800"
                      >
                        <ChevronUpIcon className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFlytta(b.id, 'ner')}
                        disabled={i === sorterade.length - 1}
                        aria-label={`Flytta "${b.namn}" ner`}
                        className="rounded p-1 text-stone-400 transition-colors hover:bg-stone-100 disabled:opacity-30 dark:hover:bg-stone-800"
                      >
                        <ChevronDownIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRedigerarBlock(b)}
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
