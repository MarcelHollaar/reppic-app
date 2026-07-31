import mammoth from "mammoth";
import { completeChat } from "./litellmClient";
import { platformSettingsService } from "./platformSettingsService";
import {
  TERMINOLOGY_PHASES,
  TERMINOLOGY_TOPICS,
  sanitizeTerminologyMapping,
  type TerminologyMapping,
} from "@/lib/transcript-analysis/terminologyConcepts";

/**
 * Fase 2 of the terminology glossary: turn an uploaded training document into a
 * *proposed* mapping (concept key -> the company's own term). The superadmin
 * always reviews and edits the proposal before saving, so this service never
 * writes to the database.
 */

// Guardrails so a huge document can't blow up the model context / cost.
const MAX_DOC_CHARS = 40_000;

/** Extract plain text from an uploaded document buffer, by file type. */
export async function extractDocumentText(
  buffer: Buffer,
  filename: string,
): Promise<string> {
  const lower = (filename || "").toLowerCase();

  if (lower.endsWith(".docx")) {
    const { value } = await mammoth.extractRawText({ buffer });
    return value || "";
  }

  if (
    lower.endsWith(".txt") ||
    lower.endsWith(".md") ||
    lower.endsWith(".csv") ||
    lower.endsWith(".text")
  ) {
    return buffer.toString("utf8");
  }

  // Legacy .doc (binary) and unknown types are not reliably parseable as text.
  throw new Error("UNSUPPORTED_FILETYPE");
}

function buildSuggestionPrompt(documentText: string): string {
  const conceptLines = [
    ...TERMINOLOGY_PHASES.map(
      (p) => `- ${p.key} (sales phase): "${p.standardLabel}"`,
    ),
    ...TERMINOLOGY_TOPICS.map(
      (t) => `- ${t.key} (topic in the "${t.phaseKey}" phase): "${t.standardLabel}"`,
    ),
  ].join("\n");

  const trimmed = documentText.slice(0, MAX_DOC_CHARS);

  return `You are helping map a sales organization's own training vocabulary onto a fixed, standard sales-conversation framework.

The framework has these fixed concepts (each with a stable \`key\` and its standard name):
${conceptLines}

Below is a training document from one company. Companies often invent their own names for these concepts (for example, small talk / breaking the ice might be called "front talk", or the closing agreement might be called "the lock").

Your task: read the document and, ONLY where the document clearly uses a specific, deliberate term for one of the concepts above, propose that company term.

Rules:
- Return a JSON object mapping concept \`key\` -> the company's term (a short label, as the document phrases it).
- Include a concept ONLY when the document genuinely names it with its own jargon. If the document just uses the ordinary/standard word, or does not mention the concept, OMIT that key entirely. It is correct and expected to return only a few keys — do not force a term for every concept.
- Do NOT invent terms. Do NOT translate. Use the document's own wording.
- Keep each value under 40 characters.
- Respond with ONLY the JSON object, no commentary. Example shape: {"breakTheIce": "Front talk", "agreement": "The lock"}. If nothing clearly maps, return {}.

Document:
"""
${trimmed}
"""`;
}

/**
 * Runs the document through the LLM (via the configured analysis route) and
 * returns a sanitized mapping proposal. Never persists.
 */
export async function suggestMappingFromDocument(
  documentText: string,
  context?: { userId?: string },
): Promise<{ mapping: TerminologyMapping; usedChars: number }> {
  const text = (documentText || "").trim();
  if (!text) return { mapping: {}, usedChars: 0 };

  const { model, tag, usesAdaptiveThinking } =
    await platformSettingsService.getAnalysisLiteLLMRoute();

  const prompt = buildSuggestionPrompt(text);
  const raw = await completeChat(
    prompt,
    { userId: context?.userId },
    { model, tag, usesAdaptiveThinking },
  );

  let parsed: unknown = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    // completeChat forces json_object, but be defensive: strip anything around
    // the first/last brace.
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        parsed = JSON.parse(raw.slice(start, end + 1));
      } catch {
        parsed = {};
      }
    }
  }

  return {
    mapping: sanitizeTerminologyMapping(parsed),
    usedChars: Math.min(text.length, MAX_DOC_CHARS),
  };
}
