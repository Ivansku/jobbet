'use client'

import { useEffect, useRef, useState } from 'react'
import { skapaKund } from '../kunder/actions'

type Kund = { id: string; namn: string }

export function KundValjare({
  kunder,
  value,
  onChange,
  id,
}: {
  kunder: Kund[]
  value: string
  onChange: (kundId: string) => void
  id?: string
}) {
  const [text, setText] = useState(() => kunder.find((k) => k.id === value)?.namn ?? '')
  const [oppen, setOppen] = useState(false)
  const [skapar, setSkapar] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOppen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const sokterm = text.trim().toLowerCase()
  const traff = kunder.filter((k) => k.namn.toLowerCase().includes(sokterm))
  const exaktTraff = kunder.some((k) => k.namn.toLowerCase() === sokterm)

  function valj(kund: Kund) {
    setText(kund.namn)
    onChange(kund.id)
    setOppen(false)
  }

  async function skapaOchValj() {
    const namn = text.trim()
    if (!namn || skapar) return
    setSkapar(true)
    const ny = await skapaKund(namn)
    setSkapar(false)
    if (ny) {
      setText(ny.namn)
      onChange(ny.id)
    }
    setOppen(false)
  }

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        id={id}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          onChange('')
          setOppen(true)
        }}
        onFocus={() => setOppen(true)}
        placeholder="Sök eller skapa kund…"
        className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-foreground placeholder:text-stone-400 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/40"
      />
      {oppen && (
        <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border-subtle bg-surface shadow-lg">
          {kunder.length === 0 && !text.trim() && (
            <p className="px-3 py-2 text-sm text-stone-400">Inga kunder ännu</p>
          )}
          {traff.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => valj(k)}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-stone-50 dark:hover:bg-stone-800"
            >
              {k.namn}
            </button>
          ))}
          {text.trim() && !exaktTraff && (
            <button
              type="button"
              onClick={skapaOchValj}
              disabled={skapar}
              className="block w-full px-3 py-2 text-left text-sm text-accent-700 hover:bg-accent-50 disabled:opacity-50 dark:text-accent-400 dark:hover:bg-accent-950"
            >
              {skapar ? 'Skapar…' : `+ Skapa "${text.trim()}"`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
