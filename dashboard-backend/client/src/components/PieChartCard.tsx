import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Maximize2, ChevronRight, Info } from "lucide-react";
import { computePriority, type PriorityLabel } from "@/lib/priorityScore";
import { useLanguage } from "@/lib/LanguageContext";
import { TrendIndicator } from "./dashboard/TrendIndicator";
import { PriorityBadge } from "./dashboard/PriorityBadge";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TrendDirection = 'up' | 'down' | 'stable';
export type PriorityLevel = 'hoog' | 'middel' | 'laag' | 'high' | 'medium' | 'low';

export interface DataItem {
  name: string;
  value?: number;
  absoluteValue?: number;
  pct?: number;
  color: string;
  trend?: TrendDirection;
  trendPct?: number;
  priority?: PriorityLevel;
  // Sprint 1 extended fields
  currentValue?: number;
  previousValue?: number;
  deltaAbsolute?: number;
  deltaRelative?: number;
  impactLevel?: 'high' | 'medium' | 'low' | 'hoog' | 'middel' | 'laag';
  alertText?: string;
  shortSummary?: string;
}

interface PieChartCardProps {
  title: string;
  data: DataItem[];
  summary?: string;
  alerts?: string[];
  className?: string;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PieChartCard({ title, data, summary, alerts, className }: PieChartCardProps) {
  const [open, setOpen] = useState(false);

  const { language } = useLanguage();
  const lang = language || 'nl';

  const total = data.reduce((sum, i) => sum + (i.value ?? 0), 0);

  // Normalise an explicit priority field (handles 'high'/'hoog'/'Hoog' etc.)
  function normalisePriority(p: string | undefined): 'Hoog' | 'Middel' | 'Laag' | null {
    if (!p) return null;
    const l = p.toLowerCase();
    if (l === 'hoog' || l === 'high') return 'Hoog';
    if (l === 'middel' || l === 'medium') return 'Middel';
    if (l === 'laag' || l === 'low') return 'Laag';
    return null;
  }

  const chartData = data.map(item => {
    const pct = item.pct !== undefined
      ? Math.round(item.pct)
      : total > 0 ? Math.round(((item.value ?? 0) / total) * 100) : 0;
    const abs = item.absoluteValue !== undefined ? item.absoluteValue : (item.value ?? 0);
    const scored = computePriority({
      name: item.name, computedPct: pct,
      trend: item.trend, trendPct: item.trendPct,
      deltaAbsolute: item.deltaAbsolute, lang,
    });
    // Respect an explicit priority if the data already carries one (demo data / AI output)
    const explicitLabel = normalisePriority(item.priority as string | undefined);
    return {
      ...item,
      computedPct: pct,
      computedAbs: abs,
      ...scored,
      ...(explicitLabel ? { priorityLabel: explicitLabel } : {}),
    };
  });

  if (!data.length) {
    return (
      <Card className={`${className ?? ""} flex flex-col`} data-testid={`chart-card-${title.toLowerCase().replace(/\s+/g, "-")}`}>
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0 flex flex-col flex-1 items-center justify-center gap-2 min-h-24">
          <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground/60 animate-spin" />
          <p className="text-[10px] text-muted-foreground text-center">
            {lang === 'nl' ? 'Wachten op data...' :
             lang === 'en' ? 'Waiting for data...' :
             lang === 'de' ? 'Warte auf Daten...' :
             lang === 'fr' ? 'En attente de données...' :
             lang === 'es' ? 'Esperando datos...' :
             'In attesa di dati...'}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Count high-priority items for urgency signal
  const highCount = chartData.filter(i => i.priorityLabel === 'Hoog').length;

  return (
    <>
      {/* ── Main card ── */}
      <Card className={`${className ?? ""} group relative flex flex-col`} data-testid={`chart-card-${title.toLowerCase().replace(/\s+/g, "-")}`}>
        <button className="absolute top-2 right-2 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors z-10 p-0.5 rounded" onClick={() => setOpen(true)} aria-label="Vergroot" data-testid="button-expand-chart">
          <Maximize2 className="w-3.5 h-3.5" />
        </button>

        <CardHeader className="pb-2 pt-3 px-4">
          <div className="flex items-start justify-between gap-2 pr-5">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {highCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[8px] font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 flex-shrink-0 mt-0.5">
                <AlertTriangle className="w-2.5 h-2.5" />
                {highCount}
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="px-4 pb-3 pt-0 flex flex-col flex-1 gap-2">
          {summary && <p className="text-[10px] text-muted-foreground leading-snug italic">{summary}</p>}
          <div className="space-y-2 flex-1">
            {chartData.map((item, i) => (
              <div key={i} className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-[10px] text-muted-foreground leading-tight truncate flex-1 min-w-0">{item.name}</span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <TrendIndicator trend={item.trend} deltaAbsolute={item.deltaAbsolute} trendPct={item.trendPct} trendLabel={item.trendLabel} />
                    <PriorityBadge label={item.priorityLabel} reason={item.priorityReason} trendLabel={item.trendLabel} withTooltip />
                    <span className="text-[10px] font-medium tabular-nums">
                      {item.computedPct}%{" "}
                      <span className="text-muted-foreground font-normal">({item.computedAbs})</span>
                    </span>
                  </div>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${item.computedPct}%`, backgroundColor: item.color }} />
                </div>
                {item.shortSummary && (
                  <p className="text-[9px] text-muted-foreground/70 leading-snug pl-3.5 italic">{item.shortSummary}</p>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-1 pt-1 border-t border-border/50">
            <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 gap-1 text-muted-foreground flex-1" onClick={() => setOpen(true)} data-testid="button-drilldown">
              <ChevronRight className="w-3 h-3" />
              Detail
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Expand / detail dialog ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg" data-testid={`chart-dialog-${title.toLowerCase().replace(/\s+/g, "-")}`}>
          <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {summary && <p className="text-xs text-muted-foreground leading-relaxed italic">{summary}</p>}
            <div className="space-y-4">
              {chartData.map((item, i) => (
                <div key={i} className="space-y-1.5" data-testid={`chart-legend-item-${i}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-sm text-foreground truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <TrendIndicator trend={item.trend} deltaAbsolute={item.deltaAbsolute} trendPct={item.trendPct} trendLabel={item.trendLabel} expanded />
                      <PriorityBadge label={item.priorityLabel} reason={item.priorityReason} trendLabel={item.trendLabel} />
                      <span className="text-sm font-medium tabular-nums">
                        {item.computedPct}%{" "}
                        <span className="text-muted-foreground font-normal">({item.computedAbs})</span>
                      </span>
                    </div>
                  </div>
                  <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${item.computedPct}%`, backgroundColor: item.color }} />
                  </div>
                  <div className="flex items-start gap-1.5 pt-0.5">
                    <Info className="w-3 h-3 text-muted-foreground/60 flex-shrink-0 mt-0.5" />
                    <span className="text-[10px] text-muted-foreground/80 leading-snug">{item.priorityReason}</span>
                  </div>
                  {item.shortSummary && (
                    <p className="text-[10px] text-muted-foreground italic pl-4">{item.shortSummary}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </>
  );
}
