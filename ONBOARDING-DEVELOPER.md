# Onboarding developer — reppic-app

Dit is de **bron van waarheid** voor de Reppic-hoofdapplicatie. Vanaf 2026-07-31
werken we vanuit deze git-repository, **niet meer via losse zip-overdrachten**.
Alle wijzigingen lopen via branches/commits in deze repo, zodat altijd herleidbaar
is welke versie wat bevat.

> Het LMS is een **aparte** repository: `MarcelHollaar/Reppic_LMS`.

---

## 1. Repo klonen

```bash
git clone https://github.com/MarcelHollaar/reppic-app.git
cd reppic-app
```

## 2. Structuur

| Map | Wat | Stack |
|-----|-----|-------|
| `app/` | De hoofdapplicatie (web-UI + API) | Next.js 15, Prisma, PostgreSQL |
| `dashboard-backend/` | Aparte dashboard-service (operationeel/strategisch) | Express/Node, Drizzle, PostgreSQL |
| `desktop-shell/` | **Alleen lokaal testen** van de Recall Desktop Recording SDK | Electron. Productie-distributie loopt via **ToDesktop Builder**, niet via deze map. |
| `docker-compose.yml` | Volledige stack (app + dashboard-backend + db + cron) | — |

## 3. Secrets — belangrijk

**Er staan bewust GEEN `.env`-bestanden in de repo** (alleen `.env.example`).
Maak je eigen `.env` aan op basis van de voorbeelden:

```bash
cp app/.env.example app/.env
cp dashboard-backend/.env.example dashboard-backend/.env
```

Vul daarna de echte waarden in (vraag deze op bij Marcel / de bestaande
productie-omgeving). Commit een `.env` **nooit** — `.gitignore` houdt ze buiten
versiebeheer; laat dat zo.

Kernvariabelen:
- `app/.env`: `DATABASE_URL`, `JWT_SECRET`, `APP_URL`, `LITELLM_*`, `ASSEMBLYAI_API_KEY`,
  `ASSEMBLYAI_WEBHOOK_SECRET`, `FTP_*`, `RECALL_API_KEY`, `RECALL_WEBHOOK_SECRET`,
  `REVIEW_ACCOUNT_EMAIL`, `DASHBOARD_API_URL`.
- `dashboard-backend/.env`: `DATABASE_URL`, `SESSION_SECRET`, `JWT_SECRET`
  (moet **matchen** met de app-JWT), `LITELLM_*`, `ASSEMBLYAI_WEBHOOK_SECRET`.

## 4. Bouwen & draaien

**app/** (Next.js):
```bash
cd app
npm install
npm run generate       # prisma client
npm run migrate        # prisma migrate deploy  (37 migraties)
npm run build
npm start              # draait migrate + next start
```

**dashboard-backend/** (Express/Drizzle):
```bash
cd dashboard-backend
npm install
npm run build
npm start              # draait db:push (drizzle) + node dist/index.js
```

Of de hele stack via Docker: `docker compose up -d --build`.

## 5. Deploy-details

Voor de inhoudelijke deploy-stappen en migratie-volgorde: zie de bestaande
`DEPLOY-*.md` en `OVERDRACHT-DEVELOPER-*.md` in de root. Let met name op:
- `npx prisma migrate deploy` bij elke deploy (nieuwe migraties).
- App- en backend-`JWT_SECRET` moeten identiek zijn.
- Recall Desktop SDK vereist in productie: `RECALL_API_KEY` + `RECALL_WEBHOOK_SECRET`
  gezet, en een Recall-webhook die naar `<productie-URL>/api/webhooks/recall-sdk`
  wijst.

## 6. Werkwijze vanaf nu

- Werk op een **branch**, niet direct op `main`:
  ```bash
  git checkout -b <korte-omschrijving>
  # wijzigingen…
  git commit -m "…"
  git push -u origin <korte-omschrijving>
  ```
- Merge via een Pull Request naar `main`.
- **Geen nieuwe zips meer** — deze repo is leidend. Deploy vanuit `main`
  (of een release-tag), zodat productie altijd herleidbaar is naar een commit.

## 7. Testomgeving

Er draait een productie-getrouwe testomgeving op `app.testreppic.nl` /
`api.testreppic.nl`. Dat is waar nieuwe features eerst getoetst worden voordat
ze naar productie (`app.reppic.ai`) gaan.
