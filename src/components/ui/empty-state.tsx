export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border-subtle px-4 py-8 text-center">
      <p className="text-sm font-medium text-stone-500">{title}</p>
      {description && <p className="text-xs text-stone-400">{description}</p>}
    </div>
  )
}
