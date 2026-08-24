'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { currentForetagId } from '@/lib/foretag'
import { hamtaAllaOrganisationer, hamtaAnvandare, type ZammadOrganization } from '@/lib/zammad'

export type ZammadKundImportResultat = {
  error: string | null
  kunderSkapade: number
  kunderMatchade: number
  kontaktpersonerSkapade: number
  organisationerHoppade: { namn: string; anledning: string }[]
}

// Matchar/skapar en kund för en Zammad-organisation. Egna bolagets organisation
// (samma domän som foretag.epost_domain, t.ex. "QNova Systems AB") är inte en
// kund och hoppas alltid över — samma avgränsning som Outlook-synken redan gör
// för interna deltagare.
// Lägger till organisationens domän i kundens domänlista om den saknas —
// skriver aldrig över eller tar bort domäner som redan står där (t.ex.
// manuellt tillagda extra domäner för samma bolag).
async function laggTillDomanOmNy(
  supabase: Awaited<ReturnType<typeof createClient>>,
  kund: { id: string; domains: string[] },
  domain: string | null
) {
  if (!domain) return
  const d = domain.toLowerCase()
  if (kund.domains.includes(d)) return
  await supabase.from('kund').update({ domains: [...kund.domains, d] }).eq('id', kund.id)
}

async function matchaEllerSkapaKund(
  supabase: Awaited<ReturnType<typeof createClient>>,
  foretagId: string,
  organisation: ZammadOrganization
): Promise<{ kundId: string; skapad: boolean } | null> {
  const { data: viaId } = await supabase
    .from('kund')
    .select('id, domains')
    .eq('foretag_id', foretagId)
    .eq('zammad_organization_id', organisation.id)
    .maybeSingle()
  if (viaId) {
    await laggTillDomanOmNy(supabase, viaId, organisation.domain)
    return { kundId: viaId.id, skapad: false }
  }

  const { data: viaNamn } = await supabase
    .from('kund')
    .select('id, domains')
    .eq('foretag_id', foretagId)
    .ilike('namn', organisation.name)
    .maybeSingle()
  if (viaNamn) {
    await supabase.from('kund').update({ zammad_organization_id: organisation.id }).eq('id', viaNamn.id)
    await laggTillDomanOmNy(supabase, viaNamn, organisation.domain)
    return { kundId: viaNamn.id, skapad: false }
  }

  const { data: ny, error } = await supabase
    .from('kund')
    .insert({
      foretag_id: foretagId,
      namn: organisation.name,
      zammad_organization_id: organisation.id,
      domains: organisation.domain ? [organisation.domain.toLowerCase()] : [],
    })
    .select('id')
    .single()
  if (error || !ny) return null
  return { kundId: ny.id, skapad: true }
}

async function synkaKontaktpersoner(
  supabase: Awaited<ReturnType<typeof createClient>>,
  foretagId: string,
  kundId: string,
  medlemIds: number[]
): Promise<number> {
  let skapade = 0

  const anvandare = await Promise.all(medlemIds.map((id) => hamtaAnvandare(id).catch(() => null)))

  for (const a of anvandare) {
    if (!a) continue
    const epost = a.email?.trim()
    if (!epost) continue

    const { data: befintlig } = await supabase
      .from('kontaktperson')
      .select('id')
      .eq('foretag_id', foretagId)
      .eq('kund_id', kundId)
      .ilike('epost', epost)
      .maybeSingle()
    if (befintlig) continue

    const { error } = await supabase.from('kontaktperson').insert({
      foretag_id: foretagId,
      kund_id: kundId,
      fornamn: a.firstname?.trim() || null,
      efternamn: a.lastname?.trim() || null,
      epost,
    })
    if (!error) skapade++
  }

  return skapade
}

export async function importeraZammadKunder(): Promise<ZammadKundImportResultat> {
  const foretagId = await currentForetagId()
  if (!foretagId) {
    return { error: 'Kunde inte identifiera företag.', kunderSkapade: 0, kunderMatchade: 0, kontaktpersonerSkapade: 0, organisationerHoppade: [] }
  }

  const supabase = await createClient()
  const { data: foretag } = await supabase.from('foretag').select('epost_domain').eq('id', foretagId).single()
  const egenDomain = foretag?.epost_domain?.toLowerCase() ?? null

  let organisationer: ZammadOrganization[]
  try {
    organisationer = await hamtaAllaOrganisationer()
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Kunde inte nå Zammad.',
      kunderSkapade: 0,
      kunderMatchade: 0,
      kontaktpersonerSkapade: 0,
      organisationerHoppade: [],
    }
  }

  let kunderSkapade = 0
  let kunderMatchade = 0
  let kontaktpersonerSkapade = 0
  const organisationerHoppade: ZammadKundImportResultat['organisationerHoppade'] = []

  for (const organisation of organisationer) {
    if (egenDomain && organisation.domain?.toLowerCase() === egenDomain) continue

    const resultat = await matchaEllerSkapaKund(supabase, foretagId, organisation)
    if (!resultat) {
      organisationerHoppade.push({ namn: organisation.name, anledning: 'Kunde inte skapa/matcha kund' })
      continue
    }
    if (resultat.skapad) kunderSkapade++
    else kunderMatchade++

    kontaktpersonerSkapade += await synkaKontaktpersoner(supabase, foretagId, resultat.kundId, organisation.member_ids)
  }

  revalidatePath('/systemadministration')
  revalidatePath('/kunder')
  return { error: null, kunderSkapade, kunderMatchade, kontaktpersonerSkapade, organisationerHoppade }
}
