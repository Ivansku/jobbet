'use client'

const VECKODAGAR_KORT = ['Mån', 'Tis', 'Ons', 'Tors', 'Fre']

export function VeckodagValjare({
  value,
  onChange,
}: {
  value: number[]
  onChange: (value: number[]) => void
}) {
  function toggle(dag: number) {
    onChange(value.includes(dag) ? value.filter((d) => d !== dag) : [...value, dag].sort())
  }

  return (
    <div className="flex gap-1.5">
      {VECKODAGAR_KORT.map((label, i) => {
        const dag = i + 1
        const vald = value.includes(dag)
        return (
          <button
            key={dag}
            type="button"
            onClick={() => toggle(dag)}
            aria-pressed={vald}
            className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-medium transition-colors ${
              vald
                ? 'bg-accent-600 text-white'
                : 'border border-stone-300 text-stone-600 hover:bg-stone-100 dark:border-stone-600 dark:text-stone-400 dark:hover:bg-stone-800'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
