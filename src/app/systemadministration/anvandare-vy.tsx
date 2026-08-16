'use client'

import { useState } from 'react'
import { uppdateraPerson, uppdateraFlexelModuler } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'

type Person = {
  id: string
  namn: string
  epost: string
  epost_outlook: string | null
  roll: string | null
  arbetstimmar_per_vecka: number
  dagsflode_morgon_slut: string
  dagsflode_mitt_slut: string
}
type FlexelInstallning = { person_id: string; modul: string; aktiv: boolean; veckokvot_timmar: number | null }

const ROLL_PILLS = [
  { value: 'medlem', label: 'Medlem' },
  { value: 'admin', label: 'Admin' },
]

const MODUL_OPTIONER = [
  { value: 'flex', label: 'Flex' },
  { value: 'overtid', label: 'Övertid' },
  { value: 'foraldraledig', label: 'Föräldraledig' },
]
const STANDARD_VECKOKVOT = 8

export function AnvandareVy({
  personer,
  flexelInstallningar,
}: {
  personer: Person[]
  flexelInstallningar: FlexelInstallning[]
}) {
  const [redigerar, setRedigerar] = useState<Person | null>(null)

  return (
    <>
      <div className="mb-6">
        <h2 className="text-lg font-semibold tracking-tight">Användare</h2>
        <p className="mt-1 text-sm text-stone-500">
          Roll, Outlook-mail och arbetstimmar per vecka styr bland annat kapacitetsvisningen i
          Uppgifter-vyn.
        </p>
      </div>

      <ul className="divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-subtle bg-surface">
        {personer.map((p) => (
          <li key={p.id}>
            <button
              onClick={() => setRedigerar(p)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-stone-50 dark:hover:bg-stone-800"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{p.namn}</span>
                <span className="block truncate text-xs text-stone-400">{p.epost}</span>
              </span>
              <span className="shrink-0 text-xs text-stone-400">
                {p.roll === 'admin' ? 'Admin' : 'Medlem'} · {p.arbetstimmar_per_vecka} h/vecka
              </span>
            </button>
          </li>
        ))}
      </ul>

      {redigerar && (
        <AnvandareFormular
          person={redigerar}
          flexelInstallningar={flexelInstallningar.filter((i) => i.person_id === redigerar.id)}
          onClose={() => setRedigerar(null)}
        />
      )}
    </>
  )
}

function AnvandareFormular({
  person,
  flexelInstallningar,
  onClose,
}: {
  person: Person
  flexelInstallningar: FlexelInstallning[]
  onClose: () => void
}) {
  const [namn, setNamn] = useState(person.namn)
  const [roll, setRoll] = useState(person.roll ?? 'medlem')
  const [epostOutlook, setEpostOutlook] = useState(person.epost_outlook ?? '')
  const [arbetstimmar, setArbetstimmar] = useState(String(person.arbetstimmar_per_vecka))
  const [morgonSlut, setMorgonSlut] = useState(person.dagsflode_morgon_slut.slice(0, 5))
  const [mittSlut, setMittSlut] = useState(person.dagsflode_mitt_slut.slice(0, 5))
  const [moduler, setModuler] = useState(() =>
    Object.fromEntries(
      MODUL_OPTIONER.map((m) => [m.value, flexelInstallningar.find((i) => i.modul === m.value)?.aktiv ?? false])
    )
  )
  const [veckokvot, setVeckokvot] = useState(() =>
    String(flexelInstallningar.find((i) => i.modul === 'foraldraledig')?.veckokvot_timmar ?? STANDARD_VECKOKVOT)
  )
  const [sparar, setSparar] = useState(false)
  const [fel, setFel] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const timmar = Number(arbetstimmar.replace(',', '.'))
    if (!namn.trim()) {
      setFel('Namn krävs.')
      return
    }
    if (morgonSlut >= mittSlut) {
      setFel('"Börja dagen" måste sluta före "Mitt på dagen".')
      return
    }
    setSparar(true)
    setFel(null)

    const { error } = await uppdateraPerson(person.id, {
      namn,
      roll,
      epostOutlook,
      arbetstimmarPerVecka: timmar,
      dagsflodeMorgonSlut: morgonSlut,
      dagsflodeMittSlut: mittSlut,
    })
    if (error) {
      setSparar(false)
      setFel(error)
      return
    }

    const { error: modulFel } = await uppdateraFlexelModuler(
      person.id,
      MODUL_OPTIONER.map((m) => ({
        modul: m.value,
        aktiv: moduler[m.value],
        veckokvotTimmar: m.value === 'foraldraledig' ? Number(veckokvot.replace(',', '.')) : null,
      }))
    )

    setSparar(false)
    if (modulFel) {
      setFel(modulFel)
      return
    }
    onClose()
  }

  return (
    <Modal onClose={onClose} labelledBy="anvandare-formular-title">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <h2 id="anvandare-formular-title" className="text-lg font-semibold">
          Redigera användare
        </h2>
        <Field label="Namn" htmlFor="anvandare-namn">
          <Input
            id="anvandare-namn"
            value={namn}
            onChange={(e) => setNamn(e.target.value)}
            required
            autoFocus
          />
        </Field>
        <Field label="Inloggningsmail" htmlFor="anvandare-epost">
          <Input id="anvandare-epost" value={person.epost} disabled />
        </Field>
        <Field label="Outlook-mail" htmlFor="anvandare-epost-outlook">
          <Input
            id="anvandare-epost-outlook"
            type="email"
            value={epostOutlook}
            onChange={(e) => setEpostOutlook(e.target.value)}
            placeholder="namn@foretag.se"
          />
        </Field>
        <Field label="Arbetstimmar per vecka" htmlFor="anvandare-arbetstimmar">
          <Input
            id="anvandare-arbetstimmar"
            type="number"
            min="0"
            max="168"
            step="0.5"
            value={arbetstimmar}
            onChange={(e) => setArbetstimmar(e.target.value)}
            required
          />
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-stone-700 dark:text-stone-300">
            Idag-sidans dagsflöden
          </span>
          <p className="text-xs text-stone-400">
            Styr när Börja dagen, Mitt på dagen och Avsluta dagen visas automatiskt på Hem-sidan.
          </p>
          <div className="flex gap-3">
            <Field label="Börja dagen slutar" htmlFor="anvandare-morgon-slut">
              <Input
                id="anvandare-morgon-slut"
                type="time"
                value={morgonSlut}
                onChange={(e) => setMorgonSlut(e.target.value)}
                required
              />
            </Field>
            <Field label="Mitt på dagen slutar" htmlFor="anvandare-mitt-slut">
              <Input
                id="anvandare-mitt-slut"
                type="time"
                value={mittSlut}
                onChange={(e) => setMittSlut(e.target.value)}
                required
              />
            </Field>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-stone-700 dark:text-stone-300">Roll</span>
          <div role="group" aria-label="Roll" className="flex flex-wrap gap-1.5">
            {ROLL_PILLS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRoll(opt.value)}
                aria-pressed={opt.value === roll}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  opt.value === roll
                    ? 'border-accent-500 bg-accent-50 text-accent-700 dark:bg-accent-950 dark:text-accent-300'
                    : 'border-border-subtle text-stone-500 hover:bg-stone-50 dark:text-stone-400 dark:hover:bg-stone-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-stone-700 dark:text-stone-300">Modul (Flexel)</span>
          {MODUL_OPTIONER.map((m) => (
            <div key={m.value} className="flex items-center justify-between gap-2">
              <span className="text-sm">{m.label}</span>
              <div role="group" aria-label={m.label} className="flex gap-1.5">
                {[
                  { value: false, label: 'Av' },
                  { value: true, label: 'På' },
                ].map((opt) => (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => setModuler((prev) => ({ ...prev, [m.value]: opt.value }))}
                    aria-pressed={moduler[m.value] === opt.value}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      moduler[m.value] === opt.value
                        ? 'border-accent-500 bg-accent-50 text-accent-700 dark:bg-accent-950 dark:text-accent-300'
                        : 'border-border-subtle text-stone-500 hover:bg-stone-50 dark:text-stone-400 dark:hover:bg-stone-800'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {moduler['foraldraledig'] && (
            <Field label="Veckokvot, timmar (Föräldraledig)" htmlFor="anvandare-veckokvot">
              <Input
                id="anvandare-veckokvot"
                type="number"
                min="0"
                step="0.5"
                value={veckokvot}
                onChange={(e) => setVeckokvot(e.target.value)}
              />
            </Field>
          )}
        </div>
        {fel && <p className="text-sm text-red-600">{fel}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Avbryt
          </Button>
          <Button type="submit" variant="primary" loading={sparar} disabled={!namn.trim()}>
            Spara
          </Button>
        </div>
      </form>
    </Modal>
  )
}
