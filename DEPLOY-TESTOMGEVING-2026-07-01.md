# Installatie op de TESTOMGEVING — developer-instructie

Pakket: `Reppic-studios-test-2026-07-01.zip` · Datum: 2026-07-01
Doel: deze build correct installeren op de **testomgeving** en verifiëren, vóór promotie naar productie.

> **Scope:** alleen de map **`app/`** is gewijzigd. De `dashboard-backend/` is
> níet aangeraakt. Volg onderstaande stappen in volgorde.

---

## 0. Vereisten
- **Node 20.5.0** (zie `app/.nvmrc`) — gebruik exact deze major (bv. `nvm use`).
- **PostgreSQL** (bestaande testdatabase; wordt gemigreerd, niet opnieuw aangemaakt).
- Toegang tot de **LiteLLM-gateway** (`LITELLM_BASE_URL`) vanaf een **gewhiteliste IP**
  (anders 403 op de analyse).
- Prisma **6.x** (zit in het pakket; gebruik `./node_modules/.bin/prisma` of de npm-scripts —
  níet een globaal geïnstalleerde Prisma 7).

---

## 1. Uitpakken & environment
```bash
unzip Reppic-studios-test-2026-07-01.zip
cd the-sales-studios-the-sales-studios-decc41dc1f32/app
cp .env.example .env        # daarna invullen (zie hieronder)
```

`.env` zit **bewust niet** in het pakket. Vul minimaal in:

| Variabele | Nodig voor |
|---|---|
| `DATABASE_URL` | Postgres-connectie (testdatabase) |
| `JWT_SECRET` | Login/auth — **moet identiek zijn** aan de dashboard-backend als die gebruikt wordt |
| `LITELLM_BASE_URL`, `LITELLM_API_KEY`, `LITELLM_MODEL` | Gespreksanalyse (model = jullie `twinai/medium` = GPT-5-mini) |
| `APP_URL` | Links in e-mails |
| `SMTP_*` | Feedback-/verslagmails |
| `TRANSCRIPTION_PROVIDER`, `ASSEMBLYAI_API_KEY`, `FTP_*` | Opname → transcript → analyse (alleen nodig om via echte opnames te testen) |

> `LITELLM_TEMPERATURE` **niet** zetten — de analyse gebruikt bewust temperatuur **0**
> (consistente scores).

---

## 2. Installeren
```bash
npm ci                 # exacte versies uit package-lock
npx prisma generate
```

---

## 3. Database migreren — VERPLICHT
```bash
npx prisma migrate deploy
```
Draait o.a. de nieuwe migratie **`20260630120000_total_score_to_float`**
(`conversation_summaries_x.total_score`: `INTEGER` → `DOUBLE PRECISION`).
**Zonder deze migratie faalt elke nieuwe analyse** (decimale score in een Int-kolom).
Bestaande hele getallen casten verliesloos (7 → 7.0).

*(Let op: `npm start` draait `migrate deploy` óók automatisch. Draai hem hier
alvast expliciet, zodat je vóór het starten kunt backfillen.)*

---

## 4. Build
```bash
npm run build
```

---

## 5. Bestaande scores herberekenen (backfill)
De totaalscore-berekening is teruggezet naar het **fase-gemiddelde**
(`(som van de 15 fase-scores / 45) × 10`, weerstanden tellen niet mee). Bestaande
gesprekken staan nog op de oude, te hoge score. Herbereken ze deterministisch uit
de opgeslagen `phases` — **zonder de LLM opnieuw te draaien**:

```bash
# 5a. eerst een BACKUP van de testdatabase (voor de zekerheid)
pg_dump "$DATABASE_URL" > backup-voor-backfill.sql

# 5b. DRY-RUN — toont per gesprek oud → nieuw + gemiddelden, schrijft NIETS
node prisma/seeders/recompute-total-scores.js

# 5c. controleer de output, en pas dan toepassen:
node prisma/seeders/recompute-total-scores.js --apply
```
Moet ná stap 3 (kolom is dan Float). Raakt alleen `total_score` in
`conversation_summaries_x`.

---

## 6. Starten
```bash
npm start           # = prisma migrate deploy (idempotent) + next start
```
De analyse-prompt in `app/src/lib/transcript-analysis/prompt.md` wordt bij de start
**automatisch als nieuwe versie geïmporteerd én geactiveerd**.
> ⚠️ Als iemand de prompt **handmatig in de admin-editor** heeft aangepast, wordt die
> door deze automatische activatie **overschreven**. Controleer dit vooraf.

---

## 7. Rooktest op de testomgeving (verificatie)
- [ ] **Login** als verkoper → dashboard laadt.
- [ ] Tegel **"Resultaten per gespreksfase"** toont percentages (groen pas vanaf 80) en
      bouwt cumulatief op over alle gesprekken van de gebruiker.
- [ ] Open een geanalyseerd gesprek → **Inzichten** → elke fase-tegel is te openen via
      **"meer lezen"** (ook Bedrijf / Resultaat / Doorvragen).
- [ ] **Score overal gelijk, 1 decimaal**: inzichten-metric = detailkaart = gesprekkenlijst
      = feedbackmail (bv. overal `7.8`, nergens `8` vs `7.8`).
- [ ] **Toegang (IDOR)**: een gewone gebruiker kan een gesprek-id van een ander **niet**
      openen; een **manager ziet een gesprek van zijn teamlid wél**.
- [ ] Analyseer (of her-analyseer) een **niet-salesgesprek** → er is toch een gespreksverslag.
- [ ] **Backfill-resultaat**: scores van bestaande gesprekken zijn omlaag bijgesteld
      (fase-gemiddelde) en consistent met de inzichten.
- [ ] *(optioneel, vanaf gewhiteliste IP)* live analyse-smoketest:
      ```bash
      node scripts/analyse-smoketest.mjs
      ```
      Print de 15 fase-scores + totaalscore + weerstanden. Bij HTTP 403 → niet-gewhiteliste IP.

---

## 8. Rollback (indien nodig)
- **Code:** vorige build terugzetten.
- **Migratie:** de kolomwijziging is een verbreding (Int→Float); functioneel omkeerbaar,
  maar niet nodig voor een rollback van de app.
- **Scores:** als je de backfill wilt terugdraaien, herstel `conversation_summaries_x`
  uit `backup-voor-backfill.sql` (stap 5a).

---

## Bijlage A — Wat zit er in deze build (wijzigingen)
Functioneel:
1. Tegel "Resultaten per gespreksfase" gevoed uit de **gespreksanalyse** (cumulatief), niet meer uit de dashboard-backend.
2. Score-kleur **groen pas vanaf 80**.
3. **Gespreksverslag altijd** genereren, ook bij "geen salesgesprek".
4. Follow-up mail: **geen 2–3-limiet** meer op behoeften/oplossingen/acties.
5. **"Meer lezen"** werkt op alle fase-tegels.
6. **Score overal identiek** (1 decimaal) in inzichten, detailkaart, lijst én mail (`total_score` → Float).
7. **Totaalscore = fase-gemiddelde** `(som/45)×10`; weerstanden tellen niet mee. + backfill-script.

Beveiliging (uit routereview):
8. **IDOR** in `/api/analytics/phase-performance` (manager → alleen eigen team).
9. **Gesprek-IDOR** dicht: `getConversationById` scope't nu op eigenaar; lees-endpoint autoriseert owner/manager-zelfde-bedrijf/superadmin.
10. **Opgeslagen XSS** in samenvatting + fase-redenering geneutraliseerd (HTML-escape + veilige opmaak).

## Bijlage B — Belangrijkste gewijzigde/nieuwe bestanden
- `app/src/lib/transcript-analysis/analyze.ts` (score-formule), `prompt.md` (verslag + geen cap)
- `app/prisma/migrations/20260630120000_total_score_to_float/`, `app/prisma/seeders/recompute-total-scores.js`
- `app/src/app/api/services/phasePerformanceService.ts`, `app/src/app/api/(routes)/analytics/phase-performance/route.ts`
- `app/src/app/api/utils/conversationAccess.ts`, `app/src/utils/safeHtml.ts`
- `app/src/app/api/models/conversation.ts`, `app/src/app/api/(routes)/conversations/route.ts`
- `app/src/components/salesDashboards/*` (tegel), `app/src/app/conversations/insights/[id]/...` (fase-tegels, metrics)
- `app/src/app/api/utils/conversationSummaryEmailHtml.ts`, `app/src/app/api/services/conversationReportMail.ts` (mailscore)
- `app/scripts/analyse-smoketest.mjs`

## Bijlage C — Nog open (gerapporteerd, buiten deze deploy)
Webhook-signatures (`webhooks/assemblyai`, `webhooks/recall`); onbeveiligde salescoach-LLM-endpoints
(`chat`, `sessions/*` → kostenmisbruik); profiel-IDOR (`/api/user/[userId]`); publieke FTP-opname-URLs.
Blokkeren deze deploy niet, maar staan nog open voor de developer.
