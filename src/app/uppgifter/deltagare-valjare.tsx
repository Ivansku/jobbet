'use client'

import { useEffect, useRef, useState } from 'react'
import { skapaKontaktperson } from '../kunder/kontakt-actions'

type Kontaktperson = {
  id: string
  kund_id: string
  fornamn: string | null
  efternamn: string | null
  epost: string | null
}

function kontaktNamn(k: Kontaktperson) {
  const namn = [k.fornamn, k.efternamn].filter(Boolean).join(' ')
  return namn || k.epost || 'Namnlös kontakt'
}

export function DeltagareValjare({
  kontaktpersoner,
  kundId,
  value,
  onChange,
}: {
  kontaktpersoner: Kontaktperson[]
  kundId: string
  value: string[]
  onChange: (ids: string[]) => void
}) {
  const [text, setText] = useState('')
  const [oppen, setOppen] = useState(false)
  const [skapar, setSkapar] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOppen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const kundensKontakter = kontaktpersoner.filter((k) => k.kund_id === kundId)
  const valda = kundensKontakter.filter((k) => value.includes(k.id))
  const sokterm = text.trim().toLowerCase()
  const traff = kundensKontakter.filter(
    (k) => !value.includes(k.id) && kontaktNamn(k).toLowerCase().includes(sokterm)
  )
  const exaktTraff = kundensKontakter.some((k) => kontaktNamn(k).toLowerCase() === sokterm)
  const harTraffer =
    (kundensKontakter.length === 0 && !text.trim()) || traff.length > 0 || (!!text.trim() && !exaktTraff)

  function laggTill(id: string) {
    onChange([...value, id])
    setText('')
  }

  function taBort(id: string) {
    onChange(value.filter((v) => v !== id))
  }

  async function skapaOchLaggTill() {
    const helaNamnet = text.trim()
    if (!helaNamnet || skapar) return
    setSkapar(true)
    const [fornamn, ...resten] = helaNamnet.split(/\s+/)
    const ny = await skapaKontaktperson({ kundId, fornamn, efternamn: resten.join(' '), epost: '' })
    setSkapar(false)
    if (ny) laggTill(ny.id)
    setOppen(false)
  }

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setOppen(true)
        }}
        onFocus={() => setOppen(true)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return
          // Utan detta bubblar Enter upp till det omslutande uppgiftsformuläret
          // och sparar hela uppgiften istället för att lägga till deltagaren.
          e.preventDefault()
          if (traff.length > 0) {
            laggTill(traff[0].id)
          } else if (text.trim()) {
            skapaOchLaggTill()
          }
        }}
        placeholder="Sök eller lägg till deltagare…"
        className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-foreground placeholder:text-stone-400 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/40"
      />
      {oppen && harTraffer && (
        <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border-subtle bg-surface shadow-lg">
          {kundensKontakter.length === 0 && !text.trim() && (
            <p className="px-3 py-2 text-sm text-stone-400">Inga kontaktpersoner för kunden ännu</p>
          )}
          {traff.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => laggTill(k.id)}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-stone-50 dark:hover:bg-stone-800"
            >
              {kontaktNamn(k)}
            </button>
          ))}
          {text.trim() && !exaktTraff && (
            <button
              type="button"
              onClick={skapaOchLaggTill}
              disabled={skapar}
              className="block w-full px-3 py-2 text-left text-sm text-accent-700 hover:bg-accent-50 disabled:opacity-50 dark:text-accent-400 dark:hover:bg-accent-950"
            >
              {skapar ? 'Skapar…' : `+ Lägg till "${text.trim()}"`}
            </button>
          )}
        </div>
      )}
      {valda.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {valda.map((k) => (
            <span
              key={k.id}
              className="flex items-center gap-1 rounded-full bg-accent-50 px-2 py-0.5 text-xs font-medium text-accent-700 dark:bg-accent-950 dark:text-accent-300"
            >
              {kontaktNamn(k)}
              <button
                type="button"
                onClick={() => taBort(k.id)}
                className="text-accent-500 hover:text-accent-800 dark:hover:text-accent-100"
                aria-label={`Ta bort ${kontaktNamn(k)}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
