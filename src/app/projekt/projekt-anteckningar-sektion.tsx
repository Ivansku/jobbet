'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { sparaProjektAnteckning } from './actions'
import { Field } from '@/components/ui/field'
import { MarkdownEditor } from '@/components/ui/markdown-editor'
import { Button } from '@/components/ui/button'

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
type Anteckning = { block_id: string; innehall: string }

// Separat modul från MotesanteckningarSektion (uppgifter/motesanteckningar-sektion.tsx):
// innehållet lagras per projekt (projekt_anteckning), inte per uppgift, så samma
// anteckningar syns oavsett vilken uppgift i projektet man öppnar den från.
// initialAnteckningar hämtas färdigt server-side av respektive sidas page.tsx
// (samma mönster som uppgift_anteckning) — ingen egen nätverksrunda vid öppning.
// Anteckningsläget (fullskärm) speglar samma mönster som MotesanteckningarSektion.
export function ProjektAnteckningarSektion({
  projektId,
  blocks,
  initialAnteckningar,
}: {
  projektId: string
  blocks: Block[]
  initialAnteckningar: Anteckning[]
}) {
  const [anteckningar, setAnteckningar] = useState<Anteckning[]>(initialAnteckningar)
  const [sparar, setSparar] = useState(false)
  const [expanderad, setExpanderad] = useState(false)
  const router = useRouter()
  const pendingRef = useRef<Map<string, string>>(new Map())
  const debounceTimer = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Fyller webbläsarens innehållsyta, samma princip som MotesanteckningarSektion —
  // Escape fångas i capture-fasen så den bara stänger den här vyn, inte hela
  // uppgifts-/projektformuläret bakom den.
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

  // Flush av allt osparat vid stängning/byte av projekt.
  useEffect(() => {
    const pending = pendingRef.current
    return () => {
      pending.forEach((innehall, blockId) => {
        sparaProjektAnteckning(projektId, blockId, innehall)
      })
    }
  }, [projektId])

  function innehallForBlock(blockId: string) {
    return anteckningar.find((a) => a.block_id === blockId)?.innehall ?? ''
  }

  function uppdateraLokalt(blockId: string, innehall: string) {
    setAnteckningar((bas) => {
      const finns = bas.some((a) => a.block_id === blockId)
      return finns
        ? bas.map((a) => (a.block_id === blockId ? { ...a, innehall } : a))
        : [...bas, { block_id: blockId, innehall }]
    })
  }

  function schemalaggSpara(blockId: string, innehall: string) {
    const befintlig = debounceTimer.current.get(blockId)
    if (befintlig) clearTimeout(befintlig)
    debounceTimer.current.set(
      blockId,
      setTimeout(() => {
        sparaProjektAnteckning(projektId, blockId, innehall)
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
    sparaProjektAnteckning(projektId, blockId, innehall)
    pendingRef.current.delete(blockId)
  }

  // Samma resonemang som MotesanteckningarSektion.handleSparaAlla: router.refresh()
  // körs bara vid det uttryckliga klicket, inte i det tysta autosparet, så det inte
  // stör skrivfokus.
  async function handleSparaAlla() {
    setSparar(true)
    const poster = Array.from(pendingRef.current.entries())
    poster.forEach(([blockId]) => {
      const timer = debounceTimer.current.get(blockId)
      if (timer) clearTimeout(timer)
    })
    await Promise.all(poster.map(([blockId, innehall]) => sparaProjektAnteckning(projektId, blockId, innehall)))
    poster.forEach(([blockId]) => pendingRef.current.delete(blockId))
    router.refresh()
    setSparar(false)
  }

  if (blocks.length === 0) return null

  return (
    <div
      className={
        expanderad
          ? 'fixed inset-0 z-[60] flex flex-col gap-4 overflow-y-auto bg-surface p-6'
          : 'flex flex-col gap-3 border-t border-border-subtle pt-4'
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

      {expanderad ? (
        <h3 className="shrink-0 text-sm font-semibold">Projektanteckningar</h3>
      ) : (
        <div className="flex shrink-0 items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-stone-500">Projektanteckningar</h3>
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

      {blocks.map((block) => (
        <div key={block.id} className="shrink-0">
          <Field
            label={block.namn}
            htmlFor={`projekt-anteckning-block-${block.id}`}
            hint={block.beskrivning ?? undefined}
          >
            <MarkdownEditor
              id={`projekt-anteckning-block-${block.id}`}
              value={innehallForBlock(block.id)}
              onChange={(value) => handleChange(block.id, value)}
              onBlur={(value) => handleBlur(block.id, value)}
            />
          </Field>
        </div>
      ))}

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
