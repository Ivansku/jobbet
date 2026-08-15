import { createClient } from '@/lib/supabase/server'
import { AppNav } from '../../nav'
import { RapporterNav } from '../rapporter-nav'
import { EmptyState } from '@/components/ui/empty-state'
import { FlexelVy } from './flexel-vy'

// All datumräkning görs i UTC, samma mönster som src/app/rapporter/tidsrapportering/page.tsx.

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

// Antal kalenderveckor (måndagar) från och med aktiveringsveckan till och med den angivna veckan.
function veckorMellan(fromMonday: Date, toMonday: Date): number {
  const ms = toMonday.getTime() - fromMonday.getTime()
  return Math.max(0, Math.floor(ms / (7 * 24 * 60 * 60 * 1000)) + 1)
}

const MODUL_LABEL: Record<string, string> = {
  flex: 'Flex',
  overtid: 'Övertid',
  foraldraledig: 'Föräldraledig',
}
const STANDARD_VECKOKVOT = 8

export default async function FlexelPage({
  searchParams,
}: {
  searchParams: Promise<{ vecka?: string; modul?: string }>
}) {
  const { vecka, modul } = await searchParams
  const monday = getMonday(parseISODate(vecka ?? todayISODate()))
  const mondayISO = formatISODate(monday)
  const sunday = new Date(monday)
  sunday.setUTCDate(sunday.getUTCDate() + 6)
  const sundayISO = formatISODate(sunday)
  const valdModul = modul ?? 'alla'

  const idagMonday = getMonday(parseISODate(todayISODate()))

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: person } = await supabase
    .from('person')
    .select('id, foretag_id')
    .eq('auth_user_id', user?.id ?? '')
    .single()

  const prevVecka = new Date(monday)
  prevVecka.setUTCDate(prevVecka.getUTCDate() - 7)
  const nextVecka = new Date(monday)
  nextVecka.setUTCDate(nextVecka.getUTCDate() + 7)
  const hrefFor = (v: string) => `/rapporter/flexel?vecka=${v}&modul=${valdModul}`

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
      .select('id, vecka, justering_timmar, kommentar')
      .eq('person_id', person.id)
      .order('vecka', { ascending: false }),
  ])

  const aktivaModuler = (installningar ?? []).filter((i) => i.aktiv)

  if (aktivaModuler.length === 0) {
    return (
      <>
        <AppNav />
        <main className="mx-auto w-full max-w-3xl flex-1 p-6 md:p-8">
          <h1 className="mb-4 text-2xl font-semibold tracking-tight">Rapporter</h1>
          <RapporterNav />
          <EmptyState
            title="Ingen modul aktiverad"
            description="Be en administratör aktivera Flex, Övertid eller Föräldraledig i Systemadministration för att kunna logga tid här."
          />
        </main>
      </>
    )
  }

  const saldon = aktivaModuler.map((m) => ({
    modul: m.modul,
    label: MODUL_LABEL[m.modul],
    saldo: (poster ?? []).filter((p) => p.modul === m.modul).reduce((sum, p) => sum + p.timmar, 0),
  }))

  const foraldraledigInstallning = aktivaModuler.find((m) => m.modul === 'foraldraledig')
  let foraldraledigInfo = null
  if (foraldraledigInstallning) {
    const veckokvot = foraldraledigInstallning.veckokvot_timmar ?? STANDARD_VECKOKVOT
    const aktiveradMonday = getMonday(new Date(foraldraledigInstallning.created_at))
    const veckor = veckorMellan(aktiveradMonday, idagMonday)
    const justeringSumma = (justeringar ?? []).reduce((sum, j) => sum + j.justering_timmar, 0)
    const uttagetTotalt = (poster ?? [])
      .filter((p) => p.modul === 'foraldraledig')
      .reduce((sum, p) => sum + p.timmar, 0)
    const kvotSaldo = veckor * veckokvot + justeringSumma - uttagetTotalt

    const dennaVeckansJustering = (justeringar ?? [])
      .filter((j) => j.vecka === mondayISO)
      .reduce((sum, j) => sum + j.justering_timmar, 0)
    const dennaVeckansUttag = (poster ?? [])
      .filter((p) => p.modul === 'foraldraledig' && p.datum >= mondayISO && p.datum <= sundayISO)
      .reduce((sum, p) => sum + p.timmar, 0)

    foraldraledigInfo = {
      veckokvot,
      kvotSaldo,
      dennaVeckansKvot: veckokvot + dennaVeckansJustering,
      dennaVeckansUttag,
    }
  }

  const filtreradeRader = (poster ?? []).filter(
    (p) => p.datum >= mondayISO && p.datum <= sundayISO && (valdModul === 'alla' || p.modul === valdModul)
  )

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
          veckoetikett={veckoetikett(monday, sunday)}
          prevVeckaHref={hrefFor(formatISODate(prevVecka))}
          nextVeckaHref={hrefFor(formatISODate(nextVecka))}
          idagHref={`/rapporter/flexel?modul=${valdModul}`}
          vecka={mondayISO}
          valdModul={valdModul}
          poster={filtreradeRader}
          modulLabel={MODUL_LABEL}
          senasteJusteringar={(justeringar ?? []).slice(0, 5)}
        />
      </main>
    </>
  )
}
