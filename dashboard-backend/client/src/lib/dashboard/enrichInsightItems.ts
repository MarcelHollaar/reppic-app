/**
 * enrichInsightItems.ts
 *
 * Transformeert ruwe dashboard-categoriedata naar verrijkte, management-klare
 * insight-items. Combineert calculateTrend, calculatePriority en buildAlertText.
 *
 * Canonieke bron — vervangt lib/enrichInsights.ts (die nu re-exporteert).
 */

import { calculateTrend, type TrendDirection } from "./calculateTrend";
import { computePriority, type PriorityLabel } from "./calculatePriority";
import { buildAlertText } from "./buildAlertText";
import type { DataItem } from "@/components/PieChartCard";

// ─── Input ────────────────────────────────────────────────────────────────────

export interface RawInsightInput {
  label: string;
  currentPct: number;
  currentCount: number;
  previousPct: number;
  previousCount: number;
  color?: string;
  lang?: string;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface EnrichedInsightItem extends DataItem {
  deltaAbsolute: number;
  deltaRelative: number;
  trendDirection: TrendDirection;
  trendLabel: string;
  impactLevel: 'hoog' | 'middel' | 'laag';
  priorityLabel: PriorityLabel;
  priorityReason: string;
}

// ─── Impact-mapping via keyword-herkenning ────────────────────────────────────

const HIGH_IMPACT_KEYWORDS = [
  'prijs', 'price', 'budget', 'kosten', 'cost',
  'timing', 'time pressure', 'dringend', 'urgent',
  'goedkeuring', 'approval', 'besluit', 'decision',
  'cashflow',
];

const MEDIUM_IMPACT_KEYWORDS = [
  'concurrent', 'competition', 'competitor', 'concurrentie',
  'compliance', 'gdpr', 'naleving',
  'implementatie', 'implementation',
  'weerstand', 'resistance',
  'vergelijking', 'comparison',
  'onboarding', 'training',
];

function deriveImpactLevel(label: string): 'hoog' | 'middel' | 'laag' {
  const lower = label.toLowerCase();
  if (HIGH_IMPACT_KEYWORDS.some(kw => lower.includes(kw)))   return 'hoog';
  if (MEDIUM_IMPACT_KEYWORDS.some(kw => lower.includes(kw))) return 'middel';
  return 'laag';
}

// ─── Publieke API ──────────────────────────────────────────────────────────────

/**
 * Verrijkt een reeks ruwe insight-items met trend, prioriteit en alerttekst.
 */
export function enrichInsightItems(items: RawInsightInput[]): EnrichedInsightItem[] {
  return items.map(item => {
    const lang = item.lang ?? 'nl';
    const { label, currentPct, currentCount, previousPct } = item;

    // 1. Trend-berekening
    const trendResult = calculateTrend(currentPct, previousPct, lang);
    const { direction: trendDirection, deltaAbsolute, trendPct, label: trendLabel } = trendResult;

    // 2. Relatief delta
    const deltaRelative = previousPct !== 0
      ? parseFloat(((deltaAbsolute / previousPct) * 100).toFixed(1))
      : 0;

    // 3. Impact-niveau
    const impactLevel = deriveImpactLevel(label);

    // 4. Prioriteitsscoring
    const scored = computePriority({
      name: label,
      computedPct: currentPct,
      trend: trendDirection,
      trendPct,
      deltaAbsolute,
      lang,
    });

    // 5. Alerttekst (alleen bij drempeloverschrijding)
    const alertText = buildAlertText({
      label,
      priorityLabel: scored.priorityLabel,
      trendDirection,
      deltaAbsolute,
      currentPct,
      lang,
    });

    return {
      // DataItem-compatibele velden
      name:          label,
      pct:           currentPct,
      value:         currentCount,
      absoluteValue: currentCount,
      color:         item.color ?? '#94a3b8',

      // Trendvelden
      trend:          trendDirection,
      trendPct,
      trendDirection,
      trendLabel:     scored.trendLabel,

      // Deltavelden
      deltaAbsolute,
      deltaRelative,
      currentValue:  currentPct,
      previousValue: previousPct,

      // Scoring
      impactLevel,
      priorityLabel:  scored.priorityLabel,
      priorityReason: scored.priorityReason,

      // Weergavevelden
      alertText,
      shortSummary: undefined,
    } satisfies EnrichedInsightItem;
  });
}

/** Alias voor backward-compatibiliteit met lib/enrichInsights.ts. */
export const enrichInsights = enrichInsightItems;

// ─── Hulpfunctie: sorteren op urgentie ───────────────────────────────────────

const PRIORITY_ORDER: Record<PriorityLabel, number> = { Hoog: 0, Middel: 1, Laag: 2 };

export function sortByUrgency(items: EnrichedInsightItem[]): EnrichedInsightItem[] {
  return [...items].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priorityLabel] ?? 2;
    const pb = PRIORITY_ORDER[b.priorityLabel] ?? 2;
    if (pa !== pb) return pa - pb;
    return Math.abs(b.deltaAbsolute) - Math.abs(a.deltaAbsolute);
  });
}
