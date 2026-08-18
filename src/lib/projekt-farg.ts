// Fast, förvald palett istället för fri hex-väljare — matchar CHECK-constrainten på
// projekt.farg och ger varje ton en garanterad ljust/mörkt-läge-variant. Spänner över
// hela Tailwinds standardfärghjul (röd → orange → ... → rosa) plus grå som neutral ton.
export type ProjektFarg =
  | 'red'
  | 'orange'
  | 'amber'
  | 'yellow'
  | 'lime'
  | 'green'
  | 'emerald'
  | 'teal'
  | 'cyan'
  | 'sky'
  | 'blue'
  | 'indigo'
  | 'violet'
  | 'purple'
  | 'fuchsia'
  | 'pink'
  | 'rose'
  | 'slate'

export const PROJEKT_FARGER: { value: ProjektFarg; label: string; dot: string; kort: string }[] = [
  { value: 'red', label: 'Röd', dot: 'bg-red-400 dark:bg-red-500', kort: 'bg-red-50 dark:bg-red-950/40' },
  { value: 'orange', label: 'Orange', dot: 'bg-orange-400 dark:bg-orange-500', kort: 'bg-orange-50 dark:bg-orange-950/40' },
  { value: 'amber', label: 'Bärnsten', dot: 'bg-amber-400 dark:bg-amber-500', kort: 'bg-amber-50 dark:bg-amber-950/40' },
  { value: 'yellow', label: 'Gul', dot: 'bg-yellow-400 dark:bg-yellow-500', kort: 'bg-yellow-50 dark:bg-yellow-950/40' },
  { value: 'lime', label: 'Lime', dot: 'bg-lime-400 dark:bg-lime-500', kort: 'bg-lime-50 dark:bg-lime-950/40' },
  { value: 'green', label: 'Grön', dot: 'bg-green-400 dark:bg-green-500', kort: 'bg-green-50 dark:bg-green-950/40' },
  { value: 'emerald', label: 'Smaragd', dot: 'bg-emerald-400 dark:bg-emerald-500', kort: 'bg-emerald-50 dark:bg-emerald-950/40' },
  { value: 'teal', label: 'Turkos', dot: 'bg-teal-400 dark:bg-teal-500', kort: 'bg-teal-50 dark:bg-teal-950/40' },
  { value: 'cyan', label: 'Cyan', dot: 'bg-cyan-400 dark:bg-cyan-500', kort: 'bg-cyan-50 dark:bg-cyan-950/40' },
  { value: 'sky', label: 'Himmelsblå', dot: 'bg-sky-400 dark:bg-sky-500', kort: 'bg-sky-50 dark:bg-sky-950/40' },
  { value: 'blue', label: 'Blå', dot: 'bg-blue-400 dark:bg-blue-500', kort: 'bg-blue-50 dark:bg-blue-950/40' },
  { value: 'indigo', label: 'Indigo', dot: 'bg-indigo-400 dark:bg-indigo-500', kort: 'bg-indigo-50 dark:bg-indigo-950/40' },
  { value: 'violet', label: 'Violett', dot: 'bg-violet-400 dark:bg-violet-500', kort: 'bg-violet-50 dark:bg-violet-950/40' },
  { value: 'purple', label: 'Lila', dot: 'bg-purple-400 dark:bg-purple-500', kort: 'bg-purple-50 dark:bg-purple-950/40' },
  { value: 'fuchsia', label: 'Fuchsia', dot: 'bg-fuchsia-400 dark:bg-fuchsia-500', kort: 'bg-fuchsia-50 dark:bg-fuchsia-950/40' },
  { value: 'pink', label: 'Rosa', dot: 'bg-pink-400 dark:bg-pink-500', kort: 'bg-pink-50 dark:bg-pink-950/40' },
  { value: 'rose', label: 'Cerise', dot: 'bg-rose-400 dark:bg-rose-500', kort: 'bg-rose-50 dark:bg-rose-950/40' },
  { value: 'slate', label: 'Grå', dot: 'bg-slate-400 dark:bg-slate-500', kort: 'bg-slate-50 dark:bg-slate-950/40' },
]

const KORT_BAKGRUND = new Map(PROJEKT_FARGER.map((f) => [f.value, f.kort]))

// Fallback till kortens vanliga yta (bg-surface) när projektet saknar färg.
export function projektKortBakgrund(farg: string | null | undefined): string {
  return (farg && KORT_BAKGRUND.get(farg as ProjektFarg)) || 'bg-surface'
}
