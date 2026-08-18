# Jobbet — Projektöversikt

*Senast uppdaterad: 2026-08-18*

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
| `person` | Interna användare, kopplade till Supabase auth. `roll`: admin/medlem. Har en separat Outlook-mailadress (skild från Google-inloggningsmailen) — troligen för att koppla kalenderhändelser till rätt intern person. `arbetstimmar_per_vecka` (standard 40) driver kapacitetsvisningen i Uppgifter-vyn. |
| `kund` | Bara namn på kundnivå. |
| `kontaktperson` | Kontaktpersoner kopplade till en kund: för-/efternamn, e-post, "senast kontaktad"-datum (redigerbart manuellt eller satt via import). Mailto-ikon i UI. |
| `kund_anteckning` | Manuella, fristående anteckningar på en kund — titel, datum, markdown-innehåll. Oberoende av `uppgift`/mötessystemet, redigeras direkt inline på kundkortet. |
| `kund_anteckning_deltagare` | Kopplar en `kund_anteckning` till en eller flera kontaktpersoner — samma delete+insert-synkmönster som `uppgift_deltagare`. |
| `uppgift` | Titel, beskrivning, status, prioritet, deadline, klockslag, tidsåtgång i timmar, ansvarig person, kund, taggad med uppgiftstyp och kategori, valfritt kopplad till ett `projekt` (`projekt_id`), manuell sorteringsordning inom dagskolumn, samt fält kopplade till Outlook-synk (event-id, ursprunglig deltagarlista som text). Mötesuppgifter har även `genererad_fran_uppgift_id` (pekar tillbaka till mötet för auto-genererade uppföljningsuppgifter), `sammanfattning_skickad_at` och `skapa_uppgifter_vid_klar` (nullable override av typens standard, se `anteckningsblock` nedan). `mailinnehall` (fritt textfält, inte blockuppdelat) håller en inklistrad maildialog för uppgifter av en typ med `visar_mailinnehall`. |
| `uppgift_serie` | Återkommande uppgifter: startdatum, slutdatum, veckodagar, intervall (var N:e vecka), standardvärden (typ, prioritet, kategori, tidsåtgång, klockslag) som kopieras till varje ny förekomst. Saknar fortfarande koppling till `projekt` — bara vanliga (icke-återkommande) uppgifter kan höra till ett projekt. |
| `uppgift_deltagare` | Kopplar uppgifter (möten) till en eller flera kontaktpersoner — sätts manuellt via en deltagarväljare eller automatiskt av Outlook-synken. |
| `uppgiftstyp` | Fri, admin-hanterad lista med typer för att märka uppgifter (t.ex. "Möte", "Support"). Flaggorna `visar_motesanteckningar` (visar mötesanteckningssektionen på uppgifter av den här typen), `skapa_uppgifter_vid_klar` (standard för auto-generering av uppföljningsuppgifter, se nedan) och `visar_mailinnehall` (visar ett fritt mailinnehålls-fält istället för blocksystemet) styrs härifrån. |
| `kategori` | Fri, admin-hanterad lista för att gruppera/tagga uppgifter — ett lättviktigt taggningssystem. Hette tidigare `uppgiftsprojekt`; döpt om (databas, kod och UI) för att inte krocka begreppsmässigt med `projekt` nedan. |
| `anteckningsblock` | Admin-hanterad, rubricerad sektion för mötesanteckningar (t.ex. "TODO", "Återkoppling"). Per block: sortordning, aktiv/inaktiv, om blocket ska generera en uppföljningsuppgift (med titel-mall, uppgiftstyp, deadline i dagar efter mötet), och om det ska visas i kundsammanfattningen som standard. |
| `uppgift_anteckning` | En anteckning per block och mötesuppgift (markdown, autosparas). Håller koll på om blocket redan genererat en uppföljningsuppgift, så generering går att köra flera gånger utan dubbletter. |
| `projekt` | Container för uppgifter — namn, valfri kund (`kund_id`, nullable — interna projekt tillåtna), status (aktivt/pausat/avslutat), beskrivning, startdatum, samt `mall_projekt_id` som spårar vilken mall projektet genererades från (SET NULL om mallen tas bort). Uppgifter pekar tillbaka via `uppgift.projekt_id` (SET NULL vid radering — "Ta bort projekt" kopplar bara loss uppgifterna, en separat "Ta bort projekt och alla uppgifter" raderar dem explicit). |
| `projekt_medlem` | Finns kvar i schemat men används fortfarande inte i appen — ingen egen projektägare/medlemslista oavsett enskilda uppgifters ansvariga. |
| `mall_projekt` / `mall_uppgift` | Projektmallar (t.ex. "Uppstart") och deras uppgiftsmallar. Varje uppgiftsmall har samma fält som en vanlig uppgift (titel, beskrivning, typ, kategori, prioritet, status, ansvarig-standard, tidsåtgång) förutom att deadline ersätts av `dagar_efter_start` — för första uppgiften i mallen räknat från projektets startdatum, för alla efterföljande kedjat från föregående uppgift i mallen (ordningen sätts av `sortordning`, omflyttningsbar). Ingen koppling till återkommande-fälten. |
| `dagsfokus` | Dagens 1–3 självvalda fokusuppgifter, satta i Börja dagen-flödet. Privat per person (samma RLS-avsteg som Flexel). |
| `dagsavslut` | En rad per person och dag, skapas första gången kvällsflödet öppnas. Finns bara kvar som ankare för `dagsavslut_tanke` — `avslutad_at`-kolumnen finns kvar i schemat men "Avsluta dagen"-knappen som skulle sätta den är borttagen tills vidare (se Öppna frågor). Privat per person. |
| `dagsavslut_tanke` | Fristående reflektionstankar från "Vad skaver?"-steget i Avsluta dagen, med valfri länk till en auto-skapad uppföljningsuppgift. Privat per person. |

## Behörighetsmodell

- Allt scopat per `foretag_id` via RLS. Admin hanterar kunder och personer. `uppgift`, `projekt` och `kategori` är öppna för alla inloggade i företaget på samtliga operationer (inklusive radering) — `projekt` och `kategori` gick tidigare via admin-only-policys men öppnades upp för konsekvens med `uppgift`.
- **Systemadministration** — en egen sida (endast admin) för att skapa/redigera/ta bort uppgiftstyper, kategorier, anteckningsblock (skapa/omordna/avaktivera) och **Projektmallar** (skapa/redigera/ta bort mallar, samt lägga till/redigera/ta bort/omordna uppgiftsmallar inom varje mall), samt en **Användare**-sektion för att redigera namn, roll, Outlook-mail och arbetstimmar/vecka på befintliga personer (inget skapa/ta bort — personer tillkommer via inloggning, inget inbjudningsflöde ännu).

## Byggt hittills

- Kundkontakter med e-post och "senast kontaktad"-status, inklusive ett "planerat möte"-datum härlett från kommande uppgifter kontakten är deltagare i
- Återkommande uppgifter (serier) med redigerbart startdatum utan att generera felaktiga förekomster bakåt i tiden
- Uppgiftstyper och kategorier som admin-hanterade taggnings-listor
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
- **Rapporter**-sektion i huvudnavet, öppen för alla inloggade (ingen adminspärr). Första rapporttypen: **Tidsrapportering** — registrerad tid grupperad per kund för en vald vecka, med person- och veckofilter (samma vecko-UX som Kanban). Rent läsande, ingen ny tabell — bygger på `uppgift.tidsatgang_timmar`/`deadline`/`kund_id` m.fl.
- Användarkonfiguration i Systemadministration (namn, roll, Outlook-mail, arbetstimmar/vecka). Arbetstimmarna fördelas jämnt över veckans 5 arbetsdagar och visas i Kanban-vyns kolumnrubriker som "planerat/kapacitet" (t.ex. "5h/8h") för inloggad användares egna uppgifter den dagen — ersätter den tidigare summan av allas timmar per kolumn. På halvdagar hårdkodas kapaciteten till 4h istället för veckosnittet; på röda dagar döljs kapacitetstalet helt.
- **Svenska Dagar** ([src/lib/svenska-dagar.ts](../src/lib/svenska-dagar.ts)) — namnsdag/röd dag/helgdagsnamn hämtas från det öppna `api.dryg.net` (inget konto, cachas per år ~1 dygn via Next `revalidate`). Namnsdagen visas i Idag-vyns datumrad på Hem. I Uppgifter-kolumnerna och Flexel-raderna markeras röd dag och halvdag (dagen innan röd dag) med ett diagonalt streckmönster ovanpå standardbakgrunden istället för en egen kulör (grönt/rött krockade visuellt med appens success-/danger-toner) — röd dag täcker hela kolumnen/raden och byter kolumnrubriken mot helgdagens namn, halvdag räknas och täcker bara kortytan (listan med kort, inte rubrikraden) med en tunn delarlinje vid 50%-gränsen.
- **Idag-vyn** — Hem-sidan ("/") ersatt med en tvåkolumns dashboard vars innehåll styrs av tre klockstyrda dagsflöden istället för en statisk hälsning. Vilket flöde som är aktivt avgörs helt av klockslag mot två per-person-inställningar i Systemadministration → Användare (`dagsflode_morgon_slut`/`dagsflode_mitt_slut`, standard 11:00/15:00) — ingen manuell växling. Missad avslutning en dag hanteras tyst: uppgifterna dyker bara upp som eftersläpning nästa morgon.
  - **Vänsterkolumnen**: "Dagens tidslinje" — alla dagens uppgifter (mötesuppgifter och vanliga) i en enda lista sorterad på `sortordning`, samma fält Kanban-vyns drag-and-drop skriver till, så ordningen matchar Kanban exakt (tidsatta och otidsatta rader blandas fritt). Punkt + sammanhängande linje mellan raderna; klockslag visas i en egen kolumn när det finns. Hela raden (utom kryssrutan) öppnar ett redigeringsformulär — titel, beskrivning, tidsåtgång och mötesanteckningar-sektionen för mötestyper — som återanvänder `uppdateraUppgift`/`MotesanteckningarSektion` från Uppgifter-vyn. På kvällen fortsätter samma block med Flexel-snabbregistrering och "Imorgon väntar" (samma punkt/linje-design, men skrivskyddad).
  - **Högerkolumnen**: en ring med "X av Y klara" för dagen, "Gårdagens försenat" (alla obockade uppgifter med deadline före idag, synlig i alla flöden), "Dagens fokus" (välj 1–3 uppgifter, bara på morgonen), "Kunder idag" och på kvällen "Vad skaver?" (fristående reflektionstankar, valfritt kopplade till en auto-skapad uppgift imorgon).
  - Ingen egen "Avsluta dagen"-knapp just nu — fanns tidigare men gjorde bara en sak (satte en tidsstämpel utan koppling till någon annan logik) och togs bort i väntan på en tydligare idé om vad den ska göra.
- **Flexel** — andra fliken i Rapporter (Tidsrapportering | Flexel), personlig logg för Flex, Övertid, Föräldraledig och Ledighet som ersätter en tidigare Excel-fil (242 historiska rader importerade). Tre tabeller (`flexel_post`, `flexel_installning`, `flexel_kvotjustering`), strikt privat RLS på post/kvotjustering (`person_id = current_person_id()`, **ingen admin-insyn** — medvetet avsteg från appens vanliga `foretag_id`+admin-mönster). `flexel_installning` följer däremot det vanliga admin-mönstret (admin sätter Flex/Övertid/Föräldraledig per person i Systemadministration → Användare) — utom **Ledighet**, som är en fjärde typ alla har utan aktivering. Vyn är månadsbaserad (inte veckobaserad): ett dag-rutnät per vardag, grupperat i veckokort, där en vecka hör till den månad dess **fredag** ligger i (samma modell Ivan använde i Excel, matchar hans månadsrapportering till jobbet/Försäkringskassan). Föräldraledig-kvoten (fredagar × veckotimmar per månad, justerbar per månad för undantag) är verifierad mot den ursprungliga Excel-filens egna checkpoint-formler.
- **Projekt** (steg 2 av det tidigare pausade projekt-initiativet) — `projekt`-tabellen aktiverad som container för uppgifter: namn, valfri kund, status, beskrivning, startdatum. Egen toppnivåflik **Projekt** (mellan Uppgifter och Kunder) visad som en Kanban-tavla — en kolumn per projektmall, projekten som klickbara kort (namn, statusbadge, kund/"Internt", "X av Y klara"), egen "+ Nytt projekt"-knapp per kolumn som förifyller mallvalet, plus en global knapp i sidhuvudet. Projekt utan matchande mall hamnar i en egen "Utan mall"-kolumn (visas bara om den har innehåll). Ett tidigare försök att lägga skapa/redigera-flödet i en flik på kundkortet stötte på en nästlad `<form>`-bugg (Modal-komponenten portalar inte) och flyttades därför till egen sida istället för att lappa den delade Modal-komponenten.
- **Projektmallar** (del av steg 3, mallmotor) — Systemadministration → Projektmallar. En mall (t.ex. "Uppstart") har en ordnad lista uppgiftsmallar (upp/ner-omordning, ingen drag-and-drop). "Nytt projekt" kräver ett mallval och ett startdatum; vid skapande instansieras mallens uppgiftsmallar som riktiga uppgifter kopplade till projektet — deadline för första uppgiften räknas från projektets startdatum, varje efterföljande uppgifts "dagar efter"-fält räknas kedjat från föregående uppgift i mallen (fältetiketten byter text beroende på position). Mallistan visar ackumulerad "Dag N" per rad. Ny uppgiftsmall förvalt ansvarig = inloggad person; Beskrivning har samma markdown-editor som uppgifter. Mallformuläret stannar öppet (byter till redigeringsläge) efter att en ny mall skapats, så uppgiftsmallar kan läggas till direkt utan att öppna mallen igen. Både mallarnas uppgiftsmallar och projektens uppgifter hämtas färdigt server-side vid sidladdning (ingen synlig laddningsfördröjning vid öppning).
- **Utökat anteckningsstöd på kundkortet** — tre separata sektioner, alla hämtade färdigt server-side i förväg (ingen egen klientfördröjning när kundkortet öppnas):
  - **Mötesanteckningar** (befintlig, oförändrad härledd vy över `uppgift`/`uppgift_anteckning`) visar nu innehållet skrivskyddat formaterat via en ny `MarkdownViewer`-komponent (samma Tiptap/`tiptap-markdown`-uppsättning som redigeraren, bara `editable: false`) istället för rå markdown-text.
  - **Anteckningar** — helt fristående manuella kundanteckningar (`kund_anteckning`): titel, datum, markdown-innehåll, valfritt kopplade kontaktpersoner (`kund_anteckning_deltagare`, återanvänder `DeltagareValjare`-komponenten från uppgiftsformuläret). Klick på en rad expanderar den direkt i redigeringsläge — ingen separat visa/redigera-växling.
  - **Mailanteckningar** — parallellt spår till mötesanteckningarna för att klistra in maildialoger: ny typ-flagga `visar_mailinnehall` (Systemadministration → Uppgiftstyper) styr ett fritt textfält (`uppgift.mailinnehall`, inte blockuppdelat) i uppgiftsformuläret. Sektionsrubriken visas alltid på kundkortet ("Inga anteckningar ännu." när tomt), men enskilda uppgifter utan innehåll listas inte.

## Medvetna förenklingar / avgränsningar just nu

- `projekt_medlem` fortfarande oanvänd — inget sätt att sätta en projektägare oavsett vem som är ansvarig på de enskilda uppgifterna
- Projektmallar stödjer inte checklistpunkter (steg 1 i det ursprungliga initiativet, inte byggt) och genererar inga kopplingar till återkommande uppgifter
- Projektnamn föreslås inte automatiskt utifrån mall + kund vid skapande — skrivs manuellt varje gång
- Kontaktperson har bara namn, e-post och senast kontaktad — inget telefonnummer, roll/titel eller egen kontaktlogg
- Outlook-synken är enkelriktad (Outlook → Jobbet), inte via inloggning — Google är fortfarande enda inloggningsmetoden
- Inget inbjudningsflöde för kollegor ännu
- Ingen notifieringslogik i appen (mejl/push)
- Ingen mobilanpassning testad
- Kundsammanfattningen skickas inte på riktigt från servern — bara ett mailto-utkast som öppnas i användarens egen e-postklient
- Ingen AI-transkribering av fritext/ljud till anteckningsblock

## Öppna frågor att diskutera

- Ska `projekt_medlem` aktiveras för att kunna sätta/se en projektägare oavsett enskilda uppgifters ansvariga?
- Ska projektmallar kunna definiera checklistpunkter (steg 1 i initiativet)?
- Ska projektnamn föreslås automatiskt (mall + kund) vid skapande, eller är manuellt bra nog?
- Behöver kontaktpersoner fler fält (telefon, roll/titel)?
- Ska Outlook-integrationen byggas ut (tvåvägssynk, felhantering/synlighet vid misslyckad synk)?
- Hur ska inbjudningsflödet för kollegor se ut?
- Behövs notifieringar till användare, och i så fall via vilken kanal?
- Ska Kanban-vyn fungera på mobil?
- Tidsrapportering v1 är byggd (vecka × kund). Utanför scope hittills: export (PDF/Excel), redigering av tid i rapportvyn, filter på flera personer samtidigt, månads-/årsvy, historik/trend över tid, koppling till "senast kontaktad" eller andra kundfält — värt att prioritera bland dessa vid nästa iteration.
- Flexel: Ivan funderar på att bokföra *varje* vardag (0h + motivering på vanliga dagar, typ mindre relevant), inte bara avvikande dagar — medvetet skjutet på framtiden tills det visar sig relevant.
- Flexel: `flexel_kvotjustering` (manuell kvotminskning per månad) och den nya typen Ledighet (fristående daglig logg) överlappar delvis i syfte — värt att fundera på om kvotjustering kan fasas ut till förmån för att bara logga Ledighet-rader, nu när båda finns.
- Idag-vyn: vad ska "Avsluta dagen" som handling faktiskt innebära (utöver att vara en tidsstämpel)? Tidigare variant gjorde ingenting kopplat till kvarvarande uppgifter, streak eller liknande — togs bort tills det finns en tydligare idé.

## Arbetsflöde för Claude Code

- Använder inte subagents som standard — endast vid uttrycklig begäran eller bred undersökning, och motiverar då i en mening innan den startar.
- Direktkopplad till Supabase via MCP — fattar egna beslut om tabeller, migrations, filstruktur utifrån kraven.
- Committar per logisk delleverans — pushar inte automatiskt, bara vid uttrycklig begäran eller när Claude Code rekommenderar det och användaren godkänner.
- Har projektspecifika regler i `CLAUDE.md` för UI-granskning, databas-konsistens och multi-tenant-scoping som måste följas vid relevanta ändringar — några tillhörande skill-filer är kända att vara kopierade från ett annat projekt och väntar på omskrivning.
- Stämmer av oklarheter med användaren innan implementation påbörjas.
