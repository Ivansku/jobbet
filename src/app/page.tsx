import { createClient } from '@/lib/supabase/server'
import { AppNav } from './nav'
import { IdagFlode } from './idag-flode'
import { nuIStockholm, plusDagar, aktivtFlode } from '@/lib/dagsflode'
import { hamtaSvenskaDagar } from '@/lib/svenska-dagar'
import { enTillRelation } from '@/lib/postgrest'
import { hamtaTidigareDialogerForKunder } from './uppgifter/actions'

const UPPGIFT_FALT = 'id, titel, status, deadline, klockslag, kund_id, outlook_event_id'

// Alla tre uppgiftslistorna på Hem-sidan (dagens, eftersläpning, imorgon) går att
// öppna i det delade uppgiftsformuläret (samma komponent som Uppgifter/Projekt/
// Tidsrapportering) direkt från raden, så alla hämtas med hela fältuppsättningen
// formuläret kräver. projekt-relationen hämtas bara för att härleda projektets
// anteckningsmall/anteckningar (se mapUppgiftDetaljerad nedan) — plockas isär
// innan datan skickas till klienten, samma mönster som uppgifter/page.tsx
// använder för sin projekt-lista.
const UPPGIFT_DETALJERAD_FALT = `${UPPGIFT_FALT}, beskrivning, person_id, kategori_id, projekt_id, serie_id, sortordning, prioritet, tidsatgang_timmar, typ_id, ar_placeholder, anteckningsmall_id, utan_anteckningsmall, uppgift_deltagare(kontaktperson_id), uppgift_anteckning!uppgift_anteckning_uppgift_id_fkey(block_id, innehall, uppgift_id_genererad, genererad:uppgift!uppgift_anteckning_uppgift_id_genererad_fkey(titel, deadline)), projekt:projekt_id(mall_projekt:mall_projekt_id(anteckningsmall_id), projekt_anteckning(block_id, innehall))`

function mapUppgiftDetaljerad<T extends { projekt: unknown }>(u: T) {
  const { projekt, ...rest } = u
  const projektRad = enTillRelation(projekt) as {
    mall_projekt: unknown
    projekt_anteckning: { block_id: string; innehall: string }[]
  } | null
  const mallProjekt = enTillRelation(projektRad?.mall_projekt) as { anteckningsmall_id: string | null } | null
  return {
    ...rest,
    projektAnteckningsmallId: mallProjekt?.anteckningsmall_id ?? null,
    projektAnteckningar: projektRad?.projekt_anteckning ?? [],
  }
}

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: person } = await supabase
    .from('person')
    .select('id, foretag_id, namn, dagsflode_morgon_slut, dagsflode_mitt_slut')
    .eq('auth_user_id', user?.id ?? '')
    .single()

  if (!person) {
    return (
      <>
        <AppNav />
        <main className="flex flex-1 flex-col items-center justify-center gap-1 p-6">
          <h1 className="text-2xl font-semibold tracking-tight">jobbet</h1>
          <p className="text-sm text-stone-500">Inloggad som {user?.email}</p>
        </main>
      </>
    )
  }

  const { datum: idag, klockslag: nu } = nuIStockholm()
  const imorgon = plusDagar(idag, 1)
  const flode = aktivtFlode(nu, person.dagsflode_morgon_slut, person.dagsflode_mitt_slut)

  const [
    svenskaDagar,
    { data: dagensUppgifter },
    { data: eftersläpning },
    { data: imorgonUppgifter },
    { data: dagensFokus },
    { data: flexelInstallningar },
    { data: kunder },
    { data: typer },
    { data: block },
    { data: kategori },
    { data: projekt },
    { data: serier },
    { data: kontaktpersoner },
    { data: placeholders },
    { data: personer },
  ] = await Promise.all([
    hamtaSvenskaDagar(Number(idag.slice(0, 4))),
    supabase
      .from('uppgift')
      .select(UPPGIFT_DETALJERAD_FALT)
      .eq('person_id', person.id)
      .eq('deadline', idag)
      .eq('ar_placeholder', false)
      .order('sortordning')
      .order('id'),
    supabase
      .from('uppgift')
      .select(UPPGIFT_DETALJERAD_FALT)
      .eq('person_id', person.id)
      .lt('deadline', idag)
      .neq('status', 'klar')
      .eq('ar_placeholder', false)
      .order('deadline'),
    supabase
      .from('uppgift')
      .select(UPPGIFT_DETALJERAD_FALT)
      .eq('person_id', person.id)
      .eq('deadline', imorgon)
      .eq('ar_placeholder', false)
      .order('sortordning')
      .order('id'),
    supabase.from('dagsfokus').select('uppgift_id').eq('person_id', person.id).eq('datum', idag),
    supabase.from('flexel_installning').select('modul').eq('person_id', person.id).eq('aktiv', true),
    supabase.from('kund').select('id, namn').order('namn'),
    supabase.from('uppgiftstyp').select('id, namn, anteckningsmall_id').order('namn'),
    supabase
      .from('anteckningsblock')
      .select('id, namn, beskrivning, anteckningsmall_id')
      .eq('aktiv', true)
      .order('sortordning'),
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
    // Hämtas alltid färdigt här (litet antal rader) istället för att formuläret ska
    // fråga vid öppning — samma resonemang som uppgifter/page.tsx.
    supabase.from('uppgift').select('id, titel, deadline, projekt_id, typ_id').eq('ar_placeholder', true),
    supabase.from('person').select('id, namn').order('namn'),
  ])

  // dagsavslut: en rad per person och dag, skapas första gången kvällsflödet
  // öppnas. Finns bara kvar som ankare för dagsavslut_tanke (Vad skaver?) —
  // Avsluta-knappen som skulle uppdatera avslutad_at är borttagen tills vidare.
  let dagsavslut: { id: string } | null = null
  let tankar: { id: string; text: string; uppgift_id_skapad: string | null }[] = []
  let flexelRapporteradIdag = false
  if (flode === 'kvall') {
    const { data: befintlig } = await supabase
      .from('dagsavslut')
      .select('id')
      .eq('person_id', person.id)
      .eq('datum', idag)
      .maybeSingle()

    dagsavslut = befintlig
    if (!dagsavslut) {
      const { data: ny } = await supabase
        .from('dagsavslut')
        .insert({ person_id: person.id, foretag_id: person.foretag_id, datum: idag })
        .select('id')
        .single()
      dagsavslut = ny
    }

    if (dagsavslut) {
      const { data } = await supabase
        .from('dagsavslut_tanke')
        .select('id, text, uppgift_id_skapad')
        .eq('dagsavslut_id', dagsavslut.id)
        .order('created_at')
      tankar = data ?? []
    }

    const { data: flexelPost } = await supabase
      .from('flexel_post')
      .select('id')
      .eq('person_id', person.id)
      .eq('datum', idag)
      .limit(1)
    flexelRapporteradIdag = (flexelPost?.length ?? 0) > 0
  }

  const fokusUppgiftIds = (dagensFokus ?? []).map((f) => f.uppgift_id)
  const tidigareDialoger = await hamtaTidigareDialogerForKunder((kunder ?? []).map((k) => k.id))

  return (
    <>
      <AppNav />
      <main className="mx-auto w-full max-w-6xl flex-1 p-6 md:p-8">
        <IdagFlode
          flode={flode}
          personNamn={person.namn}
          idag={idag}
          imorgon={imorgon}
          namnsdagIdag={svenskaDagar.get(idag)?.namnsdag ?? []}
          dagensUppgifter={(dagensUppgifter ?? []).map(mapUppgiftDetaljerad)}
          eftersläpning={(eftersläpning ?? []).map(mapUppgiftDetaljerad)}
          imorgonUppgifter={(imorgonUppgifter ?? []).map(mapUppgiftDetaljerad)}
          fokusUppgiftIds={fokusUppgiftIds}
          aktivaFlexelModuler={(flexelInstallningar ?? []).map((f) => f.modul)}
          dagsavslut={dagsavslut}
          tankar={tankar}
          flexelRapporteradIdag={flexelRapporteradIdag}
          kunder={kunder ?? []}
          typer={typer ?? []}
          block={block ?? []}
          kategori={kategori ?? []}
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
          personer={personer ?? []}
          tidigareDialoger={tidigareDialoger}
          currentPersonId={person.id}
        />
      </main>
    </>
  )
}
