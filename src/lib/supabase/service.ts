import { createClient } from '@supabase/supabase-js'

// Endast för server-till-server-anrop utan en inloggad användarsession (t.ex.
// webhooks) — går förbi RLS helt, så all foretag_id-avgränsning måste göras
// manuellt av anroparen. Använd ALDRIG den här klienten för kod som hanterar
// en inloggad användares egna förfrågningar (använd createClient från ./server).
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
