// Delad fältlista mellan page.tsx (första sidladdningen) och hamtaProjektUppgifter
// i actions.ts (omladdning av en enskild projektmodals uppgiftslista efter redigering)
// — måste hållas i synk så ProjektUppgiftFormular alltid får samma form på datan.
export const PROJEKT_UPPGIFT_FALT =
  'id, titel, beskrivning, status, deadline, klockslag, tidsatgang_timmar, sortordning, person_id, kund_id, typ_id, kategori_id, projekt_id, serie_id, prioritet, ar_placeholder, anteckningsmall_id, utan_anteckningsmall, person:person_id(namn), uppgift_deltagare(kontaktperson_id), uppgift_anteckning!uppgift_anteckning_uppgift_id_fkey(block_id, innehall, uppgift_id_genererad, genererad:uppgift!uppgift_anteckning_uppgift_id_genererad_fkey(titel, deadline))'
