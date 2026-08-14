'use client'

import { useEffect, useRef, useState } from 'react'
import {
  sparaAnteckning,
  hamtaAnteckningarForUppgift,
  genereraUppgifterFranAnteckningar,
  byggKundsammanfattning,
} from './actions'
import { Field } from '@/components/ui/field'
import { Textarea } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { buildMailto } from '@/lib/mailto'
import { mondagAvVecka } from './vecka-helpers'

type Block = { id: string; namn: string; genererar_uppgift: boolean }
type Anteckning = {
  block_id: string
  innehall: string
  uppgift_id_genererad: string | null
  genererad_titel: string | null
  genererad_deadline: string | null
}

export function MotesanteckningarSektion({
  uppgiftId,
  blocks,
  status,
}: {
  uppgiftId: string
  blocks: Block[]
  status: string
}) {
  const [anteckningar, setAnteckningar] = useState<Anteckning[] | null>(null)
  const [genererar, setGenererar] = useState(false)
  const [genereringsMeddelande, setGenereringsMeddelande] = useState<string | null>(null)
  const [skickar, setSkickar] = useState(false)
  const pendingRef = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    let aktiv = true
    hamtaAnteckningarForUppgift(uppgiftId).then((rader) => {
      if (aktiv) setAnteckningar(rader)
    })
    return () => {
      aktiv = false
    }
  }, [uppgiftId])

  // Flush av allt osparat vid stängning/byte — även om debounce-timern inte hann
  // gå ut och blur inte hann triggas (t.ex. Escape-tangenten stänger modalen direkt).
  useEffect(() => {
    const pending = pendingRef.current
    return () => {
      pending.forEach((innehall, blockId) => {
        sparaAnteckning(uppgiftId, blockId, innehall)
      })
    }
  }, [uppgiftId])

  function innehallForBlock(blockId: string) {
    return anteckningar?.find((a) => a.block_id === blockId)?.innehall ?? ''
  }

  function koppladGenereradForBlock(blockId: string) {
    return anteckningar?.find((a) => a.block_id === blockId) ?? null
  }

  function uppdateraLokalt(blockId: string, innehall: string) {
    setAnteckningar((state) => {
      const bas = state ?? []
      const finns = bas.some((a) => a.block_id === blockId)
      return finns
        ? bas.map((a) => (a.block_id === blockId ? { ...a, innehall } : a))
        : [
            ...bas,
            {
              block_id: blockId,
              innehall,
              uppgift_id_genererad: null,
              genererad_titel: null,
              genererad_deadline: null,
            },
          ]
    })
  }

  const debounceTimer = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  function schemalaggSpara(blockId: string, innehall: string) {
    const befintlig = debounceTimer.current.get(blockId)
    if (befintlig) clearTimeout(befintlig)
    debounceTimer.current.set(
      blockId,
      setTimeout(() => {
        sparaAnteckning(uppgiftId, blockId, innehall)
        pendingRef.current.delete(blockId)
      }, 1500)
    )
  }

  function handleChange(blockId: string, innehall: string) {
    uppdateraLokalt(blockId, innehall)
    pendingRef.current.set(blockId, innehall)
    schemalaggSpara(blockId, innehall)
  }

  function handleBlur(blockId: string, innehall: string) {
    if (!pendingRef.current.has(blockId)) return
    const timer = debounceTimer.current.get(blockId)
    if (timer) clearTimeout(timer)
    sparaAnteckning(uppgiftId, blockId, innehall)
    pendingRef.current.delete(blockId)
  }

  async function handleGenerera() {
    setGenererar(true)
    setGenereringsMeddelande(null)
    const resultat = await genereraUppgifterFranAnteckningar(uppgiftId)
    setGenererar(false)
    if (resultat.antalGenererade === 0) {
      setGenereringsMeddelande('Inget nytt att generera.')
    } else {
      const rader = await hamtaAnteckningarForUppgift(uppgiftId)
      setAnteckningar(rader)
    }
  }

  async function handleSkicka() {
    setSkickar(true)
    const sammanfattning = await byggKundsammanfattning(uppgiftId)
    setSkickar(false)
    if (!sammanfattning) return
    window.location.href = buildMailto(sammanfattning)
  }

  if (anteckningar === null) {
    return <p className="text-xs text-stone-400">Laddar anteckningar…</p>
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border-subtle p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Mötesanteckningar</h3>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="sm" loading={skickar} onClick={handleSkicka}>
            Skicka sammanfattning
          </Button>
          {status === 'klar' && (
            <Button type="button" variant="secondary" size="sm" loading={genererar} onClick={handleGenerera}>
              Generera uppgifter
            </Button>
          )}
        </div>
      </div>

      {genereringsMeddelande && <p className="text-xs text-stone-400">{genereringsMeddelande}</p>}

      {blocks.map((block) => {
        const koppling = koppladGenereradForBlock(block.id)
        return (
          <Field key={block.id} label={block.namn} htmlFor={`block-${block.id}`}>
            <Textarea
              id={`block-${block.id}`}
              rows={3}
              value={innehallForBlock(block.id)}
              onChange={(e) => handleChange(block.id, e.target.value)}
              onBlur={(e) => handleBlur(block.id, e.target.value)}
            />
            {koppling?.uppgift_id_genererad && (
              <a
                href={
                  koppling.genererad_deadline
                    ? `/uppgifter?vecka=${mondagAvVecka(koppling.genererad_deadline)}`
                    : '/uppgifter'
                }
                className="mt-1 inline-block text-left text-xs font-medium text-accent-600 hover:underline dark:text-accent-400"
              >
                → Uppgift skapad: {koppling.genererad_titel}
              </a>
            )}
          </Field>
        )
      })}
    </div>
  )
}
