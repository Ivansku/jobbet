import type { ReactNode, Ref } from 'react'

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`h-3 w-3 shrink-0 transition-transform ${expanded ? '' : '-rotate-90'}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

// Ihopfällbart block med chevron, etikett och antal. Delas av Uppgifter (vänsterkolumnen)
// och Projekt så att båda ser ut och beter sig likadant. Kontrollerad komponent —
// anroparen äger expanded-state. containerRef/highlighted finns för att Uppgifter
// ska kunna göra blocket till ett dnd-kit-släppområde.
export function CollapsibleSection({
  label,
  count,
  expanded,
  onToggle,
  containerRef,
  highlighted = false,
  children,
}: {
  label: string
  count: number
  expanded: boolean
  onToggle: () => void
  containerRef?: Ref<HTMLDivElement>
  highlighted?: boolean
  children: ReactNode
}) {
  return (
    <div
      ref={containerRef}
      className={`flex flex-col gap-2 rounded-xl border p-3 transition-colors ${
        highlighted ? 'border-accent-400 bg-accent-50 dark:bg-accent-950/40' : 'border-border-subtle bg-white dark:bg-stone-800/60'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex items-center justify-between gap-2 rounded-lg px-1 py-0.5 text-left transition-colors hover:bg-stone-100 dark:hover:bg-stone-700"
      >
        <span className="flex items-center gap-1.5 text-sm font-semibold text-stone-500">
          <ChevronIcon expanded={expanded} />
          {label}
        </span>
        <span className="shrink-0 text-xs font-medium text-stone-400">{count}</span>
      </button>

      {expanded && <div className="flex flex-col gap-2">{children}</div>}
    </div>
  )
}
