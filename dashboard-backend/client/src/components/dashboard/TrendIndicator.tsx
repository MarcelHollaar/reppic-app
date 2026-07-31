/**
 * TrendIndicator
 *
 * Toont de trendrichting + delta in procentpunten (pp).
 * Voorbeelden: ↑ +5pp  |  ↓ -3pp  |  → 0pp
 *
 * In expanded-modus wordt ook het trendLabel als tekst weergegeven.
 */

import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

export type TrendDirection = 'up' | 'down' | 'stable';

export interface TrendIndicatorProps {
  trend?: TrendDirection;
  /** Delta in procentpunten (bijv. +7 of -3). Heeft voorrang op trendPct. */
  deltaAbsolute?: number;
  /** Fallback wanneer deltaAbsolute niet beschikbaar is. */
  trendPct?: number;
  /** Vertaald trendlabel (bijv. "Stijgend", "Dalend"). Zichtbaar in expanded-modus. */
  trendLabel?: string;
  /** Toon trendLabel als tekst naast het icoon en de pp-waarde. */
  expanded?: boolean;
  className?: string;
}

export function TrendIndicator({
  trend,
  deltaAbsolute,
  trendPct,
  trendLabel,
  expanded = false,
  className = "",
}: TrendIndicatorProps) {
  const delta = deltaAbsolute !== undefined ? deltaAbsolute : (trendPct ?? 0);
  const abs = Math.abs(delta);
  const ppStr = delta === 0 ? '0pp' : delta > 0 ? `+${abs}pp` : `-${abs}pp`;

  if (!trend || trend === 'stable') {
    return (
      <span
        className={`inline-flex items-center gap-0.5 text-[9px] text-muted-foreground/70 flex-shrink-0 tabular-nums ${className}`}
        data-testid="trend-indicator-stable"
      >
        <Minus className="w-2.5 h-2.5" />
        {expanded && trendLabel ? <span>{trendLabel}</span> : <span>0pp</span>}
      </span>
    );
  }

  if (trend === 'up') {
    return (
      <span
        className={`inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-600 dark:text-amber-400 flex-shrink-0 tabular-nums ${className}`}
        data-testid="trend-indicator-up"
      >
        <ArrowUpRight className="w-2.5 h-2.5" />
        {expanded && trendLabel && <span>{trendLabel}</span>}
        <span>{ppStr}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[9px] font-semibold text-blue-500 dark:text-blue-400 flex-shrink-0 tabular-nums ${className}`}
      data-testid="trend-indicator-down"
    >
      <ArrowDownRight className="w-2.5 h-2.5" />
      {expanded && trendLabel && <span>{trendLabel}</span>}
      <span>{ppStr}</span>
    </span>
  );
}
