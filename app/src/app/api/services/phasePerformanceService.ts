import { prisma } from "../utils/prisma";
import { EXPECTED_FASES } from "@/lib/transcript-analysis/promptSchema";

/**
 * Builds the "Resultaten per gespreksfase" (PICA) tile for a single salesperson
 * from the SAME per-conversation analysis that powers the deep "Inzichten" layer
 * — NOT from the separate dashboard-backend operational analysis.
 *
 * The insight analysis scores 15 fixed sub-phases on a 0-3 scale (stored per
 * conversation in conversation_summaries_x.phases). Those 15 sub-phases map
 * 1-to-1 onto the 4 sales phases and onto the metric keys the dashboard
 * PicaPerformance tile already renders. We average each sub-phase score over ALL
 * of the user's conversations (so the tile builds up as more conversations are
 * analysed) and rescale 0-3 -> 0-100 to match the tile's display.
 */

const MAX_FASE_SCORE = 3;

/** Canonical insight phase Titel (lowercased) -> dashboard PICA metric key. */
const TITLE_TO_METRIC_KEY: Record<string, string> = {
  "break the ice": "breakTheIce",
  "sales pitch": "salesPitch",
  "doel van het gesprek": "goalQuestion",
  "verwachting klant managen": "expectationMgt",
  "contact person": "contactPerson",
  company: "company",
  cooperation: "cooperation",
  consequences: "consequences",
  cure: "cure",
  doorvragen: "deepQuestioning",
  "klanttype bepalen": "customerType",
  "usp to ubr connection": "uspUbrLink",
  result: "result",
  acknowledgement: "acknowledgement",
  agreement: "agreement",
};

/** Dutch phase names — same order/labels as PicaPerformance.PHASE_NAMES. */
const PHASE_NAMES: Record<number, string> = {
  1: "Propositie",
  2: "Inventarisatie",
  3: "Overtuiging",
  4: "Afsluiting",
};

type StoredPhase = {
  Fase?: number;
  Titel?: string;
  Score?: unknown;
};

function normalizePhases(value: unknown): StoredPhase[] {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }
  return Array.isArray(parsed) ? (parsed as StoredPhase[]) : [];
}

/** Parse and clamp a 0-3 phase score; returns null when it isn't a usable number. */
function clampScore(value: unknown): number | null {
  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.min(MAX_FASE_SCORE, n));
}

export type PhasePerformanceResult = {
  picaPerformance: {
    phaseScores: {
      name: string;
      value: number;
      description: string;
      confidence: "high";
    }[];
    phaseDetails: { phase: number; metrics: { key: string; value: number }[] }[];
    comparison: string;
  };
  conversationCount: number;
};

/**
 * Pure PICA computation shared by BOTH dashboards so they can never diverge:
 * given one or more conversations' stored `phases` values, average each of the
 * 15 sub-phases (0-3), rescale to 0-100, and group into the 4 PICA phases.
 * - Personal dashboard: pass ALL of a salesperson's conversations.
 * - Operational push: pass a SINGLE conversation, so the team dashboard is fed
 *   the identical per-conversation number the salesperson sees.
 */
export function buildPicaPerformanceFromPhaseRows(
  phaseValues: unknown[],
): PhasePerformanceResult["picaPerformance"] {
  const sums: Record<string, number> = {};
  const counts: Record<string, number> = {};

  for (const value of phaseValues) {
    for (const phase of normalizePhases(value)) {
      const titel =
        typeof phase?.Titel === "string" ? phase.Titel.trim().toLowerCase() : "";
      const metricKey = TITLE_TO_METRIC_KEY[titel];
      if (!metricKey) continue;

      const score = clampScore(phase?.Score);
      if (score === null) continue;

      sums[metricKey] = (sums[metricKey] ?? 0) + score;
      counts[metricKey] = (counts[metricKey] ?? 0) + 1;
    }
  }

  const hasData = Object.values(counts).some((c) => c > 0);
  if (!hasData) return { phaseScores: [], phaseDetails: [], comparison: "" };

  // Walk the 15 fixed phases in canonical order, grouped per phase number.
  const metricsByPhase = new Map<number, { key: string; value: number }[]>();
  for (const expected of EXPECTED_FASES) {
    const metricKey = TITLE_TO_METRIC_KEY[expected.Titel.toLowerCase()];
    if (!metricKey) continue;

    const count = counts[metricKey] ?? 0;
    if (count === 0) continue;

    const avg = sums[metricKey] / count; // 0-3
    const value = Math.round((avg / MAX_FASE_SCORE) * 100); // 0-100

    if (!metricsByPhase.has(expected.Fase)) metricsByPhase.set(expected.Fase, []);
    metricsByPhase.get(expected.Fase)!.push({ key: metricKey, value });
  }

  const phaseScores: PhasePerformanceResult["picaPerformance"]["phaseScores"] = [];
  const phaseDetails: PhasePerformanceResult["picaPerformance"]["phaseDetails"] = [];

  // Canonical order 1-4; the dashboard-backend re-labels these to its fixed
  // English phase names by position (normalizePhaseScoreNames), so the Dutch
  // names here are only a display fallback (the tiles render names by index).
  for (const phaseNum of [1, 2, 3, 4]) {
    const metrics = metricsByPhase.get(phaseNum) ?? [];
    const value =
      metrics.length > 0
        ? Math.round(metrics.reduce((s, m) => s + m.value, 0) / metrics.length)
        : 0;

    phaseScores.push({
      name: PHASE_NAMES[phaseNum],
      value,
      description: "",
      confidence: "high",
    });
    phaseDetails.push({ phase: phaseNum, metrics });
  }

  return { phaseScores, phaseDetails, comparison: "" };
}

export async function buildPhasePerformanceForUser(
  userId: string,
): Promise<PhasePerformanceResult> {
  const rows = await prisma.conversationSummaryX.findMany({
    // Exclude non-sales conversations: they carry no sales performance and must
    // not drag the seller's PICA phase averages.
    where: { user_conversation: { user_id: userId }, geen_salesgesprek: false },
    select: { phases: true },
  });

  return {
    picaPerformance: buildPicaPerformanceFromPhaseRows(rows.map((r) => r.phases)),
    conversationCount: rows.length,
  };
}
