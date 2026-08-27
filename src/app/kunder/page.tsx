import { createClient } from '@/lib/supabase/server'
import { AppNav } from '../nav'
import { KundVy } from './kund-vy'
import { hamtaManuellaAnteckningarForKunder } from './manuell-anteckning-actions'
import { hamtaTidigareDialogerForKunder } from '../uppgifter/actions'
import { enTillRelation } from '@/lib/postgrest'

export default async function KunderPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [
    { data: aktuellPerson },
    { data: kunder },
    { data: kontaktpersoner },
    { data: placeholders },
    { data: personer },
    { data: typer },
    { data: kategori },
    { data: projekt },
    { data: serier },
    { data: block },
  ] = await Promise.all([
    supabase.from('person').select('id').eq('auth_user_id', user?.id ?? '').single(),
    supabase.from('kund').select('id, namn, domains, zammad_organization_id').order('namn'),
    supabase
      .from('kontaktperson')
      .select('id, kund_id, fornamn, efternamn, epost, senast_kontaktad, uppgift_deltagare(uppgift(deadline, status))')
      .order('fornamn'),
    // Underlag för "Koppla till placeholder" i det nästlade uppgiftsformuläret —
    // samma litet-antal-rader-resonemang som i uppgifter/page.tsx.
    supabase.from('uppgift').select('id, titel, deadline, projekt_id, typ_id').eq('ar_placeholder', true),
    supabase.from('person').select('id, namn').order('namn'),
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
        'id, titel, beskrivning, person_id, kund_id, typ_id, kategori_id, prioritet, start_datum, veckodagar, intervall_veckor, slut_datum, tidsatgang_timmar, klockslag, outlook_series_id, synk_fran_datum'
      )
      .order('titel'),
    supabase
      .from('anteckningsblock')
      .select('id, namn, beskrivning, anteckningsmall_id')
      .eq('aktiv', true)
      .order('sortordning'),
  ])

  const kundIds = (kunder ?? []).map((k) => k.id)
  const [manuellaAnteckningar, tidigareDialoger] = await Promise.all([
    hamtaManuellaAnteckningarForKunder(kundIds),
    hamtaTidigareDialogerForKunder(kundIds),
  ])

  return (
    <>
      <AppNav />
      <main className="mx-auto w-full max-w-2xl flex-1 p-6 md:p-8">
        <KundVy
          kunder={kunder ?? []}
          kontaktpersoner={kontaktpersoner ?? []}
          manuellaAnteckningar={manuellaAnteckningar}
          placeholders={placeholders ?? []}
          personer={personer ?? []}
          typer={typer ?? []}
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
          block={block ?? []}
          tidigareDialoger={tidigareDialoger}
          currentPersonId={aktuellPerson?.id ?? null}
        />
      </main>
    </>
  )
}
