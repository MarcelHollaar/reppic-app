import { prisma } from "@/app/api/utils/prisma";
import {
  TERMINOLOGY_PHASES,
  TERMINOLOGY_TOPICS,
  sanitizeTerminologyMapping,
  type TerminologyMapping,
} from "@/lib/transcript-analysis/terminologyConcepts";

/**
 * Per-company terminology glossary.
 *
 * The glossary renames the standard PICA phases and evaluation topics to a
 * company's own training jargon. It only changes the LANGUAGE of the feedback
 * and the display labels — the analysis structure stays standard.
 */

/** Returns the stored mapping for a company (concept key -> term), or {} if none. */
export async function getCompanyTerminology(
  companyId: string | null | undefined,
): Promise<TerminologyMapping> {
  if (!companyId) return {};
  const row = await prisma.companyTerminology.findUnique({
    where: { company_id: companyId },
  });
  if (!row) return {};
  return sanitizeTerminologyMapping(row.mapping);
}

/** Upserts a company's glossary. Unknown keys / empty terms are dropped. */
export async function setCompanyTerminology(
  companyId: string,
  mapping: unknown,
  updatedBy?: string | null,
  sourceFilename?: string | null,
): Promise<TerminologyMapping> {
  const clean = sanitizeTerminologyMapping(mapping);
  await prisma.companyTerminology.upsert({
    where: { company_id: companyId },
    create: {
      company_id: companyId,
      mapping: clean,
      updated_by: updatedBy ?? null,
      source_filename: sourceFilename ?? null,
    },
    update: {
      mapping: clean,
      updated_by: updatedBy ?? null,
      ...(sourceFilename !== undefined ? { source_filename: sourceFilename } : {}),
    },
  });
  return clean;
}

/**
 * Builds the "Company terminology" instruction block injected into the analysis
 * prompt. Returns null when the company has no (usable) glossary, so the prompt
 * is unchanged for companies without one.
 */
export function buildGlossaryPromptBlock(
  mapping: TerminologyMapping,
): string | null {
  const phaseLines = TERMINOLOGY_PHASES.filter((p) => mapping[p.key]).map(
    (p) => `- ${p.standardLabel} → "${mapping[p.key]}"`,
  );
  const topicLines = TERMINOLOGY_TOPICS.filter((t) => mapping[t.key]).map(
    (t) => `- ${t.standardLabel} → "${mapping[t.key]}"`,
  );

  if (phaseLines.length === 0 && topicLines.length === 0) return null;

  const parts: string[] = [
    "## Company Terminology",
    "",
    "This organization uses its own training names for the sales phases and evaluation topics. When you write the `Samenvatting`, the per-phase `Redenering`, the `Leerpunten` and the `Mail`, refer to these concepts using the company's terms below instead of the generic names, so the seller recognises the language from their own training.",
    "",
    "**Important:** this only changes the wording of your written feedback. Keep every `Fases[].Titel` value in the JSON exactly as specified in Task 3 — do NOT rename the structure.",
    "",
  ];
  if (phaseLines.length > 0) {
    parts.push("Sales phases:", ...phaseLines, "");
  }
  if (topicLines.length > 0) {
    parts.push("Evaluation topics:", ...topicLines, "");
  }
  return parts.join("\n").trimEnd();
}
