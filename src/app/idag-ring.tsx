export function IdagRing({ klara, totalt }: { klara: number; totalt: number }) {
  const andel = totalt > 0 ? Math.round((klara / totalt) * 100) : 0
  const status = totalt === 0 ? 'Inget planerat idag' : andel === 100 ? 'Allt avklarat' : 'Bra tempo'

  return (
    <div className="flex items-center gap-4">
      <div
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full"
        style={{
          background: `conic-gradient(var(--color-accent-500) ${andel}%, var(--color-border-subtle) ${andel}% 100%)`,
        }}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-sm font-semibold">
          {andel}%
        </div>
      </div>
      <div>
        <p className="text-[15px] font-semibold text-foreground">
          {klara} av {totalt} klara
        </p>
        <p className="text-sm text-stone-500">{status}</p>
      </div>
    </div>
  )
}
