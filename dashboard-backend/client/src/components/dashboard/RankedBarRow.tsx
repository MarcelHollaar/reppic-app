/**
 * RankedBarRow
 *
 * Eén rij in een gerangschikte lijst met voortgangsbalk.
 * Bevat: kleurstip · naam · trendindicator · prioriteitsbadge · percentage · balk.
 * Optioneel: alertregel, korte samenvatting, prioriteitsreden (expanded-modus).
 */

import { TrendIndicator, type TrendDirection } from "./TrendIndicator";
import { PriorityBadge, type PriorityLabel } from "./PriorityBadge";
import { InsightAlert } from "./InsightAlert";
import { Info } from "lucide-react";

export interface RankedBarRowProps {
  name: string;
  color: string;
  /** Weergavepercentage (0–100). */
  pct: number;
  /** Absolute telling (bijv. aantal gesprekken). */
  abs?: number;
  trend?: TrendDirection;
  trendPct?: number;
  deltaAbsolute?: number;
  trendLabel?: string;
  priorityLabel?: PriorityLabel | string;
  priorityReason?: string;
  alertText?: string;
  shortSummary?: string;
  /**
   * compact (standaard): kleine kleurstip, compacte tekst — voor gebruik in kaartlijsten.
   * expanded: grotere kleurstip, volledige tekst + balk + reden — voor gebruik in dialogen.
   */
  mode?: 'compact' | 'expanded';
  /** Index voor data-testid. */
  index?: number;
}

export function RankedBarRow({
  name,
  color,
  pct,
  abs,
  trend,
  trendPct,
  deltaAbsolute,
  trendLabel,
  priorityLabel,
  priorityReason,
  alertText,
  shortSummary,
  mode = 'compact',
  index = 0,
}: RankedBarRowProps) {
  const isExpanded = mode === 'expanded';

  return (
    <div
      className="space-y-0.5"
      data-testid={`ranked-bar-row-${index}`}
    >
      {/* Alertregel (alleen indien aanwezig) */}
      {alertText && (
        <InsightAlert text={alertText} indent />
      )}

      {/* Hoofdrij */}
      <div className={`flex items-center ${isExpanded ? 'gap-2' : 'gap-1.5'}`}>
        {/* Kleurstip */}
        <span
          className={`rounded-sm flex-shrink-0 ${isExpanded ? 'w-3 h-3' : 'w-2 h-2'}`}
          style={{ backgroundColor: color }}
        />

        {/* Naam */}
        <span
          className={`${isExpanded ? 'text-sm text-foreground' : 'text-[10px] text-muted-foreground leading-tight'} truncate flex-1 min-w-0`}
        >
          {name}
        </span>

        {/* Trend + Prioriteit + Waarde */}
        <div className={`flex items-center flex-shrink-0 ${isExpanded ? 'gap-2' : 'gap-1'}`}>
          <TrendIndicator
            trend={trend}
            deltaAbsolute={deltaAbsolute}
            trendPct={trendPct}
            trendLabel={trendLabel}
            expanded={isExpanded}
          />
          {priorityLabel && (
            <PriorityBadge
              label={priorityLabel}
              reason={priorityReason}
              trendLabel={trendLabel}
              withTooltip={!isExpanded}
            />
          )}
          <span className={`${isExpanded ? 'text-sm' : 'text-[10px]'} font-medium tabular-nums`}>
            {pct}%
            {abs !== undefined && (
              <span className="text-muted-foreground font-normal"> ({abs})</span>
            )}
          </span>
        </div>
      </div>

      {/* Voortgangsbalk */}
      <div className={`w-full bg-muted rounded-full overflow-hidden ${isExpanded ? 'h-3' : 'h-1.5'}`}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
        />
      </div>

      {/* Prioriteitsreden (alleen expanded) */}
      {isExpanded && priorityReason && (
        <div className="flex items-start gap-1.5 pt-0.5">
          <Info className="w-3 h-3 text-muted-foreground/60 flex-shrink-0 mt-0.5" />
          <span className="text-[10px] text-muted-foreground/80 leading-snug">{priorityReason}</span>
        </div>
      )}

      {/* Korte samenvatting */}
      {shortSummary && (
        <p className="text-[9px] text-muted-foreground/70 leading-snug pl-3.5 italic">{shortSummary}</p>
      )}
    </div>
  );
}
