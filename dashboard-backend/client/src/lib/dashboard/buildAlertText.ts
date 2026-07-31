/**
 * buildAlertText.ts
 *
 * Genereert een gelokaliseerde waarschuwingstekst op basis van prioriteit,
 * trendrichting en frequentie. Canonieke bron — logic was eerder in enrichInsights.ts.
 *
 * Regels:
 *   1. Prioriteit Hoog + trend stabiel → "structureel hoog" signaal
 *   2. Trend omhoog + delta >= 5pp     → "duidelijk stijgend" signaal
 *   3. Prioriteit Hoog + trend omhoog  → "stijgend" alarm (overlap met regel 2)
 *   4. Huidige % >= 25                 → "dominant" categorie-alarm
 */

import type { PriorityLabel } from "./calculatePriority";
import type { TrendDirection } from "./calculateTrend";

// ─── Templates per taal ───────────────────────────────────────────────────────

type AlertFns = {
  structurallyHigh: (label: string) => string;
  clearlyRising:    (label: string) => string;
  dominant:         (label: string) => string;
};

const ALERT_TEMPLATES: Record<string, AlertFns> = {
  nl: {
    structurallyHigh: (l) => `${l} blijft structureel hoog`,
    clearlyRising:    (l) => `${l} neemt duidelijk toe`,
    dominant:         (l) => `${l} domineert als aandachtspunt`,
  },
  en: {
    structurallyHigh: (l) => `${l} remains structurally high`,
    clearlyRising:    (l) => `${l} is clearly increasing`,
    dominant:         (l) => `${l} dominates as a key concern`,
  },
  de: {
    structurallyHigh: (l) => `${l} bleibt strukturell hoch`,
    clearlyRising:    (l) => `${l} nimmt deutlich zu`,
    dominant:         (l) => `${l} dominiert als Aufmerksamkeitspunkt`,
  },
  fr: {
    structurallyHigh: (l) => `${l} reste structurellement élevé`,
    clearlyRising:    (l) => `${l} augmente clairement`,
    dominant:         (l) => `${l} domine comme point d'attention`,
  },
  es: {
    structurallyHigh: (l) => `${l} sigue siendo estructuralmente alto`,
    clearlyRising:    (l) => `${l} está aumentando claramente`,
    dominant:         (l) => `${l} domina como punto de atención`,
  },
  it: {
    structurallyHigh: (l) => `${l} rimane strutturalmente alto`,
    clearlyRising:    (l) => `${l} sta aumentando chiaramente`,
    dominant:         (l) => `${l} domina come punto di attenzione`,
  },
};

// ─── Publieke API ──────────────────────────────────────────────────────────────

export interface BuildAlertTextInput {
  label: string;
  priorityLabel: PriorityLabel;
  trendDirection: TrendDirection;
  /** Absoluut delta in procentpunten. */
  deltaAbsolute: number;
  /** Huidig aandeel in procenten. */
  currentPct: number;
  lang?: string;
}

/**
 * Geeft een gelokaliseerde alerttekst terug, of `undefined` als er geen
 * alertconditie van toepassing is.
 */
export function buildAlertText({
  label,
  priorityLabel,
  trendDirection,
  deltaAbsolute,
  currentPct,
  lang = 'nl',
}: BuildAlertTextInput): string | undefined {
  const t = ALERT_TEMPLATES[lang] ?? ALERT_TEMPLATES['nl'];

  if (priorityLabel === 'Hoog' && trendDirection === 'stable') {
    return t.structurallyHigh(label);
  }
  if (trendDirection === 'up' && deltaAbsolute >= 5) {
    return t.clearlyRising(label);
  }
  if (priorityLabel === 'Hoog' && trendDirection === 'up') {
    return t.clearlyRising(label);
  }
  if (currentPct >= 25) {
    return t.dominant(label);
  }

  return undefined;
}
