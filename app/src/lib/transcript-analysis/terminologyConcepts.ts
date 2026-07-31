/**
 * Canonical concepts a company can rename with its own training jargon.
 *
 * These are the ANCHOR of the analysis — the 4 PICA phases and the 15 fixed
 * evaluation topics. A company glossary maps each concept key to the company's
 * own term (e.g. breakTheIce -> "Front talk"). The mapping only changes the
 * LANGUAGE of the feedback and the display labels; the analysis structure
 * (Fases[].Titel, scoring, dashboards) always stays standard.
 *
 * Keys align 1:1 with the dashboard i18n keys (dashboards.picaPhases.* /
 * dashboards.picaMetrics.*) and with EXPECTED_FASES (via `standardLabel`).
 * Shared by the server (prompt injection) and the client (management table).
 */

export interface TerminologyPhase {
  /** Stable concept key (also the dashboards.picaPhases.<key>). */
  key: string;
  /** Standard English name of the phase. */
  standardLabel: string;
}

export interface TerminologyTopic {
  /** Stable concept key (also the dashboards.picaMetrics.<key>). */
  key: string;
  /** Standard label — matches the EXPECTED_FASES `Titel` for this topic. */
  standardLabel: string;
  /** Which PICA phase this topic belongs to. */
  phaseKey: string;
}

export const TERMINOLOGY_PHASES: TerminologyPhase[] = [
  { key: "proposition", standardLabel: "Proposition" },
  { key: "inventory", standardLabel: "Investigation" },
  { key: "conviction", standardLabel: "Conviction" },
  { key: "closing", standardLabel: "Closing" },
];

export const TERMINOLOGY_TOPICS: TerminologyTopic[] = [
  // Phase 1 — Proposition
  { key: "breakTheIce", standardLabel: "Break the ice", phaseKey: "proposition" },
  { key: "salesPitch", standardLabel: "Sales pitch", phaseKey: "proposition" },
  { key: "goalQuestion", standardLabel: "Doel van het gesprek", phaseKey: "proposition" },
  { key: "expectationMgt", standardLabel: "Verwachting klant managen", phaseKey: "proposition" },
  // Phase 2 — Investigation
  { key: "contactPerson", standardLabel: "Contact person", phaseKey: "inventory" },
  { key: "company", standardLabel: "Company", phaseKey: "inventory" },
  { key: "cooperation", standardLabel: "Cooperation", phaseKey: "inventory" },
  { key: "consequences", standardLabel: "Consequences", phaseKey: "inventory" },
  { key: "cure", standardLabel: "Cure", phaseKey: "inventory" },
  { key: "deepQuestioning", standardLabel: "Doorvragen", phaseKey: "inventory" },
  { key: "customerType", standardLabel: "Klanttype bepalen", phaseKey: "inventory" },
  // Phase 3 — Conviction
  { key: "uspUbrLink", standardLabel: "USP to UBR connection", phaseKey: "conviction" },
  { key: "result", standardLabel: "Result", phaseKey: "conviction" },
  { key: "acknowledgement", standardLabel: "Acknowledgement", phaseKey: "conviction" },
  // Phase 4 — Closing
  { key: "agreement", standardLabel: "Agreement", phaseKey: "closing" },
];

/** All valid concept keys (4 phases + 15 topics) — used to validate a mapping. */
export const ALL_TERMINOLOGY_KEYS: string[] = [
  ...TERMINOLOGY_PHASES.map((p) => p.key),
  ...TERMINOLOGY_TOPICS.map((t) => t.key),
];

/** A company glossary: concept key -> company term. */
export type TerminologyMapping = Record<string, string>;

/** Keep only known keys with a non-empty trimmed term. */
export function sanitizeTerminologyMapping(input: unknown): TerminologyMapping {
  const out: TerminologyMapping = {};
  if (!input || typeof input !== "object") return out;
  const known = new Set(ALL_TERMINOLOGY_KEYS);
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!known.has(key)) continue;
    if (typeof value !== "string") continue;
    const term = value.trim();
    if (term) out[key] = term;
  }
  return out;
}
