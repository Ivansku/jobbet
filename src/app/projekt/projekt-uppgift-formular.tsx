'use client'

import { useState } from 'react'
import { uppdateraUppgift } from '../uppgifter/actions'
import { MotesanteckningarSektion } from '../uppgifter/motesanteckningar-sektion'
import { Modal } from '@/components/ui/modal'
import { Field } from '@/components/ui/field'
import { Input, Select } from '@/components/ui/input'
import { MarkdownEditor } from '@/components/ui/markdown-editor'
import { Button } from '@/components/ui/button'

export type Typ = { id: string; namn: string; anteckningsmall_id: string | null; skapa_uppgifter_vid_klar: boolean }
export type Anteckningsblock = { id: string; namn: string; genererar_uppgift: boolean; anteckningsmall_id: string }
type UppgiftAnteckning = {
  block_id: string
  innehall: string
  uppgift_id_genererad: string | null
  genererad: { titel: string; deadline: string | null }[] | null
}
export type ProjektUppgiftDetaljerad = {
  id: string
  titel: string
  beskrivning: string | null
  status: string
  deadline: string | null
  klockslag: string | null
  tidsatgang_timmar: number | null
  person_id: string | null
  kund_id: string | null
  typ_id: string | null
  kategori_id: string | null
  prioritet: string
  mailinnehall: string | null
  ar_placeholder: boolean
  anteckningsmall_id: string | null
  skapa_uppgifter_vid_klar: boolean | null
  uppgift_deltagare: { kontaktperson_id: string }[]
  uppgift_anteckning: UppgiftAnteckning[]
}

const STATUS_OPTIONER = [
  { value: 'oppen', label: 'Öppen' },
  { value: 'pagar', label: 'Pågår' },
  { value: 'vantar', label: 'Väntar' },
  { value: 'klar', label: 'Klar' },
]

export function ProjektUppgiftFormular({
  uppgift,
  projektId,
  typer,
  block,
  onClose,
  onChanged,
}: {
  uppgift: ProjektUppgiftDetaljerad
  projektId: string
  typer: Typ[]
  block: Anteckningsblock[]
  onClose: () => void
  onChanged: () => void
}) {
  const [titel, setTitel] = useState(uppgift.titel)
  const [beskrivning, setBeskrivning] = useState(uppgift.beskrivning ?? '')
  const [status, setStatus] = useState(uppgift.status)
  const [deadline, setDeadline] = useState(uppgift.deadline ?? '')
  const [klockslag, setKlockslag] = useState(uppgift.klockslag ?? '')
  const [tidsatgang, setTidsatgang] = useState(uppgift.tidsatgang_timmar?.toString() ?? '')
  const [sparar, setSparar] = useState(false)

  const typ = typer.find((t) => t.id === uppgift.typ_id)
  // Samma upplösning som Uppgifter-vyn och Idag-vyn: uppgiftens egen mall
  // (satt vid projektgenerering) går före typens standard.
  const effektivMallId = uppgift.anteckningsmall_id ?? typ?.anteckningsmall_id ?? null
  const mallBlock = block.filter((b) => b.anteckningsmall_id === effektivMallId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!titel.trim()) return
    setSparar(true)

    await uppdateraUppgift(uppgift.id, {
      titel: titel.trim(),
      beskrivning,
      personId: uppgift.person_id ?? '',
      kundId: uppgift.kund_id ?? '',
      typId: uppgift.typ_id ?? '',
      kategoriId: uppgift.kategori_id ?? '',
      projektId,
      prioritet: uppgift.prioritet,
      deadline: deadline || null,
      status,
      tidsatgangTimmar: tidsatgang.trim() ? Number(tidsatgang) : null,
      klockslag: klockslag || null,
      deltagareIds: uppgift.uppgift_deltagare.map((d) => d.kontaktperson_id),
      mailinnehall: uppgift.mailinnehall ?? '',
      arPlaceholder: uppgift.ar_placeholder,
    })

    setSparar(false)
    await onChanged()
    onClose()
  }

  return (
    <Modal onClose={onClose} labelledBy="projekt-uppgift-formular-title">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <h2 id="projekt-uppgift-formular-title" className="text-lg font-semibold">
          Redigera uppgift
        </h2>

        <Field label="Titel" htmlFor="projekt-uppgift-titel">
          <Input
            id="projekt-uppgift-titel"
            value={titel}
            onChange={(e) => setTitel(e.target.value)}
            required
            autoFocus
          />
        </Field>

        <Field label="Beskrivning" htmlFor="projekt-uppgift-beskrivning">
          <MarkdownEditor id="projekt-uppgift-beskrivning" value={beskrivning} onChange={setBeskrivning} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Status" htmlFor="projekt-uppgift-status">
            <Select id="projekt-uppgift-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONER.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Tidsåtgång (timmar)" htmlFor="projekt-uppgift-tidsatgang">
            <Input
              id="projekt-uppgift-tidsatgang"
              type="number"
              min={0}
              step={0.5}
              value={tidsatgang}
              onChange={(e) => setTidsatgang(e.target.value)}
              placeholder="T.ex. 0.5"
            />
          </Field>

          <Field label="Dag" htmlFor="projekt-uppgift-dag">
            <Input
              id="projekt-uppgift-dag"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </Field>

          <Field label="Klockslag" htmlFor="projekt-uppgift-klockslag">
            <Input
              id="projekt-uppgift-klockslag"
              type="time"
              value={klockslag}
              onChange={(e) => setKlockslag(e.target.value)}
            />
          </Field>
        </div>

        {effektivMallId && (
          <MotesanteckningarSektion
            uppgiftId={uppgift.id}
            blocks={mallBlock}
            status={status}
            initialAnteckningar={uppgift.uppgift_anteckning}
            initialAutoSkapaUppgifterVidKlar={
              uppgift.skapa_uppgifter_vid_klar ?? typ?.skapa_uppgifter_vid_klar ?? false
            }
          />
        )}

        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Avbryt
          </Button>
          <Button type="submit" variant="primary" loading={sparar} disabled={!titel.trim()}>
            Spara
          </Button>
        </div>
      </form>
    </Modal>
  )
}
