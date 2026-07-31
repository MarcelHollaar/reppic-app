/**
 * RankedBarList
 *
 * Container voor een gerangschikte lijst van RankedBarRow-items.
 * Optionele sectiekop en automatische sortering op prioriteit.
 */

import { RankedBarRow, type RankedBarRowProps } from "./RankedBarRow";
import type { PriorityLabel } from "./PriorityBadge";

export interface RankedBarListItem extends Omit<RankedBarRowProps, 'index' | 'mode'> {
  /** Sleutel voor de React key (bijv. naam of unieke id). */
  key?: string;
}

export interface RankedBarListProps {
  items: RankedBarListItem[];
  mode?: 'compact' | 'expanded';
  /** Sectiekop boven de lijst (optioneel). */
  heading?: string;
  /** Sortering op prioriteitsniveau voor weergave (Hoog eerst). */
  sortByPriority?: boolean;
  className?: string;
}

const PRIORITY_ORDER: Record<string, number> = { Hoog: 0, Middel: 1, Laag: 2 };

export function RankedBarList({
  items,
  mode = 'compact',
  heading,
  sortByPriority = false,
  className = "",
}: RankedBarListProps) {
  const sorted = sortByPriority
    ? [...items].sort((a, b) => {
        const pa = PRIORITY_ORDER[a.priorityLabel as PriorityLabel] ?? 2;
        const pb = PRIORITY_ORDER[b.priorityLabel as PriorityLabel] ?? 2;
        return pa - pb;
      })
    : items;

  return (
    <div className={`space-y-${mode === 'compact' ? '2' : '4'} ${className}`} data-testid="ranked-bar-list">
      {heading && (
        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          {heading}
        </p>
      )}
      {sorted.map((item, i) => (
        <RankedBarRow
          key={item.key ?? item.name ?? i}
          {...item}
          mode={mode}
          index={i}
        />
      ))}
    </div>
  );
}
