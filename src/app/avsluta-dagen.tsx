'use client'

import { useState } from 'react'
import { skapaFlexelPost } from './rapporter/flexel/actions'
import { skapaReflektionstanke, avslutaDagen } from './idag-actions'
import { Button } from '@/components/ui/button'
import { Input, Textarea, Select } from '@/components/ui/input'
import { Eyebrow } from '@/components/ui/eyebrow'
import { ImorgonTidslinje } from './imorgon-tidslinje'
import type { Uppgift, Kund, Tanke, Dagsavslut } from './idag-flode'

const MODUL_LABEL: Record<string, string> = {
  flex: 'Flex',
  overtid: 'Övertid',
  foraldraledig: 'Föräldraledig',
  ledighet: 'Ledighet',
}

const AVSLUTNINGSTEXT =
  'Bra jobbat idag. Dagen är avslutad — det som blev kvar väntar snyggt uppradat imorgon.'

// Inget eget panel-omslag här längre — renderas som en fortsättning inuti
// samma block som tidslinjen/Flexel (idag-flode.tsx äger panelen och den
// vanliga mt-6-rytmen mellan sektioner).
export function AvslutaDagen({
  imorgonUppgifter,
  dagsavslut,
  kunder,
}: {
  imorgonUppgifter: Uppgift[]
  dagsavslut: Dagsavslut | null
  kunder: Kund[]
}) {
  return (
    <>
      <div>
        <Eyebrow>Imorgon väntar</Eyebrow>
        <div className="mt-3">
          <ImorgonTidslinje uppgifter={imorgonUppgifter} kunder={kunder} />
        </div>
      </div>

      {dagsavslut && <AvslutaSteg dagsavslutId={dagsavslut.id} avslutadAt={dagsavslut.avslutad_at} />}
    </>
  )
}

export function FlexelSteg({ idag, aktivaFlexelModuler }: { idag: string; aktivaFlexelModuler: string[] }) {
  const modulOptioner = [...aktivaFlexelModuler, 'ledighet']
  const [timmar, setTimmar] = useState('')
  const [motivering, setMotivering] = useState('')
  const [modul, setModul] = useState(modulOptioner[0])
  const [sparar, setSparar] = useState(false)
  const [sparad, setSparad] = useState(false)
  const [fel, setFel] = useState<string | null>(null)

  async function spara() {
    const timmarTal = Number(timmar.replace(',', '.'))
    setSparar(true)
    setFel(null)
    const { error } = await skapaFlexelPost({ datum: idag, timmar: timmarTal, motivering, modul })
    setSparar(false)
    if (error) {
      setFel(error)
      return
    }
    setSparad(true)
    setTimmar('')
    setMotivering('')
  }

  return (
    <div>
      <Eyebrow>Snabbregistrera Flexel</Eyebrow>
      {sparad ? (
        <p className="mt-3 text-sm text-stone-500">Registrerat. Du kan lägga till fler rader i Rapporter → Flexel.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-28 shrink-0">
              <Input
                type="number"
                step="0.5"
                aria-label="Timmar"
                value={timmar}
                onChange={(e) => setTimmar(e.target.value)}
                placeholder="Timmar"
              />
            </div>
            <div className="w-28 shrink-0">
              <Select aria-label="Modul" value={modul} onChange={(e) => setModul(e.target.value)}>
                {modulOptioner.map((m) => (
                  <option key={m} value={m}>
                    {MODUL_LABEL[m] ?? m}
                  </option>
                ))}
              </Select>
            </div>
            <div className="min-w-[10rem] flex-1">
              <Input
                aria-label="Motivering"
                value={motivering}
                onChange={(e) => setMotivering(e.target.value)}
                placeholder="Kort motivering"
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              loading={sparar}
              disabled={!timmar || !motivering.trim()}
              onClick={spara}
            >
              Spara
            </Button>
          </div>
          {fel && <p className="text-sm text-red-600">{fel}</p>}
        </div>
      )}
    </div>
  )
}

export function TankarSteg({
  dagsavslutId,
  imorgon,
  tankar,
}: {
  dagsavslutId: string
  imorgon: string
  tankar: Tanke[]
}) {
  const [text, setText] = useState('')
  const [gorTillUppgift, setGorTillUppgift] = useState(false)
  const [sparar, setSparar] = useState(false)
  const [fel, setFel] = useState<string | null>(null)

  async function spara() {
    setSparar(true)
    setFel(null)
    const { error } = await skapaReflektionstanke(dagsavslutId, text, gorTillUppgift, imorgon)
    setSparar(false)
    if (error) {
      setFel(error)
      return
    }
    setText('')
    setGorTillUppgift(false)
  }

  return (
    <div>
      <Eyebrow>Vad skaver?</Eyebrow>
      <div className="mt-3 flex flex-col gap-2">
        {tankar.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {tankar.map((t) => (
              <li key={t.id} className="rounded-xl bg-stone-50 px-3 py-2 text-sm dark:bg-stone-800">
                {t.text}
                {t.uppgift_id_skapad && (
                  <span className="ml-2 text-xs text-accent-600 dark:text-accent-400">→ uppgift imorgon</span>
                )}
              </li>
            ))}
          </ul>
        )}
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Skriv av dig — vad ligger och skaver?"
          rows={2}
        />
        <label className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
          <input
            type="checkbox"
            checked={gorTillUppgift}
            onChange={(e) => setGorTillUppgift(e.target.checked)}
            className="h-4 w-4 accent-accent-500"
          />
          Gör till uppgift imorgon
        </label>
        {fel && <p className="text-sm text-red-600">{fel}</p>}
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          loading={sparar}
          disabled={!text.trim()}
          onClick={spara}
        >
          Spara tanke
        </Button>
      </div>
    </div>
  )
}

function AvslutaSteg({ dagsavslutId, avslutadAt }: { dagsavslutId: string; avslutadAt: string | null }) {
  const [avslutad, setAvslutad] = useState(!!avslutadAt)
  const [sparar, setSparar] = useState(false)

  async function avsluta() {
    setSparar(true)
    await avslutaDagen(dagsavslutId)
    setSparar(false)
    setAvslutad(true)
  }

  return (
    <div className="flex flex-col items-start gap-3">
      {avslutad && <p className="text-sm text-stone-500">{AVSLUTNINGSTEXT}</p>}
      <Button variant="primary" loading={sparar} onClick={avsluta}>
        {avslutad ? 'Avsluta igen' : 'Avsluta dagen'}
      </Button>
    </div>
  )
}
