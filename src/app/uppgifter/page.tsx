import { createClient } from '@/lib/supabase/server'
import { AppNav } from '../nav'
import { KanbanBoard } from './kanban-board'

// All datumräkning görs i UTC för att undvika att lokal tidszon (t.ex. svensk sommartid)
// får datum att hoppa fram/tillbaka en dag vid konvertering mellan Date och ISO-sträng.

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

export default async function UppgifterPage({
  searchParams,
}: {
  searchParams: Promise<{ vecka?: string }>
}) {
  const { vecka } = await searchParams
  const monday = getMonday(parseISODate(vecka ?? todayISODate()))

  const weekDates = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday)
    d.setUTCDate(d.getUTCDate() + i)
    return formatISODate(d)
  })

  // Hämtar hela kalenderveckan (mån-sön), inte bara mån-fre — annars försvinner uppgifter
  // som (t.ex. via ett återkommande "varannan dag"-intervall) hamnar på en helgdag,
  // eftersom kolumnernas datumfilter annars aldrig matchar dem. De visas i "Oplanerad".
  const sunday = new Date(monday)
  sunday.setUTCDate(sunday.getUTCDate() + 6)
  const sundayISO = formatISODate(sunday)

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: aktuellPerson } = await supabase
    .from('person')
    .select('id, foretag_id')
    .eq('auth_user_id', user?.id ?? '')
    .single()

  // Håller återkommande serier "fyllda" upp till deras horisont — körs vid varje sidladdning
  // istället för via ett schemalagt jobb, så nya förekomster dyker upp allteftersom tiden går.
  if (aktuellPerson?.foretag_id) {
    await supabase.rpc('generera_serie_forekomster', { p_foretag_id: aktuellPerson.foretag_id })
  }

  const [
    { data: uppgifter },
    { data: personer },
    { data: kunder },
    { data: typer },
    { data: projekt },
    { data: serier },
    { data: kontaktpersoner },
  ] = await Promise.all([
    supabase
      .from('uppgift')
      .select(
        'id, titel, beskrivning, status, prioritet, deadline, person_id, kund_id, typ_id, uppgiftsprojekt_id, serie_id, sortordning, tidsatgang_timmar, klockslag, uppgift_deltagare(kontaktperson_id)'
      )
      .or(`deadline.is.null,and(deadline.gte.${weekDates[0]},deadline.lte.${sundayISO})`)
      .order('sortordning'),
    supabase.from('person').select('id, namn').order('namn'),
    supabase.from('kund').select('id, namn').order('namn'),
    supabase.from('uppgiftstyp').select('id, namn').order('namn'),
    supabase.from('uppgiftsprojekt').select('id, namn').order('namn'),
    supabase
      .from('uppgift_serie')
      .select(
        'id, titel, beskrivning, person_id, kund_id, typ_id, uppgiftsprojekt_id, prioritet, veckodagar, intervall_veckor, slut_datum, tidsatgang_timmar, klockslag'
      )
      .order('titel'),
    supabase.from('kontaktperson').select('id, kund_id, fornamn, efternamn, epost').order('fornamn'),
  ])

  const prevVecka = new Date(monday)
  prevVecka.setUTCDate(prevVecka.getUTCDate() - 7)
  const nextVecka = new Date(monday)
  nextVecka.setUTCDate(nextVecka.getUTCDate() + 7)

  return (
    <>
      <AppNav />
      <main className="flex-1 p-6 md:p-8">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">Uppgifter</h1>
        <KanbanBoard
          weekDates={weekDates}
          today={todayISODate()}
          uppgifter={uppgifter ?? []}
          personer={personer ?? []}
          kunder={kunder ?? []}
          typer={typer ?? []}
          projekt={projekt ?? []}
          serier={serier ?? []}
          kontaktpersoner={kontaktpersoner ?? []}
          currentPersonId={aktuellPerson?.id ?? null}
          foretagId={aktuellPerson?.foretag_id ?? null}
          prevVeckaHref={`/uppgifter?vecka=${formatISODate(prevVecka)}`}
          nextVeckaHref={`/uppgifter?vecka=${formatISODate(nextVecka)}`}
          idagHref="/uppgifter"
        />
      </main>
    </>
  )
}
