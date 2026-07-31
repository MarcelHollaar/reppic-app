/** Shared schema constants for transcript analysis prompts (server + admin UI). */

export const REQUIRED_PLACEHOLDERS = ["{{language}}", "{{gesprek}}"] as const;

export const REQUIRED_JSON_KEYS = [
  "Sfeer",
  "Klanttype",
  "Verkoper",
  "Samenvatting",
  "Mail",
  "Leerpunten",
  "Weerstanden",
  "Fases",
] as const;

export const REQUIRED_WEERSTANDEN_KEYS = [
  "KlantWeerstand",
  "VerkoperReactie",
  "Conclusie",
  "Reden",
] as const;

export const REQUIRED_FASE_KEYS = ["Fase", "Titel", "Score", "Redenering"] as const;

/** The 15 fixed phases in order. Fase + Titel is the composite key. */
export const EXPECTED_FASES = [
  { Fase: 1, Titel: "Break the ice" },
  { Fase: 1, Titel: "Sales pitch" },
  { Fase: 1, Titel: "Doel van het gesprek" },
  { Fase: 1, Titel: "Verwachting klant managen" },
  { Fase: 2, Titel: "Contact person" },
  { Fase: 2, Titel: "Company" },
  { Fase: 2, Titel: "Cooperation" },
  { Fase: 2, Titel: "Consequences" },
  { Fase: 2, Titel: "Cure" },
  { Fase: 2, Titel: "Doorvragen" },
  { Fase: 2, Titel: "Klanttype bepalen" },
  { Fase: 3, Titel: "USP to UBR connection" },
  { Fase: 3, Titel: "Result" },
  { Fase: 3, Titel: "Acknowledgement" },
  { Fase: 4, Titel: "Agreement" },
] as const;

export type PromptValidationIssue = {
  code: string;
  message: string;
};

export type PromptValidationResult = {
  valid: boolean;
  errors: PromptValidationIssue[];
  warnings: PromptValidationIssue[];
};

function containsJsonKey(content: string, key: string): boolean {
  return content.includes(`"${key}"`);
}

function countPhaseOccurrences(content: string, titel: string): number {
  const escaped = titel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`"Titel"\\s*:\\s*"${escaped}"`, "g");
  return (content.match(pattern) ?? []).length;
}

export function validateTranscriptAnalysisPrompt(
  content: string,
): PromptValidationResult {
  const errors: PromptValidationIssue[] = [];
  const warnings: PromptValidationIssue[] = [];
  const trimmed = content.trim();

  if (!trimmed) {
    errors.push({
      code: "empty",
      message: "Prompt content cannot be empty.",
    });
    return { valid: false, errors, warnings };
  }

  for (const placeholder of REQUIRED_PLACEHOLDERS) {
    if (!trimmed.includes(placeholder)) {
      errors.push({
        code: "missing_placeholder",
        message: `Missing required placeholder: ${placeholder}`,
      });
    }
  }

  for (const key of REQUIRED_JSON_KEYS) {
    if (!containsJsonKey(trimmed, key)) {
      errors.push({
        code: "missing_json_key",
        message: `Missing required JSON key in prompt schema: "${key}"`,
      });
    }
  }

  for (const key of REQUIRED_WEERSTANDEN_KEYS) {
    if (!containsJsonKey(trimmed, key)) {
      errors.push({
        code: "missing_weerstanden_key",
        message: `Missing required Weerstanden object key: "${key}"`,
      });
    }
  }

  for (const key of REQUIRED_FASE_KEYS) {
    if (!containsJsonKey(trimmed, key)) {
      errors.push({
        code: "missing_fase_key",
        message: `Missing required Fases object key: "${key}"`,
      });
    }
  }

  const missingPhases: string[] = [];
  const duplicatePhases: string[] = [];

  for (const phase of EXPECTED_FASES) {
    const occurrences = countPhaseOccurrences(trimmed, phase.Titel);
    if (occurrences === 0) {
      missingPhases.push(phase.Titel);
    } else if (occurrences > 1) {
      duplicatePhases.push(`${phase.Titel} (${occurrences}x)`);
    }
  }

  if (missingPhases.length > 0) {
    errors.push({
      code: "missing_phases",
      message: `Missing ${missingPhases.length} of 15 required phase titles: ${missingPhases.join(", ")}`,
    });
  }

  if (duplicatePhases.length > 0) {
    warnings.push({
      code: "duplicate_phases",
      message: `Duplicate phase titles found: ${duplicatePhases.join(", ")}`,
    });
  }

  const foundPhaseCount = EXPECTED_FASES.filter(
    (phase) => countPhaseOccurrences(trimmed, phase.Titel) > 0,
  ).length;

  if (foundPhaseCount > 0 && foundPhaseCount < EXPECTED_FASES.length) {
    warnings.push({
      code: "partial_phases",
      message: `Only ${foundPhaseCount} of ${EXPECTED_FASES.length} required phases were found.`,
    });
  }

  if (!trimmed.includes("```json") && !trimmed.includes("{")) {
    warnings.push({
      code: "no_json_example",
      message: "No JSON output example block detected in the prompt.",
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
