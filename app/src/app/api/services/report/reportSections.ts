/**
 * Maakt van de opgehaalde dashboard-JSON (operationeel + strategisch) de
 * bouwstenen voor het maandrapport:
 *  - `highlights`  → compacte kern-tegels voor in de HTML-mail
 *  - `sections`    → volledige tabellen/metrics/conclusies voor de PDF-bijlage
 *
 * De cijfers komen 1-op-1 uit dezelfde analytics-respons die de dashboards
 * tonen (backend `/api/analytics/operational` en `/api/analytics/summary`).
 * Labels worden van buitenaf meegegeven (i18n), zodat deze module taal-agnostisch
 * blijft. Alles defensief: ontbrekende velden → 0 / lege lijst.
 */

export type MetricTile = {
  label: string;
  value: string | number;
  /** Voorgeformatteerde maand-op-maand delta, bijv. "▲ +5" / "▼ −3" / "–". */
  delta?: string;
};
export type TableRow = { name: string; value: number; percentage?: number };
export type ReportSection =
  | { title: string; type: "metrics"; data: MetricTile[] }
  | { title: string; type: "table"; data: TableRow[] }
  | { title: string; type: "text"; data: string };

export type DashboardReport = {
  heading: string;
  /** Compacte tegels voor de HTML-highlights. */
  highlights: MetricTile[];
  /** Volledige secties voor de PDF. */
  sections: ReportSection[];
};

/** Labels die de mapping nodig heeft (uit i18n aangeleverd). */
export type ReportLabels = Record<string, string>;

const num = (v: unknown): number =>
  typeof v === "number" && isFinite(v) ? v : 0;

const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

function toRows(items: unknown, nameKeys: string[] = ["name"]): TableRow[] {
  return arr<Record<string, unknown>>(items)
    .map((it) => {
      const name =
        nameKeys.map((k) => it?.[k]).find((v) => typeof v === "string" && v) ||
        "—";
      return { name: String(name), value: num(it?.value ?? it?.mentions ?? 1) };
    })
    .filter((r) => r.name !== "—");
}

function avgPica(op: any): number {
  const scores = arr<{ value?: number }>(op?.picaPerformance?.phaseScores);
  if (scores.length === 0) return 0;
  return Math.round(
    scores.reduce((s, p) => s + num(p.value), 0) / scores.length,
  );
}

/**
 * Maand-op-maand delta als korte, voorgeformatteerde tekst. `undefined` als er
 * geen vorige maand is (eerste rapportperiode) — dan tonen we geen delta.
 */
function fmtDelta(curr: number, prev: number | undefined): string | undefined {
  if (prev === undefined) return undefined;
  const d = Math.round(curr - prev);
  if (d === 0) return "–";
  return d > 0 ? `▲ +${d}` : `▼ −${Math.abs(d)}`;
}

/** Kern-metrics (ruwe getallen) van het operationele dashboard. */
export function opCoreMetrics(op: any): Record<string, number> {
  return {
    totalConversations: num(op?.conversationActivity?.totalConversations),
    avgDuration: Math.round(num(op?.conversationActivity?.avgDuration)),
    avgPica: avgPica(op),
    clearNextStep: Math.round(num(op?.nextStepDiscipline?.withClearNextStep)),
    nextStepClarity: Math.round(
      num(op?.nextStepDiscipline?.avgNextStepClarity),
    ),
    dmuClarity: Math.round(num(op?.dmuInsights?.dmuClarity)),
  };
}

/** Kern-metrics (ruwe getallen) van het strategische dashboard. */
export function stratCoreMetrics(strat: any): Record<string, number> {
  const trendGroups = (strat?.trends?.trendGroups || {}) as Record<
    string,
    unknown
  >;
  const allTrendItems = Object.values(trendGroups).flatMap((g) =>
    arr<Record<string, unknown>>(g),
  );
  const sentiments = arr<Record<string, unknown>>(
    strat?.customerSatisfaction?.sentiments,
  );
  const sentTotal = sentiments.reduce((s, x) => s + num(x.value), 0);
  const sentPos = sentiments
    .filter((x) => String(x.type || "").toLowerCase().startsWith("pos"))
    .reduce((s, x) => s + num(x.value), 0);
  return {
    conversationCount: num(strat?.conversationCount),
    totalNeeds: allTrendItems.length,
    categories: Object.keys(trendGroups).length,
    positiveSentiment:
      sentTotal > 0 ? Math.round((sentPos / sentTotal) * 100) : 0,
    reportedIssues: arr(strat?.customerSatisfaction?.issues).length,
    uniqueCompetitors: arr(strat?.competition?.competitors).length,
  };
}

/**
 * "Grootste stijgers/dalers": top-3 kern-metrics op absolute verandering.
 * Alleen zinvol (en aangeroepen) wanneer er een vorige maand is.
 */
function biggestMovers(
  curr: Record<string, number>,
  prev: Record<string, number>,
  L: ReportLabels,
): MetricTile[] {
  return Object.keys(curr)
    .map((key) => ({ key, delta: Math.round(curr[key] - (prev[key] ?? 0)) }))
    .filter((m) => m.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3)
    .map((m) => ({
      label: L[m.key] ?? m.key,
      value: `${prev[m.key] ?? 0} → ${curr[m.key]}`,
      delta: fmtDelta(curr[m.key], prev[m.key] ?? 0),
    }));
}

/**
 * Operationeel dashboard → rapportblok.
 * `prevOp` (optioneel) = zelfde dashboard-data van de maand ervoor; dan krijgen
 * de kern-tegels een maand-op-maand delta + een "grootste stijgers/dalers"-blok.
 */
export function mapOperational(
  op: any,
  L: ReportLabels,
  prevOp?: any,
): DashboardReport {
  const core = opCoreMetrics(op);
  const prev = prevOp !== undefined ? opCoreMetrics(prevOp) : undefined;
  const d = (key: string) => fmtDelta(core[key], prev?.[key]);

  const phaseRows = toRows(op?.picaPerformance?.phaseScores);
  const resistances = toRows(op?.resistanceNeeds?.topResistances);
  const triggers = toRows(op?.resistanceNeeds?.commercialTriggers);

  const metrics: MetricTile[] = [
    {
      label: L.totalConversations,
      value: core.totalConversations,
      delta: d("totalConversations"),
    },
    ...(core.avgDuration > 0
      ? [
          {
            label: L.avgDuration,
            value: `${core.avgDuration}`,
            delta: d("avgDuration"),
          },
        ]
      : []),
    { label: L.avgPica, value: `${core.avgPica}%`, delta: d("avgPica") },
    {
      label: L.clearNextStep,
      value: `${core.clearNextStep}%`,
      delta: d("clearNextStep"),
    },
    {
      label: L.nextStepClarity,
      value: `${core.nextStepClarity}%`,
      delta: d("nextStepClarity"),
    },
    { label: L.dmuClarity, value: `${core.dmuClarity}%`, delta: d("dmuClarity") },
  ];

  const sections: ReportSection[] = [
    { title: L.keyMetrics, type: "metrics", data: metrics },
  ];
  if (prev) {
    const movers = biggestMovers(core, prev, L);
    if (movers.length)
      sections.push({ title: L.biggestMovers, type: "metrics", data: movers });
  }
  // Plan-conclusies expliciet labelen: deze AI-teksten vergelijken tegen het
  // salesplan, niet tegen vorige maand — dat onderscheid moet zichtbaar zijn.
  const planTitle = (title: string) => `${title} (${L.planBasisNote})`;
  if (phaseRows.length)
    sections.push({ title: L.phaseScores, type: "table", data: phaseRows });
  if (op?.picaPerformance?.comparison)
    sections.push({
      title: planTitle(L.picaConclusion),
      type: "text",
      data: String(op.picaPerformance.comparison),
    });
  if (resistances.length)
    sections.push({ title: L.resistances, type: "table", data: resistances });
  if (triggers.length)
    sections.push({ title: L.triggers, type: "table", data: triggers });
  if (op?.resistanceNeeds?.comparison)
    sections.push({
      title: planTitle(L.resistanceConclusion),
      type: "text",
      data: String(op.resistanceNeeds.comparison),
    });
  if (op?.nextStepDiscipline?.comparison)
    sections.push({
      title: planTitle(L.nextStepConclusion),
      type: "text",
      data: String(op.nextStepDiscipline.comparison),
    });
  if (op?.dmuInsights?.comparison)
    sections.push({
      title: planTitle(L.dmuConclusion),
      type: "text",
      data: String(op.dmuInsights.comparison),
    });

  return {
    heading: L.operationalHeading,
    highlights: [
      {
        label: L.totalConversations,
        value: core.totalConversations,
        delta: d("totalConversations"),
      },
      { label: L.avgPica, value: `${core.avgPica}%`, delta: d("avgPica") },
      {
        label: L.clearNextStep,
        value: `${core.clearNextStep}%`,
        delta: d("clearNextStep"),
      },
    ],
    sections,
  };
}

/**
 * Strategisch dashboard → rapportblok. `prevStrat` (optioneel) = vorige maand;
 * zie mapOperational.
 */
export function mapStrategic(
  strat: any,
  L: ReportLabels,
  prevStrat?: any,
): DashboardReport {
  const core = stratCoreMetrics(strat);
  const prev = prevStrat !== undefined ? stratCoreMetrics(prevStrat) : undefined;
  const d = (key: string) => fmtDelta(core[key], prev?.[key]);

  const trendGroups = (strat?.trends?.trendGroups || {}) as Record<
    string,
    unknown
  >;
  const allTrendItems = Object.values(trendGroups).flatMap((g) =>
    arr<Record<string, unknown>>(g),
  );

  const issues = toRows(strat?.customerSatisfaction?.issues);
  const competitors = toRows(strat?.competition?.competitors, [
    "name",
    "competitor",
  ]);
  const strengths = toRows(strat?.competition?.strengths);
  const execution = toRows(strat?.proposition?.execution);
  const resonance = toRows(strat?.proposition?.resonance);

  // Top-behoeften afvlakken (per groep gesorteerd, top 10 totaal).
  const topNeeds = allTrendItems
    .map((it) => ({ name: String(it.name ?? "—"), value: num(it.value) }))
    .filter((r) => r.name !== "—")
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const metrics: MetricTile[] = [
    {
      label: L.conversationCount,
      value: core.conversationCount,
      delta: d("conversationCount"),
    },
    { label: L.totalNeeds, value: core.totalNeeds, delta: d("totalNeeds") },
    { label: L.categories, value: core.categories, delta: d("categories") },
    {
      label: L.positiveSentiment,
      value: `${core.positiveSentiment}%`,
      delta: d("positiveSentiment"),
    },
    {
      label: L.reportedIssues,
      value: core.reportedIssues,
      delta: d("reportedIssues"),
    },
    {
      label: L.uniqueCompetitors,
      value: core.uniqueCompetitors,
      delta: d("uniqueCompetitors"),
    },
  ];

  const sections: ReportSection[] = [
    { title: L.keyMetrics, type: "metrics", data: metrics },
  ];
  if (prev) {
    const movers = biggestMovers(core, prev, L);
    if (movers.length)
      sections.push({ title: L.biggestMovers, type: "metrics", data: movers });
  }
  const planTitle = (title: string) => `${title} (${L.planBasisNote})`;
  if (topNeeds.length)
    sections.push({ title: L.topNeeds, type: "table", data: topNeeds });
  if (strat?.trends?.comparison)
    sections.push({
      title: planTitle(L.trendsConclusion),
      type: "text",
      data: String(strat.trends.comparison),
    });
  if (issues.length)
    sections.push({ title: L.topIssues, type: "table", data: issues });
  if (strat?.customerSatisfaction?.comparison)
    sections.push({
      title: planTitle(L.satisfactionConclusion),
      type: "text",
      data: String(strat.customerSatisfaction.comparison),
    });
  if (competitors.length)
    sections.push({ title: L.competitors, type: "table", data: competitors });
  if (strengths.length)
    sections.push({ title: L.strengths, type: "table", data: strengths });
  if (strat?.competition?.comparison)
    sections.push({
      title: planTitle(L.competitionConclusion),
      type: "text",
      data: String(strat.competition.comparison),
    });
  if (execution.length)
    sections.push({ title: L.execution, type: "table", data: execution });
  if (resonance.length)
    sections.push({ title: L.resonance, type: "table", data: resonance });
  if (strat?.proposition?.comparison)
    sections.push({
      title: planTitle(L.propositionConclusion),
      type: "text",
      data: String(strat.proposition.comparison),
    });

  return {
    heading: L.strategicHeading,
    highlights: [
      {
        label: L.conversationCount,
        value: core.conversationCount,
        delta: d("conversationCount"),
      },
      { label: L.totalNeeds, value: core.totalNeeds, delta: d("totalNeeds") },
      {
        label: L.positiveSentiment,
        value: `${core.positiveSentiment}%`,
        delta: d("positiveSentiment"),
      },
    ],
    sections,
  };
}

/** Heeft dit bedrijf überhaupt data in de periode? (voor "lege maand overslaan") */
export function hasReportData(op: any, strat: any): boolean {
  return (
    num(op?.conversationActivity?.totalConversations) > 0 ||
    num(strat?.conversationCount) > 0
  );
}
