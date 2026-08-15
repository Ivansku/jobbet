'use client'

import { useEffect, useRef, useState } from 'react'
import {
  sparaAnteckning,
  hamtaAnteckningarForUppgift,
  genereraUppgifterFranAnteckningar,
  byggKundsammanfattning,
} from './actions'
import { Field } from '@/components/ui/field'
import { MarkdownEditor } from '@/components/ui/markdown-editor'
import { Button } from '@/components/ui/button'
import { buildMailto } from '@/lib/mailto'
import { mondagAvVecka } from './vecka-helpers'
import { enTillRelation } from '@/lib/postgrest'

type Block = { id: string; namn: string; genererar_uppgift: boolean }
type Anteckning = {
  block_id: string
  innehall: string
  uppgift_id_genererad: string | null
  genererad_titel: string | null
  genererad_deadline: string | null
}
// Rå formen som redan följer med sidans uppgiftshämtning (samma mönster som
// uppgift_deltagare) — kräver ingen egen nätverksrunda när formuläret öppnas.
type InitialAnteckning = {
  block_id: string
  innehall: string
  uppgift_id_genererad: string | null
  genererad: { titel: string; deadline: string | null }[] | null
}

function tillAnteckning(a: InitialAnteckning): Anteckning {
  const genererad = enTillRelation(a.genererad)
  return {
    block_id: a.block_id,
    innehall: a.innehall,
    uppgift_id_genererad: a.uppgift_id_genererad,
    genererad_titel: genererad?.titel ?? null,
    genererad_deadline: genererad?.deadline ?? null,
  }
}

export function MotesanteckningarSektion({
  uppgiftId,
  blocks,
  status,
  initialAnteckningar,
}: {
  uppgiftId: string
  blocks: Block[]
  status: string
  initialAnteckningar: InitialAnteckning[]
}) {
  const [anteckningar, setAnteckningar] = useState<Anteckning[]>(() =>
    initialAnteckningar.map(tillAnteckning)
  )
  const [genererar, setGenererar] = useState(false)
  const [genereringsMeddelande, setGenereringsMeddelande] = useState<string | null>(null)
  const [skickar, setSkickar] = useState(false)
  const [expanderad, setExpanderad] = useState(false)
  const pendingRef = useRef<Map<string, string>>(new Map())

  // Fyller webbläsarens innehållsyta (inte hela skärmen som F11/Fullscreen API) —
  // fönstret behåller sina normala kontroller så det går att dra/flytta/docka det
  // bredvid ett annat fönster under mötet. Escape fångas i capture-fasen, innan
  // den hinner bubbla upp till modal.tsx:s egen Escape-lyssnare, så den bara
  // stänger den här vyn och inte hela uppgiftsformuläret bakom den.
  useEffect(() => {
    if (!expanderad) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setExpanderad(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [expanderad])

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
    return anteckningar.find((a) => a.block_id === blockId)?.innehall ?? ''
  }

  function koppladGenereradForBlock(blockId: string) {
    return anteckningar.find((a) => a.block_id === blockId) ?? null
  }

  function uppdateraLokalt(blockId: string, innehall: string) {
    setAnteckningar((bas) => {
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

  return (
    <div
      className={
        expanderad
          ? 'fixed inset-0 z-[60] flex flex-col gap-4 overflow-y-auto bg-surface p-6'
          : 'flex flex-col gap-4 rounded-lg border border-border-subtle p-3'
      }
    >
      <div className="flex shrink-0 flex-col gap-3">
        <h3 className="text-sm font-semibold">Mötesanteckningar</h3>
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={() => setExpanderad((v) => !v)}
          >
            {expanderad ? 'Stäng anteckningsläge' : 'Anteckningsläge'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full"
            loading={skickar}
            onClick={handleSkicka}
          >
            Skicka sammanfattning
          </Button>
          {status === 'klar' && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full"
              loading={genererar}
              onClick={handleGenerera}
            >
              Skapa uppgifter
            </Button>
          )}
        </div>
      </div>

      {genereringsMeddelande && <p className="shrink-0 text-xs text-stone-400">{genereringsMeddelande}</p>}

      {blocks.map((block) => {
        const koppling = koppladGenereradForBlock(block.id)
        return (
          // shrink-0 — annars klämmer flex-col-behållaren (som scrollar sig själv, se
          // "expanderad" ovan) ihop blocken istället för att låta dem svämma över och
          // faktiskt gå att scrolla till.
          <div key={block.id} className="shrink-0">
            <Field label={block.namn} htmlFor={`block-${block.id}`}>
              <MarkdownEditor
                id={`block-${block.id}`}
                value={innehallForBlock(block.id)}
                onChange={(value) => handleChange(block.id, value)}
                onBlur={(value) => handleBlur(block.id, value)}
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
          </div>
        )
      })}
    </div>
  )
}
