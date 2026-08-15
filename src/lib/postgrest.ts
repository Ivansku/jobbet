// Nästlade to-one-relationer i en Supabase-select-sträng typas ibland som array av
// klientbiblioteket (det kan inte alltid avgöra kardinalitet utan genererade
// databastyper), men PostgREST returnerar dem som ett enda objekt (eller null) vid
// körning. Använd den här istället för att anta endera formen — annars riskerar
// koden att typkontrollera rent men tyst få undefined tillbaka i produktion.
export function enTillRelation<T>(varde: T | T[] | null | undefined): T | null {
  if (varde == null) return null
  return Array.isArray(varde) ? (varde[0] ?? null) : varde
}
