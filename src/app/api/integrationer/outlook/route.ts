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
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ogiltig JSON' }, { status: 400 })
  }

  const { eventId, subject, start, end, bodyPreview, ownerEmail } = body
  if (!eventId || !subject || !start || !end || !ownerEmail) {
    return NextResponse.json({ error: 'Saknar obligatoriska fält' }, { status: 400 })
  }

  const startMs = new Date(start).getTime()
  const slutMs = new Date(end).getTime()
  if (Number.isNaN(startMs) || Number.isNaN(slutMs)) {
    return NextResponse.json({ error: 'Ogiltigt datumformat' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Mailboxägarens e-post avgör både Ansvarig och foretag_id — kommer aldrig
  // som indata i övrigt, så tenant-gränsen sätts alltid härifrån.
  const { data: person } = await supabase
    .from('person')
    .select('id, foretag_id')
    .ilike('epost', ownerEmail)
    .maybeSingle()

  if (!person?.foretag_id) {
    return NextResponse.json({ error: 'Okänd användare' }, { status: 404 })
  }
  const foretagId = person.foretag_id

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
    beskrivning: bodyPreview?.trim() || null,
    person_id: person.id,
    kund_id: kundId,
    typ_id: typ?.id ?? null,
    deadline: datum,
    klockslag,
    tidsatgang_timmar: tidsatgangTimmar,
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
