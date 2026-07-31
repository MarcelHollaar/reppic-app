#!/usr/bin/env node
/**
 * Vertaalsleutels voor de plan-structuur-review (Fase 2/3 plan-upload).
 * Idempotent, diep gemerged onder `plansReview`.
 */
const fs = require("fs");
const path = require("path");
const LOCALES_DIR = path.join(__dirname, "..", "public", "locales");
const LANGS = ["nl", "en", "de", "fr", "es", "it"];

const T = {
  "plansReview.reviewTitle": { nl: "Plan-structuur controleren", en: "Review plan structure", de: "Planstruktur prüfen", fr: "Vérifier la structure du plan", es: "Revisar la estructura del plan", it: "Verifica la struttura del piano" },
  "plansReview.manualTitle": { nl: "Plan handmatig invullen", en: "Enter plan manually", de: "Plan manuell eingeben", fr: "Saisir le plan manuellement", es: "Introducir el plan manualmente", it: "Inserisci il piano manualmente" },
  "plansReview.reviewIntro": { nl: "De AI heeft je plan omgezet naar een vaste structuur. Controleer en corrigeer waar nodig — pas na jouw bevestiging vergelijken de dashboards tegen deze structuur.", en: "The AI converted your plan into a fixed structure. Review and correct where needed — only after your confirmation do the dashboards compare against this structure.", de: "Die KI hat Ihren Plan in eine feste Struktur umgewandelt. Prüfen und korrigieren Sie bei Bedarf — erst nach Ihrer Bestätigung vergleichen die Dashboards mit dieser Struktur.", fr: "L'IA a converti votre plan en une structure fixe. Vérifiez et corrigez si nécessaire — ce n'est qu'après votre confirmation que les tableaux de bord comparent avec cette structure.", es: "La IA ha convertido tu plan en una estructura fija. Revisa y corrige donde sea necesario: solo tras tu confirmación los paneles comparan con esta estructura.", it: "L'IA ha convertito il tuo piano in una struttura fissa. Verifica e correggi dove necessario: solo dopo la tua conferma le dashboard confrontano con questa struttura." },
  "plansReview.manualIntro": { nl: "Geen document? Vul de doelen en targets hier direct in. Na opslaan vergelijken de dashboards de gesprekken met dit plan.", en: "No document? Enter the goals and targets directly here. After saving, the dashboards compare conversations against this plan.", de: "Kein Dokument? Geben Sie Ziele und Vorgaben hier direkt ein. Nach dem Speichern vergleichen die Dashboards die Gespräche mit diesem Plan.", fr: "Pas de document ? Saisissez les objectifs et cibles directement ici. Après l'enregistrement, les tableaux de bord comparent les conversations avec ce plan.", es: "¿Sin documento? Introduce los objetivos y metas directamente aquí. Tras guardar, los paneles comparan las conversaciones con este plan.", it: "Nessun documento? Inserisci obiettivi e target direttamente qui. Dopo il salvataggio, le dashboard confrontano le conversazioni con questo piano." },
  "plansReview.generating": { nl: "AI structureert je plan…", en: "AI is structuring your plan…", de: "KI strukturiert Ihren Plan…", fr: "L'IA structure votre plan…", es: "La IA está estructurando tu plan…", it: "L'IA sta strutturando il tuo piano…" },
  "plansReview.loading": { nl: "Structuur laden…", en: "Loading structure…", de: "Struktur wird geladen…", fr: "Chargement de la structure…", es: "Cargando estructura…", it: "Caricamento struttura…" },
  "plansReview.generateFailed": { nl: "Kon geen structuurvoorstel genereren", en: "Could not generate a structure proposal", de: "Es konnte kein Strukturvorschlag erstellt werden", fr: "Impossible de générer une proposition de structure", es: "No se pudo generar una propuesta de estructura", it: "Impossibile generare una proposta di struttura" },
  "plansReview.saveFailed": { nl: "Opslaan mislukt", en: "Saving failed", de: "Speichern fehlgeschlagen", fr: "Échec de l'enregistrement", es: "Error al guardar", it: "Salvataggio non riuscito" },
  "plansReview.confirm": { nl: "Bevestigen & activeren", en: "Confirm & activate", de: "Bestätigen & aktivieren", fr: "Confirmer et activer", es: "Confirmar y activar", it: "Conferma e attiva" },
  "plansReview.skip": { nl: "Overslaan — gebruik ruwe tekst", en: "Skip — use raw text", de: "Überspringen — Rohtext verwenden", fr: "Ignorer — utiliser le texte brut", es: "Omitir — usar texto sin procesar", it: "Salta — usa il testo grezzo" },
  "plansReview.cancel": { nl: "Annuleren", en: "Cancel", de: "Abbrechen", fr: "Annuler", es: "Cancelar", it: "Annulla" },
  "plansReview.regenerate": { nl: "Opnieuw genereren", en: "Regenerate", de: "Neu generieren", fr: "Régénérer", es: "Regenerar", it: "Rigenera" },
  "plansReview.statusConfirmed": { nl: "eerder bevestigd", en: "previously confirmed", de: "zuvor bestätigt", fr: "précédemment confirmé", es: "confirmado anteriormente", it: "precedentemente confermato" },
  "plansReview.confirmedSuccess": { nl: "Structuur bevestigd. Alle gesprekken worden opnieuw geanalyseerd met het gestructureerde plan.", en: "Structure confirmed. All conversations are being reanalyzed against the structured plan.", de: "Struktur bestätigt. Alle Gespräche werden mit dem strukturierten Plan neu analysiert.", fr: "Structure confirmée. Toutes les conversations sont réanalysées avec le plan structuré.", es: "Estructura confirmada. Todas las conversaciones se están reanalizando con el plan estructurado.", it: "Struttura confermata. Tutte le conversazioni vengono rianalizzate con il piano strutturato." },
  "plansReview.itemCount": { nl: "{{count}} onderdelen", en: "{{count}} items", de: "{{count}} Einträge", fr: "{{count}} éléments", es: "{{count}} elementos", it: "{{count}} elementi" },
  "plansReview.emptyWarning": { nl: "De AI herkende geen concrete doelen of KPI's in het document. Vul ze hieronder handmatig aan, of sla over om de ruwe tekst te gebruiken.", en: "The AI found no concrete goals or KPIs in the document. Add them manually below, or skip to use the raw text.", de: "Die KI hat keine konkreten Ziele oder KPIs im Dokument erkannt. Ergänzen Sie sie unten manuell oder überspringen Sie, um den Rohtext zu verwenden.", fr: "L'IA n'a trouvé aucun objectif ou KPI concret dans le document. Ajoutez-les manuellement ci-dessous, ou ignorez pour utiliser le texte brut.", es: "La IA no encontró objetivos o KPIs concretos en el documento. Añádelos manualmente abajo, u omite para usar el texto sin procesar.", it: "L'IA non ha trovato obiettivi o KPI concreti nel documento. Aggiungili manualmente qui sotto, oppure salta per usare il testo grezzo." },
  "plansReview.none": { nl: "— geen —", en: "— none —", de: "— keine —", fr: "— aucun —", es: "— ninguno —", it: "— nessuno —" },
  "plansReview.editStructure": { nl: "Structuur", en: "Structure", de: "Struktur", fr: "Structure", es: "Estructura", it: "Struttura" },
  "plansReview.offer": { nl: "Aanbevolen: laat AI het plan omzetten naar een vaste structuur (doelen, KPI's, kernboodschappen) en controleer het resultaat. Dat maakt de vergelijking in de dashboards consistenter en format-onafhankelijk.", en: "Recommended: let AI convert the plan into a fixed structure (goals, KPIs, key messages) and review the result. This makes the dashboard comparison more consistent and format-independent.", de: "Empfohlen: Lassen Sie die KI den Plan in eine feste Struktur (Ziele, KPIs, Kernbotschaften) umwandeln und prüfen Sie das Ergebnis. Das macht den Dashboard-Vergleich konsistenter und formatunabhängig.", fr: "Recommandé : laissez l'IA convertir le plan en une structure fixe (objectifs, KPIs, messages clés) et vérifiez le résultat. La comparaison des tableaux de bord devient plus cohérente et indépendante du format.", es: "Recomendado: deja que la IA convierta el plan en una estructura fija (objetivos, KPIs, mensajes clave) y revisa el resultado. Así la comparación de los paneles es más consistente e independiente del formato.", it: "Consigliato: lascia che l'IA converta il piano in una struttura fissa (obiettivi, KPI, messaggi chiave) e verifica il risultato. Il confronto nelle dashboard diventa più coerente e indipendente dal formato." },
  "plansReview.offerAccept": { nl: "Structureren met AI", en: "Structure with AI", de: "Mit KI strukturieren", fr: "Structurer avec l'IA", es: "Estructurar con IA", it: "Struttura con l'IA" },
  "plansReview.offerSkip": { nl: "Niet nu", en: "Not now", de: "Nicht jetzt", fr: "Pas maintenant", es: "Ahora no", it: "Non ora" },
  "plansReview.manualLink": { nl: "Geen document? Vul het plan handmatig in", en: "No document? Enter the plan manually", de: "Kein Dokument? Plan manuell eingeben", fr: "Pas de document ? Saisir le plan manuellement", es: "¿Sin documento? Introduce el plan manualmente", it: "Nessun documento? Inserisci il piano manualmente" },
  "plansReview.manualFilename": { nl: "Handmatig ingevoerd plan", en: "Manually entered plan", de: "Manuell eingegebener Plan", fr: "Plan saisi manuellement", es: "Plan introducido manualmente", it: "Piano inserito manualmente" },

  // ── sectie-labels ──
  "plansReview.objectives": { nl: "Doelstellingen", en: "Objectives", de: "Ziele", fr: "Objectifs", es: "Objetivos", it: "Obiettivi" },
  "plansReview.objectiveTitle": { nl: "Titel van de doelstelling", en: "Objective title", de: "Titel des Ziels", fr: "Titre de l'objectif", es: "Título del objetivo", it: "Titolo dell'obiettivo" },
  "plansReview.objectiveDesc": { nl: "Toelichting (optioneel)", en: "Description (optional)", de: "Erläuterung (optional)", fr: "Description (facultatif)", es: "Descripción (opcional)", it: "Descrizione (facoltativa)" },
  "plansReview.kpis": { nl: "KPI's", en: "KPIs", de: "KPIs", fr: "KPIs", es: "KPIs", it: "KPI" },
  "plansReview.kpi_name": { nl: "KPI", en: "KPI", de: "KPI", fr: "KPI", es: "KPI", it: "KPI" },
  "plansReview.kpi_target": { nl: "Target", en: "Target", de: "Zielwert", fr: "Cible", es: "Meta", it: "Target" },
  "plansReview.kpi_unit": { nl: "Eenheid", en: "Unit", de: "Einheit", fr: "Unité", es: "Unidad", it: "Unità" },
  "plansReview.kpi_period": { nl: "Periode", en: "Period", de: "Zeitraum", fr: "Période", es: "Periodo", it: "Periodo" },
  "plansReview.keyMessages": { nl: "Kernboodschappen", en: "Key messages", de: "Kernbotschaften", fr: "Messages clés", es: "Mensajes clave", it: "Messaggi chiave" },
  "plansReview.keyMessagePlaceholder": { nl: "Kernboodschap of propositie-element", en: "Key message or proposition element", de: "Kernbotschaft oder Angebotselement", fr: "Message clé ou élément de proposition", es: "Mensaje clave o elemento de propuesta", it: "Messaggio chiave o elemento di proposta" },
  "plansReview.targetSegments": { nl: "Doelsegmenten", en: "Target segments", de: "Zielsegmente", fr: "Segments cibles", es: "Segmentos objetivo", it: "Segmenti target" },
  "plansReview.segmentPlaceholder": { nl: "Doelgroep of segment", en: "Target group or segment", de: "Zielgruppe oder Segment", fr: "Groupe cible ou segment", es: "Grupo objetivo o segmento", it: "Gruppo target o segmento" },
  "plansReview.competitivePosition": { nl: "Concurrentiepositie", en: "Competitive position", de: "Wettbewerbsposition", fr: "Position concurrentielle", es: "Posición competitiva", it: "Posizione competitiva" },
  "plansReview.otherNotes": { nl: "Overige notities", en: "Other notes", de: "Sonstige Notizen", fr: "Autres notes", es: "Otras notas", it: "Altre note" },
  "plansReview.picaTargets": { nl: "Doelen per gespreksfase", en: "Goals per conversation phase", de: "Ziele pro Gesprächsphase", fr: "Objectifs par phase de conversation", es: "Objetivos por fase de conversación", it: "Obiettivi per fase di conversazione" },
  "plansReview.focusPointPlaceholder": { nl: "Focuspunt voor deze fase", en: "Focus point for this phase", de: "Fokuspunkt für diese Phase", fr: "Point d'attention pour cette phase", es: "Punto de enfoque para esta fase", it: "Punto di focus per questa fase" },
  "plansReview.skillTargets": { nl: "Vaardigheidsdoelen", en: "Skill targets", de: "Kompetenzziele", fr: "Objectifs de compétences", es: "Objetivos de habilidades", it: "Obiettivi di competenza" },
  "plansReview.skill_skill": { nl: "Vaardigheid", en: "Skill", de: "Kompetenz", fr: "Compétence", es: "Habilidad", it: "Competenza" },
  "plansReview.skill_target": { nl: "Target", en: "Target", de: "Zielwert", fr: "Cible", es: "Meta", it: "Target" },
  "plansReview.skill_description": { nl: "Toelichting", en: "Description", de: "Erläuterung", fr: "Description", es: "Descripción", it: "Descrizione" },
  "plansReview.benchmarks": { nl: "Benchmarks", en: "Benchmarks", de: "Benchmarks", fr: "Benchmarks", es: "Benchmarks", it: "Benchmark" },
  "plansReview.benchmark_metric": { nl: "Indicator", en: "Metric", de: "Kennzahl", fr: "Indicateur", es: "Indicador", it: "Indicatore" },
  "plansReview.benchmark_target": { nl: "Target", en: "Target", de: "Zielwert", fr: "Cible", es: "Meta", it: "Target" },
  "plansReview.benchmark_unit": { nl: "Eenheid", en: "Unit", de: "Einheit", fr: "Unité", es: "Unidad", it: "Unità" },
  "plansReview.focusAreas": { nl: "Speerpunten", en: "Focus areas", de: "Schwerpunkte", fr: "Priorités", es: "Áreas de enfoque", it: "Aree di focus" },
  "plansReview.focusAreaPlaceholder": { nl: "Speerpunt van deze periode", en: "Focus area for this period", de: "Schwerpunkt dieser Periode", fr: "Priorité de cette période", es: "Área de enfoque de este periodo", it: "Area di focus di questo periodo" },
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
