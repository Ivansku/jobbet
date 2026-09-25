import { Spinner } from './spinner'

function CopyIcon({ className = '' }: { className?: string }) {
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
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

// Enhetlig "Duplicera"-knapp för formulär — samma placering och stil som
// DeleteIconButton, men accentfärgad istället för röd eftersom åtgärden
// inte är destruktiv.
export function DuplicateIconButton({
  onClick,
  label,
  loading = false,
}: {
  onClick: () => void
  label: string
  loading?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-label={label}
      title={label}
      className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-accent-50 hover:text-accent-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-accent-950 dark:hover:text-accent-400"
    >
      {loading ? <Spinner className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
    </button>
  )
}
