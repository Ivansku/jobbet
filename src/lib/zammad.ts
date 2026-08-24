// Tunn klient mot Zammads REST-API. Autentiserar med en personal access token
// (se .env.local) — inga skrivningar mot Zammad görs, bara läsning av ärenden,
// tidsbokningar, organisationer och användare för synkarna i
// systemadministration/zammad-actions.ts och zammad-kund-actions.ts.

const ZAMMAD_URL = process.env.ZAMMAD_URL
const ZAMMAD_API_TOKEN = process.env.ZAMMAD_API_TOKEN

export type ZammadTicket = {
  id: number
  title: string
  organization_id: number | null
  customer_id: number | null
  updated_at: string
  ticket_time_accounting_ids: number[]
}

export type ZammadTimeAccounting = {
  id: number
  ticket_id: number
  ticket_article_id: number | null
  time_unit: string
  created_by_id: number
  created_at: string
}

export type ZammadOrganization = {
  id: number
  name: string
  domain: string | null
  active: boolean
  member_ids: number[]
}

export type ZammadUser = {
  id: number
  firstname: string | null
  lastname: string | null
  email: string | null
  active: boolean
}

async function zammadGet<T>(path: string): Promise<T> {
  if (!ZAMMAD_URL || !ZAMMAD_API_TOKEN) {
    throw new Error('ZAMMAD_URL eller ZAMMAD_API_TOKEN saknas i miljövariablerna.')
  }
  const res = await fetch(`${ZAMMAD_URL}${path}`, {
    headers: {
      Authorization: `Token token=${ZAMMAD_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`Zammad ${path} -> ${res.status} ${res.statusText}`)
  }
  return res.json()
}

export function zammadTicketUrl(ticketId: number): string {
  return `${ZAMMAD_URL}/#ticket/zoom/${ticketId}`
}

// Samtliga ärenden, paginerat (Zammad tar max 200/sida oavsett angivet limit).
// Ingen datumgräns — dubbletter förhindras redan på id-nivå (uppgift.zammad_ticket_id,
// uppgift_zammad_tidspost.zammad_time_accounting_id), så det är billigare och mer
// robust att alltid skanna om allt än att försöka hoppa över det som "redan setts":
// ett ärende som misslyckats (t.ex. ingen kundmatchning) rör sig inte i Zammad och
// skulle annars falla ur ett datumfönster för gott utan att någonsin ha synkats klart.
export async function hamtaAllaArenden(): Promise<ZammadTicket[]> {
  const alla: ZammadTicket[] = []
  const perPage = 200
  for (let sida = 1; sida <= 50; sida++) {
    const data = await zammadGet<ZammadTicket[] | { tickets: ZammadTicket[] }>(
      `/api/v1/tickets/search?query=*&sort_by=updated_at&order_by=desc&per_page=${perPage}&page=${sida}`
    )
    const sidans = Array.isArray(data) ? data : data.tickets
    alla.push(...sidans)
    if (sidans.length < perPage) break
  }
  return alla
}

export async function hamtaTidsbokningarForArende(ticketId: number): Promise<ZammadTimeAccounting[]> {
  return zammadGet<ZammadTimeAccounting[]>(`/api/v1/tickets/${ticketId}/time_accountings`)
}

export async function hamtaOrganisation(organizationId: number): Promise<ZammadOrganization> {
  return zammadGet<ZammadOrganization>(`/api/v1/organizations/${organizationId}`)
}

// 140 organisationer i skrivande stund — samma "sök med limit" som ärenden,
// gott om marginal utan att behöva sidnumrering.
export async function hamtaAllaOrganisationer(): Promise<ZammadOrganization[]> {
  const data = await zammadGet<ZammadOrganization[] | { organizations: ZammadOrganization[] }>(
    '/api/v1/organizations/search?query=*&limit=500'
  )
  return Array.isArray(data) ? data : data.organizations
}

export async function hamtaAnvandare(userId: number): Promise<ZammadUser> {
  return zammadGet<ZammadUser>(`/api/v1/users/${userId}`)
}
