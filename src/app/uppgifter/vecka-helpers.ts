// Samma UTC-säkra måndagsberäkning som page.tsx använder server-side, men som en
// liten delad hjälpfunktion för klientkomponenter som bara behöver bygga en
// vecko-länk (t.ex. till ett äldre möte som inte finns i den aktuella vyn).
export function mondagAvVecka(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const day = date.getUTCDay()
  const diff = (day === 0 ? -6 : 1) - day
  date.setUTCDate(date.getUTCDate() + diff)
  const yy = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}
