# Overdracht — Agenda-koppeling per verkoper + prep-verfijningen

**Datum:** 2026-08-06
**In `main`:** commit `166f93c` (schone fast-forward vanaf `2c5d5bd`, 8 commits, 26 bestanden — alleen agenda/prep)
**Getest op:** de Docker-testserver `app.testreppic.nl` (mirrort productie)

---

## 0. In één alinea
Elke verkoper kan nu zijn **eigen agenda** (Google of Outlook) koppelen via
**Instellingen → Agenda**. Reppic leest daarmee de aankomende afspraken en maakt
automatisch een **gespreksvoorbereiding**. De koppeling loopt via **Recall
Calendar v1** — dezelfde integratie die de online-notetaker al gebruikt. Daar zit
meteen de belangrijkste waarschuwing (zie §4).

---

## 1. Productie-deploy — de concrete stappen

1. **Deploy `main` naar productie** (jullie standaard-flow, deploy uit deze repo).

2. **Zet twee env-variabelen in de productie-`.env`** (staan ook in
   `app/.env.example`). Dit is wat de agenda-koppeling in productie laat werken:
   ```
   GOOGLE_OAUTH_CLIENT_ID=301916217408-b2lijc43rcbietiqhfdgeu8p68dlt6ic.apps.googleusercontent.com
   MICROSOFT_OAUTH_CLIENT_ID=3d574df2-0b88-4d9d-9f74-0d2d83d3c2e9
   ```
   Beide wijzen naar de **bestaande clients in het Recall-dashboard** (us-west-2 →
   Calendar Integration) — identiek aan de testserver. Zie §4 waarom dit exact
   moet matchen.

   > Is de gespreksvoorbereiding/HubSpot-kant nog niet in productie geconfigureerd,
   > zet dan ook `ENCRYPTION_KEY` en `HUBSPOT_CLIENT_ID/SECRET/REDIRECT_URI` (met
   > productie-host in de redirect-URI). Volledige lijst + uitleg: `app/.env.example`.

3. **Migratie: niets handmatigs.** `platform_setting_value_to_text`
   (`platform_settings.value` VarChar(255) → TEXT) draait mee met de normale
   `prisma migrate deploy` bij de deploy. Veilige widening, geen dataverlies.

Daarna werkt alles: agenda koppelen, prep, en de disclaimer (§5) verschijnt vanzelf.

---

## 2. Wat is er functioneel toegevoegd
- **Per-verkoper agenda-koppeling** (Google + Microsoft/Outlook), pluggable
  opgezet. Nieuwe "Agenda"-tab in Instellingen, zichtbaar voor elke rol.
- Routes: `GET /api/calendar/connect|status|notice`, `POST /api/calendar/disconnect`.
- Service `recallCalendarService.ts` (status, connect-URL, disconnect).
- **Prep-verfijningen:** prospect-herkenning ankert op het gekoppelde
  agenda-account van de verkoper (niet de organisator, niet de login); de
  notetaker-bot (`notetaker@reppic.ai`) telt niet mee als klant.
- **Meertalige, schakelbare pilot-disclaimer** op de koppelkaart (§5).
- **Fixes:** ontkoppelknop (platform-naam-mismatch), gelijkwaardige koppelknoppen
  met logo's.
- **Opruiming:** dode auto-opname-code verwijderd; ongebruikt `organizerEmail`-veld weg.

---

## 3. Architectuur in het kort
- **Recall Calendar v1**, regio **us-west-2**. Stateless auth: Reppic-user-id =
  Recall `external_id` (`RecallAIService.getCalendarAuthToken`).
- **Recall is de bron van waarheid** voor de koppelstatus (`GET
  /api/v1/calendar/user/`); we cachen niets in onze DB → geen drift.
- De **client-secret** van Google/Microsoft staat in het **Recall-dashboard**,
  niet in onze `.env`. Onze app heeft alleen de publieke **client-ID** nodig om de
  authorize-URL te bouwen; Recall doet de code-exchange.
- Redirect-URI's (in de OAuth-apps geregistreerd, verwijzen naar Recall):
  - Google: `https://us-west-2.recall.ai/api/v1/calendar/google_oauth_callback/`
  - Microsoft: `https://us-west-2.recall.ai/api/v1/calendar/ms_oauth_callback/`
- Scopes: Google `calendar.events.readonly` + `userinfo.email`; Microsoft
  `offline_access openid email https://graph.microsoft.com/Calendars.Read`.

---

## 4. ⚠️ KRITIEKE aandachtspunten (lees dit)

### 4a. De client-ID MOET matchen met het Recall-dashboard
Autoriseren gebeurt met `GOOGLE_/MICROSOFT_OAUTH_CLIENT_ID` uit onze `.env`;
Recall wisselt de code in met de client-ID+secret uit het **Recall-dashboard**.
**Verschillen die twee, dan geeft Google/Microsoft géén refresh token** en faalt
de koppeling met `refresh_token missing from oAuth response`. Wil je een andere
OAuth-app gebruiken, zet dan **beide** kanten om (env én dashboard) als een paar.

### 4b. De online-notetaker deelt dezelfde calendar-integratie — NIET loskoppelen
De `bot.done`-webhook (`webhooks/recall/route.ts`) weigert elke opname zonder
`calendar_meetings[0]` en haalt de meetinggegevens op via
`getCalendarMeetingDetails` → dezelfde calendar-auth. Gevolg:
- **Verander de Google/Microsoft-credentials in het Recall-dashboard NIET** —
  dat breekt bestaande agenda-koppelingen én de online-notetaker.
- **"Ontkoppelen" in de Agenda-kaart verbreekt de gedéélde koppeling** → stopt
  voor die verkoper zowel de prep als de notetaker-inplanning, tot hij opnieuw
  koppelt. Dit is bewust gekozen gedrag.
- De Desktop Recording SDK (`webhooks/recall-sdk`) is een **los** pad en gebruikt
  de calendar-OAuth niet.

### 4c. Platform-naamgeving
Recall noemt het platform in connecties/disconnect **`google` / `microsoft`**;
onze code gebruikt intern `google_calendar` / `microsoft_outlook`. De vertaling
zit in `recallCalendarService.ts` (`RECALL_PLATFORM` / `fromRecallPlatform`) —
niet door elkaar halen.

---

## 5. De pilot-disclaimer (schakelbaar zonder deploy)
- De **standaardtekst staat in de code** (6 talen) in
  `app/src/app/api/(routes)/calendar/notice/route.ts` (`DEFAULT_NOTICE`) →
  verschijnt in **elke omgeving vanzelf**, ook productie, zonder seeden.
- De platform-instelling **`calendar_pilot_notice`** is puur een **override**,
  aan te passen ZONDER deploy:
  - rij afwezig ⇒ ingebouwde standaard (toont);
  - rij met JSON per taal, bv. `{"nl":"…","en":"…"}` ⇒ die tekst;
  - rij **leeg** ⇒ verborgen (dit is "disclaimer weghalen na verificatie").
- **Weghalen na Google/MS-verificatie** (geen deploy):
  ```bash
  # in de productie-app-container:
  node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.platformSetting.upsert({where:{key:'calendar_pilot_notice'},create:{key:'calendar_pilot_notice',value:''},update:{value:''}}).then(()=>p.\$disconnect())"
  ```

---

## 6. Nog te doen voor brede uitrol (extern, geen code)
De Google-app is nu **ongeverifieerd / "Testing"**. Gevolg: gebruikers zien bij
het koppelen een **"app niet geverifieerd"**-scherm (doorklikken via
"Geavanceerd") en **refresh tokens verlopen na 7 dagen**. Voor productie-brede,
wrijvingsloze uitrol:
- **Google-verificatie** aanvragen. Goede nieuws: `calendar.events.readonly` is
  een *sensitive* scope → **geen CASA-audit**, alleen merk-verificatie + demovideo.
  Doorlooptijd ~10 dagen. Marcel heeft het complete indien-pakket klaar in
  `~/Reppic-oauth-verificatie/` (runbook, concept-privacybeleid, demovideo-script,
  scope-justificaties).
- **Microsoft**: Publisher Verification voor de Azure-app (geen enge schermen
  zoals Google, maar netter).

> Let op governance: de Google-app draait nu in een privé-Google-project van
> `mjhollaar@gmail.com`. Overweeg dat project ná verificatie over te zetten naar
> een bedrijfs-organisatie (kan zonder de koppeling te raken).

---

## 7. OAuth-referentie (voor als je iets moet nazoeken)
| | Google | Microsoft |
|---|---|---|
| Client-ID | `301916217408-b2lijc43rcbietiqhfdgeu8p68dlt6ic.apps.googleusercontent.com` | `3d574df2-0b88-4d9d-9f74-0d2d83d3c2e9` |
| Waar de secret staat | Recall-dashboard (us-west-2 → Calendar Integration → Google) | idem → Microsoft Outlook |
| Redirect-URI | `…/api/v1/calendar/google_oauth_callback/` | `…/api/v1/calendar/ms_oauth_callback/` |
| Status | ongeverifieerd / Testing | ongeverifieerd |

Recall-workspace: **The Sales Studios**, regio **US West (Oregon) = us-west-2**.

---

## 8. Wat is getest (op de testserver)
- Google én Outlook koppelen → juiste OAuth-flow, refresh token binnen, koppeling
  actief (Google live end-to-end met echte agenda; fysieke afspraak zonder
  videolink verscheen óók in de lijst).
- Ontkoppelen werkt echt (na de platform-naam-fix).
- Prep-herkenning: alleen de echte prospect telt (verkoper + notetaker eruit).
- Disclaimer: standaard uit code, meertalig (nl/en/de + terugval), en verbergen
  via lege DB-rij.
- Migratie `value → TEXT` toegepast; kolom is `text`.

---

## 9. Twee-schermen-consent (Google) — voor de helpdesk
Bij Google-koppelen doorloopt de gebruiker **twee** schermen: eerst e-mailadres
("Doorgaan"), dan een **agenda-scherm met een vinkje** dat expliciet aan moet +
"Doorgaan/Toestaan". Alleen het eerste scherm afronden geeft géén refresh token.
Bij een ongeverifieerde app zit daar het "Geavanceerd → Ga naar recall.ai
(onveilig)"-tussenscherm — verwacht en veilig zolang de app in Testing staat.
