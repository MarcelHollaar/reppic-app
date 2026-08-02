# AssemblyAI: keyterms + Universal-3.5 Pro — ontwerp & testplan

**Status:** ontwerp + testscript klaar. **Nog niet ingehaakt in productie.** Eerst
meten op echte opnames, dan pas inbouwen.

## Doel

De transcriptiekwaliteit verbeteren op precies het jargon waar onze analyse op
leunt — sales-fasenamen, **bedrijfsnaam** en **productnamen** — via
`keyterms_prompt` op het nieuwere **Universal-3.5 Pro**-model. Per gesprek
samengesteld, zodat elk bedrijf alleen zijn eigen relevante termen meekrijgt.

## Huidige situatie

`app/src/app/api/services/assemblyAIService.ts` dient in met alleen
`language_detection: true` + `speaker_labels: true`, **geen `speech_model`** (dus
account-default) en **geen keyterms**. Bevestigd op de recente Teams-opname:
`speech_model: None`, `language_code: nl`.

## Ontwerp

### Keyterms in twee lagen (hybride)

1. **Algemene basis** (voor álle bedrijven): de PICA-fasenamen + 15 subfase-labels
   uit `terminologyConcepts.ts` (`TERMINOLOGY_PHASES` / `TERMINOLOGY_TOPICS`
   `standardLabel`) + "Reppic". ± 20 termen, staat in code.
2. **Per bedrijf** (opgebouwd bij elke transcriptie, want we kennen het bedrijf
   via `conversation → user → company`):
   - **Bedrijfsnaam** — live uit `Company.name` (altijd actueel, ook na naamswijziging; geen aparte opslag nodig).
   - **Glossary-termen** — de waarden uit `CompanyTerminology.mapping` (het jargon dat het bedrijf zelf gebruikt).
   - **Productnamen** — NIEUW, per bedrijf (zie hieronder).

### Waar productnamen opslaan

**Aanbevolen:** `CompanyTerminology` uitbreiden met een veld `product_terms`
(string-array) en dat beheren in het **bestaande superadmin-terminologiescherm**.
Betrouwbaar en het past in UI die er al is.
Alternatief: automatisch afleiden uit het geüploade strategisch/operationeel plan
(propositie/product-velden) — minder betrouwbaar (fuzzy).

### Assemblagefunctie

`buildConversationKeyterms(companyId): string[]`
- verzamelt: basis + bedrijfsnaam + glossary-waarden + product_terms
- normaliseert: trim, dedupe (case-insensitief), leeg/te-kort (<2 tekens) eruit
- capt op bijv. **400** termen om relevantie te bewaren (harde limiet is 1.000 op Universal-3.5 Pro)

### Inhaken op de transcriptie

`submitTranscriptionWithWebhook(...)` krijgt een optionele `keyterms?: string[]`:
- `speech_model: "universal-3-pro"` (overweeg `universal-2` als fallback)
- `keyterms_prompt: keyterms` (alleen als niet leeg)
- `language_detection` + `speaker_labels` blijven staan

De aanroepers die transcriptie indienen (`conversations/merge-assemble-and-process`,
webhook `recall-sdk`, webhook `recall`) stellen de keyterms samen op basis van het
bedrijf van het gesprek en geven ze mee.

### Aandachtspunten

- **Verifiëren** dat `speaker_labels` blijft werken op `universal-3-pro` + `nl`.
  Bij auto-taaldetectie worden niet-ondersteunde features **stil weggelaten** — dat
  willen we niet ongemerkt (diarisatie is essentieel voor onze "Speaker A/B").
- **Kosten:** keyterms is een add-on van $0,05/uur.
- **Lean houden:** te veel of irrelevante termen verslechteren juist. Daarom per
  bedrijf, niet één globale lijst.
- `word_boost` **niet** gebruiken — afgeschaft en geweigerd door Universal-3.5 Pro;
  `keyterms_prompt` is de opvolger.

## Testplan (vóór inbouw)

1. Kies **2–3 echte NL-salesopnames** met bekend jargon/product-/bedrijfsnamen.
2. Transcribeer elke opname in **3 configuraties** via het testscript:
   - **A. Baseline** — huidige productie (default model, language_detection, speaker_labels)
   - **B. Universal-3.5 Pro** — alleen `speech_model`, geen keyterms
   - **C. Universal-3.5 Pro + keyterms** — basis + bedrijfsnaam + glossary + producten
3. Schrijf per opname vooraf een **checklist van verwachte termen** op (welke
   jargon-/product-/bedrijfsnamen komen echt voor). Tel juist/fout in A/B/C.
4. Controleer dat **Speaker-labels** in alle drie aanwezig zijn.
5. **Besluit:** configuratie C invoeren als de jargon-accuratesse duidelijk
   verbetert zonder de diarisatie te breken.

### Uitvoeren

Script: `app/scripts/assemblyai-keyterms-test.mjs` (dependency-vrij, leest
`ASSEMBLYAI_API_KEY` uit `app/.env`). Gebruik staat boven in het script.

> **Let op — audiobron:** AssemblyAI moet de audio zelf kunnen ophalen (publieke of
> geldig-gesignde URL). Recall-opname-URL's **verlopen**. Gebruik dus een **verse
> opname** of een audiobestand op je eigen FTP (`FTP_PUBLIC_URL`).

## Testresultaat (echte NL-opname, 16 min, 2026-08-02)

Gedraaid op een echte Nederlandse acquisitie-opname (`e8a07097…`) via het testscript.
Belangrijkste bevindingen:

- **Speaker-labels blijven behouden** op `universal-3-5-pro` + NL — het risico dat
  auto-taaldetectie diarisatie stil weglaat, is hiermee weerlegd. ✓
- **Model-upgrade (universal-2 → universal-3-5-pro) fixt echte garbles:**
  "Potsdamal" → "PostNL", "broodkopslag" → "bulkopslag", "waarhuis" → "warehouse",
  en de formatting is netter. Ook sneller (19s vs 25s).
- **Keyterms geeft gerichte extra winst** op precies de geboostte termen:
  "Post.nl" → **"PostNL"** (juiste merkschrijfwijze) en "Martina G." → **"Martijn Magé"**.
- **Geen wondermiddel:** bij slecht verstaanbare/overlappende telefonie blijven fouten
  bestaan; de naam "Gaia" ging in het nieuwe model juist verloren waar de baseline
  hem nog had. Verbetering, geen perfectie.
- De ruwe substring-telling in het script is indicatief; beoordeel kwalitatief op de
  specifieke eigennamen/merken.

**Conclusie:** duidelijke, zichtbare winst op de eigennamen waar de analyse op leunt.
Aanbeveling: doorzetten — `speech_models: ["universal-3-5-pro","universal-2"]` +
per-bedrijf keyterms.
