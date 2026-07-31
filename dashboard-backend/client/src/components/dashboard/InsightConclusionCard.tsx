/**
 * InsightConclusionCard
 *
 * Gestructureerde AI-managementconclusiekaart — canonieke implementatie.
 * Bestaat uit drie zones:
 *   1. Data-overzicht (altijd zichtbaar): RankedBarList + InsightSummaryBanner
 *   2. Management-samenvatting (whatWeSee in blauw geaccentueerd blok)
 *   3. Detailsecties + Actieblok (InsightActionList)
 *
 * ManagementConclusionCard re-exporteert dit component voor achterwaartse compatibiliteit.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Eye, HelpCircle, Wrench, TrendingUp, Zap,
  Sparkles, Loader2, RefreshCw, AlertTriangle,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { getTrendLabel } from "@/lib/priorityScore";
import {
  useManagementConclusion,
  enrichedToMgmtItems,
  CONCLUSION_SECTION_META,
  type ManagementConclusionOutput,
  type ManagementConclusionInput,
  type ConclusionThemeType,
} from "@/lib/managementConclusion";
import type { EnrichedInsightItem } from "@/lib/enrichInsights";
import { RankedBarList, type RankedBarListItem } from "./RankedBarList";
import { InsightSummaryBanner } from "./InsightSummaryBanner";
import { InsightActionList } from "./InsightActionList";

// ─── Labels ───────────────────────────────────────────────────────────────────

const CARD_LABELS: Record<string, {
  generate: string; regenerate: string; generating: string;
  noConclusion: string; error: string; dataOverview: string; actionBlock: string;
}> = {
  nl: { generate: 'Conclusie genereren', regenerate: 'Opnieuw genereren', generating: 'Conclusie wordt gegenereerd…', noConclusion: 'Klik op de knop om een AI-managementconclusie te genereren.', error: 'Fout bij het genereren van de conclusie.', dataOverview: 'Data-overzicht', actionBlock: 'Aanbevolen acties' },
  en: { generate: 'Generate conclusion', regenerate: 'Regenerate', generating: 'Generating conclusion…', noConclusion: 'Click the button to generate an AI management conclusion.', error: 'Error generating conclusion.', dataOverview: 'Data overview', actionBlock: 'Recommended actions' },
  de: { generate: 'Schlussfolgerung generieren', regenerate: 'Neu generieren', generating: 'Schlussfolgerung wird generiert…', noConclusion: 'Klicken Sie auf die Schaltfläche.', error: 'Fehler beim Generieren.', dataOverview: 'Datenübersicht', actionBlock: 'Empfohlene Maßnahmen' },
  fr: { generate: 'Générer une conclusion', regenerate: 'Régénérer', generating: 'Génération en cours…', noConclusion: 'Cliquez pour générer une conclusion IA.', error: 'Erreur lors de la génération.', dataOverview: 'Aperçu des données', actionBlock: 'Actions recommandées' },
  es: { generate: 'Generar conclusión', regenerate: 'Regenerar', generating: 'Generando conclusión…', noConclusion: 'Haga clic para generar una conclusión IA.', error: 'Error al generar la conclusión.', dataOverview: 'Resumen de datos', actionBlock: 'Acciones recomendadas' },
  it: { generate: 'Genera conclusione', regenerate: 'Rigenera', generating: 'Generazione in corso…', noConclusion: 'Fare clic per generare una conclusione IA.', error: 'Errore nella generazione.', dataOverview: 'Panoramica dati', actionBlock: 'Azioni raccomandate' },
};

// ─── Conclusiesecties (likelyCause / operationalMeaning / strategicMeaning) ──

const DETAIL_SECTIONS: Array<{
  key: Exclude<keyof ManagementConclusionOutput, 'whatWeSee' | 'recommendedAction'>;
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  headingClass: string;
}> = [
  { key: 'likelyCause',        icon: HelpCircle, iconClass: "text-amber-500 dark:text-amber-400",   headingClass: "text-amber-700 dark:text-amber-300" },
  { key: 'operationalMeaning', icon: Wrench,     iconClass: "text-green-600 dark:text-green-400",   headingClass: "text-green-700 dark:text-green-300" },
  { key: 'strategicMeaning',   icon: TrendingUp, iconClass: "text-violet-500 dark:text-violet-400", headingClass: "text-violet-700 dark:text-violet-300" },
];

// ─── Helper: EnrichedInsightItem → RankedBarListItem ─────────────────────────

function toRankedItems(items: EnrichedInsightItem[], lang: string): RankedBarListItem[] {
  return items.map(item => ({
    name: item.name,
    color: item.color ?? 'hsl(var(--chart-1))',
    pct: item.pct ?? (item as any).value ?? 0,
    trend: item.trendDirection ?? item.trend,
    deltaAbsolute: item.deltaAbsolute ?? 0,
    trendPct: item.trendPct,
    trendLabel: item.trendLabel || getTrendLabel(item.trend, item.trendPct, lang),
    priorityLabel: item.priorityLabel ?? 'Laag',
    priorityReason: item.priorityReason,
    alertText: item.alertText,
    shortSummary: item.shortSummary,
  }));
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface InsightConclusionCardProps {
  title: string;
  theme: string;
  type?: ConclusionThemeType;
  items: EnrichedInsightItem[];
  initialConclusion?: ManagementConclusionOutput;
  showGenerate?: boolean;
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function InsightConclusionCard({
  title,
  theme,
  type = 'general',
  items,
  initialConclusion,
  showGenerate = true,
  className,
}: InsightConclusionCardProps) {
  const { language } = useLanguage();
  const lang = language in CONCLUSION_SECTION_META ? language : 'nl';
  const sectionMeta = CONCLUSION_SECTION_META[lang];
  const labels = CARD_LABELS[lang] ?? CARD_LABELS['nl'];

  const { conclusion, loading, error, generate, reset } = useManagementConclusion();
  const activeConcl = conclusion ?? initialConclusion ?? null;

  const isDemoMode = new URLSearchParams(window.location.search).get('demo') === 'true';

  const handleGenerate = () => {
    generate({
      theme,
      type,
      language: lang,
      items: enrichedToMgmtItems(items),
      demo: isDemoMode,
    } as ManagementConclusionInput);
  };

  const rankedItems = toRankedItems(items, lang);

  return (
    <Card
      className={className}
      data-testid={`insight-conclusion-${theme.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {/* ── Header ── */}
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Zap className="w-4 h-4 text-primary flex-shrink-0" />
            <CardTitle className="text-sm font-semibold truncate">{title}</CardTitle>
          </div>

          {showGenerate && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {activeConcl && !loading && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11px] px-2 gap-1 text-muted-foreground"
                  onClick={() => { reset(); handleGenerate(); }}
                  data-testid="button-regenerate-conclusion"
                >
                  <RefreshCw className="w-3 h-3" />
                  {labels.regenerate}
                </Button>
              )}
              {!activeConcl && !loading && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px] px-2.5 gap-1"
                  onClick={handleGenerate}
                  data-testid="button-generate-conclusion"
                >
                  <Sparkles className="w-3 h-3 text-primary" />
                  {labels.generate}
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-4">
        {/* ── 1. Data-overzicht ── */}
        <div className="space-y-2">
          <RankedBarList
            items={rankedItems}
            mode="compact"
            heading={labels.dataOverview}
          />
          <InsightSummaryBanner items={items} lang={lang} className="pt-0.5" />
        </div>

        <div className="border-t border-border/50" />

        {/* ── Loading ── */}
        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-8">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">{labels.generating}</p>
          </div>
        )}

        {/* ── Fout ── */}
        {!loading && error && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
            <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
            <p className="text-sm text-destructive">{labels.error}</p>
          </div>
        )}

        {/* ── Lege staat ── */}
        {!loading && !error && !activeConcl && (
          <p className="text-sm text-muted-foreground italic py-2">{labels.noConclusion}</p>
        )}

        {/* ── 2–4. Conclusie ── */}
        {!loading && !error && activeConcl && (
          <div className="space-y-4" data-testid="insight-conclusion-content">

            {/* 2. Management-samenvatting (whatWeSee) */}
            {activeConcl.whatWeSee && (
              <div
                className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3.5 py-3"
                data-testid="conclusion-section-whatWeSee"
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Eye className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 flex-shrink-0" />
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                    {sectionMeta.whatWeSee}
                  </p>
                </div>
                <p className="text-sm leading-relaxed text-blue-900 dark:text-blue-100 pl-5">
                  {activeConcl.whatWeSee}
                </p>
              </div>
            )}

            {/* 3. Detailsecties */}
            <div className="space-y-3.5">
              {DETAIL_SECTIONS.map(({ key, icon: Icon, iconClass, headingClass }) => {
                const body = activeConcl[key];
                if (!body) return null;
                return (
                  <div key={key} className="space-y-1.5" data-testid={`conclusion-section-${key}`}>
                    <div className="flex items-center gap-1.5">
                      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${iconClass}`} />
                      <p className={`text-xs font-semibold ${headingClass}`}>
                        {sectionMeta[key]}
                      </p>
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground pl-5">{body}</p>
                  </div>
                );
              })}
            </div>

            {/* 4. Actieblok */}
            {activeConcl.recommendedAction && (
              <InsightActionList
                text={activeConcl.recommendedAction}
                heading={labels.actionBlock}
                data-testid="conclusion-section-recommendedAction"
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
