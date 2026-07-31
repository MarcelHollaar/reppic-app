# Overdracht aan developer — 2026-07-26

Dit is de **nieuwste versie** van de Reppic-app + dashboard-backend. Deploy **deze
codebase** naar productie (in plaats van de versie die er nu op staat).

## Waarom deze deploy

1. **Fix voor de "16 verschillende inlogcodes"-bug.** Op productie ontving het
   account `marcel.hollaar@icloud.com` bij één login automatisch 16 verschillende
   codes. Op de testomgeving is met deze versie gemeten (via de echte browser én
   via de API): **1 login = 1 code**, geen lus — in backend én frontend. De lus
   zit dus in de oude versie die nu op productie draait; deze versie lost het op.
2. **App-store-reviewer-login** (`000000`) — zie stap 3 hieronder.
3. Plus alle eerdere wijzigingen (desktop-opname via Recall SDK, dashboard-
   unificatie, e-mail-sterrenfix, security-hardening). Details in
   `LEES-DIT-EERST-developer.md`, `DEPLOY-2026-07-20.md`, `SECURITY-FIXES.md`.

## Deploystappen

1. **Dependencies**: `npm install` in `app/` én `dashboard-backend/`
   (nieuwe deps: `mammoth`, `pdf-parse`).
2. **Database app**: `cd app && npx prisma migrate deploy`.
3. **Database backend**: `cd dashboard-backend && npm run db:push`
   (draait ook automatisch bij `npm start`).
4. **Env-variabelen** in de productie-`.env` (zie `.env.example` + LEES-DIT-EERST).

## ⚠️ Verplicht voor het reviewer-account — `REVIEW_ACCOUNT_EMAIL`

```
REVIEW_ACCOUNT_EMAIL=marcel.hollaar@icloud.com
```

Hiermee accepteert de login-OTP-verificatie voor **uitsluitend dit adres** de
vaste code `000000`, náást de normaal gemailde code — zodat de Google/Apple-
reviewer voorbij het inlogscherm komt.

**Let op (dit was op de testomgeving precies het verschil tussen "werkt niet" en
"werkt"):** het is niet genoeg om deze regel alleen in `.env` te zetten als jullie
runtime de env via een **allowlist** doorgeeft (bijv. een `environment:`-lijst in
`docker-compose.yml`). Dan moet `REVIEW_ACCOUNT_EMAIL` **óók in die lijst** staan,
anders bereikt de waarde `process.env` in de container niet en wordt `000000`
geweigerd. Herstart/hercreëer de app na het zetten.

## Verifiëren na deploy

1. Log één keer in als `marcel.hollaar@icloud.com` + code `000000` → moet binnen
   zijn, en er komt **precies één** code (geen 16).
2. Log in met een gewoon account + de echte gemailde code → werkt zoals altijd.

## Beveiliging

`000000` is publiek raadbaar; voor dat ene account is 2FA daarmee praktisch uit.
Zorg dat het reviewer-account een sterk wachtwoord heeft, **geen superadmin** is en
geen echte klantdata kan zien. Na goedkeuring door de store kan
`REVIEW_ACCOUNT_EMAIL` weer leeggehaald worden om de uitzondering uit te zetten.
