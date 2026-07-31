/**
 * calculateTrend.ts
 *
 * Bepaalt trendrichting en trend-labels op basis van percentage-deltas.
 * Canonieke definitie van TrendDirection voor de gehele applicatie.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type TrendDirection = 'up' | 'down' | 'stable';

export interface TrendResult {
  direction: TrendDirection;
  /** Absoluut delta in procentpunten (positief = stijging). */
  deltaAbsolute: number;
  /** Absolute waarde van het delta (altijd >= 0). */
  trendPct: number;
  /** Gelokaliseerd label, bijv. "Sterk stijgend". */
  label: string;
}

// ─── Trend-labels per taal ────────────────────────────────────────────────────

const TREND_LABELS: Record<string, {
  strongUp: string; lightUp: string; stable: string;
  lightDown: string; strongDown: string;
}> = {
  nl: { strongUp: 'Sterk stijgend',     lightUp: 'Licht stijgend',       stable: 'Stabiel',  lightDown: 'Licht dalend',         strongDown: 'Sterk dalend'          },
  en: { strongUp: 'Strongly rising',    lightUp: 'Slightly rising',      stable: 'Stable',   lightDown: 'Slightly declining',   strongDown: 'Strongly declining'    },
  de: { strongUp: 'Stark steigend',     lightUp: 'Leicht steigend',      stable: 'Stabil',   lightDown: 'Leicht sinkend',       strongDown: 'Stark sinkend'         },
  fr: { strongUp: 'Fortement en hausse',lightUp: 'Légèrement en hausse', stable: 'Stable',   lightDown: 'Légèrement en baisse', strongDown: 'Fortement en baisse'   },
  es: { strongUp: 'Fuertemente al alza',lightUp: 'Ligeramente al alza',  stable: 'Estable',  lightDown: 'Ligeramente a la baja',strongDown: 'Fuertemente a la baja' },
  it: { strongUp: 'Fortemente in crescita', lightUp: 'Lievemente in crescita', stable: 'Stabile', lightDown: 'Lievemente in calo', strongDown: 'Fortemente in calo' },
};

// ─── Publieke API ──────────────────────────────────────────────────────────────

/**
 * Geeft een gelokaliseerd trend-label.
 * Drempel: >= 10pp → sterk, anders licht.
 */
export function getTrendLabel(
  trend?: string,
  trendPct?: number,
  lang?: string,
): string {
  const t = TREND_LABELS[lang ?? 'nl'] ?? TREND_LABELS['nl'];
  const pct = trendPct ?? 0;
  if (!trend || trend === 'stable') return t.stable;
  if (trend === 'up')   return pct >= 10 ? t.strongUp   : t.lightUp;
  if (trend === 'down') return pct >= 10 ? t.strongDown : t.lightDown;
  return t.stable;
}

/**
 * Berekent trend op basis van huidig vs. vorig percentage.
 *
 * Drempel: > 2pp stijging = 'up', < -2pp = 'down', anders 'stable'.
 */
export function calculateTrend(
  currentPct: number,
  previousPct: number,
  lang = 'nl',
): TrendResult {
  const deltaAbsolute = parseFloat((currentPct - previousPct).toFixed(1));
  const trendPct = Math.abs(deltaAbsolute);

  const direction: TrendDirection =
    deltaAbsolute > 2 ? 'up'
    : deltaAbsolute < -2 ? 'down'
    : 'stable';

  const label = getTrendLabel(direction, trendPct, lang);

  return { direction, deltaAbsolute, trendPct, label };
}
