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
          `id, namn, status, beskrivning, startdatum, kund_id, kund:kund_id(namn), mall_projekt_id, farg, uppgift(${PROJEKT_UPPGIFT_FALT}), projekt_anteckning(block_id, innehall)`
        )
        .order('namn'),
      supabase.from('kund').select('id, namn').order('namn'),
      supabase.from('mall_projekt').select('id, namn, anteckningsmall_id').order('namn'),
      supabase.from('uppgiftstyp').select('id, namn, anteckningsmall_id').order('namn'),
      supabase
        .from('anteckningsblock')
        .select('id, namn, beskrivning, anteckningsmall_id')
        .eq('aktiv', true)
        .order('sortordning'),
    ])

  // Uppgifterna hämtas färdigt här (server-side) istället för att ProjektVy
  // ska hämta dem själv vid öppning — annars syns en fördröjning varje gång
  // ett projekt öppnas.
  const projektRader = (projekt ?? []).map((p) => {
    // Sorteras på deadline (uppgifter utan deadline sist) — annars hamnar lösa
    // uppgifter som kopplats till projektet i efterhand (t.ex. via "Koppla till
    // placeholder" eller genom att sätta projektet på en redan existerande uppgift)
    // fel i listan, eftersom deras sortordning inte är jämförbar med mallens
    // datumbaserade sortordning (se epokForDatum i projekt/actions.ts). sortordning
    // används bara som tiebreak inom samma datum (eller båda utan datum), för att
    // hålla mallens inbördes ordning stabil — annars saknar den inbäddade
    // uppgift(...)-relationen ORDER BY, så Postgres radordning för sådana rader är
    // odefinierad och kan ändras av en vanlig UPDATE (t.ex. en klarmarkering).
    const uppgifter = [...p.uppgift]
      .sort((a, b) => {
        if (a.deadline !== b.deadline) {
          if (a.deadline === null) return 1
          if (b.deadline === null) return -1
          return a.deadline < b.deadline ? -1 : 1
        }
        return a.sortordning - b.sortordning
      })
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
      farg: p.farg,
      antalUppgifter: uppgifter.length,
      antalKlara: uppgifter.filter((u) => u.status === 'klar').length,
      uppgifter,
      projektAnteckningar: p.projekt_anteckning,
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
