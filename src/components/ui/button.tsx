import type { ButtonHTMLAttributes, CSSProperties } from 'react'
import { Spinner } from './spinner'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
type Size = 'md' | 'sm'

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    'rounded-lg bg-[image:var(--gradient-brand-button)] text-white font-semibold shadow-sm hover:shadow-md hover:brightness-110 active:brightness-95 disabled:hover:brightness-100 disabled:hover:shadow-sm',
  secondary:
    'rounded-lg border border-stone-300 bg-surface text-foreground shadow-sm hover:bg-stone-100 hover:border-stone-400 dark:border-stone-600 dark:hover:bg-stone-800',
  danger:
    'rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950',
  ghost: 'rounded-lg text-foreground hover:bg-stone-100 dark:hover:bg-stone-800',
}

const SIZE_CLASSES: Record<Size, string> = {
  md: 'px-4 py-2 text-sm',
  sm: 'px-3 py-1.5 text-sm',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  style,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  loading?: boolean
}) {
  // Vit text mot gradientens ljusare (orange) ände behöver lite hjälp för att hålla kontrasten
  const gradientTextShadow: CSSProperties | undefined =
    variant === 'primary' ? { textShadow: '0 1px 1px rgba(0,0,0,0.25)' } : undefined

  return (
    <button
      disabled={disabled || loading}
      style={{ ...gradientTextShadow, ...style }}
      className={`inline-flex items-center justify-center gap-2 font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  )
}
