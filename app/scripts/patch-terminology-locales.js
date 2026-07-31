#!/usr/bin/env node
/**
 * Voegt de vertaalsleutels voor het superadmin-terminologiescherm toe aan de
 * 6 taalbestanden. Idempotent en diep gemerged onder `terminology`.
 */
const fs = require("fs");
const path = require("path");
const LOCALES_DIR = path.join(__dirname, "..", "public", "locales");
const LANGS = ["nl", "en", "de", "fr", "es", "it"];

// key => { nl, en, de, fr, es, it }
const T = {
  "terminology.navTitle": { nl: "Terminologie", en: "Terminology", de: "Terminologie", fr: "Terminologie", es: "Terminología", it: "Terminologia" },
  "terminology.title": { nl: "Bedrijfsterminologie", en: "Company terminology", de: "Unternehmensterminologie", fr: "Terminologie de l'entreprise", es: "Terminología de la empresa", it: "Terminologia aziendale" },
  "terminology.intro": {
    nl: "Koppel de standaard PICA-fases en de 15 gespreksonderwerpen aan de eigen trainingsbegrippen van een bedrijf. De verkoper ziet deze termen terug in de geschreven feedback (samenvatting, leerpunten, mail). De analysestructuur en scores blijven ongewijzigd. Laat een veld leeg om de standaardnaam te gebruiken.",
    en: "Map the standard PICA phases and the 15 conversation topics to a company's own training terms. The salesperson sees these terms in the written feedback (summary, learning points, email). The analysis structure and scores stay unchanged. Leave a field empty to use the standard name.",
    de: "Ordnen Sie die Standard-PICA-Phasen und die 15 Gesprächsthemen den eigenen Trainingsbegriffen eines Unternehmens zu. Der Verkäufer sieht diese Begriffe im schriftlichen Feedback (Zusammenfassung, Lernpunkte, E-Mail). Struktur und Bewertung der Analyse bleiben unverändert. Lassen Sie ein Feld leer, um den Standardnamen zu verwenden.",
    fr: "Associez les phases PICA standard et les 15 sujets de conversation aux propres termes de formation d'une entreprise. Le commercial retrouve ces termes dans le feedback écrit (résumé, points d'apprentissage, e-mail). La structure d'analyse et les scores restent inchangés. Laissez un champ vide pour utiliser le nom standard.",
    es: "Asigna las fases PICA estándar y los 15 temas de conversación a los propios términos de formación de una empresa. El vendedor ve estos términos en la retroalimentación escrita (resumen, puntos de aprendizaje, correo). La estructura de análisis y las puntuaciones no cambian. Deja un campo vacío para usar el nombre estándar.",
    it: "Associa le fasi PICA standard e i 15 argomenti di conversazione ai termini di formazione propri di un'azienda. Il venditore vede questi termini nel feedback scritto (riepilogo, punti di apprendimento, email). La struttura dell'analisi e i punteggi restano invariati. Lascia un campo vuoto per usare il nome standard.",
  },
  "terminology.selectCompany": { nl: "Selecteer bedrijf", en: "Select company", de: "Unternehmen auswählen", fr: "Sélectionner une entreprise", es: "Seleccionar empresa", it: "Seleziona azienda" },
  "terminology.selectCompanyPlaceholder": { nl: "— Kies een bedrijf —", en: "— Choose a company —", de: "— Unternehmen wählen —", fr: "— Choisir une entreprise —", es: "— Elige una empresa —", it: "— Scegli un'azienda —" },
  "terminology.selectCompanyPrompt": { nl: "Kies een bedrijf om de terminologie te beheren.", en: "Choose a company to manage its terminology.", de: "Wählen Sie ein Unternehmen, um dessen Terminologie zu verwalten.", fr: "Choisissez une entreprise pour gérer sa terminologie.", es: "Elige una empresa para gestionar su terminología.", it: "Scegli un'azienda per gestirne la terminologia." },
  "terminology.standardConcept": { nl: "Standaardbegrip", en: "Standard concept", de: "Standardbegriff", fr: "Concept standard", es: "Concepto estándar", it: "Concetto standard" },
  "terminology.companyTerm": { nl: "Term van het bedrijf", en: "Company's term", de: "Begriff des Unternehmens", fr: "Terme de l'entreprise", es: "Término de la empresa", it: "Termine dell'azienda" },
  "terminology.termPlaceholder": { nl: "Eigen benaming (optioneel)", en: "Own term (optional)", de: "Eigener Begriff (optional)", fr: "Terme propre (facultatif)", es: "Término propio (opcional)", it: "Termine proprio (facoltativo)" },
  "terminology.save": { nl: "Opslaan", en: "Save", de: "Speichern", fr: "Enregistrer", es: "Guardar", it: "Salva" },
  "terminology.saving": { nl: "Opslaan…", en: "Saving…", de: "Speichern…", fr: "Enregistrement…", es: "Guardando…", it: "Salvataggio…" },
  "terminology.saved": { nl: "Terminologie opgeslagen", en: "Terminology saved", de: "Terminologie gespeichert", fr: "Terminologie enregistrée", es: "Terminología guardada", it: "Terminologia salvata" },
  "terminology.saveError": { nl: "Opslaan mislukt", en: "Saving failed", de: "Speichern fehlgeschlagen", fr: "Échec de l'enregistrement", es: "Error al guardar", it: "Salvataggio non riuscito" },
  "terminology.clearAll": { nl: "Alles wissen", en: "Clear all", de: "Alle löschen", fr: "Tout effacer", es: "Borrar todo", it: "Cancella tutto" },
  "terminology.filledCount": { nl: "{{count}} van 19 begrippen ingevuld", en: "{{count}} of 19 concepts filled in", de: "{{count}} von 19 Begriffen ausgefüllt", fr: "{{count}} concepts sur 19 renseignés", es: "{{count}} de 19 conceptos rellenados", it: "{{count}} di 19 concetti compilati" },
  "terminology.loadCompaniesError": { nl: "Kon bedrijven niet laden", en: "Could not load companies", de: "Unternehmen konnten nicht geladen werden", fr: "Impossible de charger les entreprises", es: "No se pudieron cargar las empresas", it: "Impossibile caricare le aziende" },
  "terminology.loadGlossaryError": { nl: "Kon terminologie niet laden", en: "Could not load terminology", de: "Terminologie konnte nicht geladen werden", fr: "Impossible de charger la terminologie", es: "No se pudo cargar la terminología", it: "Impossibile caricare la terminologia" },

  // ── Fase 2: AI-voorstel uit document ──
  "terminology.aiTitle": { nl: "Voorstel uit trainingsdocument (AI)", en: "Suggest from training document (AI)", de: "Vorschlag aus Trainingsdokument (KI)", fr: "Proposition à partir d'un document de formation (IA)", es: "Sugerir desde un documento de formación (IA)", it: "Proposta da documento di formazione (IA)" },
  "terminology.aiHelp": {
    nl: "Upload een trainingsdocument (.txt, .md of .docx) — of plak de tekst (bv. uit een PDF). De AI stelt bedrijfstermen voor die je hieronder controleert en aanpast voordat je opslaat. Niets wordt automatisch opgeslagen.",
    en: "Upload a training document (.txt, .md or .docx) — or paste the text (e.g. from a PDF). The AI proposes company terms that you review and edit below before saving. Nothing is saved automatically.",
    de: "Laden Sie ein Trainingsdokument hoch (.txt, .md oder .docx) — oder fügen Sie den Text ein (z. B. aus einer PDF). Die KI schlägt Unternehmensbegriffe vor, die Sie unten prüfen und bearbeiten, bevor Sie speichern. Es wird nichts automatisch gespeichert.",
    fr: "Téléversez un document de formation (.txt, .md ou .docx) — ou collez le texte (p. ex. depuis un PDF). L'IA propose des termes d'entreprise que vous vérifiez et modifiez ci-dessous avant d'enregistrer. Rien n'est enregistré automatiquement.",
    es: "Sube un documento de formación (.txt, .md o .docx) — o pega el texto (p. ej. de un PDF). La IA propone términos de la empresa que revisas y editas abajo antes de guardar. No se guarda nada automáticamente.",
    it: "Carica un documento di formazione (.txt, .md o .docx) — oppure incolla il testo (es. da un PDF). L'IA propone termini aziendali che verifichi e modifichi qui sotto prima di salvare. Nulla viene salvato automaticamente.",
  },
  "terminology.orPaste": { nl: "Of tekst plakken", en: "Or paste text", de: "Oder Text einfügen", fr: "Ou coller du texte", es: "O pegar texto", it: "Oppure incolla del testo" },
  "terminology.pastePlaceholder": { nl: "Plak hier de trainingstekst met de eigen begrippen…", en: "Paste the training text with the company's own terms here…", de: "Fügen Sie hier den Trainingstext mit den eigenen Begriffen ein…", fr: "Collez ici le texte de formation avec les termes propres…", es: "Pega aquí el texto de formación con los términos propios…", it: "Incolla qui il testo di formazione con i termini propri…" },
  "terminology.suggestFromText": { nl: "Laat AI voorstellen", en: "Let AI suggest", de: "KI vorschlagen lassen", fr: "Laisser l'IA proposer", es: "Dejar que la IA sugiera", it: "Lascia proporre all'IA" },
  "terminology.proposalReady": { nl: "{{count}} voorstellen ingevuld — controleer en pas aan", en: "{{count}} suggestions filled in — review and edit", de: "{{count}} Vorschläge eingetragen — prüfen und anpassen", fr: "{{count}} suggestions renseignées — vérifiez et modifiez", es: "{{count}} sugerencias rellenadas — revisa y edita", it: "{{count}} suggerimenti compilati — verifica e modifica" },
  "terminology.proposalEmpty": { nl: "Geen duidelijke eigen begrippen gevonden in het document", en: "No clear company-specific terms found in the document", de: "Keine eindeutigen eigenen Begriffe im Dokument gefunden", fr: "Aucun terme propre clair trouvé dans le document", es: "No se encontraron términos propios claros en el documento", it: "Nessun termine proprio chiaro trovato nel documento" },
  "terminology.proposalBanner": { nl: "AI heeft {{count}} term(en) voorgesteld. Controleer ze hieronder en klik daarna op Opslaan.", en: "AI proposed {{count}} term(s). Review them below, then click Save.", de: "Die KI hat {{count}} Begriff(e) vorgeschlagen. Prüfen Sie sie unten und klicken Sie dann auf Speichern.", fr: "L'IA a proposé {{count}} terme(s). Vérifiez-les ci-dessous, puis cliquez sur Enregistrer.", es: "La IA propuso {{count}} término(s). Revísalos abajo y luego haz clic en Guardar.", it: "L'IA ha proposto {{count}} termine/i. Verificali qui sotto, poi clicca su Salva." },
  "terminology.suggestError": { nl: "Kon geen voorstel genereren", en: "Could not generate a suggestion", de: "Es konnte kein Vorschlag erstellt werden", fr: "Impossible de générer une proposition", es: "No se pudo generar una sugerencia", it: "Impossibile generare un suggerimento" },
  "terminology.unsupportedFile": { nl: "Bestandstype niet ondersteund. Gebruik .txt, .md of .docx, of plak de tekst (bv. uit een PDF).", en: "File type not supported. Use .txt, .md or .docx, or paste the text (e.g. from a PDF).", de: "Dateityp nicht unterstützt. Verwenden Sie .txt, .md oder .docx, oder fügen Sie den Text ein (z. B. aus einer PDF).", fr: "Type de fichier non pris en charge. Utilisez .txt, .md ou .docx, ou collez le texte (p. ex. depuis un PDF).", es: "Tipo de archivo no compatible. Usa .txt, .md o .docx, o pega el texto (p. ej. de un PDF).", it: "Tipo di file non supportato. Usa .txt, .md o .docx, oppure incolla il testo (es. da un PDF)." },
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
