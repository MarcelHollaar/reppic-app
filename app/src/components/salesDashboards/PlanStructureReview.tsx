"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Typography, Button, Spinner } from "@material-tailwind/react";
import { PlusIcon, TrashIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";

/**
 * Fase 2 review panel: shows the AI-proposed canonical structure of a company
 * plan as an editable form. The manager corrects it and confirms — only then
 * do the dashboards compare against the structured version. Also doubles as
 * the manual-entry form for companies without a plan document (mode="manual").
 */

type PlanType = "strategic" | "operational";

interface Kpi { name: string; target: string; unit: string; period: string }
interface Objective { title: string; description: string; kpis: Kpi[] }
interface StrategicPlan {
  objectives: Objective[];
  keyMessages: string[];
  targetSegments: string[];
  competitivePosition: string;
  otherNotes: string;
}
interface PicaTarget { phaseKey: string; focusPoints: string[] }
interface SkillTarget { skill: string; target: string; description: string }
interface Benchmark { metric: string; target: string; unit: string }
interface OperationalPlan {
  picaTargets: PicaTarget[];
  skillTargets: SkillTarget[];
  benchmarks: Benchmark[];
  focusAreas: string[];
  otherNotes: string;
}
type Structured = StrategicPlan | OperationalPlan;

const PHASE_KEYS = ["proposition", "inventory", "conviction", "closing"] as const;

function emptyStructure(planType: PlanType): Structured {
  return planType === "strategic"
    ? { objectives: [], keyMessages: [], targetSegments: [], competitivePosition: "", otherNotes: "" }
    : { picaTargets: [], skillTargets: [], benchmarks: [], focusAreas: [], otherNotes: "" };
}

/** Plain-text render of a manually entered structure, stored as plan content. */
function structureToText(planType: PlanType, s: Structured): string {
  const lines: string[] = [];
  if (planType === "strategic") {
    const p = s as StrategicPlan;
    for (const o of p.objectives) {
      lines.push(`Doelstelling: ${o.title}${o.description ? ` — ${o.description}` : ""}`);
      for (const k of o.kpis) lines.push(`  KPI: ${k.name}${k.target ? `: ${k.target}` : ""}${k.unit ? ` ${k.unit}` : ""}${k.period ? ` (${k.period})` : ""}`);
    }
    for (const m of p.keyMessages) lines.push(`Kernboodschap: ${m}`);
    for (const t of p.targetSegments) lines.push(`Doelsegment: ${t}`);
    if (p.competitivePosition) lines.push(`Concurrentiepositie: ${p.competitivePosition}`);
    if (p.otherNotes) lines.push(`Overig: ${p.otherNotes}`);
  } else {
    const p = s as OperationalPlan;
    for (const t of p.picaTargets) for (const f of t.focusPoints) lines.push(`Fasedoel (${t.phaseKey}): ${f}`);
    for (const st of p.skillTargets) lines.push(`Vaardigheidsdoel: ${st.skill}${st.target ? `: ${st.target}` : ""}${st.description ? ` — ${st.description}` : ""}`);
    for (const b of p.benchmarks) lines.push(`Benchmark: ${b.metric}${b.target ? `: ${b.target}` : ""}${b.unit ? ` ${b.unit}` : ""}`);
    for (const f of p.focusAreas) lines.push(`Speerpunt: ${f}`);
    if (p.otherNotes) lines.push(`Overig: ${p.otherNotes}`);
  }
  return lines.join("\n");
}

function countItems(planType: PlanType, s: Structured): number {
  if (planType === "strategic") {
    const p = s as StrategicPlan;
    return p.objectives.length + p.keyMessages.length + p.targetSegments.length + (p.competitivePosition ? 1 : 0);
  }
  const p = s as OperationalPlan;
  return p.picaTargets.reduce((n, t) => n + t.focusPoints.length, 0) + p.skillTargets.length + p.benchmarks.length + p.focusAreas.length;
}

const API_URL = process.env.NEXT_PUBLIC_DASHBOARD_API_URL || "http://localhost:5001";

interface PlanStructureReviewProps {
  planType: PlanType;
  lang: string;
  /** "review": structure the stored plan; "manual": compose a plan without a document. */
  mode: "review" | "manual";
  onDone: () => void;
  onCancel: () => void;
}

const inputCls = "tw-w-full tw-rounded-md tw-border tw-border-blue-gray-100 tw-bg-white tw-px-2 tw-py-1 tw-text-xs tw-text-blue-gray-800 focus:tw-border-[#5971F6] focus:tw-outline-none";

export function PlanStructureReview({ planType, lang, mode, onDone, onCancel }: PlanStructureReviewProps) {
  const { t } = useTranslation("common");
  const [structured, setStructured] = useState<Structured>(() => emptyStructure(planType));
  const [status, setStatus] = useState<"none" | "proposed" | "confirmed">("none");
  const [loading, setLoading] = useState(mode === "review");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authHeaders = useCallback(() => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  }, []);

  const generate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/plans/${planType}/structure?lang=${lang}`, {
        method: "POST",
        headers: authHeaders(),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || t("plansReview.generateFailed"));
      setStructured({ ...emptyStructure(planType), ...(d.structured || {}) });
      setStatus("proposed");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }, [planType, lang, authHeaders, t]);

  // review mode: load existing structure; generate a proposal when none exists.
  useEffect(() => {
    if (mode !== "review") return;
    let active = true;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/plans/${planType}/structure?lang=${lang}`, { headers: authHeaders() });
        const d = await res.json().catch(() => ({}));
        if (!active) return;
        if (res.ok && d.structured) {
          setStructured({ ...emptyStructure(planType), ...d.structured });
          setStatus(d.status || "proposed");
          setLoading(false);
        } else {
          setLoading(false);
          await generate();
        }
      } catch {
        if (active) {
          setLoading(false);
          await generate();
        }
      }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, planType, lang]);

  const itemCount = useMemo(() => countItems(planType, structured), [planType, structured]);

  const handleConfirm = async () => {
    setSaving(true);
    setError(null);
    try {
      if (mode === "manual") {
        // First create the plan document from the composed structure, then confirm.
        const content = structureToText(planType, structured);
        const resPlan = await fetch(`${API_URL}/api/plans/${planType}`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            filename: t("plansReview.manualFilename"),
            content,
            language: lang,
            fileType: "text",
            manual: true,
            deferReanalysis: true,
          }),
        });
        if (!resPlan.ok) {
          const d = await resPlan.json().catch(() => ({}));
          throw new Error(d.error || t("plansReview.saveFailed"));
        }
      }
      const res = await fetch(`${API_URL}/api/plans/${planType}/structure?lang=${lang}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ structured, language: lang }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || t("plansReview.saveFailed"));
      }
      onDone();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── generic list helpers ──
  const update = (patch: Partial<Structured>) => setStructured((prev) => ({ ...prev, ...patch } as Structured));

  const stringList = (label: string, values: string[], set: (v: string[]) => void, placeholder: string) => (
    <div className="tw-mb-3">
      <div className="tw-flex tw-items-center tw-justify-between tw-mb-1">
        <Typography variant="small" className="tw-font-semibold tw-text-blue-gray-800 tw-text-xs">{label}</Typography>
        <button type="button" onClick={() => set([...values, ""])} className="tw-text-[#5971F6] hover:tw-text-[#3d55e0]">
          <PlusIcon className="tw-w-4 tw-h-4" />
        </button>
      </div>
      {values.length === 0 && <Typography variant="small" className="tw-text-blue-gray-300 tw-text-xs">{t("plansReview.none")}</Typography>}
      {values.map((v, i) => (
        <div key={i} className="tw-flex tw-gap-1 tw-mb-1">
          <input className={inputCls} value={v} placeholder={placeholder}
            onChange={(e) => set(values.map((x, j) => (j === i ? e.target.value : x)))} />
          <button type="button" onClick={() => set(values.filter((_, j) => j !== i))} className="tw-text-blue-gray-300 hover:tw-text-red-400">
            <TrashIcon className="tw-w-4 tw-h-4" />
          </button>
        </div>
      ))}
    </div>
  );

  const renderStrategic = (p: StrategicPlan) => (
    <>
      <div className="tw-mb-3">
        <div className="tw-flex tw-items-center tw-justify-between tw-mb-1">
          <Typography variant="small" className="tw-font-semibold tw-text-blue-gray-800 tw-text-xs">{t("plansReview.objectives")}</Typography>
          <button type="button" onClick={() => update({ objectives: [...p.objectives, { title: "", description: "", kpis: [] }] })} className="tw-text-[#5971F6] hover:tw-text-[#3d55e0]">
            <PlusIcon className="tw-w-4 tw-h-4" />
          </button>
        </div>
        {p.objectives.length === 0 && <Typography variant="small" className="tw-text-blue-gray-300 tw-text-xs">{t("plansReview.none")}</Typography>}
        {p.objectives.map((o, i) => (
          <div key={i} className="tw-border tw-border-blue-gray-50 tw-rounded-lg tw-p-2 tw-mb-2">
            <div className="tw-flex tw-gap-1 tw-mb-1">
              <input className={inputCls} value={o.title} placeholder={t("plansReview.objectiveTitle")}
                onChange={(e) => update({ objectives: p.objectives.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
              <button type="button" onClick={() => update({ objectives: p.objectives.filter((_, j) => j !== i) })} className="tw-text-blue-gray-300 hover:tw-text-red-400">
                <TrashIcon className="tw-w-4 tw-h-4" />
              </button>
            </div>
            <input className={`${inputCls} tw-mb-1`} value={o.description} placeholder={t("plansReview.objectiveDesc")}
              onChange={(e) => update({ objectives: p.objectives.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)) })} />
            <div className="tw-flex tw-items-center tw-justify-between tw-mb-1">
              <Typography variant="small" className="tw-text-blue-gray-500 tw-text-xs">{t("plansReview.kpis")}</Typography>
              <button type="button" onClick={() => update({ objectives: p.objectives.map((x, j) => (j === i ? { ...x, kpis: [...x.kpis, { name: "", target: "", unit: "", period: "" }] } : x)) })} className="tw-text-[#5971F6] hover:tw-text-[#3d55e0]">
                <PlusIcon className="tw-w-3.5 tw-h-3.5" />
              </button>
            </div>
            {o.kpis.map((k, ki) => (
              <div key={ki} className="tw-grid tw-grid-cols-[2fr_1fr_1fr_1fr_auto] tw-gap-1 tw-mb-1">
                {(["name", "target", "unit", "period"] as const).map((f) => (
                  <input key={f} className={inputCls} value={k[f]} placeholder={t(`plansReview.kpi_${f}`)}
                    onChange={(e) => update({ objectives: p.objectives.map((x, j) => (j === i ? { ...x, kpis: x.kpis.map((y, kj) => (kj === ki ? { ...y, [f]: e.target.value } : y)) } : x)) })} />
                ))}
                <button type="button" onClick={() => update({ objectives: p.objectives.map((x, j) => (j === i ? { ...x, kpis: x.kpis.filter((_, kj) => kj !== ki) } : x)) })} className="tw-text-blue-gray-300 hover:tw-text-red-400">
                  <TrashIcon className="tw-w-3.5 tw-h-3.5" />
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
      {stringList(t("plansReview.keyMessages"), p.keyMessages, (v) => update({ keyMessages: v }), t("plansReview.keyMessagePlaceholder"))}
      {stringList(t("plansReview.targetSegments"), p.targetSegments, (v) => update({ targetSegments: v }), t("plansReview.segmentPlaceholder"))}
      <div className="tw-mb-3">
        <Typography variant="small" className="tw-font-semibold tw-text-blue-gray-800 tw-text-xs tw-mb-1">{t("plansReview.competitivePosition")}</Typography>
        <textarea className={inputCls} rows={2} value={p.competitivePosition}
          onChange={(e) => update({ competitivePosition: e.target.value })} />
      </div>
      <div className="tw-mb-3">
        <Typography variant="small" className="tw-font-semibold tw-text-blue-gray-800 tw-text-xs tw-mb-1">{t("plansReview.otherNotes")}</Typography>
        <textarea className={inputCls} rows={2} value={p.otherNotes}
          onChange={(e) => update({ otherNotes: e.target.value })} />
      </div>
    </>
  );

  const renderOperational = (p: OperationalPlan) => {
    const phasePoints = (phaseKey: string) => p.picaTargets.find((x) => x.phaseKey === phaseKey)?.focusPoints || [];
    const setPhasePoints = (phaseKey: string, points: string[]) => {
      const rest = p.picaTargets.filter((x) => x.phaseKey !== phaseKey);
      update({ picaTargets: points.length ? [...rest, { phaseKey, focusPoints: points }] : rest });
    };
    return (
      <>
        <Typography variant="small" className="tw-font-semibold tw-text-blue-gray-800 tw-text-xs tw-mb-1">{t("plansReview.picaTargets")}</Typography>
        <div className="tw-border tw-border-blue-gray-50 tw-rounded-lg tw-p-2 tw-mb-3">
          {PHASE_KEYS.map((phase) =>
            <div key={phase}>{stringList(t(`dashboards.picaPhases.${phase}`), phasePoints(phase), (v) => setPhasePoints(phase, v), t("plansReview.focusPointPlaceholder"))}</div>
          )}
        </div>
        <div className="tw-mb-3">
          <div className="tw-flex tw-items-center tw-justify-between tw-mb-1">
            <Typography variant="small" className="tw-font-semibold tw-text-blue-gray-800 tw-text-xs">{t("plansReview.skillTargets")}</Typography>
            <button type="button" onClick={() => update({ skillTargets: [...p.skillTargets, { skill: "", target: "", description: "" }] })} className="tw-text-[#5971F6] hover:tw-text-[#3d55e0]">
              <PlusIcon className="tw-w-4 tw-h-4" />
            </button>
          </div>
          {p.skillTargets.length === 0 && <Typography variant="small" className="tw-text-blue-gray-300 tw-text-xs">{t("plansReview.none")}</Typography>}
          {p.skillTargets.map((s, i) => (
            <div key={i} className="tw-grid tw-grid-cols-[2fr_1fr_2fr_auto] tw-gap-1 tw-mb-1">
              {(["skill", "target", "description"] as const).map((f) => (
                <input key={f} className={inputCls} value={s[f]} placeholder={t(`plansReview.skill_${f}`)}
                  onChange={(e) => update({ skillTargets: p.skillTargets.map((x, j) => (j === i ? { ...x, [f]: e.target.value } : x)) })} />
              ))}
              <button type="button" onClick={() => update({ skillTargets: p.skillTargets.filter((_, j) => j !== i) })} className="tw-text-blue-gray-300 hover:tw-text-red-400">
                <TrashIcon className="tw-w-4 tw-h-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="tw-mb-3">
          <div className="tw-flex tw-items-center tw-justify-between tw-mb-1">
            <Typography variant="small" className="tw-font-semibold tw-text-blue-gray-800 tw-text-xs">{t("plansReview.benchmarks")}</Typography>
            <button type="button" onClick={() => update({ benchmarks: [...p.benchmarks, { metric: "", target: "", unit: "" }] })} className="tw-text-[#5971F6] hover:tw-text-[#3d55e0]">
              <PlusIcon className="tw-w-4 tw-h-4" />
            </button>
          </div>
          {p.benchmarks.length === 0 && <Typography variant="small" className="tw-text-blue-gray-300 tw-text-xs">{t("plansReview.none")}</Typography>}
          {p.benchmarks.map((b, i) => (
            <div key={i} className="tw-grid tw-grid-cols-[2fr_1fr_1fr_auto] tw-gap-1 tw-mb-1">
              {(["metric", "target", "unit"] as const).map((f) => (
                <input key={f} className={inputCls} value={b[f]} placeholder={t(`plansReview.benchmark_${f}`)}
                  onChange={(e) => update({ benchmarks: p.benchmarks.map((x, j) => (j === i ? { ...x, [f]: e.target.value } : x)) })} />
              ))}
              <button type="button" onClick={() => update({ benchmarks: p.benchmarks.filter((_, j) => j !== i) })} className="tw-text-blue-gray-300 hover:tw-text-red-400">
                <TrashIcon className="tw-w-4 tw-h-4" />
              </button>
            </div>
          ))}
        </div>
        {stringList(t("plansReview.focusAreas"), p.focusAreas, (v) => update({ focusAreas: v }), t("plansReview.focusAreaPlaceholder"))}
        <div className="tw-mb-3">
          <Typography variant="small" className="tw-font-semibold tw-text-blue-gray-800 tw-text-xs tw-mb-1">{t("plansReview.otherNotes")}</Typography>
          <textarea className={inputCls} rows={2} value={p.otherNotes}
            onChange={(e) => update({ otherNotes: e.target.value })} />
        </div>
      </>
    );
  };

  if (loading || generating) {
    return (
      <div className="tw-flex tw-flex-col tw-items-center tw-py-8 tw-gap-3">
        <Spinner className="tw-h-8 tw-w-8" />
        <Typography variant="small" className="tw-text-blue-gray-500">
          {generating ? t("plansReview.generating") : t("plansReview.loading")}
        </Typography>
      </div>
    );
  }

  return (
    <div>
      <div className="tw-flex tw-items-center tw-gap-2 tw-mb-2">
        <SparklesIcon className="tw-w-5 tw-h-5 tw-text-[#5971F6]" />
        <Typography variant="small" className="tw-font-semibold tw-text-blue-gray-900">
          {mode === "manual" ? t("plansReview.manualTitle") : t("plansReview.reviewTitle")}
        </Typography>
      </div>
      <Typography variant="small" className="tw-text-blue-gray-500 tw-text-xs tw-mb-3">
        {mode === "manual" ? t("plansReview.manualIntro") : t("plansReview.reviewIntro")}
      </Typography>

      {mode === "review" && itemCount === 0 && (
        <div className="tw-rounded-md tw-bg-amber-50 tw-border tw-border-amber-200 tw-px-3 tw-py-2 tw-text-xs tw-text-amber-800 tw-mb-3">
          {t("plansReview.emptyWarning")}
        </div>
      )}

      <div className="tw-max-h-[45vh] tw-overflow-y-auto tw-pr-1">
        {planType === "strategic" ? renderStrategic(structured as StrategicPlan) : renderOperational(structured as OperationalPlan)}
      </div>

      <div className="tw-flex tw-items-center tw-justify-between tw-mt-4">
        <Typography variant="small" className="tw-text-blue-gray-400 tw-text-xs">
          {t("plansReview.itemCount", { count: itemCount })}
          {status === "confirmed" && ` · ${t("plansReview.statusConfirmed")}`}
        </Typography>
        <div className="tw-flex tw-gap-2">
          {mode === "review" && (
            <Button size="sm" variant="text" color="blue-gray" onClick={generate} disabled={saving}>
              {t("plansReview.regenerate")}
            </Button>
          )}
          <Button size="sm" variant="outlined" color="blue-gray" onClick={onCancel} disabled={saving}>
            {mode === "manual" ? t("plansReview.cancel") : t("plansReview.skip")}
          </Button>
          <Button size="sm" className="tw-bg-[#5971F6]" onClick={handleConfirm} disabled={saving || (mode === "manual" && itemCount === 0)}>
            {saving ? t("plans.saving") : t("plansReview.confirm")}
          </Button>
        </div>
      </div>

      {error && <Typography variant="small" className="tw-text-red-500 tw-mt-2 tw-text-xs">{error}</Typography>}
    </div>
  );
}
