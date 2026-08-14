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
  const [anteckningar, setAnteckningar] = useState<Anteckning[]>([])
  const [genererar, setGenererar] = useState(false)
  const [genereringsMeddelande, setGenereringsMeddelande] = useState<string | null>(null)
  const [skickar, setSkickar] = useState(false)
  const [expanderad, setExpanderad] = useState(false)
  const pendingRef = useRef<Map<string, string>>(new Map())

  // Sektionen renderas direkt (utan att vänta på hämtningen) så att "Mötesanteckningar"
  // syns omedelbart när typen väljs — annars uppstod en märkbar fördröjning innan hela
  // rutan dök upp. Om användaren hinner skriva innan hämtningen svarar behåller vi det
  // lokalt skrivna istället för att låta serverns (äldre) svar skriva över det.
  useEffect(() => {
    let aktiv = true
    hamtaAnteckningarForUppgift(uppgiftId).then((rader) => {
      if (!aktiv) return
      setAnteckningar(() => {
        const fraServern = rader.map((r) => {
          const lokalt = pendingRef.current.get(r.block_id)
          return lokalt !== undefined ? { ...r, innehall: lokalt } : r
        })
        const saknasLokalt = Array.from(pendingRef.current.entries())
          .filter(([blockId]) => !rader.some((r) => r.block_id === blockId))
          .map(([blockId, innehall]) => ({
            block_id: blockId,
            innehall,
            uppgift_id_genererad: null,
            genererad_titel: null,
            genererad_deadline: null,
          }))
        return [...fraServern, ...saknasLokalt]
      })
    })
    return () => {
      aktiv = false
    }
  }, [uppgiftId])

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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Mötesanteckningar</h3>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => setExpanderad((v) => !v)}>
            {expanderad ? 'Stäng' : 'Expandera'}
          </Button>
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
        )
      })}
    </div>
  )
}
