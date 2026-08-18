import { createClient } from '@/lib/supabase/server'
import { AppNav } from '../nav'
import { enTillRelation } from '@/lib/postgrest'
import { ProjektVy } from './projekt-vy'
import { PROJEKT_UPPGIFT_FALT } from './uppgift-falt'

export default async function ProjektPage() {
  const supabase = await createClient()
  const [{ data: projekt }, { data: kunder }, { data: mallar }, { data: typer }, { data: block }] =
    await Promise.all([
      supabase
        .from('projekt')
        .select(
          `id, namn, status, beskrivning, startdatum, kund_id, kund:kund_id(namn), mall_projekt_id, uppgift(${PROJEKT_UPPGIFT_FALT})`
        )
        .order('namn'),
      supabase.from('kund').select('id, namn').order('namn'),
      supabase.from('mall_projekt').select('id, namn').order('namn'),
      supabase
        .from('uppgiftstyp')
        .select('id, namn, anteckningsmall_id, skapa_uppgifter_vid_klar')
        .order('namn'),
      supabase
        .from('anteckningsblock')
        .select('id, namn, genererar_uppgift, anteckningsmall_id')
        .eq('aktiv', true)
        .order('sortordning'),
    ])

  // Uppgifterna hämtas färdigt här (server-side) istället för att ProjektVy
  // ska hämta dem själv vid öppning — annars syns en fördröjning varje gång
  // ett projekt öppnas.
  const projektRader = (projekt ?? []).map((p) => {
    // Sorteras på sortordning (mallens/checklistans tänkta ordning) istället för
    // deadline. Två skäl: (1) den inbäddade uppgift(...)-relationen saknar ORDER BY,
    // så Postgres radordning för rader med samma/saknad deadline är odefinierad och
    // kunde ändras av en vanlig UPDATE (t.ex. en klarmarkering), vilket syntes som att
    // raden "hoppade" i listan. (2) en placeholder som kopplas till en riktig uppgift
    // (se kopplaTillPlaceholder) ärver placeholderns sortordning men behåller sin egen
    // (ofta senare) verkliga deadline — sortering på deadline skulle då slänga ner den
    // längst ner i listan istället för att låta den ligga kvar på mallens plats.
    const uppgifter = [...p.uppgift]
      .sort((a, b) => a.sortordning - b.sortordning)
      .map((u) => ({ ...u, ansvarigNamn: enTillRelation(u.person)?.namn ?? null }))

    return {
      id: p.id,
      namn: p.namn,
      status: p.status,
      beskrivning: p.beskrivning,
      startdatum: p.startdatum,
      kundId: p.kund_id,
      kundNamn: enTillRelation(p.kund)?.namn ?? null,
      mallProjektId: p.mall_projekt_id,
      antalUppgifter: uppgifter.length,
      antalKlara: uppgifter.filter((u) => u.status === 'klar').length,
      uppgifter,
    }
  })

  return (
    <>
      <AppNav />
      <main className="flex-1 p-6 md:p-8">
        <ProjektVy
          projekt={projektRader}
          kunder={kunder ?? []}
          mallar={mallar ?? []}
          typer={typer ?? []}
          block={block ?? []}
        />
      </main>
    </>
  )
}
