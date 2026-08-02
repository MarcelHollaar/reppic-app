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

export type MetricTile = { label: string; value: string | number };
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

/** Operationeel dashboard → rapportblok. */
export function mapOperational(op: any, L: ReportLabels): DashboardReport {
  const totalConversations = num(op?.conversationActivity?.totalConversations);
  const avgDuration = Math.round(num(op?.conversationActivity?.avgDuration));
  const pica = avgPica(op);
  const withClearNextStep = Math.round(
    num(op?.nextStepDiscipline?.withClearNextStep),
  );
  const nextStepClarity = Math.round(
    num(op?.nextStepDiscipline?.avgNextStepClarity),
  );
  const dmuClarity = Math.round(num(op?.dmuInsights?.dmuClarity));

  const phaseRows = toRows(op?.picaPerformance?.phaseScores);
  const resistances = toRows(op?.resistanceNeeds?.topResistances);
  const triggers = toRows(op?.resistanceNeeds?.commercialTriggers);

  const metrics: MetricTile[] = [
    { label: L.totalConversations, value: totalConversations },
    ...(avgDuration > 0
      ? [{ label: L.avgDuration, value: `${avgDuration}` }]
      : []),
    { label: L.avgPica, value: `${pica}%` },
    { label: L.clearNextStep, value: `${withClearNextStep}%` },
    { label: L.nextStepClarity, value: `${nextStepClarity}%` },
    { label: L.dmuClarity, value: `${dmuClarity}%` },
  ];

  const sections: ReportSection[] = [
    { title: L.keyMetrics, type: "metrics", data: metrics },
  ];
  if (phaseRows.length)
    sections.push({ title: L.phaseScores, type: "table", data: phaseRows });
  if (op?.picaPerformance?.comparison)
    sections.push({
      title: L.picaConclusion,
      type: "text",
      data: String(op.picaPerformance.comparison),
    });
  if (resistances.length)
    sections.push({ title: L.resistances, type: "table", data: resistances });
  if (triggers.length)
    sections.push({ title: L.triggers, type: "table", data: triggers });
  if (op?.resistanceNeeds?.comparison)
    sections.push({
      title: L.resistanceConclusion,
      type: "text",
      data: String(op.resistanceNeeds.comparison),
    });
  if (op?.nextStepDiscipline?.comparison)
    sections.push({
      title: L.nextStepConclusion,
      type: "text",
      data: String(op.nextStepDiscipline.comparison),
    });
  if (op?.dmuInsights?.comparison)
    sections.push({
      title: L.dmuConclusion,
      type: "text",
      data: String(op.dmuInsights.comparison),
    });

  return {
    heading: L.operationalHeading,
    highlights: [
      { label: L.totalConversations, value: totalConversations },
      { label: L.avgPica, value: `${pica}%` },
      { label: L.clearNextStep, value: `${withClearNextStep}%` },
    ],
    sections,
  };
}

/** Strategisch dashboard → rapportblok. */
export function mapStrategic(strat: any, L: ReportLabels): DashboardReport {
  const conversationCount = num(strat?.conversationCount);

  // Trends: alle items over alle groepen.
  const trendGroups = (strat?.trends?.trendGroups || {}) as Record<
    string,
    unknown
  >;
  const allTrendItems = Object.values(trendGroups).flatMap((g) =>
    arr<Record<string, unknown>>(g),
  );
  const totalNeeds = allTrendItems.length;
  const categories = Object.keys(trendGroups).length;

  // Sentiment: positief-aandeel (intensiteit-gewogen).
  const sentiments = arr<Record<string, unknown>>(
    strat?.customerSatisfaction?.sentiments,
  );
  const sentTotal = sentiments.reduce((s, x) => s + num(x.value), 0);
  const sentPos = sentiments
    .filter((x) => String(x.type || "").toLowerCase().startsWith("pos"))
    .reduce((s, x) => s + num(x.value), 0);
  const positivePct = sentTotal > 0 ? Math.round((sentPos / sentTotal) * 100) : 0;

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
    { label: L.conversationCount, value: conversationCount },
    { label: L.totalNeeds, value: totalNeeds },
    { label: L.categories, value: categories },
    { label: L.positiveSentiment, value: `${positivePct}%` },
    { label: L.reportedIssues, value: issues.length },
    { label: L.uniqueCompetitors, value: competitors.length },
  ];

  const sections: ReportSection[] = [
    { title: L.keyMetrics, type: "metrics", data: metrics },
  ];
  if (topNeeds.length)
    sections.push({ title: L.topNeeds, type: "table", data: topNeeds });
  if (strat?.trends?.comparison)
    sections.push({
      title: L.trendsConclusion,
      type: "text",
      data: String(strat.trends.comparison),
    });
  if (issues.length)
    sections.push({ title: L.topIssues, type: "table", data: issues });
  if (strat?.customerSatisfaction?.comparison)
    sections.push({
      title: L.satisfactionConclusion,
      type: "text",
      data: String(strat.customerSatisfaction.comparison),
    });
  if (competitors.length)
    sections.push({ title: L.competitors, type: "table", data: competitors });
  if (strengths.length)
    sections.push({ title: L.strengths, type: "table", data: strengths });
  if (strat?.competition?.comparison)
    sections.push({
      title: L.competitionConclusion,
      type: "text",
      data: String(strat.competition.comparison),
    });
  if (execution.length)
    sections.push({ title: L.execution, type: "table", data: execution });
  if (resonance.length)
    sections.push({ title: L.resonance, type: "table", data: resonance });
  if (strat?.proposition?.comparison)
    sections.push({
      title: L.propositionConclusion,
      type: "text",
      data: String(strat.proposition.comparison),
    });

  return {
    heading: L.strategicHeading,
    highlights: [
      { label: L.conversationCount, value: conversationCount },
      { label: L.totalNeeds, value: totalNeeds },
      { label: L.positiveSentiment, value: `${positivePct}%` },
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
