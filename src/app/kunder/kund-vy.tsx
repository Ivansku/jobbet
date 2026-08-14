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

type Kund = { id: string; namn: string }
type Kontaktperson = {
  id: string
  kund_id: string
  fornamn: string | null
  efternamn: string | null
  epost: string | null
  senast_kontaktad: string | null
}

function kontaktNamn(k: Kontaktperson) {
  const namn = [k.fornamn, k.efternamn].filter(Boolean).join(' ')
  return namn || k.epost || 'Namnlös kontakt'
}

export function KundVy({ kunder, kontaktpersoner }: { kunder: Kund[]; kontaktpersoner: Kontaktperson[] }) {
  const [redigerar, setRedigerar] = useState<Kund | 'ny' | null>(null)

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
        <ul className="divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-subtle bg-surface">
          {kunder.map((k) => (
            <li key={k.id}>
              <button
                onClick={() => setRedigerar(k)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors hover:bg-stone-50 dark:hover:bg-stone-800"
              >
                <span className="truncate">{k.namn}</span>
                <span className="text-xs text-stone-400">Redigera</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {redigerar && (
        <KundFormular
          existing={redigerar === 'ny' ? null : redigerar}
          kontaktpersoner={
            redigerar === 'ny' ? [] : kontaktpersoner.filter((k) => k.kund_id === redigerar.id)
          }
          onClose={() => setRedigerar(null)}
        />
      )}
    </>
  )
}

function KundFormular({
  existing,
  kontaktpersoner,
  onClose,
}: {
  existing: Kund | null
  kontaktpersoner: Kontaktperson[]
  onClose: () => void
}) {
  const [namn, setNamn] = useState(existing?.namn ?? '')
  const [sparar, setSparar] = useState(false)
  const [visaBekraftelse, setVisaBekraftelse] = useState(false)
  const [tarBort, setTarBort] = useState(false)

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

  return (
    <Modal onClose={onClose} labelledBy="kund-formular-title">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <h2 id="kund-formular-title" className="text-lg font-semibold">
          {existing ? 'Redigera kund' : 'Ny kund'}
        </h2>
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

        {existing && <KontaktpersonSektion kundId={existing.id} kontaktpersoner={kontaktpersoner} />}

        <div className="flex items-center justify-between gap-2">
          {existing ? (
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => setVisaBekraftelse(true)}
            >
              Ta bort
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Avbryt
            </Button>
            <Button type="submit" variant="primary" loading={sparar} disabled={!namn.trim()}>
              {existing ? 'Spara' : 'Skapa'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

function KontaktpersonSektion({
  kundId,
  kontaktpersoner,
}: {
  kundId: string
  kontaktpersoner: Kontaktperson[]
}) {
  const [redigerarKontakt, setRedigerarKontakt] = useState<Kontaktperson | 'ny' | null>(null)

  return (
    <div className="border-t border-border-subtle pt-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-stone-500">Kontaktpersoner</h3>
        <Button type="button" variant="secondary" size="sm" onClick={() => setRedigerarKontakt('ny')}>
          Lägg till
        </Button>
      </div>

      {kontaktpersoner.length === 0 ? (
        <p className="text-xs text-stone-400">Inga kontaktpersoner ännu.</p>
      ) : (
        <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle">
          {kontaktpersoner.map((k) => (
            <li key={k.id}>
              <button
                type="button"
                onClick={() => setRedigerarKontakt(k)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-stone-50 dark:hover:bg-stone-800"
              >
                <span className="truncate">{kontaktNamn(k)}</span>
                <span className="shrink-0 text-xs text-stone-400">
                  {k.senast_kontaktad ? `Kontaktad ${k.senast_kontaktad}` : 'Ej kontaktad'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {redigerarKontakt && (
        <KontaktpersonFormular
          kundId={kundId}
          existing={redigerarKontakt === 'ny' ? null : redigerarKontakt}
          onClose={() => setRedigerarKontakt(null)}
        />
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
    <div className="mt-3 flex flex-col gap-3 rounded-lg border border-border-subtle p-3">
      <div className="grid grid-cols-2 gap-2">
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
      <div className="flex items-center justify-between gap-2">
        {existing ? (
          <Button type="button" variant="danger" size="sm" loading={tarBort} onClick={handleTaBort}>
            Ta bort
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Avbryt
          </Button>
          <Button type="button" variant="primary" size="sm" loading={sparar} onClick={handleSpara}>
            Spara
          </Button>
        </div>
      </div>
    </div>
  )
}
