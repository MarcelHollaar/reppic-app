#!/usr/bin/env node
/**
 * Voegt alle dashboard-vertaalsleutels toe aan de 6 taalbestanden.
 * Idempotent en diep gemerged onder `dashboards`. Bestaande niet-genoemde
 * sleutels blijven ongemoeid.
 */
const fs = require("fs");
const path = require("path");
const LOCALES_DIR = path.join(__dirname, "..", "public", "locales");
const LANGS = ["nl", "en", "de", "fr", "es", "it"];

// key => { nl, en, de, fr, es, it }
const T = {
  // ── PICA-tegel (persoonlijk + operationeel) ──
  "dashboards.avgPicaScore": { nl: "Gemiddelde PICA score", en: "Average PICA score", de: "Durchschnittlicher PICA-Score", fr: "Score PICA moyen", es: "Puntuación PICA media", it: "Punteggio PICA medio" },
  "dashboards.phase": { nl: "Fase", en: "Phase", de: "Phase", fr: "Phase", es: "Fase", it: "Fase" },
  "dashboards.picaPhases.proposition": { nl: "Propositie", en: "Proposition", de: "Wertversprechen", fr: "Proposition", es: "Propuesta", it: "Proposta" },
  "dashboards.picaPhases.inventory": { nl: "Inventarisatie", en: "Investigation", de: "Bestandsaufnahme", fr: "Investigation", es: "Investigación", it: "Rilevazione" },
  "dashboards.picaPhases.conviction": { nl: "Overtuiging", en: "Conviction", de: "Überzeugung", fr: "Conviction", es: "Persuasión", it: "Persuasione" },
  "dashboards.picaPhases.closing": { nl: "Afsluiting", en: "Closing", de: "Abschluss", fr: "Conclusion", es: "Cierre", it: "Chiusura" },
  "dashboards.picaMetrics.breakTheIce": { nl: "IJsbreken", en: "Breaking the ice", de: "Eis brechen", fr: "Briser la glace", es: "Romper el hielo", it: "Rompere il ghiaccio" },
  "dashboards.picaMetrics.salesPitch": { nl: "Pitch", en: "Pitch", de: "Pitch", fr: "Pitch", es: "Pitch", it: "Pitch" },
  "dashboards.picaMetrics.goalQuestion": { nl: "Doelvraag", en: "Goal question", de: "Zielfrage", fr: "Question d'objectif", es: "Pregunta de objetivo", it: "Domanda obiettivo" },
  "dashboards.picaMetrics.expectationMgt": { nl: "Verwachtingen managen", en: "Managing expectations", de: "Erwartungsmanagement", fr: "Gestion des attentes", es: "Gestión de expectativas", it: "Gestione delle aspettative" },
  "dashboards.picaMetrics.contactPerson": { nl: "Gesprekspartner", en: "Contact person", de: "Gesprächspartner", fr: "Interlocuteur", es: "Interlocutor", it: "Interlocutore" },
  "dashboards.picaMetrics.company": { nl: "Bedrijf", en: "Company", de: "Unternehmen", fr: "Entreprise", es: "Empresa", it: "Azienda" },
  "dashboards.picaMetrics.cooperation": { nl: "Samenwerking", en: "Cooperation", de: "Zusammenarbeit", fr: "Coopération", es: "Cooperación", it: "Collaborazione" },
  "dashboards.picaMetrics.consequences": { nl: "Gevolgen", en: "Consequences", de: "Konsequenzen", fr: "Conséquences", es: "Consecuencias", it: "Conseguenze" },
  "dashboards.picaMetrics.cure": { nl: "Oplossing", en: "Solution", de: "Lösung", fr: "Solution", es: "Solución", it: "Soluzione" },
  "dashboards.picaMetrics.deepQuestioning": { nl: "Doorvragen", en: "Deep questioning", de: "Nachfragen", fr: "Questionnement approfondi", es: "Preguntas en profundidad", it: "Approfondimento" },
  "dashboards.picaMetrics.customerType": { nl: "Klantprofiel", en: "Customer profile", de: "Kundenprofil", fr: "Profil client", es: "Perfil del cliente", it: "Profilo cliente" },
  "dashboards.picaMetrics.uspUbrLink": { nl: "USP-koppeling", en: "USP link", de: "USP-Verknüpfung", fr: "Lien USP", es: "Vínculo USP", it: "Collegamento USP" },
  "dashboards.picaMetrics.result": { nl: "Resultaat", en: "Result", de: "Ergebnis", fr: "Résultat", es: "Resultado", it: "Risultato" },
  "dashboards.picaMetrics.acknowledgement": { nl: "Bevestiging", en: "Acknowledgement", de: "Bestätigung", fr: "Confirmation", es: "Confirmación", it: "Conferma" },
  "dashboards.picaMetrics.agreement": { nl: "Concrete afspraak", en: "Concrete agreement", de: "Konkrete Vereinbarung", fr: "Accord concret", es: "Acuerdo concreto", it: "Accordo concreto" },

  // ── Headers / knoppen / upload-modals ──
  "dashboards.subtitle": { nl: "Inzichten uit verkoopgesprekken", en: "Insights from sales conversations", de: "Erkenntnisse aus Verkaufsgesprächen", fr: "Analyses des conversations commerciales", es: "Perspectivas de las conversaciones de ventas", it: "Approfondimenti dalle conversazioni di vendita" },
  "dashboards.salesPlan": { nl: "Salesplan", en: "Sales plan", de: "Vertriebsplan", fr: "Plan de vente", es: "Plan de ventas", it: "Piano di vendita" },
  "dashboards.strategicPlan": { nl: "Strategisch Plan", en: "Strategic plan", de: "Strategieplan", fr: "Plan stratégique", es: "Plan estratégico", it: "Piano strategico" },
  "dashboards.uploadSalesPlanTitle": { nl: "Salesplan uploaden", en: "Upload sales plan", de: "Vertriebsplan hochladen", fr: "Téléverser le plan de vente", es: "Subir plan de ventas", it: "Carica piano di vendita" },
  "dashboards.uploadStrategicPlanTitle": { nl: "Strategisch Plan uploaden", en: "Upload strategic plan", de: "Strategieplan hochladen", fr: "Téléverser le plan stratégique", es: "Subir plan estratégico", it: "Carica piano strategico" },
  "dashboards.uploadSalesPlanDesc": { nl: "Upload een PDF of tekstbestand met het salesplan. Dit wordt gebruikt als referentie bij de analyse.", en: "Upload a PDF or text file with the sales plan. It is used as a reference during analysis.", de: "Laden Sie eine PDF- oder Textdatei mit dem Vertriebsplan hoch. Sie dient als Referenz bei der Analyse.", fr: "Téléversez un fichier PDF ou texte contenant le plan de vente. Il sert de référence lors de l'analyse.", es: "Sube un archivo PDF o de texto con el plan de ventas. Se usa como referencia en el análisis.", it: "Carica un file PDF o di testo con il piano di vendita. Viene usato come riferimento nell'analisi." },
  "dashboards.uploadStrategicPlanDesc": { nl: "Upload een PDF of tekstbestand met het strategisch plan. Dit wordt gebruikt als referentie bij de analyse.", en: "Upload a PDF or text file with the strategic plan. It is used as a reference during analysis.", de: "Laden Sie eine PDF- oder Textdatei mit dem Strategieplan hoch. Sie dient als Referenz bei der Analyse.", fr: "Téléversez un fichier PDF ou texte contenant le plan stratégique. Il sert de référence lors de l'analyse.", es: "Sube un archivo PDF o de texto con el plan estratégico. Se usa como referencia en el análisis.", it: "Carica un file PDF o di testo con il piano strategico. Viene usato come riferimento nell'analisi." },

  // ── Conclusie-titels ──
  "dashboards.conclusions.pica": { nl: "Operationele Conclusie — PICA", en: "Operational Conclusion — PICA", de: "Operative Schlussfolgerung — PICA", fr: "Conclusion opérationnelle — PICA", es: "Conclusión operativa — PICA", it: "Conclusione operativa — PICA" },
  "dashboards.conclusions.resistance": { nl: "Operationele Conclusie — Weerstand & Behoeften", en: "Operational Conclusion — Resistance & Needs", de: "Operative Schlussfolgerung — Widerstand & Bedürfnisse", fr: "Conclusion opérationnelle — Résistance et besoins", es: "Conclusión operativa — Resistencia y necesidades", it: "Conclusione operativa — Resistenza e bisogni" },
  "dashboards.conclusions.nextSteps": { nl: "Operationele Conclusie — Vervolgstap Discipline", en: "Operational Conclusion — Next-Step Discipline", de: "Operative Schlussfolgerung — Folgeschritt-Disziplin", fr: "Conclusion opérationnelle — Discipline de suivi", es: "Conclusión operativa — Disciplina de seguimiento", it: "Conclusione operativa — Disciplina del passo successivo" },
  "dashboards.conclusions.dmu": { nl: "DMU Conclusie", en: "DMU Conclusion", de: "DMU-Schlussfolgerung", fr: "Conclusion DMU", es: "Conclusión DMU", it: "Conclusione DMU" },
  "dashboards.conclusions.trends": { nl: "Strategische Conclusie — Trends", en: "Strategic Conclusion — Trends", de: "Strategische Schlussfolgerung — Trends", fr: "Conclusion stratégique — Tendances", es: "Conclusión estratégica — Tendencias", it: "Conclusione strategica — Tendenze" },
  "dashboards.conclusions.customerSatisfaction": { nl: "Strategische Conclusie — Klanttevredenheid", en: "Strategic Conclusion — Customer Satisfaction", de: "Strategische Schlussfolgerung — Kundenzufriedenheit", fr: "Conclusion stratégique — Satisfaction client", es: "Conclusión estratégica — Satisfacción del cliente", it: "Conclusione strategica — Soddisfazione del cliente" },
  "dashboards.conclusions.competition": { nl: "Strategische Conclusie — Concurrentie", en: "Strategic Conclusion — Competition", de: "Strategische Schlussfolgerung — Wettbewerb", fr: "Conclusion stratégique — Concurrence", es: "Conclusión estratégica — Competencia", it: "Conclusione strategica — Concorrenza" },
  "dashboards.conclusions.proposition": { nl: "Strategische Conclusie — Propositie", en: "Strategic Conclusion — Proposition", de: "Strategische Schlussfolgerung — Wertversprechen", fr: "Conclusion stratégique — Proposition", es: "Conclusión estratégica — Propuesta", it: "Conclusione strategica — Proposta" },
  "dashboards.conclusions.default": { nl: "Vergelijkende Conclusie", en: "Comparative Conclusion", de: "Vergleichende Schlussfolgerung", fr: "Conclusion comparative", es: "Conclusión comparativa", it: "Conclusione comparativa" },

  // ── Trend-groepen ──
  "dashboards.trendGroups.relational": { nl: "Relationeel", en: "Relational", de: "Relational", fr: "Relationnel", es: "Relacional", it: "Relazionale" },
  "dashboards.trendGroups.functional": { nl: "Functioneel", en: "Functional", de: "Funktional", fr: "Fonctionnel", es: "Funcional", it: "Funzionale" },
  "dashboards.trendGroups.financial": { nl: "Financieel", en: "Financial", de: "Finanziell", fr: "Financier", es: "Financiero", it: "Finanziario" },
  "dashboards.trendGroups.organizational": { nl: "Organisatorisch", en: "Organizational", de: "Organisatorisch", fr: "Organisationnel", es: "Organizativo", it: "Organizzativo" },
  "dashboards.trendGroups.strategic": { nl: "Strategisch", en: "Strategic", de: "Strategisch", fr: "Stratégique", es: "Estratégico", it: "Strategico" },
  "dashboards.trendGroups.urgency": { nl: "Urgentie", en: "Urgency", de: "Dringlichkeit", fr: "Urgence", es: "Urgencia", it: "Urgenza" },

  // ── Metric-/kaarttitels ──
  "dashboards.metrics.totalNeeds": { nl: "Totale behoeften", en: "Total needs", de: "Gesamtbedarf", fr: "Besoins totaux", es: "Necesidades totales", it: "Bisogni totali" },
  "dashboards.metrics.categories": { nl: "Categorieën", en: "Categories", de: "Kategorien", fr: "Catégories", es: "Categorías", it: "Categorie" },
  "dashboards.metrics.newNeeds": { nl: "Nieuwe behoeften", en: "New needs", de: "Neue Bedürfnisse", fr: "Nouveaux besoins", es: "Nuevas necesidades", it: "Nuovi bisogni" },
  "dashboards.metrics.knownNeeds": { nl: "Bekende behoeften", en: "Known needs", de: "Bekannte Bedürfnisse", fr: "Besoins connus", es: "Necesidades conocidas", it: "Bisogni noti" },
  "dashboards.metrics.distributionPerGroup": { nl: "Verdeling per groep", en: "Distribution per group", de: "Verteilung pro Gruppe", fr: "Répartition par groupe", es: "Distribución por grupo", it: "Distribuzione per gruppo" },
  "dashboards.metrics.positiveSentiment": { nl: "Positief sentiment", en: "Positive sentiment", de: "Positive Stimmung", fr: "Sentiment positif", es: "Sentimiento positivo", it: "Sentiment positivo" },
  "dashboards.metrics.totalConversations": { nl: "Totaal gesprekken", en: "Total conversations", de: "Gespräche gesamt", fr: "Total des conversations", es: "Total de conversaciones", it: "Conversazioni totali" },
  "dashboards.metrics.reportedIssues": { nl: "Gemelde issues", en: "Reported issues", de: "Gemeldete Probleme", fr: "Problèmes signalés", es: "Problemas reportados", it: "Problemi segnalati" },
  "dashboards.metrics.sentimentDistribution": { nl: "Sentimentverdeling", en: "Sentiment distribution", de: "Stimmungsverteilung", fr: "Répartition du sentiment", es: "Distribución del sentimiento", it: "Distribuzione del sentiment" },
  "dashboards.metrics.topIssues": { nl: "Top issues", en: "Top issues", de: "Top-Probleme", fr: "Principaux problèmes", es: "Principales problemas", it: "Problemi principali" },
  "dashboards.metrics.mostMentioned": { nl: "Meest genoemde", en: "Most mentioned", de: "Meistgenannt", fr: "Le plus mentionné", es: "Más mencionado", it: "Più menzionato" },
  "dashboards.metrics.mostMentionedCompetitor": { nl: "Meest genoemde concurrent", en: "Most mentioned competitor", de: "Meistgenannter Wettbewerber", fr: "Concurrent le plus mentionné", es: "Competidor más mencionado", it: "Concorrente più menzionato" },
  "dashboards.metrics.totalMentions": { nl: "Totale vermeldingen", en: "Total mentions", de: "Erwähnungen gesamt", fr: "Total des mentions", es: "Total de menciones", it: "Menzioni totali" },
  "dashboards.metrics.uniqueCompetitors": { nl: "Unieke concurrenten", en: "Unique competitors", de: "Einzigartige Wettbewerber", fr: "Concurrents uniques", es: "Competidores únicos", it: "Concorrenti unici" },
  "dashboards.metrics.competitorsShare": { nl: "Concurrenten (aandeel)", en: "Competitors (share)", de: "Wettbewerber (Anteil)", fr: "Concurrents (part)", es: "Competidores (cuota)", it: "Concorrenti (quota)" },
  "dashboards.metrics.strengthsVsCompetition": { nl: "Sterke punten vs. concurrentie", en: "Strengths vs. competition", de: "Stärken vs. Wettbewerb", fr: "Points forts vs concurrence", es: "Fortalezas vs. competencia", it: "Punti di forza vs concorrenza" },
  "dashboards.metrics.ownStrengthsVsCompetition": { nl: "Eigen sterke punten vs. concurrentie", en: "Own strengths vs. competition", de: "Eigene Stärken vs. Wettbewerb", fr: "Points forts propres vs concurrence", es: "Fortalezas propias vs. competencia", it: "Punti di forza propri vs concorrenza" },
  "dashboards.metrics.allCompetitors": { nl: "Alle concurrenten", en: "All competitors", de: "Alle Wettbewerber", fr: "Tous les concurrents", es: "Todos los competidores", it: "Tutti i concorrenti" },
  "dashboards.metrics.communicatedElements": { nl: "Gecommuniceerde elementen", en: "Communicated elements", de: "Kommunizierte Elemente", fr: "Éléments communiqués", es: "Elementos comunicados", it: "Elementi comunicati" },
  "dashboards.metrics.resonatedWithCustomer": { nl: "Resoneerde bij klant", en: "Resonated with customer", de: "Beim Kunden angekommen", fr: "A résonné chez le client", es: "Resonó con el cliente", it: "Ha avuto risonanza col cliente" },
  "dashboards.metrics.strongestResonance": { nl: "Sterkste resonantie", en: "Strongest resonance", de: "Stärkste Resonanz", fr: "Résonance la plus forte", es: "Mayor resonancia", it: "Risonanza più forte" },
  "dashboards.metrics.communicatedProposition": { nl: "Gecommuniceerde propositie", en: "Communicated proposition", de: "Kommuniziertes Wertversprechen", fr: "Proposition communiquée", es: "Propuesta comunicada", it: "Proposta comunicata" },
  "dashboards.metrics.resonanceWithCustomer": { nl: "Resonantie bij klant", en: "Resonance with customer", de: "Resonanz beim Kunden", fr: "Résonance chez le client", es: "Resonancia con el cliente", it: "Risonanza col cliente" },
  "dashboards.metrics.mostCommonResistance": { nl: "Meest voorkomende weerstand", en: "Most common resistance", de: "Häufigster Widerstand", fr: "Résistance la plus courante", es: "Resistencia más común", it: "Resistenza più comune" },
  "dashboards.metrics.totalResistances": { nl: "Totaal weerstanden", en: "Total resistances", de: "Widerstände gesamt", fr: "Total des résistances", es: "Total de resistencias", it: "Resistenze totali" },
  "dashboards.metrics.strongestTrigger": { nl: "Sterkste commerciële trigger", en: "Strongest commercial trigger", de: "Stärkster kommerzieller Trigger", fr: "Déclencheur commercial le plus fort", es: "Detonante comercial más fuerte", it: "Leva commerciale più forte" },
  "dashboards.metrics.topResistances": { nl: "Top weerstanden", en: "Top resistances", de: "Top-Widerstände", fr: "Principales résistances", es: "Principales resistencias", it: "Resistenze principali" },
  "dashboards.metrics.commercialTriggers": { nl: "Commerciële triggers", en: "Commercial triggers", de: "Kommerzielle Trigger", fr: "Déclencheurs commerciaux", es: "Detonantes comerciales", it: "Leve commerciali" },
  "dashboards.metrics.withClearNextStep": { nl: "Met duidelijke vervolgstap", en: "With clear next step", de: "Mit klarem Folgeschritt", fr: "Avec étape suivante claire", es: "Con siguiente paso claro", it: "Con passo successivo chiaro" },
  "dashboards.metrics.avgClarity": { nl: "Gemiddelde helderheid", en: "Average clarity", de: "Durchschnittliche Klarheit", fr: "Clarté moyenne", es: "Claridad media", it: "Chiarezza media" },
  "dashboards.metrics.nextStepTypes": { nl: "Types vervolgstappen", en: "Next-step types", de: "Arten von Folgeschritten", fr: "Types d'étapes suivantes", es: "Tipos de siguiente paso", it: "Tipi di passo successivo" },
  "dashboards.metrics.nextStepDiscipline": { nl: "Vervolgstap discipline", en: "Next-step discipline", de: "Folgeschritt-Disziplin", fr: "Discipline de suivi", es: "Disciplina de seguimiento", it: "Disciplina del passo successivo" },
  "dashboards.metrics.nextStepTypesAbsolute": { nl: "Types vervolgstappen (absoluut)", en: "Next-step types (absolute)", de: "Arten von Folgeschritten (absolut)", fr: "Types d'étapes suivantes (absolu)", es: "Tipos de siguiente paso (absoluto)", it: "Tipi di passo successivo (assoluto)" },
  "dashboards.metrics.nextStepDisciplinePct": { nl: "Vervolgstap discipline (%)", en: "Next-step discipline (%)", de: "Folgeschritt-Disziplin (%)", fr: "Discipline de suivi (%)", es: "Disciplina de seguimiento (%)", it: "Disciplina del passo successivo (%)" },

  // ── DMU ──
  "dashboards.dmu.insights": { nl: "DMU-inzichten", en: "DMU insights", de: "DMU-Erkenntnisse", fr: "Analyses DMU", es: "Perspectivas DMU", it: "Approfondimenti DMU" },
  "dashboards.dmu.subtitle": { nl: "Besluitvormingsunit — helderheid en betrokkenheid", en: "Decision-making unit — clarity and involvement", de: "Entscheidungsgremium — Klarheit und Einbindung", fr: "Unité de décision — clarté et implication", es: "Unidad de decisión — claridad e implicación", it: "Unità decisionale — chiarezza e coinvolgimento" },
  "dashboards.dmu.clarityScore": { nl: "DMU-helderheidsscore", en: "DMU clarity score", de: "DMU-Klarheitswert", fr: "Score de clarté DMU", es: "Puntuación de claridad DMU", it: "Punteggio di chiarezza DMU" },
  "dashboards.dmu.mentioned": { nl: "DMU vermeld", en: "DMU mentioned", de: "DMU erwähnt", fr: "DMU mentionné", es: "DMU mencionado", it: "DMU menzionato" },
  "dashboards.dmu.processClear": { nl: "Besluitproces helder", en: "Decision process clear", de: "Entscheidungsprozess klar", fr: "Processus de décision clair", es: "Proceso de decisión claro", it: "Processo decisionale chiaro" },

  // ── Statussen / waarden ──
  "dashboards.states.noData": { nl: "Nog geen data. Upload transcripties om inzichten te zien.", en: "No data yet. Upload transcripts to see insights.", de: "Noch keine Daten. Laden Sie Transkripte hoch, um Erkenntnisse zu sehen.", fr: "Aucune donnée. Téléversez des transcriptions pour voir les analyses.", es: "Aún no hay datos. Sube transcripciones para ver perspectivas.", it: "Ancora nessun dato. Carica le trascrizioni per vedere gli approfondimenti." },
  "dashboards.states.loadError": { nl: "Fout bij laden", en: "Loading error", de: "Fehler beim Laden", fr: "Erreur de chargement", es: "Error al cargar", it: "Errore di caricamento" },
  "dashboards.states.noAnalyzedConversations": { nl: "Nog geen geanalyseerde gesprekken beschikbaar.", en: "No analyzed conversations available yet.", de: "Noch keine analysierten Gespräche verfügbar.", fr: "Aucune conversation analysée disponible pour le moment.", es: "Aún no hay conversaciones analizadas disponibles.", it: "Nessuna conversazione analizzata disponibile." },
  "dashboards.values.yes": { nl: "Ja", en: "Yes", de: "Ja", fr: "Oui", es: "Sí", it: "Sì" },
  "dashboards.values.no": { nl: "Nee", en: "No", de: "Nein", fr: "Non", es: "No", it: "No" },
  "dashboards.values.clear": { nl: "Helder", en: "Clear", de: "Klar", fr: "Clair", es: "Claro", it: "Chiaro" },
  "dashboards.values.unclear": { nl: "Onduidelijk", en: "Unclear", de: "Unklar", fr: "Peu clair", es: "Poco claro", it: "Non chiaro" },
  "dashboards.vsLastYear": { nl: "vs vorig jaar", en: "vs last year", de: "vs. Vorjahr", fr: "vs l'an dernier", es: "vs año anterior", it: "vs anno scorso" },
  "dashboards.salesPhases": { nl: "Salesfases", en: "Sales phases", de: "Vertriebsphasen", fr: "Phases de vente", es: "Fases de venta", it: "Fasi di vendita" },
  "dashboards.states.notLoggedIn": { nl: "Niet ingelogd", en: "Not logged in", de: "Nicht angemeldet", fr: "Non connecté", es: "No has iniciado sesión", it: "Non hai effettuato l'accesso" },
  "dashboards.states.phaseDataError": { nl: "Kon fase-data niet laden", en: "Could not load phase data", de: "Phasendaten konnten nicht geladen werden", fr: "Impossible de charger les données de phase", es: "No se pudieron cargar los datos de fase", it: "Impossibile caricare i dati di fase" },

  // ── ConclusionCard (plan-badge + lege staten) ──
  "dashboards.planActive": { nl: "Plan actief", en: "Plan active", de: "Plan aktiv", fr: "Plan actif", es: "Plan activo", it: "Piano attivo" },
  "dashboards.planInactive": { nl: "Geen plan", en: "No plan", de: "Kein Plan", fr: "Aucun plan", es: "Sin plan", it: "Nessun piano" },
  "dashboards.emptyWithPlan": { nl: "Upload en analyseer transcripties om een vergelijkende conclusie te zien. Het plan is actief.", en: "Upload and analyze transcripts to see a comparative conclusion. The plan is active.", de: "Laden Sie Transkripte hoch und analysieren Sie sie, um eine vergleichende Schlussfolgerung zu sehen. Der Plan ist aktiv.", fr: "Téléversez et analysez des transcriptions pour voir une conclusion comparative. Le plan est actif.", es: "Sube y analiza transcripciones para ver una conclusión comparativa. El plan está activo.", it: "Carica e analizza le trascrizioni per vedere una conclusione comparativa. Il piano è attivo." },
  "dashboards.emptyNoPlan": { nl: "Upload transcripties en een plan om een vergelijkende conclusie te genereren.", en: "Upload transcripts and a plan to generate a comparative conclusion.", de: "Laden Sie Transkripte und einen Plan hoch, um eine vergleichende Schlussfolgerung zu erstellen.", fr: "Téléversez des transcriptions et un plan pour générer une conclusion comparative.", es: "Sube transcripciones y un plan para generar una conclusión comparativa.", it: "Carica trascrizioni e un piano per generare una conclusione comparativa." },
};

function setDeep(obj, dottedKey, value) {
  const parts = dottedKey.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== "object" || cur[parts[i]] === null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

for (const lang of LANGS) {
  const file = path.join(LOCALES_DIR, lang, "common.json");
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  let count = 0;
  for (const [key, vals] of Object.entries(T)) {
    if (vals[lang] === undefined) continue;
    setDeep(json, key, vals[lang]);
    count++;
  }
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + "\n", "utf8");
  console.log(`${lang}: ${count} sleutels gezet`);
}
console.log("Klaar.");
