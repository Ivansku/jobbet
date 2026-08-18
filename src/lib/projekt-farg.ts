// Fast, förvald palett istället för fri hex-väljare — matchar CHECK-constrainten på
// projekt.farg och håller sig undan färger som redan har betydelse i systemet
// (accent=rosa/brand, success=grön, warning=amber, danger=röd).
export type ProjektFarg = 'blue' | 'indigo' | 'violet' | 'teal' | 'cyan' | 'orange' | 'lime' | 'slate'

export const PROJEKT_FARGER: { value: ProjektFarg; label: string; dot: string; kort: string }[] = [
  { value: 'blue', label: 'Blå', dot: 'bg-blue-400 dark:bg-blue-500', kort: 'bg-blue-50 dark:bg-blue-950/40' },
  { value: 'indigo', label: 'Indigo', dot: 'bg-indigo-400 dark:bg-indigo-500', kort: 'bg-indigo-50 dark:bg-indigo-950/40' },
  { value: 'violet', label: 'Violett', dot: 'bg-violet-400 dark:bg-violet-500', kort: 'bg-violet-50 dark:bg-violet-950/40' },
  { value: 'teal', label: 'Turkos', dot: 'bg-teal-400 dark:bg-teal-500', kort: 'bg-teal-50 dark:bg-teal-950/40' },
  { value: 'cyan', label: 'Cyan', dot: 'bg-cyan-400 dark:bg-cyan-500', kort: 'bg-cyan-50 dark:bg-cyan-950/40' },
  { value: 'orange', label: 'Orange', dot: 'bg-orange-400 dark:bg-orange-500', kort: 'bg-orange-50 dark:bg-orange-950/40' },
  { value: 'lime', label: 'Lime', dot: 'bg-lime-400 dark:bg-lime-500', kort: 'bg-lime-50 dark:bg-lime-950/40' },
  { value: 'slate', label: 'Grå', dot: 'bg-slate-400 dark:bg-slate-500', kort: 'bg-slate-50 dark:bg-slate-950/40' },
]

const KORT_BAKGRUND = new Map(PROJEKT_FARGER.map((f) => [f.value, f.kort]))

// Fallback till kortens vanliga yta (bg-surface) när projektet saknar färg.
export function projektKortBakgrund(farg: string | null | undefined): string {
  return (farg && KORT_BAKGRUND.get(farg as ProjektFarg)) || 'bg-surface'
}
