/**
 * AI-duiding van de maand-op-maand verandering voor het manager-rapport.
 *
 * Krijgt de kern-metrics van de huidige én vorige maand (operationeel +
 * strategisch) en vraagt de LiteLLM-gateway om per dashboard een korte,
 * zakelijke duiding: wat veranderde er en wat betekent dat. FAIL-OPEN: elke
 * fout (gateway plat, ongeldige JSON) levert lege strings op — het rapport
 * gaat dan gewoon zonder duiding uit.
 */

import { completeChat } from "@/app/api/services/litellmClient";

export type MoMNarrative = { operational: string; strategic: string };

const LANG_NAMES: Record<string, string> = {
  nl: "Dutch",
  en: "English",
  de: "German",
  fr: "French",
  es: "Spanish",
  it: "Italian",
};

export async function generateMonthOverMonthNarrative(params: {
  lang: string;
  periodLabel: string;
  prevPeriodLabel: string;
  operational: { current: Record<string, number>; previous: Record<string, number> };
  strategic: { current: Record<string, number>; previous: Record<string, number> };
}): Promise<MoMNarrative> {
  const empty: MoMNarrative = { operational: "", strategic: "" };
  try {
    const language = LANG_NAMES[params.lang] || "English";
    // completeChat dwingt response_format json_object af — de prompt moet dus
    // expliciet om een JSON-object vragen.
    const prompt = [
      `You are a senior sales management consultant. Compare this month's sales KPIs against last month's and explain what changed and what it likely means. Be businesslike, compact and concrete; no generic management language; interpret, don't just restate numbers.`,
      ``,
      `Write in ${language}. Current period: ${params.periodLabel}. Previous period: ${params.prevPeriodLabel}.`,
      ``,
      `OPERATIONAL metrics (current vs previous):`,
      JSON.stringify(params.operational),
      ``,
      `STRATEGIC metrics (current vs previous):`,
      JSON.stringify(params.strategic),
      ``,
      `Respond with a JSON object with exactly two string fields:`,
      `{"operational": "<2-4 sentences on the operational month-over-month change>", "strategic": "<2-4 sentences on the strategic month-over-month change>"}`,
    ].join("\n");

    const raw = await completeChat(prompt);
    // De gateway wikkelt json_object soms in ```json … ``` — zelfde defensieve
    // brace-fallback als terminologyDocService.
    let parsed: Partial<MoMNarrative> = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start !== -1 && end !== -1 && end > start) {
        parsed = JSON.parse(raw.slice(start, end + 1));
      }
    }
    return {
      operational:
        typeof parsed.operational === "string" ? parsed.operational.trim() : "",
      strategic:
        typeof parsed.strategic === "string" ? parsed.strategic.trim() : "",
    };
  } catch (error) {
    console.error(
      "[MonthlyReport] MoM-duiding mislukt (rapport gaat zonder duiding uit):",
      error,
    );
    return empty;
  }
}
