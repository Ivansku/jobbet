'use client'

import { useState, useTransition } from 'react'
import { uppdateraStatus } from './uppgifter/actions'
import { sattDagensFokus } from './idag-actions'
import { IdagTimeline } from './idag-timeline'
import { IdagRing } from './idag-ring'
import { DagensFokusValjare } from './dagens-fokus-valjare'
import { AvslutaDagen, FlexelSteg } from './avsluta-dagen'
import { UppgiftDetalj } from './uppgift-detalj'
import { Eyebrow } from '@/components/ui/eyebrow'
import type { Dagsflode } from '@/lib/dagsflode'

export type Uppgift = {
  id: string
  titel: string
  status: string
  deadline: string | null
  klockslag: string | null
  kund_id: string | null
  outlook_event_id: string | null
}
// Rikare variant med allt uppdateraUppgift/MotesanteckningarSektion behöver —
// bara dagensUppgifter hämtas med de här extra fälten, eftersom det är enda
// listan som går att öppna i redigeringsformuläret från Idag-sidan.
export type UppgiftDetaljerad = Uppgift & {
  beskrivning: string | null
  person_id: string | null
  uppgiftsprojekt_id: string | null
  prioritet: string
  tidsatgang_timmar: number | null
  typ_id: string | null
  skapa_uppgifter_vid_klar: boolean | null
  uppgift_deltagare: { kontaktperson_id: string }[]
  uppgift_anteckning: {
    block_id: string
    innehall: string
    uppgift_id_genererad: string | null
    genererad: { titel: string; deadline: string | null }[] | null
  }[]
}
export type Kund = { id: string; namn: string }
export type Typ = { id: string; namn: string; visar_motesanteckningar: boolean; skapa_uppgifter_vid_klar: boolean }
export type Block = { id: string; namn: string; genererar_uppgift: boolean }
export type Tanke = { id: string; text: string; uppgift_id_skapad: string | null }
export type Dagsavslut = { id: string; avslutad_at: string | null }

// UTC-ankrad tolkning av datumsträngen (samma försiktighet som övrig datumlogik
// i appen) så formateringen inte kan hoppa en dag beroende på webbläsarens tidszon.
function langtDatum(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const text = new Intl.DateTimeFormat('sv-SE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(dt)
  return text.charAt(0).toUpperCase() + text.slice(1)
}

const HALSNING: Record<Dagsflode, string> = {
  morgon: 'God morgon',
  mitt: 'Mitt på dagen',
  kvall: 'Avsluta dagen',
}

export function IdagFlode({
  flode,
  personNamn,
  idag,
  imorgon,
  dagensUppgifter,
  eftersläpning,
  imorgonUppgifter,
  fokusUppgiftIds: initialaFokus,
  aktivaFlexelModuler,
  dagsavslut,
  tankar,
  kunder,
  typer,
  block,
}: {
  flode: Dagsflode
  personNamn: string
  idag: string
  imorgon: string
  dagensUppgifter: UppgiftDetaljerad[]
  eftersläpning: Uppgift[]
  imorgonUppgifter: Uppgift[]
  fokusUppgiftIds: string[]
  aktivaFlexelModuler: string[]
  dagsavslut: Dagsavslut | null
  tankar: Tanke[]
  kunder: Kund[]
  typer: Typ[]
  block: Block[]
}) {
  const [fokusIds, setFokusIds] = useState<string[]>(initialaFokus)
  const [klaraIds, setKlaraIds] = useState<Set<string>>(
    new Set(dagensUppgifter.filter((u) => u.status === 'klar').map((u) => u.id))
  )
  const [redigerar, setRedigerar] = useState<UppgiftDetaljerad | null>(null)
  const [, startTransition] = useTransition()

  function toggleFokus(nyValda: string[]) {
    setFokusIds(nyValda)
    startTransition(() => {
      sattDagensFokus(idag, nyValda)
    })
  }

  function toggleKlar(u: Uppgift) {
    const nyStatus = klaraIds.has(u.id) ? 'oppen' : 'klar'
    setKlaraIds((prev) => {
      const next = new Set(prev)
      if (nyStatus === 'klar') next.add(u.id)
      else next.delete(u.id)
      return next
    })
    startTransition(() => {
      uppdateraStatus(u.id, nyStatus)
    })
  }

  // Skickar med den senaste klarmarkerade statusen (inte det ursprungliga
  // servervärdet) så Mötesanteckningar-sektionen ser rätt status om raden
  // klarmarkerats i tidslinjen innan formuläret öppnas.
  function oppnaDetalj(u: UppgiftDetaljerad) {
    setRedigerar({ ...u, status: klaraIds.has(u.id) ? 'klar' : 'oppen' })
  }

  const klara = dagensUppgifter.filter((u) => klaraIds.has(u.id)).length
  const kundMap = new Map(kunder.map((k) => [k.id, k.namn]))
  const fokusKandidater = dagensUppgifter.filter((u) => !u.outlook_event_id && !klaraIds.has(u.id))

  const lede = `${langtDatum(idag)} · ${dagensUppgifter.length} uppgift${
    dagensUppgifter.length === 1 ? '' : 'er'
  } idag${
    eftersläpning.length > 0 ? ` · ${eftersläpning.length} försenad${eftersläpning.length === 1 ? '' : 'e'}` : ''
  }`

  // Kunder idag: en rad per kund, tidigast klockslag vinner (möte/tidsatt uppgift
  // före en otidsatt uppgift för samma kund), sorterat kronologiskt.
  const kunderMap = new Map<string, { namn: string; klockslag: string | null; fokus: boolean }>()
  for (const u of dagensUppgifter) {
    if (!u.kund_id) continue
    const befintlig = kunderMap.get(u.kund_id)
    if (!befintlig || (u.klockslag && (!befintlig.klockslag || u.klockslag < befintlig.klockslag))) {
      kunderMap.set(u.kund_id, {
        namn: kundMap.get(u.kund_id) ?? '',
        klockslag: u.klockslag,
        fokus: fokusIds.includes(u.id),
      })
    }
  }
  const kunderIdag = Array.from(kunderMap.values()).sort((a, b) => (a.klockslag ?? 'z').localeCompare(b.klockslag ?? 'z'))

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.7fr_1fr] lg:items-stretch">
        <div className="h-full rounded-2xl border border-border-subtle bg-surface p-5 md:p-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            {flode === 'morgon' ? `${HALSNING.morgon}, ${personNamn.split(' ')[0]}` : HALSNING[flode]}
          </h1>
          <p className="mt-1 text-sm text-stone-500">{lede}</p>

          <div className="mt-6">
            <Eyebrow>Dagens tidslinje</Eyebrow>
            <div className="mt-3">
              <IdagTimeline
                uppgifter={dagensUppgifter}
                fokusUppgiftIds={fokusIds}
                klaraIds={klaraIds}
                onToggle={toggleKlar}
                onOpenDetalj={oppnaDetalj}
                kunder={kunder}
              />
            </div>
          </div>

          {flode === 'kvall' && (
            <div className="mt-6">
              <FlexelSteg idag={idag} aktivaFlexelModuler={aktivaFlexelModuler} />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-border-subtle bg-surface p-5 md:p-6">
            <Eyebrow>Idag</Eyebrow>
            <div className="mt-3">
              <IdagRing klara={klara} totalt={dagensUppgifter.length} />
            </div>

            {eftersläpning.length > 0 && (
              <div className="mt-6">
                <Eyebrow>Gårdagens försenat</Eyebrow>
                <ul className="mt-3 flex flex-col gap-1.5">
                  {eftersläpning.map((u) => (
                    <li
                      key={u.id}
                      className="flex items-center gap-2 rounded-xl border border-border-subtle px-3 py-2 text-sm"
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                      <span className="min-w-0 flex-1 truncate">{u.titel}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {flode === 'morgon' && (
              <div className="mt-6">
                <Eyebrow>Dagens fokus (max 3)</Eyebrow>
                <div className="mt-3">
                  <DagensFokusValjare kandidater={fokusKandidater} valda={fokusIds} onChange={toggleFokus} />
                </div>
              </div>
            )}
          </div>

          {kunderIdag.length > 0 && (
            <div className="rounded-2xl border border-border-subtle bg-surface p-5 md:p-6">
              <Eyebrow>Kunder idag</Eyebrow>
              <ul className="mt-3 flex flex-col">
                {kunderIdag.map((k, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between border-t border-border-subtle py-2 text-sm first:border-t-0"
                  >
                    <span className="truncate">{k.namn}</span>
                    <span className="shrink-0 text-xs text-stone-400">
                      {k.klockslag ? k.klockslag.slice(0, 5) : k.fokus ? 'Fokus' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {flode === 'kvall' && dagsavslut && (
        <AvslutaDagen
          imorgon={imorgon}
          imorgonUppgifter={imorgonUppgifter}
          dagsavslut={dagsavslut}
          tankar={tankar}
          kunder={kunder}
        />
      )}

      {redigerar && (
        <UppgiftDetalj
          uppgift={redigerar}
          kunder={kunder}
          typer={typer}
          block={block}
          onClose={() => setRedigerar(null)}
        />
      )}
    </div>
  )
}
