import { createClient } from '@/lib/supabase/server'
import { AppNav } from '../../nav'
import { RapporterNav } from '../rapporter-nav'
import { EmptyState } from '@/components/ui/empty-state'
import { FlexelVy } from './flexel-vy'

// All datumräkning görs i UTC, samma mönster som src/app/rapporter/tidsrapportering/page.tsx.

function formatISODate(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function todayISODate(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const MANADER_LANGA = [
  'Januari',
  'Februari',
  'Mars',
  'April',
  'Maj',
  'Juni',
  'Juli',
  'Augusti',
  'September',
  'Oktober',
  'November',
  'December',
]

// Första dagen i månaden som ett ISO-datum ('2026-04-05' -> '2026-04-01').
function manadStart(iso: string): string {
  return iso.slice(0, 7) + '-01'
}

function nastaManad(manadISO: string): string {
  const [y, m] = manadISO.split('-').map(Number)
  return formatISODate(new Date(Date.UTC(y, m, 1)))
}

function foregaendeManad(manadISO: string): string {
  const [y, m] = manadISO.split('-').map(Number)
  return formatISODate(new Date(Date.UTC(y, m - 2, 1)))
}

function manadEtikett(manadISO: string): string {
  const [y, m] = manadISO.split('-').map(Number)
  return `${MANADER_LANGA[m - 1]} ${y}`
}

function fredagarIManad(manadISO: string): number {
  const [y, m] = manadISO.split('-').map(Number)
  let antal = 0
  const d = new Date(Date.UTC(y, m - 1, 1))
  while (d.getUTCMonth() === m - 1) {
    if (d.getUTCDay() === 5) antal++
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return antal
}

// Kvot per månad = antal fredagar den månaden × veckokvoten, tillgänglig i sin helhet
// från månadens start — samma modell som Ivan använde manuellt i Excel och som matchar
// hans månadsvisa rapportering till jobbet/Försäkringskassan. Fredag (inte måndag) är
// dagen som avgör vilken månad en vecka hör till, se veckorForManad nedan.
function baseKvotSedan(aktiveradManad: string, tomManad: string, veckokvot: number): number {
  let total = 0
  let cursor = aktiveradManad
  while (cursor <= tomManad) {
    total += fredagarIManad(cursor) * veckokvot
    cursor = nastaManad(cursor)
  }
  return total
}

function addDagar(iso: string, antal: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return formatISODate(new Date(Date.UTC(y, m - 1, d + antal)))
}

function mondagAvVecka(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  const veckodag = d.getUTCDay() || 7
  return addDagar(iso, -(veckodag - 1))
}

// Standard ISO 8601-veckonummer.
function isoVeckonummer(iso: string): number {
  const d = new Date(iso + 'T00:00:00Z')
  const veckodag = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - veckodag)
  const arsStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - arsStart.getTime()) / 86400000 + 1) / 7)
}

// En vecka hör till den månad dess fredag ligger i — annars skulle samma ISO-vecka
// kunna dyka upp ofullständig i två månader i rad. Veckan visas hel (mån–fre) även
// om måndagen råkar ligga i föregående månad.
function veckorForManad(manadISO: string, nastaManadISO: string): { veckonummer: number; dagar: string[] }[] {
  const veckor: { veckonummer: number; dagar: string[] }[] = []
  let monday = mondagAvVecka(manadISO)
  while (true) {
    const fredag = addDagar(monday, 4)
    if (fredag >= manadISO && fredag < nastaManadISO) {
      veckor.push({
        veckonummer: isoVeckonummer(monday),
        dagar: [0, 1, 2, 3, 4].map((n) => addDagar(monday, n)),
      })
    }
    if (fredag >= nastaManadISO) break
    monday = addDagar(monday, 7)
  }
  return veckor
}

const MODUL_LABEL: Record<string, string> = {
  flex: 'Flex',
  overtid: 'Övertid',
  foraldraledig: 'Föräldraledig',
  ledighet: 'Ledighet',
}
const STANDARD_VECKOKVOT = 8

export default async function FlexelPage({
  searchParams,
}: {
  searchParams: Promise<{ manad?: string; modul?: string }>
}) {
  const { manad, modul } = await searchParams
  const manadISO = manadStart(manad ?? todayISODate())
  const nastaManadISO = nastaManad(manadISO)
  const foregaendeManadISO = foregaendeManad(manadISO)
  const valdModul = modul ?? 'alla'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: person } = await supabase
    .from('person')
    .select('id, foretag_id')
    .eq('auth_user_id', user?.id ?? '')
    .single()

  const hrefFor = (m: string) => `/rapporter/flexel?manad=${m}&modul=${valdModul}`

  if (!person) {
    return (
      <>
        <AppNav />
        <main className="mx-auto w-full max-w-3xl flex-1 p-6 md:p-8">
          <h1 className="mb-4 text-2xl font-semibold tracking-tight">Rapporter</h1>
          <RapporterNav />
          <EmptyState title="Kunde inte identifiera person" />
        </main>
      </>
    )
  }

  const [{ data: installningar }, { data: poster }, { data: justeringar }] = await Promise.all([
    supabase
      .from('flexel_installning')
      .select('modul, aktiv, veckokvot_timmar, created_at')
      .eq('person_id', person.id),
    supabase
      .from('flexel_post')
      .select('id, modul, datum, timmar, motivering')
      .eq('person_id', person.id)
      .order('datum', { ascending: false }),
    supabase
      .from('flexel_kvotjustering')
      .select('id, manad, justering_timmar, kommentar')
      .eq('person_id', person.id)
      .order('manad', { ascending: false }),
  ])

  // Ledighet är ingen aktiverbar modul i Systemadministration — alla har den,
  // så den läggs alltid till oavsett vad flexel_installning säger.
  const aktivaModuler = [
    ...(installningar ?? []).filter((i) => i.aktiv),
    { modul: 'ledighet', aktiv: true, veckokvot_timmar: null, created_at: '' },
  ]

  // Veckorna som visas för den här månaden — se veckorForManad ovan för varför
  // fredagen avgör tillhörighet. allaDatumDennaManad styr både vilka loggrader som
  // hör hit och "denna månad"-summorna, så de alltid är i synk med listan.
  const veckor = veckorForManad(manadISO, nastaManadISO)
  const allaDatumDennaManad = new Set(veckor.flatMap((v) => v.dagar))

  const saldon = aktivaModuler.map((m) => {
    const alla = (poster ?? []).filter((p) => p.modul === m.modul)
    return {
      modul: m.modul,
      label: MODUL_LABEL[m.modul],
      saldo: alla.reduce((sum, p) => sum + p.timmar, 0),
      dennaManaden: alla
        .filter((p) => allaDatumDennaManad.has(p.datum))
        .reduce((sum, p) => sum + p.timmar, 0),
    }
  })

  const foraldraledigInstallning = aktivaModuler.find((m) => m.modul === 'foraldraledig')
  let foraldraledigInfo = null
  if (foraldraledigInstallning) {
    const veckokvot = foraldraledigInstallning.veckokvot_timmar ?? STANDARD_VECKOKVOT
    const aktiveradManad = manadStart(formatISODate(new Date(foraldraledigInstallning.created_at)))
    const aktuellManad = manadStart(todayISODate())
    const justeringSumma = (justeringar ?? []).reduce((sum, j) => sum + j.justering_timmar, 0)
    const uttagetTotalt = (poster ?? [])
      .filter((p) => p.modul === 'foraldraledig')
      .reduce((sum, p) => sum + p.timmar, 0)
    const kvotSaldo = baseKvotSedan(aktiveradManad, aktuellManad, veckokvot) + justeringSumma - uttagetTotalt

    const dennaManadensJustering = (justeringar ?? [])
      .filter((j) => j.manad === manadISO)
      .reduce((sum, j) => sum + j.justering_timmar, 0)
    const dennaManadensUttag = (poster ?? [])
      .filter((p) => p.modul === 'foraldraledig' && allaDatumDennaManad.has(p.datum))
      .reduce((sum, p) => sum + p.timmar, 0)

    foraldraledigInfo = {
      veckokvot,
      kvotSaldo,
      visadManad: manadISO,
      dennaManadensKvot: fredagarIManad(manadISO) * veckokvot + dennaManadensJustering,
      dennaManadensUttag,
    }
  }

  const filtreradeRader = (poster ?? []).filter(
    (p) => allaDatumDennaManad.has(p.datum) && (valdModul === 'alla' || p.modul === valdModul)
  )

  // En rad per vardag i respektive veckas hela mån–fre-spann, så att man kan klicka
  // sig fram dag för dag — tomma dagar öppnar "Ny rad" med det datumet ifyllt, dagar
  // med flera registreringar (t.ex. delade Föräldraledig-dagar) blir flera rader
  // under samma datum.
  type Post = (typeof filtreradeRader)[number]
  type DagRad = { datum: string; post: Post | null }
  const radPerDatum = new Map<string, Post[]>()
  for (const p of filtreradeRader) {
    const lista = radPerDatum.get(p.datum) ?? []
    lista.push(p)
    radPerDatum.set(p.datum, lista)
  }

  type VeckoGrupp = {
    veckonummer: number
    totalTimmar: number
    totalPerModul: { modul: string; timmar: number }[]
    dagar: DagRad[]
  }
  const veckoGrupper: VeckoGrupp[] = veckor.map((v) => {
    const dagar: DagRad[] = v.dagar.flatMap((datum): DagRad[] => {
      const rader = radPerDatum.get(datum) ?? []
      if (rader.length > 0) return rader.map((post) => ({ datum, post }))
      return [{ datum, post: null }]
    })
    const perModul = new Map<string, number>()
    for (const d of dagar) {
      if (!d.post) continue
      perModul.set(d.post.modul, (perModul.get(d.post.modul) ?? 0) + d.post.timmar)
    }
    return {
      veckonummer: v.veckonummer,
      totalTimmar: dagar.reduce((sum, d) => sum + (d.post?.timmar ?? 0), 0),
      totalPerModul: [...perModul.entries()].map(([modul, timmar]) => ({ modul, timmar })),
      dagar,
    }
  })

  return (
    <>
      <AppNav />
      <main className="mx-auto w-full max-w-3xl flex-1 p-6 md:p-8">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">Rapporter</h1>
        <RapporterNav />
        <FlexelVy
          aktivaModuler={aktivaModuler.map((m) => ({
            modul: m.modul,
            label: MODUL_LABEL[m.modul],
            veckokvotTimmar: m.veckokvot_timmar ?? STANDARD_VECKOKVOT,
          }))}
          saldon={saldon}
          foraldraledigInfo={foraldraledigInfo}
          manadEtikett={manadEtikett(manadISO)}
          prevManadHref={hrefFor(foregaendeManadISO)}
          nextManadHref={hrefFor(nastaManadISO)}
          idagHref={`/rapporter/flexel?modul=${valdModul}`}
          manad={manadISO}
          valdModul={valdModul}
          veckoGrupper={veckoGrupper}
          modulLabel={MODUL_LABEL}
          senasteJusteringar={(justeringar ?? []).slice(0, 5)}
        />
      </main>
    </>
  )
}
