import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react'

const FIELD_CLASSES =
  'w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-foreground placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-accent-500/40 focus:border-accent-500 disabled:cursor-not-allowed disabled:opacity-50'

// Håller årtalet i alla datumfält inom fyra siffror — utan gränser går det
// att skriva in t.ex. ett femsiffrigt år i den inbyggda datumväljaren
// (samma sorts fel som orsakade serie-buggen med förekomster år 2083).
// Fält som redan sätter ett eget min (t.ex. slutdatum ≥ startdatum) styr
// fortfarande själva — det här är bara standardvärdet när inget annat sätts.
const DATUM_MIN_STANDARD = '2000-01-01'
const DATUM_MAX_STANDARD = '2099-12-31'

export function Input({ className = '', type, min, max, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const arDatum = type === 'date'
  return (
    <input
      type={type}
      min={arDatum ? (min ?? DATUM_MIN_STANDARD) : min}
      max={arDatum ? (max ?? DATUM_MAX_STANDARD) : max}
      className={`${FIELD_CLASSES} ${className}`}
      {...props}
    />
  )
}

export function Textarea({
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${FIELD_CLASSES} ${className}`} {...props} />
}

export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${FIELD_CLASSES} cursor-pointer ${className}`} {...props} />
}
