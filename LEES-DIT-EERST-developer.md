# LEES DIT EERST — Productieversie v13 (v6 + fixes + dashboardmodel-keuze), 2026-06-24

Dit pakket is **v6**, met de drie eerdere productie-fixes **plus** een nieuwe
feature: de superadmin kan nu ook het **model voor de dashboard-analyse** kiezen
(net zoals dat al kon voor de gespreksanalyse). Alles is lokaal tegen de echte
LiteLLM-gateway getest en bevestigd, inclusief een browser-doorloop. Het bevat
**geen** test-hacks.

Je kunt dit pakket óf rechtstreeks deployen, óf — als je een eigen repo hebt —
alleen de wijzigingen hieronder overnemen.

> **Wijzigt sinds v12:** de dashboardmodel-keuze (nieuwe DB-tabel
> `platform_settings`, twee superadmin-endpoints, UI-tabblad), een
> modellenlijst-**fallback** op `/v1/models`, en vertalingen voor beide
> model-pickers in alle 6 talen. Details onderaan onder "Nieuw in v13".

---

## De drie fixes (uit v6→v12, ongewijzigd)

### Fix 1 — `company_id` in de login-JWT  ⚠️ KRITIEK
**Bestand:** `app/src/app/api/services/authServices.ts` (in de functie die het
access-token tekent na een geslaagde login).

De dashboard-backend bepaalt per gebruiker welke data hij mag zien op basis van
`company_id` uit het JWT. Dat veld zat er **niet** in, waardoor élke
niet-superadmin terugviel op `NO_COMPANY` = "alles weigeren" → **lege
dashboards**. Dit is vrijwel zeker de oorzaak van het terugkerende "dashboards
worden niet gevuld".

```diff
  const accessToken = jwt.sign(
    {
      email: existingUser.email,
      id: existingUser.id,
      role: existingUser.role.name,
+     company_id: existingUser.company_id,
    },
    JWT_SECRET,
    { expiresIn: tokenExpirationTime },
  );
```

### Fix 2 — Backend volledig via de LiteLLM-gateway (geen OpenAI/gpt-5)
**Bestand:** `dashboard-backend/server/openai.ts` (client-init bovenin) +
`dashboard-backend/server/routes.ts` (de 503-guard op `POST /api/transcripts`).

De directe OpenAI-key (`Reppic_dashboard`) was verlopen, en **`gpt-5` bestaat
niet op de gateway** (geeft een 500). De backend draait nu volledig via de
gateway met model-alias **`twinai/large`**.

- `openai.ts`: de OpenAI-client wijst naar `LITELLM_BASE_URL/v1` met
  `LITELLM_API_KEY`; alle call-sites gebruiken `LLM_MODEL`
  (`= DASHBOARD_LLM_MODEL || "twinai/large"`). Geen `gpt-5`, geen
  `Reppic_dashboard` meer.
- `routes.ts`: de upload-guard checkt nu `LITELLM_BASE_URL` + `LITELLM_API_KEY`.

### Fix 3 — Retry op de conclusie-generators
**Bestand:** `dashboard-backend/server/openai.ts`
(`generateOperationalAggregateComparisons` + `generateStrategicAggregateComparisons`).

De gateway geeft af en toe een **500** (`'>' not supported between NoneType and
int`). De hoofdanalyse heeft een 3-pogingen-retry en herstelt — de
conclusie-generators hadden die **niet** → lege conclusie-tekst. Nu lopen beide
via `createChatWithRetry`. **Root cause = de gateway-500 zelf** (gateway-beheer).

### Fix 4 — Vaste OTP-code voor het app-store-reviewer-account
**Wat:** voor uitsluitend het e-mailadres in de env-variabele
`REVIEW_ACCOUNT_EMAIL` accepteert de login-OTP-verificatie óók de vaste code
`000000`, náást de normaal gemailde 6-cijfercode.
**Waarom:** Google/Apple-reviewers kunnen niet bij de OTP-mail (die gaat naar het
e-mailadres van de eigenaar), waardoor ze niet voorbij het inlogscherm kwamen en
de app werd afgekeurd. De reviewer doorloopt nu exact dezelfde schermen (LOGIN
geeft nog steeds `requiresOtp` + `pendingToken`) en vult op het OTP-scherm
`000000` in.
**Bestand:** `app/src/app/api/services/authServices.ts`, in `verifyLoginOtp`
(net vóór de `login_otps`-lookup): als het ingelogde adres gelijk is aan
`REVIEW_ACCOUNT_EMAIL` (case-insensitive) én de code is `000000`, wordt de
DB-code-check overgeslagen; elke andere code loopt gewoon door de normale check.
**Strikt afgebakend:** werkt alléén voor dat ene adres; is
`REVIEW_ACCOUNT_EMAIL` niet gezet, dan staat de uitzondering volledig uit. Dit is
GEEN algemene bypass en staat los van de lokale "login zonder OTP"-testhack (die
niet in het pakket zit).
**⚠️ Beveiliging:** `000000` is publiek raadbaar → voor dat account is 2FA
praktisch uit. Zorg dat het reviewer-account een **sterk wachtwoord** heeft,
**geen superadmin** is en **geen echte klantdata** kan zien (liefst een lege/demo-
omgeving). Na afronding van de review kun je `REVIEW_ACCOUNT_EMAIL` weer leeghalen
om de uitzondering uit te zetten.
**Config:** zet `REVIEW_ACCOUNT_EMAIL=marcel.hollaar@icloud.com` in de
productie-`.env` (zie "Verplichte configuratie" hieronder) — zonder die regel doet
deze fix in productie niets.

### Packaging-fix (geen code) — ontbrekend logo
`dashboard-backend/attached_assets/Reppic (7)_1759432699720.png` toegevoegd
(ontbrak in v6 → Vite-build crashte). Heb je 'm al in je repo, dan niet nodig.

---

## Nieuw in v13 — Dashboard-analysemodel instelbaar (+ modellenlijst-fallback)

### Wat & waarom
De app had al een superadmin-tabblad om het model voor de **gespreksanalyse** te
kiezen. Dat ontbrak voor de **dashboard-analyse** (die in de dashboard-backend
draait en vastzat op `DASHBOARD_LLM_MODEL`). Nu is er een tweede tabblad
**"Dashboardmodel"** in Instellingen (alleen superadmin) dat hetzelfde doet voor
de operationele & strategische dashboards.

### Nieuwe/gewijzigde bestanden
**Backend (`dashboard-backend`):**
- `shared/schema.ts` — nieuwe key/value-tabel **`platform_settings`**.
- `server/litellmModels.ts` *(nieuw)* — haalt de modellenlijst bij de gateway.
- `server/dashboardModelService.ts` *(nieuw)* — leest/schrijft de keuze, met
  fallback-keten (opgeslagen route → model+tag → env → `twinai/large`).
- `server/routes.ts` — `GET`/`PUT /api/platform-settings/dashboard-model`
  (superadmin-only via sessie-óf-JWT), en op de 3 analyse-triggers wordt het
  gekozen model vóór de analyse geactiveerd.
- `server/openai.ts` — `LLM_MODEL` is nu muteerbaar + `setDashboardAnalysisModel()`.

**App (`app`):**
- `src/components/settings/DashboardModelComponent.tsx` *(nieuw)* — het tabblad;
  praat met de **backend** (zelfde base-URL + Bearer-JWT als de dashboards).
- `src/app/settings/page.tsx` — tabblad "Dashboardmodel" toegevoegd.
- `src/app/api/services/litellmClient.ts` — `/v1/models`-fallback (zie hieronder).
- `public/locales/{nl,en,de,fr,es,it}/common.json` — vertalingen voor **beide**
  model-pickers, in alle 6 talen.

### ⚠️ Belangrijk: de modellenlijst en het keytype
De dropdown met modellen wordt live bij de gateway opgehaald. De **rijke** route
daarvoor is `GET /model/info`, maar dat is een **beheer-route**: een LiteLLM
**virtual key** (beperkt tot `llm_api_routes`) krijgt daar **403**. De
**analyse zelf** werkt wél met zo'n key (die gebruikt `/v1/chat/completions`).

Daarom proberen **beide** pickers nu eerst `/model/info` en vallen bij een 403
(of leeg resultaat) terug op **`/v1/models`** (die een virtual key wél mag,
maar zonder tags/thinking-metadata). Gevolg:

- **Master/admin-key in de `.env`** → dropdown vult rijk via `/model/info`
  (gedraagt zich precies als voorheen).
- **Virtual key in de `.env`** → dropdown vult tóch, via `/v1/models`
  (modelnamen zoals `twinai/small|medium|large`).

In beide gevallen blijft de analyse zelf gewoon werken; alleen de *keuzelijst*
hing voorheen aan `/model/info`. Wil je de rijke lijst (met kosten-tags), geef de
gateway-key dan toegang tot `/model/info` (of gebruik een master key).

### Werking
- Geen keuze opgeslagen → default = `DASHBOARD_LLM_MODEL` (`twinai/large`).
- Keuze opgeslagen → bewaard als JSON in `platform_settings`
  (`key = dashboard_litellm_model`), route-bewust (overleeft hernoemingen).
- De keuze wordt **per analyse** geresolved, dus een wijziging werkt direct op
  nieuwe analyses; geen herstart nodig.

---

## Verplichte configuratie (env)

### Dashboard-backend `.env`
```
LITELLM_BASE_URL=https://llm-reppic.mytestpartner.nl   # de gateway
LITELLM_API_KEY=<jullie gateway-key>                   # VERPLICHT
DASHBOARD_LLM_MODEL=twinai/large                        # default dashboard-model
# DASHBOARD_LLM_TAG=<optioneel>                         # routing/kosten-tag (default: baseline)
# Reppic_dashboard (OpenAI-key) is NIET meer nodig — laat leeg/verwijder
JWT_SECRET=<sterk, IDENTIEK aan de app>                 # zie hieronder
SESSION_SECRET=<sterk>
DATABASE_URL=...                                        # sales_dashboard
```

### App `.env`
De app gebruikt de gateway al (`LITELLM_BASE_URL`, `LITELLM_API_KEY`,
`LITELLM_MODEL=twinai/medium`, `LITELLM_TAG=baseline`). Zorg dat die gevuld zijn.

**⚠️ VERPLICHT voor de app-store-review — `REVIEW_ACCOUNT_EMAIL`:**
```
REVIEW_ACCOUNT_EMAIL=marcel.hollaar@icloud.com
```
Zonder deze regel doet de reviewer-fix (zie hieronder) **niets** in productie —
dan kan de Google/Apple-reviewer niet inloggen.

**⚠️ LET OP — het is niet genoeg om dit alleen in `.env` te zetten als jullie
runtime de env via een expliciete allowlist doorgeeft** (zoals een
`environment:`-lijst in `docker-compose.yml`, of een vergelijkbare
env-allowlist in jullie hosting). In dat geval moet `REVIEW_ACCOUNT_EMAIL`
**óók in die lijst** staan, anders bereikt de waarde `process.env` in de
container niet. (Bij ons op de testomgeving gebeurde precies dit: `.env` alleen
was niet genoeg; pas na toevoegen aan de compose-`environment:`-lijst + de app
opnieuw opzetten kwam de variabele in de container.) Herstart/hercreëer de app
na het zetten.

### ⚠️ `JWT_SECRET` moet IDENTIEK zijn in app én backend
De app tekent het login-token, de backend verifieert het. Verschillen ze, dan
worden alle dashboard-calls (incl. het nieuwe tabblad) geweigerd → lege schermen.

### Netwerk
De gateway (`llm-reppic.mytestpartner.nl`) laat alleen **toegestane IP's** toe
(anders 403 van openresty). Let op: dit is iets ánders dan de virtual-key-403 op
`/model/info` hierboven — die laatste is een **rechten**-kwestie van de key, geen
IP-kwestie.

---

## Deploy-stappen
1. App: `npm install` → `npx prisma migrate deploy` → `npm run build` → start.
2. Backend: `npm install` → `npm run build` → start (poort 5001). Bij start
   draait automatisch `db:push` (maakt o.a. `platform_settings` aan).
3. Controleer dat `JWT_SECRET` in beide identiek is, en `LITELLM_API_KEY` gezet.
4. Test: log in als **manager** (niet-superadmin) → dashboards moeten vullen.
   Log in als **superadmin** → Instellingen → tabblad **Dashboardmodel** → de
   modellenlijst moet vullen en opslaan moet werken.
   Lege dashboards = check Fix 1 (`company_id`) en de gedeelde `JWT_SECRET`.

---

## Wat NIET in dit pakket zit (lokale test-hacks, bewust weggelaten)
- De lokale "login zonder OTP"-bypass (alleen voor lokaal testen zonder SMTP).
- Lokale databases / lokale `.env`-waarden / `.claude/`-tooling.
- Test-scripts.

Kortom: schone v6-code + de drie productie-fixes + de dashboardmodel-feature +
de modellenlijst-fallback + vertalingen in alle 6 talen.
