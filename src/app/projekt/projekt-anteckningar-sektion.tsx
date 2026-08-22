'use client'

import { useEffect, useRef, useState } from 'react'
import { sparaProjektAnteckning } from './actions'
import { Field } from '@/components/ui/field'
import { MarkdownEditor } from '@/components/ui/markdown-editor'

type Block = { id: string; namn: string; beskrivning: string | null }
type Anteckning = { block_id: string; innehall: string }

// Separat modul från MotesanteckningarSektion (uppgifter/motesanteckningar-sektion.tsx):
// innehållet lagras per projekt (projekt_anteckning), inte per uppgift, så samma
// anteckningar syns oavsett vilken uppgift i projektet man öppnar den från.
// initialAnteckningar hämtas färdigt server-side av respektive sidas page.tsx
// (samma mönster som uppgift_anteckning) — ingen egen nätverksrunda vid öppning.
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
  const pendingRef = useRef<Map<string, string>>(new Map())
  const debounceTimer = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

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

  if (blocks.length === 0) return null

  return (
    <div className="flex flex-col gap-3 border-t border-border-subtle pt-4">
      <h3 className="text-sm font-semibold text-stone-500">Projektanteckningar</h3>
      {blocks.map((block) => (
        <Field
          key={block.id}
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
      ))}
    </div>
  )
}
