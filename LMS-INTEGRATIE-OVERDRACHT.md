# LMS-integratie — overdracht (2026-07-26; uitbreiding B + superadmin: 2026-07-31)

Het LMS is vanaf deze versie **native onderdeel van de Reppic-app**. De aparte
LMS-applicatie (Express/React, ex-Replit) is niet meer nodig; de app draait
alles zelf. Dit document beschrijft wat er is gebouwd, hoe je het deployt en
wat er nog openstaat.

## Wat is er gebouwd (6 fasen)

### Fase 1 — Rolmodel: twee onafhankelijke assen
- **Sales-as** (ongewijzigd): `superadmin` / `manager` / `user`.
- **Leer-as** (nieuw): `User.learning_role` = `none` | `learner` | `learning_admin`.
  Platform-superadmin is impliciet ook leer-superadmin.
- Een sales-manager kán learning_admin zijn, maar hoeft niet (beslissing Marcel).
- `Company.lms_enabled` (volledig-LMS-knop per bedrijf) en
  `Company.has_knowledge_access` (Kennisbibliotheek-add-on) — alleen superadmin
  kan deze zetten (checkboxes in bedrijf-bewerken).
- Migratie `20260726120000_add_learning_roles` zet bestaande gebruikers op
  `learner`; bedrijfscontact-managers (manager met e-mail = bedrijfs-e-mail)
  worden `learning_admin`.
- Leer-rol toekennen kan bij uitnodigen (InviteMemberDialog) en in
  `/learning/admin` (dropdown per medewerker).

### Fase 2 — Datamodel
Migratie `20260726130000_add_learning_domain` voegt 14 tabellen toe
(`learning_modules`, `learning_questions`, `learning_progress`,
`learning_certificates`, `learning_paths`(+modules), `user_module_assignments`,
`user_learning_path_assignments`, `job_roles`, `module_job_roles`,
`learning_categories`, `library_*`). Identiteit blijft in de bestaande
`users`/`companies`.

Zichtbaarheidsregels:
- Globale modules (`company_id = NULL`) → zichtbaar voor **elke** learner
  (zoals nu: de sales-skills-content is voor iedereen).
- Bedrijfsmodules → alleen eigen bedrijf én alleen als `lms_enabled` aan staat.

### Fase 3 — API (`/api/learning/*`)
Alle endpoints achter `learningAuthMiddleware` (leer-rol-gate + bestaande JWT):
- Learner: `GET modules`, `GET modules/[id]` (quizvragen **zonder** juiste
  antwoorden), `POST modules/[id]/progress`, `POST modules/[id]/quiz`
  (server-side beoordeeld, ≥70% = geslaagd → certificaat `REPPIC-…`),
  `GET progress` (ook `?user_id=` voor manager/learning_admin), `GET categories`.
- Beheer: `GET admin/employees`, `PATCH admin/employees/[id]` (leer-rol),
  `POST/DELETE admin/assignments`, `POST/PUT/DELETE manage/modules(/[id])`,
  `POST categories`.
- Tenant-isolatie: learning_admin alleen eigen bedrijf; kan nooit een
  superadmin aanpassen; sales-skills-content alleen door superadmin beheerd.

### Fase 4/5 — Schermen (in de bestaande app-shell, 6 talen)
- `/learning` — module-overzicht met tabs (salesvaardigheden/kennis),
  categoriefilter, voortgangsbalken, verplicht/aanbevolen-badges.
- `/learning/modules/[id]` — speler (embed/URL, gesanitized via bestaande
  `sanitizeEmbedHtml`) + quiz met per-vraag-feedback en certificaat.
- `/learning/progress` — statistieken, certificaten, voortgangslijst.
- `/learning/admin` — (learning_admin) medewerkers + leer-rol + toewijzen.
- `/learning/manage` + `/learning/manage/module` — module-CRUD incl.
  quizvragen-editor (superadmin globaal; learning_admin knowledge-only).
- Menu: *Ontwikkelingen* → intern `/learning` (externe LMS-link is weg);
  learning_admins krijgen extra *Leerbeheer*-item; superadmin-submenu heeft
  *Leren* en *Modules beheren* erbij.

### Fase 6 — Oude koppeling verwijderd
- `lms-sync.ts`, `/api/lms/logout`, `/api/lms/sync-all-users` → verwijderd.
- Wachtwoord-hash-duplicatie naar de LMS → weg (bestond alleen nog als no-op:
  de LMS had geen webhook-ontvanger).
- E-mail-in-URL "SSO" (`/login?email=…`) → weg; de knop op de gesprekspagina
  gaat nu naar `/learning`.
- `NEXT_PUBLIC_LMS_URL` uit `.env.example`; `LMS_API_URL`/`LMS_WEBHOOK_SECRET`/
  `LMS_SYNC_FAILURE_EMAILS` zijn niet meer nodig.

## Deploy-stappen (VERPLICHT in deze volgorde)
1. `npx prisma migrate deploy` — draait vier nieuwe migraties:
   `20260726120000_add_learning_roles`, `20260726130000_add_learning_domain`,
   `20260731120000_add_library_embeddings` en
   `20260731130000_add_module_translations`.
2. `node scripts/migrate-videos-to-learning.js` — migreert de bestaande
   videobibliotheek (Video/VideoProgress/SuggestedVideo → modules/voortgang/
   toewijzingen). Idempotent; oude tabellen blijven staan tot verificatie.
3. **Content uit de oude LMS-database** (de globale modules + quizzen moeten
   behouden blijven): exporteer volgens de instructies bovenin
   `scripts/import-lms-content.js` en draai
   `node scripts/import-lms-content.js /pad/naar/export`.
4. Verwijder de oude `LMS_*`/`NEXT_PUBLIC_LMS_URL`-variabelen uit de productie-env.
5. Na verificatie: oude LMS-app + database uit de lucht halen.

## Uitbreiding B (2026-07-31) — beheer op pariteit met het oude LMS

Op verzoek van Marcel zijn de resterende beheerschermen uit het oude LMS
alsnog geport (alles e2e getest op de lokale testomgeving):

- **Leerpaden** (`/learning/manage/paths` + `/api/learning/paths`): CRUD met
  geordende modules (volgorde verstelbaar), koppeling aan functierol, globaal
  (superadmin) of per bedrijf (learning_admin). **Toewijzen aan een medewerker**
  (knop in `/learning/admin`) materialiseert de pad-modules als verplichte
  module-toewijzingen, zodat voortgang per module via de bestaande flow loopt.
  Pad-toewijzing verwijderen laat voortgang intact (bewust niet destructief).
- **Functierollen** (`/learning/manage/job-roles` + `/api/learning/job-roles`):
  CRUD; globale templates alleen door superadmin (server-side afgedwongen, 403
  getest). In het moduleformulier kan per functierol *verplicht/aanbevolen*
  worden gekoppeld (`/api/learning/manage/modules/[id]/job-roles`).
- **Kennisbibliotheek** (`/learning/library` + `/api/learning/library/*`):
  categorieën, documenten (upload via bestaande FTP-helper naar
  `learning-library/<companyId>/`, of externe link), zoeken, favorieten,
  view-teller, concept/publiceren. Learner ziet en bladert; learning_admin
  beheert. Gate = `has_knowledge_access` (402 als de add-on uit staat — getest);
  knop op `/learning` verschijnt alleen mét add-on.
- Navigatie: superadmin-submenu heeft *Leerpaden* en *Functierollen* erbij;
  `/learning/admin` heeft snelkoppelingen naar alle beheeronderdelen; alle
  nieuwe strings in 6 talen.

## Superadmin volledig geïntegreerd (2026-07-31)

De superadmin (Reppic zelf) kan nu alles wat hij in het oude LMS kon,
bedrijfsoverstijgend vanuit één app:

- **Bedrijfskiezer** (`CompanyPicker`, alleen zichtbaar voor superadmin) in
  *Leerbeheer* (`/learning/admin`) en de *Kennisbibliotheek*
  (`/learning/library`): kies een bedrijf en beheer daar medewerkers,
  leer-rollen, toewijzingen en bibliotheek-documenten. Alle API-calls sturen
  `?company_id=` mee; de services accepteerden dat al (tenant-checks blijven
  gelden voor niet-superadmins). Vóór deze fix werkten die schermen niet voor
  superadmin (geen eigen bedrijf → leeg/403).
- **Leercategorieën-beheer** (`/learning/manage/categories` + nieuwe
  `PUT`/`DELETE /api/learning/categories/[id]`): globale categorieën
  (salesvaardigheden + kennis) door superadmin; learning_admin alleen eigen
  kennis-categorieën (403 op globale — getest). Verwijderen zet de categorie
  van modules op NULL (geen data-verlies).
- **Superadmin-menu** onder *Ontwikkelingen* is nu compleet: Leren, Modules
  beheren, Leerbeheer, Leerpaden, Functierollen, Leercategorieën,
  Kennisbibliotheek (+ de oude videobibliotheek-items tot de opruim-migratie).

## AI-features (2026-07-31) — alle drie gebouwd en e2e getest

1. **Fase-gebaseerde module-aanbevelingen** (`GET /api/learning/recommendations`
   + "Aanbevolen voor jou"-blok op `/learning`): de zwakste PICA-hoofdfasen uit
   de laatste 10 gespreksanalyses van de learner (drempel <66%) bepalen welke
   modules (op `phase` 1-4) worden aanbevolen; al afgeronde modules worden
   overgeslagen. Deterministisch, geen LLM-kosten, vervangt het oude
   `sync-reppic`-mechanisme (externe api.reppic.ai-call is niet meer nodig).
2. **AI-leerpadgeneratie uit functieprofiel** (`POST /api/learning/paths/generate`
   + ✨-knop op `/learning/manage/paths`): profiel-tekst → LLM via de bestaande
   **LiteLLM-gateway** (`completeChat`, zelfde model/tag als de gespreksanalyse)
   kiest en ordent 3-8 modules uitsluitend uit de eigen modulelijst → wordt als
   bewerkbaar leerpad opgeslagen, met per-module-onderbouwing in de UI.
   Robuust tegen markdown-fences in het LLM-antwoord.
3. **Semantisch zoeken in de Kennisbibliotheek**: nieuwe tabel
   `library_document_embeddings` (migratie `20260731120000`), indexering bij
   upload (tekst-extractie: txt/md/tekst-mime + docx via mammoth; anders
   titel+omschrijving+tags), cosine-similarity bij zoeken. **Optioneel**: alleen
   actief met `LEARNING_EMBEDDINGS_MODEL` in de env (getest werkend via de
   gateway met `text-embedding-3-small`); zonder die variabele valt zoeken
   stil terug op tekstzoeken — niets breekt. Indexering is fire-and-forget en
   blokkeert uploads nooit.

E2E-bewijs: zwakke fase Propositie 22% → juiste module aanbevolen (afgeronde
uitgesloten); LLM genereerde leerpad "Junior accountmanager buitendienst" met
3 modules in logische volgorde + rationale; query "hoe lang waarborg op
machines" vond "Garantievoorwaarden" zonder woordovereenkomst (semantic:true),
en met config uit werkt de tekst-fallback.

## Afronding (2026-07-31, avond) — laatste drie punten gebouwd + getest

1. **PDF-tekstextractie voor bibliotheek-indexering**: `.pdf`-uploads worden nu
   via `pdf-parse` (geïmporteerd als `pdf-parse/lib/pdf-parse.js` om de bekende
   test-bestand-bug te omzeilen) tekstueel geëxtraheerd en meegenomen in de
   embeddings, náást docx (mammoth) en txt/md. Getest op een echte 3-pagina-PDF
   (3258 tekens geëxtraheerd). Faalt een PDF, dan valt indexering stil terug op
   titel+omschrijving+tags — uploads breken nooit.
2. **Meertalige module-content** (`learning_module_translations`, migratie
   `20260731130000`): knop **"Alles vertalen"** / per-taal in het moduleformulier
   genereert via de LiteLLM-gateway vertalingen van titel, beschrijving én
   quizvragen (optie-aantallen blijven vast, dus de juiste-antwoord-index blijft
   geldig). De learner-API levert content in `?lang=` met terugval op de
   originele taal. Getest: "De perfecte opening" → "Die perfekte Eröffnung",
   learner met `lang=de` ziet de Duitse titel + Duitse quizvraag.
3. **Leerdata-tegel op het dashboard** (`LearningCard`): afgerond/bezig/
   toegewezen/certificaten + de eerste AI-aanbeveling + link naar `/learning`.
   Rendert alleen voor gebruikers met een leer-rol. Getest: toont 1/0/2/1 en
   "Aanbevolen voor jou: Openingsvragen stellen (Propositie)".

Nieuwe optionele env-variabele is al gedocumenteerd (`LEARNING_EMBEDDINGS_MODEL`).
Er is ook een **`prisma/OPRUIMEN-NA-VERIFICATIE.sql`** toegevoegd: de (bewust
handmatige) opruiming van de oude videotabellen + een lijst van de bijbehorende
code/schermen die weg mogen — pas draaien ná verificatie van de content-migratie.

## LMS-analyses koppelbaar aan LiteLLM-modellen (2026-07-31, laat)

Alle LMS-analyses zijn nu — net als de bestaande gespreks- en dashboardanalyse —
per analyse aan een LiteLLM-model te koppelen via superadmin-pickers in
*Instellingen* (opslag in `platform_settings`, geen migratie nodig):

| Analyse | Instellingen-tab | Setting-key | Endpoint |
|---|---|---|---|
| AI-leerpadgeneratie (chat) | *LMS: leerpad-AI* | `lms_pathgen_litellm_model` | `/api/platform-settings/lms-pathgen-model` |
| Module-vertalingen (chat) | *LMS: vertalingen* | `lms_translation_litellm_model` | `/api/platform-settings/lms-translation-model` |
| Kennisbibliotheek (embeddings) | *LMS: bibliotheek-zoeken* | `lms_embeddings_model` | `/api/platform-settings/lms-embeddings-model` |

Gedrag en garanties:
- Geen keuze opgeslagen = exact het oude gedrag (env-defaults `LITELLM_MODEL`
  resp. `LEARNING_EMBEDDINGS_MODEL`). De fase-gebaseerde module-aanbevelingen
  gebruiken géén taalmodel en hebben dus bewust geen picker.
- **Embeddings**: indexeren en zoeken gebruiken altijd hetzelfde model. Bij een
  modelwissel worden alle bestaande documenten automatisch op de achtergrond
  geherindexeerd (op basis van de opgeslagen `text_content`); tot die tijd doet
  alleen al-geherindexeerde content mee (vector-mismatch wordt genegeerd).
  De "uit"-optie (`__disabled__`-sentinel) wint van de env-default en schakelt
  terug naar gewoon tekstzoeken.
- **Adaptive-thinking-modellen** (bv. `twinai/large`): met een virtual key
  ontbreekt de thinking-metadata; `completeChat` herkent nu de specifieke
  "temperature may only be set to 1"-fout en probeert automatisch één keer
  opnieuw met temperature 1. (Dit repareert ook een sluimerend probleem voor de
  bestaande analyses op zulke routes.)

E2E getest: modellen kiezen/opslaan per picker (DB-rij klopt), leerpadgeneratie
draaide aantoonbaar op `twinai/small`, vertaling op `twinai/large` (incl. de
adaptive-fix, "L'ouverture parfaite"), embeddings uit→tekst-fallback en
aan→semantisch zoeken weer actief; learner krijgt 403 op alle drie endpoints.

## Nog open (bewuste keuzes, geen blockers)
- **AI-competentietags** en **documentconversie (ppt→pdf)** uit het oude LMS
  zijn niet geport (nice-to-have).
- De **opruim-migratie** (`OPRUIMEN-NA-VERIFICATIE.sql`) is bewust nog niet
  uitgevoerd — dat is een expliciete stap voor de developer ná verificatie.
- **Meertalige module-content** (het oude `translations`-mechanisme van de LMS)
  is niet geport; modules hebben wel `original_language`.
- **Leerdata in dashboards** (tegel in persoonlijk/operationeel dashboard).
- **Bibliotheekbestanden op FTP**: zelfde openstaande infra-kwestie als de
  opnames — publieke FTP-URL's; signed URLs is de structurele oplossing.
- **Opruim-migratie** voor de oude videotabellen (`videos`, `video_progress`,
  `suggested_videos`, `video_categories`) + oude `/developments`-videoschermen —
  pas ná verificatie van de migratie.

## Beveiliging
- Juiste quizantwoorden verlaten de server nooit richting learner-endpoints.
- Alle learning-endpoints: JWT + leer-rol-check + tenant-isolatie op
  `company_id` (zelfde patroon als de eerdere IDOR-fixes).
- Embed-HTML door de bestaande `sanitizeEmbedHtml`.
