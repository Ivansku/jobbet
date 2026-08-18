'use client'

import { useState } from 'react'
import { kopplaTillPlaceholder } from './actions'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/input'

type OppenPlaceholder = { id: string; titel: string; deadline: string | null; projekt_id: string | null; typ_id: string | null }

// Visas bara på en riktig (icke-placeholder) uppgift som redan har ett projekt valt —
// projektet avgör vilka placeholders som är kandidater (de ligger redan i samma
// projekt, genererade från en uppgiftsmall), typen smalar ner listan ytterligare.
//
// `placeholders` kommer redan färdighämtad som prop från sidan (litet antal rader för
// hela företaget) istället för att hämtas här vid öppning — annars hinner formuläret
// visa/dölja den här sektionen innan en async fråga svarat, vilket syntes som att
// kontrollen "flimrade till" en stund innan den försvann på en redan kopplad uppgift.
export function KopplaPlaceholderSektion({
  uppgiftId,
  projektId,
  typId,
  placeholders,
  onLinked,
}: {
  uppgiftId: string
  projektId: string
  typId: string
  placeholders: OppenPlaceholder[]
  onLinked: () => void
}) {
  const [valdId, setValdId] = useState('')
  const [kopplar, setKopplar] = useState(false)
  const [fel, setFel] = useState(false)

  const synliga = placeholders.filter(
    (p) => p.projekt_id === projektId && p.typ_id === typId && p.id !== uppgiftId
  )
  const valtGiltigt = synliga.some((p) => p.id === valdId)

  async function handleKoppla() {
    if (!valtGiltigt) return
    setKopplar(true)
    setFel(false)
    const resultat = await kopplaTillPlaceholder(uppgiftId, projektId, valdId)
    setKopplar(false)
    if (resultat.success) {
      onLinked()
    } else {
      setFel(true)
    }
  }

  if (synliga.length === 0) return null

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-stone-300 p-3 dark:border-stone-600">
      <h3 className="text-sm font-semibold">Koppla till placeholder</h3>
      <p className="text-xs text-stone-400">
        Väntande placeholder-rader i samma projekt och av samma typ. Kopplingen tar över
        placeholderns plats i projektet och tar sedan bort den.
      </p>
      <div className="flex items-center gap-2">
        <Select value={valtGiltigt ? valdId : ''} onChange={(e) => setValdId(e.target.value)} className="flex-1">
          <option value="">Välj placeholder…</option>
          {synliga.map((p) => (
            <option key={p.id} value={p.id}>
              {p.titel}
              {p.deadline ? ` – ${p.deadline}` : ''}
            </option>
          ))}
        </Select>
        <Button
          type="button"
          variant="secondary"
          loading={kopplar}
          disabled={!valtGiltigt}
          onClick={handleKoppla}
        >
          Koppla
        </Button>
      </div>
      {fel && (
        <p className="text-xs text-red-600 dark:text-red-400">
          Kopplingen misslyckades — placeholdern kan ha kopplats eller tagits bort av någon annan
          under tiden. Stäng och öppna uppgiften igen och försök på nytt.
        </p>
      )}
    </div>
  )
}
