'use client'

import { useEffect, useRef, type ReactNode } from 'react'

// Håller ordning på vilka Modal-instanser som är öppna just nu (t.ex. en
// uppgift öppnad ovanpå en annan via "Tidigare dialog"), så att Escape bara
// stänger den översta — annars stänger ett enda tryck alla stängda modaler
// på en gång eftersom varje instans lyssnar på document oberoende av de andra.
let oppnaModaler: symbol[] = []

export function Modal({
  onClose,
  children,
  labelledBy,
}: {
  onClose: () => void
  children: ReactNode
  labelledBy?: string
}) {
  const modalId = useRef(Symbol()).current

  useEffect(() => {
    oppnaModaler.push(modalId)
    return () => {
      oppnaModaler = oppnaModaler.filter((id) => id !== modalId)
    }
  }, [modalId])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && oppnaModaler[oppnaModaler.length - 1] === modalId) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, modalId])

  // En vanlig onClick stänger även när man t.ex. drar för att markera text i
  // ett fält och råkar släppa musen utanför dialogrutan — click-eventets mål
  // blir då bakgrunden (närmsta gemensamma förälder till mousedown- och
  // mouseup-elementen), inte fältet man faktiskt höll på med. Kräver därför
  // att BÅDE mousedown och mouseup sker direkt på bakgrunden för att stänga.
  const mousedownPaBakgrund = useRef(false)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
      onMouseDown={(e) => {
        mousedownPaBakgrund.current = e.target === e.currentTarget
      }}
      onMouseUp={(e) => {
        if (mousedownPaBakgrund.current && e.target === e.currentTarget) onClose()
        mousedownPaBakgrund.current = false
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-border-subtle bg-surface p-6 shadow-lg"
      >
        {children}
      </div>
    </div>
  )
}
