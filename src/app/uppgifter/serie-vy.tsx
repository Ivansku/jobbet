'use client'

import { useState } from 'react'
import { uppdateraSerie, avslutaSerie, taBortSerie } from './actions'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Field } from '@/components/ui/field'
import { Input, Select } from '@/components/ui/input'
import { MarkdownEditor } from '@/components/ui/markdown-editor'
import { EmptyState } from '@/components/ui/empty-state'
import { VeckodagValjare } from './veckodag-valjare'
import { KundValjare } from './kund-valjare'

type Person = { id: string; namn: string }
type Kund = { id: string; namn: string }
type Typ = { id: string; namn: string }
type Projekt = { id: string; namn: string }
type Serie = {
  id: string
  titel: string
  beskrivning: string | null
  person_id: string | null
  kund_id: string | null
  typ_id: string | null
  uppgiftsprojekt_id: string | null
  prioritet: string
  veckodagar: number[]
  intervall_veckor: number
  slut_datum: string | null
  tidsatgang_timmar: number | null
  klockslag: string | null
}

const VECKODAGAR_KORT = ['Mån', 'Tis', 'Ons', 'Tors', 'Fre']

function veckodagarText(dagar: number[]) {
  return [...dagar]
    .sort()
    .map((d) => VECKODAGAR_KORT[d - 1])
    .join(', ')
}

export function SerieVy({
  serier,
  personer,
  kunder,
  typer,
  projekt,
}: {
  serier: Serie[]
  personer: Person[]
  kunder: Kund[]
  typer: Typ[]
  projekt: Projekt[]
}) {
  const [visaLista, setVisaLista] = useState(false)
  const [redigerar, setRedigerar] = useState<Serie | null>(null)

  return (
    <>
      <Button variant="secondary" onClick={() => setVisaLista(true)}>
        Serier
      </Button>

      {visaLista && !redigerar && (
        <Modal onClose={() => setVisaLista(false)} labelledBy="serier-title">
          <h2 id="serier-title" className="mb-4 text-lg font-semibold">
            Återkommande serier
          </h2>
          {serier.length === 0 ? (
            <EmptyState
              title="Inga serier ännu"
              description="Skapa en återkommande uppgift för att se den här."
            />
          ) : (
            <ul className="max-h-[60vh] divide-y divide-border-subtle overflow-y-auto rounded-xl border border-border-subtle">
              {serier.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => setRedigerar(s)}
                    className="flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left text-sm transition-colors hover:bg-stone-50 dark:hover:bg-stone-800"
                  >
                    <span className="font-medium">{s.titel}</span>
                    <span className="text-xs text-stone-400">
                      {s.intervall_veckor > 1 ? `Var ${s.intervall_veckor}:e vecka: ` : ''}
                      {veckodagarText(s.veckodagar)} ·{' '}
                      {s.slut_datum ? `Pågår till ${s.slut_datum}` : 'Inget slutdatum'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex justify-end">
            <Button variant="secondary" onClick={() => setVisaLista(false)}>
              Stäng
            </Button>
          </div>
        </Modal>
      )}

      {redigerar && (
        <SerieFormular
          serie={redigerar}
          personer={personer}
          kunder={kunder}
          typer={typer}
          projekt={projekt}
          onClose={() => setRedigerar(null)}
        />
      )}
    </>
  )
}

export function SerieFormular({
  serie,
  personer,
  kunder,
  typer,
  projekt,
  onClose,
}: {
  serie: Serie
  personer: Person[]
  kunder: Kund[]
  typer: Typ[]
  projekt: Projekt[]
  onClose: () => void
}) {
  const [titel, setTitel] = useState(serie.titel)
  const [beskrivning, setBeskrivning] = useState(serie.beskrivning ?? '')
  const [personId, setPersonId] = useState(serie.person_id ?? '')
  const [kundId, setKundId] = useState(serie.kund_id ?? '')
  const [typId, setTypId] = useState(serie.typ_id ?? '')
  const [uppgiftsprojektId, setUppgiftsprojektId] = useState(serie.uppgiftsprojekt_id ?? '')
  const [prioritet, setPrioritet] = useState(serie.prioritet)
  const [veckodagar, setVeckodagar] = useState<number[]>(serie.veckodagar)
  const [intervallVeckor, setIntervallVeckor] = useState(serie.intervall_veckor)
  const [slutDatum, setSlutDatum] = useState(serie.slut_datum ?? '')
  const [tidsatgang, setTidsatgang] = useState(serie.tidsatgang_timmar?.toString() ?? '')
  const [klockslag, setKlockslag] = useState(serie.klockslag?.slice(0, 5) ?? '')
  const [sparar, setSparar] = useState(false)
  const [visaAvsluta, setVisaAvsluta] = useState(false)
  const [visaTaBort, setVisaTaBort] = useState(false)
  const [arbetar, setArbetar] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!titel.trim() || veckodagar.length === 0) return
    setSparar(true)
    await uppdateraSerie(serie.id, {
      titel: titel.trim(),
      beskrivning,
      personId,
      kundId,
      typId,
      uppgiftsprojektId,
      prioritet,
      veckodagar,
      intervallVeckor,
      slutDatum: slutDatum || null,
      tidsatgangTimmar: tidsatgang.trim() ? Number(tidsatgang) : null,
      klockslag: klockslag || null,
    })
    setSparar(false)
    onClose()
  }

  async function handleAvsluta() {
    setArbetar(true)
    await avslutaSerie(serie.id)
    setArbetar(false)
    onClose()
  }

  async function handleTaBort() {
    setArbetar(true)
    await taBortSerie(serie.id)
    setArbetar(false)
    onClose()
  }

  if (visaAvsluta) {
    return (
      <ConfirmDialog
        title={`Avsluta serien "${serie.titel}"?`}
        description="Inga fler förekomster genereras efter idag. Redan skapade uppgifter påverkas inte."
        confirmLabel="Avsluta serien"
        loading={arbetar}
        onConfirm={handleAvsluta}
        onCancel={() => setVisaAvsluta(false)}
      />
    )
  }

  if (visaTaBort) {
    return (
      <ConfirmDialog
        title={`Ta bort serien "${serie.titel}"?`}
        description="Själva serien tas bort, men uppgifter som redan skapats av den finns kvar som vanliga uppgifter."
        loading={arbetar}
        onConfirm={handleTaBort}
        onCancel={() => setVisaTaBort(false)}
      />
    )
  }

  return (
    <Modal onClose={onClose} labelledBy="serie-formular-title">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <h2 id="serie-formular-title" className="text-lg font-semibold">
          Redigera serie
        </h2>

        <Field label="Titel" htmlFor="serie-titel">
          <Input id="serie-titel" value={titel} onChange={(e) => setTitel(e.target.value)} required autoFocus />
        </Field>

        <Field label="Beskrivning" htmlFor="serie-beskrivning">
          <MarkdownEditor id="serie-beskrivning" value={beskrivning} onChange={setBeskrivning} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Ansvarig" htmlFor="serie-person">
            <Select id="serie-person" value={personId} onChange={(e) => setPersonId(e.target.value)}>
              <option value="">Ingen</option>
              {personer.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.namn}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Kund" htmlFor="serie-kund">
            <KundValjare id="serie-kund" kunder={kunder} value={kundId} onChange={setKundId} />
          </Field>

          <Field label="Typ" htmlFor="serie-typ">
            <Select id="serie-typ" value={typId} onChange={(e) => setTypId(e.target.value)}>
              <option value="">Ingen</option>
              {typer.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.namn}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Projekt" htmlFor="serie-projekt">
            <Select
              id="serie-projekt"
              value={uppgiftsprojektId}
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

          <Field label="Prioritet" htmlFor="serie-prioritet">
            <Select id="serie-prioritet" value={prioritet} onChange={(e) => setPrioritet(e.target.value)}>
              <option value="lag">Låg</option>
              <option value="medel">Medel</option>
              <option value="hog">Hög</option>
            </Select>
          </Field>

          <Field label="Tidsåtgång (timmar)" htmlFor="serie-tidsatgang">
            <Input
              type="number"
              id="serie-tidsatgang"
              min={0}
              step={0.5}
              value={tidsatgang}
              onChange={(e) => setTidsatgang(e.target.value)}
              placeholder="T.ex. 1.5"
            />
            <p className="text-xs text-stone-400">Kopieras in i nya förekomster som standardvärde</p>
          </Field>

          <Field label="Klockslag" htmlFor="serie-klockslag">
            <Input
              type="time"
              id="serie-klockslag"
              value={klockslag}
              onChange={(e) => setKlockslag(e.target.value)}
            />
            <p className="text-xs text-stone-400">Styr ordningen bland andra tidsatta uppgifter samma dag</p>
          </Field>
        </div>

        <Field label="Upprepa på" htmlFor="serie-veckodagar-edit">
          <VeckodagValjare value={veckodagar} onChange={setVeckodagar} />
        </Field>

        <Field label="Upprepa var" htmlFor="serie-intervall-edit">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              id="serie-intervall-edit"
              min={1}
              value={intervallVeckor}
              onChange={(e) => setIntervallVeckor(Math.max(1, Number(e.target.value)))}
              className="w-16"
            />
            <span className="text-sm text-stone-500">vecka</span>
          </div>
        </Field>

        <Field label="Pågår till" htmlFor="serie-slutdatum-edit">
          <Input
            type="date"
            id="serie-slutdatum-edit"
            value={slutDatum}
            onChange={(e) => setSlutDatum(e.target.value)}
          />
          <p className="text-xs text-stone-400">Lämna tomt för att köra utan slutdatum</p>
        </Field>

        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setVisaAvsluta(true)}>
              Avsluta serien
            </Button>
            <Button type="button" variant="danger" size="sm" onClick={() => setVisaTaBort(true)}>
              Ta bort serien
            </Button>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Avbryt
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={sparar}
              disabled={!titel.trim() || veckodagar.length === 0}
            >
              Spara
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
