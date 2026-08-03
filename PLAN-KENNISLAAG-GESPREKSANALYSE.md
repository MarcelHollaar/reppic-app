# Plan: Kennislaag in de gespreksanalyse (productkennis uit de Kennisbibliotheek)

**Datum:** 2026-07-31 · **Status:** PLAN — nog niet gebouwd
**Doel:** de bestaande gespreksanalyse krijgt een **extra analyselaag** die toetst
of de product-/dienstenkennis uit de Kennisbibliotheek van het bedrijf in het
gesprek aan bod is gekomen (door verkoper én klant), of die correct is
weergegeven, en wat er gemist is. **Geen aparte analyse** — één gespreksverslag,
één run. De laag draait **alleen als de Kennisbibliotheek van het bedrijf
gevuld is**; anders verandert er helemaal niets.

---

## 1. Kernbesluit: hoe "een extra laag" betrouwbaar te bouwen

### Het bestaande patroon in de code is precies dit
De analyse-run (`conversationAnalysisService`) doet nu al twee LLM-stappen in
één run: de **hoofdanalyse** (PICA-fasen, score, mail, leerpunten) en daarna de
**operationele analyse** (`analyzeOperational`) — een tweede, ondergeschikte
LLM-call waarvan het resultaat in dezelfde run wordt gemerged
(`coaching_analysis`). Die tweede laag heeft: eigen klein Zod-schema,
3× retry met foutfeedback, een prompt-injection-guard, en **faalt onafhankelijk**
(hoofdanalyse en verslag blijven altijd overeind).

### Advies: de kennislaag als derde stap in dezelfde run (géén prompt-uitbreiding van de hoofdanalyse)
Twee opties overwogen:

| | A. Hoofdprompt uitbreiden (één LLM-call) | **B. Derde stap in dezelfde run (advies)** |
|---|---|---|
| Regressierisico hoofdanalyse | **Hoog** — de hoofdprompt is superadmin-beheerd en versioned (`TranscriptAnalysisPromptVersion`); dynamische bibliotheekcontext + extra outputvelden erin = schema-drift, token-druk, score-beïnvloeding | **Nul** — hoofdanalyse blijft byte-voor-byte identiek; PICA, totaalscore, mail en dashboards onaangeroerd |
| Conditioneel (alleen bij gevulde bibliotheek) | Promptvarianten nodig | Triviaal: stap overslaan |
| Foutisolatie | Eén mislukte parse = hele analyse stuk | Laag faalt stil; verslag komt gewoon |
| Kosten/latency | Iets goedkoper | +1 call, alleen bij gevulde bibliotheek |
| "Eén analyse" voor de gebruiker | Ja | **Ook ja** — zelfde run, zelfde verslag, extra sectie |

"Extra laag" gaat over wat de gebruiker ziet en wanneer het draait — niet over
het aantal LLM-calls. Optie B geeft dezelfde beleving met een fractie van het
risico, en volgt een patroon dat al in productie bewezen is.

---

## 2. Architectuur van de laag (4 bouwstenen)

### 2.1 Retrieval — welke kennis gaat mee (RAG over de eigen bibliotheek)
Niet de hele bibliotheek meesturen (token-limiet, ruis), maar gericht ophalen:

1. **Query = het transcript** (of de eerste ~4k tekens + samenvatting) tegen de
   bestaande embeddings (`library_document_embeddings.text_content` +
   `semanticSearchLibrary`) → **top 5–8 documenten** van het bedrijf van de
   verkoper, gecapt op ~5k tokens contexttekst.
2. **Fallback zonder embeddings-model**: compacte catalogus van álle
   gepubliceerde documenten (titel + beschrijving + tags) + `text_content` van
   de kleinste documenten tot de cap. De laag werkt dus ook zonder
   embeddings-configuratie — alleen minder gericht.
3. Elke passage gaat mee **mét bronlabel** (`[DOC:{id}] {titel}`), zodat de
   LLM per bevinding een bron kan noemen die wij kunnen verifiëren.

Nieuw: `knowledgeContextService.ts` met `isLibraryFilled(companyId)` en
`getKnowledgeContextForTranscript(companyId, transcript)`.

### 2.2 De analyse-stap — klein, streng, verifieerbaar
Nieuw: `knowledgeAnalysisService.ts`, gemodelleerd naar
`operationalAnalysisService` (zelfde parseJsonLoose + Zod + 3× retry +
`UNTRUSTED_CONTENT_GUARD`). Outputschema bewust klein:

```jsonc
{
  "coverage_score": 0-100,          // hoe goed kwam de relevante kennis aan bod
  "summary": "2-3 zinnen, taal vd gebruiker",
  "topics": [{
    "topic": "Garantievoorwaarden",
    "source_document_id": "…",       // MOET een meegegeven [DOC:id] zijn
    "discussed_by": "seller|customer|both|none",
    "correct": true|false|null,      // klopte wat de verkoper zei met de bron?
    "evidence_quote": "letterlijk citaat uit transcript (of null bij none)",
    "note": "1 zin toelichting"
  }],
  "missed_opportunities": [{ "topic", "source_document_id", "why" }],
  "inaccuracies": [{ "topic", "source_document_id", "claim_quote", "correction" }]
}
```

**Anti-hallucinatie, hard afgedwongen in code (niet alleen in de prompt):**
- `source_document_id` moet bestaan in de meegegeven context → anders bevinding
  weggefilterd.
- `evidence_quote`/`claim_quote` wordt **programmatisch (fuzzy) geverifieerd
  tegen het transcript** → citaat niet gevonden = bevinding weggefilterd en
  gelogd. De LLM kan dus niets "vinden" dat niet in het gesprek zat.
- Promptregel: *"Beoordeel uitsluitend op basis van de meegeleverde
  bibliotheekpassages; gebruik géén eigen productkennis. Als de bibliotheek
  niets zegt over een onderwerp, beoordeel het niet."*

### 2.3 Inhaken in de bestaande run + opslag
In `conversationAnalysisService`, ná de summary-create en náást de operationele
stap (zelfde `!isNonSalesConversation`-tak):

```
gate:  company.has_knowledge_access && isLibraryFilled(companyId)
       && !geen_salesgesprek
run:   context ophalen → kennisanalyse-call → valideren/filteren
merge: aparte nullable Json-kolom  conversation_summaries_x.knowledge_analysis
fail:  try/catch → loggen → veld blijft null → verslag ongewijzigd
```

Opslag als **eigen nullable kolom** (migratie, 1 regel) i.p.v. in bestaande
Json-velden proppen: expliciet, geen kans op conflict met backend-consumers
van `phases`/`resistances`, en `null` = laag niet gedraaid (het "alleen wanneer
gevuld"-signaal voor de UI). Her-analyse via het bestaande
`reanalyze?force=true`-recept draait de laag automatisch mee.

### 2.4 UI — extra sectie in het bestaande gespreksverslag
Alleen renderen als `knowledge_analysis` niet null is (dus nooit een lege
sectie bij bedrijven zonder bibliotheek):
- **Tegel "Productkennis"** naast de bestaande tegels: dekking-score + 1-zin
  samenvatting.
- Uitklapbaar detail: per onderwerp wie het besprak (verkoper/klant/beiden/
  niemand), ✓/✗ correctheid, het transcript-citaat als bewijs, en een link
  naar het brondocument in de Kennisbibliotheek.
- **Gemiste kansen** en **onjuistheden** (met de juiste informatie uit de
  bibliotheek ernaast) — dit is de directe coaching-waarde.
- Mail en totaalscore blijven in fase 1 **ongewijzigd** (zie beslispunt 1/3).

---

## 3. Betrouwbaarheidsmaatregelen (samengevat)

1. **Nul impact op bestaande cijfers**: kennislaag beïnvloedt PICA/totaalscore
   NIET (eigen dekking-indicator). Reden: de score-historie is al gevoelig
   (score-knik bij de Sonnet-wissel); een nieuwe factor erin maakt trends
   onvergelijkbaar.
2. **Foutisolatie**: laag kan nooit de analyse, mail of dashboards blokkeren.
3. **Citaat- en bronverificatie in code** (2.2) — het sterkste middel tegen
   hallucinatie in deze laag.
4. **Tenant-isolatie**: uitsluitend bibliotheek van het bedrijf van de
   verkoper (bestaand `companyId`-patroon).
5. **Modelkeuze + kosten**: eigen picker "LMS: kennisanalyse" (hergebruik
   `LmsChatModelComponent`, key `lms_knowledge_litellm_model`), default =
   het hoofdanalysemodel; eigen kostentag (bv. `x-litellm-tags: knowledge`)
   zodat de kosten per laag zichtbaar zijn in LiteLLM.
6. **Taal**: verslagtaal van de gebruiker (`lang_code`), zoals de rest.
7. **Prompt-injection-guard**: transcript én bibliotheekdocumenten zijn
   untrusted data (bibliotheek is door klanten te vullen!) — bestaande
   `UNTRUSTED_CONTENT_GUARD` hergebruiken.

---

## 4. E2E-testplan (vóór oplevering te bewijzen)

| # | Scenario | Verwacht |
|---|---|---|
| 1 | Bedrijf mét gevulde bibliotheek (garantiedoc "24 mnd"), transcript waarin verkoper "12 maanden garantie" zegt | `inaccuracies` bevat de claim mét citaat + correctie "24 maanden" + bron |
| 2 | Transcript waarin klant naar levertijd vraagt en verkoper niet antwoordt (levertijd-doc aanwezig) | `missed_opportunities` bevat levertijd; `discussed_by: customer` |
| 3 | Gesprek zonder enige productinhoud | lage `coverage_score`, geen verzonnen bevindingen (citaatfilter aantoonbaar leeg) |
| 4 | Bedrijf zonder bibliotheek / `has_knowledge_access` uit | `knowledge_analysis` = null; verslag identiek aan vandaag; geen extra LLM-call |
| 5 | Kennisanalyse-call kunstmatig laten falen | analyse + mail + dashboards normaal; alleen de sectie ontbreekt; fout gelogd |
| 6 | `geen_salesgesprek` | laag overgeslagen |
| 7 | Reanalyze `?force=true` op bestaand gesprek | laag vult zich met terugwerkende kracht |

---

## 5. Fasering

- **Fase 0 — beslispunten** (hieronder) beslissen.
- **Fase 1 — retrieval**: `knowledgeContextService` (gevuld-check + top-N-context
  met bronlabels + fallback zonder embeddings).
- **Fase 2 — analyse-laag**: `knowledgeAnalysisService` + Zod-schema +
  citaat-/bronfilter + merge in de run + migratie `knowledge_analysis`-kolom.
- **Fase 3 — UI**: Productkennis-sectie in het gespreksverslag (conditioneel).
- **Fase 4 — beheer**: modelpicker "LMS: kennisanalyse" + kostentag.
- **Fase 5 — e2e**: testplan §4 volledig doorlopen op de lokale testomgeving.
- **Later (bewust buiten scope)**: passage-chunking van grote documenten,
  kennisdekking in mail, team-aggregatie in operationeel dashboard, en de
  koppeling "gemiste kennis → aanbevolen bibliotheekdocument/leermodule bij de
  aanbevelingen op /learning" (sluit de cirkel met het LMS).

## 6. Beslispunten (Fase 0)

1. **Score-invloed:** kennisdekking als eigen indicator (advies) of meewegen in
   de totaalscore? *Advies: niet meewegen — houdt trends vergelijkbaar.*
2. **Zichtbaarheid:** sectie voor iedereen die het verslag ziet (advies), of
   alleen manager/beheerder?
3. **Mail:** kennisbevindingen in de bestaande verslag-mail? *Advies fase 1:
   nee; later als aparte alinea.*
4. **Model:** eigen picker met default = hoofdanalysemodel (advies), of altijd
   vast het hoofdanalysemodel?
