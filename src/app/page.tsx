import { createClient } from '@/lib/supabase/server'
import { AppNav } from './nav'
import { IdagFlode } from './idag-flode'
import { DagensUppgiftslista } from './dagens-uppgiftslista'
import { nuIStockholm, plusDagar, aktivtFlode } from '@/lib/dagsflode'

const UPPGIFT_FALT =
  'id, titel, status, prioritet, deadline, klockslag, kund_id, typ_id, outlook_event_id'

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
  ] = await Promise.all([
    supabase.from('uppgift').select(UPPGIFT_FALT).eq('person_id', person.id).eq('deadline', idag).order('sortordning'),
    supabase
      .from('uppgift')
      .select(UPPGIFT_FALT)
      .eq('person_id', person.id)
      .lt('deadline', idag)
      .neq('status', 'klar')
      .order('deadline'),
    supabase
      .from('uppgift')
      .select(UPPGIFT_FALT)
      .eq('person_id', person.id)
      .eq('deadline', imorgon)
      .order('sortordning'),
    supabase.from('dagsfokus').select('uppgift_id').eq('person_id', person.id).eq('datum', idag),
    supabase.from('flexel_installning').select('modul').eq('person_id', person.id).eq('aktiv', true),
    supabase.from('kund').select('id, namn').order('namn'),
    supabase.from('uppgiftstyp').select('id, namn').order('namn'),
  ])

  // dagsavslut: en rad per person och dag, skapas första gången kvällsflödet
  // öppnas och uppdateras (avslutad_at) när Avsluta-knappen trycks — se
  // idag-actions.ts:avslutaDagen. Skapas bara i kvällsfönstret, inte annars.
  let dagsavslut: { id: string; avslutad_at: string | null } | null = null
  let tankar: { id: string; text: string; uppgift_id_skapad: string | null }[] = []
  if (flode === 'kvall') {
    const { data: befintlig } = await supabase
      .from('dagsavslut')
      .select('id, avslutad_at')
      .eq('person_id', person.id)
      .eq('datum', idag)
      .maybeSingle()

    dagsavslut = befintlig
    if (!dagsavslut) {
      const { data: ny } = await supabase
        .from('dagsavslut')
        .insert({ person_id: person.id, foretag_id: person.foretag_id, datum: idag })
        .select('id, avslutad_at')
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
  }

  const fokusUppgiftIds = (dagensFokus ?? []).map((f) => f.uppgift_id)

  return (
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 p-6 md:p-8">
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
          kunder={kunder ?? []}
          typer={typer ?? []}
        />
        <DagensUppgiftslista
          uppgifter={dagensUppgifter ?? []}
          fokusUppgiftIds={fokusUppgiftIds}
          kunder={kunder ?? []}
          typer={typer ?? []}
        />
      </main>
    </>
  )
}
