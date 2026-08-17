import { createClient } from '@/lib/supabase/server'
import { AppNav } from './nav'
import { IdagFlode } from './idag-flode'
import { nuIStockholm, plusDagar, aktivtFlode } from '@/lib/dagsflode'

const UPPGIFT_FALT = 'id, titel, status, deadline, klockslag, kund_id, outlook_event_id'

// Alla tre uppgiftslistorna på Hem-sidan (dagens, eftersläpning, imorgon) går att
// öppna i redigeringsformuläret direkt från raden, så alla hämtas med hela
// fältuppsättningen uppdateraUppgift (delad med Kanban-vyn) kräver för att kunna
// skriva tillbaka oförändrade värden på allt utom det som faktiskt redigeras här.
const UPPGIFT_DETALJERAD_FALT = `${UPPGIFT_FALT}, beskrivning, person_id, uppgiftsprojekt_id, prioritet, tidsatgang_timmar, typ_id, skapa_uppgifter_vid_klar, uppgift_deltagare(kontaktperson_id), uppgift_anteckning!uppgift_anteckning_uppgift_id_fkey(block_id, innehall, uppgift_id_genererad, genererad:uppgift!uppgift_anteckning_uppgift_id_genererad_fkey(titel, deadline))`

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
    { data: dagensUppgifter },
    { data: eftersläpning },
    { data: imorgonUppgifter },
    { data: dagensFokus },
    { data: flexelInstallningar },
    { data: kunder },
    { data: typer },
    { data: block },
  ] = await Promise.all([
    supabase
      .from('uppgift')
      .select(UPPGIFT_DETALJERAD_FALT)
      .eq('person_id', person.id)
      .eq('deadline', idag)
      .order('sortordning'),
    supabase
      .from('uppgift')
      .select(UPPGIFT_DETALJERAD_FALT)
      .eq('person_id', person.id)
      .lt('deadline', idag)
      .neq('status', 'klar')
      .order('deadline'),
    supabase
      .from('uppgift')
      .select(UPPGIFT_DETALJERAD_FALT)
      .eq('person_id', person.id)
      .eq('deadline', imorgon)
      .order('sortordning'),
    supabase.from('dagsfokus').select('uppgift_id').eq('person_id', person.id).eq('datum', idag),
    supabase.from('flexel_installning').select('modul').eq('person_id', person.id).eq('aktiv', true),
    supabase.from('kund').select('id, namn').order('namn'),
    supabase
      .from('uppgiftstyp')
      .select('id, namn, visar_motesanteckningar, skapa_uppgifter_vid_klar')
      .order('namn'),
    supabase.from('anteckningsblock').select('id, namn, genererar_uppgift').eq('aktiv', true).order('sortordning'),
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

  return (
    <>
      <AppNav />
      <main className="mx-auto w-full max-w-6xl flex-1 p-6 md:p-8">
        <IdagFlode
          flode={flode}
          personNamn={person.namn}
          idag={idag}
          imorgon={imorgon}
          dagensUppgifter={dagensUppgifter ?? []}
          eftersläpning={eftersläpning ?? []}
          imorgonUppgifter={imorgonUppgifter ?? []}
          fokusUppgiftIds={fokusUppgiftIds}
          aktivaFlexelModuler={(flexelInstallningar ?? []).map((f) => f.modul)}
          dagsavslut={dagsavslut}
          tankar={tankar}
          flexelRapporteradIdag={flexelRapporteradIdag}
          kunder={kunder ?? []}
          typer={typer ?? []}
          block={block ?? []}
        />
      </main>
    </>
  )
}
