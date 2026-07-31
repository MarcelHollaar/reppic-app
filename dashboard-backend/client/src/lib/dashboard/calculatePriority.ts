/**
 * calculatePriority.ts
 *
 * Prioriteitsscoring op basis van frequentie, trend en businessimpact.
 * Canonieke bron — vervangt lib/priorityScore.ts (die nu re-exporteert).
 */

import { getTrendLabel, type TrendDirection } from "./calculateTrend";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScoreLevel   = 'hoog' | 'middel' | 'laag';
export type PriorityLabel = 'Hoog' | 'Middel' | 'Laag';

export interface PriorityResult {
  priorityLabel: PriorityLabel;
  priorityReason: string;
  trendLabel: string;
  freqScore: ScoreLevel;
  trendScore: ScoreLevel;
  impactScore: ScoreLevel;
}

// ─── Keyword-lijsten ──────────────────────────────────────────────────────────

const HIGH_IMPACT_KEYWORDS = [
  'prijs', 'price', 'pricing', 'kosten', 'cost',
  'timing', 'timingproblem', 'time pressure',
  'interne goedkeuring', 'internal approval', 'goedkeuring',
  'budget', 'cashflow',
  'dringend', 'urgent',
  'decision', 'besluit',
];

const MEDIUM_IMPACT_KEYWORDS = [
  'concurrent', 'competitor', 'competition', 'concurrentie',
  'compliance', 'gdpr', 'naleving',
  'implementatie', 'implementation', 'implementatieangst', 'implementation fear',
  'vergelijking', 'comparison',
  'onboarding', 'training',
  'weerstand', 'resistance',
];

// ─── Interne scorefuncties ────────────────────────────────────────────────────

function getFrequencyScore(pct: number): ScoreLevel {
  if (pct >= 25) return 'hoog';
  if (pct >= 15) return 'middel';
  return 'laag';
}

function getTrendScore(
  trend?: string,
  trendPct?: number,
  deltaAbsolute?: number,
): ScoreLevel {
  const delta = deltaAbsolute !== undefined ? Math.abs(deltaAbsolute) : (trendPct ?? 0);
  const isRising = trend === 'up' || (deltaAbsolute !== undefined && deltaAbsolute > 0);
  if (!isRising) return 'laag';
  if (delta >= 10) return 'hoog';
  if (delta >= 3)  return 'middel';
  return 'laag';
}

function getImpactScore(name: string): ScoreLevel {
  const lower = name.toLowerCase();
  if (HIGH_IMPACT_KEYWORDS.some(kw => lower.includes(kw.toLowerCase())))   return 'hoog';
  if (MEDIUM_IMPACT_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()))) return 'middel';
  return 'laag';
}

function resolvePriorityLabel(scores: ScoreLevel[]): PriorityLabel {
  const highCount = scores.filter(s => s === 'hoog').length;
  const midCount  = scores.filter(s => s === 'middel').length;
  if (highCount >= 2) return 'Hoog';
  if (midCount  >= 2) return 'Middel';
  return 'Laag';
}

function buildReason(
  freqScore: ScoreLevel,   freqPct: number,
  trendScore: ScoreLevel,  trend: string | undefined, trendPct: number | undefined,
  impactScore: ScoreLevel,
): string {
  const freqText =
    freqScore === 'hoog'   ? `frequentie hoog (${freqPct}%)`
    : freqScore === 'middel' ? `frequentie middel (${freqPct}%)`
    : `frequentie laag (${freqPct}%)`;

  let trendText: string;
  if      (trendScore === 'hoog')   trendText = `trend sterk stijgend (+${trendPct}pp)`;
  else if (trendScore === 'middel') trendText = `trend matig stijgend (+${trendPct}pp)`;
  else if (trend === 'down')        trendText = `trend dalend`;
  else                              trendText = `trend stabiel`;

  const impactText =
    impactScore === 'hoog'   ? 'businessimpact hoog'
    : impactScore === 'middel' ? 'businessimpact middel'
    : 'businessimpact laag';

  return `${freqText} · ${trendText} · ${impactText}`;
}

// ─── Publieke API ──────────────────────────────────────────────────────────────

export interface ComputePriorityInput {
  name: string;
  computedPct: number;
  trend?: string;
  trendPct?: number;
  deltaAbsolute?: number;
  lang?: string;
}

export function computePriority(item: ComputePriorityInput): PriorityResult {
  const freqScore   = getFrequencyScore(item.computedPct);
  const trendScore  = getTrendScore(item.trend, item.trendPct, item.deltaAbsolute);
  const impactScore = getImpactScore(item.name);

  const priorityLabel  = resolvePriorityLabel([freqScore, trendScore, impactScore]);
  const priorityReason = buildReason(
    freqScore, item.computedPct,
    trendScore, item.trend, item.trendPct,
    impactScore,
  );
  const trendLabel = getTrendLabel(
    item.trend,
    item.trendPct ?? item.deltaAbsolute,
    item.lang,
  );

  return { priorityLabel, priorityReason, trendLabel, freqScore, trendScore, impactScore };
}

// Re-export getTrendLabel voor consumers die het hier ophalen
export { getTrendLabel };
