# Reppic — Compleet Deploy-pakket v12 (19 juni 2026)

> ## 👉 LEES EERST: `LEES-DIT-EERST-developer.md`
> v12 heeft **geen onveilige defaults meer** (geen `"your-secret-key"`, geen
> auto-superadmin met `"password123"`). Daardoor **moet** je een paar dingen
> expliciet zetten (vooral `JWT_SECRET`), anders werkt de app bewust niet.
> Alles staat stap-voor-stap in **`LEES-DIT-EERST-developer.md`** in deze map.

Eén plug & play pakket met de volledige, bijgewerkte Reppic-omgeving,
**inclusief `.env`-bestanden**. Geen samenvoegen nodig, en — sinds v5 —
**geen handmatige prompt-re-seed meer**: de analyse-prompt synchroniseert
zichzelf bij deploy (zie §3).

> **Basis van deze versie:** v4 (developer-branch `42b717fa6496` met de
> DB-gestuurde prompt-editor, wachtwoordregels en admin-routes), waarop de
> nieuwste analyse-, privacy- en dashboardverbeteringen zijn gemerged.
> v6–v8 brachten tenant-isolatie, LiteLLM-routing en het gpt-5-analysemodel;
> v9–v11 een uitgebreide security-hardening; **v12 verwijdert de laatste
> onveilige defaults** (JWT + superadmin-seed — zie §6 en `LEES-DIT-EERST`).
> Dit vervangt v4 t/m v11 — **gebruik uitsluitend dit pakket**.
>
> De dashboard-backend in dit pakket combineert jullie Docker/JWT-deploycode
> (HOST-binding, `JSON_BODY_LIMIT`, API-only build) met de nieuwste
> analyse-features (privacy-anonimisering, canonieke weerstandsnamen,
> `conversationCount`, individueel verkoper-dashboard). Beide kanten zitten er
> dus in — niets gaat verloren t.o.v. v4.

```
Reppic-DEPLOY-COMPLEET-v12/
├── LEES-DIT-EERST-developer.md    ← ⚠️ begin hier (config + veiligheid)
├── DEPLOY-INSTRUCTIES.md          ← dit bestand
├── README.md
├── .env.example
├── app/                           ← de Reppic-app (Next.js), incl. .env
└── dashboard-backend/             ← dashboards-API (Express + Postgres), incl. .env, Dockerfile
```

---

## 1. Deploy — Reppic-app

```bash
cd app
npm install
npx prisma generate
npx prisma migrate deploy     # of: npm run migrate
npm run build
npm run start                 # of: npm run dev
```

Controleer in `app/.env` vóór productie:
- `JWT_SECRET` — exact gelijk aan die van de dashboard-backend
- `NEXT_PUBLIC_DASHBOARD_API_URL` + `DASHBOARD_API_URL` — URL van de backend
- SMTP-, FTP-, LiteLLM- en AssemblyAI-waarden indien nog leeg

## 2. Deploy — Dashboard-backend

```bash
cd dashboard-backend
npm install
npm run db:push        # Postgres-tabellen (Drizzle) — voegt o.a. de nieuwe
                       # kolommen user_id / user_name op transcripts toe
npm run build && npm run start    # of: npm run dev / Docker (zie Dockerfile)
```

Belangrijk in `dashboard-backend/.env`:
- `JWT_SECRET` en `SESSION_SECRET` zijn **verplicht** — de server start bewust
  niet zonder.
- `REPPIC_ORIGIN` wordt **afgedwongen** voor CORS — zet hier het echte
  Reppic-domein (comma-gescheiden lijst mag).
- `NODE_ENV=production` in productie (secure cookies).
- `ALLOW_DEMO` leeg laten in productie.
- `JSON_BODY_LIMIT` optioneel (default 25mb), `HOST` optioneel (default
  `0.0.0.0`, nodig voor Docker), `PORT` optioneel (default 5000).
- `ASSEMBLYAI_WEBHOOK_SECRET` — **let op: dit is de variabele van de
  DASHBOARD-BACKEND**, voor het auto-import-endpoint van de backend. Verwar hem
  niet met de gelijknamige variabele in `app/.env`: die hoorde bij het
  transcriptie-callback-endpoint van de app en is **niet meer in gebruik** sinds
  de rollback van 2026-07-22 (zie `SECURITY-FIXES.md`). Beide endpoints heten
  toevallig `/api/webhooks/assemblyai`, maar draaien op verschillende services.
  Hieronder gaat het uitsluitend over de backend.
  **Verplicht ALS je de AssemblyAI-auto-import-
  webhook (`/api/webhooks/assemblyai`) gebruikt.** Nieuw in v6: die webhook is
  onge-authenticeerd en vertrouwt de meegestuurde `company_id`, dus hij is nu
  fail-closed — zonder deze secret weigert hij élke call (HTTP 503). De
  reguliere transcript-push vanuit de Reppic-app (`POST /api/transcripts` met
  JWT) gebruikt dit niet en blijft sowieso werken. Zet dezelfde waarde aan de
  AssemblyAI-kant (header `x-webhook-secret` of query `?secret=`).
- **Dashboard-analyse-model (v8)** — de dashboard-analyse draait **altijd op
  een capabel model, standaard `gpt-5`** (nooit het lichtere app-model). Routing:
  - `LITELLM_API_KEY` **leeg** → gpt-5 wordt **direct op OpenAI** aangeroepen
    (via `Reppic_dashboard`).
  - `LITELLM_BASE_URL` + `LITELLM_API_KEY` **ingevuld** (zelfde als de app) →
    gpt-5 loopt **via de LiteLLM-gateway**, zodat de **kosten in LiteLLM
    zichtbaar** zijn. ⬅ aanbevolen voor kosten-overzicht.
  - `DASHBOARD_LLM_MODEL` (default `gpt-5`) — moet een exacte model-alias zijn
    die op jullie gateway bestaat.
  - `DASHBOARD_LLM_TAG` (default `dashboard`) — aparte tag zodat LiteLLM de
    **dashboard-kosten los van de gespreksanalyse** rapporteert. ⚠️ Als jullie
    gateway strikte tag-routing afdwingt, moet die tag daar bestaan op de
    gpt-5-deployment — anders zet je 'm op een bekende tag, of geef je de backend
    een **eigen LiteLLM virtual key** (schoonste manier om kosten te splitsen).
  - De app blijft op z'n eigen lichtere model (`twinai/medium`) — twee modellen,
    één gateway, één kosten-overzicht.

## 3. ✅ Analyse-prompt synchroniseert nu automatisch (geen handmatige stap meer)

> **Wat in v4 nog een handmatige actie was, gebeurt nu vanzelf.**

De analyse-prompt wordt uit de database geladen (beheerbaar via
Settings → prompt-editor). Bij elke deploy vergelijkt de app de meegeleverde
`app/src/lib/transcript-analysis/prompt.md` met de database:

- **Lege prompt-tabel** → `prompt.md` wordt als versie 1 geseed en geactiveerd.
- **`prompt.md` is gewijzigd t.o.v. de laatste deploy** → de nieuwe inhoud
  wordt automatisch als nieuwe versie geïmporteerd én geactiveerd.
- **`prompt.md` ongewijzigd** → er gebeurt niets; een via de prompt-editor
  handmatig gekozen versie blijft staan (wordt dus **niet** overschreven).

De sync draait bij de eerste prompt-gerelateerde request na start en is
veilig bij meerdere replica's (in-process guard + unieke-constraint-afhandeling).
Je hoeft dus **niets** meer handmatig te re-seeden. In de backend-log verschijnt
bij een import: `[TranscriptAnalysis] Prompt auto-synced to version N from prompt.md.`

## 4. ⚠️ Eénmalige acties bij een BESTAANDE installatie

(Bij een schone installatie kun je dit overslaan.)

1. **Week-snapshots resetten.** Snapshots van vóór v4 bevatten gesommeerde
   i.p.v. gemiddelde scores; daarnaast gebruiken oude snapshots de oude,
   niet-canonieke weerstandsnamen ("Prijszorg" e.d.). Resetten zorgt voor
   schone aggregatie met de nieuwe canonieke namen.
   ```bash
   curl -X DELETE http://localhost:5001/api/analytics/snapshots/strategic -H "Authorization: Bearer <JWT>"
   curl -X DELETE http://localhost:5001/api/analytics/snapshots/operational -H "Authorization: Bearer <JWT>"
   ```
2. **Individueel verkoper-dashboard t.a.v. oude gesprekken.** De nieuwe
   kolommen `user_id`/`user_name` worden gevuld bij nieuw geanalyseerde
   gesprekken. Bestaande (oude) transcripts hebben nog geen verkoper-koppeling
   en verschijnen daardoor niet in het individuele PICA-dashboard tot ze
   opnieuw worden geanalyseerd. Dit is verwacht gedrag; nieuwe gesprekken
   werken direct.

## 5. Verificatie (end-to-end)

1. `curl -i http://localhost:5001/api/analytics/summary` → `401` is correct.
2. Reppic-login → menu toont Strategisch + Operationeel Dashboard.
3. Gesprek analyseren → backend-log: `[DashboardSync] Transcript pushed...`.
4. Dashboards tonen data; AI-chat (ConclusionCard) werkt en toont nette
   foutmeldingen bij storingen.
5. NL-taalinstelling → fasetitels in gespreks-inzichten zijn Nederlands
   ("Introductie", "Het ijs breken", "Overeenkomst", …).
6. **Privacy-check**: open een dashboard → er staan **geen** namen van personen
   of klantbedrijven in de items/omschrijvingen. Alleen het concurrentie-veld
   mag een concurrent-bedrijfsnaam tonen, en uitsluitend als die expliciet in
   het gesprek genoemd werd.
7. **Follow-up mail**: analyseer een gesprek → de mail bevat drie gevulde
   secties (samenvatting, kernpunten, vervolgstappen) met concrete, op het
   gesprek gebaseerde bullets, en — waar een logische vervolgactie niet besproken
   is — een proactieve suggestie (bv. een vervolgafspraak).

---

## 6. Changelog v12 (t.o.v. v11) — laatste onveilige defaults verwijderd

> ⚠️ **Belangrijkste wijziging: er zijn geen onveilige defaults meer.** Dit
> vereist actie van de developer — zie **`LEES-DIT-EERST-developer.md`**.

- **Gokbare JWT-default weg**: `process.env.JWT_SECRET || "your-secret-key"` is
  uit alle 6 app-bestanden verwijderd → nu `process.env.JWT_SECRET`. Geen
  vervalsbare tokens meer via een publiek bekende secret. **Vereist dat
  `JWT_SECRET` gezet is** (identiek in app + backend); anders faalt auth bewust
  (fail-closed) en logt de app `[auth] FATAL: JWT_SECRET is not set`.
  Build-veilig: de fout valt bij gebruik, niet bij `next build`.
- **Default-superadmin-achterdeur weg**: de backend seedde
  `superadmin@reppic.ai` met hardcoded wachtwoord `"password123"`. Dat is
  verwijderd; seeden kan nu alleen eenmalig via `SUPERADMIN_SEED_PASSWORD`
  (anders wordt er geen superadmin aangemaakt).
- **Bestaande deploy**: roteer `JWT_SECRET` en wijzig/verwijder het oude
  `superadmin@reppic.ai`-account (zie `LEES-DIT-EERST`, deel 2).

De analyse-pijplijn is onveranderd en correct (gpt-5, intact) — v12 raakt alleen
de defaults/secrets, niet de analyse-logica.

## 7. Changelog v11 (t.o.v. v10) — security-hardening, vervolg

Derde/vierde security-pass, met nadruk op **niets breken** (elke fix is getoetst
aan hoe de app daadwerkelijk authenticeert). Geen extra deploy-stappen.

### Dashboard-backend
- **Object-ACL afgedwongen** op `GET /objects/:objectPath(*)`: privébestanden
  alleen voor een gerechtigde gebruiker, publieke assets (brandkit-logo) blijven
  voor iedereen leesbaar. `POST /api/uploads/request-url` vereist nu auth.
- **Brandkit-mutaties** (`POST`/`DELETE /api/brandkit/logo`) en
  `GET /api/reanalysis/status` accepteren nu **session-login óf Reppic-JWT**
  (de standalone dashboard-client gebruikt session-cookies — daarom géén
  Bearer-only). `GET /api/brandkit/logo` blijft open (publiek logo).
- **JWT-algoritme vastgepind** (`HS256`); sessie-cookie `sameSite: "lax"`.

### Reppic-app
- **JWT-secret zonder gokbare default**: de gevaarlijke
  `process.env.JWT_SECRET || "your-secret-key"` (auth-bypass als de secret
  ontbrak) is uit 6 bestanden weg — **zonder** bij build te crashen (de
  `next build` in Docker blijft werken; de fout valt pas bij echt tekenen/
  verifiëren als `JWT_SECRET` ontbreekt).
- **IDOR's gedicht**: `GET/DELETE /api/transcripts/:id` (rauwe gesprekstekst van
  een ander bedrijf), `/audio-stream/conversation/[id]` (opname van elk gesprek),
  `audio-chunks` DELETE en `merge-audio-chunks` — nu auth + eigenaar/zelfde-company.
- **`/api/heygen/token`** mintte anoniem betaalde avatar-tokens → nu auth
  vereist (de avatar-client stuurt z'n token mee).
- **Test-endpoint** `/api/test/twinai-error-email` is in productie uitgezet.
- **Rate-limiting** op `login`/`2fa-verify`/`forgot-password` (10 pogingen per IP
  per 15 min); generieke 500-foutmeldingen (geen interne details meer naar de
  client).

## 8. ⚠️ Security — actiepunten / aandachtspunten voor de developer

Deze drie kunnen wij niet in code dichtzetten — ze hangen aan jullie config/infra:

1. **Recall-webhook signature**: `/api/webhooks/recall` verwerkt bot-/opname-
   events **zonder signature-verificatie** → forgebaar. Voeg de Recall-
   webhooksecret + svix-handtekeningcontrole toe (zoals de Surecart-webhook dat
   al correct doet). Niet door ons gedaan omdat het de Recall-secret + integratie-
   test vereist.
2. **Opnames op publieke FTP**: recordings worden via een **directe publieke
   URL** afgespeeld (`<audio src>` kan geen token sturen). Wie de URL kent, kan
   de audio ophalen. Oplossing op storage-niveau: **signed/expiring URLs**.
3. **Rate-limiting is in-memory/per container** (10/15 min per IP). Achter een
   gedeeld kantoor-IP (NAT) kan dat krap zijn — stem de limiet af, en zet bij
   meerdere replica's een gedeelde store (Redis) ervoor.

**Verplichte env-checks** (anders faalt auth of analyse):
- `JWT_SECRET` **moet** gezet zijn en **identiek** in app- én backend-`.env`
  (zonder gokbare fallback faalt auth nu bewust i.p.v. onveilig door te gaan).
- `SESSION_SECRET` verplicht (backend start niet zonder).
- `ASSEMBLYAI_WEBHOOK_SECRET` als je die webhook gebruikt (zie §2).
- `WEBHOOK_SIGNING_SECRET` voor de Surecart-webhook.

**Even testen na deploy** (de security-fixes raken deze flows):
inloggen · gespreksanalyse → dashboards · opnemen → afspelen · salescoach-avatar ·
brandkit-logo upload/weergave.

## 9. Changelog v10 (t.o.v. v9) — tweede security-pass

Diepere audit op auth-bypass, IDOR en object-toegang. Geen functionele wijziging,
geen extra deploy-stappen.

- **🔴 Tenant-IDOR gedicht**: `GET`/`DELETE /api/transcripts/:id` controleerde de
  company niet — elke ingelogde gebruiker kon met een ID de **rauwe gesprekstekst
  van een ánder bedrijf** lezen of verwijderen. Nu een strikte company-check
  (superadmin uitgezonderd), met `404` om bestaan niet te bevestigen.
- **🔴 JWT auth-bypass-footgun weg (app)**: zes app-bestanden gebruikten
  `process.env.JWT_SECRET || "your-secret-key"`. Stond de echte secret ooit niet
  gezet, dan tekende/verifieerde de app met een **publiek bekende default** →
  tokens te vervalsen. Nu fail-hard (de app weigert te tekenen/verifiëren zonder
  `JWT_SECRET`).
- **JWT-algoritme vastgepind**: `jwt.verify(..., { algorithms: ["HS256"] })`
  (tegen algorithm-confusion).

### ⚠️ Nog open (bewust niet blind gefixt — vereist test)
- **Object-download `/objects/:objectPath(*)`** heeft geen auth/ACL-handhaving:
  `downloadObject` berekent wel `isPublic` maar dwingt het niet af, en
  `canAccessObjectEntity` wordt niet aangeroepen. Privébestanden zijn dus door
  iedereen met het pad op te halen. Fix vereist het inbouwen van de ACL-check
  (publiek → serve; privé → auth + `canAccessObjectEntity`) — moet getest worden
  zodat publieke assets (bv. brandkit-logo) blijven werken.

## 10. Changelog v9 (t.o.v. v8)

Security-hardening-ronde op de dashboard-backend (na een audit op secret-lekkage
en aanvalsoppervlak). Geen functionele wijziging; geen extra deploy-stappen.

- **Brandkit-endpoints dichtgezet**: `/api/brandkit/logo` (GET/POST/DELETE) stond
  volledig **zonder auth** — iedereen van buitenaf kon het logo overschrijven/
  verwijderen, en de POST zette de ACL van een aangeleverd `objectPath` op
  `public` (mogelijke data-exposure). Nu: `requireJwtAuth` op alle drie,
  manager/superadmin-rol vereist voor POST/DELETE, en `objectPath` moet binnen
  `/objects/` vallen.
- **Geen interne foutdetails meer naar de client**: ~19 endpoints gaven
  `error.message` (interne/DB-details) terug bij een 500. Nu één generieke melding
  naar de client; de volledige fout gaat alleen naar de server-log.
- **Rate-limiting op auth**: `/api/auth/login`, `/2fa-verify` en
  `/forgot-password` zijn begrensd op **10 pogingen per IP per 15 min** (429 +
  `Retry-After`). Dependency-vrij/in-memory — per container; bij meerdere
  replica's een gedeelde store ervoor zetten.
- **Auth op `/api/reanalysis/status/:language`** (stond open).

### Security-status (geverifieerd in de audit)
Geen hardcoded keys; geen secrets in `NEXT_PUBLIC_`-vars, logs of API-responses;
geen raw SQL (geparametriseerd via Drizzle/Prisma); CORS afgedwongen op
`REPPIC_ORIGIN`. ⚠️ Resterend aandachtspunt buiten de code: deze zip bevat echte
`.env`-secrets — nooit naar derden sturen of publiek uploaden; keys roteren bij
een eventueel lek.

## 11. Changelog v8 (t.o.v. v7)

Corrigeert de oorzaak waardoor de dashboards in v7 leeg konden blijven, en maakt
de kosten splitsbaar. Geen wijziging aan de app.

### Dashboard-backend — analyse-model vastgezet op gpt-5
- **Footgun weg**: in v7 viel de backend bij LiteLLM zonder expliciet model terug
  op het lichte `twinai/medium`, dat de zware dashboard-JSON niet aankan → analyse
  faalde → lege dashboards. v8 zet de dashboard-analyse **altijd op een capabel
  model, standaard `gpt-5`**, en valt nooit meer terug op het app-model.
- **Kosten via LiteLLM**: met `LITELLM_BASE_URL` + `LITELLM_API_KEY` ingevuld
  loopt gpt-5 via de gateway → dashboard-kosten zichtbaar in LiteLLM. De app
  blijft op `twinai/medium`. Twee modellen, één gateway, één kosten-overzicht.
- **Aparte kosten-tag**: `DASHBOARD_LLM_TAG` (default `dashboard`) zodat LiteLLM
  de dashboard-kosten los van de gespreksanalyse rapporteert (zie §2 voor de
  tag-routing-kanttekening).
- `LITELLM_MODEL`/`LITELLM_TAG` worden door de backend niet meer gebruikt en zijn
  uit de backend-`.env` gehaald (die horen bij de app).

### Onveranderd, ter herinnering
- De **tenant-guard** blijft zoals afgesproken: geen `company_id` bekend →
  geen dashboard-resultaten, zonder UI-melding. Bekijk je de dashboards als
  superadmin, of als manager met een `company_id` die de verkopers delen.

## 12. Changelog v7 (t.o.v. v6)

Eén wijziging in de dashboard-backend; geen wijziging aan de app-functionaliteit.

### Dashboard-backend — LLM-provider geünificeerd (optie A)
- De dashboard-analyse (strategisch + operationeel + persoonlijk dashboard)
  loopt nu via **dezelfde LiteLLM-gateway als de Reppic-app**, i.p.v.
  rechtstreeks OpenAI. Eén provider, centrale key/kosten-governance, en de
  dashboard-scores liggen dichter bij wat de verkoper in de app ziet (zelfde
  model: standaard `twinai/medium`).
- Aangezet via `LITELLM_BASE_URL` + `LITELLM_API_KEY` in de backend-`.env` (in
  dit pakket al ingevuld). Zonder die vars valt de backend terug op
  OpenAI/`gpt-5` — volledig backward-compatible.
- ⚠️ De dashboards draaiden op gpt-5 en nu op twinai/medium. Controleer of de
  dashboard-kwaliteit voldoet; zo niet, kies een ander model via
  `DASHBOARD_LLM_MODEL` zonder code-wijziging.

### Security-hygiëne
- De app-`.gitignore` negeert nu `.env` (bevatte LiteLLM-/JWT-/OpenAI-secrets);
  voorheen alleen `.env*.local`. Voorkomt dat secrets in git belanden.

## 13. Changelog v6 (t.o.v. v5)

Twee tenant-isolatie/security-fixes in de dashboard-backend; geen functionele
wijzigingen aan de app. Geen extra deploy-stappen, behalve het zetten van
`ASSEMBLYAI_WEBHOOK_SECRET` als je de webhook gebruikt (zie §2).

### Dashboard-backend
- **Harde tenant-guard bij ontbrekend bedrijf**: een ingelogde niet-superadmin
  zonder `company_id` kreeg voorheen via de "geen filter"-tak álle bedrijven te
  zien. `company_id` is in het datamodel optioneel (`String?`), dus dat was een
  latent lek. Nu valt zo'n gebruiker terug op een sentinel-bedrijfs-id dat op
  geen enkel echt bedrijf matcht → **lege resultaten** bij lezen en
  geïsoleerde opslag bij schrijven. Superadmin blijft bewust alles zien.
- **Webhook fail-closed**: `/api/webhooks/assemblyai` is onge-authenticeerd en
  vertrouwt de meegestuurde `company_id`. De gedeelde secret was optioneel — bij
  een niet-gezette `ASSEMBLYAI_WEBHOOK_SECRET` werd de check overgeslagen. Nu
  weigert de webhook élke call (HTTP 503) zolang die secret niet is gezet, en
  blijft anders de bestaande secret-validatie van kracht. Zie §2 voor de env-var.

## 14. Changelog v5 (t.o.v. v4)

### Reppic-app
- **Plug & play prompt-sync (§3)**: `prompt.md` wordt automatisch naar de
  database gesynchroniseerd bij deploy — geen handmatige re-seed meer.
  Handmatige edits in de prompt-editor blijven behouden (alleen écht nieuwe
  `prompt.md`-inhoud wordt geïmporteerd).
- **Follow-up mail terug op het oude detailniveau**: de mail vat de kernpunten
  concreet samen met context uit het gesprek (geen kale labels meer), bevat
  altijd alle drie de secties, en geeft **proactieve suggesties** wanneer een
  logische vervolgactie niet besproken is (bv. "stel een vervolgafspraak voor").
  De mail wordt altijd volledig opgesteld, ook bij een kort transcript.
- **Hoger detailniveau in de verslaglegging**: bullets zijn specifiek en
  verankerd in het gesprek i.p.v. generieke samenvattingen.

### Dashboard-backend
- **Privacy / anonimisering (strikt)**: in álle outputvelden worden namen van
  personen (verkoper, klant, beslisser) en van het klant-/prospect-bedrijf
  vervangen door rollen/generieke verwijzingen. De énige plek waar een
  bedrijfsnaam mag staan is het concurrentie-veld, en alleen als de concurrent
  expliciet in het gesprek genoemd is. De concurrentie-analyse wordt altijd
  geproduceerd, met of zonder concurrentnaam.
- **Canonieke weerstandsnamen (semantische ontdubbeling)**: weerstanden krijgen
  per categorie (prijs/timing/product/proces) een vaste canonieke naam, zodat
  semantisch gelijke bezwaren over gesprekken heen samenvallen. Prijssignalen
  heten consequent **"Prijsperceptie"** (voorheen ontstonden splitsingen als
  "Prijszorg" vs "prijsperceptie, duurder dan alternatief"). De klantwoorden
  staan in de omschrijving, niet in de naam.
- **`conversationCount`** wordt teruggegeven in de analytics-responses (aantal
  geanalyseerde gesprekken achter een view).
- **Individueel verkoper-dashboard (PICA per verkoper)**: per-gesprek wordt de
  verkoper vastgelegd (`user_id`/`user_name`, zie `db:push` in §2), zodat
  dezelfde operationele analyse ook per verkoper kan worden geaggregeerd —
  zonder aparte analyse-run.
- **Behouden uit jullie eigen werk**: `requireJwtAuth`-integratie,
  `JSON_BODY_LIMIT` (25mb), `HOST`-binding, API-only Docker-build,
  Dockerfile + init-SQL, security-hardening uit v4 (verplichte secrets, CORS op
  `REPPIC_ORIGIN`, secure cookies, `ALLOW_DEMO`-gate).

## 15. Bekende openstaande punten (bewust niet in deze versie)
- Reppic-app: auth op enkele test-/audio-routes. (Rate-limiting op login en de
  AssemblyAI-webhook-secret zijn inmiddels gefixt — zie §6.)
- Rate-limiting in de dashboard-backend is **in-memory/per container**; bij
  meerdere replica's een gedeelde store (bv. Redis) ervoor zetten.
- Fase-rubriek-uitleg (doel/voorbeelden in de popup) is nog Nederlandstalig
  voor alle talen; vertaalmechanisme staat klaar.
