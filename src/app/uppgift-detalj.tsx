'use client'

import { useState } from 'react'
import { uppdateraUppgift } from './uppgifter/actions'
import { MotesanteckningarSektion } from './uppgifter/motesanteckningar-sektion'
import { Modal } from '@/components/ui/modal'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { MarkdownEditor } from '@/components/ui/markdown-editor'
import { Button } from '@/components/ui/button'
import type { UppgiftDetaljerad, Kund, Typ, Block } from './idag-flode'

export function UppgiftDetalj({
  uppgift,
  kunder,
  typer,
  block,
  onClose,
}: {
  uppgift: UppgiftDetaljerad
  kunder: Kund[]
  typer: Typ[]
  block: Block[]
  onClose: () => void
}) {
  const [titel, setTitel] = useState(uppgift.titel)
  const [beskrivning, setBeskrivning] = useState(uppgift.beskrivning ?? '')
  const [tidsatgang, setTidsatgang] = useState(uppgift.tidsatgang_timmar?.toString() ?? '')
  const [mailinnehall, setMailinnehall] = useState(uppgift.mailinnehall ?? '')
  const [sparar, setSparar] = useState(false)

  const typ = typer.find((t) => t.id === uppgift.typ_id)
  const kundNamn = uppgift.kund_id ? kunder.find((k) => k.id === uppgift.kund_id)?.namn : undefined

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
      projektId: uppgift.projekt_id ?? '',
      prioritet: uppgift.prioritet,
      deadline: uppgift.deadline,
      status: uppgift.status,
      tidsatgangTimmar: tidsatgang.trim() ? Number(tidsatgang) : null,
      klockslag: uppgift.klockslag,
      deltagareIds: uppgift.uppgift_deltagare.map((d) => d.kontaktperson_id),
      mailinnehall,
      arPlaceholder: uppgift.ar_placeholder,
    })

    setSparar(false)
    onClose()
  }

  return (
    <Modal onClose={onClose} labelledBy="uppgift-detalj-title">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <h2 id="uppgift-detalj-title" className="text-lg font-semibold">
          {kundNamn ? `${kundNamn} — ${uppgift.titel}` : 'Redigera uppgift'}
        </h2>

        <Field label="Titel" htmlFor="uppgift-detalj-titel">
          <Input id="uppgift-detalj-titel" value={titel} onChange={(e) => setTitel(e.target.value)} required autoFocus />
        </Field>

        <Field label="Beskrivning" htmlFor="uppgift-detalj-beskrivning">
          <MarkdownEditor id="uppgift-detalj-beskrivning" value={beskrivning} onChange={setBeskrivning} />
        </Field>

        <Field label="Tidsåtgång (timmar)" htmlFor="uppgift-detalj-tidsatgang">
          <Input
            id="uppgift-detalj-tidsatgang"
            type="number"
            min={0}
            step={0.5}
            value={tidsatgang}
            onChange={(e) => setTidsatgang(e.target.value)}
            placeholder="T.ex. 0.5"
          />
        </Field>

        {typ?.visar_motesanteckningar && (
          <MotesanteckningarSektion
            uppgiftId={uppgift.id}
            blocks={block}
            status={uppgift.status}
            initialAnteckningar={uppgift.uppgift_anteckning}
            initialAutoSkapaUppgifterVidKlar={uppgift.skapa_uppgifter_vid_klar ?? typ.skapa_uppgifter_vid_klar ?? false}
          />
        )}

        {typ?.visar_mailinnehall && (
          <Field label="Mailinnehåll" htmlFor="uppgift-detalj-mailinnehall">
            <MarkdownEditor id="uppgift-detalj-mailinnehall" value={mailinnehall} onChange={setMailinnehall} />
          </Field>
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
