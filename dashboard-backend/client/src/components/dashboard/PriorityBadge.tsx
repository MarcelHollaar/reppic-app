/**
 * PriorityBadge
 *
 * Kleurgecodeerde badge voor prioriteitsniveau: Hoog / Middel / Laag.
 * Optionele tooltip met reden en trendlabel.
 */

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type PriorityLabel = 'Hoog' | 'Middel' | 'Laag';

export interface PriorityBadgeProps {
  label: PriorityLabel | string;
  /** Toelichting waarom dit item deze prioriteit heeft. */
  reason?: string;
  trendLabel?: string;
  /** Wikkel de badge in een tooltip met reden + trendlabel. */
  withTooltip?: boolean;
  className?: string;
}

function BadgePill({ label, className = "" }: { label: string; className?: string }) {
  if (label === 'Hoog') {
    return (
      <span
        className={`inline-flex items-center rounded-sm px-1.5 py-0 text-[8px] font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 flex-shrink-0 cursor-default ${className}`}
        data-testid="priority-badge-hoog"
      >
        {label}
      </span>
    );
  }
  if (label === 'Middel') {
    return (
      <span
        className={`inline-flex items-center rounded-sm px-1.5 py-0 text-[8px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 flex-shrink-0 cursor-default ${className}`}
        data-testid="priority-badge-middel"
      >
        {label}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center rounded-sm px-1.5 py-0 text-[8px] font-semibold bg-muted text-muted-foreground flex-shrink-0 cursor-default ${className}`}
      data-testid="priority-badge-laag"
    >
      {label}
    </span>
  );
}

export function PriorityBadge({ label, reason, trendLabel, withTooltip = false, className }: PriorityBadgeProps) {
  const badge = <BadgePill label={label} className={className} />;

  if (!withTooltip || !reason) return badge;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px] text-xs space-y-1">
        <p className="font-semibold">Prioriteit {label}</p>
        {trendLabel && <p className="text-muted-foreground">{trendLabel}</p>}
        <p className="text-muted-foreground">{reason}</p>
      </TooltipContent>
    </Tooltip>
  );
}
