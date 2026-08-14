export function buildMailto({
  till,
  amne,
  brodtext,
}: {
  till: string[]
  amne: string
  brodtext: string
}): string {
  const mottagare = till.join(',')
  return `mailto:${mottagare}?subject=${encodeURIComponent(amne)}&body=${encodeURIComponent(brodtext)}`
}
