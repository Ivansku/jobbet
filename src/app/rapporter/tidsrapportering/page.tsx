import { createClient } from '@/lib/supabase/server'
import { AppNav } from '../../nav'
import { RapporterNav } from '../rapporter-nav'
import { TidsrapportVy } from './tidsrapport-vy'

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

function veckoetikett(monday: Date, sunday: Date): string {
  const m1 = MANADER[monday.getUTCMonth()]
  const m2 = MANADER[sunday.getUTCMonth()]
  const d1 = monday.getUTCDate()
  const d2 = sunday.getUTCDate()
  const ar = sunday.getUTCFullYear()
  return m1 === m2 ? `${d1}–${d2} ${m1} ${ar}` : `${d1} ${m1} – ${d2} ${m2} ${ar}`
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
  searchParams: Promise<{ vecka?: string; person?: string; kategori?: string }>
}) {
  const { vecka, person, kategori: kategoriParam } = await searchParams
  const monday = getMonday(parseISODate(vecka ?? todayISODate()))
  const mondayISO = formatISODate(monday)
  const sunday = new Date(monday)
  sunday.setUTCDate(sunday.getUTCDate() + 6)
  const sundayISO = formatISODate(sunday)

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

  let uppgiftQuery = supabase
    .from('uppgift')
    .select('id, titel, deadline, person_id, kund_id, typ_id, kategori_id, tidsatgang_timmar')
    .gte('deadline', mondayISO)
    .lte('deadline', sundayISO)

  if (valdPersonId !== 'alla') {
    uppgiftQuery = uppgiftQuery.eq('person_id', valdPersonId)
  }

  const [{ data: uppgifter }, { data: personer }, { data: kunder }, { data: typer }, { data: kategori }] =
    await Promise.all([
      uppgiftQuery.order('deadline'),
      supabase.from('person').select('id, namn').order('namn'),
      supabase.from('kund').select('id, namn').order('namn'),
      supabase.from('uppgiftstyp').select('id, namn').order('namn'),
      supabase.from('kategori').select('id, namn').order('namn'),
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

  const prevVecka = new Date(monday)
  prevVecka.setUTCDate(prevVecka.getUTCDate() - 7)
  const nextVecka = new Date(monday)
  nextVecka.setUTCDate(nextVecka.getUTCDate() + 7)

  return (
    <>
      <AppNav />
      <main className="mx-auto w-full max-w-3xl flex-1 p-6 md:p-8">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">Rapporter</h1>
        <RapporterNav />
        <TidsrapportVy
          veckoetikett={veckoetikett(monday, sunday)}
          prevVeckaHref={`/rapporter/tidsrapportering?vecka=${formatISODate(prevVecka)}&person=${valdPersonId}&kategori=${valdKategoriId}`}
          nextVeckaHref={`/rapporter/tidsrapportering?vecka=${formatISODate(nextVecka)}&person=${valdPersonId}&kategori=${valdKategoriId}`}
          idagHref={`/rapporter/tidsrapportering?person=${valdPersonId}&kategori=${valdKategoriId}`}
          personer={personer ?? []}
          valdPersonId={valdPersonId}
          initialKategoriId={valdKategoriId}
          kategoriTotaler={sorteradeKategoriTotaler}
          vecka={mondayISO}
          alleRader={alleRader}
        />
      </main>
    </>
  )
}
