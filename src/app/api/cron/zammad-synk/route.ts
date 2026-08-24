import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { kornaZammadSynk } from '@/app/systemadministration/zammad-actions'

// Fönstret för de täta, schemalagda körningarna — se kommentaren på
// kornaZammadSynk. Manuella "Hämta ärenden"-knappen skannar allt istället.
const SEDAN_DAGAR = 7

// Triggas av ett pg_cron-jobb i Supabase (net.http_get), inte av Vercels egen
// cron-integration — Vercel-teamet ligger på Hobby-planen där schemalagda jobb
// begränsas till en körning/dygn, otillräckligt för det här. Supabase skickar
// samma Authorization-header manuellt (satt i cron.schedule-anropet).
// Höjd maxDuration eftersom en synk kan ta längre än standardgränsen — matcha
// timeout_milliseconds i net.http_get mot samma värde.
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const hemlighet = process.env.CRON_SECRET
  const angiven = request.headers.get('authorization')
  if (!hemlighet || angiven !== `Bearer ${hemlighet}`) {
    return NextResponse.json({ error: 'Ogiltig eller saknad nyckel' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Ett bolag per person med kopplat zammad_agent_id — stödjer flera bolag
  // utan ändring den dagen det blir aktuellt, inte bara dagens enda företag.
  const { data: personer } = await supabase.from('person').select('foretag_id').not('zammad_agent_id', 'is', null)
  const foretagIds = [...new Set((personer ?? []).map((p) => p.foretag_id).filter((id): id is string => !!id))]

  const resultat = []
  for (const foretagId of foretagIds) {
    const r = await kornaZammadSynk(supabase, foretagId, SEDAN_DAGAR)
    resultat.push({ foretagId, ...r })
  }

  return NextResponse.json({ ok: true, resultat })
}
