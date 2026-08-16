import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppNav } from '../nav'
import { UppgiftstypVy } from './uppgiftstyp-vy'
import { UppgiftsprojektVy } from './uppgiftsprojekt-vy'
import { AnteckningsblockVy } from './anteckningsblock-vy'
import { AnvandareVy } from './anvandare-vy'

export default async function SystemadministrationPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: person } = await supabase
    .from('person')
    .select('roll')
    .eq('auth_user_id', user?.id ?? '')
    .single()

  if (person?.roll !== 'admin') {
    redirect('/')
  }

  const [{ data: typer }, { data: projekt }, { data: block }, { data: personer }, { data: flexelInstallningar }] =
    await Promise.all([
      supabase
        .from('uppgiftstyp')
        .select('id, namn, visar_motesanteckningar, skapa_uppgifter_vid_klar')
        .order('namn'),
      supabase.from('uppgiftsprojekt').select('id, namn').order('namn'),
      supabase
        .from('anteckningsblock')
        .select(
          'id, namn, sortordning, aktiv, genererar_uppgift, uppgift_titel_mall, uppgift_typ_id, deadline_dagar_efter_motet, kundvisning_standard'
        )
        .order('sortordning'),
      supabase
        .from('person')
        .select(
          'id, namn, epost, epost_outlook, roll, arbetstimmar_per_vecka, dagsflode_morgon_slut, dagsflode_mitt_slut'
        )
        .order('namn'),
      supabase.from('flexel_installning').select('person_id, modul, aktiv, veckokvot_timmar'),
    ])

  return (
    <>
      <AppNav />
      <main className="mx-auto w-full max-w-xl flex-1 p-6 md:p-8">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Systemadministration</h1>
        <div className="flex flex-col gap-10">
          <AnvandareVy personer={personer ?? []} flexelInstallningar={flexelInstallningar ?? []} />
          <UppgiftstypVy typer={typer ?? []} />
          <UppgiftsprojektVy projekt={projekt ?? []} />
          <AnteckningsblockVy block={block ?? []} typer={typer ?? []} />
        </div>
      </main>
    </>
  )
}
