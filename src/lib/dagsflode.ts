// Samma Intl-baserade mönster som stockholmDatumOchKlockslag i
// src/app/api/integrationer/outlook/route.ts — säkerställer korrekt lokal tid
// (inkl. sommartid) oavsett vilken tidszon servern själv kör i.
export function nuIStockholm(): { datum: string; klockslag: string } {
  const dtf = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Stockholm',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const delar = Object.fromEntries(dtf.formatToParts(new Date()).map((p) => [p.type, p.value]))
  return { datum: `${delar.year}-${delar.month}-${delar.day}`, klockslag: `${delar.hour}:${delar.minute}` }
}

export type Dagsflode = 'morgon' | 'mitt' | 'kvall'

export function aktivtFlode(klockslagNu: string, morgonSlut: string, mittSlut: string): Dagsflode {
  if (klockslagNu < morgonSlut.slice(0, 5)) return 'morgon'
  if (klockslagNu < mittSlut.slice(0, 5)) return 'mitt'
  return 'kvall'
}

// Datumräkning i UTC, samma försiktighet som parseISODate/formatISODate i
// src/app/uppgifter/page.tsx — undviker att lokal tidszon får datumet att
// hoppa fram/tillbaka en dag vid +/- en dag.
export function plusDagar(datumISO: string, dagar: number): string {
  const [y, m, d] = datumISO.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + dagar)
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}
