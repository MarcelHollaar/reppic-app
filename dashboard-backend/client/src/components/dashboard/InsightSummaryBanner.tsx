/**
 * InsightSummaryBanner
 *
 * Automatisch berekende samenvattingsbanner op basis van inzichtitems.
 * Toont in één oogopslag: aantal items · stijgend · hoge prioriteit · topitem.
 * Geen AI nodig — puur client-side berekend.
 */

import { ArrowUpRight, AlertTriangle, BarChart2, TrendingUp } from "lucide-react";

export interface SummaryItem {
  name: string;
  pct?: number;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'stable';
  priorityLabel?: string;
  deltaAbsolute?: number;
}

export interface InsightSummaryBannerProps {
  items: SummaryItem[];
  lang?: string;
  className?: string;
}

// ─── Vertaalde labels ─────────────────────────────────────────────────────────

const LABELS: Record<string, {
  rising: string;
  highPriority: string;
  topItem: string;
  insights: string;
  stable: string;
}> = {
  nl: { rising: 'stijgend', highPriority: 'hoge prioriteit', topItem: 'Topitem', insights: 'inzichten', stable: 'stabiel' },
  en: { rising: 'rising', highPriority: 'high priority', topItem: 'Top item', insights: 'insights', stable: 'stable' },
  de: { rising: 'steigend', highPriority: 'hohe Priorität', topItem: 'Topitem', insights: 'Einblicke', stable: 'stabil' },
  fr: { rising: 'en hausse', highPriority: 'haute priorité', topItem: 'Top', insights: 'insights', stable: 'stable' },
  es: { rising: 'en alza', highPriority: 'prioridad alta', topItem: 'Principal', insights: 'insights', stable: 'estable' },
  it: { rising: 'in crescita', highPriority: 'alta priorità', topItem: 'Principale', insights: 'insight', stable: 'stabile' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function InsightSummaryBanner({ items, lang = 'nl', className = "" }: InsightSummaryBannerProps) {
  const l = LABELS[lang] ?? LABELS['nl'];

  const rising = items.filter(i => (i.trendDirection ?? i.trend) === 'up').length;
  const highPriority = items.filter(i => i.priorityLabel === 'Hoog').length;
  const total = items.length;

  const topItem = [...items].sort((a, b) => {
    const o: Record<string, number> = { Hoog: 0, Middel: 1, Laag: 2 };
    return (o[a.priorityLabel ?? 'Laag'] ?? 2) - (o[b.priorityLabel ?? 'Laag'] ?? 2);
  })[0];

  const stats: Array<{
    icon: React.ComponentType<{ className?: string }>;
    iconClass: string;
    value: number | string;
    label: string;
    highlight?: boolean;
  }> = [
    {
      icon: BarChart2,
      iconClass: "text-muted-foreground",
      value: total,
      label: l.insights,
    },
    {
      icon: ArrowUpRight,
      iconClass: "text-amber-500 dark:text-amber-400",
      value: rising,
      label: l.rising,
      highlight: rising > 0,
    },
    {
      icon: AlertTriangle,
      iconClass: "text-red-500 dark:text-red-400",
      value: highPriority,
      label: l.highPriority,
      highlight: highPriority > 0,
    },
  ];

  return (
    <div
      className={`flex flex-wrap items-center gap-3 text-[10px] ${className}`}
      data-testid="insight-summary-banner"
    >
      {stats.map(({ icon: Icon, iconClass, value, label, highlight }, i) => (
        <span
          key={i}
          className={`inline-flex items-center gap-1 ${highlight ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
          data-testid={`summary-stat-${i}`}
        >
          <Icon className={`w-3 h-3 ${iconClass}`} />
          <span>{value}</span>
          <span>{label}</span>
        </span>
      ))}

      {topItem && (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <TrendingUp className="w-3 h-3 text-violet-500 dark:text-violet-400" />
          <span>{l.topItem}:</span>
          <span className="font-semibold text-foreground">
            {topItem.name} ({topItem.pct ?? 0}%)
          </span>
        </span>
      )}
    </div>
  );
}
