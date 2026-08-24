'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { currentForetagId } from '@/lib/foretag'
import {
  hamtaAllaArenden,
  hamtaAnvandare,
  hamtaOrganisation,
  hamtaTidsbokningarForArende,
  zammadTicketUrl,
  type ZammadTicket,
  type ZammadTimeAccounting,
} from '@/lib/zammad'

// Escapar % och _ (ILIKE-wildcards) i en textbit som ska matchas exakt/som suffix.
function ilikeSaker(text: string): string {
  return text.replace(/[%_]/g, (c) => `\\${c}`)
}

// Samma konvertering som Outlook-webhooken gör (route.ts) — UTC-datumet för en
// tidsbokning nära midnatt kan annars hamna på fel svensk kalenderdag.
function stockholmDatum(iso: string): string {
  const dtf = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Stockholm',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const delar = Object.fromEntries(dtf.formatToParts(new Date(iso)).map((p) => [p.type, p.value]))
  return `${delar.year}-${delar.month}-${delar.day}`
}

export type ZammadSynkResultat = {
  error: string | null
  skapade: number
  uppdaterade: number
  ignorerade: number
  ohanterade: { titel: string; ticketId: number; anledning: string; avsandare: string | null }[]
}

// E-postdomäner vars avsändare aldrig ska bli/uppdatera en uppgift, oavsett
// annan matchning — t.ex. automatiserade tjänstekonton som inte är kunder.
// Det egna bolagets domän (foretag.epost_domain, t.ex. interna testärenden)
// läggs alltid till dynamiskt i synkaZammad, se ignoreradeDomaner nedan.
const IGNORERADE_AVSANDARDOMANER = ['qnovalive.se']

function arIgnoreradAvsandare(epost: string | null, extraDomaner: string[]): boolean {
  const domain = epost?.split('@')[1]?.toLowerCase()
  return !!domain && (IGNORERADE_AVSANDARDOMANER.includes(domain) || extraDomaner.includes(domain))
}

type KundMatchResultat = { kundId: string | null; avsandare: string | null; ignorerad?: boolean }

// Kundmatchning i sex steg, i fallande tillförlitlighet. Så fort ett senare
// steg ger en träff cachas zammad_organization_id (och ev. ny domän) på
// kund-raden så nästa synk slår direkt på steg 1 istället. Ingen träff i
// något steg -> ärendet hoppas över (kund är obligatoriskt på uppgiften, vi
// gissar aldrig fel kund) — men avsändaren (namn/e-post eller organisations-
// namn) skickas ändå tillbaka så felmeddelandet kan visa vem som skickade in det.
async function matchaKund(
  supabase: SupabaseClient,
  foretagId: string,
  arende: ZammadTicket,
  ignoreradeDomaner: string[]
): Promise<KundMatchResultat> {
  const organizationId = arende.organization_id
  let organisation: { name: string; domain: string | null } | null = null

  // Cachar zammad_organization_id och lägger till organisationens domän i
  // kundens domänlista om den saknas — skriver aldrig över eller tar bort
  // domäner som redan står där.
  async function cachaOchReturnera(kundId: string): Promise<KundMatchResultat> {
    const patch: Record<string, unknown> = {}
    if (organizationId) patch.zammad_organization_id = organizationId
    const orgDomain = organisation?.domain?.toLowerCase()
    if (orgDomain) {
      const { data: rad } = await supabase.from('kund').select('domains').eq('id', kundId).single()
      if (rad && !rad.domains.includes(orgDomain)) patch.domains = [...rad.domains, orgDomain]
    }
    if (Object.keys(patch).length > 0) {
      await supabase.from('kund').update(patch).eq('id', kundId)
    }
    return { kundId, avsandare: null }
  }

  // 1. Exakt id-cache från en tidigare synk.
  if (organizationId) {
    const { data: viaId } = await supabase
      .from('kund')
      .select('id')
      .eq('foretag_id', foretagId)
      .eq('zammad_organization_id', organizationId)
      .maybeSingle()
    if (viaId) return { kundId: viaId.id, avsandare: null }
  }

  if (organizationId) {
    organisation = await hamtaOrganisation(organizationId)

    // 2. Zammads organisationsnamn matchar kund.namn exakt (case-insensitive).
    const { data: viaNamn } = await supabase
      .from('kund')
      .select('id')
      .eq('foretag_id', foretagId)
      .ilike('namn', ilikeSaker(organisation.name))
      .maybeSingle()
    if (viaNamn) return cachaOchReturnera(viaNamn.id)

    // 3. Organisationens domän finns redan i en kunds domänlista.
    if (organisation.domain) {
      const { data: viaOrgDomain } = await supabase
        .from('kund')
        .select('id')
        .eq('foretag_id', foretagId)
        .contains('domains', [organisation.domain.toLowerCase()])
        .maybeSingle()
      if (viaOrgDomain) return cachaOchReturnera(viaOrgDomain.id)
    }
  }

  const organisationNamn = organisation?.name ?? null

  // 4, 5 & 6 kräver ärendets kund (Zammad-slutanvändaren), inte agenten.
  if (!arende.customer_id) return { kundId: null, avsandare: organisationNamn }

  const kontakt = await hamtaAnvandare(arende.customer_id)
  const kontaktNamn = [kontakt.firstname, kontakt.lastname].filter(Boolean).join(' ')
  const epost = kontakt.email?.toLowerCase().trim() || null
  const avsandare = epost ? (kontaktNamn ? `${kontaktNamn} <${epost}>` : epost) : organisationNamn
  if (arIgnoreradAvsandare(epost, ignoreradeDomaner)) return { kundId: null, avsandare, ignorerad: true }
  if (!epost) return { kundId: null, avsandare }

  // 4. E-posten matchar en befintlig kontaktperson exakt.
  const { data: viaEpost } = await supabase
    .from('kontaktperson')
    .select('kund_id')
    .eq('foretag_id', foretagId)
    .ilike('epost', ilikeSaker(epost))
    .maybeSingle()
  if (viaEpost) return cachaOchReturnera(viaEpost.kund_id)

  const emailDomain = epost.split('@')[1]
  if (emailDomain) {
    // 5. Domänen på e-posten finns i en kunds domänlista.
    const { data: viaKundDomain } = await supabase
      .from('kund')
      .select('id')
      .eq('foretag_id', foretagId)
      .contains('domains', [emailDomain])
      .maybeSingle()
    if (viaKundDomain) return cachaOchReturnera(viaKundDomain.id)

    // 6. Domänen på e-posten matchar en befintlig kontaktpersons domän.
    const { data: viaKontaktDomain } = await supabase
      .from('kontaktperson')
      .select('kund_id')
      .eq('foretag_id', foretagId)
      .ilike('epost', `%@${ilikeSaker(emailDomain)}`)
      .limit(1)
      .maybeSingle()
    if (viaKontaktDomain) return cachaOchReturnera(viaKontaktDomain.kund_id)
  }

  return { kundId: null, avsandare }
}

export async function synkaZammad(): Promise<ZammadSynkResultat> {
  const foretagId = await currentForetagId()
  if (!foretagId) {
    return { error: 'Kunde inte identifiera företag.', skapade: 0, uppdaterade: 0, ignorerade: 0, ohanterade: [] }
  }
  // Manuella knappen skannar alltid allt (inget sedanDagar) — den är
  // "säkerställ att allt är inne"-verktyget, till skillnad från cron-körningen.
  return kornaZammadSynk(await createClient(), foretagId)
}

// Kärnlogiken, oberoende av om den triggas av en inloggad session (knappen,
// RLS-begränsad klient) eller ett cron-jobb (service-klient, ingen session).
// sedanDagar: om satt, skippas det dyra anropet efter tidsbokningar för
// ärenden vars updated_at i Zammad är äldre än så många dagar — tänkt för
// tätare schemalagda körningar. Ett ärende som misslyckas dyker upp igen i
// varje körning så länge det ligger inom fönstret (självläkande utan att vi
// behöver hålla reda på vilka som misslyckats).
export async function kornaZammadSynk(
  supabase: SupabaseClient,
  foretagId: string,
  sedanDagar?: number
): Promise<ZammadSynkResultat> {
  const [{ data: personer }, { data: kategoriCS }, { data: foretag }] = await Promise.all([
    supabase.from('person').select('id, zammad_agent_id').eq('foretag_id', foretagId).not('zammad_agent_id', 'is', null),
    supabase.from('kategori').select('id').eq('foretag_id', foretagId).eq('namn', 'CS').maybeSingle(),
    supabase.from('foretag').select('epost_domain').eq('id', foretagId).single(),
  ])

  // Egna bolagets domän (t.ex. interna testärenden från kollegor) ska aldrig
  // bli en uppgift, precis som den redan utesluts som organisation i
  // "Hämta kunder" — men ärendesynken går via avsändarens e-post, inte org-id,
  // så den behöver samma uteslutning på sin egen väg.
  const ignoreradeDomaner = foretag?.epost_domain ? [foretag.epost_domain.toLowerCase()] : []

  const agentTillPerson = new Map((personer ?? []).map((p) => [p.zammad_agent_id as number, p.id as string]))
  if (agentTillPerson.size === 0) {
    return {
      error: 'Ingen person i företaget har ett kopplat Zammad-agent-id (Systemadministration -> Användare).',
      skapade: 0,
      uppdaterade: 0,
      ignorerade: 0,
      ohanterade: [],
    }
  }
  if (!kategoriCS) {
    return { error: 'Kategorin "CS" saknas för företaget.', skapade: 0, uppdaterade: 0, ignorerade: 0, ohanterade: [] }
  }

  let skapade = 0
  let uppdaterade = 0
  let ignorerade = 0
  const ohanterade: ZammadSynkResultat['ohanterade'] = []
  const synkStart = new Date().toISOString()

  let arenden
  try {
    arenden = await hamtaAllaArenden()
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Kunde inte nå Zammad.',
      skapade: 0,
      uppdaterade: 0,
      ignorerade: 0,
      ohanterade: [],
    }
  }

  const sedanGrans = sedanDagar != null ? Date.now() - sedanDagar * 24 * 60 * 60 * 1000 : null

  for (const arende of arenden) {
    if (!arende.ticket_time_accounting_ids?.length) continue
    // Fönstrad körning (cron): hoppa över det dyra tidsbokningsanropet för
    // ärenden som inte rört sig nyligen — listan i sig är redan billig att
    // hämta i sin helhet, så inget missas, bara det tunga arbetet begränsas.
    if (sedanGrans != null && new Date(arende.updated_at).getTime() < sedanGrans) continue

    let bokningar: ZammadTimeAccounting[]
    try {
      bokningar = await hamtaTidsbokningarForArende(arende.id)
    } catch {
      ohanterade.push({ titel: arende.title, ticketId: arende.id, anledning: 'Kunde inte hämta tidsbokningar', avsandare: null })
      continue
    }

    // Endast tid loggad av en känd Zammad-agent (person.zammad_agent_id) räknas —
    // punkt 1 i specen: bara svar från kopplade agenter ska bli/uppdatera uppgifter.
    const relevanta = bokningar.filter((b) => agentTillPerson.has(b.created_by_id))
    if (relevanta.length === 0) continue

    // Ett ärende kan nu motsvara flera uppgifter — en per svensk kalenderdag med
    // svar (kanban-vyn ska visa rätt belastning per dag, inte klumpa ihop allt på
    // senaste svarsdatumet). Dubblettskyddet för bokningar slår därför upp redan
    // importerade id:n över SAMTLIGA dag-uppgifter för ärendet, inte bara en.
    const { data: befintligaUppgifter } = await supabase
      .from('uppgift')
      .select('id, deadline, kund_id, tidsatgang_timmar')
      .eq('foretag_id', foretagId)
      .eq('zammad_ticket_id', arende.id)

    const uppgiftIds = (befintligaUppgifter ?? []).map((u) => u.id)
    const { data: redanImporterade } = uppgiftIds.length
      ? await supabase.from('uppgift_zammad_tidspost').select('zammad_time_accounting_id').in('uppgift_id', uppgiftIds)
      : { data: [] as { zammad_time_accounting_id: number }[] }

    const importeradeIds = new Set((redanImporterade ?? []).map((r) => r.zammad_time_accounting_id))
    const nyaTotalt = relevanta.filter((b) => !importeradeIds.has(b.id))
    if (nyaTotalt.length === 0) continue

    // Kund är knuten till ärendet, inte till en enskild dag — återanvänd den redan
    // kända kunden om ärendet har minst en uppgift sen tidigare, annars matcha en gång.
    let kundId = befintligaUppgifter?.[0]?.kund_id ?? null
    if (!kundId) {
      const matchResultat = await matchaKund(supabase, foretagId, arende, ignoreradeDomaner)
      if (!matchResultat.kundId) {
        if (matchResultat.ignorerad) {
          ignorerade++
        } else {
          ohanterade.push({
            titel: arende.title,
            ticketId: arende.id,
            anledning: 'Ingen matchande kund hittades',
            avsandare: matchResultat.avsandare,
          })
        }
        continue
      }
      kundId = matchResultat.kundId
    }

    const perDag = new Map<string, ZammadTimeAccounting[]>()
    for (const b of nyaTotalt) {
      const dag = stockholmDatum(b.created_at)
      const grupp = perDag.get(dag)
      if (grupp) grupp.push(b)
      else perDag.set(dag, [b])
    }

    for (const [dag, bokningarDenDagen] of perDag) {
      const nyTid = bokningarDenDagen.reduce((sum, b) => sum + parseFloat(b.time_unit), 0)
      const senastePerson = agentTillPerson.get(bokningarDenDagen[bokningarDenDagen.length - 1].created_by_id)!
      const befintligDenDagen = (befintligaUppgifter ?? []).find((u) => u.deadline === dag)

      let uppgiftId: string
      if (befintligDenDagen) {
        await supabase
          .from('uppgift')
          .update({
            titel: arende.title,
            status: 'klar',
            tidsatgang_timmar: (befintligDenDagen.tidsatgang_timmar ?? 0) + nyTid,
          })
          .eq('id', befintligDenDagen.id)
        uppgiftId = befintligDenDagen.id
        uppdaterade++
      } else {
        const { data: nyUppgift, error } = await supabase
          .from('uppgift')
          .insert({
            foretag_id: foretagId,
            titel: arende.title,
            beskrivning: zammadTicketUrl(arende.id),
            status: 'klar',
            prioritet: 'lag',
            kategori_id: kategoriCS.id,
            kund_id: kundId,
            person_id: senastePerson,
            zammad_ticket_id: arende.id,
            tidsatgang_timmar: nyTid,
            deadline: dag,
          })
          .select('id')
          .single()

        if (error || !nyUppgift) {
          ohanterade.push({
            titel: arende.title,
            ticketId: arende.id,
            anledning: `Kunde inte skapa uppgiften för ${dag}`,
            avsandare: null,
          })
          continue
        }
        uppgiftId = nyUppgift.id
        skapade++
      }

      await supabase.from('uppgift_zammad_tidspost').insert(
        bokningarDenDagen.map((b) => ({
          foretag_id: foretagId,
          uppgift_id: uppgiftId,
          zammad_time_accounting_id: b.id,
          zammad_article_id: b.ticket_article_id,
          tid_timmar: parseFloat(b.time_unit),
        }))
      )
    }
  }

  // foretag har ingen UPDATE-policy för inloggade sessioner (bara SELECT) — en
  // ny sådan vore en RLS-ändring som kräver godkännande enligt CLAUDE.md. Denna
  // enda skrivning (en synk-markör, ingen känslig eller foretag_id-styrd data)
  // görs därför med service-klienten istället, precis som Outlook-webhooken gör.
  await createServiceClient().from('foretag').update({ zammad_senast_synkad_at: synkStart }).eq('id', foretagId)

  revalidatePath('/systemadministration')
  revalidatePath('/uppgifter')
  return { error: null, skapade, uppdaterade, ignorerade, ohanterade }
}
