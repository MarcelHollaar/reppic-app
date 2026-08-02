/**
 * Management Summary voor het maandrapport.
 *
 * Hergebruikt de BESTAANDE managementconclusie-generator van de dashboard-backend
 * (`POST /api/ai/management-conclusion`, `generateManagementConclusion`), die al
 * het vaste 5-delige format levert — Wat zien we? / Waarschijnlijke oorzaak /
 * Operationele betekenis / Strategische betekenis / Aanbevolen managementactie —
 * in alle 6 talen en consistent met de ConclusionCard in de app.
 *
 * We voeden alleen de PERCENTAGE-metrics (de promptbouwer verwacht `pct` + trend
 * per item), elk met de maand-op-maand-delta. FAIL-OPEN: elke fout levert null op,
 * dan gaat het rapport zonder Management Summary uit.
 */

import { companyToken, DASHBOARD_BASE_URL } from "./dashboardReportData";

export type ManagementSummary = {
  whatWeSee: string;
  likelyCause: string;
  operationalMeaning: string;
  strategicMeaning: string;
  recommendedAction: string;
};

type ConclusionItem = {
  label: string;
  pct: number;
  trend: "up" | "down" | "stable";
  deltaAbsolute: number;
};

/** Bouwt één item uit een huidige % + vorige %. */
function item(label: string, curr: number, prev: number | undefined): ConclusionItem {
  const delta = prev === undefined ? 0 : Math.round(curr - prev);
  return {
    label,
    pct: Math.round(curr),
    deltaAbsolute: delta,
    trend: delta > 0 ? "up" : delta < 0 ? "down" : "stable",
  };
}

export type ManagementSummaryInput = {
  companyId: string;
  companyTitle: string;
  lang: string;
  /** Labels voor de percentage-metrics (uit i18n). */
  labels: {
    avgPica: string;
    clearNextStep: string;
    nextStepClarity: string;
    dmuClarity: string;
    positiveSentiment: string;
  };
  op: Record<string, number>;
  prevOp: Record<string, number> | undefined;
  strat: Record<string, number>;
  prevStrat: Record<string, number> | undefined;
};

export async function generateManagementSummary(
  input: ManagementSummaryInput,
): Promise<ManagementSummary | null> {
  try {
    const L = input.labels;
    const items: ConclusionItem[] = [
      item(L.avgPica, input.op.avgPica, input.prevOp?.avgPica),
      item(L.clearNextStep, input.op.clearNextStep, input.prevOp?.clearNextStep),
      item(L.nextStepClarity, input.op.nextStepClarity, input.prevOp?.nextStepClarity),
      item(L.dmuClarity, input.op.dmuClarity, input.prevOp?.dmuClarity),
      item(L.positiveSentiment, input.strat.positiveSentiment, input.prevStrat?.positiveSentiment),
    ];

    const res = await fetch(`${DASHBOARD_BASE_URL}/api/ai/management-conclusion`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${companyToken(input.companyId)}`,
      },
      body: JSON.stringify({
        theme: input.companyTitle,
        type: "general",
        language: input.lang,
        items,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`management-conclusion ${res.status}: ${body.slice(0, 200)}`);
    }
    const raw = (await res.json()) as Partial<ManagementSummary>;
    const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const out: ManagementSummary = {
      whatWeSee: s(raw.whatWeSee),
      likelyCause: s(raw.likelyCause),
      operationalMeaning: s(raw.operationalMeaning),
      strategicMeaning: s(raw.strategicMeaning),
      recommendedAction: s(raw.recommendedAction),
    };
    // Alleen bruikbaar als er ten minste iets terugkwam.
    return out.whatWeSee || out.recommendedAction ? out : null;
  } catch (error) {
    console.error(
      "[MonthlyReport] Management Summary mislukt (rapport gaat zonder samenvatting uit):",
      error,
    );
    return null;
  }
}
