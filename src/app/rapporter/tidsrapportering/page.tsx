import { createClient } from '@/lib/supabase/server'
import { AppNav } from '../../nav'
import { RapporterNav } from '../rapporter-nav'
import { TidsrapportVy } from './tidsrapport-vy'
import { enTillRelation } from '@/lib/postgrest'
import { hamtaTidigareDialogerForKunder } from '../../uppgifter/actions'

// Fältuppsättning som det delade uppgiftsformuläret (src/app/uppgifter/uppgift-formular.tsx)
// kräver för att kunna öppna en rad direkt från rapporten — samma mönster som
// uppgifter/page.tsx och src/app/page.tsx.
const UPPGIFT_FORMULAR_FALT =
  'id, titel, beskrivning, status, prioritet, deadline, klockslag, person_id, kund_id, typ_id, kategori_id, projekt_id, serie_id, sortordning, tidsatgang_timmar, ar_placeholder, anteckningsmall_id, utan_anteckningsmall, uppgift_deltagare(kontaktperson_id), uppgift_anteckning!uppgift_anteckning_uppgift_id_fkey(block_id, innehall, uppgift_id_genererad, genererad:uppgift!uppgift_anteckning_uppgift_id_genererad_fkey(titel, deadline))'

// All datumräkning görs i UTC för att undvika att lokal tidszon (t.ex. svensk sommartid)
// får datum att hoppa fram/tillbaka en dag vid konvertering mellan Date och ISO-sträng.
// Samma mönster som src/app/uppgifter/page.tsx.

function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function formatISODate(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getMonday(d: Date): Date {
  const day = d.getUTCDay()
  const diff = (day === 0 ? -6 : 1) - day
  const monday = new Date(d)
  monday.setUTCDate(monday.getUTCDate() + diff)
  return monday
}

function todayISODate(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const MANADER = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
const MANADER_FULLA = [
  'januari',
  'februari',
  'mars',
  'april',
  'maj',
  'juni',
  'juli',
  'augusti',
  'september',
  'oktober',
  'november',
  'december',
]

function veckoetikett(monday: Date, sunday: Date): string {
  const m1 = MANADER[monday.getUTCMonth()]
  const m2 = MANADER[sunday.getUTCMonth()]
  const d1 = monday.getUTCDate()
  const d2 = sunday.getUTCDate()
  const ar = sunday.getUTCFullYear()
  return m1 === m2 ? `${d1}–${d2} ${m1} ${ar}` : `${d1} ${m1} – ${d2} ${m2} ${ar}`
}

export type Period = 'vecka' | 'manad' | 'kvartal' | 'ar'

// Alla tre perioder delar samma "anchor date"-modell: startISO/slutISO räknas
// alltid fram från en enda ankardatum, och föregående/nästa hoppar till
// respektive periods startdatum — så samma URL-mönster (datum + period)
// funkar oavsett granularitet.
function periodRange(anchor: Date, period: Period): { start: Date; end: Date } {
  if (period === 'manad') {
    const y = anchor.getUTCFullYear()
    const m = anchor.getUTCMonth()
    return { start: new Date(Date.UTC(y, m, 1)), end: new Date(Date.UTC(y, m + 1, 0)) }
  }
  if (period === 'kvartal') {
    const y = anchor.getUTCFullYear()
    const qStart = Math.floor(anchor.getUTCMonth() / 3) * 3
    return { start: new Date(Date.UTC(y, qStart, 1)), end: new Date(Date.UTC(y, qStart + 3, 0)) }
  }
  if (period === 'ar') {
    const y = anchor.getUTCFullYear()
    return { start: new Date(Date.UTC(y, 0, 1)), end: new Date(Date.UTC(y, 11, 31)) }
  }
  const monday = getMonday(anchor)
  const sunday = new Date(monday)
  sunday.setUTCDate(sunday.getUTCDate() + 6)
  return { start: monday, end: sunday }
}

function stegaPeriod(periodStart: Date, period: Period, steg: 1 | -1): Date {
  if (period === 'manad') {
    return new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() + steg, 1))
  }
  if (period === 'kvartal') {
    return new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() + steg * 3, 1))
  }
  if (period === 'ar') {
    return new Date(Date.UTC(periodStart.getUTCFullYear() + steg, 0, 1))
  }
  const d = new Date(periodStart)
  d.setUTCDate(d.getUTCDate() + steg * 7)
  return d
}

function periodEtikett(period: Period, start: Date, end: Date): string {
  if (period === 'manad') return `${MANADER_FULLA[start.getUTCMonth()]} ${start.getUTCFullYear()}`
  if (period === 'kvartal') {
    const kvartal = Math.floor(start.getUTCMonth() / 3) + 1
    return `Kvartal ${kvartal} ${start.getUTCFullYear()}`
  }
  if (period === 'ar') return `${start.getUTCFullYear()}`
  return veckoetikett(start, end)
}

function idagLabel(period: Period): string {
  if (period === 'manad') return 'Denna månad'
  if (period === 'kvartal') return 'Detta kvartal'
  if (period === 'ar') return 'Detta år'
  return 'Denna vecka'
}

type Rad = {
  id: string
  titel: string
  typNamn: string | null
  kategoriId: string
  kategoriNamn: string | null
  kundNamn: string
  dag: string
  timmar: number
}
type KategoriTotal = { kategoriId: string; kategoriNamn: string; timmar: number }

export const UTAN_KATEGORI_ID = 'utan'

export default async function TidsrapporteringPage({
  searchParams,
}: {
  searchParams: Promise<{ datum?: string; period?: string; person?: string; kategori?: string }>
}) {
  const { datum, period: periodParam, person, kategori: kategoriParam } = await searchParams
  const period: Period =
    periodParam === 'manad' || periodParam === 'kvartal' || periodParam === 'ar' ? periodParam : 'vecka'
  const { start, end } = periodRange(parseISODate(datum ?? todayISODate()), period)
  const startISO = formatISODate(start)
  const endISO = formatISODate(end)

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: aktuellPerson } = await supabase
    .from('person')
    .select('id')
    .eq('auth_user_id', user?.id ?? '')
    .single()

  const valdPersonId = person ?? aktuellPerson?.id ?? 'alla'
  const valdKategoriId = kategoriParam ?? 'alla'

  let uppgiftQuery = supabase.from('uppgift').select(UPPGIFT_FORMULAR_FALT).gte('deadline', startISO).lte('deadline', endISO)

  if (valdPersonId !== 'alla') {
    uppgiftQuery = uppgiftQuery.eq('person_id', valdPersonId)
  }

  const [
    { data: uppgifter },
    { data: personer },
    { data: kunder },
    { data: typer },
    { data: kategori },
    { data: projekt },
    { data: serier },
    { data: kontaktpersoner },
    { data: placeholders },
    { data: block },
  ] = await Promise.all([
    uppgiftQuery.order('deadline'),
    supabase.from('person').select('id, namn').order('namn'),
    supabase.from('kund').select('id, namn').order('namn'),
    supabase.from('uppgiftstyp').select('id, namn, anteckningsmall_id').order('namn'),
    supabase.from('kategori').select('id, namn').order('namn'),
    supabase
      .from('projekt')
      .select(
        'id, namn, kund_id, farg, mall_projekt:mall_projekt_id(kategori_id, anteckningsmall_id), projekt_anteckning(block_id, innehall)'
      )
      .order('namn'),
    supabase
      .from('uppgift_serie')
      .select(
        'id, titel, beskrivning, person_id, kund_id, typ_id, kategori_id, prioritet, start_datum, serie_typ, veckodagar, intervall, slut_datum, tidsatgang_timmar, klockslag, outlook_series_id, synk_fran_datum'
      )
      .order('titel'),
    supabase.from('kontaktperson').select('id, kund_id, fornamn, efternamn, epost').order('fornamn'),
    supabase.from('uppgift').select('id, titel, deadline, projekt_id, typ_id').eq('ar_placeholder', true),
    supabase
      .from('anteckningsblock')
      .select('id, namn, beskrivning, anteckningsmall_id')
      .eq('aktiv', true)
      .order('sortordning'),
  ])

  const kundNamnMap = new Map((kunder ?? []).map((k) => [k.id, k.namn]))
  const typNamnMap = new Map((typer ?? []).map((t) => [t.id, t.namn]))
  const kategoriNamnMap = new Map((kategori ?? []).map((k) => [k.id, k.namn]))

  // Kategori-boxarna ska alltid visa hela veckans fördelning oavsett kategorifilter
  // (samma princip som Flexels saldoboxar, som inte påverkas av modul-filtret) —
  // summeras därför från alla uppgifter innan kategorifiltret appliceras nedan.
  // Alla rader för veckan (person-filtrerade, men INTE kategori-filtrerade) skickas
  // till klienten, som sköter kategori-filtreringen lokalt — annars krävs en server-
  // rundtripp (ny sida, nya Supabase-anrop) för varje klick på en kategoribox, vilket
  // kändes segt jämfört med en ren UI-toggle.
  const alleRader: Rad[] = (uppgifter ?? [])
    .filter((u): u is typeof u & { deadline: string } => !!u.deadline)
    .map((u) => ({
      id: u.id,
      titel: u.titel,
      typNamn: u.typ_id ? (typNamnMap.get(u.typ_id) ?? null) : null,
      kategoriId: u.kategori_id ?? UTAN_KATEGORI_ID,
      kategoriNamn: u.kategori_id ? (kategoriNamnMap.get(u.kategori_id) ?? null) : null,
      kundNamn: u.kund_id ? (kundNamnMap.get(u.kund_id) ?? 'Okänd kund') : 'Utan kund',
      dag: u.deadline,
      timmar: u.tidsatgang_timmar ?? 0,
    }))

  const kategoriTotaler = new Map<string, { namn: string; timmar: number }>()
  for (const r of alleRader) {
    const namn = r.kategoriNamn ?? 'Utan kategori'
    const befintlig = kategoriTotaler.get(r.kategoriId)
    kategoriTotaler.set(r.kategoriId, { namn, timmar: (befintlig?.timmar ?? 0) + r.timmar })
  }
  const sorteradeKategoriTotaler: KategoriTotal[] = [...kategoriTotaler.entries()]
    .map(([kategoriId, { namn, timmar }]) => ({ kategoriId, kategoriNamn: namn, timmar }))
    .sort((a, b) => {
      if (a.kategoriId === UTAN_KATEGORI_ID) return 1
      if (b.kategoriId === UTAN_KATEGORI_ID) return -1
      return a.kategoriNamn.localeCompare(b.kategoriNamn, 'sv')
    })

  const tidigareDialoger = await hamtaTidigareDialogerForKunder((kunder ?? []).map((k) => k.id))

  const prevAnchor = stegaPeriod(start, period, -1)
  const nextAnchor = stegaPeriod(start, period, 1)

  return (
    <>
      <AppNav />
      <main className="mx-auto w-full max-w-3xl flex-1 p-6 md:p-8">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">Rapporter</h1>
        <RapporterNav />
        <TidsrapportVy
          periodEtikett={periodEtikett(period, start, end)}
          idagLabel={idagLabel(period)}
          prevPeriodHref={`/rapporter/tidsrapportering?datum=${formatISODate(prevAnchor)}&period=${period}&person=${valdPersonId}&kategori=${valdKategoriId}`}
          nextPeriodHref={`/rapporter/tidsrapportering?datum=${formatISODate(nextAnchor)}&period=${period}&person=${valdPersonId}&kategori=${valdKategoriId}`}
          idagHref={`/rapporter/tidsrapportering?period=${period}&person=${valdPersonId}&kategori=${valdKategoriId}`}
          personer={personer ?? []}
          valdPersonId={valdPersonId}
          initialKategoriId={valdKategoriId}
          kategoriTotaler={sorteradeKategoriTotaler}
          period={period}
          datum={startISO}
          alleRader={alleRader}
          uppgifterFulla={uppgifter ?? []}
          kunder={kunder ?? []}
          typer={typer ?? []}
          kategoriLista={kategori ?? []}
          projekt={(projekt ?? []).map((p) => ({
            id: p.id,
            namn: p.namn,
            kund_id: p.kund_id,
            farg: p.farg,
            mallProjektKategoriId: enTillRelation(p.mall_projekt)?.kategori_id ?? null,
            mallProjektAnteckningsmallId: enTillRelation(p.mall_projekt)?.anteckningsmall_id ?? null,
            projektAnteckningar: p.projekt_anteckning,
          }))}
          serier={serier ?? []}
          kontaktpersoner={kontaktpersoner ?? []}
          placeholders={placeholders ?? []}
          block={block ?? []}
          tidigareDialoger={tidigareDialoger}
        />
      </main>
    </>
  )
}
