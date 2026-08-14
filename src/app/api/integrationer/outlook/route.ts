import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { beraknaSortordning } from '@/lib/sortordning'

// Möten skrivs enligt konventionen "Kund, QNOVA - Titel" — allt före
// avdelaren taggas som Kund (och skapas om den inte redan finns), resten
// blir Titel. Matchar avdelaren inte alls blir hela ämnet Titel oförändrat.
const KUND_AVDELARE = ', QNOVA - '

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
  const idx = subject.indexOf(KUND_AVDELARE)
  if (idx === -1) return { kundNamn: null, titel: subject.trim() }
  return { kundNamn: subject.slice(0, idx).trim(), titel: subject.slice(idx + KUND_AVDELARE.length).trim() }
}

const RADERINGS_VARDEN = new Set(['deleted', 'delete', 'cancelled', 'canceled', 'removed'])
function arRadering(actionType?: string): boolean {
  return !!actionType && RADERINGS_VARDEN.has(actionType.trim().toLowerCase())
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
    return NextResponse.json({ ok: true, uppgiftId: befintligUppgift.id, action: 'updated' })
  }

  const { data: nyUppgift, error } = await supabase
    .from('uppgift')
    .insert({
      foretag_id: foretagId,
      status: 'oppen',
      prioritet: 'medel',
      outlook_event_id: eventId,
      ...falt,
    })
    .select('id')
    .single()

  if (error || !nyUppgift) {
    return NextResponse.json({ error: 'Kunde inte skapa uppgiften' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, uppgiftId: nyUppgift.id, action: 'created' })
}
