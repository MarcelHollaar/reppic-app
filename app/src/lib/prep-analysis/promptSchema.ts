// Validatie voor de prep-analyse-prompt (gedeeld tussen server en admin-UI),
// naar het model van src/lib/transcript-analysis/promptSchema.ts.

export const PREP_REQUIRED_PLACEHOLDERS = ["{{language}}", "{{context}}"] as const;

export const PREP_REQUIRED_JSON_KEYS = [
  "doel",
  "gemiste_fases",
  "weerstanden",
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
  gemiste_fases: Array<{ fase: string; advies: string }>;
  weerstanden: Array<{ weerstand: string; advies: string }>;
  voorgestelde_vragen: string[];
  deal_samenvatting: string;
  aandachtspunten: string[];
}

export function parsePrepContent(raw: string): PrepContent {
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Prep-output is geen geldige JSON");
  }

  if (typeof data?.doel !== "string" || !data.doel.trim()) {
    throw new Error('Prep-output mist "doel"');
  }
  if (!Array.isArray(data.gemiste_fases)) {
    throw new Error('Prep-output mist "gemiste_fases" (array)');
  }
  if (!Array.isArray(data.weerstanden)) {
    throw new Error('Prep-output mist "weerstanden" (array)');
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
    gemiste_fases: data.gemiste_fases
      .filter((f: any) => f && typeof f.fase === "string")
      .map((f: any) => ({
        fase: String(f.fase),
        advies: String(f.advies ?? ""),
      })),
    weerstanden: data.weerstanden
      .filter((w: any) => w && typeof w.weerstand === "string")
      .map((w: any) => ({
        weerstand: String(w.weerstand),
        advies: String(w.advies ?? ""),
      })),
    voorgestelde_vragen: data.voorgestelde_vragen
      .map((q: any) => String(q).trim())
      .filter((q: string) => q.length > 0),
    deal_samenvatting: String(data.deal_samenvatting ?? "").trim(),
    aandachtspunten: data.aandachtspunten
      .map((p: any) => String(p).trim())
      .filter((p: string) => p.length > 0),
  };
}
