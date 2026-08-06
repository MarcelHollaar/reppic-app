# Overdracht productie-deploy — Reppic (2026-08-06)

**Voor:** developer The Sales Studios · **Van:** Marcel Hollaar
**Bron:** GitHub `MarcelHollaar/reppic-app`, branch **`main`**.
Deze zip is een exacte export van `main` (`git archive`) — **geen `.env` erin**,
alleen `.env.example`. Alles is getest op de testomgeving (app.testreppic.nl)
en door meerdere code-reviews + een architectuurbeoordeling gegaan.

---

## 1. Wat zit er in deze release (t.o.v. huidige productie)

### A. LMS volledig NATIVE in de app (vervangt de losse LMS-applicatie)
Learner: modules (video/presentatie/document), quizzen (server-side beoordeeld,
15 vragen/module), voortgang, certificaten, leerpaden, kennisbibliotheek met
semantisch zoeken, helpcentrum, medailles. **Video's zijn Synthesia-embeds**
(per taal een eigen video); nieuw geüploade video's gaan als bestand naar de DAM.
Beheer: module-CRUD incl. video/thumbnail-upload, leerpaden (3-staps AI-wizard
op embeddings), categorieën, functierollen, tags, mediabibliotheek/Brand Kit
(Office→PDF via LibreOffice), helpcentrum, bulk-userimport (CSV), AI-
modulegeneratie (document/video/audio → module) en AI-module-vertaling (6 talen).
Rolmodel: twee assen — sales (user/manager/superadmin) × leren
(learner/learning_admin), per bedrijf aan te zetten. **AI + transcriptie loopt
via de LiteLLM-gateway** (geen nieuwe OpenAI-sleutel nodig).

### B. Agenda-koppeling per verkoper (Recall Calendar v1)
Google Calendar + Microsoft Outlook, via Recall. Instellingen → koppelen;
dashboard-kaart. Env: zie §3 (`GOOGLE_OAUTH_CLIENT_ID`,
`MICROSOFT_OAUTH_CLIENT_ID`; secrets in het Recall-dashboard).

### C. Gespreksvoorbereiding + maandelijks managerrapport
Prep-mail ~24u vóór een vervolgafspraak (vorig gesprek + HubSpot-deal per tenant,
cron `/api/cron/prepare-followups`). Maandrapport 1e maandag vd maand met PDF
(cron `/api/cron/monthly-manager-reports`).

### D. Taal structureel geborgd
De server bepaalt de weergavetaal van leerinhoud uit `user.lang_code`
(`resolveContentLanguage`); `LanguageSync` trekt de UI-taal bij het laden gelijk
aan het profiel. Gespreksanalyse volgt de gebruikerstaal (volledige taalnamen in
de LLM-prompt, fase-referentie vertaald in 5 talen). Weerstand-uitleg volgt de
taal; klant/verkoper-citaten blijven bewust in de gesproken taal.

### E. Security- & robuustheids-hardening (reviewronde 2026-08-05/06)
Command-injection in Office→PDF gedicht (`execFile` + extensie-allowlist);
stored-XSS via video-embed gedicht (host-allowlist i.p.v. ruwe HTML);
tenant-scoping gerepareerd in de leerpad-matching; rolcheck-bug (`user.role`
is object) gefixt; MIME-check op uploads; time-outs op Whisper + dashboard-sync;
platform-brede embeddings-run superadmin-only; mojibake in Duitse mailteksten
opgeschoond.

### F. LMS-fijnslijp (2026-08-06, na test met echte content)
Quizvragen hersteld (waren in productie verwijderd; zie §5); "module opnieuw
starten"-knop; toegewezen-maar-niet-gestarte modules verschijnen op de
Voortgang-pagina; sales-modules gegroepeerd onder **PICA-fasekopjes**
(1 Propositie, 2 Inventarisatie, 3 Overtuiging, 4 Afsluiting).

---

## 2. Deploy-stappen productie

```bash
cd app && npm install          # nieuw o.a. officeparser, jspdf-autotable, @types/papaparse
npm run build
npx prisma migrate deploy      # migraties zijn ADDITIEF; bestaande data blijft onaangeroerd
```

**Op de server installeren:** LibreOffice (`libreoffice --headless`; pad via
`LIBREOFFICE_PATH`) voor Office→PDF. ffmpeg zit al in het app-image.

**`docker-compose.yml`:** het exemplaar in de repo is gerepareerd (was ongeldige
YAML) en zet runtime-secrets in `environment:` (EMAIL_FROM, ENCRYPTION_KEY,
HUBSPOT_*, WEBHOOK_*). Draait productie een eigen compose, neem die correctie over.

---

## 3. Nieuwe/gewijzigde omgevingsvariabelen (zie `.env.example`)

**LMS — GEEN nieuwe secrets** (hergebruikt LiteLLM-gateway + FTP/DAM). Optioneel:
| Var | Uitleg | Default |
|---|---|---|
| `FTP_FOLDER_LMS` | DAM-submap LMS-media | `lms-reppic` |
| `LEARNING_TRANSCRIPTION_MODEL` | Whisper via gateway | `openai/whisper-1` |
| `LEARNING_EMBEDDINGS_MODEL` | semantisch zoeken (leeg=uit) | — |
| `LIBREOFFICE_PATH` | pad naar LibreOffice | `libreoffice` |

**Agenda-koppeling:** `GOOGLE_OAUTH_CLIENT_ID`, `MICROSOFT_OAUTH_CLIENT_ID`
(de client-SECRETS horen in het Recall-dashboard, niet in `.env`) + `RECALL_API_KEY`.

**Mail (kritisch — login-OTP gaat per mail):** werkende `SMTP_*` + `EMAIL_FROM`
(afzender moet geverifieerd zijn bij de SMTP-dienst).

**Cron:** `CRON_SECRET` beveiligt de cron-endpoints.

---

## 4. LMS-content importeren (modules + video's + vertalingen + vragen)

De code is klaar; de CONTENT komt uit de LMS-productie-database.
1. Exporteer per tabel JSONL — **met `psql -At`, NIET `\copy`** (dat escapet JSON
   kapot): companies, users, categories, modules, questions, learning_paths,
   learning_path_modules, job_roles, module_job_roles, translations, media_items,
   user_progress. (Kop van `app/scripts/import-lms-content.js` heeft de queries.)
2. Draai: `node app/scripts/import-lms-content.js /pad/naar/jsonl-map`
   met env `FTP_PUBLIC_URL` + `FTP_FOLDER_LMS` gezet (herschrijft `/public-objects/`
   → volledige DAM-URL). Bedrijfskoppeling gaat op **e-mail**; onbekend bedrijf
   wordt overgeslagen (geen tenant-lek). Voortgang koppelt op e-mail.
3. Video's hoeven NERGENS heen — het zijn Synthesia-embeds; import brengt de
   codes mee. Thumbnails/PDF's staan op de DAM.

---

## 5. Waar bewust over te beslissen / op te letten

- **QUIZVRAGEN:** in de productie-DB stonden **0 vragen** (ooit verwijderd; 140
  wees-vertalingen bleven achter). De 195 originele vragen zijn hersteld uit
  `app/prisma/seed-questions.sql` en het importscript koppelt de vraag-
  vertalingen per taal. **Beslis:** waren ze expres weg? Zo nee → herstellen (uit
  back-up óf via het importscript). Zo ja → weglaten.
- **Contentgaten (1-op-1 met huidige productie):** niet elke module heeft
  vertalingen/video's in alle talen; de app valt netjes terug op de brontaal.
  Compleet maken kan via de AI-vertaalfunctie in het beheer.
- **`/public-objects/`-basis-URL:** nog opvragen welke publieke URL dit in
  productie bedient (2 Bandall-PDF-modules; op de test-DAM 404).
- **Bekende schuld (architectuurbeoordeling):** `next.config` heeft
  `ignoreBuildErrors: true`; advies is een CI-stap met build + typecheck +
  `docker compose config -q` vóór elke deploy. De operationele analyseprompt
  staat gedupliceerd in `app/…/operationalAnalysisService.ts` én
  `dashboard-backend/server/openai.ts` — wijzig je er één, wijzig beide.
- **Secrets roteren** blijft aanbevolen; JWT_SECRET app ↔ dashboard-backend gelijk.

---

## 6. Migraties in deze release (additief)

4× LMS-basis (learning_roles, learning_domain, library_embeddings,
module_translations), 4× LMS-1:1 (help_center,
module_embeddings_path_competencies, media_items, learning_tags_tours),
4× gespreksvoorbereiding, 1× maandrapport. Twee delen tijdstempel
`20260802120000` (verschillende namen) — Prisma sorteert deterministisch, OK.

---

## 7. Meer documentatie in de repo

`LMS-INTEGRATIE-OVERDRACHT.md` (LMS-architectuur), `OVERDRACHT-AGENDA-KOPPELING-2026-08-06.md`
(agenda), `SECURITY-FIXES.md`, `DEPLOY-INSTRUCTIES.md`, en de scriptkoppen in
`app/scripts/`. Bij vragen: Marcel weet welke sessie-documentatie bij wat hoort.
