# Jobbet — Projektöversikt

*Senast uppdaterad: 2026-08-15*

Detta dokument är en levande sammanfattning av vad appen gör och hur den är uppbyggd, på VAD/VARFÖR-nivå — för planeringssamtal, inte som teknisk referens. Uppdatera det när större funktioner läggs till eller avgränsningar ändras, inte vid varje commit.

## Projekt

| | |
|---|---|
| GitHub | https://github.com/Ivansku/jobbet |
| Live | jobbet-olive.vercel.app |
| Supabase | projekt-ref `yqtrccftdutraolnfdat` |

## Tech stack

- **Frontend/Backend:** Next.js 16, App Router, TypeScript, Tailwind CSS, server actions för mutationer
- **Databas/Auth:** Supabase (Postgres + Row Level Security, Auth via Google OAuth — enda inloggningsmetoden)
- **Hosting:** Vercel, auto-deploy från GitHub main-branch
- **Extern integration:** Ett API-endpoint tar emot webhook-anrop (troligen från Power Automate) som synkar Outlook-kalenderhändelser till uppgifter, se nedan

## Datamodell (nuvarande)

| Entitet | Syfte |
|---|---|
| `foretag` | Tenanten. Har en e-postdomän — används sannolikt för att skilja interna kollegor från externa kontakter. |
| `person` | Interna användare, kopplade till Supabase auth. `roll`: admin/medlem. Har en separat Outlook-mailadress (skild från Google-inloggningsmailen) — troligen för att koppla kalenderhändelser till rätt intern person. |
| `kund` | Bara namn på kundnivå. |
| `kontaktperson` | Kontaktpersoner kopplade till en kund: för-/efternamn, e-post, "senast kontaktad"-datum (redigerbart manuellt eller satt via import). Mailto-ikon i UI. |
| `uppgift` | Titel, beskrivning, status, prioritet, deadline, klockslag, tidsåtgång i timmar, ansvarig person, kund, taggad med uppgiftstyp och uppgiftsprojekt, manuell sorteringsordning inom dagskolumn, samt fält kopplade till Outlook-synk (event-id, ursprunglig deltagarlista som text). Mötesuppgifter har även `genererad_fran_uppgift_id` (pekar tillbaka till mötet för auto-genererade uppföljningsuppgifter), `sammanfattning_skickad_at` och `skapa_uppgifter_vid_klar` (nullable override av typens standard, se `anteckningsblock` nedan). |
| `uppgift_serie` | Återkommande uppgifter: startdatum, slutdatum, veckodagar, intervall (var N:e vecka), standardvärden (typ, prioritet, tidsåtgång, klockslag) som kopieras till varje ny förekomst. |
| `uppgift_deltagare` | Kopplar uppgifter (möten) till en eller flera kontaktpersoner — sätts manuellt via en deltagarväljare eller automatiskt av Outlook-synken. |
| `uppgiftstyp` | Fri, admin-hanterad lista med kategorier för att märka uppgifter. Flaggorna `visar_motesanteckningar` (visar mötesanteckningssektionen på uppgifter av den här typen) och `skapa_uppgifter_vid_klar` (standard för auto-generering av uppföljningsuppgifter, se nedan) styrs härifrån. |
| `uppgiftsprojekt` | Fri, admin-hanterad lista för att gruppera/tagga uppgifter — ett lättviktigt taggningssystem, **inte** samma sak som `projekt`/`projekt_medlem` nedan. |
| `anteckningsblock` | Admin-hanterad, rubricerad sektion för mötesanteckningar (t.ex. "TODO", "Återkoppling"). Per block: sortordning, aktiv/inaktiv, om blocket ska generera en uppföljningsuppgift (med titel-mall, uppgiftstyp, deadline i dagar efter mötet), och om det ska visas i kundsammanfattningen som standard. |
| `uppgift_anteckning` | En anteckning per block och mötesuppgift (markdown, autosparas). Håller koll på om blocket redan genererat en uppföljningsuppgift, så generering går att köra flera gånger utan dubbletter. |
| `projekt` / `projekt_medlem` | Finns kvar i schemat men används fortfarande inte i appen. |

## Behörighetsmodell

- Allt scopat per `foretag_id` via RLS. Admin hanterar kunder, personer, tar bort uppgifter.
- **Systemadministration** — en egen sida (endast admin) för att skapa/redigera/ta bort uppgiftstyper, uppgiftsprojekt och anteckningsblock (skapa/omordna/avaktivera).

## Byggt hittills

- Kundkontakter med e-post och "senast kontaktad"-status, inklusive ett "planerat möte"-datum härlett från kommande uppgifter kontakten är deltagare i
- Återkommande uppgifter (serier) med redigerbart startdatum utan att generera felaktiga förekomster bakåt i tiden
- Uppgiftstyper och uppgiftsprojekt som admin-hanterade taggnings-listor
- Outlook-kalendersynk (enkelriktad, via webhook): möten skapar/uppdaterar uppgifter automatiskt, tolkar ämnesraden för att tagga rätt kund (konventionen "Kund, QNOVA - Titel"), matchar/skapar kontaktpersoner utifrån mötesdeltagarnas mailadresser, hanterar tidszon (Stockholm/DST) på servern
- Manuell sortering av kort inom samma dagskolumn i Kanban-vyn, utöver drag-and-drop mellan dagar
- Tidsåtgång (timmar) och klockslag på uppgifter, med tidsåtgång som standardvärde på serier
- Snabbare veckonavigering i Kanban-vyn (client-side navigering istället för full omladdning)
- Enhetlig knappdesign, papperskorgs-ikon för borttagning i formulär, scrollbara modaler, mailto-ikon intill kontaktens namn
- Datumfält begränsade till fyrsiffriga år (2000–2099)
- ~140 kunder och ~200 kontaktpersoner bulk-importerade med dublettkontroll och domänbaserad kund-matchning
- Strukturerade mötesanteckningar på mötesuppgifter: admin-hanterade block, autosave (markdown-editor, samma som Beskrivning), och en expanderbar vy som fyller webbläsarfönstret (utan att ta över hela skärmen som F11) för att kunna placeras bredvid ett annat fönster under möten
- Uppföljningsuppgifter genereras från anteckningsblockens innehåll — antingen manuellt via en knapp, eller automatiskt när uppgiften markeras klar (togglingsbart, med typ-nivå-standard och per-uppgift-override)
- Kundsammanfattning som mailto-utkast, byggt från de block som är märkta för kundvisning plus status på uppföljningsuppgifter som blivit klara
- "Tidigare möten med kunden" på mötesuppgiften, och en samlad mötesanteckningsvy på kundkortet

## Medvetna förenklingar / avgränsningar just nu

- Projekt-konceptet (`projekt`/`projekt_medlem`) fortfarande pausat — `uppgiftsprojekt` täcker enkel taggning under tiden
- Kontaktperson har bara namn, e-post och senast kontaktad — inget telefonnummer, roll/titel eller egen kontaktlogg
- Outlook-synken är enkelriktad (Outlook → Jobbet), inte via inloggning — Google är fortfarande enda inloggningsmetoden
- Inget inbjudningsflöde för kollegor ännu
- Ingen notifieringslogik i appen (mejl/push)
- Ingen mobilanpassning testad
- Kundsammanfattningen skickas inte på riktigt från servern — bara ett mailto-utkast som öppnas i användarens egen e-postklient
- Ingen AI-transkribering av fritext/ljud till anteckningsblock

## Öppna frågor att diskutera

- Ska `projekt`/`projekt_medlem` aktiveras för riktiga projekt med medlemmar, eller räcker `uppgiftsprojekt` permanent?
- Behöver kontaktpersoner fler fält (telefon, roll/titel)?
- Ska Outlook-integrationen byggas ut (tvåvägssynk, felhantering/synlighet vid misslyckad synk)?
- Hur ska inbjudningsflödet för kollegor se ut?
- Behövs notifieringar till användare, och i så fall via vilken kanal?
- Ska Kanban-vyn fungera på mobil?
- Rapportering/översikt — arbetsbelastning per person och vecka, uppföljning av "senast kontaktad"?

## Arbetsflöde för Claude Code

- Använder inte subagents som standard — endast vid uttrycklig begäran eller bred undersökning, och motiverar då i en mening innan den startar.
- Direktkopplad till Supabase via MCP — fattar egna beslut om tabeller, migrations, filstruktur utifrån kraven.
- Committar per logisk delleverans — pushar inte automatiskt, bara vid uttrycklig begäran eller när Claude Code rekommenderar det och användaren godkänner.
- Har projektspecifika regler i `CLAUDE.md` för UI-granskning, databas-konsistens och multi-tenant-scoping som måste följas vid relevanta ändringar — några tillhörande skill-filer är kända att vara kopierade från ett annat projekt och väntar på omskrivning.
- Stämmer av oklarheter med användaren innan implementation påbörjas.
