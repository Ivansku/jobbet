'use client'

import { useState } from 'react'
import { skapaKund, uppdateraKund, taBortKund } from './actions'
import { skapaKontaktperson, uppdateraKontaktperson, taBortKontaktperson } from './kontakt-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { DeleteIconButton } from '@/components/ui/delete-icon-button'
import { MailtoIconLink } from '@/components/ui/mailto-icon-link'
import { KundMotesanteckningarSektion, type Mote } from './kund-motesanteckningar-sektion'
import { KundManuellaAnteckningarSektion } from './kund-manuella-anteckningar-sektion'
import type { ManuellAnteckning } from './manuell-anteckning-actions'

type Kund = { id: string; namn: string }
type Kontaktperson = {
  id: string
  kund_id: string
  fornamn: string | null
  efternamn: string | null
  epost: string | null
  senast_kontaktad: string | null
  uppgift_deltagare: { uppgift: { deadline: string | null; status: string }[] }[]
}

function kontaktNamn(k: Kontaktperson) {
  const namn = [k.fornamn, k.efternamn].filter(Boolean).join(' ')
  return namn || k.epost || 'Namnlös kontakt'
}

// Tidigaste ej slutförda möte/maildialog personen är kopplad till — en separat
// markering så man ser att kontakt är på väg även om Senast kontaktad ligger
// långt bak i tiden.
function planeratDatum(k: Kontaktperson): string | null {
  const datum = k.uppgift_deltagare
    .flatMap((d) => d.uppgift)
    .filter((u) => u.status !== 'klar' && !!u.deadline)
    .map((u) => u.deadline as string)
    .sort()
  return datum[0] ?? null
}

export function KundVy({
  kunder,
  kontaktpersoner,
  motesanteckningar,
  manuellaAnteckningar,
}: {
  kunder: Kund[]
  kontaktpersoner: Kontaktperson[]
  motesanteckningar: Record<string, Mote[]>
  manuellaAnteckningar: Record<string, ManuellAnteckning[]>
}) {
  const [redigerar, setRedigerar] = useState<Kund | 'ny' | null>(null)
  // Klick på en kontaktperson direkt i listan (utan att först öppna kunden)
  // ska bara stänga tillbaka till listan — inte avslöja kundmodalen bakom.
  const [redigerarFristaendeKontakt, setRedigerarFristaendeKontakt] = useState<Kontaktperson | null>(null)
  const [sok, setSok] = useState('')

  const sokterm = sok.trim().toLowerCase()
  const kunderMedKontakter = kunder.map((k) => ({
    kund: k,
    kontakter: kontaktpersoner.filter((kp) => kp.kund_id === k.id),
  }))
  const filtrerade = sokterm
    ? kunderMedKontakter.filter(
        ({ kund, kontakter }) =>
          kund.namn.toLowerCase().includes(sokterm) ||
          kontakter.some((kp) => kontaktNamn(kp).toLowerCase().includes(sokterm))
      )
    : kunderMedKontakter

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Kunder</h1>
        <Button variant="primary" onClick={() => setRedigerar('ny')}>
          Lägg till kund
        </Button>
      </div>

      {kunder.length === 0 ? (
        <EmptyState title="Inga kunder ännu" description="Lägg till din första kund för att komma igång." />
      ) : (
        <>
          <Input
            value={sok}
            onChange={(e) => setSok(e.target.value)}
            placeholder="Sök kund eller person…"
            className="mb-4"
          />

          {filtrerade.length === 0 ? (
            <p className="py-6 text-center text-sm text-stone-400">Inga träffar.</p>
          ) : (
            <ul className="divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-subtle bg-surface">
              {filtrerade.map(({ kund, kontakter }) => (
                <li key={kund.id}>
                  <button
                    onClick={() => setRedigerar(kund)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors hover:bg-stone-50 dark:hover:bg-stone-800"
                  >
                    <span className="truncate font-medium">{kund.namn}</span>
                    <span className="text-xs text-stone-400">Redigera</span>
                  </button>
                  {kontakter.length > 0 && (
                    <ul className="border-t border-border-subtle bg-stone-50/50 dark:bg-stone-900/30">
                      {kontakter.map((kp) => {
                        const planerat = planeratDatum(kp)
                        return (
                          <li key={kp.id}>
                            {/* div istället för button — en <a> (mailikonen) får inte nästlas i en
                                <button>, men hela raden ska ändå vara klickbar/tangentbordsbar som förut. */}
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => setRedigerarFristaendeKontakt(kp)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  setRedigerarFristaendeKontakt(kp)
                                }
                              }}
                              className="flex w-full cursor-pointer items-center justify-between px-4 py-2 pl-6 text-left text-xs transition-colors hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-inset dark:hover:bg-stone-800"
                            >
                              <span className="flex min-w-0 items-center gap-1">
                                <span className="truncate text-stone-600 dark:text-stone-300">{kontaktNamn(kp)}</span>
                                {kp.epost && <MailtoIconLink epost={kp.epost} namn={kontaktNamn(kp)} />}
                              </span>
                              <span className="shrink-0 text-stone-400">
                                {kp.senast_kontaktad ? `Kontaktad ${kp.senast_kontaktad}` : 'Aldrig kontaktad'}
                                {planerat && (
                                  <span className="ml-2 text-accent-600 dark:text-accent-400">
                                    Planerat {planerat}
                                  </span>
                                )}
                              </span>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {redigerar && (
        <KundFormular
          existing={redigerar === 'ny' ? null : redigerar}
          kontaktpersoner={
            redigerar === 'ny' ? [] : kontaktpersoner.filter((k) => k.kund_id === redigerar.id)
          }
          moten={redigerar === 'ny' ? [] : (motesanteckningar[redigerar.id] ?? [])}
          manuellaAnteckningar={redigerar === 'ny' ? [] : (manuellaAnteckningar[redigerar.id] ?? [])}
          onClose={() => setRedigerar(null)}
        />
      )}

      {redigerarFristaendeKontakt && (
        <KontaktpersonFormular
          kundId={redigerarFristaendeKontakt.kund_id}
          existing={redigerarFristaendeKontakt}
          onClose={() => setRedigerarFristaendeKontakt(null)}
        />
      )}
    </>
  )
}

function KundFormular({
  existing,
  kontaktpersoner,
  moten,
  manuellaAnteckningar,
  onClose,
}: {
  existing: Kund | null
  kontaktpersoner: Kontaktperson[]
  moten: Mote[]
  manuellaAnteckningar: ManuellAnteckning[]
  onClose: () => void
}) {
  const [namn, setNamn] = useState(existing?.namn ?? '')
  const [sparar, setSparar] = useState(false)
  const [visaBekraftelse, setVisaBekraftelse] = useState(false)
  const [tarBort, setTarBort] = useState(false)
  const [redigerarKontakt, setRedigerarKontakt] = useState<Kontaktperson | 'ny' | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!namn.trim()) return
    setSparar(true)

    if (existing) {
      await uppdateraKund(existing.id, namn)
    } else {
      await skapaKund(namn)
    }

    setSparar(false)
    onClose()
  }

  async function handleTaBort() {
    if (!existing) return
    setTarBort(true)
    await taBortKund(existing.id)
    setTarBort(false)
    onClose()
  }

  if (visaBekraftelse && existing) {
    return (
      <ConfirmDialog
        title={`Ta bort kunden "${existing.namn}"?`}
        description="Uppgifter taggade med den här kunden behåller sin övriga information, men mister kundtaggen."
        loading={tarBort}
        onConfirm={handleTaBort}
        onCancel={() => setVisaBekraftelse(false)}
      />
    )
  }

  if (redigerarKontakt && existing) {
    return (
      <KontaktpersonFormular
        kundId={existing.id}
        existing={redigerarKontakt === 'ny' ? null : redigerarKontakt}
        onClose={() => setRedigerarKontakt(null)}
      />
    )
  }

  return (
    <Modal onClose={onClose} labelledBy="kund-formular-title">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h2 id="kund-formular-title" className="text-lg font-semibold">
            {existing ? 'Redigera kund' : 'Ny kund'}
          </h2>
          {existing && (
            <DeleteIconButton label={`Ta bort kunden "${existing.namn}"`} onClick={() => setVisaBekraftelse(true)} />
          )}
        </div>
        <Field label="Namn" htmlFor="kund-namn">
          <Input
            id="kund-namn"
            value={namn}
            onChange={(e) => setNamn(e.target.value)}
            placeholder="Kundnamn"
            required
            autoFocus
          />
        </Field>

        {existing && (
          <KontaktpersonSektion
            kontaktpersoner={kontaktpersoner}
            onSelect={setRedigerarKontakt}
            onAddNew={() => setRedigerarKontakt('ny')}
          />
        )}

        {existing && <KundMotesanteckningarSektion moten={moten} />}

        {existing && (
          <KundManuellaAnteckningarSektion
            kundId={existing.id}
            anteckningar={manuellaAnteckningar}
            kontaktpersoner={kontaktpersoner}
          />
        )}

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

function KontaktpersonSektion({
  kontaktpersoner,
  onSelect,
  onAddNew,
}: {
  kontaktpersoner: Kontaktperson[]
  onSelect: (k: Kontaktperson) => void
  onAddNew: () => void
}) {
  return (
    <div className="border-t border-border-subtle pt-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-stone-500">Kontaktpersoner</h3>
        <Button type="button" variant="secondary" size="sm" onClick={onAddNew}>
          Lägg till
        </Button>
      </div>

      {kontaktpersoner.length === 0 ? (
        <p className="text-xs text-stone-400">Inga kontaktpersoner ännu.</p>
      ) : (
        <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle">
          {kontaktpersoner.map((k) => {
            const planerat = planeratDatum(k)
            return (
              <li key={k.id}>
                <button
                  type="button"
                  onClick={() => onSelect(k)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-stone-50 dark:hover:bg-stone-800"
                >
                  <span className="truncate">{kontaktNamn(k)}</span>
                  <span className="shrink-0 text-xs text-stone-400">
                    {k.senast_kontaktad ? `Kontaktad ${k.senast_kontaktad}` : 'Ej kontaktad'}
                    {planerat && <span className="ml-2 text-accent-600 dark:text-accent-400">Planerat {planerat}</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function KontaktpersonFormular({
  kundId,
  existing,
  onClose,
}: {
  kundId: string
  existing: Kontaktperson | null
  onClose: () => void
}) {
  const [fornamn, setFornamn] = useState(existing?.fornamn ?? '')
  const [efternamn, setEfternamn] = useState(existing?.efternamn ?? '')
  const [epost, setEpost] = useState(existing?.epost ?? '')
  const [senastKontaktad, setSenastKontaktad] = useState(existing?.senast_kontaktad ?? '')
  const [sparar, setSparar] = useState(false)
  const [tarBort, setTarBort] = useState(false)

  async function handleSpara() {
    setSparar(true)
    if (existing) {
      await uppdateraKontaktperson(existing.id, {
        fornamn,
        efternamn,
        epost,
        senastKontaktad: senastKontaktad || null,
      })
    } else {
      await skapaKontaktperson({ kundId, fornamn, efternamn, epost })
    }
    setSparar(false)
    onClose()
  }

  async function handleTaBort() {
    if (!existing) return
    setTarBort(true)
    await taBortKontaktperson(existing.id)
    setTarBort(false)
    onClose()
  }

  return (
    <Modal onClose={onClose} labelledBy="kontakt-formular-title">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h2 id="kontakt-formular-title" className="text-lg font-semibold">
            {existing ? 'Redigera kontakt' : 'Ny kontakt'}
          </h2>
          {existing && (
            <DeleteIconButton label={`Ta bort ${kontaktNamn(existing)}`} onClick={handleTaBort} loading={tarBort} />
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Förnamn" htmlFor="kontakt-fornamn">
            <Input id="kontakt-fornamn" value={fornamn ?? ''} onChange={(e) => setFornamn(e.target.value)} autoFocus />
          </Field>
          <Field label="Efternamn" htmlFor="kontakt-efternamn">
            <Input id="kontakt-efternamn" value={efternamn ?? ''} onChange={(e) => setEfternamn(e.target.value)} />
          </Field>
        </div>
        <Field label="E-post" htmlFor="kontakt-epost">
          <Input type="email" id="kontakt-epost" value={epost ?? ''} onChange={(e) => setEpost(e.target.value)} />
        </Field>
        {existing && (
          <Field label="Senast kontaktad" htmlFor="kontakt-senast">
            <Input
              type="date"
              id="kontakt-senast"
              value={senastKontaktad ?? ''}
              onChange={(e) => setSenastKontaktad(e.target.value)}
            />
          </Field>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Avbryt
          </Button>
          <Button type="button" variant="primary" loading={sparar} onClick={handleSpara}>
            Spara
          </Button>
        </div>
      </div>
    </Modal>
  )
}
