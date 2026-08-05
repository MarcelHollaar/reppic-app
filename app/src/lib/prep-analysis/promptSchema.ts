// Validatie voor de prep-analyse-prompt (gedeeld tussen server en admin-UI),
// naar het model van src/lib/transcript-analysis/promptSchema.ts.
//
// Toon-uitgangspunt (besloten 2026-08-04): de prep is doel- en waardegericht,
// nooit terugkijkend-oordelend. Daarom "informatie_doelen" (wat wil je dit
// gesprek leren/bereiken en waarom is dat waardevol) in plaats van
// "gemiste_fases"; eerdere weerstanden worden vooruitkijkend verwoord in
// "aandachtspunten".

export const PREP_REQUIRED_PLACEHOLDERS = ["{{language}}", "{{context}}"] as const;

export const PREP_REQUIRED_JSON_KEYS = [
  "doel",
  "informatie_doelen",
  "voorgestelde_vragen",
  "deal_samenvatting",
  "aandachtspunten",
] as const;

export interface PromptValidationIssue {
  message: string;
}

export interface PromptValidationResult {
  valid: boolean;
  errors: PromptValidationIssue[];
}

export function validatePrepAnalysisPrompt(
  content: string
): PromptValidationResult {
  const errors: PromptValidationIssue[] = [];

  if (!content || content.trim().length < 100) {
    errors.push({ message: "Prompt is leeg of te kort (< 100 tekens)." });
  }

  for (const placeholder of PREP_REQUIRED_PLACEHOLDERS) {
    if (!content.includes(placeholder)) {
      errors.push({
        message: `Verplichte placeholder ontbreekt: ${placeholder}`,
      });
    }
  }

  for (const key of PREP_REQUIRED_JSON_KEYS) {
    if (!content.includes(`"${key}"`)) {
      errors.push({
        message: `Prompt beschrijft verplichte JSON-sleutel niet: "${key}"`,
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

// Structuur van de gevalideerde LLM-output (ConversationPrep.content).
export interface PrepContent {
  doel: string;
  // Wat de verkoper dit gesprek wil leren/bereiken + waarom dat waardevol is.
  informatie_doelen: Array<{ onderwerp: string; waarom: string }>;
  voorgestelde_vragen: string[];
  deal_samenvatting: string;
  aandachtspunten: string[];
}

/** Normaliseert LLM-output vóór JSON.parse: markdown-fences strippen en de
 *  buitenste accolades isoleren (zelfde patroon als transcript-analysis
 *  analyze.ts:normalizeJsonCandidate — modellen wikkelen JSON soms in
 *  ```json-fences of omliggende tekst). */
function normalizeJsonCandidate(raw: string): string {
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/, "");
  const firstBrace = text.indexOf("{");
  if (firstBrace > 0) text = text.slice(firstBrace);
  const lastBrace = text.lastIndexOf("}");
  if (lastBrace >= 0 && lastBrace < text.length - 1) {
    text = text.slice(0, lastBrace + 1);
  }
  return text;
}

function removeTrailingCommas(text: string): string {
  return text.replace(/,\s*([}\]])/g, "$1");
}

export function parsePrepContent(raw: string): PrepContent {
  const text = normalizeJsonCandidate(String(raw ?? ""));
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    try {
      data = JSON.parse(removeTrailingCommas(text));
    } catch {
      throw new Error(
        `Prep-output is geen geldige JSON. Eerste 300 tekens: ${String(raw).slice(0, 300)}`
      );
    }
  }

  if (typeof data?.doel !== "string" || !data.doel.trim()) {
    throw new Error('Prep-output mist "doel"');
  }
  if (!Array.isArray(data.informatie_doelen)) {
    throw new Error('Prep-output mist "informatie_doelen" (array)');
  }
  if (
    !Array.isArray(data.voorgestelde_vragen) ||
    data.voorgestelde_vragen.length < 1
  ) {
    throw new Error('Prep-output mist "voorgestelde_vragen"');
  }
  if (!Array.isArray(data.aandachtspunten)) {
    throw new Error('Prep-output mist "aandachtspunten" (array)');
  }

  return {
    doel: String(data.doel).trim(),
    informatie_doelen: data.informatie_doelen
      .filter((g: any) => g && typeof g.onderwerp === "string")
      .map((g: any) => ({
        onderwerp: String(g.onderwerp).trim(),
        waarom: String(g.waarom ?? "").trim(),
      }))
      .filter((g: any) => g.onderwerp.length > 0),
    voorgestelde_vragen: data.voorgestelde_vragen
      .map((q: any) => String(q).trim())
      .filter((q: string) => q.length > 0),
    deal_samenvatting: String(data.deal_samenvatting ?? "").trim(),
    aandachtspunten: data.aandachtspunten
      .map((p: any) => String(p).trim())
      .filter((p: string) => p.length > 0)
      .slice(0, 4),
  };
}
