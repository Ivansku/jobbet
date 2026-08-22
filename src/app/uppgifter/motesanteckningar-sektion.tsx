'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { sparaAnteckning } from './actions'
import { Field } from '@/components/ui/field'
import { MarkdownEditor } from '@/components/ui/markdown-editor'
import { Button } from '@/components/ui/button'
import { mondagAvVecka } from './vecka-helpers'
import { enTillRelation } from '@/lib/postgrest'

function CloseIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </svg>
  )
}

function FullscreenIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  )
}

type Block = { id: string; namn: string; beskrivning: string | null }
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
  initialAnteckningar,
}: {
  uppgiftId: string
  blocks: Block[]
  initialAnteckningar: InitialAnteckning[]
}) {
  const [anteckningar, setAnteckningar] = useState<Anteckning[]>(() =>
    initialAnteckningar.map(tillAnteckning)
  )
  const [sparar, setSparar] = useState(false)
  const router = useRouter()
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

  // Sparar allt osparat oavsett vilket block som är synligt/fokuserat just nu —
  // pendingRef håller redan reda på osparade ändringar per block, inte bara det
  // användaren senast rörde vid.
  //
  // router.refresh() körs bara här och inte i det tysta autosparet (schemalaggSpara/
  // handleBlur) — sparaAnteckning() hoppar medvetet över revalidatePath där för att
  // inte störa skrivfokus var 1,5:e sekund. Den här knappen är däremot ett uttryckligt
  // klick, så det är rätt tillfälle att uppdatera sidans (kanban/idag) egna listor med
  // den sparade anteckningen — annars visar en omöppnad uppgift den gamla texten tills
  // sidan laddas om helt.
  async function handleSparaAlla() {
    setSparar(true)
    const poster = Array.from(pendingRef.current.entries())
    poster.forEach(([blockId]) => {
      const timer = debounceTimer.current.get(blockId)
      if (timer) clearTimeout(timer)
    })
    await Promise.all(poster.map(([blockId, innehall]) => sparaAnteckning(uppgiftId, blockId, innehall)))
    poster.forEach(([blockId]) => pendingRef.current.delete(blockId))
    router.refresh()
    setSparar(false)
  }

  return (
    <div
      className={
        expanderad
          ? 'fixed inset-0 z-[60] flex flex-col gap-4 overflow-y-auto bg-surface p-6'
          : 'flex flex-col gap-4'
      }
    >
      {expanderad && (
        <button
          type="button"
          onClick={() => setExpanderad(false)}
          aria-label="Stäng anteckningsläge"
          title="Stäng anteckningsläge"
          className="absolute right-4 top-4 rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 dark:hover:bg-stone-800 dark:hover:text-stone-300"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      )}
      <div className="flex shrink-0 flex-col gap-3">
        {expanderad ? (
          <h3 className="text-sm font-semibold">Mötesanteckningar</h3>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Mötesanteckningar</h3>
            <button
              type="button"
              onClick={() => setExpanderad(true)}
              aria-label="Anteckningsläge"
              title="Anteckningsläge"
              className="shrink-0 rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 dark:hover:bg-stone-800 dark:hover:text-stone-300"
            >
              <FullscreenIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {blocks.map((block) => {
        const koppling = koppladGenereradForBlock(block.id)
        return (
          // shrink-0 — annars klämmer flex-col-behållaren (som scrollar sig själv, se
          // "expanderad" ovan) ihop blocken istället för att låta dem svämma över och
          // faktiskt gå att scrolla till.
          <div key={block.id} className="shrink-0">
            <Field label={block.namn} htmlFor={`block-${block.id}`} hint={block.beskrivning ?? undefined}>
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

      {expanderad && (
        <div className="sticky bottom-0 -mx-6 mt-auto flex shrink-0 justify-end border-t border-border-subtle bg-surface px-6 py-3">
          <Button type="button" variant="primary" size="sm" loading={sparar} onClick={handleSparaAlla}>
            Spara
          </Button>
        </div>
      )}
    </div>
  )
}
