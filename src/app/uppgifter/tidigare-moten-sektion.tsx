export type TidigareMote = { id: string; titel: string; deadline: string; utdrag: string[] }

export function TidigareMotenSektion({
  moten,
  excludeUppgiftId,
  onOppna,
}: {
  moten: TidigareMote[]
  excludeUppgiftId?: string
  onOppna: (uppgiftId: string) => void
}) {
  const lista = excludeUppgiftId ? moten.filter((m) => m.id !== excludeUppgiftId) : moten

  if (lista.length === 0) return null

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border-subtle p-3">
      <ul className="flex flex-col gap-2">
        {lista.map((m) => (
          <li key={m.id} className="text-xs">
            <button
              type="button"
              onClick={() => onOppna(m.id)}
              className="text-left font-medium text-accent-600 hover:underline dark:text-accent-400"
            >
              {m.titel} ({m.deadline})
            </button>
            {m.utdrag.length > 0 && <p className="mt-0.5 truncate text-stone-400">{m.utdrag.join(' · ')}</p>}
          </li>
        ))}
      </ul>
    </div>
  )
}
