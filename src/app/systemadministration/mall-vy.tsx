'use client'

import { useState } from 'react'
import {
  hamtaMallUppgifter,
  skapaMallProjekt,
  uppdateraMallProjekt,
  taBortMallProjekt,
  skapaMallUppgift,
  uppdateraMallUppgift,
  taBortMallUppgift,
  flyttaMallUppgift,
} from './mall-actions'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { DeleteIconButton } from '@/components/ui/delete-icon-button'

type Typ = { id: string; namn: string }
type Kategori = { id: string; namn: string }
type Person = { id: string; namn: string }
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
}
type MallProjekt = { id: string; namn: string; antalUppgifter: number; uppgifter: MallUppgift[] }

export function MallVy({
  mallar,
  typer,
  kategori,
  personer,
  currentPersonId,
}: {
  mallar: MallProjekt[]
  typer: Typ[]
  kategori: Kategori[]
  personer: Person[]
  currentPersonId: string | null
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
  onClose,
}: {
  existing: MallProjekt | null
  typer: Typ[]
  kategori: Kategori[]
  personer: Person[]
  currentPersonId: string | null
  onClose: () => void
}) {
  // Lokal kopia av mallen — startar som prop:en, men uppdateras till det nyss
  // skapade objektet direkt efter "Skapa" istället för att stänga modalen, så
  // man kan börja lägga till uppgifter i samma flöde utan att öppna mallen igen.
  const [mall, setMall] = useState(existing)
  const [namn, setNamn] = useState(existing?.namn ?? '')
  const [uppgifter, setUppgifter] = useState<MallUppgift[]>(existing?.uppgifter ?? [])
  const [redigerarUppgift, setRedigerarUppgift] = useState<MallUppgift | 'ny' | null>(null)
  const [sparar, setSparar] = useState(false)
  const [visaBekraftelse, setVisaBekraftelse] = useState(false)
  const [tarBort, setTarBort] = useState(false)

  async function laddaOmUppgifter() {
    if (!mall) return
    setUppgifter(await hamtaMallUppgifter(mall.id))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!namn.trim()) return
    setSparar(true)

    if (mall) {
      await uppdateraMallProjekt(mall.id, namn)
      setSparar(false)
      onClose()
    } else {
      const ny = await skapaMallProjekt(namn)
      setSparar(false)
      if (ny) setMall({ id: ny.id, namn: ny.namn, antalUppgifter: 0, uppgifter: [] })
    }
  }

  async function handleTaBort() {
    if (!mall) return
    setTarBort(true)
    await taBortMallProjekt(mall.id)
    setTarBort(false)
    onClose()
  }

  async function handleFlytta(id: string, riktning: 'upp' | 'ner') {
    await flyttaMallUppgift(id, riktning)
    await laddaOmUppgifter()
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
        arForsta={arForsta}
        typer={typer}
        kategori={kategori}
        personer={personer}
        currentPersonId={currentPersonId}
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
              <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle">
                {uppgifter.map((u, i) => (
                  <li key={u.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <div className="flex shrink-0 flex-col">
                      <button
                        type="button"
                        disabled={i === 0}
                        onClick={() => handleFlytta(u.id, 'upp')}
                        aria-label={`Flytta "${u.titel}" upp`}
                        className="leading-none text-stone-400 hover:text-stone-700 disabled:opacity-30 dark:hover:text-stone-200"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        disabled={i === uppgifter.length - 1}
                        onClick={() => handleFlytta(u.id, 'ner')}
                        aria-label={`Flytta "${u.titel}" ner`}
                        className="leading-none text-stone-400 hover:text-stone-700 disabled:opacity-30 dark:hover:text-stone-200"
                      >
                        ▼
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRedigerarUppgift(u)}
                      className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
                    >
                      <span className="truncate">{u.titel}</span>
                      <span className="shrink-0 text-xs text-stone-400">Dag {kumulativaDagar[i]}</span>
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

function MallUppgiftFormular({
  mallProjektId,
  existing,
  arForsta,
  typer,
  kategori,
  personer,
  currentPersonId,
  onClose,
  onChanged,
}: {
  mallProjektId: string
  existing: MallUppgift | null
  arForsta: boolean
  typer: Typ[]
  kategori: Kategori[]
  personer: Person[]
  currentPersonId: string | null
  onClose: () => void
  onChanged: () => void
}) {
  const [titel, setTitel] = useState(existing?.titel ?? '')
  const [beskrivning, setBeskrivning] = useState(existing?.beskrivning ?? '')
  const [typId, setTypId] = useState(existing?.typ_id ?? '')
  const [kategoriId, setKategoriId] = useState(existing?.kategori_id ?? '')
  const [prioritet, setPrioritet] = useState(existing?.prioritet ?? 'lag')
  const [status, setStatus] = useState(existing?.status ?? 'oppen')
  const [personId, setPersonId] = useState(existing?.person_id ?? currentPersonId ?? '')
  const [tidsatgang, setTidsatgang] = useState(existing?.tidsatgang_timmar?.toString() ?? '')
  const [dagarEfterStart, setDagarEfterStart] = useState(existing?.dagar_efter_start?.toString() ?? '0')
  const [sparar, setSparar] = useState(false)
  const [tarBort, setTarBort] = useState(false)

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
          <Textarea
            id="mall-uppgift-beskrivning"
            value={beskrivning ?? ''}
            onChange={(e) => setBeskrivning(e.target.value)}
            rows={2}
          />
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
