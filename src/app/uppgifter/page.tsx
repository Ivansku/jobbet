import { createClient } from '@/lib/supabase/server'
import { AppNav } from '../nav'
import { KanbanBoard } from './kanban-board'
import { hamtaSvenskaDagar, slaIhopDagar, arHalvdag } from '@/lib/svenska-dagar'
import { enTillRelation } from '@/lib/postgrest'

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

  // Halvdag för fredagen behöver lördagens röd dag-status, vilket vid ett fåtal
  // årsskiften (fredag 31 dec) ligger i nästa år — täcker in båda årtalen som
  // förekommer i det synliga spannet plus dagen direkt efter.
  const dagenEfter = new Date(sunday)
  dagenEfter.setUTCDate(dagenEfter.getUTCDate() + 1)
  const berordaAr = [...new Set([monday.getUTCFullYear(), dagenEfter.getUTCFullYear()])]
  const svenskaDagar = slaIhopDagar(...(await Promise.all(berordaAr.map(hamtaSvenskaDagar))))
  const dagInfo = Object.fromEntries(
    weekDates.map((datum) => [
      datum,
      {
        rodDag: svenskaDagar.get(datum)?.rodDag ?? false,
        helgdag: svenskaDagar.get(datum)?.helgdag ?? null,
        halvdag: arHalvdag(svenskaDagar, datum),
      },
    ])
  )

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: aktuellPerson } = await supabase
    .from('person')
    .select('id, foretag_id, arbetstimmar_per_vecka')
    .eq('auth_user_id', user?.id ?? '')
    .single()

  // Håller återkommande serier "fyllda" upp till deras horisont — körs vid varje sidladdning
  // istället för via ett schemalagt jobb, så nya förekomster dyker upp allteftersom tiden går.
  // Körs parallellt med resten av datahämtningen istället för att blockera den (den är
  // idempotent — gör praktiskt taget alltid ingenting), så vecko-navigering inte betalar
  // en extra fullständig tur-och-retur för ett anrop som nästan aldrig har något att göra.
  // Enda avvägningen: exakt när en ny säsongshorisont ska rullas över kan en helt nyskapad
  // förekomst dröja till nästa navigering innan den syns — självrättande, sker högst två
  // gånger om året.
  const [
    ,
    { data: uppgifter },
    { data: placeholders },
    { data: personer },
    { data: kunder },
    { data: typer },
    { data: kategori },
    { data: projekt },
    { data: serier },
    { data: kontaktpersoner },
    { data: block },
  ] = await Promise.all([
    aktuellPerson?.foretag_id
      ? supabase.rpc('generera_serie_forekomster', { p_foretag_id: aktuellPerson.foretag_id })
      : Promise.resolve(null),
    supabase
      .from('uppgift')
      .select(
        'id, titel, beskrivning, status, prioritet, deadline, person_id, kund_id, typ_id, kategori_id, projekt_id, serie_id, sortordning, tidsatgang_timmar, klockslag, skapa_uppgifter_vid_klar, ar_placeholder, anteckningsmall_id, uppgift_deltagare(kontaktperson_id), uppgift_anteckning!uppgift_anteckning_uppgift_id_fkey(block_id, innehall, uppgift_id_genererad, genererad:uppgift!uppgift_anteckning_uppgift_id_genererad_fkey(titel, deadline))'
      )
      .eq('ar_placeholder', false)
      .or(`deadline.is.null,and(deadline.gte.${weekDates[0]},deadline.lte.${sundayISO})`)
      .order('sortordning'),
    // Hämtas alltid färdigt här (litet antal rader) istället för att formuläret ska
    // fråga vid öppning — annars syns en fördröjning innan "Koppla till
    // placeholder" hinner avgöra om det finns något att koppla till.
    supabase.from('uppgift').select('id, titel, deadline, projekt_id, typ_id').eq('ar_placeholder', true),
    supabase.from('person').select('id, namn').order('namn'),
    supabase.from('kund').select('id, namn').order('namn'),
    supabase
      .from('uppgiftstyp')
      .select('id, namn, anteckningsmall_id, skapa_uppgifter_vid_klar')
      .order('namn'),
    supabase.from('kategori').select('id, namn').order('namn'),
    supabase
      .from('projekt')
      .select('id, namn, kund_id, farg, mall_projekt:mall_projekt_id(namn, kategori_id)')
      .order('namn'),
    supabase
      .from('uppgift_serie')
      .select(
        'id, titel, beskrivning, person_id, kund_id, typ_id, kategori_id, prioritet, start_datum, veckodagar, intervall_veckor, slut_datum, tidsatgang_timmar, klockslag'
      )
      .order('titel'),
    supabase.from('kontaktperson').select('id, kund_id, fornamn, efternamn, epost').order('fornamn'),
    supabase
      .from('anteckningsblock')
      .select('id, namn, beskrivning, genererar_uppgift, anteckningsmall_id')
      .eq('aktiv', true)
      .order('sortordning'),
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
          dagInfo={dagInfo}
          today={todayISODate()}
          uppgifter={uppgifter ?? []}
          placeholders={placeholders ?? []}
          personer={personer ?? []}
          kunder={kunder ?? []}
          typer={typer ?? []}
          kategori={kategori ?? []}
          projekt={(projekt ?? []).map((p) => ({
            id: p.id,
            namn: p.namn,
            kund_id: p.kund_id,
            farg: p.farg,
            mallProjektNamn: enTillRelation(p.mall_projekt)?.namn ?? null,
            mallProjektKategoriId: enTillRelation(p.mall_projekt)?.kategori_id ?? null,
          }))}
          serier={serier ?? []}
          kontaktpersoner={kontaktpersoner ?? []}
          block={block ?? []}
          currentPersonId={aktuellPerson?.id ?? null}
          foretagId={aktuellPerson?.foretag_id ?? null}
          arbetstimmarPerVecka={aktuellPerson?.arbetstimmar_per_vecka ?? 40}
          prevVeckaHref={`/uppgifter?vecka=${formatISODate(prevVecka)}`}
          nextVeckaHref={`/uppgifter?vecka=${formatISODate(nextVecka)}`}
          idagHref="/uppgifter"
        />
      </main>
    </>
  )
}
