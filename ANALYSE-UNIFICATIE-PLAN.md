# Analyse-unificatie: één bron van waarheid voor persoonlijk + operationeel dashboard

**Probleem:** operationeel dashboard en verkopers-(persoonlijk) dashboard tonen
afwijkende PICA-scores voor hetzelfde gesprek, omdat er **twee losse
per-gesprek-analyses** draaien (app-analyse vs. backend-`analyzeTranscriptOperational`).

**Principe:** de app doet **één** coaching-analyse (bron van waarheid); de backend
**aggregeert** die tot team-snapshots + doet **apart** de strategische analyse op het
volledige transcript; conclusies zijn **narratie over de geaggregeerde cijfers**
(geen extra analyse).

## Twee soorten analyse (blijven gescheiden)
- **Coaching-analyse** (per gesprek, per verkoper): PICA, weerstanden, vervolgstap-
  discipline, DMU, USP, triggers → moet overal identiek zijn → **app**, 1×.
- **Strategische analyse** (per gesprek, thematisch): trends, concurrentie, sentiment,
  propositie → alleen strategisch dashboard, geen consistentie-conflict → **backend**,
  op het volledige transcript (blijft nodig — daarom gaat het transcript sowieso mee).

## Scope
- persoonlijk = cumulatief over de gesprekken van **die verkoper**.
- operationeel = aggregaat over de gesprekken van **het team** (backend blijft
  company/team-scoped aggregeren).
- Zelfde per-gesprek-cijfers, andere optelling → bij 1 gesprek van 1 verkoper identiek.

## Datacontract (app → backend)
Push-payload per gesprek = `transcript` (voor strategisch) + `coachingAnalysis`:
`{ picaPerformance {phaseScores, phaseDetails}, resistances, nextStepDiscipline,
dmuInsights, uspMentions, triggers }` — exact de shapes die de backend-aggregatie
(`mergePhaseScores`, `mergeAnalyticsData`, …) al verwacht. Eén gedeeld TS-type als contract.

---

## Fasering
### Fase 1 — Operationele PICA uit de app (directe fix) ✅ AF + LIVE GEVERIFIEERD (2026-07-20)
> Operationeel PICA == persoonlijk PICA op fase- én onderwerp-niveau bewezen (1 salesgesprek).
> `buildPicaPerformanceFromPhaseRows` (app, gedeeld) → `coachingAnalysis.picaPerformance` in de push →
> backend `transcripts.coaching_analysis` + `operationalPicaFor()` op alle 3 merge-sites.
> (Weerstanden nog niet — mapping app-Weerstanden↔backend-topResistances/triggers volgt in Fase 2.)

- App `dashboardSyncService.pushTranscript`: payload uitbreiden met
  `coachingAnalysis.picaPerformance` (per-gesprek, uit `output.Fases`, zelfde formule
  als `phasePerformanceService`) + `resistances`.
- Backend `POST /api/transcripts`: als `coachingAnalysis` aanwezig → gebruik die
  `picaPerformance`/`resistances` voor de operationele snapshot i.p.v.
  `analyzeTranscriptOperational` voor die dimensies.
- Resultaat: operationeel PICA + weerstanden == verkopersdashboard.

### Fase 2 — App-analyse uitbreiden met operationele extra's ✅ AF + LIVE GEVERIFIEERD (2026-07-20)
> Gekozen implementatie: backend-operationele analyzer 1-op-1 geport naar de app
> (`app/src/app/api/services/operationalAnalysisService.ts`, zelfde prompt/schema) i.p.v.
> prompt.md uitbreiden — kleinste risico, zelfde definities. De app draait na de
> hoofdanalyse óók `analyzeOperational`, overschrijft de PICA daarin met de
> hoofdanalyse-PICA en pusht het geheel als `coachingAnalysis` (8 velden).
> Backend: alle 3 merge-sites gebruiken `transcript.coachingAnalysis` als volledige
> operationele analyse en slaan `analyzeTranscriptOperational` over (fallback alleen
> als coachingAnalysis ontbreekt — legacy rijen). Faalt `analyzeOperational` in de app,
> dan pusht de app zonder operationele extra's en valt de backend terug op eigen analyse.
> E2E bewezen (Test 3): operationeel PICA 83/38/78/33 == persoonlijk, alle 15 subfases
> identiek, dealHealth/dmu/usp/nextStep verbatim uit de app, strategisch nog gevuld.

### Fase 3 — Conclusies narreren de gedeelde cijfers ✅ AF (geverifieerd 2026-07-20)
> Door de architectuur al gedekt, nu expliciet geverifieerd: álle conclusielagen lezen
> de merged (unified) snapshot-data — `generateOperationalAggregateComparisons` krijgt
> `mergedOperationalData` (3 sites), en management-/tile-conclusies + conclusie-chat
> krijgen de dashboard-items (= snapshot) van de frontend. Geen enkele conclusie draait
> nog op een eigen her-analyse. Live gezien: dealHealth-conclusie narreert "score van
> 42" = de unified avgDealScore.

### Fase 4 — Strategisch blijft + opruimen ✅ AF (2026-07-20)
- `analyzeTranscript` (strategisch) ongewijzigd op het transcript.
- Dubbele operationele analyse is weg: `analyzeTranscriptOperational` draait alléén nog
  als fallback voor legacy-transcripts zonder `coachingAnalysis` — bewust behouden
  (verwijderen zou legacy-rebuilds breken). Elke fallback logt nu expliciet
  (`logOperationalFallback`) zodat rest-LLM-kosten en PICA-afwijking per transcript
  traceerbaar zijn. Zodra productie geen legacy rijen meer heeft (na F5/verloop), kan
  de functie alsnog geschrapt worden.

### Fase 5 — Backfill: keuze = forward-only
- Besluit: **forward-only.** Legacy-transcripts (gepusht vóór `coachingAnalysis`)
  krijgen bij een rebuild eenmalig de backend-fallback (nu gelogd); nieuwe gesprekken
  zijn per definitie unified. Actieve backfill (app-analyses opnieuw pushen) is niet
  gebouwd: de push maakt nieuwe transcript-rijen aan (geen koppel-ID app↔backend), dus
  dat zou dedup-logica vergen die de winst niet waard is.
- E2E-verificatie ✅ (zie Fase 2): operationeel PICA == persoonlijk (83/38/78/33, 15
  subfases identiek), tab 2/3 + conclusie coherent, strategisch nog gevuld.

## Risico's
1. Prompt-uitbreiding (Fase 2) is het gevoeligst — zelfde definities als de backend nu.
2. Contract-drift: gedeeld TS-type afdwingen.
3. Backfill: gemengde historie tot rebuild.
