'use client'

import { useState, useTransition } from 'react'
import { uppdateraStatus } from './uppgifter/actions'
import { sattDagensFokus } from './idag-actions'
import { IdagTimeline } from './idag-timeline'
import { IdagRing } from './idag-ring'
import { DagensFokusValjare } from './dagens-fokus-valjare'
import { ImorgonVantarSteg, FlexelSteg, TankarSteg } from './avsluta-dagen'
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
// dagensUppgifter, eftersläpning och imorgonUppgifter hämtas alla med de här
// extra fälten, eftersom alla tre listornas rader går att öppna i
// redigeringsformuläret från Hem-sidan.
export type UppgiftDetaljerad = Uppgift & {
  beskrivning: string | null
  person_id: string | null
  kategori_id: string | null
  projekt_id: string | null
  prioritet: string
  tidsatgang_timmar: number | null
  typ_id: string | null
  ar_placeholder: boolean
  anteckningsmall_id: string | null
  utan_anteckningsmall: boolean
  projektAnteckningsmallId: string | null
  projektAnteckningar: { block_id: string; innehall: string }[]
  uppgift_deltagare: { kontaktperson_id: string }[]
  uppgift_anteckning: {
    block_id: string
    innehall: string
    uppgift_id_genererad: string | null
    genererad: { titel: string; deadline: string | null }[] | null
  }[]
}
export type Kund = { id: string; namn: string }
export type Typ = {
  id: string
  namn: string
  anteckningsmall_id: string | null
}
export type Block = {
  id: string
  namn: string
  beskrivning: string | null
  anteckningsmall_id: string
}
export type Tanke = { id: string; text: string; uppgift_id_skapad: string | null }
export type Dagsavslut = { id: string }

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
  namnsdagIdag,
  dagensUppgifter,
  eftersläpning,
  imorgonUppgifter,
  fokusUppgiftIds: initialaFokus,
  aktivaFlexelModuler,
  dagsavslut,
  tankar,
  flexelRapporteradIdag,
  kunder,
  typer,
  block,
}: {
  flode: Dagsflode
  personNamn: string
  idag: string
  imorgon: string
  namnsdagIdag: string[]
  dagensUppgifter: UppgiftDetaljerad[]
  eftersläpning: UppgiftDetaljerad[]
  imorgonUppgifter: UppgiftDetaljerad[]
  fokusUppgiftIds: string[]
  aktivaFlexelModuler: string[]
  dagsavslut: Dagsavslut | null
  tankar: Tanke[]
  flexelRapporteradIdag: boolean
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
  // outlook_event_id säger bara att raden är synkad från Outlook-kalendern —
  // manuellt skapade möten (typ "Möte") har den inte. anteckningsmall_id
  // är typens faktiska mötes-signal och fångar båda fallen.
  const moteTypIds = new Set(typer.filter((t) => t.anteckningsmall_id != null).map((t) => t.id))
  const arMote = (u: UppgiftDetaljerad) => Boolean(u.outlook_event_id) || moteTypIds.has(u.typ_id ?? '')
  const fokusKandidater = dagensUppgifter.filter((u) => !arMote(u) && !klaraIds.has(u.id))

  const namnsdag = namnsdagIdag.length > 0 ? ` · ${namnsdagIdag.join(' & ')}` : ''
  const lede = `${langtDatum(idag)}${namnsdag}`

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

  const motenIdag = dagensUppgifter
    .filter((u) => arMote(u))
    .sort((a, b) => (a.klockslag ?? 'z').localeCompare(b.klockslag ?? 'z'))

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.7fr_1fr] lg:items-start">
        <div className="rounded-2xl border border-border-subtle bg-surface p-5 md:p-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            {flode === 'morgon' ? `${HALSNING.morgon}, ${personNamn.split(' ')[0]}` : HALSNING[flode]}
          </h1>
          <p className="mt-1 text-sm text-stone-500">{lede}</p>

          <div className="mt-6 flex flex-col [&>*+*]:mt-6 [&>*+*]:border-t [&>*+*]:border-border-subtle [&>*+*]:pt-6">
            <div>
              <Eyebrow>Dagens tidslinje</Eyebrow>
              <div className="mt-3">
                <IdagTimeline
                  uppgifter={dagensUppgifter}
                  fokusUppgiftIds={fokusIds}
                  klaraIds={klaraIds}
                  onToggle={toggleKlar}
                  onOpenDetalj={oppnaDetalj}
                  kunder={kunder}
                  typer={typer}
                />
              </div>
            </div>

            {flode === 'kvall' && (
              <ImorgonVantarSteg
                imorgonUppgifter={imorgonUppgifter}
                kunder={kunder}
                onOpenDetalj={setRedigerar}
                typer={typer}
              />
            )}

            {flode === 'kvall' && (
              <FlexelSteg
                idag={idag}
                aktivaFlexelModuler={aktivaFlexelModuler}
                rapporteradIdag={flexelRapporteradIdag}
              />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-border-subtle bg-surface p-5 md:p-6">
            <Eyebrow>Idag</Eyebrow>
            <div className="mt-6 flex flex-col [&>*+*]:mt-6 [&>*+*]:border-t [&>*+*]:border-border-subtle [&>*+*]:pt-6">
              <div>
                <IdagRing klara={klara} totalt={dagensUppgifter.length} />
              </div>

              {eftersläpning.length > 0 && (
                <div>
                  <Eyebrow>Gårdagens försenat</Eyebrow>
                  <ul className="mt-3 flex flex-col">
                    {eftersläpning.map((u) => {
                      const meta = u.kund_id ? kundMap.get(u.kund_id) : arMote(u) ? 'Möte' : null
                      return (
                        <li
                          key={u.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setRedigerar(u)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setRedigerar(u)
                            }
                          }}
                          className="flex cursor-pointer items-center gap-2 border-t border-border-subtle py-2 text-sm first:border-t-0 hover:bg-stone-50 dark:hover:bg-stone-800"
                        >
                          <span className="min-w-0 flex-1 truncate">{u.titel}</span>
                          {meta && <span className="shrink-0 text-xs text-stone-400">{meta}</span>}
                          <span className="shrink-0 text-xs text-stone-400 tabular-nums">{u.klockslag?.slice(0, 5)}</span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}

              {flode !== 'kvall' && (
                <div>
                  <Eyebrow>Dagens fokus (max 3)</Eyebrow>
                  <div className="mt-3">
                    <DagensFokusValjare
                      kandidater={fokusKandidater}
                      valda={fokusIds}
                      onChange={toggleFokus}
                      kunder={kunder}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {motenIdag.length > 0 && (
            <div className="rounded-2xl border border-border-subtle bg-surface p-5 md:p-6">
              <Eyebrow>Möten idag</Eyebrow>
              <ul className="mt-3 flex flex-col">
                {motenIdag.map((m) => {
                  const kundNamn = m.kund_id ? kundMap.get(m.kund_id) : null
                  return (
                    <li
                      key={m.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setRedigerar(m)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setRedigerar(m)
                        }
                      }}
                      className="flex cursor-pointer items-center gap-2 border-t border-border-subtle py-2 text-sm first:border-t-0 hover:bg-stone-50 dark:hover:bg-stone-800"
                    >
                      <span className="min-w-0 flex-1 truncate">{m.titel}</span>
                      {kundNamn && <span className="shrink-0 text-xs text-stone-400">{kundNamn}</span>}
                      <span className="shrink-0 text-xs text-stone-400 tabular-nums">{m.klockslag?.slice(0, 5)}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

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

          {flode === 'kvall' && dagsavslut && (
            <div className="rounded-2xl border border-border-subtle bg-surface p-5 md:p-6">
              <TankarSteg dagsavslutId={dagsavslut.id} imorgon={imorgon} tankar={tankar} />
            </div>
          )}
        </div>
      </div>

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
