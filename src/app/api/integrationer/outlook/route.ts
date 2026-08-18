import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { beraknaSortordning } from '@/lib/sortordning'

// Möten skrivs enligt konventionen "Kund, QNOVA - Titel" — men "QNOVA, Kund - Titel"
// förekommer också (ordningen varierar tydligen i praktiken). Provar båda, i den
// ordningen, mot första förekomsten av " - ". Matchar inget alls blir hela ämnet
// Titel oförändrat, ingen Kund taggas.
const KUND_FORST = /^(.+?),\s*QNOVA\s*-\s*(.+)$/i
const QNOVA_FORST = /^QNOVA\s*,\s*(.+?)\s*-\s*(.+)$/i

function sakerJamforelse(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

// All tidszonskonvertering görs här (server-sidan) istället för i PowerAutomate,
// så vi äger DST-hanteringen på ett ställe — samma försiktighet som resten av
// appens datumlogik. start/end kommer rakt från Outlook-triggerns ISO-strängar.
function stockholmDatumOchKlockslag(iso: string) {
  const dtf = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Stockholm',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const delar = Object.fromEntries(dtf.formatToParts(new Date(iso)).map((p) => [p.type, p.value]))
  return { datum: `${delar.year}-${delar.month}-${delar.day}`, klockslag: `${delar.hour}:${delar.minute}` }
}

function parsaAmne(subject: string): { kundNamn: string | null; titel: string } {
  const trimmad = subject.trim()

  const kundForst = trimmad.match(KUND_FORST)
  if (kundForst) return { kundNamn: kundForst[1].trim(), titel: kundForst[2].trim() }

  const qnovaForst = trimmad.match(QNOVA_FORST)
  if (qnovaForst) return { kundNamn: qnovaForst[1].trim(), titel: qnovaForst[2].trim() }

  return { kundNamn: null, titel: trimmad }
}

const RADERINGS_VARDEN = new Set(['deleted', 'delete', 'cancelled', 'canceled', 'removed'])
function arRadering(actionType?: string): boolean {
  return !!actionType && RADERINGS_VARDEN.has(actionType.trim().toLowerCase())
}

// Outlooks deltagarfält kommer som en semikolon-separerad lista.
function parsaDeltagarlista(rad?: string): string[] {
  if (!rad) return []
  return [
    ...new Set(
      rad
        .split(';')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
    ),
  ]
}

// Bästa gissning på för- och efternamn utifrån mailadressens lokaldel
// (t.ex. "anna.svensson@kund.se" → "Anna" "Svensson") — bara en startpunkt,
// går alltid att rätta i Kund-vyn eller Personer-vyn efteråt.
function gissaNamnFranEpost(epost: string): { fornamn: string | null; efternamn: string | null } {
  const lokalDel = epost.split('@')[0] ?? ''
  const delar = lokalDel.split(/[._-]+/).filter(Boolean)
  const kapitalisera = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
  if (delar.length === 0) return { fornamn: null, efternamn: null }
  if (delar.length === 1) return { fornamn: kapitalisera(delar[0]), efternamn: null }
  return { fornamn: kapitalisera(delar[0]), efternamn: kapitalisera(delar.slice(1).join(' ')) }
}

// Matchar/skapar kontaktpersoner för mötets deltagare och synkar
// uppgift_deltagare (radera + återskapa hela listan, samma mönster som
// server actions-varianten i uppgifter/actions.ts). Interna QNOVA-mail
// (samma domän som epost_domain) filtreras alltid bort — kollegor är inte
// kundkontakter. Kräver en kund att koppla kontakterna till.
async function synkaDeltagareFranOutlook(
  supabase: ReturnType<typeof createServiceClient>,
  uppgiftId: string,
  foretagId: string,
  kundId: string | null,
  epostDomain: string | null,
  requiredAttendees?: string,
  optionalAttendees?: string
) {
  if (!kundId) return

  const listor: { epost: string; typ: 'obligatorisk' | 'valfri' }[] = [
    ...parsaDeltagarlista(requiredAttendees).map((epost) => ({ epost, typ: 'obligatorisk' as const })),
    ...parsaDeltagarlista(optionalAttendees).map((epost) => ({ epost, typ: 'valfri' as const })),
  ].filter(({ epost }) => {
    if (!epostDomain) return true
    return epost.split('@')[1]?.toLowerCase() !== epostDomain.toLowerCase()
  })

  const kopplingar: { kontaktperson_id: string; typ: 'obligatorisk' | 'valfri' }[] = []

  for (const { epost, typ } of listor) {
    const { data: befintlig } = await supabase
      .from('kontaktperson')
      .select('id')
      .eq('kund_id', kundId)
      .ilike('epost', epost)
      .maybeSingle()

    if (befintlig) {
      kopplingar.push({ kontaktperson_id: befintlig.id, typ })
      continue
    }

    const { fornamn, efternamn } = gissaNamnFranEpost(epost)
    const { data: ny } = await supabase
      .from('kontaktperson')
      .insert({ foretag_id: foretagId, kund_id: kundId, fornamn, efternamn, epost })
      .select('id')
      .single()

    if (ny) kopplingar.push({ kontaktperson_id: ny.id, typ })
  }

  await supabase.from('uppgift_deltagare').delete().eq('uppgift_id', uppgiftId)
  if (kopplingar.length > 0) {
    await supabase.from('uppgift_deltagare').insert(
      kopplingar.map((k) => ({
        uppgift_id: uppgiftId,
        kontaktperson_id: k.kontaktperson_id,
        foretag_id: foretagId,
        typ: k.typ,
      }))
    )
  }
}

// bodyPreview kan komma antingen som ren text eller som Outlook-mötets fulla
// HTML-body (taggar, Teams-möteslänkar, signaturer) — Markdown-redigeraren
// tolkar aldrig inbäddad HTML (medveten säkerhetsspärr), så okonverterad HTML
// skulle bara synas som bokstavlig text. Gör om till läsbar text oavsett källa;
// ett no-op om texten redan var ren. Kapas till en rimlig längd.
function htmlTillText(input: string): string {
  const text = input
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return text.slice(0, 2000)
}

export async function POST(request: NextRequest) {
  const hemlighet = process.env.OUTLOOK_WEBHOOK_SECRET
  const angiven = request.headers.get('x-webhook-secret')
  if (!hemlighet || !angiven || !sakerJamforelse(angiven, hemlighet)) {
    return NextResponse.json({ error: 'Ogiltig eller saknad nyckel' }, { status: 401 })
  }

  let body: {
    eventId?: string
    subject?: string
    start?: string
    end?: string
    bodyPreview?: string
    ownerEmail?: string
    requiredAttendees?: string
    optionalAttendees?: string
    actionType?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ogiltig JSON' }, { status: 400 })
  }

  const { eventId, subject, start, end, bodyPreview, ownerEmail, requiredAttendees, optionalAttendees, actionType } =
    body
  if (!eventId || !ownerEmail) {
    return NextResponse.json({ error: 'Saknar obligatoriska fält' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Mailboxägarens e-post avgör både Ansvarig och foretag_id — kommer aldrig
  // som indata i övrigt, så tenant-gränsen sätts alltid härifrån. epost_outlook
  // finns eftersom inloggnings-mailen (epost, Google) och Outlook-mailen ofta
  // skiljer sig åt — matchar mot båda utan att röra inloggnings-mailen.
  const { data: viaOutlook } = await supabase
    .from('person')
    .select('id, foretag_id')
    .ilike('epost_outlook', ownerEmail)
    .maybeSingle()
  const { data: viaEpost } = viaOutlook
    ? { data: null }
    : await supabase.from('person').select('id, foretag_id').ilike('epost', ownerEmail).maybeSingle()
  const person = viaOutlook ?? viaEpost

  if (!person?.foretag_id) {
    return NextResponse.json({ error: 'Okänd användare' }, { status: 404 })
  }
  const foretagId = person.foretag_id

  const { data: foretag } = await supabase.from('foretag').select('epost_domain').eq('id', foretagId).single()
  const epostDomain = foretag?.epost_domain ?? null

  // En avbokning i Outlook tar bort motsvarande uppgift helt — kräver bara
  // eventId, inte mötesdetaljerna (som ofta saknas i en delete-trigger).
  if (arRadering(actionType)) {
    const { data: befintligUppgift } = await supabase
      .from('uppgift')
      .select('id')
      .eq('foretag_id', foretagId)
      .eq('outlook_event_id', eventId)
      .maybeSingle()

    if (!befintligUppgift) {
      return NextResponse.json({ ok: true, action: 'ingen_matchning' })
    }

    await supabase.from('uppgift').delete().eq('id', befintligUppgift.id)
    return NextResponse.json({ ok: true, uppgiftId: befintligUppgift.id, action: 'deleted' })
  }

  if (!subject || !start || !end) {
    return NextResponse.json({ error: 'Saknar obligatoriska fält' }, { status: 400 })
  }

  // Stående blockeringar utan riktiga deltagare (t.ex. "Lunch", "Fokustid")
  // ska inte bli uppgifter — bara möten med minst en extern/annan deltagare
  // läses in. Outlooks trigger listar mailboxägaren som required attendee
  // även på egna ensamma blockeringar, så ägarens egen adress räknas bort
  // innan vi avgör om det finns någon riktig deltagare. Gäller inte
  // raderingar (hanteras redan ovan) eftersom Outlooks delete-trigger ofta
  // saknar deltagarfälten helt.
  const ownerEmailLower = ownerEmail.toLowerCase()
  const ovrigaDeltagare = [
    ...parsaDeltagarlista(requiredAttendees),
    ...parsaDeltagarlista(optionalAttendees),
  ].filter((epost) => epost !== ownerEmailLower)
  if (ovrigaDeltagare.length === 0) {
    return NextResponse.json({ ok: true, action: 'ingen_deltagare' })
  }

  const startMs = new Date(start).getTime()
  const slutMs = new Date(end).getTime()
  if (Number.isNaN(startMs) || Number.isNaN(slutMs)) {
    return NextResponse.json({ error: 'Ogiltigt datumformat' }, { status: 400 })
  }

  const { datum, klockslag } = stockholmDatumOchKlockslag(start)
  const tidsatgangTimmar = Math.round(((slutMs - startMs) / 3600000) * 4) / 4

  const { kundNamn, titel } = parsaAmne(subject)
  let kundId: string | null = null
  if (kundNamn) {
    const { data: befintligKund } = await supabase
      .from('kund')
      .select('id')
      .eq('foretag_id', foretagId)
      .ilike('namn', kundNamn)
      .maybeSingle()

    if (befintligKund) {
      kundId = befintligKund.id
    } else {
      const { data: nyKund } = await supabase
        .from('kund')
        .insert({ foretag_id: foretagId, namn: kundNamn })
        .select('id')
        .single()
      kundId = nyKund?.id ?? null
    }
  } else {
    // Fallback när ämnet inte går att tolka (t.ex. Calendly-genererade rubriker
    // som "Åsa Thulin and Ivan Zarkov"): om en deltagare redan är en känd
    // kontaktperson, härled kunden från den kopplingen istället. Obligatoriska
    // deltagare provas före valfria; första träffen vinner.
    const kandidater = [
      ...parsaDeltagarlista(requiredAttendees),
      ...parsaDeltagarlista(optionalAttendees),
    ].filter((epost) => !epostDomain || epost.split('@')[1]?.toLowerCase() !== epostDomain.toLowerCase())

    for (const epost of kandidater) {
      const { data: matchandeKontakt } = await supabase
        .from('kontaktperson')
        .select('kund_id')
        .eq('foretag_id', foretagId)
        .ilike('epost', epost)
        .maybeSingle()

      if (matchandeKontakt) {
        kundId = matchandeKontakt.kund_id
        break
      }
    }
  }

  const { data: typ } = await supabase
    .from('uppgiftstyp')
    .select('id')
    .eq('foretag_id', foretagId)
    .eq('namn', 'Möte')
    .maybeSingle()

  const sortordning = beraknaSortordning(datum, klockslag)

  const falt = {
    titel,
    beskrivning: bodyPreview?.trim() ? htmlTillText(bodyPreview) || null : null,
    person_id: person.id,
    kund_id: kundId,
    typ_id: typ?.id ?? null,
    deadline: datum,
    klockslag,
    tidsatgang_timmar: tidsatgangTimmar,
    // Sparas oparsat i väntan på en framtida koppling mellan deltagare och
    // Kund-registret — ingen logik byggd på det här än.
    obligatoriska_deltagare: requiredAttendees?.trim() || null,
    valfria_deltagare: optionalAttendees?.trim() || null,
    ...(sortordning !== undefined ? { sortordning } : {}),
  }

  const { data: befintligUppgift } = await supabase
    .from('uppgift')
    .select('id')
    .eq('foretag_id', foretagId)
    .eq('outlook_event_id', eventId)
    .maybeSingle()

  if (befintligUppgift) {
    await supabase.from('uppgift').update(falt).eq('id', befintligUppgift.id)
    await synkaDeltagareFranOutlook(
      supabase,
      befintligUppgift.id,
      foretagId,
      kundId,
      epostDomain,
      requiredAttendees,
      optionalAttendees
    )
    return NextResponse.json({ ok: true, uppgiftId: befintligUppgift.id, action: 'updated' })
  }

  const { data: nyUppgift, error } = await supabase
    .from('uppgift')
    .insert({
      foretag_id: foretagId,
      status: 'oppen',
      prioritet: 'lag',
      outlook_event_id: eventId,
      ...falt,
    })
    .select('id')
    .single()

  if (error || !nyUppgift) {
    return NextResponse.json({ error: 'Kunde inte skapa uppgiften' }, { status: 500 })
  }

  await synkaDeltagareFranOutlook(
    supabase,
    nyUppgift.id,
    foretagId,
    kundId,
    epostDomain,
    requiredAttendees,
    optionalAttendees
  )

  return NextResponse.json({ ok: true, uppgiftId: nyUppgift.id, action: 'created' })
}
