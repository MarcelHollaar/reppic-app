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

/** Normalizes a raw product-terms value to a clean string array. */
export function sanitizeProductTerms(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of input) {
    if (typeof value !== "string") continue;
    const term = value.trim();
    if (term.length < 2) continue;
    const lower = term.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(term);
  }
  return out;
}

/** Returns the stored product terms for a company (for transcription keyterms). */
export async function getCompanyProductTerms(
  companyId: string | null | undefined,
): Promise<string[]> {
  if (!companyId) return [];
  const row = await prisma.companyTerminology.findUnique({
    where: { company_id: companyId },
    select: { product_terms: true },
  });
  return sanitizeProductTerms(row?.product_terms);
}

/**
 * Maximum keyterms sent per transcription. AssemblyAI's hard limit is 1,000 on
 * universal-3-5-pro, but boosting works best with a lean, relevant list.
 */
const KEYTERMS_CAP = 400;

/**
 * Builds the AssemblyAI `keyterms_prompt` list for a conversation of this user:
 * company name + the company's glossary jargon + the company's product terms.
 *
 * Deliberately company-specific only — no generic base list. Our internal PICA
 * phase/topic labels ("Proposition", "Break the ice", …) are analysis
 * vocabulary that is never actually spoken in a call; boosting those would
 * steer recognition the wrong way. What IS spoken: the company's own names,
 * jargon and products. Live E2E test 2026-08-02 confirmed exactly that pattern
 * ("Post.nl"→"PostNL", "Martina G."→"Martijn").
 *
 * Fail-open: on any error return [] so transcription proceeds without boost.
 */
export async function buildConversationKeyterms(
  userId: string | null | undefined,
): Promise<string[]> {
  try {
    if (!userId) return [];
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { company_id: true, company: { select: { title: true } } },
    });
    if (!user?.company_id) return [];

    const mapping = await getCompanyTerminology(user.company_id);
    const productTerms = await getCompanyProductTerms(user.company_id);

    const raw = [
      user.company?.title ?? "",
      ...Object.values(mapping),
      ...productTerms,
    ];
    return sanitizeProductTerms(raw).slice(0, KEYTERMS_CAP);
  } catch (error) {
    console.error(
      "[Terminology] buildConversationKeyterms failed (continuing without keyterms):",
      error,
    );
    return [];
  }
}

/**
 * Upserts a company's glossary. Unknown keys / empty terms are dropped.
 * `productTerms` (optional): when provided, also replaces the company's
 * product-term list for transcription keyterms; when omitted the stored list
 * stays untouched.
 */
export async function setCompanyTerminology(
  companyId: string,
  mapping: unknown,
  updatedBy?: string | null,
  sourceFilename?: string | null,
  productTerms?: unknown,
): Promise<TerminologyMapping> {
  const clean = sanitizeTerminologyMapping(mapping);
  const cleanProducts =
    productTerms !== undefined ? sanitizeProductTerms(productTerms) : undefined;
  await prisma.companyTerminology.upsert({
    where: { company_id: companyId },
    create: {
      company_id: companyId,
      mapping: clean,
      product_terms: cleanProducts ?? [],
      updated_by: updatedBy ?? null,
      source_filename: sourceFilename ?? null,
    },
    update: {
      mapping: clean,
      ...(cleanProducts !== undefined ? { product_terms: cleanProducts } : {}),
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
