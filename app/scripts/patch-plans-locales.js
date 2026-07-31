#!/usr/bin/env node
/**
 * Voegt de vertaalsleutels voor de plan-upload (strategisch/operationeel plan)
 * toe aan de 6 taalbestanden. Idempotent, diep gemerged onder `plans`.
 */
const fs = require("fs");
const path = require("path");
const LOCALES_DIR = path.join(__dirname, "..", "public", "locales");
const LANGS = ["nl", "en", "de", "fr", "es", "it"];

const T = {
  "plans.dropHere": { nl: "Sleep bestand hier of klik om te selecteren", en: "Drag a file here or click to select", de: "Datei hierher ziehen oder klicken zum Auswählen", fr: "Glissez un fichier ici ou cliquez pour sélectionner", es: "Arrastra un archivo aquí o haz clic para seleccionar", it: "Trascina un file qui o clicca per selezionare" },
  "plans.supported": { nl: "Ondersteund: PDF, DOCX, TXT, MD", en: "Supported: PDF, DOCX, TXT, MD", de: "Unterstützt: PDF, DOCX, TXT, MD", fr: "Pris en charge : PDF, DOCX, TXT, MD", es: "Compatible: PDF, DOCX, TXT, MD", it: "Supportati: PDF, DOCX, TXT, MD" },
  "plans.reading": { nl: "Document lezen…", en: "Reading document…", de: "Dokument wird gelesen…", fr: "Lecture du document…", es: "Leyendo el documento…", it: "Lettura del documento…" },
  "plans.previewIntro": { nl: "Dit hebben we uit je document gehaald. Controleer of de inhoud klopt en activeer daarna het plan.", en: "This is what we read from your document. Check that the content is correct, then activate the plan.", de: "Das haben wir aus Ihrem Dokument gelesen. Prüfen Sie den Inhalt und aktivieren Sie danach den Plan.", fr: "Voici ce que nous avons lu dans votre document. Vérifiez que le contenu est correct, puis activez le plan.", es: "Esto es lo que hemos leído de tu documento. Comprueba que el contenido es correcto y luego activa el plan.", it: "Questo è ciò che abbiamo letto dal tuo documento. Verifica che il contenuto sia corretto, poi attiva il piano." },
  "plans.charsRead": { nl: "{{count}} tekens gelezen", en: "{{count}} characters read", de: "{{count}} Zeichen gelesen", fr: "{{count}} caractères lus", es: "{{count}} caracteres leídos", it: "{{count}} caratteri letti" },
  "plans.confirmActivate": { nl: "Bevestigen & activeren", en: "Confirm & activate", de: "Bestätigen & aktivieren", fr: "Confirmer et activer", es: "Confirmar y activar", it: "Conferma e attiva" },
  "plans.chooseOther": { nl: "Ander bestand kiezen", en: "Choose another file", de: "Andere Datei wählen", fr: "Choisir un autre fichier", es: "Elegir otro archivo", it: "Scegli un altro file" },
  "plans.saving": { nl: "Opslaan…", en: "Saving…", de: "Speichern…", fr: "Enregistrement…", es: "Guardando…", it: "Salvataggio…" },
  "plans.uploadSuccess": { nl: "\"{{filename}}\" succesvol geüpload. Alle gesprekken worden opnieuw geanalyseerd met dit plan.", en: "\"{{filename}}\" uploaded successfully. All conversations are being reanalyzed against this plan.", de: "\"{{filename}}\" erfolgreich hochgeladen. Alle Gespräche werden mit diesem Plan neu analysiert.", fr: "« {{filename}} » téléversé avec succès. Toutes les conversations sont réanalysées avec ce plan.", es: "\"{{filename}}\" subido correctamente. Todas las conversaciones se están reanalizando con este plan.", it: "\"{{filename}}\" caricato con successo. Tutte le conversazioni vengono rianalizzate con questo piano." },
  "plans.uploadFailed": { nl: "Upload mislukt ({{status}})", en: "Upload failed ({{status}})", de: "Upload fehlgeschlagen ({{status}})", fr: "Échec du téléversement ({{status}})", es: "Error al subir ({{status}})", it: "Caricamento non riuscito ({{status}})" },
  "plans.extractFailed": { nl: "Document lezen mislukt ({{status}})", en: "Could not read document ({{status}})", de: "Dokument konnte nicht gelesen werden ({{status}})", fr: "Impossible de lire le document ({{status}})", es: "No se pudo leer el documento ({{status}})", it: "Impossibile leggere il documento ({{status}})" },
  "plans.tooLarge": { nl: "Bestand te groot (max. ca. 18 MB voor PDF).", en: "File too large (max. approx. 18 MB for PDF).", de: "Datei zu groß (max. ca. 18 MB für PDF).", fr: "Fichier trop volumineux (max. env. 18 Mo pour un PDF).", es: "Archivo demasiado grande (máx. aprox. 18 MB para PDF).", it: "File troppo grande (max. ca. 18 MB per PDF)." },
  "plans.noPermission": { nl: "Alleen managers kunnen plannen beheren.", en: "Only managers can manage plans.", de: "Nur Manager können Pläne verwalten.", fr: "Seuls les managers peuvent gérer les plans.", es: "Solo los managers pueden gestionar planes.", it: "Solo i manager possono gestire i piani." },
  "plans.uploadedOn": { nl: "Geüpload op {{date}}", en: "Uploaded on {{date}}", de: "Hochgeladen am {{date}}", fr: "Téléversé le {{date}}", es: "Subido el {{date}}", it: "Caricato il {{date}}" },
  "plans.delete": { nl: "Verwijder", en: "Delete", de: "Löschen", fr: "Supprimer", es: "Eliminar", it: "Elimina" },
  "plans.deleteSuccess": { nl: "Plan verwijderd.", en: "Plan deleted.", de: "Plan gelöscht.", fr: "Plan supprimé.", es: "Plan eliminado.", it: "Piano eliminato." },
  "plans.deleteFailed": { nl: "Verwijderen mislukt", en: "Delete failed", de: "Löschen fehlgeschlagen", fr: "Échec de la suppression", es: "Error al eliminar", it: "Eliminazione non riuscita" },
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
