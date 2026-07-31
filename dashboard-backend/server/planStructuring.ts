import { z } from "zod";
import {
  structuredPlanSchemaFor,
  type PlanType,
  type StructuredPlan,
  type StrategicStructuredPlan,
  type OperationalStructuredPlan,
} from "@shared/schema";
import { completeJsonWithRetry } from "./openai";

/**
 * Fase 2 of the plan upload: normalize a free-form company plan (any layout,
 * any format) into the canonical structured shape, once, at upload time.
 * The manager reviews/edits the proposal before it is confirmed; only a
 * confirmed structure is used in analysis prompts (see structuredPlanToPromptBlock).
 */

// Guardrail: a huge plan document must not blow up the extraction prompt.
const MAX_PLAN_INPUT_CHARS = 40_000;

const STRATEGIC_SHAPE = `{
  "objectives": [ { "title": string, "description": string, "kpis": [ { "name": string, "target": string, "unit": string, "period": string } ] } ],
  "keyMessages": [ string ],
  "targetSegments": [ string ],
  "competitivePosition": string,
  "otherNotes": string
}`;

const OPERATIONAL_SHAPE = `{
  "picaTargets": [ { "phaseKey": "proposition" | "inventory" | "conviction" | "closing", "focusPoints": [ string ] } ],
  "skillTargets": [ { "skill": string, "target": string, "description": string } ],
  "benchmarks": [ { "metric": string, "target": string, "unit": string } ],
  "focusAreas": [ string ],
  "otherNotes": string
}`;

function buildStructuringPrompt(planType: PlanType, content: string): { systemPrompt: string; userPrompt: string } {
  const isStrategic = planType === "strategic";
  const shape = isStrategic ? STRATEGIC_SHAPE : OPERATIONAL_SHAPE;

  const domainNotes = isStrategic
    ? `- "objectives": the plan's strategic goals. Attach KPIs (with target, unit, period) to the objective they belong to.
- "keyMessages": proposition elements / key messages the sales team should communicate to customers.
- "targetSegments": target markets, customer segments or verticals named in the plan.
- "competitivePosition": how the plan describes the company's position versus competitors (short prose).`
    : `- "picaTargets": goals tied to a sales-conversation phase. Map them onto the four phases: proposition (opening/pitch), inventory (discovery/questioning), conviction (persuasion/USPs), closing (agreements/next steps). Only include a phase if the plan actually sets goals for it.
- "skillTargets": individual selling skills the plan wants to improve (e.g. deep questioning, objection handling), with their target if stated.
- "benchmarks": measurable performance indicators with targets (e.g. conversion %, calls per week, average score).
- "focusAreas": the period's spearpoints/priorities that don't fit the above.`;

  const systemPrompt = `You convert a company's free-form ${isStrategic ? "strategic plan" : "operational sales plan"} into a fixed JSON structure. You extract, you never invent.

Rules:
- Use ONLY information that is actually in the document. Do NOT invent, estimate or embellish anything. If a field is not present in the document, return it empty ([] or "").
- Keep the document's own language and wording for titles, KPIs and messages. Do not translate.
- Targets/values: copy them as written (e.g. "15%", "€1,2M", "8 per week"). Unknown target/unit/period = "".
- Anything relevant that does not fit the fields goes into "otherNotes" (short summary, not a full copy).
- It is fine — and expected for sparse documents — to return mostly empty fields.
${domainNotes}

Respond with ONLY a JSON object in exactly this shape:
${shape}`;

  const userPrompt = `Document:\n"""\n${content.slice(0, MAX_PLAN_INPUT_CHARS)}\n"""`;

  return { systemPrompt, userPrompt };
}

/** Counts extracted items, for the quality indication in the review UI. */
export function structuredPlanCounts(planType: PlanType, plan: StructuredPlan): Record<string, number> {
  if (planType === "strategic") {
    const p = plan as StrategicStructuredPlan;
    return {
      objectives: p.objectives.length,
      kpis: p.objectives.reduce((n, o) => n + (o.kpis?.length || 0), 0),
      keyMessages: p.keyMessages.length,
      targetSegments: p.targetSegments.length,
    };
  }
  const p = plan as OperationalStructuredPlan;
  return {
    picaTargets: p.picaTargets.reduce((n, t) => n + (t.focusPoints?.length || 0), 0),
    skillTargets: p.skillTargets.length,
    benchmarks: p.benchmarks.length,
    focusAreas: p.focusAreas.length,
  };
}

/**
 * Runs the plan text through the LLM (via the configured dashboard route) and
 * returns a schema-validated structured plan. Never persists.
 */
export async function structurePlan(planType: PlanType, content: string): Promise<StructuredPlan> {
  const { systemPrompt, userPrompt } = buildStructuringPrompt(planType, content);
  return completeJsonWithRetry({
    label: `plan-structuring:${planType}`,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    // Cast: the union of the two plan schemas has defaulted (optional-input)
    // fields, which z.ZodType<T> can't express; runtime parsing is unchanged.
    schema: structuredPlanSchemaFor(planType) as unknown as z.ZodType<StructuredPlan>,
  });
}

// ── Compact prompt rendering ────────────────────────────────────────────────
// A confirmed structure replaces the raw-document dump in analysis prompts:
// consistent reading across transcripts and a fraction of the tokens.

function section(title: string, lines: string[]): string {
  if (lines.length === 0) return "";
  return `${title}:\n${lines.join("\n")}\n`;
}

const PHASE_LABELS: Record<string, string> = {
  proposition: "Proposition (opening/pitch)",
  inventory: "Investigation (discovery)",
  conviction: "Conviction (persuasion)",
  closing: "Closing (agreements)",
};

export function structuredPlanToPromptBlock(planType: PlanType, plan: StructuredPlan): string {
  const parts: string[] = [];

  if (planType === "strategic") {
    const p = plan as StrategicStructuredPlan;
    parts.push(section("OBJECTIVES & KPIs", p.objectives.map((o) => {
      const kpis = (o.kpis || [])
        .map((k) => `${k.name}${k.target ? `: ${k.target}` : ""}${k.unit ? ` ${k.unit}` : ""}${k.period ? ` (${k.period})` : ""}`)
        .join("; ");
      return `- ${o.title}${o.description ? ` — ${o.description}` : ""}${kpis ? ` [KPIs: ${kpis}]` : ""}`;
    })));
    parts.push(section("KEY MESSAGES / PROPOSITION ELEMENTS", p.keyMessages.map((m) => `- ${m}`)));
    parts.push(section("TARGET SEGMENTS", p.targetSegments.map((s) => `- ${s}`)));
    if (p.competitivePosition) parts.push(`COMPETITIVE POSITION:\n${p.competitivePosition}\n`);
    if (p.otherNotes) parts.push(`OTHER NOTES:\n${p.otherNotes}\n`);
  } else {
    const p = plan as OperationalStructuredPlan;
    parts.push(section("GOALS PER CONVERSATION PHASE", p.picaTargets.flatMap((t) => {
      const label = PHASE_LABELS[t.phaseKey] || t.phaseKey;
      return (t.focusPoints || []).map((f) => `- [${label}] ${f}`);
    })));
    parts.push(section("SKILL TARGETS", p.skillTargets.map(
      (s) => `- ${s.skill}${s.target ? `: ${s.target}` : ""}${s.description ? ` — ${s.description}` : ""}`,
    )));
    parts.push(section("BENCHMARKS", p.benchmarks.map(
      (b) => `- ${b.metric}${b.target ? `: ${b.target}` : ""}${b.unit ? ` ${b.unit}` : ""}`,
    )));
    parts.push(section("FOCUS AREAS", p.focusAreas.map((f) => `- ${f}`)));
    if (p.otherNotes) parts.push(`OTHER NOTES:\n${p.otherNotes}\n`);
  }

  return parts.filter(Boolean).join("\n").trim();
}
