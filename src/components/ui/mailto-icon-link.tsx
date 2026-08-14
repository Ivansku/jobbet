function MailIcon({ className = '' }: { className?: string }) {
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
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  )
}

// Syns bara där en e-post faktiskt finns (villkoras av anroparen) — öppnar
// användarens mailklient. Ligger som en syskon-länk bredvid klickbara rader
// istället för nästlad i dem, så den inte också triggar radens egen onClick.
export function MailtoIconLink({ epost, namn }: { epost: string; namn: string }) {
  return (
    <a
      href={`mailto:${epost}`}
      onClick={(e) => e.stopPropagation()}
      aria-label={`Mejla ${namn}`}
      title={epost}
      className="shrink-0 rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-accent-50 hover:text-accent-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 dark:hover:bg-accent-950 dark:hover:text-accent-400"
    >
      <MailIcon className="h-4 w-4" />
    </a>
  )
}
