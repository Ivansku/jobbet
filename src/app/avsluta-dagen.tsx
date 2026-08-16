'use client'

import { useState } from 'react'
import { skapaFlexelPost } from './rapporter/flexel/actions'
import { skapaReflektionstanke, avslutaDagen } from './idag-actions'
import { Button } from '@/components/ui/button'
import { Input, Textarea, Select } from '@/components/ui/input'
import { Eyebrow } from '@/components/ui/eyebrow'
import { EmptyState } from '@/components/ui/empty-state'
import type { Uppgift, Kund, Tanke, Dagsavslut } from './idag-flode'

const MODUL_LABEL: Record<string, string> = {
  flex: 'Flex',
  overtid: 'Övertid',
  foraldraledig: 'Föräldraledig',
  ledighet: 'Ledighet',
}

const AVSLUTNINGSTEXT =
  'Bra jobbat idag. Dagen är avslutad — det som blev kvar väntar snyggt uppradat imorgon.'

function metaText(u: Uppgift, kundMap: Map<string, string>): string {
  return [u.klockslag?.slice(0, 5), u.kund_id && kundMap.get(u.kund_id)].filter(Boolean).join(' · ')
}

export function AvslutaDagen({
  imorgon,
  imorgonUppgifter,
  dagsavslut,
  tankar,
  kunder,
}: {
  imorgon: string
  imorgonUppgifter: Uppgift[]
  dagsavslut: Dagsavslut | null
  tankar: Tanke[]
  kunder: Kund[]
}) {
  const kundMap = new Map(kunder.map((k) => [k.id, k.namn]))

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface p-5 md:p-6">
      {/* Egen rubrik som visuellt kopplar tillbaka till "Avsluta dagen" högst upp
          på sidan — panelen svävade annars fritt utan koppling till flödet ovanför. */}
      <Eyebrow>Avsluta dagen</Eyebrow>
      {/* Ett sammanhållet flöde i en panel — [&>*+*] ger avdelare + luft mellan
          synliga steg utan att bry sig om vilka som faktiskt renderas (Tankar-
          relaterat är villkorat), så det alltid ser rätt ut oavsett vilka steg
          som är aktuella just den dagen. */}
      <div className="mt-3 flex flex-col [&>*+*]:mt-6 [&>*+*]:border-t [&>*+*]:border-border-subtle [&>*+*]:pt-6">
        {dagsavslut && <TankarSteg dagsavslutId={dagsavslut.id} imorgon={imorgon} tankar={tankar} />}

        <div>
          <Eyebrow>Imorgon väntar</Eyebrow>
          <div className="mt-3">
            {imorgonUppgifter.length === 0 ? (
              <EmptyState title="Inget planerat imorgon ännu" />
            ) : (
              <ul className="divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-subtle">
                {imorgonUppgifter.map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span className="truncate">{u.titel}</span>
                    <span className="shrink-0 text-xs text-stone-400">{metaText(u, kundMap)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {dagsavslut && <AvslutaSteg dagsavslutId={dagsavslut.id} avslutadAt={dagsavslut.avslutad_at} />}
      </div>
    </div>
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

function TankarSteg({
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
