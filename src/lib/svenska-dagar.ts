import { plusDagar } from './dagsflode'

// Svenska Dagar 2.1 (api.dryg.net) — öppet API utan nyckel, drivs av Faboul AB.
// Ett helt år hämtas och cachas i taget (röda dagar för ett redan varit år ändras
// aldrig i efterhand) istället för månads-/dagsanrop, så samma cache-post täcker
// Hem, Uppgifter och Flexel oavsett vilket datumspann respektive sida behöver.

export type SvenskDag = {
  datum: string
  namnsdag: string[]
  rodDag: boolean
  helgdag: string | null
}

type ApiDag = {
  datum: string
  'röd dag': 'Ja' | 'Nej'
  helgdag?: string
  namnsdag: string[]
}

export async function hamtaSvenskaDagar(ar: number): Promise<Map<string, SvenskDag>> {
  const karta = new Map<string, SvenskDag>()
  try {
    const res = await fetch(`https://api.dryg.net/dagar/v2.1/${ar}`, {
      next: { revalidate: 60 * 60 * 24 },
    })
    if (!res.ok) return karta
    const data: { dagar: ApiDag[] } = await res.json()
    for (const d of data.dagar) {
      karta.set(d.datum, {
        datum: d.datum,
        namnsdag: d.namnsdag ?? [],
        rodDag: d['röd dag'] === 'Ja',
        helgdag: d.helgdag ?? null,
      })
    }
  } catch {
    // API:et är "as-is" utan garantier — vid fel/timeout visas sidan bara utan
    // namnsdags-/röd dag-information istället för att hela sidladdningen kraschar.
  }
  return karta
}

// Slår ihop flera års-kartor till en (t.ex. när ett datumspann korsar ett årsskifte).
export function slaIhopDagar(...kartor: Map<string, SvenskDag>[]): Map<string, SvenskDag> {
  const karta = new Map<string, SvenskDag>()
  for (const k of kartor) for (const [datum, dag] of k) karta.set(datum, dag)
  return karta
}

export function arHalvdag(dagar: Map<string, SvenskDag>, datum: string): boolean {
  return dagar.get(plusDagar(datum, 1))?.rodDag === true
}

// Delade Tailwind-klasser för röd dag/halvdag-markering (Uppgifter-kolumnen och
// Flexel-raden) — diagonala streck ovanpå standardbakgrunden istället för en egen
// kulör, så det inte krockar med success/klar-grönt eller danger-rött som redan
// betyder något annat i appen.
export const ROD_DAG_STREGMONSTER_KLASS =
  'bg-[repeating-linear-gradient(135deg,rgba(28,25,23,0.08)_0px_2px,transparent_2px_10px)] dark:bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.1)_0px_2px,transparent_2px_10px)]'
export const HALVDAG_MASK_KLASS =
  '[mask-image:linear-gradient(to_bottom,transparent_50%,black_50%)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_50%,black_50%)]'
