import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { analyzeTranscript, analyzeTranscriptOperational, generateTileConclusion, generateTileChatResponse, generateConclusionChatResponse, generateManagementConclusion, generateStrategicAggregateComparisons, generateOperationalAggregateComparisons, generateSuggestedQuestions, isDashboardLlmConfigured, setDashboardAnalysisRoute } from "./openai";
import { getDashboardModelSettings, setDashboardLLMRoute, getDashboardLLMRoute } from "./dashboardModelService";
import { sendPasswordResetEmail } from "./email";
import { insertTranscriptSchema, insertStrategyDocumentSchema, insertPlanDocumentSchema, planTypeEnum, dashboardTypeEnum, structuredPlanSchemaFor, type PlanDocument } from "@shared/schema";
import { structurePlan, structuredPlanToPromptBlock, structuredPlanCounts } from "./planStructuring";
import { registerObjectStorageRoutes, ObjectStorageService } from "./replit_integrations/object_storage";
import {
  configureSession, requireJwtAuth, requireSuperAdmin, requireManagerOrSuperAdmin, parseJwtIfPresent, safeUser,
  hashPassword, verifyPassword, generateTwoFactorSecret, generateQRCode, verifyTwoFactorToken
} from "./auth";
import { createRequire } from "module";
const _require = createRequire(import.meta.url);

async function extractTextFromPdfBase64(base64Content: string): Promise<string> {
  const pdfParse = _require("pdf-parse");
  const buffer = Buffer.from(base64Content, "base64");
  const data = await pdfParse(buffer);
  return data.text;
}

async function extractTextFromDocxBase64(base64Content: string): Promise<string> {
  const mammoth = _require("mammoth");
  const buffer = Buffer.from(base64Content, "base64");
  const { value } = await mammoth.extractRawText({ buffer });
  return value || "";
}

// Below this many usable characters an "upload" is treated as failed extraction
// (scanned/image PDF, empty file) instead of silently storing an unusable plan.
const MIN_PLAN_TEXT_CHARS = 200;

// Cap for RAW plan text injected into analysis prompts (fallback path when no
// confirmed structure exists). A confirmed structure is compact by design.
const MAX_RAW_PLAN_PROMPT_CHARS = 15_000;

/**
 * The plan text that goes into an analysis prompt: the manager-confirmed
 * structured version when available (consistent + compact), otherwise the raw
 * document text capped to a safe size.
 */
function planPromptContent(plan: PlanDocument): string {
  if (plan.structuredStatus === "confirmed" && plan.structured) {
    try {
      const block = structuredPlanToPromptBlock(plan.planType as "strategic" | "operational", plan.structured as any);
      if (block) return block;
    } catch (e: any) {
      console.error(`[plan] Failed to render structured plan ${plan.id}, falling back to raw:`, e?.message);
    }
  }
  const raw = plan.content || "";
  if (raw.length > MAX_RAW_PLAN_PROMPT_CHARS) {
    console.warn(`[plan] Raw ${plan.planType} plan "${plan.filename}" truncated for prompt: ${raw.length} → ${MAX_RAW_PLAN_PROMPT_CHARS} chars`);
    return raw.slice(0, MAX_RAW_PLAN_PROMPT_CHARS);
  }
  return raw;
}

class PlanExtractionError extends Error {
  constructor(public code: "UNSUPPORTED_FILETYPE" | "EMPTY_EXTRACTION", message: string) {
    super(message);
  }
}

/**
 * Extracts plain text from an uploaded plan document.
 * fileType: 'pdf' | 'docx' | 'text' (legacy clients send isPdf instead).
 * Throws PlanExtractionError for unsupported types and empty/scan results.
 */
async function extractPlanText(
  fileType: string | undefined,
  content: string,
  legacyIsPdf?: boolean,
): Promise<string> {
  const type = fileType || (legacyIsPdf ? "pdf" : "text");

  let text: string;
  if (type === "pdf") {
    text = await extractTextFromPdfBase64(content);
  } else if (type === "docx") {
    text = await extractTextFromDocxBase64(content);
  } else if (type === "doc") {
    throw new PlanExtractionError(
      "UNSUPPORTED_FILETYPE",
      "Oude .doc-bestanden worden niet ondersteund. Sla het bestand op als .docx of PDF en probeer opnieuw.",
    );
  } else {
    text = content;
  }

  if ((text || "").trim().length < MIN_PLAN_TEXT_CHARS) {
    throw new PlanExtractionError(
      "EMPTY_EXTRACTION",
      "Geen leesbare tekst gevonden in het document. Is dit een gescand document of een afbeelding? Upload een tekst-PDF of .docx, of plak de tekst als .txt.",
    );
  }
  return text;
}

// Log the full error server-side but return a generic message to the client, so
// internal/DB error details are never disclosed over the API.
function serverError(res: any, error: unknown, where = "request") {
  console.error(`[server error: ${where}]`, (error as any)?.stack || (error as any)?.message || error);
  return res.status(500).json({ error: "Interne serverfout" });
}

// Minimal dependency-free in-memory rate limiter. Per-process (sufficient for a
// single container; for multi-replica deploys put a shared store in front).
// Used to slow brute-force / credential-stuffing on the auth endpoints.
function rateLimit(opts: { windowMs: number; max: number; message?: string }) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req: any, res: any, next: any) => {
    const now = Date.now();
    const key = (req.headers["x-forwarded-for"]?.split(",")[0]?.trim()) || req.ip || req.socket?.remoteAddress || "unknown";
    const entry = hits.get(key);
    if (!entry || now > entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + opts.windowMs });
    } else {
      entry.count += 1;
      if (entry.count > opts.max) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        res.setHeader("Retry-After", String(retryAfter));
        return res.status(429).json({ error: opts.message || "Te veel pogingen. Probeer het later opnieuw." });
      }
    }
    // Opportunistic cleanup so the map can't grow unbounded.
    if (hits.size > 5000) {
      hits.forEach((v, k) => { if (now > v.resetAt) hits.delete(k); });
    }
    next();
  };
}

// 10 auth attempts per IP per 15 minutes.
const authRateLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: "Te veel inlogpogingen. Probeer het over 15 minuten opnieuw." });

// Document parsing (PDF/DOCX) + AI structuring decode/parse the whole upload in
// memory before size caps apply, so a crafted decompression-bomb upload is
// costly. Cap repeated calls to blunt CPU/memory DoS and AI-cost abuse.
const heavyDocRateLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 20, message: "Te veel documentverwerkingen. Probeer het later opnieuw." });

type Language = "nl" | "en" | "de" | "fr" | "es" | "it";

// Helper to get current week number in format "2025-W01"
/**
 * ISO-8601 week key (e.g. "2026-W24"). The ISO week-year can differ from the
 * calendar year around New Year, which this implementation handles correctly.
 */
function getIsoWeekKey(date: Date): string {
  // Work in UTC to avoid DST edge cases
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // ISO: a week belongs to the year of its Thursday
  const dayNum = d.getUTCDay() || 7; // Mon=1 .. Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const isoYear = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const weekNumber = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${isoYear}-W${weekNumber.toString().padStart(2, "0")}`;
}

function getCurrentWeekNumber(): string {
  return getIsoWeekKey(new Date());
}

// Helper to derive week number from a specific date
function getWeekNumberFromDate(date: Date): string {
  return getIsoWeekKey(date);
}

// In-memory reanalysis status tracker per language
interface ReanalysisStatus {
  state: 'running' | 'complete' | 'error';
  processed: number;
  total: number;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}
const reanalysisStatusMap = new Map<string, ReanalysisStatus>();

// Snapshot update queue: serializes concurrent writes to the same snapshot key
// Prevents race conditions when multiple transcripts are analyzed in parallel
const snapshotUpdateQueue = new Map<string, Promise<void>>();
function queueSnapshotUpdate(snapshotKey: string, updateFn: () => Promise<void>): Promise<void> {
  const prev = snapshotUpdateQueue.get(snapshotKey) ?? Promise.resolve();
  const next = prev.then(updateFn, updateFn);
  snapshotUpdateQueue.set(snapshotKey, next);
  return next;
}

// ── Phase-score / phase-detail helpers ──────────────────────────────────────
// All score fields (0-100) are stored as running averages in the snapshot, so
// each snapshot value is always the true mean across all transcripts it
// represents. mergeAnalyticsData does the same per item: 1-100 score fields
// (e.g. `value`) are weighted-averaged across conversations, while genuine
// frequency fields (`mentions`, `count`) are summed.

/**
 * WRITE PATH: compute running average for per-metric scores inside phaseDetails.
 * prevCount = transcriptCount BEFORE this new transcript is added.
 * Result: { key, value } where value = mean across (prevCount + 1) transcripts.
 */
function mergePhaseDetails(existing: any[], newData: any[], prevCount: number): any[] {
  if (!existing?.length) return newData ? JSON.parse(JSON.stringify(newData)) : [];
  if (!newData?.length) return existing;
  return existing.map(existingPhase => {
    const newPhase = (newData as any[]).find((p: any) => p.phase === existingPhase.phase);
    if (!newPhase) return existingPhase;
    const mergedMetrics = (existingPhase.metrics || []).map((em: any) => {
      const nm = (newPhase.metrics || []).find((m: any) => m.key === em.key);
      if (!nm) return em;
      const newAvg = prevCount === 0
        ? Math.round(nm.value || 0)
        : Math.round(((em.value || 0) * prevCount + (nm.value || 0)) / (prevCount + 1));
      return { key: em.key, value: newAvg };
    });
    return { ...existingPhase, metrics: mergedMetrics };
  });
}

/**
 * WRITE PATH: compute running average for phaseScores (one score per phase).
 * prevCount = transcriptCount BEFORE this new transcript is added.
 */
function mergePhaseScores(existing: any[], newData: any[], prevCount: number): any[] {
  if (!existing?.length) return newData ? JSON.parse(JSON.stringify(newData)) : [];
  if (!newData?.length) return existing;
  const merged = new Map<string, any>();
  (existing || []).forEach(item => { if (item.name) merged.set(item.name, { ...item }); });
  (newData || []).forEach(item => {
    if (!item.name) return;
    if (merged.has(item.name)) {
      const ei = merged.get(item.name)!;
      ei.value = prevCount === 0
        ? Math.round(item.value || 0)
        : Math.round(((ei.value || 0) * prevCount + (item.value || 0)) / (prevCount + 1));
    } else {
      merged.set(item.name, { ...item });
    }
  });
  return Array.from(merged.values());
}

/**
 * READ PATH: accumulate weighted sums for phaseScores while iterating snapshots.
 * Call finalizePhaseScores() after the loop to get true weighted averages.
 */
function accumulatePhaseScores(accumulated: any[], snapshotData: any[], weight: number): any[] {
  const merged = new Map<string, any>();
  (accumulated || []).forEach(item => { if (item.name) merged.set(item.name, { ...item }); });
  (snapshotData || []).forEach(item => {
    if (!item.name) return;
    if (merged.has(item.name)) {
      const ei = merged.get(item.name)!;
      ei._wSum = (ei._wSum || 0) + (item.value || 0) * weight;
      ei._wTotal = (ei._wTotal || 0) + weight;
    } else {
      merged.set(item.name, { ...item, _wSum: (item.value || 0) * weight, _wTotal: weight });
    }
  });
  return Array.from(merged.values());
}
function finalizePhaseScores(accumulated: any[]): any[] {
  return accumulated.map(item => ({
    ...item,
    value: item._wTotal > 0 ? Math.round(item._wSum / item._wTotal) : (item.value || 0),
    _wSum: undefined,
    _wTotal: undefined,
  }));
}

/**
 * READ PATH: accumulate weighted sums for phaseDetails while iterating snapshots.
 * Call finalizePhaseDetails() after the loop.
 */
function accumulatePhaseDetails(accumulated: any[], snapshotData: any[], weight: number): any[] {
  if (!accumulated?.length) {
    return (snapshotData || []).map((phase: any) => ({
      ...phase,
      metrics: (phase.metrics || []).map((m: any) => ({
        key: m.key, value: m.value, _wSum: (m.value || 0) * weight, _wTotal: weight,
      })),
    }));
  }
  return accumulated.map((accPhase: any) => {
    const snapPhase = (snapshotData || []).find((p: any) => p.phase === accPhase.phase);
    if (!snapPhase) return accPhase;
    return {
      ...accPhase,
      metrics: (accPhase.metrics || []).map((am: any) => {
        const sm = (snapPhase.metrics || []).find((m: any) => m.key === am.key);
        if (!sm) return am;
        return {
          key: am.key, value: am.value,
          _wSum: (am._wSum || 0) + (sm.value || 0) * weight,
          _wTotal: (am._wTotal || 0) + weight,
        };
      }),
    };
  });
}
function finalizePhaseDetails(accumulated: any[]): any[] {
  return accumulated.map((phase: any) => ({
    ...phase,
    metrics: (phase.metrics || []).map((m: any) => ({
      key: m.key,
      value: m._wTotal > 0 ? Math.round(m._wSum / m._wTotal) : (m.value || 0),
    })),
  }));
}

// Fixed internal keys for the 4 PICA phases — always stored in English regardless
// of the transcript language so that mergePhaseScores can match them correctly.
const PICA_PHASE_FIXED_NAMES = ["Proposition", "Investigation", "Convincing", "Agreement"];

/**
 * Normalise the AI-returned phaseScores to fixed English phase names based on
 * position. The AI sometimes appends parenthetical descriptions to the name
 * (e.g. "Overtuiging (koppelen aan klantvraag)") which breaks key-based merging.
 */
function normalizePhaseScoreNames(phaseScores: any[]): any[] {
  if (!phaseScores?.length) return phaseScores || [];
  return phaseScores.map((ps, idx) => ({
    ...ps,
    name: PICA_PHASE_FIXED_NAMES[idx] ?? ps.name,
  }));
}

/**
 * PICA phase data to feed the operational snapshot. Prefer the Reppic app's
 * single-source-of-truth coaching analysis (stored on the transcript) so the
 * operational (team) dashboard shows the IDENTICAL per-conversation PICA the
 * salesperson sees on their personal dashboard. Falls back to the backend's own
 * per-transcript analysis for transcripts pushed before this (no coachingAnalysis).
 */
function operationalPicaFor(transcript: any, operationalAnalysis: any): any {
  const appPica = (transcript?.coachingAnalysis as any)?.picaPerformance;
  return appPica ?? operationalAnalysis?.picaPerformance ?? { phaseScores: [], phaseDetails: [] };
}

/**
 * Legacy rows (pushed before the app supplied coachingAnalysis) still trigger a
 * backend operational re-analysis. Log it so the extra LLM cost — and any PICA
 * divergence from the personal dashboard — is traceable per transcript.
 */
function logOperationalFallback(transcriptId: string): void {
  console.log(
    `[transcripts] No app coachingAnalysis on ${transcriptId} — falling back to backend operational re-analysis (legacy row, extra LLM cost)`
  );
}

/**
 * Merge analytics item lists.
 *
 * Intensity scores (value, relevance, clarity, …) are stored as **weighted
 * running averages** so they stay on their 1-100 scale — previously they were
 * summed, which made a thrice-mentioned minor concern outrank a single severe
 * one. Frequency fields (`mentions`) and the internal `count` (number of
 * occurrences merged into the item) are summed.
 *
 * Items are matched on normalized name (trimmed, case-insensitive) so
 * "Prijsperceptie" and "prijsperceptie" from different conversations merge into
 * one. The analysis prompt enforces canonical names per category, so semantically
 * equivalent objections share an identical name and aggregate correctly.
 * Items from old snapshots without a `count` are treated as count = 1.
 */
const SUMMED_NUMERIC_FIELDS = new Set(["mentions", "count"]);

function mergeAnalyticsData(existing: any[], newData: any[]): any[] {
  const merged = new Map<string, any>();
  const keyOf = (name: string) => name.trim().toLowerCase();

  (existing || []).forEach(item => {
    if (item?.name) {
      merged.set(keyOf(item.name), { ...item, count: item.count || 1 });
    }
  });

  (newData || []).forEach(item => {
    if (!item?.name) return;
    const key = keyOf(item.name);
    const incomingCount = item.count || 1;

    if (!merged.has(key)) {
      merged.set(key, { ...item, count: incomingCount });
      return;
    }

    const existingItem = merged.get(key);
    const existingCount = existingItem.count || 1;
    const totalCount = existingCount + incomingCount;

    Object.keys(item).forEach(fieldKey => {
      if (typeof item[fieldKey] !== "number" || fieldKey === "id") return;
      if (SUMMED_NUMERIC_FIELDS.has(fieldKey)) {
        if (fieldKey !== "count") {
          existingItem[fieldKey] = (existingItem[fieldKey] || 0) + (item[fieldKey] || 0);
        }
      } else {
        // Weighted running average keeps scores on their original 1-100 scale
        existingItem[fieldKey] = Math.round(
          (((existingItem[fieldKey] || 0) * existingCount) + ((item[fieldKey] || 0) * incomingCount)) / totalCount,
        );
      }
    });

    // Prefer the richer description/confidence when the existing item lacks one
    if (!existingItem.description && item.description) existingItem.description = item.description;
    if (!existingItem.confidence && item.confidence) existingItem.confidence = item.confidence;

    existingItem.count = totalCount;
  });

  return Array.from(merged.values());
}

const TREND_GROUPS = ['relational', 'functional', 'financial', 'organizational', 'strategic', 'urgency'] as const;

function mergeTrendGroups(existing: any, incoming: any): any {
  const result: any = {};
  for (const group of TREND_GROUPS) {
    result[group] = mergeAnalyticsData(existing?.[group] || [], incoming?.[group] || []);
  }
  return result;
}

// Helper to calculate running average: combines old average with new value
function runningAverage(oldAvg: number, newValue: number, oldCount: number): number {
  if (!newValue && newValue !== 0) return oldAvg;
  if (oldCount <= 0) return newValue;
  return Math.round(((oldAvg * oldCount) + newValue) / (oldCount + 1) * 100) / 100;
}

function getWeeksForMonth(year: string, month: string): string[] {
  const y = parseInt(year);
  const m = parseInt(month);
  const weeks: string[] = [];
  
  const firstDay = new Date(y, m - 1, 1);
  const lastDay = new Date(y, m, 0);
  
  for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
    const weekKey = getIsoWeekKey(d);
    if (!weeks.includes(weekKey)) {
      weeks.push(weekKey);
    }
  }
  return weeks;
}

function getWeeksForYTD(year: string): string[] {
  const y = parseInt(year);
  const now = new Date();
  const endMonth = y === now.getFullYear() ? now.getMonth() + 1 : 12;
  const allWeeks: string[] = [];
  for (let m = 1; m <= endMonth; m++) {
    const monthWeeks = getWeeksForMonth(year, m.toString());
    monthWeeks.forEach(w => { if (!allWeeks.includes(w)) allWeeks.push(w); });
  }
  return allWeeks;
}

function filterSnapshotsByDate(snapshots: any[], year?: string, month?: string): any[] {
  if (!year) return snapshots;
  
  const validWeeks = month && month !== 'ytd' 
    ? getWeeksForMonth(year, month)
    : getWeeksForYTD(year);
  
  return snapshots.filter(s => validWeeks.includes(s.weekNumber));
}

// Helper to extract strategic data from potentially nested analysis
function getStrategicAnalysis(analysis: any): any {
  // Handle both old flat structure and new nested {strategic, operational} structure
  if (analysis.strategic) {
    return analysis.strategic;
  }
  // Assume flat structure if no 'strategic' property
  return analysis;
}

function isValidLanguage(lang: string): lang is Language {
  return ['nl', 'en', 'de', 'fr', 'es', 'it'].includes(lang);
}

// Returns undefined for superadmin (sees all data), or the user's companyId for filtering.
// Sentinel company id for an authenticated NON-superadmin who has no company
// assigned. Returning `undefined` here would mean "all companies" in the
// storage layer (that is the deliberate superadmin path), which would leak
// every tenant's data to a user that should see nothing. Instead we return an
// id that matches no real company, so every query scoped by it comes back
// empty and any write lands in an isolated bucket. company.id is a VARCHAR(40)
// UUID, so this literal can never collide with a real company id.
const NO_COMPANY = "__no_company__";

function getCompanyFilter(req: any): string | undefined {
  // JWT auth (Reppic integration)
  if (req.jwtUser) {
    if (req.jwtUser.role === 'superadmin') return undefined; // superadmin: all companies
    return req.jwtUser.companyId ?? NO_COMPANY;              // own company, or deny-all
  }
  // Session auth (legacy standalone login)
  if (!req.session?.userId) return undefined;
  if (req.session.userRole === 'superadmin') return undefined;
  return req.session.companyId ?? NO_COMPANY;
}

async function applyDashboardLLMRouteFromSettings(): Promise<void> {
  const route = await getDashboardLLMRoute();
  setDashboardAnalysisRoute({ model: route.model, tag: route.tag });
}

// Rebuild all snapshots from scratch for a language using the current plans
async function runReanalysisForLanguage(language: string, companyId?: string | null): Promise<void> {
  const allTranscripts = await storage.getAllTranscripts(companyId);
  const transcripts = allTranscripts
    .filter(t => t.language === language && t.status === 'analyzed' && t.analysis)
    .sort((a, b) => new Date(a.uploadedAt!).getTime() - new Date(b.uploadedAt!).getTime());

  reanalysisStatusMap.set(language, {
    state: 'running',
    processed: 0,
    total: transcripts.length,
    startedAt: new Date()
  });

  if (transcripts.length === 0) {
    reanalysisStatusMap.set(language, {
      state: 'complete',
      processed: 0,
      total: 0,
      startedAt: new Date(),
      completedAt: new Date()
    });
    return;
  }

  const strategicPlan = await storage.getPlan('strategic', language, companyId);
  const operationalPlan = await storage.getPlan('operational', language, companyId);

  // Clear all existing snapshots for this language so we start fresh
  await storage.deleteSnapshotsForLanguage(language, companyId);

  let processed = 0;

  for (const transcript of transcripts) {
    try {
      // Re-run AI analysis with current plans
      // Use the superadmin-chosen dashboard model (falls back to twinai/large).
      await applyDashboardLLMRouteFromSettings();
      // Single source of truth: if the app already produced the operational
      // coaching analysis (same PICA as the salesperson's personal dashboard +
      // coherent tiles), use it and SKIP the backend's own operational
      // analysis. Fall back to re-analysing only when it's absent (legacy rows).
      const appCoaching = (transcript as { coachingAnalysis?: unknown })?.coachingAnalysis ?? null;
      if (!appCoaching) logOperationalFallback(transcript.id);
      const [strategicAnalysis, operationalAnalysisRaw] = await Promise.all([
        analyzeTranscript(
          transcript.content,
          strategicPlan ? [planPromptContent(strategicPlan)] : [],
          language as Language
        ),
        appCoaching
          ? Promise.resolve(null)
          : analyzeTranscriptOperational(
              transcript.content,
              operationalPlan ? [planPromptContent(operationalPlan)] : [],
              language as Language
            )
      ]);
      const operationalAnalysis = (appCoaching ??
        operationalAnalysisRaw) as Awaited<ReturnType<typeof analyzeTranscriptOperational>>;

      // Update the stored analysis on the transcript
      await storage.updateTranscript(transcript.id, {
        analysis: JSON.stringify({ strategic: strategicAnalysis, operational: operationalAnalysis })
      });

      const weekNumber = getWeekNumberFromDate(new Date(transcript.uploadedAt!));

      // ── Re-analysis Phase 1: Merge quantitative data (fast, no GPT) ──────────
      const strategicSnapshot = await storage.getOrCreateSnapshot(weekNumber, 'strategic', language, companyId);
      const existingStrategicData = JSON.parse(strategicSnapshot.data);
      const mergedStrategicData = {
        trends: {
          trendGroups: mergeTrendGroups(existingStrategicData.trends?.trendGroups, strategicAnalysis.trends?.trendGroups),
          comparison: existingStrategicData.trends?.comparison || ''
        },
        customerSatisfaction: {
          sentiments: mergeAnalyticsData(existingStrategicData.customerSatisfaction?.sentiments, strategicAnalysis.customerSatisfaction?.sentiments),
          issues: mergeAnalyticsData(existingStrategicData.customerSatisfaction?.issues, strategicAnalysis.customerSatisfaction?.issues),
          comparison: existingStrategicData.customerSatisfaction?.comparison || ''
        },
        competition: {
          competitors: mergeAnalyticsData(existingStrategicData.competition?.competitors, strategicAnalysis.competition?.competitors),
          strengths: mergeAnalyticsData(existingStrategicData.competition?.strengths, strategicAnalysis.competition?.strengths),
          comparison: existingStrategicData.competition?.comparison || ''
        },
        proposition: {
          execution: mergeAnalyticsData(existingStrategicData.proposition?.execution, strategicAnalysis.proposition?.execution),
          resonance: mergeAnalyticsData(existingStrategicData.proposition?.resonance, strategicAnalysis.proposition?.resonance),
          comparison: existingStrategicData.proposition?.comparison || ''
        }
      };
      const newStrategicCount = parseInt(strategicSnapshot.transcriptCount) + 1;
      await storage.updateSnapshot(strategicSnapshot.id, JSON.stringify(mergedStrategicData), newStrategicCount);

      const operationalSnapshot = await storage.getOrCreateSnapshot(weekNumber, 'operational', language, companyId);
      const existingOperationalData = JSON.parse(operationalSnapshot.data);
      const prevCount = parseInt(operationalSnapshot.transcriptCount) || 0;
      const newOperationalCount = prevCount + 1;
      const mergedOperationalData: any = {
        conversationActivity: {
          totalConversations: (existingOperationalData.conversationActivity?.totalConversations || 0) + 1,
          avgDuration: existingOperationalData.conversationActivity?.avgDuration || 0,
          activityByDay: mergeAnalyticsData(existingOperationalData.conversationActivity?.activityByDay, []),
          comparison: existingOperationalData.conversationActivity?.comparison || ''
        },
        picaPerformance: {
          phaseScores: mergePhaseScores(existingOperationalData.picaPerformance?.phaseScores, normalizePhaseScoreNames(operationalPicaFor(transcript, operationalAnalysis)?.phaseScores), prevCount),
          phaseDetails: mergePhaseDetails(existingOperationalData.picaPerformance?.phaseDetails, operationalPicaFor(transcript, operationalAnalysis)?.phaseDetails, prevCount),
          comparison: existingOperationalData.picaPerformance?.comparison || ''
        },
        dealHealth: {
          leadWarmth: mergeAnalyticsData(existingOperationalData.dealHealth?.leadWarmth, operationalAnalysis.dealHealth?.leadWarmth),
          dealStages: mergeAnalyticsData(existingOperationalData.dealHealth?.dealStages, operationalAnalysis.dealHealth?.dealStages),
          avgDealScore: runningAverage(existingOperationalData.dealHealth?.avgDealScore || 0, operationalAnalysis.dealHealth?.avgDealScore || 0, prevCount),
          comparison: existingOperationalData.dealHealth?.comparison || ''
        },
        resistanceNeeds: {
          topResistances: mergeAnalyticsData(existingOperationalData.resistanceNeeds?.topResistances, operationalAnalysis.resistanceNeeds?.topResistances),
          commercialTriggers: mergeAnalyticsData(existingOperationalData.resistanceNeeds?.commercialTriggers, operationalAnalysis.resistanceNeeds?.commercialTriggers),
          comparison: existingOperationalData.resistanceNeeds?.comparison || ''
        },
        nextStepDiscipline: {
          withClearNextStep: runningAverage(existingOperationalData.nextStepDiscipline?.withClearNextStep || 0, operationalAnalysis.nextStepDiscipline?.withClearNextStep || 0, prevCount),
          nextStepTypes: mergeAnalyticsData(existingOperationalData.nextStepDiscipline?.nextStepTypes, operationalAnalysis.nextStepDiscipline?.nextStepTypes),
          avgNextStepClarity: runningAverage(existingOperationalData.nextStepDiscipline?.avgNextStepClarity || 0, operationalAnalysis.nextStepDiscipline?.avgNextStepClarity || 0, prevCount),
          comparison: existingOperationalData.nextStepDiscipline?.comparison || ''
        },
        dmuInsights: {
          dmuMentioned: operationalAnalysis.dmuInsights?.dmuMentioned || existingOperationalData.dmuInsights?.dmuMentioned || false,
          decisionProcessClear: operationalAnalysis.dmuInsights?.decisionProcessClear || existingOperationalData.dmuInsights?.decisionProcessClear || false,
          stakeholders: mergeAnalyticsData(existingOperationalData.dmuInsights?.stakeholders, operationalAnalysis.dmuInsights?.stakeholders),
          dmuClarity: runningAverage(existingOperationalData.dmuInsights?.dmuClarity || 0, operationalAnalysis.dmuInsights?.dmuClarity || 0, prevCount),
          comparison: existingOperationalData.dmuInsights?.comparison || ''
        },
        uspMentions: {
          usps: mergeAnalyticsData(existingOperationalData.uspMentions?.usps, operationalAnalysis.uspMentions?.usps),
          comparison: existingOperationalData.uspMentions?.comparison || ''
        },
        teamInsights: {} as any
      };
      // Compute teamInsights immediately (no GPT needed)
      const totalConversations = mergedOperationalData.conversationActivity.totalConversations || 1;
      const picaPhases = mergedOperationalData.picaPerformance.phaseScores || [];
      const avgPicaScore = picaPhases.length > 0
        ? Math.round(picaPhases.reduce((sum: number, p: any) => sum + (p.value || 0), 0) / picaPhases.length)
        : 0;
      const nextStepClarity = mergedOperationalData.nextStepDiscipline.avgNextStepClarity || 0;
      const resistanceCount = (mergedOperationalData.resistanceNeeds.topResistances || []).length;
      mergedOperationalData.teamInsights = {
        absolute: [
          { name: "Gem. Team PICA", value: avgPicaScore },
          { name: "Totaal Gesprekken", value: totalConversations },
          { name: "Duidelijke Next Steps", value: Math.round(mergedOperationalData.nextStepDiscipline.withClearNextStep || 0) },
          { name: "Weerstanden Gedetecteerd", value: resistanceCount }
        ],
        percentages: [
          { name: "Next Steps %", value: Math.round(mergedOperationalData.nextStepDiscipline.withClearNextStep || 0) },
          { name: "PICA Gemiddelde %", value: avgPicaScore }
        ],
        uspOverview: mergedOperationalData.uspMentions.usps || [],
        comparison: existingOperationalData.teamInsights?.comparison || `Gemiddelde PICA score: ${avgPicaScore}%. Next step discipline: ${Math.round(nextStepClarity)}%.`
      };
      await storage.updateSnapshot(operationalSnapshot.id, JSON.stringify(mergedOperationalData), newOperationalCount);

      // ── Re-analysis Phase 2: Generate comparison texts concurrently (slow GPT) ─
      const [aggregateComparisons, opAggComparisons] = await Promise.all([
        generateStrategicAggregateComparisons(mergedStrategicData, strategicPlan?.content || null, newStrategicCount, language as Language),
        generateOperationalAggregateComparisons(mergedOperationalData, operationalPlan?.content || null, newOperationalCount, language as Language)
      ]);
      // Write comparison fields back
      const stratSnapForComp = await storage.getOrCreateSnapshot(weekNumber, 'strategic', language, companyId);
      const stratDataForComp = JSON.parse(stratSnapForComp.data);
      stratDataForComp.trends.comparison = aggregateComparisons.trendsComparison;
      stratDataForComp.customerSatisfaction.comparison = aggregateComparisons.satisfactionComparison;
      stratDataForComp.competition.comparison = aggregateComparisons.competitionComparison;
      stratDataForComp.proposition.comparison = aggregateComparisons.propositionComparison;
      await storage.updateSnapshot(stratSnapForComp.id, JSON.stringify(stratDataForComp), parseInt(stratSnapForComp.transcriptCount) || 0);

      const opSnapForComp = await storage.getOrCreateSnapshot(weekNumber, 'operational', language, companyId);
      const opDataForComp = JSON.parse(opSnapForComp.data);
      opDataForComp.picaPerformance.comparison = opAggComparisons.picaComparison;
      opDataForComp.dealHealth.comparison = opAggComparisons.dealHealthComparison;
      opDataForComp.resistanceNeeds.comparison = opAggComparisons.resistanceComparison;
      opDataForComp.nextStepDiscipline.comparison = opAggComparisons.nextStepComparison;
      opDataForComp.dmuInsights.comparison = opAggComparisons.dmuComparison;
      opDataForComp.uspMentions.comparison = opAggComparisons.uspComparison;
      if (opDataForComp.teamInsights) {
        opDataForComp.teamInsights.comparison = opAggComparisons.picaComparison || opDataForComp.teamInsights.comparison;
      }
      await storage.updateSnapshot(opSnapForComp.id, JSON.stringify(opDataForComp), parseInt(opSnapForComp.transcriptCount) || 0);

      processed++;
      reanalysisStatusMap.set(language, {
        state: 'running',
        processed,
        total: transcripts.length,
        startedAt: reanalysisStatusMap.get(language)!.startedAt
      });
      console.log(`Reanalysis [${language}]: processed ${processed}/${transcripts.length}`);
    } catch (err: any) {
      console.error(`Reanalysis [${language}]: failed on transcript ${transcript.id}:`, err.message);
      // Continue with next transcript
      processed++;
      reanalysisStatusMap.set(language, {
        state: 'running',
        processed,
        total: transcripts.length,
        startedAt: reanalysisStatusMap.get(language)!.startedAt
      });
    }
  }

  reanalysisStatusMap.set(language, {
    state: 'complete',
    processed,
    total: transcripts.length,
    startedAt: reanalysisStatusMap.get(language)!.startedAt,
    completedAt: new Date()
  });
  console.log(`Reanalysis [${language}]: completed. ${processed}/${transcripts.length} transcripts processed.`);
}

export async function registerRoutes(app: Express): Promise<Server> {
  // ─── SEO ──────────────────────────────────────────────────────────────────
  app.get("/robots.txt", (_req, res) => {
    res.type("text/plain").send("User-agent: *\nAllow: /\n");
  });

  // Configure session middleware
  configureSession(app);

  // ─── AUTH ROUTES ──────────────────────────────────────────────────────────

  // POST /api/auth/login
  app.post("/api/auth/login", authRateLimiter, async (req, res) => {
    try {
      const { email, password, rememberMe } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "E-mail en wachtwoord zijn verplicht" });
      }
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Ongeldig e-mailadres of wachtwoord" });
      }
      const valid = await verifyPassword(password, user.password);
      if (!valid) {
        return res.status(401).json({ error: "Ongeldig e-mailadres of wachtwoord" });
      }
      // Set session duration: 30 days if rememberMe, else session cookie (browser close)
      if (rememberMe) {
        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
      } else {
        req.session.cookie.expires = undefined;
        req.session.cookie.maxAge = undefined as any;
      }
      if (user.twoFactorEnabled) {
        req.session.pendingUserId = user.id;
        return res.json({ requiresTwoFactor: true });
      }
      req.session.userId = user.id;
      req.session.companyId = user.companyId;
      req.session.userRole = user.role;
      req.session.pendingUserId = undefined;
      return res.json({ user: safeUser(user) });
    } catch (err) {
      console.error("Login error:", err);
      return res.status(500).json({ error: "Server fout bij inloggen" });
    }
  });

  // POST /api/auth/2fa-verify  (complete login after 2FA)
  app.post("/api/auth/2fa-verify", authRateLimiter, async (req, res) => {
    try {
      const { token } = req.body;
      const pendingId = req.session.pendingUserId;
      if (!pendingId) {
        return res.status(400).json({ error: "Geen actieve inlogpoging" });
      }
      const user = await storage.getUser(pendingId);
      if (!user || !user.twoFactorSecret) {
        return res.status(400).json({ error: "Gebruiker niet gevonden" });
      }
      const valid = verifyTwoFactorToken(token, user.twoFactorSecret);
      if (!valid) {
        return res.status(401).json({ error: "Ongeldige verificatiecode" });
      }
      req.session.userId = user.id;
      req.session.companyId = user.companyId;
      req.session.userRole = user.role;
      req.session.pendingUserId = undefined;
      return res.json({ user: safeUser(user) });
    } catch (err) {
      console.error("2FA verify error:", err);
      return res.status(500).json({ error: "Server fout" });
    }
  });

  // POST /api/auth/logout
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  // GET /api/auth/me
  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Niet ingelogd" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ error: "Gebruiker niet gevonden" });
    }
    return res.json({ user: safeUser(user) });
  });

  // POST /api/auth/forgot-password
  app.post("/api/auth/forgot-password", authRateLimiter, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: "E-mailadres is verplicht" });

      const result = await storage.createPasswordResetToken(email);
      // Always return success to prevent email enumeration
      if (result) {
        const user = await storage.getUser(result.userId);
        if (user) {
          try {
            await sendPasswordResetEmail(email, user.username, result.code);
          } catch (emailErr) {
            console.error("Failed to send reset email:", emailErr);
          }
        }
      }
      return res.json({ success: true });
    } catch (err) {
      console.error("Forgot password error:", err);
      return res.status(500).json({ error: "Server fout" });
    }
  });

  // POST /api/auth/reset-password
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { code, newPassword } = req.body;
      if (!code || !newPassword) return res.status(400).json({ error: "Code en nieuw wachtwoord zijn verplicht" });
      if (newPassword.length < 6) return res.status(400).json({ error: "Wachtwoord moet minimaal 6 tekens bevatten" });

      const token = await storage.verifyAndConsumePasswordResetToken(code);
      if (!token) return res.status(400).json({ error: "Ongeldige of verlopen code" });

      const hashed = await hashPassword(newPassword);
      await storage.updateUser(token.userId, { password: hashed });
      return res.json({ success: true });
    } catch (err) {
      console.error("Reset password error:", err);
      return res.status(500).json({ error: "Server fout" });
    }
  });

  // PATCH /api/auth/profile  (update phone/mobile or change password)
  app.patch("/api/auth/profile", requireJwtAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(404).json({ error: "Gebruiker niet gevonden" });

      const { phone, mobile, currentPassword, newPassword } = req.body;

      // Password change
      if (currentPassword !== undefined && newPassword !== undefined) {
        const valid = await verifyPassword(currentPassword, user.password);
        if (!valid) return res.status(401).json({ error: "Huidig wachtwoord is onjuist" });
        const hashed = await hashPassword(newPassword);
        const updated = await storage.updateUser(user.id, { password: hashed });
        return res.json({ user: safeUser(updated!) });
      }

      // Info update (phone/mobile)
      const updates: Partial<typeof user> = {};
      if (phone !== undefined) updates.phone = phone || null;
      if (mobile !== undefined) updates.mobile = mobile || null;
      const updated = await storage.updateUser(user.id, updates);
      return res.json({ user: safeUser(updated!) });
    } catch (err) {
      console.error("Profile update error:", err);
      return res.status(500).json({ error: "Server fout" });
    }
  });

  // POST /api/auth/2fa/setup  (generate secret + QR code)
  app.post("/api/auth/2fa/setup", requireJwtAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(404).json({ error: "Gebruiker niet gevonden" });
      const { secret, otpauthUrl } = generateTwoFactorSecret(user.email);
      const qrCodeDataUrl = await generateQRCode(otpauthUrl);
      // Store secret temporarily (not yet enabled)
      await storage.updateUser(user.id, { twoFactorSecret: secret });
      return res.json({ secret, qrCodeDataUrl });
    } catch (err) {
      console.error("2FA setup error:", err);
      return res.status(500).json({ error: "Server fout" });
    }
  });

  // POST /api/auth/2fa/enable  (verify code and activate 2FA)
  app.post("/api/auth/2fa/enable", requireJwtAuth, async (req, res) => {
    try {
      const { token } = req.body;
      const user = await storage.getUser(req.session.userId!);
      if (!user || !user.twoFactorSecret) {
        return res.status(400).json({ error: "Stel eerst 2FA in" });
      }
      const valid = verifyTwoFactorToken(token, user.twoFactorSecret);
      if (!valid) {
        return res.status(401).json({ error: "Ongeldige verificatiecode" });
      }
      await storage.updateUser(user.id, { twoFactorEnabled: true });
      return res.json({ success: true });
    } catch (err) {
      console.error("2FA enable error:", err);
      return res.status(500).json({ error: "Server fout" });
    }
  });

  // POST /api/auth/2fa/disable
  app.post("/api/auth/2fa/disable", requireJwtAuth, async (req, res) => {
    try {
      const { token } = req.body;
      const user = await storage.getUser(req.session.userId!);
      if (!user || !user.twoFactorSecret) {
        return res.status(400).json({ error: "2FA is niet actief" });
      }
      const valid = verifyTwoFactorToken(token, user.twoFactorSecret);
      if (!valid) {
        return res.status(401).json({ error: "Ongeldige verificatiecode" });
      }
      await storage.updateUser(user.id, { twoFactorEnabled: false, twoFactorSecret: null });
      return res.json({ success: true });
    } catch (err) {
      console.error("2FA disable error:", err);
      return res.status(500).json({ error: "Server fout" });
    }
  });

  // ─── DASHBOARD ANALYSIS MODEL (superadmin only) ──────────────────────────
  // Mirrors the app's conversation-analysis model picker, but for the dashboard
  // analysis. The chosen model is resolved per analysis via getDashboardLLMRoute().
  app.get("/api/platform-settings/dashboard-model", parseJwtIfPresent, async (req, res) => {
    if (!req.jwtUser && !req.session?.userId) return res.status(401).json({ message: "Niet ingelogd" });
    if ((req.jwtUser?.role || req.session?.userRole) !== "superadmin") return res.status(403).json({ message: "Geen toegang" });
    try {
      const settings = await getDashboardModelSettings();
      res.json({ data: settings });
    } catch (error) {
      console.error("[platform-settings/dashboard-model] GET failed:", error);
      res.status(500).json({ message: "Failed to load dashboard model settings" });
    }
  });

  app.put("/api/platform-settings/dashboard-model", parseJwtIfPresent, async (req, res) => {
    if (!req.jwtUser && !req.session?.userId) return res.status(401).json({ message: "Niet ingelogd" });
    if ((req.jwtUser?.role || req.session?.userRole) !== "superadmin") return res.status(403).json({ message: "Geen toegang" });
    try {
      const routeId = typeof req.body?.routeId === "string" ? req.body.routeId : "";
      if (!routeId.trim()) {
        return res.status(400).json({ message: "Model route is required" });
      }
      const saved = await setDashboardLLMRoute(routeId);
      const settings = await getDashboardModelSettings();
      res.json({ data: { currentRouteId: saved.routeId, currentModel: settings.currentModel } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save dashboard model";
      console.error("[platform-settings/dashboard-model] PUT failed:", error);
      if (message.includes("not available") || message.includes("Could not load models")) {
        return res.status(400).json({ message });
      }
      res.status(500).json({ message });
    }
  });

  // ─── COMPANY ROUTES (superadmin only) ────────────────────────────────────

  // GET /api/companies
  app.get("/api/companies", requireSuperAdmin, async (req, res) => {
    try {
      const companies = await storage.getAllCompanies();
      return res.json(companies);
    } catch (err) {
      return res.status(500).json({ error: "Server fout" });
    }
  });

  // POST /api/companies  (create company + optionally create admin user)
  app.post("/api/companies", requireSuperAdmin, async (req, res) => {
    try {
      const { companyName, email, phone, mobile, password } = req.body;
      if (!companyName || !email || !password) {
        return res.status(400).json({ error: "Bedrijfsnaam, e-mail en wachtwoord zijn verplicht" });
      }
      // Username is always equal to email
      const username = email;
      // Check duplicate email (also covers username since they are the same)
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(409).json({ error: "E-mailadres is al in gebruik" });
      }
      // Create company
      const company = await storage.createCompany({ name: companyName });
      // Create admin user for the company
      const hashedPw = await hashPassword(password);
      const user = await storage.createUser({
        username,
        password: hashedPw,
        email,
        phone: phone || null,
        mobile: mobile || null,
        companyId: company.id,
        role: 'admin',
      });
      return res.status(201).json({ company, user: safeUser(user) });
    } catch (err) {
      console.error("Create company error:", err);
      return res.status(500).json({ error: "Server fout" });
    }
  });

  // GET /api/company  (returns the current admin's own company)
  app.get("/api/company", requireJwtAuth, async (req, res) => {
    try {
      if (!req.session.companyId) {
        return res.status(404).json({ error: "Geen bedrijf gekoppeld aan dit account" });
      }
      const company = await storage.getCompany(req.session.companyId);
      if (!company) return res.status(404).json({ error: "Bedrijf niet gevonden" });
      return res.json(company);
    } catch (err) {
      return res.status(500).json({ error: "Server fout" });
    }
  });

  // PATCH /api/companies/:id  (update company fields, e.g. defaultLanguage)
  // Superadmins can update any company; admins can only update their own.
  app.patch("/api/companies/:id", requireJwtAuth, async (req, res) => {
    try {
      const { userRole, companyId } = req.session;
      if (userRole !== 'superadmin' && userRole !== 'admin') {
        return res.status(403).json({ error: "Geen toegang" });
      }
      if (userRole !== 'superadmin' && companyId !== req.params.id) {
        return res.status(403).json({ error: "Geen toegang" });
      }
      const { defaultLanguage } = req.body;
      const validLanguages = ['nl', 'en', 'de', 'fr', 'es', 'it', null];
      if (!validLanguages.includes(defaultLanguage)) {
        return res.status(400).json({ error: "Ongeldige taal" });
      }
      const updated = await storage.updateCompany(req.params.id, { defaultLanguage: defaultLanguage ?? null });
      if (!updated) return res.status(404).json({ error: "Bedrijf niet gevonden" });
      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: "Server fout" });
    }
  });

  // POST /api/companies/:id/test-webhook  (superadmin: ping the company webhook)
  app.post("/api/companies/:id/test-webhook", requireSuperAdmin, async (req, res) => {
    try {
      const company = await storage.getCompany(req.params.id);
      if (!company) return res.status(404).json({ error: "Bedrijf niet gevonden" });

      const lang = company.defaultLanguage;
      const internalPort = parseInt(process.env.PORT || "5000", 10);
      let webhookUrl = `http://127.0.0.1:${internalPort}/api/webhooks/assemblyai?companyId=${company.id}`;
      if (lang) webhookUrl += `&lang=${lang}`;

      const testPayload = { status: "test_ping", transcript_id: "test_ping_probe" };

      const pingHeaders: Record<string, string> = { "Content-Type": "application/json" };
      const webhookSecret = process.env.ASSEMBLYAI_WEBHOOK_SECRET;
      if (webhookSecret) pingHeaders["x-webhook-secret"] = webhookSecret;

      let statusCode: number;
      try {
        const pingRes = await fetch(webhookUrl, {
          method: "POST",
          headers: pingHeaders,
          body: JSON.stringify(testPayload),
          signal: AbortSignal.timeout(8000),
        });
        statusCode = pingRes.status;
      } catch (fetchErr: unknown) {
        const message = fetchErr instanceof Error ? fetchErr.message : "Verbinding mislukt";
        return res.json({ ok: false, error: message });
      }

      const ok = statusCode >= 200 && statusCode < 300;
      return res.json({ ok, status: statusCode });
    } catch (err) {
      return res.status(500).json({ error: "Server fout" });
    }
  });

  // DELETE /api/companies/:id
  app.delete("/api/companies/:id", requireSuperAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteCompany(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Bedrijf niet gevonden" });
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: "Server fout" });
    }
  });

  // ─── USER MANAGEMENT (superadmin) ────────────────────────────────────────

  // GET /api/users
  app.get("/api/users", requireSuperAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      return res.json(users.map(safeUser));
    } catch (err) {
      return res.status(500).json({ error: "Server fout" });
    }
  });

  // DELETE /api/users/:id
  // PATCH /api/users/:id/password  (superadmin: change any user's password)
  app.patch("/api/users/:id/password", requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: "Wachtwoord moet minimaal 6 tekens bevatten" });
      }
      const user = await storage.getUser(id);
      if (!user) return res.status(404).json({ error: "Gebruiker niet gevonden" });
      if (user.role === "superadmin" && user.id !== req.session.userId) {
        return res.status(403).json({ error: "Kan wachtwoord van andere superadmin niet wijzigen" });
      }
      const hashed = await hashPassword(newPassword);
      await storage.updateUser(id, { password: hashed });
      return res.json({ success: true });
    } catch (err) {
      console.error("Change user password error:", err);
      return res.status(500).json({ error: "Server fout" });
    }
  });

  app.delete("/api/users/:id", requireSuperAdmin, async (req, res) => {
    try {
      if (req.params.id === req.session.userId) {
        return res.status(400).json({ error: "Je kunt jezelf niet verwijderen" });
      }
      const deleted = await storage.deleteUser(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Gebruiker niet gevonden" });
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: "Server fout" });
    }
  });

  // ─── EXISTING ROUTES ─────────────────────────────────────────────────────

  app.post("/api/transcripts", requireJwtAuth, async (req, res) => {
    try {
      const companyId = getCompanyFilter(req);
      let body = { ...req.body };

      // Superadmin may supply targetCompanyId to upload on behalf of a company
      let resolvedCompanyId: string | null = companyId ?? null;
      const isSuperAdmin = req.session?.userRole === 'superadmin' || req.jwtUser?.role === 'superadmin';
      if (isSuperAdmin && body.targetCompanyId) {
        resolvedCompanyId = body.targetCompanyId;
      }
      delete body.targetCompanyId;

      if (body.isPdf && body.content) {
        try {
          body.content = await extractTextFromPdfBase64(body.content);
        } catch (pdfErr: any) {
          return res.status(400).json({ error: `PDF-verwerking mislukt: ${pdfErr.message}` });
        }
      }
      const validatedData = insertTranscriptSchema.parse(body);
      
      if (!isDashboardLlmConfigured) {
        return res.status(503).json({
          error: 'LLM-gateway niet geconfigureerd (LITELLM_BASE_URL/LITELLM_API_KEY). Analyse is niet beschikbaar.'
        });
      }
      
      if (!isValidLanguage(validatedData.language)) {
        return res.status(400).json({
          error: `Invalid language: ${validatedData.language}. Supported languages: nl, en, de, fr, es, it`
        });
      }
      
      // Record which salesperson this conversation belongs to (from the JWT),
      // so the same operational analysis can be aggregated per-salesperson
      // (individual dashboard) as well as per-company (management dashboard).
      const salespersonId = req.jwtUser?.id ?? null;
      const salespersonName =
        (typeof body.userName === "string" && body.userName.trim())
          ? body.userName.trim()
          : (req.jwtUser?.email ?? null);

      const transcript = await storage.createTranscript({
        ...validatedData,
        companyId: resolvedCompanyId,
        userId: salespersonId,
        userName: salespersonName,
      });
      res.json(transcript);

      // Always use resolvedCompanyId (= targetCompanyId for superadmin) for plan/doc lookups and snapshot storage
      const effectiveCompanyId = resolvedCompanyId ?? companyId ?? null;

      // Get legacy strategy documents for backward compatibility
      const strategyDocs = await storage.getAllStrategyDocuments(effectiveCompanyId);
      const strategyContents = strategyDocs.map(doc => doc.content);

      // Get plan documents for the transcript's language
      const strategicPlan = await storage.getPlan('strategic', transcript.language, effectiveCompanyId);
      const operationalPlan = await storage.getPlan('operational', transcript.language, effectiveCompanyId);
      
      // Combine all context documents: legacy strategy docs + new plan documents
      const allContextDocs = [...strategyContents];
      if (strategicPlan) {
        allContextDocs.push(`[STRATEGIC PLAN]\n${strategicPlan.content}`);
      }
      if (operationalPlan) {
        allContextDocs.push(`[OPERATIONAL SALES PLAN]\n${operationalPlan.content}`);
      }
      
      (async () => {
        try {
          if (!isValidLanguage(transcript.language)) {
            throw new Error(`Invalid language in stored transcript: ${transcript.language}. This should not happen.`);
          }

          // Mark as processing so the UI shows the spinner immediately
          await storage.updateTranscript(transcript.id, { status: 'processing' });
          
          const weekNumber = getCurrentWeekNumber();

          await applyDashboardLLMRouteFromSettings();
          
          // Single source of truth: prefer the app-provided operational
          // coaching analysis (identical PICA to the personal dashboard +
          // coherent tiles) and SKIP the backend's own operational analysis;
          // fall back to re-analysing only when it's absent (legacy rows).
          const appCoaching = (transcript as { coachingAnalysis?: unknown })?.coachingAnalysis ?? null;
          if (!appCoaching) logOperationalFallback(transcript.id);
          // Run strategic (always) + operational (only when app didn't supply it) in parallel
          const [strategicAnalysis, operationalAnalysisRaw] = await Promise.all([
            analyzeTranscript(
              transcript.content,
              strategicPlan ? [planPromptContent(strategicPlan)] : strategyContents,
              transcript.language
            ),
            appCoaching
              ? Promise.resolve(null)
              : analyzeTranscriptOperational(
                  transcript.content,
                  operationalPlan ? [planPromptContent(operationalPlan)] : [],
                  transcript.language
                )
          ]);
          const operationalAnalysis = (appCoaching ??
            operationalAnalysisRaw) as Awaited<ReturnType<typeof analyzeTranscriptOperational>>;
          
          // Store combined analysis in transcript
          const combinedAnalysis = {
            strategic: strategicAnalysis,
            operational: operationalAnalysis
          };
          
          await storage.updateTranscript(transcript.id, {
            status: 'analyzed',
            analysis: JSON.stringify(combinedAnalysis)
          });
          
          // ── PHASE 1: Fast quantitative merge (inside lock, no GPT) ─────────────
          // Data is visible in the dashboard immediately after this completes.
          let strategicMergedData: any;
          let newStrategicCount: number;
          // Use effectiveCompanyId so superadmin uploads land in the target company's bucket
          const cid = effectiveCompanyId;
          await queueSnapshotUpdate(`${cid ?? 'global'}:${weekNumber}:strategic:${transcript.language}`, async () => {
            const strategicSnapshot = await storage.getOrCreateSnapshot(weekNumber, 'strategic', transcript.language, cid);
            const existingStrategicData = JSON.parse(strategicSnapshot.data);
            newStrategicCount = parseInt(strategicSnapshot.transcriptCount) + 1;
            strategicMergedData = {
              trends: {
                trendGroups: mergeTrendGroups(existingStrategicData.trends?.trendGroups, strategicAnalysis.trends?.trendGroups),
                comparison: existingStrategicData.trends?.comparison || ''
              },
              customerSatisfaction: {
                sentiments: mergeAnalyticsData(existingStrategicData.customerSatisfaction?.sentiments, strategicAnalysis.customerSatisfaction?.sentiments),
                issues: mergeAnalyticsData(existingStrategicData.customerSatisfaction?.issues, strategicAnalysis.customerSatisfaction?.issues),
                comparison: existingStrategicData.customerSatisfaction?.comparison || ''
              },
              competition: {
                competitors: mergeAnalyticsData(existingStrategicData.competition?.competitors, strategicAnalysis.competition?.competitors),
                strengths: mergeAnalyticsData(existingStrategicData.competition?.strengths, strategicAnalysis.competition?.strengths),
                comparison: existingStrategicData.competition?.comparison || ''
              },
              proposition: {
                execution: mergeAnalyticsData(existingStrategicData.proposition?.execution, strategicAnalysis.proposition?.execution),
                resonance: mergeAnalyticsData(existingStrategicData.proposition?.resonance, strategicAnalysis.proposition?.resonance),
                comparison: existingStrategicData.proposition?.comparison || ''
              }
            };
            await storage.updateSnapshot(strategicSnapshot.id, JSON.stringify(strategicMergedData), newStrategicCount);
          });

          let operationalMergedData: any;
          let newOperationalCount: number;
          await queueSnapshotUpdate(`${cid ?? 'global'}:${weekNumber}:operational:${transcript.language}`, async () => {
            const operationalSnapshot = await storage.getOrCreateSnapshot(weekNumber, 'operational', transcript.language, cid);
            const existingOperationalData = JSON.parse(operationalSnapshot.data);
            const prevCount = parseInt(operationalSnapshot.transcriptCount) || 0;
            newOperationalCount = prevCount + 1;
            operationalMergedData = {
              conversationActivity: {
                totalConversations: (existingOperationalData.conversationActivity?.totalConversations || 0) + 1,
                avgDuration: existingOperationalData.conversationActivity?.avgDuration || 0,
                activityByDay: mergeAnalyticsData(existingOperationalData.conversationActivity?.activityByDay, []),
                comparison: existingOperationalData.conversationActivity?.comparison || ''
              },
              picaPerformance: {
                phaseScores: mergePhaseScores(existingOperationalData.picaPerformance?.phaseScores, normalizePhaseScoreNames(operationalPicaFor(transcript, operationalAnalysis)?.phaseScores), prevCount),
                phaseDetails: mergePhaseDetails(existingOperationalData.picaPerformance?.phaseDetails, operationalPicaFor(transcript, operationalAnalysis)?.phaseDetails, prevCount),
                comparison: existingOperationalData.picaPerformance?.comparison || ''
              },
              dealHealth: {
                leadWarmth: mergeAnalyticsData(existingOperationalData.dealHealth?.leadWarmth, operationalAnalysis.dealHealth?.leadWarmth),
                dealStages: mergeAnalyticsData(existingOperationalData.dealHealth?.dealStages, operationalAnalysis.dealHealth?.dealStages),
                avgDealScore: runningAverage(existingOperationalData.dealHealth?.avgDealScore || 0, operationalAnalysis.dealHealth?.avgDealScore || 0, prevCount),
                comparison: existingOperationalData.dealHealth?.comparison || ''
              },
              resistanceNeeds: {
                topResistances: mergeAnalyticsData(existingOperationalData.resistanceNeeds?.topResistances, operationalAnalysis.resistanceNeeds?.topResistances),
                commercialTriggers: mergeAnalyticsData(existingOperationalData.resistanceNeeds?.commercialTriggers, operationalAnalysis.resistanceNeeds?.commercialTriggers),
                comparison: existingOperationalData.resistanceNeeds?.comparison || ''
              },
              nextStepDiscipline: {
                withClearNextStep: runningAverage(existingOperationalData.nextStepDiscipline?.withClearNextStep || 0, operationalAnalysis.nextStepDiscipline?.withClearNextStep || 0, prevCount),
                nextStepTypes: mergeAnalyticsData(existingOperationalData.nextStepDiscipline?.nextStepTypes, operationalAnalysis.nextStepDiscipline?.nextStepTypes),
                avgNextStepClarity: runningAverage(existingOperationalData.nextStepDiscipline?.avgNextStepClarity || 0, operationalAnalysis.nextStepDiscipline?.avgNextStepClarity || 0, prevCount),
                comparison: existingOperationalData.nextStepDiscipline?.comparison || ''
              },
              dmuInsights: {
                dmuMentioned: operationalAnalysis.dmuInsights?.dmuMentioned || existingOperationalData.dmuInsights?.dmuMentioned || false,
                decisionProcessClear: operationalAnalysis.dmuInsights?.decisionProcessClear || existingOperationalData.dmuInsights?.decisionProcessClear || false,
                stakeholders: mergeAnalyticsData(existingOperationalData.dmuInsights?.stakeholders, operationalAnalysis.dmuInsights?.stakeholders),
                dmuClarity: runningAverage(existingOperationalData.dmuInsights?.dmuClarity || 0, operationalAnalysis.dmuInsights?.dmuClarity || 0, prevCount),
                comparison: existingOperationalData.dmuInsights?.comparison || ''
              },
              uspMentions: {
                usps: mergeAnalyticsData(existingOperationalData.uspMentions?.usps, operationalAnalysis.uspMentions?.usps),
                comparison: existingOperationalData.uspMentions?.comparison || ''
              },
              teamInsights: existingOperationalData.teamInsights || {}
            };
            // Compute teamInsights immediately from merged data (no GPT needed)
            const totalConvs = operationalMergedData.conversationActivity.totalConversations || 1;
            const picaPhases = operationalMergedData.picaPerformance.phaseScores || [];
            const avgPica = picaPhases.length > 0
              ? Math.round(picaPhases.reduce((s: number, p: any) => s + (p.value || 0), 0) / picaPhases.length)
              : 0;
            const resCount = (operationalMergedData.resistanceNeeds.topResistances || []).length;
            operationalMergedData.teamInsights = {
              absolute: [
                { name: "Gem. Team PICA", value: avgPica },
                { name: "Totaal Gesprekken", value: totalConvs },
                { name: "Duidelijke Next Steps", value: Math.round(operationalMergedData.nextStepDiscipline.withClearNextStep || 0) },
                { name: "Weerstanden Gedetecteerd", value: resCount }
              ],
              percentages: [
                { name: "Next Steps %", value: Math.round(operationalMergedData.nextStepDiscipline.withClearNextStep || 0) },
                { name: "PICA Gemiddelde %", value: avgPica }
              ],
              uspOverview: operationalMergedData.uspMentions.usps || [],
              comparison: existingOperationalData.teamInsights?.comparison || `Gemiddelde PICA score: ${avgPica}%. Next step discipline: ${Math.round(operationalMergedData.nextStepDiscipline.avgNextStepClarity || 0)}%.`
            };
            await storage.updateSnapshot(operationalSnapshot.id, JSON.stringify(operationalMergedData), newOperationalCount);
          });

          console.log('Analysis completed for transcript:', transcript.id, '- Strategic and Operational data accumulated');

          // ── PHASE 2: Generate comparison texts concurrently (outside lock) ──────
          // Chart data is already visible. This updates comparison text only.
          (async () => {
            try {
              const [aggregateComparisons, opAggComparisons] = await Promise.all([
                generateStrategicAggregateComparisons(strategicMergedData!, strategicPlan?.content || null, newStrategicCount!, transcript.language as Language),
                generateOperationalAggregateComparisons(operationalMergedData!, operationalPlan?.content || null, newOperationalCount!, transcript.language as Language)
              ]);

              // Phase 2b: Write comparison texts back (fast, inside lock)
              await queueSnapshotUpdate(`${cid ?? 'global'}:${weekNumber}:strategic:${transcript.language}`, async () => {
                const snap = await storage.getOrCreateSnapshot(weekNumber, 'strategic', transcript.language, cid);
                const data = JSON.parse(snap.data);
                data.trends.comparison = aggregateComparisons.trendsComparison;
                data.customerSatisfaction.comparison = aggregateComparisons.satisfactionComparison;
                data.competition.comparison = aggregateComparisons.competitionComparison;
                data.proposition.comparison = aggregateComparisons.propositionComparison;
                await storage.updateSnapshot(snap.id, JSON.stringify(data), parseInt(snap.transcriptCount) || 0);
              });

              await queueSnapshotUpdate(`${cid ?? 'global'}:${weekNumber}:operational:${transcript.language}`, async () => {
                const snap = await storage.getOrCreateSnapshot(weekNumber, 'operational', transcript.language, cid);
                const data = JSON.parse(snap.data);
                data.picaPerformance.comparison = opAggComparisons.picaComparison;
                data.dealHealth.comparison = opAggComparisons.dealHealthComparison;
                data.resistanceNeeds.comparison = opAggComparisons.resistanceComparison;
                data.nextStepDiscipline.comparison = opAggComparisons.nextStepComparison;
                data.dmuInsights.comparison = opAggComparisons.dmuComparison;
                data.uspMentions.comparison = opAggComparisons.uspComparison;
                if (data.teamInsights) {
                  data.teamInsights.comparison = opAggComparisons.picaComparison || data.teamInsights.comparison;
                }
                await storage.updateSnapshot(snap.id, JSON.stringify(data), parseInt(snap.transcriptCount) || 0);
              });
            } catch (compErr: any) {
              console.error('Comparison generation failed for transcript:', transcript.id, compErr.message);
            }
          })();
        } catch (error: any) {
          console.error('Analysis failed for transcript:', transcript.id, error.message);
          await storage.updateTranscript(transcript.id, {
            status: 'error'
          });
        }
      })();
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/transcripts", requireJwtAuth, async (req, res) => {
    try {
      const companyId = getCompanyFilter(req);
      const transcripts = await storage.getAllTranscripts(companyId);
      res.json(transcripts);
    } catch (error: any) {
      serverError(res, error);
    }
  });

  app.get("/api/transcripts/:id", requireJwtAuth, async (req, res) => {
    try {
      const transcript = await storage.getTranscript(req.params.id);
      if (!transcript) {
        return res.status(404).json({ error: "Transcript not found" });
      }
      // Tenant isolation: a non-superadmin may only read transcripts of their own
      // company. 404 (not 403) so we don't confirm that the id exists.
      const companyId = getCompanyFilter(req);
      if (companyId !== undefined && transcript.companyId !== companyId) {
        return res.status(404).json({ error: "Transcript not found" });
      }
      res.json(transcript);
    } catch (error: any) {
      serverError(res, error);
    }
  });

  app.delete("/api/transcripts/:id", requireJwtAuth, async (req, res) => {
    try {
      const transcript = await storage.getTranscript(req.params.id);
      if (!transcript) {
        return res.status(404).json({ error: "Transcript not found" });
      }
      // Tenant isolation: only delete transcripts of your own company.
      const companyId = getCompanyFilter(req);
      if (companyId !== undefined && transcript.companyId !== companyId) {
        return res.status(404).json({ error: "Transcript not found" });
      }
      await storage.deleteTranscript(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      serverError(res, error);
    }
  });

  app.post("/api/strategy-documents", requireJwtAuth, async (req, res) => {
    try {
      const companyId = getCompanyFilter(req);
      const validatedData = insertStrategyDocumentSchema.parse(req.body);
      const doc = await storage.createStrategyDocument({ ...validatedData, companyId: companyId ?? null });
      res.json(doc);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/strategy-documents", requireJwtAuth, async (req, res) => {
    try {
      const companyId = getCompanyFilter(req);
      const docs = await storage.getAllStrategyDocuments(companyId);
      res.json(docs);
    } catch (error: any) {
      serverError(res, error);
    }
  });

  // Plan documents API (strategic and operational plans)
  // Extract-only preview: parses the uploaded document and returns the plain
  // text WITHOUT storing anything, so the manager can verify what was read
  // before activating the plan.
  app.post("/api/plans/extract", heavyDocRateLimiter, requireJwtAuth, requireManagerOrSuperAdmin, async (req, res) => {
    try {
      const { content, fileType, isPdf } = req.body || {};
      if (typeof content !== "string" || !content) {
        return res.status(400).json({ error: "Geen bestandsinhoud ontvangen" });
      }
      const text = await extractPlanText(fileType, content, isPdf);
      res.json({ text, chars: text.trim().length });
    } catch (error: any) {
      if (error instanceof PlanExtractionError) {
        return res.status(400).json({ error: error.message, code: error.code });
      }
      return res.status(400).json({ error: `Verwerking mislukt: ${error.message}` });
    }
  });

  app.post("/api/plans/:planType", heavyDocRateLimiter, requireJwtAuth, requireManagerOrSuperAdmin, async (req, res) => {
    try {
      const companyId = getCompanyFilter(req);
      const { planType } = req.params;

      // Validate plan type
      const planTypeResult = planTypeEnum.safeParse(planType);
      if (!planTypeResult.success) {
        return res.status(400).json({
          error: `Invalid plan type: ${planType}. Must be 'strategic' or 'operational'`
        });
      }

      let body = { ...req.body };
      // manual: content was composed in the manual-template form (not extracted
      // from a document), so the minimum-length scan check does not apply.
      const isManual = body.manual === true;
      // deferReanalysis: the manual flow confirms a structure right after this
      // call, which triggers its own reanalysis — skip the duplicate run here.
      const deferReanalysis = body.deferReanalysis === true;
      delete body.manual;
      delete body.deferReanalysis;

      if (body.content && !isManual) {
        try {
          body.content = await extractPlanText(body.fileType, body.content, body.isPdf);
        } catch (extractErr: any) {
          if (extractErr instanceof PlanExtractionError) {
            return res.status(400).json({ error: extractErr.message, code: extractErr.code });
          }
          return res.status(400).json({ error: `Documentverwerking mislukt: ${extractErr.message}` });
        }
      }
      delete body.fileType;

      const validatedData = insertPlanDocumentSchema.parse({
        ...body,
        planType: planTypeResult.data,
        companyId: companyId ?? null,
      });

      const plan = await storage.createOrReplacePlan(validatedData);
      res.json(plan);

      // Trigger async reanalysis of all transcripts for this plan's language
      const planLanguage = validatedData.language;
      if (!deferReanalysis && isValidLanguage(planLanguage)) {
        // Fire and forget — status tracked via /api/reanalysis/status/:language
        runReanalysisForLanguage(planLanguage, companyId).catch(err => {
          console.error(`Reanalysis failed for language ${planLanguage}:`, err.message);
          reanalysisStatusMap.set(planLanguage, {
            state: 'error',
            processed: reanalysisStatusMap.get(planLanguage)?.processed || 0,
            total: reanalysisStatusMap.get(planLanguage)?.total || 0,
            startedAt: reanalysisStatusMap.get(planLanguage)?.startedAt || new Date(),
            error: err.message
          });
        });
      }
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/plans/status/:language", requireJwtAuth, async (req, res) => {
    try {
      const companyId = getCompanyFilter(req);
      const { language } = req.params;
      const strategicPlan = await storage.getPlan('strategic', language, companyId);
      const operationalPlan = await storage.getPlan('operational', language, companyId);
      res.json({
        strategic: strategicPlan ? { active: true, filename: strategicPlan.filename, uploadedAt: strategicPlan.uploadedAt } : { active: false },
        operational: operationalPlan ? { active: true, filename: operationalPlan.filename, uploadedAt: operationalPlan.uploadedAt } : { active: false }
      });
    } catch (error: any) {
      serverError(res, error);
    }
  });

  app.get("/api/plans", requireJwtAuth, async (req, res) => {
    try {
      const companyId = getCompanyFilter(req);
      const plans = await storage.getAllPlans(companyId);
      res.json(plans);
    } catch (error: any) {
      serverError(res, error);
    }
  });

  app.get("/api/plans/:planType", requireJwtAuth, async (req, res) => {
    try {
      const companyId = getCompanyFilter(req);
      const { planType } = req.params;
      const language = (req.query.lang as string) || 'nl';
      
      const planTypeResult = planTypeEnum.safeParse(planType);
      if (!planTypeResult.success) {
        return res.status(400).json({ 
          error: `Invalid plan type: ${planType}. Must be 'strategic' or 'operational'` 
        });
      }
      
      const plan = await storage.getPlan(planTypeResult.data, language, companyId);
      if (!plan) {
        return res.status(404).json({ error: "Plan not found" });
      }
      res.json(plan);
    } catch (error: any) {
      serverError(res, error);
    }
  });

  // ── Structured plan (Fase 2): AI proposal + manager review ────────────────

  // Generate an AI proposal that normalizes the stored raw plan into the
  // canonical structure. Stored as 'proposed' — analyses keep using the raw
  // text until the manager confirms.
  app.post("/api/plans/:planType/structure", heavyDocRateLimiter, requireJwtAuth, requireManagerOrSuperAdmin, async (req, res) => {
    try {
      const companyId = getCompanyFilter(req);
      const planTypeResult = planTypeEnum.safeParse(req.params.planType);
      if (!planTypeResult.success) {
        return res.status(400).json({ error: `Invalid plan type: ${req.params.planType}` });
      }
      const language = (req.query.lang as string) || (req.body?.language as string) || 'nl';

      const plan = await storage.getPlan(planTypeResult.data, language, companyId);
      if (!plan) return res.status(404).json({ error: "Plan not found" });
      // getPlan falls back to the global plan; a company manager must not
      // (re)structure the global plan shared by other companies.
      if (companyId != null && plan.companyId !== companyId) {
        return res.status(404).json({ error: "Geen eigen plan voor dit bedrijf. Upload eerst een plan." });
      }

      await applyDashboardLLMRouteFromSettings();
      const structured = await structurePlan(planTypeResult.data, plan.content);
      await storage.updatePlanStructure(plan.id, structured, 'proposed');

      res.json({
        structured,
        status: 'proposed',
        counts: structuredPlanCounts(planTypeResult.data, structured),
      });
    } catch (error: any) {
      serverError(res, error, "plan structure proposal");
    }
  });

  // Manager confirmed (possibly edited) structure → store as 'confirmed' and
  // reanalyze so all dashboards compare against the reviewed structure.
  app.put("/api/plans/:planType/structure", requireJwtAuth, requireManagerOrSuperAdmin, async (req, res) => {
    try {
      const companyId = getCompanyFilter(req);
      const planTypeResult = planTypeEnum.safeParse(req.params.planType);
      if (!planTypeResult.success) {
        return res.status(400).json({ error: `Invalid plan type: ${req.params.planType}` });
      }
      const language = (req.query.lang as string) || (req.body?.language as string) || 'nl';

      const parseResult = structuredPlanSchemaFor(planTypeResult.data).safeParse(req.body?.structured);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Ongeldige structuur", details: parseResult.error.issues.slice(0, 5) });
      }

      const plan = await storage.getPlan(planTypeResult.data, language, companyId);
      if (!plan) return res.status(404).json({ error: "Plan not found" });
      if (companyId != null && plan.companyId !== companyId) {
        return res.status(404).json({ error: "Geen eigen plan voor dit bedrijf. Upload eerst een plan." });
      }

      await storage.updatePlanStructure(plan.id, parseResult.data, 'confirmed');
      res.json({
        status: 'confirmed',
        counts: structuredPlanCounts(planTypeResult.data, parseResult.data),
      });

      // Reanalyze with the confirmed structure (same mechanism as plan upload).
      if (isValidLanguage(language)) {
        runReanalysisForLanguage(language, companyId).catch(err => {
          console.error(`Reanalysis after structure confirm failed for ${language}:`, err.message);
        });
      }
    } catch (error: any) {
      serverError(res, error, "plan structure confirm");
    }
  });

  app.get("/api/plans/:planType/structure", requireJwtAuth, async (req, res) => {
    try {
      const companyId = getCompanyFilter(req);
      const planTypeResult = planTypeEnum.safeParse(req.params.planType);
      if (!planTypeResult.success) {
        return res.status(400).json({ error: `Invalid plan type: ${req.params.planType}` });
      }
      const language = (req.query.lang as string) || 'nl';

      const plan = await storage.getPlan(planTypeResult.data, language, companyId);
      if (!plan) return res.status(404).json({ error: "Plan not found" });

      res.json({
        status: plan.structuredStatus || 'none',
        structured: plan.structured || null,
        counts: plan.structured
          ? structuredPlanCounts(planTypeResult.data, plan.structured as any)
          : null,
        updatedAt: plan.structuredUpdatedAt,
      });
    } catch (error: any) {
      serverError(res, error, "plan structure get");
    }
  });

  app.delete("/api/plans/:planType", requireJwtAuth, requireManagerOrSuperAdmin, async (req, res) => {
    try {
      const companyId = getCompanyFilter(req);
      const { planType } = req.params;
      const language = (req.query.lang as string) || 'nl';
      
      const planTypeResult = planTypeEnum.safeParse(planType);
      if (!planTypeResult.success) {
        return res.status(400).json({ 
          error: `Invalid plan type: ${planType}. Must be 'strategic' or 'operational'` 
        });
      }
      
      const deleted = await storage.deletePlan(planTypeResult.data, language, companyId);
      if (!deleted) {
        return res.status(404).json({ error: "Plan not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      serverError(res, error);
    }
  });

  // Reanalysis status endpoint
  app.get("/api/reanalysis/status/:language", parseJwtIfPresent, async (req, res) => {
    // Accept the standalone dashboard's session login OR a Reppic JWT.
    if (!req.jwtUser && !req.session?.userId) {
      return res.status(401).json({ error: "Niet ingelogd" });
    }
    const { language } = req.params;
    const status = reanalysisStatusMap.get(language);
    if (!status) {
      return res.json({ state: 'idle', processed: 0, total: 0 });
    }
    res.json(status);
  });

  app.get("/api/analytics/summary", requireJwtAuth, async (req, res) => {
    try {
      const companyId = getCompanyFilter(req);
      const isDemoMode = req.query.demo === 'true';
      const lang = (req.query.lang as string) || 'nl';
      const year = req.query.year as string | undefined;
      const month = req.query.month as string | undefined;
      
      if (isDemoMode) {
        // Demo data represents a sample set of conversations.
        return res.json({ conversationCount: 12, ...getDemoAnalytics(lang) });
      }

      const allSnapshots = await storage.getAllSnapshots('strategic', lang, companyId);
      const snapshots = filterSnapshotsByDate(allSnapshots, year, month);
      
      if (snapshots.length === 0) {
        return res.json({
          conversationCount: 0,
          trends: { trendGroups: {}, comparison: '' },
          customerSatisfaction: { sentiments: [], issues: [], comparison: '' },
          competition: { competitors: [], strengths: [], comparison: '' },
          proposition: { execution: [], resonance: [], comparison: '' }
        });
      }

      // Number of analyzed conversations behind this view (sum of per-week
      // snapshot transcript counts within the selected date range).
      const conversationCount = snapshots.reduce(
        (sum, s) => sum + (parseInt(s.transcriptCount) || 0),
        0,
      );

      const aggregated: any = {
        conversationCount,
        trends: { trendGroups: {} as any, comparison: '' },
        customerSatisfaction: { sentiments: [] as any[], issues: [] as any[], comparison: '' },
        competition: { competitors: [] as any[], strengths: [] as any[], comparison: '' },
        proposition: { execution: [] as any[], resonance: [] as any[], comparison: '' }
      };
      
      snapshots.forEach(snapshot => {
        const data = JSON.parse(snapshot.data);
        aggregated.trends.trendGroups = mergeTrendGroups(aggregated.trends.trendGroups, data.trends?.trendGroups || {});
        aggregated.trends.comparison = data.trends?.comparison || aggregated.trends.comparison;
        
        aggregated.customerSatisfaction.sentiments = mergeAnalyticsData(aggregated.customerSatisfaction.sentiments, data.customerSatisfaction?.sentiments || []);
        aggregated.customerSatisfaction.issues = mergeAnalyticsData(aggregated.customerSatisfaction.issues, data.customerSatisfaction?.issues || []);
        aggregated.customerSatisfaction.comparison = data.customerSatisfaction?.comparison || aggregated.customerSatisfaction.comparison;
        
        aggregated.competition.competitors = mergeAnalyticsData(aggregated.competition.competitors, data.competition?.competitors || []);
        aggregated.competition.strengths = mergeAnalyticsData(aggregated.competition.strengths, data.competition?.strengths || []);
        aggregated.competition.comparison = data.competition?.comparison || aggregated.competition.comparison;
        
        aggregated.proposition.execution = mergeAnalyticsData(aggregated.proposition.execution, data.proposition?.execution || []);
        aggregated.proposition.resonance = mergeAnalyticsData(aggregated.proposition.resonance, data.proposition?.resonance || []);
        aggregated.proposition.comparison = data.proposition?.comparison || aggregated.proposition.comparison;
      });

      res.json(aggregated);
    } catch (error: any) {
      serverError(res, error);
    }
  });

  // Reset all operational OR strategic snapshots for the current company so
  // corrupted (pre-fix summed) data can be purged. After calling this, the
  // admin re-uploads transcripts and fresh averages are built from scratch.
  app.delete("/api/analytics/snapshots/:type", requireJwtAuth, async (req, res) => {
    try {
      const { type } = req.params;
      if (type !== 'operational' && type !== 'strategic') {
        return res.status(400).json({ error: "type must be 'operational' or 'strategic'" });
      }
      const companyId = getCompanyFilter(req);
      const deleted = await storage.deleteSnapshotsByType(type, companyId);
      res.json({ deleted, message: `${deleted} ${type} snapshot(s) verwijderd. Upload transcripten opnieuw om nieuwe gemiddelden op te bouwen.` });
    } catch (error: any) {
      serverError(res, error);
    }
  });

  app.get("/api/analytics/operational", requireJwtAuth, async (req, res) => {
    try {
      const companyId = getCompanyFilter(req);
      const isDemoMode = req.query.demo === 'true';
      const lang = (req.query.lang as string) || 'nl';
      const year = req.query.year as string | undefined;
      const month = req.query.month as string | undefined;

      // Optional per-salesperson view. A regular user may only see their own
      // data; managers/superadmins may pass any userId within their company.
      // No separate analysis: this aggregates the same per-transcript
      // operational analyses, scoped to one salesperson.
      const isManagerOrAdmin =
        req.jwtUser?.role === 'manager' || req.jwtUser?.role === 'superadmin' ||
        req.session?.userRole === 'manager' || req.session?.userRole === 'superadmin';
      let userId = (req.query.userId as string) || undefined;
      if (userId && !isManagerOrAdmin && userId !== req.jwtUser?.id) {
        userId = req.jwtUser?.id; // non-managers are restricted to themselves
      }

      if (isDemoMode) {
        return res.json(getOperationalDemoAnalytics(lang));
      }

      let snapshots: any[];
      if (userId) {
        // Build synthetic single-conversation snapshots from this salesperson's
        // own analyzed transcripts, so the existing aggregation logic produces
        // their individual PICA — the exact same analysis, one person.
        const allTranscripts = await storage.getAllTranscripts(companyId);
        const ownTranscripts = allTranscripts.filter(
          (t) => t.userId === userId && t.status === 'analyzed' && t.analysis,
        );
        snapshots = ownTranscripts.map((t) => {
          let operational: any = {};
          try { operational = JSON.parse(t.analysis as string).operational || {}; } catch { /* skip */ }
          // Normalize phase-score names so this person's conversations merge
          // cleanly, and mark each as one conversation for counting.
          if (operational?.picaPerformance?.phaseScores) {
            operational.picaPerformance.phaseScores = normalizePhaseScoreNames(
              operational.picaPerformance.phaseScores,
            );
          }
          operational.conversationActivity = {
            ...(operational.conversationActivity || {}),
            totalConversations: 1,
          };
          return { data: JSON.stringify(operational), transcriptCount: "1" };
        });
      } else {
        // Get cumulative data from snapshots, filtered by date
        const allSnapshots = await storage.getAllSnapshots('operational', lang, companyId);
        snapshots = filterSnapshotsByDate(allSnapshots, year, month);
      }

      if (snapshots.length === 0) {
        return res.json({
          conversationActivity: { totalConversations: 0, avgDuration: 0, activityByDay: [], comparison: '' },
          picaPerformance: { phaseScores: [], phaseDetails: [], comparison: '' },
          dealHealth: { leadWarmth: [], dealStages: [], avgDealScore: 0, comparison: '' },
          teamInsights: { absolute: [], percentages: [], uspOverview: [], comparison: '' },
          resistanceNeeds: { topResistances: [], commercialTriggers: [], comparison: '' },
          nextStepDiscipline: { withClearNextStep: 0, nextStepTypes: [], avgNextStepClarity: 0, comparison: '' },
          dmuInsights: { dmuMentioned: false, decisionProcessClear: false, stakeholders: [], dmuClarity: 0, comparison: '' },
          uspMentions: { usps: [], comparison: '' }
        });
      }
      
      // Aggregate data from all snapshots (cumulative across weeks)
      let aggregatedData = {
        conversationActivity: { totalConversations: 0, avgDuration: 0, activityByDay: [] as any[], comparison: '' },
        picaPerformance: { phaseScores: [] as any[], phaseDetails: [] as any[], comparison: '' },
        dealHealth: { leadWarmth: [] as any[], dealStages: [] as any[], avgDealScore: 0, comparison: '' },
        teamInsights: { absolute: [] as any[], percentages: [] as any[], uspOverview: [] as any[], comparison: '' },
        resistanceNeeds: { topResistances: [] as any[], commercialTriggers: [] as any[], comparison: '' },
        nextStepDiscipline: { withClearNextStep: 0, nextStepTypes: [] as any[], avgNextStepClarity: 0, comparison: '' },
        dmuInsights: { dmuMentioned: false, decisionProcessClear: false, stakeholders: [] as any[], dmuClarity: 0, comparison: '' },
        uspMentions: { usps: [] as any[], comparison: '' }
      };
      
      let totalSnapshotTranscripts = 0;
      
      snapshots.forEach(snapshot => {
        const data = JSON.parse(snapshot.data);
        const snapshotCount = parseInt(snapshot.transcriptCount) || 0;
        
        // Accumulate conversation activity
        aggregatedData.conversationActivity.totalConversations += data.conversationActivity?.totalConversations || 0;
        
        // Merge PICA performance (weighted accumulation — finalized after loop)
        aggregatedData.picaPerformance.phaseScores = accumulatePhaseScores(
          aggregatedData.picaPerformance.phaseScores,
          data.picaPerformance?.phaseScores || [],
          snapshotCount
        );
        aggregatedData.picaPerformance.phaseDetails = accumulatePhaseDetails(
          aggregatedData.picaPerformance.phaseDetails,
          data.picaPerformance?.phaseDetails || [],
          snapshotCount
        );
        aggregatedData.picaPerformance.comparison = data.picaPerformance?.comparison || aggregatedData.picaPerformance.comparison;
        
        // Merge deal health
        aggregatedData.dealHealth.leadWarmth = mergeAnalyticsData(
          aggregatedData.dealHealth.leadWarmth, 
          data.dealHealth?.leadWarmth || []
        );
        aggregatedData.dealHealth.dealStages = mergeAnalyticsData(
          aggregatedData.dealHealth.dealStages, 
          data.dealHealth?.dealStages || []
        );
        aggregatedData.dealHealth.comparison = data.dealHealth?.comparison || aggregatedData.dealHealth.comparison;
        
        // Merge resistance needs
        aggregatedData.resistanceNeeds.topResistances = mergeAnalyticsData(
          aggregatedData.resistanceNeeds.topResistances, 
          data.resistanceNeeds?.topResistances || []
        );
        aggregatedData.resistanceNeeds.commercialTriggers = mergeAnalyticsData(
          aggregatedData.resistanceNeeds.commercialTriggers, 
          data.resistanceNeeds?.commercialTriggers || []
        );
        aggregatedData.resistanceNeeds.comparison = data.resistanceNeeds?.comparison || aggregatedData.resistanceNeeds.comparison;
        
        // Merge next step discipline
        aggregatedData.nextStepDiscipline.nextStepTypes = mergeAnalyticsData(
          aggregatedData.nextStepDiscipline.nextStepTypes, 
          data.nextStepDiscipline?.nextStepTypes || []
        );
        aggregatedData.nextStepDiscipline.comparison = data.nextStepDiscipline?.comparison || aggregatedData.nextStepDiscipline.comparison;
        
        // Weighted average fields: accumulate weighted sums for later division
        const weight = snapshotCount || 1;
        aggregatedData.dealHealth.avgDealScore += (data.dealHealth?.avgDealScore || 0) * weight;
        aggregatedData.nextStepDiscipline.withClearNextStep += (data.nextStepDiscipline?.withClearNextStep || 0) * weight;
        aggregatedData.nextStepDiscipline.avgNextStepClarity += (data.nextStepDiscipline?.avgNextStepClarity || 0) * weight;
        
        // Merge DMU insights
        if (data.dmuInsights) {
          aggregatedData.dmuInsights.dmuMentioned = data.dmuInsights.dmuMentioned || aggregatedData.dmuInsights.dmuMentioned;
          aggregatedData.dmuInsights.decisionProcessClear = data.dmuInsights.decisionProcessClear || aggregatedData.dmuInsights.decisionProcessClear;
          aggregatedData.dmuInsights.stakeholders = mergeAnalyticsData(
            aggregatedData.dmuInsights.stakeholders,
            data.dmuInsights.stakeholders || []
          );
          aggregatedData.dmuInsights.dmuClarity += (data.dmuInsights.dmuClarity || 0) * weight;
          aggregatedData.dmuInsights.comparison = data.dmuInsights.comparison || aggregatedData.dmuInsights.comparison;
        }
        
        // Merge USP mentions
        aggregatedData.uspMentions.usps = mergeAnalyticsData(
          aggregatedData.uspMentions.usps, 
          data.uspMentions?.usps || []
        );
        aggregatedData.uspMentions.comparison = data.uspMentions?.comparison || aggregatedData.uspMentions.comparison;
        
        totalSnapshotTranscripts += weight;
      });
      
      // Finalize weighted averages for PICA scores/details accumulated during loop
      aggregatedData.picaPerformance.phaseScores = finalizePhaseScores(aggregatedData.picaPerformance.phaseScores);
      aggregatedData.picaPerformance.phaseDetails = finalizePhaseDetails(aggregatedData.picaPerformance.phaseDetails);

      // Calculate weighted averages across all snapshots
      if (totalSnapshotTranscripts > 0) {
        aggregatedData.dealHealth.avgDealScore = Math.round((aggregatedData.dealHealth.avgDealScore / totalSnapshotTranscripts) * 100) / 100;
        aggregatedData.nextStepDiscipline.withClearNextStep = Math.round((aggregatedData.nextStepDiscipline.withClearNextStep / totalSnapshotTranscripts) * 100) / 100;
        aggregatedData.nextStepDiscipline.avgNextStepClarity = Math.round((aggregatedData.nextStepDiscipline.avgNextStepClarity / totalSnapshotTranscripts) * 100) / 100;
        aggregatedData.dmuInsights.dmuClarity = Math.round((aggregatedData.dmuInsights.dmuClarity / totalSnapshotTranscripts) * 100) / 100;
      }
      
      // Always recalculate teamInsights from aggregated data for consistency
      const avgPicaScore = aggregatedData.picaPerformance.phaseScores.length > 0 
        ? Math.round(aggregatedData.picaPerformance.phaseScores.reduce((sum: number, p: any) => sum + (p.value || 0), 0) / aggregatedData.picaPerformance.phaseScores.length)
        : 0;
      const resistanceCount = aggregatedData.resistanceNeeds.topResistances.length;
      
      const teamInsightsLabels: Record<string, Record<string, string>> = {
        nl: { avgPica: 'Gem. Team PICA', totalConv: 'Totaal Gesprekken', clearNextSteps: 'Duidelijke Next Steps', resistances: 'Weerstanden Gedetecteerd', nextStepsPct: 'Next Steps %', picaAvgPct: 'PICA Gemiddelde %' },
        en: { avgPica: 'Avg Team PICA', totalConv: 'Total Conversations', clearNextSteps: 'Clear Next Steps', resistances: 'Resistances Detected', nextStepsPct: 'Next Steps %', picaAvgPct: 'PICA Average %' },
        de: { avgPica: 'Ø Team PICA', totalConv: 'Gesamtgespräche', clearNextSteps: 'Klare Next Steps', resistances: 'Erkannte Widerstände', nextStepsPct: 'Next Steps %', picaAvgPct: 'PICA Durchschnitt %' },
        fr: { avgPica: 'PICA moy. équipe', totalConv: 'Total entretiens', clearNextSteps: 'Prochaines étapes claires', resistances: 'Résistances détectées', nextStepsPct: 'Prochaines étapes %', picaAvgPct: 'PICA moyen %' },
        es: { avgPica: 'PICA prom. equipo', totalConv: 'Total conversaciones', clearNextSteps: 'Próximos pasos claros', resistances: 'Resistencias detectadas', nextStepsPct: 'Próximos pasos %', picaAvgPct: 'PICA promedio %' },
        it: { avgPica: 'PICA medio team', totalConv: 'Totale conversazioni', clearNextSteps: 'Passi successivi chiari', resistances: 'Resistenze rilevate', nextStepsPct: 'Passi successivi %', picaAvgPct: 'PICA medio %' },
      };
      const TL = teamInsightsLabels[lang] || teamInsightsLabels.nl;

      aggregatedData.teamInsights = {
        absolute: [
          { name: TL.avgPica, value: avgPicaScore },
          { name: TL.totalConv, value: aggregatedData.conversationActivity.totalConversations },
          { name: TL.clearNextSteps, value: Math.round(aggregatedData.nextStepDiscipline.withClearNextStep || 0) },
          { name: TL.resistances, value: resistanceCount }
        ],
        percentages: [
          { name: TL.nextStepsPct, value: Math.round(aggregatedData.nextStepDiscipline.withClearNextStep || 0) },
          { name: TL.picaAvgPct, value: avgPicaScore }
        ],
        uspOverview: aggregatedData.uspMentions.usps || [],
        comparison: `Gemiddelde PICA score: ${avgPicaScore}%. Vergelijk deze resultaten met de salesplan normen om verbeterkansen en coachingprioriteiten te identificeren.`
      };

      // Field-name transformation: align server aggregated fields with dashboard expectations
      const convActivityLabels: Record<string, Record<string, string>> = {
        nl: { totalConv: 'Totaal gesprekken', avgDuration: 'Gem. duur (min)', nextStepPct: 'Met next step %', clarityPct: 'Helderheid %' },
        en: { totalConv: 'Total conversations', avgDuration: 'Avg. duration (min)', nextStepPct: 'With next step %', clarityPct: 'Clarity %' },
        de: { totalConv: 'Gesamtgespräche', avgDuration: 'Ø Dauer (min)', nextStepPct: 'Mit Next Step %', clarityPct: 'Klarheit %' },
        fr: { totalConv: 'Total entretiens', avgDuration: 'Durée moy. (min)', nextStepPct: 'Avec prochaine étape %', clarityPct: 'Clarté %' },
        es: { totalConv: 'Total conversaciones', avgDuration: 'Duración prom. (min)', nextStepPct: 'Con siguiente paso %', clarityPct: 'Claridad %' },
        it: { totalConv: 'Totale conversazioni', avgDuration: 'Durata media (min)', nextStepPct: 'Con passo successivo %', clarityPct: 'Chiarezza %' },
      };
      const CL = convActivityLabels[lang] || convActivityLabels.nl;

      const totalConvVal = aggregatedData.conversationActivity.totalConversations || 0;
      const avgDurVal = aggregatedData.conversationActivity.avgDuration || 0;
      const convAbsolute: any[] = [
        { name: CL.totalConv, value: totalConvVal },
        ...(avgDurVal > 0 ? [{ name: CL.avgDuration, value: Math.round(avgDurVal) }] : []),
        ...(aggregatedData.conversationActivity.activityByDay || [])
      ];

      const nsdAbsolute: any[] = (aggregatedData.nextStepDiscipline.nextStepTypes || []).length > 0
        ? aggregatedData.nextStepDiscipline.nextStepTypes
        : [];
      const withNextStepVal = Math.round(aggregatedData.nextStepDiscipline.withClearNextStep || 0);
      const clarityVal = Math.round(aggregatedData.nextStepDiscipline.avgNextStepClarity || 0);
      const nsdPercentages: any[] = [
        ...(withNextStepVal > 0 ? [{ name: CL.nextStepPct, value: withNextStepVal }] : []),
        ...(clarityVal > 0 ? [{ name: CL.clarityPct, value: clarityVal }] : []),
      ];

      return res.json({
        ...aggregatedData,
        conversationActivity: {
          ...aggregatedData.conversationActivity,
          absolute: convAbsolute,
          percentages: [],
        },
        resistanceNeeds: {
          ...aggregatedData.resistanceNeeds,
          resistances: aggregatedData.resistanceNeeds.topResistances,
          triggers: aggregatedData.resistanceNeeds.commercialTriggers,
        },
        nextStepDiscipline: {
          ...aggregatedData.nextStepDiscipline,
          absolute: nsdAbsolute,
          percentages: nsdPercentages,
        },
      });
    } catch (error: any) {
      serverError(res, error);
    }
  });

  // AssemblyAI Webhook endpoint for automatic transcript import.
  // The webhook is UNauthenticated (no JWT) and trusts the caller-supplied
  // company_id, so it is gated by a mandatory shared secret. Fail closed: if
  // ASSEMBLYAI_WEBHOOK_SECRET is not configured we refuse every request rather
  // than silently accepting anonymous transcripts into arbitrary companies.
  app.post("/api/webhooks/assemblyai", async (req, res) => {
    try {
      const webhookSecret = process.env.ASSEMBLYAI_WEBHOOK_SECRET;
      if (!webhookSecret) {
        console.error(
          'AssemblyAI webhook rejected - ASSEMBLYAI_WEBHOOK_SECRET is not configured (refusing unauthenticated webhooks)',
        );
        return res.status(503).json({ error: 'Webhook not configured' });
      }
      const providedSecret = req.headers['x-webhook-secret'] || req.query.secret;
      if (!providedSecret || providedSecret !== webhookSecret) {
        console.log('AssemblyAI webhook rejected - invalid or missing secret');
        return res.status(401).json({ error: 'Unauthorized - invalid webhook secret' });
      }

      const { status, transcript_id, text, audio_url, company_id, lang: bodyLang } = req.body;
      // companyId and language can come from body (preferred) or query param (fallback)
      const webhookCompanyId = company_id || (req.query.companyId as string) || null;
      const explicitLang = bodyLang || (req.query.lang as string);
      let language: string;
      if (explicitLang) {
        language = explicitLang;
      } else if (webhookCompanyId) {
        const webhookCompany = await storage.getCompany(webhookCompanyId);
        language = webhookCompany?.defaultLanguage || 'nl';
      } else {
        language = 'nl';
      }
      
      console.log('AssemblyAI webhook received:', { status, transcript_id, language, webhookCompanyId });
      
      // Only process completed transcriptions
      if (status !== 'completed') {
        console.log('Ignoring webhook - status is not completed:', status);
        return res.json({ received: true, processed: false, reason: 'Not completed status' });
      }
      
      if (!text || text.trim().length === 0) {
        console.log('Ignoring webhook - no transcript text');
        return res.json({ received: true, processed: false, reason: 'No transcript text' });
      }
      
      if (!isValidLanguage(language)) {
        console.log('Invalid language, defaulting to nl');
      }
      
      const validLang = isValidLanguage(language) ? language : 'nl';
      
      // Create transcript from AssemblyAI webhook data
      const filename = `assemblyai_${transcript_id}_${new Date().toISOString().slice(0, 10)}.txt`;
      const transcriptData = {
        filename,
        content: text,
        language: validLang,
        companyId: webhookCompanyId,
      };
      
      const transcript = await storage.createTranscript(transcriptData);
      console.log('Created transcript from AssemblyAI:', transcript.id);
      
      // Trigger async analysis (same as regular upload)
      const strategicPlan = await storage.getPlan('strategic', validLang, webhookCompanyId);
      const operationalPlan = await storage.getPlan('operational', validLang, webhookCompanyId);
      const strategyDocs = await storage.getAllStrategyDocuments(webhookCompanyId);
      const strategyContents = strategyDocs.map(doc => doc.content);
      
      (async () => {
        try {
          // Mark as processing so the UI shows the spinner
          await storage.updateTranscript(transcript.id, { status: 'processing' });

          const weekNumber = getCurrentWeekNumber();

          await applyDashboardLLMRouteFromSettings();
          
          // Single source of truth: prefer the app-provided operational
          // coaching analysis (identical PICA to the personal dashboard +
          // coherent tiles) and SKIP the backend's own operational analysis;
          // fall back to re-analysing only when it's absent (legacy rows).
          const appCoaching = (transcript as { coachingAnalysis?: unknown })?.coachingAnalysis ?? null;
          if (!appCoaching) logOperationalFallback(transcript.id);
          const [strategicAnalysis, operationalAnalysisRaw] = await Promise.all([
            analyzeTranscript(
              transcript.content,
              strategicPlan ? [planPromptContent(strategicPlan)] : strategyContents,
              validLang
            ),
            appCoaching
              ? Promise.resolve(null)
              : analyzeTranscriptOperational(
                  transcript.content,
                  operationalPlan ? [planPromptContent(operationalPlan)] : [],
                  validLang
                )
          ]);
          const operationalAnalysis = (appCoaching ??
            operationalAnalysisRaw) as Awaited<ReturnType<typeof analyzeTranscriptOperational>>;
          
          const combinedAnalysis = {
            strategic: strategicAnalysis,
            operational: operationalAnalysis,
            source: 'assemblyai',
            assemblyai_transcript_id: transcript_id
          };
          
          await storage.updateTranscript(transcript.id, {
            status: 'analyzed',
            analysis: JSON.stringify(combinedAnalysis)
          });
          
          // Update strategic snapshot
          const strategicSnapshot = await storage.getOrCreateSnapshot(weekNumber, 'strategic', validLang, webhookCompanyId);
          const existingStrategicData = JSON.parse(strategicSnapshot.data);
          
          // Build quantitative merged data first (no per-transcript comparison text)
          const mergedStrategicData = {
            trends: {
              trendGroups: mergeTrendGroups(existingStrategicData.trends?.trendGroups, strategicAnalysis.trends?.trendGroups),
              comparison: ''
            },
            customerSatisfaction: {
              sentiments: mergeAnalyticsData(existingStrategicData.customerSatisfaction?.sentiments, strategicAnalysis.customerSatisfaction?.sentiments),
              issues: mergeAnalyticsData(existingStrategicData.customerSatisfaction?.issues, strategicAnalysis.customerSatisfaction?.issues),
              comparison: ''
            },
            competition: {
              competitors: mergeAnalyticsData(existingStrategicData.competition?.competitors, strategicAnalysis.competition?.competitors),
              strengths: mergeAnalyticsData(existingStrategicData.competition?.strengths, strategicAnalysis.competition?.strengths),
              comparison: ''
            },
            proposition: {
              execution: mergeAnalyticsData(existingStrategicData.proposition?.execution, strategicAnalysis.proposition?.execution),
              resonance: mergeAnalyticsData(existingStrategicData.proposition?.resonance, strategicAnalysis.proposition?.resonance),
              comparison: ''
            }
          };

          // Generate aggregate comparison from cumulative snapshot data (not per-transcript)
          const newStrategicCount2 = parseInt(strategicSnapshot.transcriptCount) + 1;
          const aggregateComparisons2 = await generateStrategicAggregateComparisons(
            mergedStrategicData,
            strategicPlan?.content || null,
            newStrategicCount2,
            validLang
          );

          const updatedStrategicData = {
            trends: { ...mergedStrategicData.trends, comparison: aggregateComparisons2.trendsComparison },
            customerSatisfaction: { ...mergedStrategicData.customerSatisfaction, comparison: aggregateComparisons2.satisfactionComparison },
            competition: { ...mergedStrategicData.competition, comparison: aggregateComparisons2.competitionComparison },
            proposition: { ...mergedStrategicData.proposition, comparison: aggregateComparisons2.propositionComparison }
          };
          
          await storage.updateSnapshot(
            strategicSnapshot.id, 
            JSON.stringify(updatedStrategicData), 
            newStrategicCount2
          );
          
          // Update operational snapshot
          const operationalSnapshot = await storage.getOrCreateSnapshot(weekNumber, 'operational', validLang, webhookCompanyId);
          const existingOperationalData = JSON.parse(operationalSnapshot.data);
          const prevOpCount = parseInt(operationalSnapshot.transcriptCount) || 0;
          
          const updatedOperationalData = {
            conversationActivity: {
              totalConversations: (existingOperationalData.conversationActivity?.totalConversations || 0) + 1,
              avgDuration: existingOperationalData.conversationActivity?.avgDuration || 0,
              activityByDay: mergeAnalyticsData(existingOperationalData.conversationActivity?.activityByDay, []),
              comparison: existingOperationalData.conversationActivity?.comparison || ''
            },
            picaPerformance: {
              phaseScores: mergePhaseScores(existingOperationalData.picaPerformance?.phaseScores, normalizePhaseScoreNames(operationalPicaFor(transcript, operationalAnalysis)?.phaseScores), prevOpCount),
              phaseDetails: mergePhaseDetails(existingOperationalData.picaPerformance?.phaseDetails, operationalPicaFor(transcript, operationalAnalysis)?.phaseDetails, prevOpCount),
              comparison: ''
            },
            dealHealth: {
              leadWarmth: mergeAnalyticsData(existingOperationalData.dealHealth?.leadWarmth, operationalAnalysis.dealHealth?.leadWarmth),
              dealStages: mergeAnalyticsData(existingOperationalData.dealHealth?.dealStages, operationalAnalysis.dealHealth?.dealStages),
              avgDealScore: runningAverage(existingOperationalData.dealHealth?.avgDealScore || 0, operationalAnalysis.dealHealth?.avgDealScore || 0, prevOpCount),
              comparison: ''
            },
            resistanceNeeds: {
              topResistances: mergeAnalyticsData(existingOperationalData.resistanceNeeds?.topResistances, operationalAnalysis.resistanceNeeds?.topResistances),
              commercialTriggers: mergeAnalyticsData(existingOperationalData.resistanceNeeds?.commercialTriggers, operationalAnalysis.resistanceNeeds?.commercialTriggers),
              comparison: ''
            },
            nextStepDiscipline: {
              withClearNextStep: runningAverage(existingOperationalData.nextStepDiscipline?.withClearNextStep || 0, operationalAnalysis.nextStepDiscipline?.withClearNextStep || 0, prevOpCount),
              nextStepTypes: mergeAnalyticsData(existingOperationalData.nextStepDiscipline?.nextStepTypes, operationalAnalysis.nextStepDiscipline?.nextStepTypes),
              avgNextStepClarity: runningAverage(existingOperationalData.nextStepDiscipline?.avgNextStepClarity || 0, operationalAnalysis.nextStepDiscipline?.avgNextStepClarity || 0, prevOpCount),
              comparison: ''
            },
            dmuInsights: {
              dmuMentioned: operationalAnalysis.dmuInsights?.dmuMentioned || existingOperationalData.dmuInsights?.dmuMentioned || false,
              decisionProcessClear: operationalAnalysis.dmuInsights?.decisionProcessClear || existingOperationalData.dmuInsights?.decisionProcessClear || false,
              stakeholders: mergeAnalyticsData(existingOperationalData.dmuInsights?.stakeholders, operationalAnalysis.dmuInsights?.stakeholders),
              dmuClarity: runningAverage(existingOperationalData.dmuInsights?.dmuClarity || 0, operationalAnalysis.dmuInsights?.dmuClarity || 0, prevOpCount),
              comparison: ''
            },
            uspMentions: {
              usps: mergeAnalyticsData(existingOperationalData.uspMentions?.usps, operationalAnalysis.uspMentions?.usps),
              comparison: ''
            },
            teamInsights: {} as any
          };

          // Generate aggregate operational comparison from cumulative data (not per-transcript)
          const newOpCount2 = parseInt(operationalSnapshot.transcriptCount) + 1;
          const opAggComparisons2 = await generateOperationalAggregateComparisons(
            updatedOperationalData,
            operationalPlan?.content || null,
            newOpCount2,
            validLang
          );

          updatedOperationalData.picaPerformance.comparison = opAggComparisons2.picaComparison;
          updatedOperationalData.dealHealth.comparison = opAggComparisons2.dealHealthComparison;
          updatedOperationalData.resistanceNeeds.comparison = opAggComparisons2.resistanceComparison;
          updatedOperationalData.nextStepDiscipline.comparison = opAggComparisons2.nextStepComparison;
          updatedOperationalData.dmuInsights.comparison = opAggComparisons2.dmuComparison;
          updatedOperationalData.uspMentions.comparison = opAggComparisons2.uspComparison;

          // Calculate Team Insights as aggregation
          const totalConv = updatedOperationalData.conversationActivity.totalConversations || 1;
          const picaPh = updatedOperationalData.picaPerformance.phaseScores || [];
          const avgPica = picaPh.length > 0 
            ? Math.round(picaPh.reduce((sum: number, p: any) => sum + (p.value || 0), 0) / picaPh.length)
            : 0;
          const resCount = (updatedOperationalData.resistanceNeeds.topResistances || []).length;
          
          updatedOperationalData.teamInsights = {
            absolute: [
              { name: "Gem. Team PICA", value: avgPica },
              { name: "Totaal Gesprekken", value: totalConv },
              { name: "Duidelijke Next Steps", value: Math.round(updatedOperationalData.nextStepDiscipline.withClearNextStep || 0) },
              { name: "Weerstanden Gedetecteerd", value: resCount }
            ],
            percentages: [
              { name: "Next Steps %", value: Math.round(updatedOperationalData.nextStepDiscipline.withClearNextStep || 0) },
              { name: "PICA Gemiddelde %", value: avgPica }
            ],
            uspOverview: updatedOperationalData.uspMentions.usps || [],
            comparison: opAggComparisons2.picaComparison || `Gemiddelde PICA score: ${avgPica}%.`
          };
          
          await storage.updateSnapshot(
            operationalSnapshot.id, 
            JSON.stringify(updatedOperationalData), 
            newOpCount2
          );
          
          console.log('AssemblyAI transcript analysis completed:', transcript.id);
        } catch (error: any) {
          console.error('AssemblyAI transcript analysis failed:', transcript.id, error.message);
          await storage.updateTranscript(transcript.id, { status: 'error' });
        }
      })();
      
      res.json({ 
        received: true, 
        processed: true, 
        transcript_id: transcript.id,
        assemblyai_transcript_id: transcript_id
      });
    } catch (error: any) {
      console.error('AssemblyAI webhook error:', error.message);
      serverError(res, error);
    }
  });

  // Register object storage routes for file uploads
  registerObjectStorageRoutes(app);

  // Brandkit logo endpoints
  const objectStorageService = new ObjectStorageService();

  // Get current logo URL. The logo is public branding (stored with public ACL),
  // so reading the URL needs no auth — only mutations are restricted below.
  app.get("/api/brandkit/logo", async (req, res) => {
    try {
      const logoUrl = await storage.getBrandkitLogo();
      res.json({ logoUrl });
    } catch (error: any) {
      return serverError(res, error, "get brandkit logo");
    }
  });

  // Save logo URL after upload — managers/superadmins only (global branding).
  // Accepts the standalone dashboard's session login OR a Reppic JWT.
  app.post("/api/brandkit/logo", parseJwtIfPresent, async (req, res) => {
    try {
      if (!req.jwtUser && !req.session?.userId) {
        return res.status(401).json({ error: "Niet ingelogd" });
      }
      const role = req.jwtUser?.role || req.session?.userRole;
      if (role !== 'manager' && role !== 'superadmin') {
        return res.status(403).json({ error: 'Onvoldoende rechten' });
      }
      const { objectPath } = req.body;
      if (!objectPath || typeof objectPath !== 'string') {
        return res.status(400).json({ error: 'objectPath is required' });
      }
      // Only accept paths inside our own object namespace, so an attacker cannot
      // flip the ACL of an arbitrary object to public.
      if (!objectPath.startsWith('/objects/')) {
        return res.status(400).json({ error: 'Ongeldig objectPath' });
      }

      // Normalize the path and set ACL to public
      const normalizedPath = await objectStorageService.trySetObjectEntityAclPolicy(
        objectPath,
        { owner: 'system', visibility: 'public' }
      );

      await storage.setBrandkitLogo(normalizedPath);
      res.json({ success: true, logoUrl: normalizedPath });
    } catch (error: any) {
      return serverError(res, error, "save brandkit logo");
    }
  });

  // Delete logo — managers/superadmins only (session login OR Reppic JWT).
  app.delete("/api/brandkit/logo", parseJwtIfPresent, async (req, res) => {
    try {
      if (!req.jwtUser && !req.session?.userId) {
        return res.status(401).json({ error: "Niet ingelogd" });
      }
      const role = req.jwtUser?.role || req.session?.userRole;
      if (role !== 'manager' && role !== 'superadmin') {
        return res.status(403).json({ error: 'Onvoldoende rechten' });
      }
      await storage.setBrandkitLogo(null);
      res.json({ success: true });
    } catch (error: any) {
      return serverError(res, error, "delete brandkit logo");
    }
  });

  // AI Tile Chat
  app.post("/api/ai/tile-chat", parseJwtIfPresent, async (req, res) => {
    const isDemoMode = req.body.demo === true && process.env.ALLOW_DEMO === "true";
    if (!req.session?.userId && !req.jwtUser && !isDemoMode) {
      return res.status(401).json({ error: "Niet ingelogd" });
    }
    try {
      const { topic, items, language, question, messages, previousConclusion } = req.body;
      if (!topic || !question || !Array.isArray(items)) {
        return res.status(400).json({ error: "topic, items and question are required" });
      }
      await applyDashboardLLMRouteFromSettings();
      const response = await generateTileChatResponse({
        topic, items, language: language || 'nl',
        question, messages: messages || [], previousConclusion
      });
      res.json(response);
    } catch (error: any) {
      console.error('Tile chat error:', error.message);
      serverError(res, error);
    }
  });

  app.post("/api/ai/suggested-questions", parseJwtIfPresent, async (req, res) => {
    const isDemoMode = req.body.demo === true && process.env.ALLOW_DEMO === "true";
    if (!req.session?.userId && !req.jwtUser && !isDemoMode) {
      return res.status(401).json({ error: "Niet ingelogd" });
    }
    try {
      const { topic, conclusion, language, dashboardType } = req.body;
      if (!conclusion) {
        return res.status(400).json({ questions: [] });
      }
      await applyDashboardLLMRouteFromSettings();
      const questions = await generateSuggestedQuestions({
        topic: topic || '',
        conclusion,
        language: language || 'nl',
        dashboardType: dashboardType || 'strategic',
      });
      res.json({ questions });
    } catch (error: any) {
      console.error('Suggested questions error:', error.message);
      res.status(500).json({ questions: [] });
    }
  });

  app.post("/api/ai/conclusion-chat", parseJwtIfPresent, async (req, res) => {
    const isDemoMode = req.body.demo === true && process.env.ALLOW_DEMO === "true";
    if (!req.session?.userId && !req.jwtUser && !isDemoMode) {
      return res.status(401).json({ error: "Niet ingelogd" });
    }
    try {
      const { topic, conclusion, language, question, messages } = req.body;
      if (!topic || !question) {
        return res.status(400).json({ error: "topic and question are required" });
      }
      await applyDashboardLLMRouteFromSettings();
      const response = await generateConclusionChatResponse({
        topic, conclusion: conclusion || '', language: language || 'nl',
        question, messages: messages || [],
      });
      res.json(response);
    } catch (error: any) {
      console.error('Conclusion chat error:', error.message);
      serverError(res, error);
    }
  });

  // AI Tile Conclusion Generator
  app.post("/api/ai/tile-conclusion", parseJwtIfPresent, async (req, res) => {
    const isDemoMode = req.body.demo === true && process.env.ALLOW_DEMO === "true";
    if (!req.session?.userId && !req.jwtUser && !isDemoMode) {
      return res.status(401).json({ error: "Niet ingelogd" });
    }
    try {
      const { topic, items, language } = req.body;
      if (!topic || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "topic and items are required" });
      }
      await applyDashboardLLMRouteFromSettings();
      const conclusion = await generateTileConclusion({ topic, items, language: language || 'nl' });
      res.json({ conclusion });
    } catch (error: any) {
      console.error('Tile conclusion error:', error.message);
      serverError(res, error);
    }
  });

  app.post("/api/ai/management-conclusion", parseJwtIfPresent, async (req, res) => {
    const isDemoMode = req.body.demo === true && process.env.ALLOW_DEMO === "true";
    if (!req.session?.userId && !req.jwtUser && !isDemoMode) {
      return res.status(401).json({ error: "Niet ingelogd" });
    }
    try {
      const { theme, type, items, language } = req.body;
      if (!theme || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "theme and items are required" });
      }
      const validTypes = ['weerstanden', 'triggers', 'general'];
      const conclusionType = validTypes.includes(type) ? type : 'general';
      await applyDashboardLLMRouteFromSettings();
      const conclusion = await generateManagementConclusion({
        theme, type: conclusionType, items, language: language || 'nl',
      });
      res.json(conclusion);
    } catch (error: any) {
      console.error('Management conclusion error:', error.message);
      serverError(res, error);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

function aggregateData(dataArrays: any[][]): any[] {
  const aggregated = new Map<string, any>();
  
  dataArrays.forEach(items => {
    items.forEach(item => {
      if (aggregated.has(item.name)) {
        const existing = aggregated.get(item.name);
        existing.value += item.value;
      } else {
        aggregated.set(item.name, { ...item });
      }
    });
  });

  return Array.from(aggregated.values())
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
}


function getDemoAnalytics(lang: string = 'nl') {
  if (lang === 'en') {
    return {
      trends: {
        trendGroups: {
          relational: [
            { name: "Delivery Reliability", value: 54, type: "known", description: "Customers expect consistent on-time, in-full delivery of industrial components", trend: 'stable', trendPct: 0, priority: 'medium' },
            { name: "Dedicated Account Manager", value: 43, type: "known", description: "Customers want a fixed technical contact who understands their production needs", trend: 'up', trendPct: 5, priority: 'low' },
            { name: "Technical Engineering Support", value: 38, type: "known", description: "Design-in support and component selection assistance increasingly expected", trend: 'up', trendPct: 8, priority: 'high' }
          ],
          functional: [
            { name: "VMI / Consignment Programs", value: 47, type: "new", description: "Manufacturers want vendor-managed inventory to reduce stockout risk on production lines", trend: 'up', trendPct: 16, priority: 'high' },
            { name: "Broad Product Range", value: 42, type: "known", description: "Consolidating component supply to fewer suppliers — one-stop-shop requirement", trend: 'up', trendPct: 9, priority: 'high' },
            { name: "Custom Component Design", value: 34, type: "new", description: "Non-standard clips, caps and grommets for application-specific solutions", trend: 'up', trendPct: 7, priority: 'medium' },
            { name: "Online Catalog & 3D CAD Data", value: 28, type: "known", description: "Engineers want instant access to drawings, specs and 3D models for design work", trend: 'up', trendPct: 5, priority: 'medium' },
            { name: "EDI / ERP Connectivity", value: 19, type: "new", description: "Automated purchase order and invoice exchange with customer ERP systems", trend: 'stable', trendPct: 0, priority: 'low' }
          ],
          financial: [
            { name: "Total Cost of Ownership", value: 41, type: "known", description: "Customers compare not just unit price but total supply chain cost including risk", trend: 'up', trendPct: 8, priority: 'high' },
            { name: "Supplier Consolidation Savings", value: 35, type: "new", description: "Fewer suppliers means lower administrative and logistical overhead", trend: 'up', trendPct: 11, priority: 'high' },
            { name: "Flexible Pricing Structures", value: 22, type: "known", description: "Volume rebates, blanket order pricing and annual contract models", trend: 'stable', trendPct: 0, priority: 'low' }
          ],
          organizational: [
            { name: "Procurement Standardization", value: 37, type: "known", description: "Purchasing departments seeking to standardize component specifications across plants", trend: 'stable', trendPct: 0, priority: 'medium' },
            { name: "IATF / ISO Certification Requirements", value: 31, type: "new", description: "Automotive supply chain certification obligations imposed on component suppliers", trend: 'up', trendPct: 9, priority: 'high' },
            { name: "Internal Approval Processes", value: 24, type: "known", description: "Engineering, procurement and quality departments all involved in supplier decisions", trend: 'stable', trendPct: 0, priority: 'medium' }
          ],
          strategic: [
            { name: "Supply Chain Risk Management", value: 44, type: "new", description: "Reducing dependence on Asian component sourcing and single-source risk", trend: 'up', trendPct: 12, priority: 'high' },
            { name: "European vs. Asian Sourcing", value: 33, type: "new", description: "Reshoring trend: manufacturers increasingly prefer European-certified suppliers", trend: 'up', trendPct: 8, priority: 'high' },
            { name: "Sustainable Procurement", value: 21, type: "new", description: "Environmental and carbon footprint requirements for supply chain partners", trend: 'up', trendPct: 6, priority: 'medium' }
          ],
          urgency: [
            { name: "Production Line Stoppage Risk", value: 41, type: "known", description: "Component stockout that halts a production line creates extreme urgency to switch", trend: 'up', trendPct: 7, priority: 'high' },
            { name: "New Product Line Launch", value: 32, type: "new", description: "Upcoming series starts requiring new component approvals and certifications", trend: 'up', trendPct: 9, priority: 'high' },
            { name: "Annual Procurement Review", value: 26, type: "known", description: "Yearly supplier evaluation cycles — key window for new supplier introduction", trend: 'stable', trendPct: 0, priority: 'medium' }
          ]
        },
        comparison: "**Relational:** Delivery reliability is table stakes — customers expect it and penalize when it fails. Engineering support is growing as a relationship differentiator (+8%).\n\n**Functional:** VMI programs are the fastest-growing demand (+16%) — manufacturers want certainty on production-critical components. Supplier consolidation pressure growing (+9%).\n\n**Financial:** TCO thinking is rising (+8%) and supplier consolidation savings (+11%) — customers are increasingly calculating total supply cost, not just unit price.\n\n**Organizational:** IATF/ISO certification requirements growing strongly (+9%) — automotive customers are imposing supplier certification obligations.\n\n**Strategic:** Supply chain risk management exploding (+12%) — reshoring and European sourcing preference becoming strategic policy at large manufacturers.\n\n**Urgency:** Production line stoppage risk (+7%) and new model launches (+9%) are the most powerful buying triggers — address these first in every conversation."
      },
      customerSatisfaction: {
        sentiments: [
          { name: "Delivery Reliability", value: 58, type: "positive", trend: 'stable', trendPct: 0, priority: 'low' },
          { name: "Technical Sales Expertise", value: 49, type: "positive", trend: 'up', trendPct: 8, priority: 'low' },
          { name: "Broad Product Range", value: 44, type: "positive", trend: 'stable', trendPct: 0, priority: 'low' },
          { name: "Quality Certifications", value: 37, type: "positive", trend: 'up', trendPct: 5, priority: 'low' },
          { name: "Fast Standard Delivery", value: 31, type: "positive", trend: 'stable', trendPct: 0, priority: 'low' },
          { name: "Proactive Account Management", value: 26, type: "positive", trend: 'up', trendPct: 4, priority: 'low' },
          { name: "Good Availability for Urgent Orders", value: 21, type: "positive", trend: 'stable', trendPct: 0, priority: 'low' }
        ],
        issues: [
          { name: "Price vs. Asian Alternatives", value: 41, severity: "high", trend: 'up', trendPct: 14, priority: 'high' },
          { name: "MOQ Too High", value: 28, severity: "high", trend: 'up', trendPct: 6, priority: 'high' },
          { name: "Custom Component Lead Time", value: 22, severity: "medium", trend: 'stable', trendPct: 0, priority: 'medium' },
          { name: "Online Ordering Portal Limited", value: 17, severity: "medium", trend: 'up', trendPct: 5, priority: 'medium' },
          { name: "Limited Stock on Specific Items", value: 12, severity: "low", trend: 'down', trendPct: 3, priority: 'low' },
          { name: "Response Time on Quotes", value: 9, severity: "low", trend: 'stable', trendPct: 0, priority: 'low' }
        ],
        sentimentAlerts: ["Technical expertise appreciation up 8% — engineering sales capability increasingly valued by customers", "Quality certifications satisfaction up 5% — IATF positioning resonating in automotive accounts"],
        issueAlerts: ["Price vs. Asian alternatives up 14% — TCO argumentation urgently needed", "MOQ complaints up 6% — volume threshold creating conversion friction"],
        sentimentSummary: "Delivery reliability and technical expertise are the top satisfaction drivers — core strengths confirmed.",
        issueSummary: "Asian price comparison and MOQ are the two fastest-growing barriers to conversion.",
        comparison: "**What we see:** Delivery reliability (58%) remains the top positive driver — stable and consistently mentioned. Technical expertise (+8%) is rising fast — customers increasingly value expert guidance on component selection. Quality certifications growing (+5%). On the negative side, price vs. Asian alternatives is the fastest-rising issue (+14% to 33%) — customers are increasingly referencing online Asian sources as price benchmarks. MOQ complaints growing (+6%).\n\n**Probable cause:** The growth in Asian price comparisons correlates with increasing online procurement behavior: junior buyers benchmark unit prices on e-commerce platforms without accounting for quality risk, certification requirements, or total supply cost. Technical expertise appreciation is rising because component applications are becoming more complex.\n\n**Operational impact:** Price objections are growing but are structurally addressable with TCO argumentation: when salespeople compare full supply chain cost — including quality incidents, audit risks, delivery failures, and certification obligations — the Asian price advantage disappears. MOQ friction is a commercial loss point at the early stages of account development.\n\n**Strategic impact:** The divergence between rising technical expertise appreciation and rising price objections signals a strategic positioning gap: customers value the expertise but don't yet connect it to the price premium. Closing this gap is the core task of the sales force.\n\n**Recommended management action:** Implement a TCO conversation framework as a mandatory sales tool for all price objections. Create an Asian sourcing risk checklist. Review MOQ policy for new account development. Target: price objection frequency down 20% in Q2 through TCO positioning."
      },
      competition: {
        competitors: [
          { name: "Range Breadth & Price", competitor: "Würth", value: 38, mentions: 14, trend: 'up', trendPct: 9, priority: 'high' },
          { name: "Technical Fastening Systems", competitor: "Böllhoff", value: 29, mentions: 11, trend: 'up', trendPct: 7, priority: 'high' },
          { name: "Unit Price", competitor: "Asian Webshops", value: 33, mentions: 12, trend: 'up', trendPct: 15, priority: 'high' },
          { name: "European Range", competitor: "TR Fastenings", value: 18, mentions: 6, trend: 'stable', trendPct: 0, priority: 'low' }
        ],
        strengths: [
          { name: "Technical Engineering Support", value: 44, trend: 'down', trendPct: 5, priority: 'medium' },
          { name: "IATF Certification Guidance", value: 38, trend: 'up', trendPct: 8, priority: 'low' },
          { name: "VMI / Consignment Programs", value: 31, trend: 'down', trendPct: 7, priority: 'high' },
          { name: "Industrial Component Range Depth", value: 27, trend: 'stable', trendPct: 0, priority: 'low' },
          { name: "Local Benelux Stock", value: 22, trend: 'stable', trendPct: 0, priority: 'low' }
        ],
        competitorAlerts: ["Asian webshop references up 15% — price benchmark problem growing", "Würth activity up 9% — broad range competitor increasing visit frequency"],
        strengthAlerts: ["VMI programs down 7% in sales conversations — core differentiator underused", "Engineering support down 5% — complex needs are present but capability not being communicated"],
        competitorSummary: "Asian price reference and Würth breadth are the two growing threats — VMI and engineering are the answers.",
        strengthSummary: "IATF certification guidance growing but VMI and engineering support declining in salesperson communication.",
        comparison: "**What we see:** Asian webshop references as a price benchmark grew 15% — now mentioned in 27% of competitive conversations. Würth up 9% on range and sales coverage. Böllhoff growing (+7%) on technical fastening. Own strengths: IATF certification guidance growing +8%, but VMI programs declining −7% and engineering support declining −5% in salesperson communication.\n\n**Probable cause:** Würth and Asian alternatives benefit from low-friction customer contact. The decline in VMI and engineering support mentions correlates with insufficient customer needs discovery: salespeople who don't probe deeply enough don't reach the level where VMI and engineering support become relevant differentiators.\n\n**Operational impact:** The competitive position against Würth requires range depth and service differentiation — engineering support and VMI programs are precisely the arguments that Würth cannot match. Against Asian price references, TCO and quality certification arguments are the answer. Both are currently underused.\n\n**Strategic impact:** The Asian price reference problem is structural and will worsen as e-procurement adoption grows. Building a clear narrative around European supply chain risk, IATF conformity, and total cost of ownership is the only sustainable competitive defense.\n\n**Recommended management action:** Create a competitive response playbook for Würth, Böllhoff, and Asian alternatives. Make IATF certification guidance a standard topic in all automotive accounts. Monitor competitive mentions per account quarterly."
      },
      proposition: {
        execution: [
          { name: "Delivery reliability & availability", value: 73, trend: 'stable', trendPct: 0, description: "Salespeople communicate delivery performance and stock availability consistently — this element is well embedded across the team." },
          { name: "Technical engineering support", value: 54, trend: 'down', trendPct: 8, description: "Design-in support and application expertise are mentioned in barely half of conversations despite being a core differentiator in the strategy." },
          { name: "IATF / quality certifications", value: 46, trend: 'up', trendPct: 7, description: "Certification credentials are being mentioned more often — automotive accounts are responding positively to this message." },
          { name: "VMI / consignment programs", value: 38, trend: 'down', trendPct: 9, description: "VMI programs are declining in salesperson communication despite growing strongly in customer demand — a significant proposition gap." },
          { name: "TCO / supplier consolidation", value: 29, trend: 'down', trendPct: 6, description: "Total cost of ownership and consolidation arguments are rarely deployed despite being the most effective response to price objections." }
        ],
        resonance: [
          { name: "Delivery reliability & availability", value: 76, trend: 'stable', trendPct: 0, description: "When raised, delivery reliability always resonates — customers confirm it as their primary selection criterion." },
          { name: "IATF / quality certifications", value: 68, trend: 'up', trendPct: 11, description: "Certification arguments land exceptionally well with automotive and machine building customers — strong resonance and decision influence." },
          { name: "Technical engineering support", value: 64, trend: 'up', trendPct: 9, description: "Engineering support resonates strongly when communicated — customers respond with technical questions and deeper engagement." },
          { name: "VMI / consignment programs", value: 58, trend: 'up', trendPct: 14, description: "VMI resonates very strongly when introduced — customers show immediate interest and ask for implementation details." },
          { name: "TCO / supplier consolidation", value: 51, trend: 'up', trendPct: 7, description: "TCO arguments effectively neutralize price objections when used — the problem is they are used too rarely." }
        ],
        executionAlerts: ["VMI programs down 9% in execution — fastest-growing customer need, least-communicated proposition element", "Engineering support down 8% — core differentiator losing voice in conversations"],
        resonanceAlerts: ["VMI resonance up 14% — highest resonance growth, confirming significant untapped opportunity", "IATF certification resonance up 11% — strongest-landing argument in automotive accounts"],
        executionSummary: "Delivery reliability well communicated. VMI, engineering, and TCO are systematic gaps — all high resonance when used.",
        resonanceSummary: "VMI and IATF certification are the highest-resonance elements — but neither is being communicated enough.",
        comparison: "**What we see — Proposition execution:** \n\nDelivery reliability is consistently communicated and always lands well — this is the foundation. But the higher-value proposition elements are disappearing from conversations. VMI programs are mentioned in less than 40% of conversations despite growing customer demand (+16%). Engineering support is declining (−8%) even though customers increasingly value technical guidance. TCO argumentation is present in less than 30% of conversations.\n\n**What we see — Customer resonance:** \n\nWhen proposition elements are communicated, they consistently resonate well above average. IATF certification (+11% resonance) and VMI (+14% resonance) are the two fastest-growing resonance elements. The pattern is clear: the problem is not that the proposition doesn't work — it is that it isn't being deployed.\n\n**What we see — Proposition gaps:** \n\nThe biggest gap is between VMI resonance (58%, growing fast) and VMI execution (38%, declining). This is a systematic disconnect between what customers respond to and what salespeople talk about.\n\n**Recommended management action:** Implement a proposition checklist for every conversation: delivery reliability, engineering support, IATF certification, VMI programs, and TCO must all be planned elements. Create a VMI introduction script for immediate deployment. Target: VMI execution rate above 60% within six weeks."
      }
    };
  }

  if (lang === 'de') {
    return {
      trends: {
        trendGroups: {
          relational: [
            { name: "Lieferzuverlässigkeit", value: 54, type: "known", description: "Kunden erwarten konsistente Lieferung von Industriekomponenten", trend: 'stable', trendPct: 0, priority: 'medium' },
            { name: "Fester Ansprechpartner", value: 43, type: "known", description: "Kunden möchten einen festen technischen Kontakt, der ihre Produktionsbedürfnisse kennt", trend: 'up', trendPct: 5, priority: 'low' },
            { name: "Technischer Engineering-Support", value: 38, type: "known", description: "Design-in-Unterstützung und Komponentenauswahl werden zunehmend erwartet", trend: 'up', trendPct: 8, priority: 'high' }
          ],
          functional: [
            { name: "VMI / Konsignationsprogramme", value: 47, type: "new", description: "Hersteller möchten lieferantengesteuerte Bestände zur Vermeidung von Produktionsausfällen", trend: 'up', trendPct: 16, priority: 'high' },
            { name: "Breites Produktsortiment", value: 42, type: "known", description: "Konsolidierung der Komponentenversorgung bei weniger Lieferanten", trend: 'up', trendPct: 9, priority: 'high' },
            { name: "Maßgefertigte Komponenten", value: 34, type: "new", description: "Nicht standardisierte Clips, Kappen und Tüllen für anwendungsspezifische Lösungen", trend: 'up', trendPct: 7, priority: 'medium' },
            { name: "Online-Katalog & 3D-CAD-Daten", value: 28, type: "known", description: "Ingenieure benötigen sofortigen Zugriff auf Zeichnungen und 3D-Modelle", trend: 'up', trendPct: 5, priority: 'medium' },
            { name: "EDI / ERP-Anbindung", value: 19, type: "new", description: "Automatisierter Bestellungs- und Rechnungsaustausch mit ERP-Systemen", trend: 'stable', trendPct: 0, priority: 'low' }
          ],
          financial: [
            { name: "Gesamtbetriebskosten (TCO)", value: 41, type: "known", description: "Kunden vergleichen nicht nur den Stückpreis, sondern die gesamten Lieferkettenkosten", trend: 'up', trendPct: 8, priority: 'high' },
            { name: "Lieferantenkonsolidierungs-Einsparungen", value: 35, type: "new", description: "Weniger Lieferanten bedeutet geringeren Verwaltungs- und Logistikaufwand", trend: 'up', trendPct: 11, priority: 'high' },
            { name: "Flexible Preisstrukturen", value: 22, type: "known", description: "Mengenrabatte, Rahmenbestellungspreise und Jahresvertragsmodelle", trend: 'stable', trendPct: 0, priority: 'low' }
          ],
          organizational: [
            { name: "Einkaufsstandardisierung", value: 37, type: "known", description: "Einkaufsabteilungen suchen Standardisierung der Komponentenspezifikationen über Werke hinweg", trend: 'stable', trendPct: 0, priority: 'medium' },
            { name: "IATF / ISO-Zertifizierungsanforderungen", value: 31, type: "new", description: "Automobillieferketten-Zertifizierungspflichten werden auf Komponentenlieferanten übertragen", trend: 'up', trendPct: 9, priority: 'high' },
            { name: "Interne Genehmigungsprozesse", value: 24, type: "known", description: "Technik, Einkauf und Qualität sind alle an Lieferantenentscheidungen beteiligt", trend: 'stable', trendPct: 0, priority: 'medium' }
          ],
          strategic: [
            { name: "Lieferketten-Risikomanagement", value: 44, type: "new", description: "Reduzierung der Abhängigkeit von asiatischer Komponentenbeschaffung", trend: 'up', trendPct: 12, priority: 'high' },
            { name: "Europäische vs. asiatische Beschaffung", value: 33, type: "new", description: "Reshoring-Trend: Hersteller bevorzugen zunehmend europäisch zertifizierte Lieferanten", trend: 'up', trendPct: 8, priority: 'high' },
            { name: "Nachhaltige Beschaffung", value: 21, type: "new", description: "Umwelt- und CO2-Anforderungen an Lieferkettenpartner", trend: 'up', trendPct: 6, priority: 'medium' }
          ],
          urgency: [
            { name: "Produktionsstillstand-Risiko", value: 41, type: "known", description: "Komponentenmangel, der eine Produktionslinie stoppt, schafft extreme Dringlichkeit", trend: 'up', trendPct: 7, priority: 'high' },
            { name: "Neue Produktlinie Serienstart", value: 32, type: "new", description: "Bevorstehende Serienstartsaufnahmen erfordern neue Komponentenfreigaben und Zertifizierungen", trend: 'up', trendPct: 9, priority: 'high' },
            { name: "Jährliche Lieferantenbewertung", value: 26, type: "known", description: "Jährliche Bewertungszyklen — wichtiges Zeitfenster für neue Lieferanteneinführung", trend: 'stable', trendPct: 0, priority: 'medium' }
          ]
        },
        comparison: "Lieferzuverlässigkeit bleibt der stärkste Beziehungstreiber. VMI-Programme wachsen am schnellsten (+16%) — Hersteller suchen aktiv nach Lieferanten, die Produktionssicherheit bieten. IATF-Zertifizierungsanforderungen steigen 9% — Automobilkunden übertragen Zertifizierungspflichten auf Komponentenlieferanten. Lieferketten-Risikomanagement wächst 12% als strategisches Thema. Der Vertrieb muss VMI, IATF-Begleitung und TCO-Argumentation als führende Argumente positionieren."
      },
      customerSatisfaction: {
        sentiments: [
          { name: "Lieferzuverlässigkeit", value: 58, type: "positive", trend: 'stable', trendPct: 0, priority: 'low' },
          { name: "Technisches Verkaufs-Know-how", value: 49, type: "positive", trend: 'up', trendPct: 8, priority: 'low' },
          { name: "Breites Produktsortiment", value: 44, type: "positive", trend: 'stable', trendPct: 0, priority: 'low' },
          { name: "Qualitätszertifizierungen", value: 37, type: "positive", trend: 'up', trendPct: 5, priority: 'low' },
          { name: "Schnelle Standardlieferung", value: 31, type: "positive", trend: 'stable', trendPct: 0, priority: 'low' },
          { name: "Proaktives Account-Management", value: 26, type: "positive", trend: 'up', trendPct: 4, priority: 'low' },
          { name: "Gute Verfügbarkeit für Eilbestellungen", value: 21, type: "positive", trend: 'stable', trendPct: 0, priority: 'low' }
        ],
        issues: [
          { name: "Preis vs. asiatische Alternativen", value: 41, severity: "high", trend: 'up', trendPct: 14, priority: 'high' },
          { name: "Mindestbestellmenge zu hoch", value: 28, severity: "high", trend: 'up', trendPct: 6, priority: 'high' },
          { name: "Lieferzeit Sonderanfertigungen", value: 22, severity: "medium", trend: 'stable', trendPct: 0, priority: 'medium' },
          { name: "Online-Bestellportal eingeschränkt", value: 17, severity: "medium", trend: 'up', trendPct: 5, priority: 'medium' },
          { name: "Begrenzter Lagerbestand bei spezifischen Artikeln", value: 12, severity: "low", trend: 'down', trendPct: 3, priority: 'low' },
          { name: "Reaktionszeit bei Angeboten", value: 9, severity: "low", trend: 'stable', trendPct: 0, priority: 'low' }
        ],
        sentimentAlerts: ["Technisches Know-how steigt 8% — Engineering-Kompetenz wird von Kunden zunehmend geschätzt", "Qualitätszertifizierungen steigen 5% — IATF-Positionierung resoniert in Automobilkonten"],
        issueAlerts: ["Preis vs. asiatische Alternativen steigt 14% — TCO-Argumentation dringend erforderlich", "MOQ-Beschwerden steigen 6% — Volumenschwelle erzeugt Konversionsfriktionen"],
        sentimentSummary: "Lieferzuverlässigkeit und technisches Know-how sind die stärksten Zufriedenheitstreiber.",
        issueSummary: "Asiatischer Preisvergleich und MOQ sind die zwei am schnellsten wachsenden Konversionsbarrieren.",
        comparison: "Lieferzuverlässigkeit (58%) bleibt der stärkste positive Treiber. Technisches Know-how (+8%) steigt schnell — Kunden schätzen zunehmend Expertenberatung bei der Komponentenauswahl. Qualitätszertifizierungen wachsen (+5%). Preis vs. asiatische Alternativen ist das am schnellsten wachsende Problem (+14% auf 33%). Die Divergenz zwischen wachsender Wertschätzung für technisches Know-how und wachsenden Preiseinwänden signalisiert eine strategische Positionierungslücke. TCO-Argumentation muss zum Pflichtgesprächsbestandteil werden."
      },
      competition: {
        competitors: [
          { name: "Sortimentsbreite & Preis", competitor: "Würth", value: 38, mentions: 14, trend: 'up', trendPct: 9, priority: 'high' },
          { name: "Technische Befestigungssysteme", competitor: "Böllhoff", value: 29, mentions: 11, trend: 'up', trendPct: 7, priority: 'high' },
          { name: "Stückpreis", competitor: "Asiatische Webshops", value: 33, mentions: 12, trend: 'up', trendPct: 15, priority: 'high' },
          { name: "Europäisches Sortiment", competitor: "TR Fastenings", value: 18, mentions: 6, trend: 'stable', trendPct: 0, priority: 'low' }
        ],
        strengths: [
          { name: "Technischer Engineering-Support", value: 44, trend: 'down', trendPct: 5, priority: 'medium' },
          { name: "IATF-Zertifizierungsbegleitung", value: 38, trend: 'up', trendPct: 8, priority: 'low' },
          { name: "VMI / Konsignationsprogramme", value: 31, trend: 'down', trendPct: 7, priority: 'high' },
          { name: "Industriekomponenten-Sortimentstiefe", value: 27, trend: 'stable', trendPct: 0, priority: 'low' },
          { name: "Lokaler Benelux-Lagerbestand", value: 22, trend: 'stable', trendPct: 0, priority: 'low' }
        ],
        competitorAlerts: ["Asiatische Webshop-Referenzen steigen 15% — Preisbenchmark-Problem wächst", "Würth-Aktivität steigt 9% — Breitensortiment-Wettbewerber erhöht Besuchsfrequenz"],
        strengthAlerts: ["VMI-Programme sinken 7% in Verkaufsgesprächen — zentraler Differenziator wird untergenutzt", "Engineering-Support sinkt 5% — Kompetenz wird nicht kommuniziert"],
        competitorSummary: "Asiatische Preisreferenz und Würths Sortimentsbreite sind die wachsenden Bedrohungen.",
        strengthSummary: "IATF-Begleitung wächst, aber VMI und Engineering-Support sinken in der Verkäuferkommunikation.",
        comparison: "Asiatische Webshop-Referenzen als Preisbenchmark stiegen 15% — jetzt in 27% der Wettbewerbsgespräche erwähnt. Würth steigt 9%. IATF-Zertifizierungsbegleitung wächst +8%, aber VMI-Programme sinken −7% und Engineering-Support sinkt −5%. Die Wettbewerbsposition gegen Würth erfordert Engineering-Support und VMI-Programme — genau die Argumente, die Würth nicht bieten kann. Gegen asiatische Preisreferenzen sind TCO- und Qualitätszertifizierungsargumente die Antwort."
      },
      proposition: {
        execution: [
          { name: "Lieferzuverlässigkeit & Verfügbarkeit", value: 73, trend: 'stable', trendPct: 0, description: "Lieferkennzahlen und Lagerverfügbarkeit werden konsistent kommuniziert." },
          { name: "Technischer Engineering-Support", value: 54, trend: 'down', trendPct: 8, description: "Design-in-Support und Anwendungsexpertise werden in knapp der Hälfte der Gespräche erwähnt." },
          { name: "IATF / Qualitätszertifizierungen", value: 46, trend: 'up', trendPct: 7, description: "Zertifizierungsnachweise werden häufiger erwähnt — Automobilkunden reagieren positiv." },
          { name: "VMI / Konsignationsprogramme", value: 38, trend: 'down', trendPct: 9, description: "VMI-Programme sinken trotz wachsender Kundennachfrage — eine erhebliche Propositionslücke." },
          { name: "TCO / Lieferantenkonsolidierung", value: 29, trend: 'down', trendPct: 6, description: "Gesamtbetriebskosten-Argumentation wird selten eingesetzt." }
        ],
        resonance: [
          { name: "Lieferzuverlässigkeit & Verfügbarkeit", value: 76, trend: 'stable', trendPct: 0, description: "Lieferzuverlässigkeit resoniert immer — Kunden bestätigen es als primäres Auswahlkriterium." },
          { name: "IATF / Qualitätszertifizierungen", value: 68, trend: 'up', trendPct: 11, description: "Zertifizierungsargumente landen ausgezeichnet bei Automobil- und Maschinenbaukunden." },
          { name: "Technischer Engineering-Support", value: 64, trend: 'up', trendPct: 9, description: "Engineering-Support resoniert stark, wenn kommuniziert." },
          { name: "VMI / Konsignationsprogramme", value: 58, trend: 'up', trendPct: 14, description: "VMI resoniert sehr stark bei Einführung — Kunden zeigen sofortiges Interesse." },
          { name: "TCO / Lieferantenkonsolidierung", value: 51, trend: 'up', trendPct: 7, description: "TCO-Argumente neutralisieren Preiseinwände wirksam wenn eingesetzt." }
        ],
        executionAlerts: ["VMI-Programme sinken 9% in der Ausführung — schnellste wachsende Kundennachfrage, am wenigsten kommuniziert", "Engineering-Support sinkt 8% — zentraler Differenziator verliert Stimme"],
        resonanceAlerts: ["VMI-Resonanz steigt 14% — bestätigt erhebliches ungenutztes Potenzial", "IATF-Zertifizierungsresonanz steigt 11% — stärkstes Argument in Automobilkonten"],
        executionSummary: "Lieferzuverlässigkeit gut kommuniziert. VMI, Engineering und TCO sind systematische Lücken.",
        resonanceSummary: "VMI und IATF-Zertifizierung haben die höchste Resonanz — aber beide werden zu wenig kommuniziert.",
        comparison: "Verkäufer kommunizieren Lieferzuverlässigkeit konsequent — das ist die Grundlage. Aber die höherwertigeren Propositionselemente verschwinden aus Gesprächen. VMI-Programme werden in weniger als 40% der Gespräche erwähnt, obwohl die Kundennachfrage stark wächst (+16%). Engineering-Support sinkt (−8%). TCO-Argumentation ist in weniger als 30% der Gespräche präsent. Wenn Propositionselemente kommuniziert werden, resonieren sie durchweg stark. IATF (+11% Resonanz) und VMI (+14% Resonanz) sind die zwei am schnellsten wachsenden Resonanzelemente. Das Problem liegt nicht darin, dass die Proposition nicht funktioniert — sie wird einfach nicht genug eingesetzt."
      }
    };
  }

  if (lang === 'fr') {
    return {
      trends: {
        trendGroups: {
          relational: [
            { name: "Fiabilité de livraison", value: 54, type: "known", description: "Les clients attendent des livraisons ponctuelles et complètes de composants industriels", trend: 'stable', trendPct: 0, priority: 'medium' },
            { name: "Interlocuteur dédié", value: 43, type: "known", description: "Les clients veulent un contact technique fixe qui connaît leurs besoins de production", trend: 'up', trendPct: 5, priority: 'low' },
            { name: "Support ingénierie technique", value: 38, type: "known", description: "L'aide à la conception et à la sélection des composants est de plus en plus attendue", trend: 'up', trendPct: 8, priority: 'high' }
          ],
          functional: [
            { name: "VMI / Programmes de consignation", value: 47, type: "new", description: "Les fabricants veulent une gestion des stocks par le fournisseur pour éviter les ruptures", trend: 'up', trendPct: 16, priority: 'high' },
            { name: "Large gamme de produits", value: 42, type: "known", description: "Consolidation des fournisseurs de composants — exigence de guichet unique", trend: 'up', trendPct: 9, priority: 'high' },
            { name: "Composants sur mesure", value: 34, type: "new", description: "Clips, capuchons et joints non standard pour des solutions spécifiques", trend: 'up', trendPct: 7, priority: 'medium' },
            { name: "Catalogue en ligne & données CAO 3D", value: 28, type: "known", description: "Les ingénieurs veulent un accès instantané aux plans et modèles 3D", trend: 'up', trendPct: 5, priority: 'medium' },
            { name: "Connectivité EDI / ERP", value: 19, type: "new", description: "Échange automatisé de commandes et factures avec les ERP clients", trend: 'stable', trendPct: 0, priority: 'low' }
          ],
          financial: [
            { name: "Coût total de possession (TCO)", value: 41, type: "known", description: "Les clients comparent le coût total de la chaîne d'approvisionnement, pas seulement le prix unitaire", trend: 'up', trendPct: 8, priority: 'high' },
            { name: "Économies de consolidation fournisseurs", value: 35, type: "new", description: "Moins de fournisseurs signifie moins de frais administratifs et logistiques", trend: 'up', trendPct: 11, priority: 'high' },
            { name: "Structures tarifaires flexibles", value: 22, type: "known", description: "Remises sur volume, prix de commande ouverte et contrats annuels", trend: 'stable', trendPct: 0, priority: 'low' }
          ],
          organizational: [
            { name: "Standardisation des achats", value: 37, type: "known", description: "Les services achats cherchent à standardiser les spécifications de composants entre les sites", trend: 'stable', trendPct: 0, priority: 'medium' },
            { name: "Exigences de certification IATF / ISO", value: 31, type: "new", description: "Les obligations de certification de la chaîne automobile sont imposées aux fournisseurs", trend: 'up', trendPct: 9, priority: 'high' },
            { name: "Processus d'approbation interne", value: 24, type: "known", description: "L'ingénierie, les achats et la qualité interviennent dans les décisions fournisseurs", trend: 'stable', trendPct: 0, priority: 'medium' }
          ],
          strategic: [
            { name: "Gestion des risques de la chaîne logistique", value: 44, type: "new", description: "Réduction de la dépendance vis-à-vis des sources asiatiques", trend: 'up', trendPct: 12, priority: 'high' },
            { name: "Approvisionnement européen vs. asiatique", value: 33, type: "new", description: "Tendance au reshoring : préférence croissante pour les fournisseurs certifiés européens", trend: 'up', trendPct: 8, priority: 'high' },
            { name: "Achats responsables", value: 21, type: "new", description: "Exigences environnementales et d'empreinte carbone pour les partenaires de la chaîne", trend: 'up', trendPct: 6, priority: 'medium' }
          ],
          urgency: [
            { name: "Risque d'arrêt de ligne de production", value: 41, type: "known", description: "La rupture de composants qui arrête une ligne crée une urgence extrême", trend: 'up', trendPct: 7, priority: 'high' },
            { name: "Lancement nouvelle ligne de produits", value: 32, type: "new", description: "Les démarrages de séries imminents nécessitent de nouvelles homologations", trend: 'up', trendPct: 9, priority: 'high' },
            { name: "Révision annuelle des achats", value: 26, type: "known", description: "Cycles annuels d'évaluation fournisseurs — fenêtre clé pour nouveaux fournisseurs", trend: 'stable', trendPct: 0, priority: 'medium' }
          ]
        },
        comparison: "La fiabilité de livraison reste le critère relationnel prioritaire. Les programmes VMI connaissent la croissance la plus rapide (+16%) — les fabricants cherchent des fournisseurs offrant sécurité de production. Les exigences IATF progressent de 9%. La gestion des risques supply chain croît de 12%. L'équipe commerciale doit positionner VMI, accompagnement IATF et argumentation TCO comme arguments prioritaires."
      },
      customerSatisfaction: {
        sentiments: [
          { name: "Fiabilité de livraison", value: 58, type: "positive", trend: 'stable', trendPct: 0, priority: 'low' },
          { name: "Expertise technique de vente", value: 49, type: "positive", trend: 'up', trendPct: 8, priority: 'low' },
          { name: "Large gamme de produits", value: 44, type: "positive", trend: 'stable', trendPct: 0, priority: 'low' },
          { name: "Certifications qualité", value: 37, type: "positive", trend: 'up', trendPct: 5, priority: 'low' },
          { name: "Livraison standard rapide", value: 31, type: "positive", trend: 'stable', trendPct: 0, priority: 'low' },
          { name: "Gestion de compte proactive", value: 26, type: "positive", trend: 'up', trendPct: 4, priority: 'low' },
          { name: "Bonne disponibilité pour commandes urgentes", value: 21, type: "positive", trend: 'stable', trendPct: 0, priority: 'low' }
        ],
        issues: [
          { name: "Prix vs. alternatives asiatiques", value: 41, severity: "high", trend: 'up', trendPct: 14, priority: 'high' },
          { name: "Quantité minimale de commande trop élevée", value: 28, severity: "high", trend: 'up', trendPct: 6, priority: 'high' },
          { name: "Délai livraison composants personnalisés", value: 22, severity: "medium", trend: 'stable', trendPct: 0, priority: 'medium' },
          { name: "Portail de commande en ligne limité", value: 17, severity: "medium", trend: 'up', trendPct: 5, priority: 'medium' },
          { name: "Stock limité sur certains articles", value: 12, severity: "low", trend: 'down', trendPct: 3, priority: 'low' },
          { name: "Délai de réponse sur devis", value: 9, severity: "low", trend: 'stable', trendPct: 0, priority: 'low' }
        ],
        sentimentAlerts: ["Expertise technique en hausse de 8% — la compétence ingénierie est de plus en plus valorisée", "Certifications qualité en hausse de 5% — le positionnement IATF résonne dans les comptes automobiles"],
        issueAlerts: ["Prix vs. alternatives asiatiques en hausse de 14% — argumentation TCO urgente", "Plaintes MOQ en hausse de 6% — le seuil de volume génère des frictions de conversion"],
        sentimentSummary: "Fiabilité de livraison et expertise technique sont les principaux facteurs de satisfaction.",
        issueSummary: "La comparaison de prix asiatique et la MOQ sont les deux barrières de conversion à la plus forte croissance.",
        comparison: "La fiabilité de livraison (58%) reste le principal facteur positif. L'expertise technique progresse (+8%). Les certifications qualité progressent (+5%). Le prix face aux alternatives asiatiques est le problème qui croît le plus rapidement (+14% à 33%). L'argumentation TCO doit devenir un élément obligatoire de chaque conversation commerciale."
      },
      competition: {
        competitors: [
          { name: "Largeur de gamme & prix", competitor: "Würth", value: 38, mentions: 14, trend: 'up', trendPct: 9, priority: 'high' },
          { name: "Systèmes de fixation technique", competitor: "Böllhoff", value: 29, mentions: 11, trend: 'up', trendPct: 7, priority: 'high' },
          { name: "Prix unitaire", competitor: "Webshops asiatiques", value: 33, mentions: 12, trend: 'up', trendPct: 15, priority: 'high' },
          { name: "Gamme européenne", competitor: "TR Fastenings", value: 18, mentions: 6, trend: 'stable', trendPct: 0, priority: 'low' }
        ],
        strengths: [
          { name: "Support ingénierie technique", value: 44, trend: 'down', trendPct: 5, priority: 'medium' },
          { name: "Accompagnement certification IATF", value: 38, trend: 'up', trendPct: 8, priority: 'low' },
          { name: "VMI / Programmes de consignation", value: 31, trend: 'down', trendPct: 7, priority: 'high' },
          { name: "Profondeur de gamme composants industriels", value: 27, trend: 'stable', trendPct: 0, priority: 'low' },
          { name: "Stock local Benelux", value: 22, trend: 'stable', trendPct: 0, priority: 'low' }
        ],
        competitorAlerts: ["Références webshops asiatiques en hausse de 15% — problème de benchmark prix croissant", "Activité Würth en hausse de 9% — concurrent large gamme augmente la fréquence de visite"],
        strengthAlerts: ["Programmes VMI en baisse de 7% dans les conversations — différenciateur central sous-utilisé", "Support ingénierie en baisse de 5% — compétence non communiquée"],
        competitorSummary: "Référence prix asiatique et largeur de gamme Würth sont les deux menaces croissantes.",
        strengthSummary: "L'accompagnement IATF progresse mais VMI et support ingénierie diminuent dans la communication des vendeurs.",
        comparison: "Les références de webshops asiatiques comme benchmark de prix ont augmenté de 15%. Würth progresse de 9%. L'accompagnement IATF croît de +8%, mais les programmes VMI diminuent de −7% et le support ingénierie de −5%. Le support ingénierie et les programmes VMI sont précisément les arguments que Würth ne peut pas égaler. Contre les références de prix asiatiques, les arguments TCO et certification qualité sont la réponse."
      },
      proposition: {
        execution: [
          { name: "Fiabilité livraison & disponibilité", value: 73, trend: 'stable', trendPct: 0, description: "Les indicateurs de livraison et la disponibilité des stocks sont communiqués de façon cohérente." },
          { name: "Support ingénierie technique", value: 54, trend: 'down', trendPct: 8, description: "L'aide à la conception et l'expertise applicative sont mentionnées dans à peine la moitié des conversations." },
          { name: "Certifications IATF / qualité", value: 46, trend: 'up', trendPct: 7, description: "Les certifications sont mentionnées plus souvent — les clients automobiles répondent positivement." },
          { name: "VMI / Programmes de consignation", value: 38, trend: 'down', trendPct: 9, description: "Les programmes VMI diminuent dans la communication malgré une forte demande croissante." },
          { name: "TCO / Consolidation fournisseurs", value: 29, trend: 'down', trendPct: 6, description: "L'argumentation TCO est rarement utilisée malgré son efficacité contre les objections prix." }
        ],
        resonance: [
          { name: "Fiabilité livraison & disponibilité", value: 76, trend: 'stable', trendPct: 0, description: "La fiabilité de livraison résonne toujours — les clients la confirment comme critère principal." },
          { name: "Certifications IATF / qualité", value: 68, trend: 'up', trendPct: 11, description: "Les arguments de certification atterrissent exceptionnellement bien auprès des clients automobile." },
          { name: "Support ingénierie technique", value: 64, trend: 'up', trendPct: 9, description: "Le support ingénierie résonne fortement quand communiqué." },
          { name: "VMI / Programmes de consignation", value: 58, trend: 'up', trendPct: 14, description: "Le VMI résonne très fortement à l'introduction — les clients montrent un intérêt immédiat." },
          { name: "TCO / Consolidation fournisseurs", value: 51, trend: 'up', trendPct: 7, description: "Les arguments TCO neutralisent efficacement les objections prix quand utilisés." }
        ],
        executionAlerts: ["Programmes VMI en baisse de 9% — besoin client à la croissance la plus rapide, moins communiqué", "Support ingénierie en baisse de 8% — différenciateur central perd sa voix"],
        resonanceAlerts: ["Résonance VMI en hausse de 14% — confirme un potentiel inexploité important", "Résonance certification IATF en hausse de 11% — argument le plus percutant dans les comptes automobiles"],
        executionSummary: "Fiabilité livraison bien communiquée. VMI, ingénierie et TCO sont des lacunes systématiques.",
        resonanceSummary: "VMI et certification IATF ont la résonance la plus élevée — mais ni l'un ni l'autre n'est suffisamment communiqué.",
        comparison: "Les vendeurs communiquent la fiabilité de livraison de façon cohérente. Les programmes VMI sont mentionnés dans moins de 40% des entretiens malgré une demande croissante (+16%). Le support ingénierie diminue (−8%). L'argumentation TCO est présente dans moins de 30% des conversations. Quand les éléments de proposition sont communiqués, ils résonnent très bien. IATF (+11% résonance) et VMI (+14% résonance) sont les deux éléments à la croissance de résonance la plus rapide."
      }
    };
  }

  if (lang === 'es') {
    return {
      trends: {
        trendGroups: {
          relational: [
            { name: "Fiabilidad de entrega", value: 54, type: "known", description: "Los clientes esperan entregas puntuales y completas de componentes industriales", trend: 'stable', trendPct: 0, priority: 'medium' },
            { name: "Interlocutor dedicado", value: 43, type: "known", description: "Los clientes quieren un contacto técnico fijo que conozca sus necesidades de producción", trend: 'up', trendPct: 5, priority: 'low' },
            { name: "Soporte de ingeniería técnica", value: 38, type: "known", description: "El apoyo en diseño y selección de componentes es cada vez más esperado", trend: 'up', trendPct: 8, priority: 'high' }
          ],
          functional: [
            { name: "VMI / Programas de consignación", value: 47, type: "new", description: "Los fabricantes quieren gestión de inventario por el proveedor para evitar paradas de línea", trend: 'up', trendPct: 16, priority: 'high' },
            { name: "Amplia gama de productos", value: 42, type: "known", description: "Consolidación del suministro de componentes en menos proveedores", trend: 'up', trendPct: 9, priority: 'high' },
            { name: "Componentes a medida", value: 34, type: "new", description: "Clips, tapones y juntas no estándar para soluciones específicas de aplicación", trend: 'up', trendPct: 7, priority: 'medium' },
            { name: "Catálogo en línea y datos CAD 3D", value: 28, type: "known", description: "Los ingenieros quieren acceso instantáneo a planos y modelos 3D", trend: 'up', trendPct: 5, priority: 'medium' },
            { name: "Conectividad EDI / ERP", value: 19, type: "new", description: "Intercambio automatizado de pedidos y facturas con los sistemas ERP", trend: 'stable', trendPct: 0, priority: 'low' }
          ],
          financial: [
            { name: "Costo total de propiedad (TCO)", value: 41, type: "known", description: "Los clientes comparan el costo total de la cadena de suministro, no solo el precio unitario", trend: 'up', trendPct: 8, priority: 'high' },
            { name: "Ahorro por consolidación de proveedores", value: 35, type: "new", description: "Menos proveedores significa menores gastos administrativos y logísticos", trend: 'up', trendPct: 11, priority: 'high' },
            { name: "Estructuras de precios flexibles", value: 22, type: "known", description: "Descuentos por volumen, pedidos abiertos y contratos anuales", trend: 'stable', trendPct: 0, priority: 'low' }
          ],
          organizational: [
            { name: "Estandarización de compras", value: 37, type: "known", description: "Los departamentos de compras buscan estandarizar especificaciones de componentes entre plantas", trend: 'stable', trendPct: 0, priority: 'medium' },
            { name: "Requisitos de certificación IATF / ISO", value: 31, type: "new", description: "Las obligaciones de certificación automotive se imponen a los proveedores de componentes", trend: 'up', trendPct: 9, priority: 'high' },
            { name: "Procesos de aprobación interna", value: 24, type: "known", description: "Ingeniería, compras y calidad intervienen en las decisiones de proveedor", trend: 'stable', trendPct: 0, priority: 'medium' }
          ],
          strategic: [
            { name: "Gestión de riesgos de la cadena de suministro", value: 44, type: "new", description: "Reducción de la dependencia del aprovisionamiento asiático de componentes", trend: 'up', trendPct: 12, priority: 'high' },
            { name: "Aprovisionamiento europeo vs. asiático", value: 33, type: "new", description: "Tendencia reshoring: fabricantes prefieren cada vez más proveedores certificados europeos", trend: 'up', trendPct: 8, priority: 'high' },
            { name: "Compras sostenibles", value: 21, type: "new", description: "Requisitos medioambientales para socios de la cadena de suministro", trend: 'up', trendPct: 6, priority: 'medium' }
          ],
          urgency: [
            { name: "Riesgo de parada de línea de producción", value: 41, type: "known", description: "La falta de componentes que detiene una línea crea urgencia extrema para cambiar", trend: 'up', trendPct: 7, priority: 'high' },
            { name: "Lanzamiento nueva línea de producto", value: 32, type: "new", description: "Los arranques de series inminentes requieren nuevas homologaciones de componentes", trend: 'up', trendPct: 9, priority: 'high' },
            { name: "Revisión anual de compras", value: 26, type: "known", description: "Ciclos anuales de evaluación de proveedores — ventana clave para nuevos proveedores", trend: 'stable', trendPct: 0, priority: 'medium' }
          ]
        },
        comparison: "La fiabilidad de entrega sigue siendo el principal criterio relacional. Los programas VMI experimentan el crecimiento más rápido (+16%) — los fabricantes buscan proveedores que ofrezcan seguridad de producción. Los requisitos de certificación IATF crecen un 9%. La gestión de riesgos de la cadena de suministro crece un 12%. El equipo comercial debe posicionar VMI, acompañamiento IATF y argumentación TCO como argumentos prioritarios."
      },
      customerSatisfaction: {
        sentiments: [
          { name: "Fiabilidad de entrega", value: 58, type: "positive", trend: 'stable', trendPct: 0, priority: 'low' },
          { name: "Experiencia técnica de venta", value: 49, type: "positive", trend: 'up', trendPct: 8, priority: 'low' },
          { name: "Amplia gama de productos", value: 44, type: "positive", trend: 'stable', trendPct: 0, priority: 'low' },
          { name: "Certificaciones de calidad", value: 37, type: "positive", trend: 'up', trendPct: 5, priority: 'low' },
          { name: "Entrega estándar rápida", value: 31, type: "positive", trend: 'stable', trendPct: 0, priority: 'low' },
          { name: "Gestión de cuenta proactiva", value: 26, type: "positive", trend: 'up', trendPct: 4, priority: 'low' },
          { name: "Buena disponibilidad para pedidos urgentes", value: 21, type: "positive", trend: 'stable', trendPct: 0, priority: 'low' }
        ],
        issues: [
          { name: "Precio vs. alternativas asiáticas", value: 41, severity: "high", trend: 'up', trendPct: 14, priority: 'high' },
          { name: "Cantidad mínima de pedido muy alta", value: 28, severity: "high", trend: 'up', trendPct: 6, priority: 'high' },
          { name: "Plazo entrega componentes personalizados", value: 22, severity: "medium", trend: 'stable', trendPct: 0, priority: 'medium' },
          { name: "Portal de pedidos en línea limitado", value: 17, severity: "medium", trend: 'up', trendPct: 5, priority: 'medium' },
          { name: "Stock limitado en artículos específicos", value: 12, severity: "low", trend: 'down', trendPct: 3, priority: 'low' },
          { name: "Tiempo de respuesta en presupuestos", value: 9, severity: "low", trend: 'stable', trendPct: 0, priority: 'low' }
        ],
        sentimentAlerts: ["Experiencia técnica crece un 8% — la competencia de ingeniería es cada vez más valorada", "Certificaciones de calidad crecen un 5% — el posicionamiento IATF resuena en cuentas automotrices"],
        issueAlerts: ["Precio vs. alternativas asiáticas crece un 14% — argumentación TCO urgente", "Quejas MOQ crecen un 6% — el umbral de volumen genera fricciones de conversión"],
        sentimentSummary: "La fiabilidad de entrega y la experiencia técnica son los principales impulsores de satisfacción.",
        issueSummary: "La comparación de precios asiáticos y la MOQ son las dos barreras de conversión de mayor crecimiento.",
        comparison: "La fiabilidad de entrega (58%) sigue siendo el principal factor positivo. La experiencia técnica crece (+8%). Las certificaciones de calidad crecen (+5%). El precio frente a las alternativas asiáticas es el problema de mayor crecimiento (+14% al 33%). La argumentación TCO debe convertirse en un elemento obligatorio de cada conversación comercial."
      },
      competition: {
        competitors: [
          { name: "Amplitud de gama y precio", competitor: "Würth", value: 38, mentions: 14, trend: 'up', trendPct: 9, priority: 'high' },
          { name: "Sistemas de fijación técnica", competitor: "Böllhoff", value: 29, mentions: 11, trend: 'up', trendPct: 7, priority: 'high' },
          { name: "Precio unitario", competitor: "Webshops asiáticos", value: 33, mentions: 12, trend: 'up', trendPct: 15, priority: 'high' },
          { name: "Gama europea", competitor: "TR Fastenings", value: 18, mentions: 6, trend: 'stable', trendPct: 0, priority: 'low' }
        ],
        strengths: [
          { name: "Soporte de ingeniería técnica", value: 44, trend: 'down', trendPct: 5, priority: 'medium' },
          { name: "Acompañamiento certificación IATF", value: 38, trend: 'up', trendPct: 8, priority: 'low' },
          { name: "VMI / Programas de consignación", value: 31, trend: 'down', trendPct: 7, priority: 'high' },
          { name: "Profundidad de gama componentes industriales", value: 27, trend: 'stable', trendPct: 0, priority: 'low' },
          { name: "Stock local Benelux", value: 22, trend: 'stable', trendPct: 0, priority: 'low' }
        ],
        competitorAlerts: ["Referencias webshops asiáticos crecen 15% — problema de benchmark de precios en aumento", "Actividad Würth crece 9% — competidor de gama amplia aumenta frecuencia de visitas"],
        strengthAlerts: ["Programas VMI caen 7% en conversaciones — diferenciador central infrautilizado", "Soporte ingeniería cae 5% — competencia no comunicada"],
        competitorSummary: "La referencia de precio asiático y la amplitud de gama de Würth son las dos amenazas crecientes.",
        strengthSummary: "El acompañamiento IATF crece pero VMI y soporte de ingeniería disminuyen en la comunicación.",
        comparison: "Las referencias de webshops asiáticos crecieron un 15% — ahora en el 27% de las conversaciones. Würth sube un 9%. El acompañamiento IATF crece +8%, pero los programas VMI disminuyen −7% y el soporte de ingeniería −5%. El soporte de ingeniería y los programas VMI son precisamente los argumentos que Würth no puede igualar. Contra las referencias asiáticas, los argumentos TCO y certificación de calidad son la respuesta."
      },
      proposition: {
        execution: [
          { name: "Fiabilidad entrega y disponibilidad", value: 73, trend: 'stable', trendPct: 0, description: "Los indicadores de entrega y disponibilidad de stock se comunican de manera consistente." },
          { name: "Soporte de ingeniería técnica", value: 54, trend: 'down', trendPct: 8, description: "El soporte en diseño y la expertise de aplicación se mencionan en apenas la mitad de las conversaciones." },
          { name: "Certificaciones IATF / calidad", value: 46, trend: 'up', trendPct: 7, description: "Las certificaciones se mencionan más a menudo — los clientes automotrices responden positivamente." },
          { name: "VMI / Programas de consignación", value: 38, trend: 'down', trendPct: 9, description: "Los programas VMI disminuyen en la comunicación a pesar de la fuerte demanda creciente." },
          { name: "TCO / Consolidación de proveedores", value: 29, trend: 'down', trendPct: 6, description: "La argumentación TCO rara vez se despliega a pesar de ser la respuesta más efectiva." }
        ],
        resonance: [
          { name: "Fiabilidad entrega y disponibilidad", value: 76, trend: 'stable', trendPct: 0, description: "La fiabilidad de entrega siempre resuena — los clientes la confirman como criterio principal." },
          { name: "Certificaciones IATF / calidad", value: 68, trend: 'up', trendPct: 11, description: "Los argumentos de certificación aterrizan excepcionalmente bien en clientes automotrices." },
          { name: "Soporte de ingeniería técnica", value: 64, trend: 'up', trendPct: 9, description: "El soporte de ingeniería resuena fuertemente cuando se comunica." },
          { name: "VMI / Programas de consignación", value: 58, trend: 'up', trendPct: 14, description: "El VMI resuena muy fuertemente al introducirse — los clientes muestran interés inmediato." },
          { name: "TCO / Consolidación de proveedores", value: 51, trend: 'up', trendPct: 7, description: "Los argumentos TCO neutralizan eficazmente las objeciones de precio cuando se usan." }
        ],
        executionAlerts: ["Programas VMI caen 9% — necesidad del cliente de mayor crecimiento, menos comunicado", "Soporte ingeniería cae 8% — diferenciador central pierde voz en conversaciones"],
        resonanceAlerts: ["Resonancia VMI crece 14% — mayor crecimiento de resonancia, confirma oportunidad no aprovechada", "Resonancia certificación IATF crece 11% — argumento de mayor impacto en cuentas automotrices"],
        executionSummary: "Fiabilidad de entrega bien comunicada. VMI, ingeniería y TCO son brechas sistemáticas.",
        resonanceSummary: "VMI y certificación IATF tienen la mayor resonancia — pero ninguno se comunica suficientemente.",
        comparison: "Los vendedores comunican la fiabilidad de entrega de manera consistente. Los programas VMI se mencionan en menos del 40% de las conversaciones a pesar de la creciente demanda (+16%). El soporte de ingeniería disminuye (−8%). La argumentación TCO está presente en menos del 30% de las conversaciones. IATF (+11% resonancia) y VMI (+14% resonancia) son los dos elementos de mayor crecimiento en resonancia. El problema no es que la propuesta no funcione — es que no se despliega suficientemente."
      }
    };
  }

  if (lang === 'it') {
    return {
      trends: {
        trendGroups: {
          relational: [
            { name: "Affidabilità delle consegne", value: 54, type: "known", description: "I clienti si aspettano consegne puntuali e complete di componenti industriali", trend: 'stable', trendPct: 0, priority: 'medium' },
            { name: "Referente dedicato", value: 43, type: "known", description: "I clienti vogliono un contatto tecnico fisso che conosca le loro esigenze produttive", trend: 'up', trendPct: 5, priority: 'low' },
            { name: "Supporto tecnico all'ingegneria", value: 38, type: "known", description: "Il supporto alla progettazione e alla selezione dei componenti è sempre più atteso", trend: 'up', trendPct: 8, priority: 'high' }
          ],
          functional: [
            { name: "VMI / Programmi di consignment", value: 47, type: "new", description: "I produttori vogliono la gestione delle scorte dal fornitore per evitare fermi produzione", trend: 'up', trendPct: 16, priority: 'high' },
            { name: "Ampia gamma di prodotti", value: 42, type: "known", description: "Consolidamento della fornitura di componenti con meno fornitori", trend: 'up', trendPct: 9, priority: 'high' },
            { name: "Componenti personalizzati", value: 34, type: "new", description: "Clip, tappi e guarnizioni non standard per soluzioni specifiche per applicazione", trend: 'up', trendPct: 7, priority: 'medium' },
            { name: "Catalogo online e dati CAD 3D", value: 28, type: "known", description: "Gli ingegneri vogliono accesso immediato a disegni e modelli 3D", trend: 'up', trendPct: 5, priority: 'medium' },
            { name: "Connettività EDI / ERP", value: 19, type: "new", description: "Scambio automatizzato di ordini e fatture con i sistemi ERP dei clienti", trend: 'stable', trendPct: 0, priority: 'low' }
          ],
          financial: [
            { name: "Costo totale di proprietà (TCO)", value: 41, type: "known", description: "I clienti confrontano il costo totale della supply chain, non solo il prezzo unitario", trend: 'up', trendPct: 8, priority: 'high' },
            { name: "Risparmi da consolidamento fornitori", value: 35, type: "new", description: "Meno fornitori significa minori costi amministrativi e logistici", trend: 'up', trendPct: 11, priority: 'high' },
            { name: "Strutture tariffarie flessibili", value: 22, type: "known", description: "Sconti volume, prezzi di ordini aperti e contratti annuali", trend: 'stable', trendPct: 0, priority: 'low' }
          ],
          organizational: [
            { name: "Standardizzazione acquisti", value: 37, type: "known", description: "I reparti acquisti cercano di standardizzare le specifiche dei componenti tra gli stabilimenti", trend: 'stable', trendPct: 0, priority: 'medium' },
            { name: "Requisiti di certificazione IATF / ISO", value: 31, type: "new", description: "Gli obblighi di certificazione automotive vengono trasferiti ai fornitori di componenti", trend: 'up', trendPct: 9, priority: 'high' },
            { name: "Processi di approvazione interna", value: 24, type: "known", description: "Ingegneria, acquisti e qualità sono tutti coinvolti nelle decisioni sui fornitori", trend: 'stable', trendPct: 0, priority: 'medium' }
          ],
          strategic: [
            { name: "Gestione del rischio della supply chain", value: 44, type: "new", description: "Riduzione della dipendenza dalle fonti asiatiche di componenti", trend: 'up', trendPct: 12, priority: 'high' },
            { name: "Approvvigionamento europeo vs. asiatico", value: 33, type: "new", description: "Tendenza reshoring: i produttori preferiscono sempre più fornitori certificati europei", trend: 'up', trendPct: 8, priority: 'high' },
            { name: "Approvvigionamento sostenibile", value: 21, type: "new", description: "Requisiti ambientali e di impronta carbonica per i partner della supply chain", trend: 'up', trendPct: 6, priority: 'medium' }
          ],
          urgency: [
            { name: "Rischio fermo linea di produzione", value: 41, type: "known", description: "La mancanza di componenti che ferma una linea crea urgenza estrema al cambiamento", trend: 'up', trendPct: 7, priority: 'high' },
            { name: "Lancio nuova linea di prodotti", value: 32, type: "new", description: "Gli imminenti avvii di serie richiedono nuove omologazioni di componenti", trend: 'up', trendPct: 9, priority: 'high' },
            { name: "Revisione annuale degli acquisti", value: 26, type: "known", description: "Cicli annuali di valutazione fornitori — finestra chiave per nuovi fornitori", trend: 'stable', trendPct: 0, priority: 'medium' }
          ]
        },
        comparison: "L'affidabilità delle consegne rimane il principale criterio relazionale. I programmi VMI registrano la crescita più rapida (+16%) — i produttori cercano fornitori che garantiscano sicurezza produttiva. I requisiti IATF crescono del 9%. La gestione del rischio supply chain cresce del 12%. Il team commerciale deve posizionare VMI, accompagnamento IATF e argomentazione TCO come argomenti prioritari."
      },
      customerSatisfaction: {
        sentiments: [
          { name: "Affidabilità delle consegne", value: 58, type: "positive", trend: 'stable', trendPct: 0, priority: 'low' },
          { name: "Competenza tecnica di vendita", value: 49, type: "positive", trend: 'up', trendPct: 8, priority: 'low' },
          { name: "Ampia gamma di prodotti", value: 44, type: "positive", trend: 'stable', trendPct: 0, priority: 'low' },
          { name: "Certificazioni di qualità", value: 37, type: "positive", trend: 'up', trendPct: 5, priority: 'low' },
          { name: "Consegna standard rapida", value: 31, type: "positive", trend: 'stable', trendPct: 0, priority: 'low' },
          { name: "Gestione account proattiva", value: 26, type: "positive", trend: 'up', trendPct: 4, priority: 'low' },
          { name: "Buona disponibilità per ordini urgenti", value: 21, type: "positive", trend: 'stable', trendPct: 0, priority: 'low' }
        ],
        issues: [
          { name: "Prezzo vs. alternative asiatiche", value: 41, severity: "high", trend: 'up', trendPct: 14, priority: 'high' },
          { name: "Quantità minima d'ordine troppo alta", value: 28, severity: "high", trend: 'up', trendPct: 6, priority: 'high' },
          { name: "Tempi di consegna componenti personalizzati", value: 22, severity: "medium", trend: 'stable', trendPct: 0, priority: 'medium' },
          { name: "Portale ordini online limitato", value: 17, severity: "medium", trend: 'up', trendPct: 5, priority: 'medium' },
          { name: "Stock limitato su articoli specifici", value: 12, severity: "low", trend: 'down', trendPct: 3, priority: 'low' },
          { name: "Tempi di risposta ai preventivi", value: 9, severity: "low", trend: 'stable', trendPct: 0, priority: 'low' }
        ],
        sentimentAlerts: ["Competenza tecnica cresce dell'8% — la competenza ingegneristica è sempre più apprezzata", "Certificazioni di qualità crescono del 5% — il posizionamento IATF risuona nei clienti automotive"],
        issueAlerts: ["Prezzo vs. alternative asiatiche cresce del 14% — argomentazione TCO urgente", "Reclami MOQ crescono del 6% — la soglia di volume genera attrito di conversione"],
        sentimentSummary: "Affidabilità delle consegne e competenza tecnica sono i principali fattori di soddisfazione.",
        issueSummary: "Il confronto prezzi asiatici e la MOQ sono le due barriere di conversione in più rapida crescita.",
        comparison: "L'affidabilità delle consegne (58%) rimane il principale fattore positivo. La competenza tecnica cresce (+8%). Le certificazioni di qualità crescono (+5%). Il prezzo rispetto alle alternative asiatiche è il problema in più rapida crescita (+14% al 33%). L'argomentazione TCO deve diventare un elemento obbligatorio di ogni conversazione commerciale."
      },
      competition: {
        competitors: [
          { name: "Ampiezza gamma e prezzo", competitor: "Würth", value: 38, mentions: 14, trend: 'up', trendPct: 9, priority: 'high' },
          { name: "Sistemi di fissaggio tecnico", competitor: "Böllhoff", value: 29, mentions: 11, trend: 'up', trendPct: 7, priority: 'high' },
          { name: "Prezzo unitario", competitor: "Webshop asiatici", value: 33, mentions: 12, trend: 'up', trendPct: 15, priority: 'high' },
          { name: "Gamma europea", competitor: "TR Fastenings", value: 18, mentions: 6, trend: 'stable', trendPct: 0, priority: 'low' }
        ],
        strengths: [
          { name: "Supporto tecnico all'ingegneria", value: 44, trend: 'down', trendPct: 5, priority: 'medium' },
          { name: "Accompagnamento certificazione IATF", value: 38, trend: 'up', trendPct: 8, priority: 'low' },
          { name: "VMI / Programmi di consignment", value: 31, trend: 'down', trendPct: 7, priority: 'high' },
          { name: "Profondità gamma componenti industriali", value: 27, trend: 'stable', trendPct: 0, priority: 'low' },
          { name: "Stock locale Benelux", value: 22, trend: 'stable', trendPct: 0, priority: 'low' }
        ],
        competitorAlerts: ["Riferimenti webshop asiatici crescono del 15% — problema benchmark prezzi in crescita", "Attività Würth cresce del 9% — concorrente gamma ampia aumenta frequenza visite"],
        strengthAlerts: ["Programmi VMI scendono del 7% nelle conversazioni — differenziatore centrale sottoutilizzato", "Supporto ingegneria scende del 5% — competenza non comunicata"],
        competitorSummary: "Il riferimento prezzo asiatico e l'ampiezza gamma Würth sono le due minacce crescenti.",
        strengthSummary: "L'accompagnamento IATF cresce ma VMI e supporto ingegneria diminuiscono nella comunicazione.",
        comparison: "I riferimenti di webshop asiatici sono cresciuti del 15% — ora nel 27% delle conversazioni. Würth cresce del 9%. L'accompagnamento IATF cresce del +8%, ma i programmi VMI diminuiscono del −7% e il supporto ingegneria del −5%. Il supporto ingegneria e i programmi VMI sono precisamente gli argomenti che Würth non può eguagliare. Contro i riferimenti asiatici, gli argomenti TCO e certificazione qualità sono la risposta."
      },
      proposition: {
        execution: [
          { name: "Affidabilità consegne e disponibilità", value: 73, trend: 'stable', trendPct: 0, description: "I KPI di consegna e la disponibilità delle scorte sono comunicati in modo coerente." },
          { name: "Supporto tecnico all'ingegneria", value: 54, trend: 'down', trendPct: 8, description: "Il supporto alla progettazione e la competenza applicativa sono menzionati in meno della metà delle conversazioni." },
          { name: "Certificazioni IATF / qualità", value: 46, trend: 'up', trendPct: 7, description: "Le certificazioni vengono menzionate più spesso — i clienti automotive rispondono positivamente." },
          { name: "VMI / Programmi di consignment", value: 38, trend: 'down', trendPct: 9, description: "I programmi VMI diminuiscono nella comunicazione nonostante la forte domanda crescente." },
          { name: "TCO / Consolidamento fornitori", value: 29, trend: 'down', trendPct: 6, description: "L'argomentazione TCO viene raramente dispiegata nonostante sia la risposta più efficace." }
        ],
        resonance: [
          { name: "Affidabilità consegne e disponibilità", value: 76, trend: 'stable', trendPct: 0, description: "L'affidabilità delle consegne risuona sempre — i clienti la confermano come criterio principale." },
          { name: "Certificazioni IATF / qualità", value: 68, trend: 'up', trendPct: 11, description: "Gli argomenti di certificazione atterrano eccezionalmente bene con i clienti automotive." },
          { name: "Supporto tecnico all'ingegneria", value: 64, trend: 'up', trendPct: 9, description: "Il supporto ingegneria risuona fortemente quando comunicato." },
          { name: "VMI / Programmi di consignment", value: 58, trend: 'up', trendPct: 14, description: "Il VMI risuona molto fortemente all'introduzione — i clienti mostrano interesse immediato." },
          { name: "TCO / Consolidamento fornitori", value: 51, trend: 'up', trendPct: 7, description: "Gli argomenti TCO neutralizzano efficacemente le obiezioni di prezzo quando usati." }
        ],
        executionAlerts: ["Programmi VMI scendono del 9% — esigenza clienti in più rapida crescita, meno comunicato", "Supporto ingegneria scende dell'8% — differenziatore centrale perde voce"],
        resonanceAlerts: ["Risonanza VMI cresce del 14% — conferma significativa opportunità non sfruttata", "Risonanza certificazione IATF cresce dell'11% — argomento più incisivo nei clienti automotive"],
        executionSummary: "Affidabilità consegne ben comunicata. VMI, ingegneria e TCO sono lacune sistematiche.",
        resonanceSummary: "VMI e certificazione IATF hanno la risonanza più alta — ma nessuno dei due è sufficientemente comunicato.",
        comparison: "I venditori comunicano l'affidabilità delle consegne in modo coerente. I programmi VMI sono menzionati in meno del 40% delle conversazioni nonostante la crescente domanda (+16%). Il supporto ingegneria diminuisce (−8%). L'argomentazione TCO è presente in meno del 30% delle conversazioni. IATF (+11% risonanza) e VMI (+14% risonanza) sono i due elementi con la crescita di risonanza più rapida. Il problema non è che la proposta non funzioni — è che non viene dispiegata a sufficienza."
      }
    };
  }

  return {
    trends: {
      trendGroups: {
        relational: [
          { name: "Leverbetrouwbaarheid", value: 54, type: "known", description: "Klanten verwachten consistente en volledige levering van industriële componenten", trend: 'stable', trendPct: 0, priority: 'medium' },
          { name: "Vaste Contactpersoon / Accountmanager", value: 43, type: "known", description: "Klanten willen een vast technisch aanspreekpunt dat hun productiebehoeften kent", trend: 'up', trendPct: 5, priority: 'low' },
          { name: "Technische Engineeringsondersteuning", value: 38, type: "known", description: "Design-in begeleiding en componentselectie-ondersteuning worden steeds meer verwacht", trend: 'up', trendPct: 8, priority: 'high' }
        ],
        functional: [
          { name: "VMI / Consignatiebeheer", value: 47, type: "new", description: "Fabrikanten willen leveranciersgestuurde voorraad om productiestilstand te voorkomen", trend: 'up', trendPct: 16, priority: 'high' },
          { name: "Breed Productassortiment", value: 42, type: "known", description: "Consolidatie van componentleveranciers naar minder leveranciers — one-stop-shop behoefte", trend: 'up', trendPct: 9, priority: 'high' },
          { name: "Maatwerk Componenten", value: 34, type: "new", description: "Niet-standaard clips, doppen en tules voor toepassingsspecifieke oplossingen", trend: 'up', trendPct: 7, priority: 'medium' },
          { name: "Online Catalogus & 3D CAD Data", value: 28, type: "known", description: "Engineers willen directe toegang tot tekeningen, specificaties en 3D-modellen", trend: 'up', trendPct: 5, priority: 'medium' },
          { name: "EDI / ERP-koppeling", value: 19, type: "new", description: "Geautomatiseerde order- en factuuruitwisseling met ERP-systemen van de klant", trend: 'stable', trendPct: 0, priority: 'low' }
        ],
        financial: [
          { name: "Total Cost of Ownership (TCO)", value: 41, type: "known", description: "Klanten vergelijken niet alleen stukprijs maar de totale toeleveringskosten", trend: 'up', trendPct: 8, priority: 'high' },
          { name: "Leveranciersconsolidatie Besparingen", value: 35, type: "new", description: "Minder leveranciers betekent minder administratieve en logistieke overhead", trend: 'up', trendPct: 11, priority: 'high' },
          { name: "Flexibele Prijsstructuren", value: 22, type: "known", description: "Volumekortingen, raambestelprijzen en jaarcontractmodellen", trend: 'stable', trendPct: 0, priority: 'low' }
        ],
        organizational: [
          { name: "Inkoopstandaardisatie", value: 37, type: "known", description: "Inkoopafdelingen willen componentspecificaties standaardiseren over productielocaties", trend: 'stable', trendPct: 0, priority: 'medium' },
          { name: "IATF / ISO-certificeringsvereisten", value: 31, type: "new", description: "Automotive toeleveringsketen certificeringsverplichtingen worden opgelegd aan componentleveranciers", trend: 'up', trendPct: 9, priority: 'high' },
          { name: "Intern Goedkeuringsproces Inkoop", value: 24, type: "known", description: "Techniek, inkoop en kwaliteit zijn allemaal betrokken bij leverancierskeuzes", trend: 'stable', trendPct: 0, priority: 'medium' }
        ],
        strategic: [
          { name: "Supply Chain Risicomanagement", value: 44, type: "new", description: "Vermindering van afhankelijkheid van Aziatische componentbronnen", trend: 'up', trendPct: 12, priority: 'high' },
          { name: "Europese vs. Aziatische Sourcing", value: 33, type: "new", description: "Reshoring trend: fabrikanten geven steeds meer de voorkeur aan Europees gecertificeerde leveranciers", trend: 'up', trendPct: 8, priority: 'high' },
          { name: "Duurzame Inkoop", value: 21, type: "new", description: "Milieu- en CO2-vereisten voor toeleveringsketenpartners", trend: 'up', trendPct: 6, priority: 'medium' }
        ],
        urgency: [
          { name: "Productiestilstand Risico", value: 41, type: "known", description: "Componenttekort dat een productielijn stopt creëert extreme urgentie om te switchen", trend: 'up', trendPct: 7, priority: 'high' },
          { name: "Seriestart Nieuwe Productlijn", value: 32, type: "new", description: "Aankomende seriestarts vereisen nieuwe componenthomologaties en certificeringen", trend: 'up', trendPct: 9, priority: 'high' },
          { name: "Jaarlijkse Inkoopherziening", value: 26, type: "known", description: "Jaarlijkse leveranciersbeoordeling — sleutelvenster voor introductie van nieuwe leveranciers", trend: 'stable', trendPct: 0, priority: 'medium' }
        ]
      },
      comparison: "**Wat we zien:** VMI/consignatiebeheer groeit het snelst (+16%) en staat bovenaan alle functionele klantvragen. Leveranciersconsolidatie stijgt 11%. Supply chain risicomanagement groeit 12% als strategisch thema. IATF-certificeringsvereisten nemen toe met 9% — automotive klanten leggen certificeringsverplichtingen op aan componentleveranciers. Productiestilstand risico (+7%) en seriestarts (+9%) zijn de krachtigste urgentiedrivers.\n\n**Waarschijnlijke oorzaak:** De groei van VMI en consolidatiebehoeften hangt samen met toenemende voorraadbeheerdruk bij productiebedrijven. De IATF-groei weerspiegelt strengere auditing in de automotive toeleveringsketen.\n\n**Operationele betekenis:** Het salesteam moet VMI, leveranciersconsolidatie en IATF-begeleiding naar voren positioneren in elk automotive- en machinebouw-gesprek. Deze drie thema's zijn samen goed voor 40% van de snelst groeiende klantvragen.\n\n**Strategische betekenis:** De combinatie van groeiende VMI-vraag, leveranciersconsolidatie en IATF-vereisten biedt Essentra Components een kans om zich te positioneren als 'industrieel engineeringspartner' in plaats van 'componentenleverancier'.\n\n**Aanbevolen managementactie:** Update de propositionering met VMI en IATF-begeleiding als leading argument voor automotive en machinebouw. Stel een VMI-pilot op voor de top-10 klanten. Target: VMI als opening-USP in 70% van alle nieuwe gesprekken binnen 4 weken."
    },
    customerSatisfaction: {
      sentiments: [
        { name: "Leverbetrouwbaarheid", value: 58, type: "positive", trend: 'stable', trendPct: 0, priority: 'laag' },
        { name: "Technische Verkoopkennis", value: 49, type: "positive", trend: 'up', trendPct: 8, priority: 'laag' },
        { name: "Breed Productassortiment", value: 44, type: "positive", trend: 'stable', trendPct: 0, priority: 'laag' },
        { name: "Kwaliteitscertificaten", value: 37, type: "positive", trend: 'up', trendPct: 5, priority: 'laag' },
        { name: "Snelle Standaardlevering", value: 31, type: "positive", trend: 'stable', trendPct: 0, priority: 'laag' },
        { name: "Proactief Accountbeheer", value: 26, type: "positive", trend: 'up', trendPct: 4, priority: 'laag' },
        { name: "Goede Beschikbaarheid Spoedorders", value: 21, type: "positive", trend: 'stable', trendPct: 0, priority: 'laag' }
      ],
      issues: [
        { name: "Prijs t.o.v. Aziatische Alternatieven", value: 41, severity: "high", trend: 'up', trendPct: 14, priority: 'hoog' },
        { name: "MOQ Te Hoog", value: 28, severity: "high", trend: 'up', trendPct: 6, priority: 'hoog' },
        { name: "Levertijd Maatwerk Te Lang", value: 22, severity: "medium", trend: 'stable', trendPct: 0, priority: 'middel' },
        { name: "Online Bestelportaal Verouderd", value: 17, severity: "medium", trend: 'up', trendPct: 5, priority: 'middel' },
        { name: "Beperkte Voorraad Specifieke Artikelen", value: 12, severity: "low", trend: 'down', trendPct: 3, priority: 'laag' },
        { name: "Reactietijd op Offertes", value: 9, severity: "low", trend: 'stable', trendPct: 0, priority: 'laag' }
      ],
      sentimentAlerts: ["Technische verkoopkennis stijgt 8% — engineering expertise wordt steeds meer gewaardeerd door klanten", "Kwaliteitscertificaten stijgen 5% — IATF-positionering resoneert in automotive accounts"],
      issueAlerts: ["Prijs t.o.v. Aziatische alternatieven stijgt 14% — TCO-argumentatie urgent nodig", "MOQ-bezwaren stijgen 6% — volumedrempel creëert conversiefrictie"],
      sentimentSummary: "Leverbetrouwbaarheid en technische verkoopkennis zijn de sterkste tevredenheidsdrivers.",
      issueSummary: "Aziatische prijsvergelijking en MOQ zijn de twee snelst groeiende conversiebarrières.",
      comparison: "**Wat we zien:** Leverbetrouwbaarheid (58%) blijft de sterkste positieve driver — stabiel en consistent vermeld. Technische verkoopkennis stijgt sterk (+8%) — klanten waarderen toenemend expertenadvies bij componentselectie. Kwaliteitscertificaten groeien (+5%). Op de negatieve kant is prijs t.o.v. Aziatische alternatieven het snelst groeiende bezwaar (+14% naar 33%). MOQ-klachten groeien (+6%).\n\n**Waarschijnlijke oorzaak:** De stijging van Aziatische prijsvergelijkingen hangt samen met het toenemende gebruik van e-commerce platforms door junior inkopers die stukprijzen vergelijken zonder rekening te houden met kwaliteitsrisico's, certificeringseisen of totale toeleveringskosten.\n\n**Operationele betekenis:** Prijsbezwaren groeien maar zijn structureel te weerleggen met TCO-argumentatie: totale eigendomskosten inclusief kwaliteitsrisico's, certificeringsverplichtingen, logistieke kosten en leveringszekerheid.\n\n**Strategische betekenis:** De divergentie tussen groeiende waardering voor technische kennis en groeiende prijsbezwaren signaleert een strategisch positioneringsgat: klanten waarderen de expertise maar koppelen die nog niet aan de prijs-premium.\n\n**Aanbevolen managementactie:** Implementeer een TCO-calculator als verplicht gespreksinstrument bij alle prijsbezwaren. Ontwikkel een risico-checklist voor Aziatisch vs. Europees sourcen. Herzien MOQ-beleid voor nieuwe accountontwikkeling. Target: prijsbezwaren 20% afnemen in Q2."
    },
    competition: {
      competitors: [
        { name: "Assortimentsbredte & Prijs", competitor: "Würth", value: 38, mentions: 14, trend: 'up', trendPct: 9, priority: 'hoog' },
        { name: "Technisch Bevestigen", competitor: "Böllhoff", value: 29, mentions: 11, trend: 'up', trendPct: 7, priority: 'hoog' },
        { name: "Stukprijs", competitor: "Aziatische Webshops", value: 33, mentions: 12, trend: 'up', trendPct: 15, priority: 'hoog' },
        { name: "Europees Assortiment", competitor: "TR Fastenings", value: 18, mentions: 6, trend: 'stable', trendPct: 0, priority: 'laag' }
      ],
      strengths: [
        { name: "Technische Engineeringsondersteuning", value: 44, trend: 'down', trendPct: 5, priority: 'middel' },
        { name: "IATF-certificeringsbegeleiding", value: 38, trend: 'up', trendPct: 8, priority: 'laag' },
        { name: "VMI / Consignatieprogramma", value: 31, trend: 'down', trendPct: 7, priority: 'hoog' },
        { name: "Assortimentsdiepte Industriële Componenten", value: 27, trend: 'stable', trendPct: 0, priority: 'laag' },
        { name: "Lokale Benelux Voorraad", value: 22, trend: 'stable', trendPct: 0, priority: 'laag' }
      ],
      competitorAlerts: ["Aziatische webshop referenties stijgen 15% — prijsbenchmark probleem groeit sterk", "Würth-activiteit stijgt 9% — breed assortiment concurrent verhoogt bezoekfrequentie"],
      strengthAlerts: ["VMI-programma daalt 7% in verkoopgesprekken — centraal differentiatiepunt onderbenut", "Engineering support daalt 5% — complexe klantbehoeften aanwezig maar expertise niet gecommuniceerd"],
      competitorSummary: "Aziatische prijsreferentie en Würths assortimentsbredte zijn de twee groeiende bedreigingen.",
      strengthSummary: "IATF-begeleiding groeit maar VMI en engineering support dalen in verkoperscommunicatie.",
      comparison: "**Wat we zien:** Aziatische webshop-referenties als prijsbenchmark stegen 15% — nu in 27% van alle concurrentiegesprekken vermeld. Würth stijgt 9% op assortiment en verkoopdekking. Böllhoff groeit (+7%) op technisch bevestigen. Eigen sterkpunten: IATF-certificeringsbegeleiding groeit +8%, maar VMI-programma's dalen −7% en engineering support daalt −5% in verkoperscommunicatie.\n\n**Waarschijnlijke oorzaak:** Würth en Aziatische alternatieven profiteren van lage-frictie klantcontact. De daling in VMI en engineering support-vermeldingen correleert met onvoldoende klantinventarisatie: verkopers die niet diep genoeg doorvragen, bereiken het niveau niet waarbij VMI en engineering support relevant worden.\n\n**Operationele betekenis:** De concurrentiepositie tegen Würth vereist assortimentsdiepte en servicedifferentiatie — engineering support en VMI zijn precies de argumenten die Würth niet kan evenaren. Tegen Aziatische prijsreferenties zijn TCO en kwaliteitscertificeringsargumenten het antwoord.\n\n**Strategische betekenis:** Het Aziatische prijsreferentieprobleem is structureel en verslechtert naarmate e-inkoop toeneemt. Het opbouwen van een helder narratief rondom Europees supply chain risico, IATF-conformiteit en TCO is de enige duurzame concurrentiële verdediging.\n\n**Aanbevolen managementactie:** Stel een concurrentie-respons playbook op voor Würth, Böllhoff en Aziatische alternatieven. Maak IATF-certificeringsbegeleiding tot standaard gespreksonderwerp bij alle automotive accounts. Monitor concurrentievermeldingen per account per kwartaal."
    },
    proposition: {
      execution: [
        { name: "Leverbetrouwbaarheid & beschikbaarheid", value: 73, trend: 'stable', trendPct: 0, description: "Leveringsprestaties en voorraatbeschikbaarheid worden consistent gecommuniceerd — dit element is goed verankerd in het team." },
        { name: "Technische engineeringsondersteuning", value: 54, trend: 'down', trendPct: 8, description: "Design-in ondersteuning en toepassingsexpertise worden in nauwelijks de helft van gesprekken vermeld, ondanks hun centrale rol als differentiator." },
        { name: "IATF / kwaliteitscertificaten", value: 46, trend: 'up', trendPct: 7, description: "Certificeringsargumenten worden vaker ingezet — automotive klanten reageren positief op deze boodschap." },
        { name: "VMI / consignatieprogramma", value: 38, trend: 'down', trendPct: 9, description: "VMI-programma's nemen af in verkoperscommunicatie ondanks sterke groei in klantvraag — een significante propositiegap." },
        { name: "TCO / leveranciersconsolidatie", value: 29, trend: 'down', trendPct: 6, description: "TCO-argumentatie wordt zelden ingezet, terwijl dit het meest effectieve antwoord is op prijsbezwaren." }
      ],
      resonance: [
        { name: "Leverbetrouwbaarheid & beschikbaarheid", value: 76, trend: 'stable', trendPct: 0, description: "Leverbetrouwbaarheid resoneert altijd — klanten bevestigen het als hun primaire selectiecriterium." },
        { name: "IATF / kwaliteitscertificaten", value: 68, trend: 'up', trendPct: 11, description: "Certificeringsargumenten slaan uitstekend aan bij automotive en machinebouwklanten." },
        { name: "Technische engineeringsondersteuning", value: 64, trend: 'up', trendPct: 9, description: "Engineering support resoneert sterk wanneer gecommuniceerd — klanten reageren met technische vragen." },
        { name: "VMI / consignatieprogramma", value: 58, trend: 'up', trendPct: 14, description: "VMI resoneert zeer sterk bij introductie — klanten tonen direct interesse in implementatiedetails." },
        { name: "TCO / leveranciersconsolidatie", value: 51, trend: 'up', trendPct: 7, description: "TCO-argumenten neutraliseren prijsbezwaren effectief wanneer ingezet." }
      ],
      executionAlerts: ["VMI-programma daalt 9% in uitvoering — snelst groeiende klantbehoefte, minst gecommuniceerd propositionselement", "Engineering support daalt 8% — centrale differentiator verliest stem in gesprekken"],
      resonanceAlerts: ["VMI-resonantie stijgt 14% — hoogste resonantiegroei, bevestigt significant onbenut potentieel", "IATF-certificaatresonantie stijgt 11% — sterkste argument in automotive accounts"],
      executionSummary: "Leverbetrouwbaarheid goed gecommuniceerd. VMI, engineering en TCO zijn structurele gaten — allemaal met hoge resonantie wanneer ingezet.",
      resonanceSummary: "VMI en IATF-certificering hebben de hoogste resonantie — maar beide worden onvoldoende gecommuniceerd.",
      comparison: "**Wat we zien — Propositie-uitvoering:** \n\nLeverbetrouwbaarheid wordt consequent gecommuniceerd en slaat altijd aan — dit is het fundament. Maar de hogere-waarde propositie-elementen verdwijnen uit gesprekken. VMI-programma's worden in minder dan 40% van de gesprekken vermeld ondanks sterk groeiende klantvraag (+16%). Engineering support daalt (−8%) terwijl klanten technische begeleiding steeds meer waarderen. TCO-argumentatie is aanwezig in minder dan 30% van de gesprekken.\n\n**Wat we zien — Klantresonantie:** \n\nAls propositie-elementen worden gecommuniceerd, resoneren ze consistent sterk boven gemiddeld. IATF-certificering (+11% resonantie) en VMI (+14% resonantie) zijn de twee snelst groeiende resonantie-elementen. Het patroon is duidelijk: het probleem is niet dat de propositie niet werkt — het wordt niet genoeg ingezet.\n\n**Wat we zien — Propositiegaten:** \n\nHet grootste gat is tussen VMI-resonantie (58%, sterk groeiend) en VMI-uitvoering (38%, dalend). Verkopers vallen terug op de meest vertrouwde elementen (levering en assortiment) en slaan de gedifferentieerde elementen over die diepere klantkennis vereisen.\n\n**Aanbevolen managementactie:** Implementeer een propositie-checklist voor elk gesprek: leverbetrouwbaarheid, engineering support, IATF-certificering, VMI en TCO moeten allemaal geplande elementen zijn. Stel een VMI-introductiescript op voor directe inzet. Target: VMI-uitvoeringsgraad boven 60% binnen zes weken."
    }
  };
}


function getOperationalDemoAnalytics(lang: string = 'nl') {
  if (lang === 'en') {
    return {
      conversationActivity: {
        absolute: [
          { name: "Total Conversations", value: 138, trend: 'up', trendPct: 7, priority: 'high' },
          { name: "Average Duration", value: 34, trend: 'stable', trendPct: 0, priority: 'medium' },
          { name: "Open Questions", value: 502, trend: 'up', trendPct: 5, priority: 'medium' },
          { name: "Closed Questions", value: 289, trend: 'stable', trendPct: 0, priority: 'low' },
          { name: "Diagnostic Questions", value: 78, trend: 'down', trendPct: 9, priority: 'high' },
          { name: "Follow-up Moments", value: 164, trend: 'down', trendPct: 4, priority: 'medium' },
          { name: "Summaries", value: 112, trend: 'stable', trendPct: 0, priority: 'low' }
        ],
        percentages: [
          { name: "Speak-Listen Ratio", value: 38, trend: 'stable', trendPct: 0, priority: 'low' },
          { name: "Open Questions %", value: 63, trend: 'stable', trendPct: 0, priority: 'medium' },
          { name: "Closed Questions %", value: 37, trend: 'stable', trendPct: 0, priority: 'low' },
          { name: "Diagnostic %", value: 11, trend: 'down', trendPct: 9, priority: 'high' },
          { name: "Follow-up %", value: 16, trend: 'down', trendPct: 4, priority: 'medium' }
        ],
        absoluteAlerts: ["Diagnostic questions dropping 9% — technical needs discovery declining in industrial sales conversations", "Conversation volume up 7% — quality assurance now critical"],
        percentageAlerts: ["Diagnostic % at 11% — severely below target of 20% for complex industrial sales"],
        absoluteSummary: "Volume growing but diagnostic depth collapsing — industrial component conversations need deeper technical probing.",
        percentageSummary: "Speak-listen ratio good, but diagnostic questioning structurally absent from most conversations.",
        comparison: "**What we see:** Conversation volume up 7% but diagnostic questions down 9% to 11% — far below the target of 20% for complex industrial sales. Follow-up moments declining (−4%). The speak-listen ratio of 38% (target 35%) is positive, but increased volume is coming at the cost of diagnostic quality.\n\n**Probable cause:** In technical industrial sales, diagnostic questions require deep product and application knowledge — salespeople need to ask about production processes, component failure consequences, certification requirements, and supplier risk. Under time pressure, salespeople stick to surface-level questions about current supplier and price, skipping the technical probing that differentiates consultative selling from transactional selling.\n\n**Operational impact:** Without diagnostic questions, critical buying triggers remain hidden: production line stoppage risk, IATF certification pressure, quality incidents at current suppliers, and upcoming model launches. These are precisely the triggers that create urgency and justify premium pricing. Salespeople who miss them are competing on price alone.\n\n**Strategic impact:** Industrial component sales depends on consultative differentiation. A team that asks fewer diagnostic questions progressively loses its ability to position engineering support, VMI programs, and IATF certification guidance as relevant solutions.\n\n**Recommended management action:** Introduce a minimum of 3 diagnostic questions per conversation as a mandatory coaching KPI: production process, quality requirements, and supplier risk. Provide a technical question framework per customer segment. Target: diagnostic % to 16% within six weeks."
      },
      picaPerformance: {
        phaseScores: [
          { name: "Proposition", value: 74, trend: 'stable', trendPct: 0, priority: 'low', description: "Salespeople open conversations well — they introduce themselves and the company, give a brief product range overview, and explain they will ask questions. The goal question to the customer is missing in a third of conversations." },
          { name: "Investigation", value: 43, trend: 'down', trendPct: 7, priority: 'high', description: "Salespeople understand the customer's role and the company's products, but rarely ask about production consequences of component failures, quality certification requirements, or the impact of delivery problems. The technical depth needed for industrial sales is missing." },
          { name: "Convincing", value: 62, trend: 'stable', trendPct: 0, priority: 'medium', description: "Salespeople link delivery reliability and range well to customer needs, but rarely connect VMI programs, IATF certifications, or TCO arguments to discovered needs. Arguments are often generic rather than targeted." },
          { name: "Agreement", value: 67, trend: 'down', trendPct: 4, priority: 'medium', description: "Salespeople request follow-up but agreements are often vague — sample requests without a committed delivery date, technical visits without a fixed appointment. Commitment-closing is underdeveloped." }
        ],
        phaseDetails: [
          { phase: 1, metrics: [
            { key: "breakTheIce", value: 82 }, { key: "salesPitch", value: 77 },
            { key: "goalQuestion", value: 64 }, { key: "expectationMgt", value: 66 }
          ]},
          { phase: 2, metrics: [
            { key: "contactPerson", value: 71 }, { key: "company", value: 67 },
            { key: "cooperation", value: 52 }, { key: "consequences", value: 27 },
            { key: "cure", value: 25 }, { key: "deepQuestioning", value: 31 },
            { key: "customerType", value: 48 }
          ]},
          { phase: 3, metrics: [
            { key: "uspUbrLink", value: 61 }, { key: "result", value: 55 },
            { key: "acknowledgement", value: 68 }
          ]},
          { phase: 4, metrics: [
            { key: "agreement", value: 67 }
          ]}
        ],
        phaseAlerts: ["Investigation down 7% — salespeople understand the customer but not the production and quality consequences that create buying urgency", "Agreement down 4% — commitment is requested but rarely formalized with concrete date and action"],
        phaseSummary: "Opening and pitch solid. Customer needs investigation too shallow — production consequences and IATF needs never reached.",
        subskillSummary: "Technical investigation depth is the core gap — consequences and cure metrics severely underdeveloped.",
        comparison: "**What we see — conversation structure:** \n\nSalespeople open conversations well in industrial accounts: they introduce themselves, give a range overview, and explain their purpose. This is consistent across the team. But quality drops sharply in the investigation phase. Salespeople learn who they are speaking to and what the company makes, but they stop there. They never ask: what happens if a component fails on your production line? What are your IATF certification obligations? Which components are most critical for your continuity? Without these answers, everything that follows is generic.\n\n**What we see — specific behaviors:** \n\nThe goal question — a focused question about what the customer wants to achieve in the conversation — is missing in a third of conversations. In the investigation phase, salespeople ask about current supplier and ordering frequency, but almost never probe into production consequences of supply problems, quality certification requirements, or the cost implications of component failures. These are the exact questions that transform a price conversation into a value conversation. In the agreement phase, 'sample order' and 'technical visit' are frequently mentioned, but without a concrete date or commitment — the follow-up floats rather than being anchored in a specific action."
      },
      dealHealth: {
        leadWarmth: [
          { name: "Hot Leads", value: 25, trend: 'down', trendPct: 9, priority: 'high' },
          { name: "Warm Leads", value: 48, trend: 'up', trendPct: 6, priority: 'medium' },
          { name: "Cold Leads", value: 65, trend: 'up', trendPct: 13, priority: 'high' }
        ],
        dealScores: [
          { name: "Conversion Chance", value: 64, trend: 'stable', trendPct: 0, priority: 'low' },
          { name: "Urgency Score", value: 51, trend: 'down', trendPct: 8, priority: 'high' },
          { name: "Interest Score", value: 74, trend: 'up', trendPct: 4, priority: 'low' },
          { name: "Intention Score", value: 58, trend: 'down', trendPct: 5, priority: 'medium' }
        ],
        warmthAlerts: ["Cold leads up 13% — pipeline health deteriorating rapidly", "Hot leads down 9% — active buying opportunities declining"],
        dealScoreAlerts: ["Urgency score down 8% — production urgency triggers not being activated in conversations"],
        warmthSummary: "Pipeline cooling rapidly: cold leads growing, hot leads declining.",
        dealScoreSummary: "Customer interest strong but urgency and intention are collapsing — the bridge to decision is broken.",
        comparison: "**What we see:** Cold leads up 13% to 47% of the pipeline while hot leads down 9% to 18%. Urgency score down 8% to 51% — the critical warning metric. Interest score (74%, +4%) remains positive but is not translating to intention (58%, −5%).\n\n**Probable cause:** Industrial sales urgency is driven by specific production events: supplier delivery failures, IATF audit findings, quality incidents, and model launches. Salespeople are not asking enough diagnostic questions to discover these triggers. Without trigger discovery, every account feels 'interested but not urgent' — and interest without urgency means cold pipeline.\n\n**Operational impact:** A pipeline with 47% cold leads means the majority of time is spent in accounts that are not ready to decide. As the hot lead count drops, the team needs proportionally more conversations to maintain output.\n\n**Strategic impact:** Industrial customers who are 'warm but cold' will inevitably be picked up by competitors who call at the right moment. The window for Essentra is when a delivery failure occurs, a quality NCR is raised, or a model launch is approaching.\n\n**Recommended management action:** Introduce urgency trigger questioning as a mandatory element: in every conversation, ask specifically about delivery reliability of current supplier, IATF audit status, quality incidents, and upcoming model launches. Build an urgency map per account. Target: hot leads back above 25% within Q2."
      },
      teamInsights: {
        absolute: [
          { name: "Avg Team PICA", value: 62, trend: 'down', trendPct: 5, priority: 'high' },
          { name: "Norm Achievement", value: 74, trend: 'down', trendPct: 4, priority: 'medium' },
          { name: "Clear Next Steps", value: 60, trend: 'down', trendPct: 8, priority: 'high' },
          { name: "Resistance Handled", value: 54, trend: 'stable', trendPct: 0, priority: 'medium' }
        ],
        percentages: [
          { name: "Norm Achieved %", value: 74, trend: 'down', trendPct: 4, priority: 'medium' },
          { name: "Clear Next Steps %", value: 60, trend: 'down', trendPct: 8, priority: 'high' },
          { name: "Resistance Correct %", value: 68, trend: 'stable', trendPct: 0, priority: 'medium' }
        ],
        uspOverview: [
          { name: "Delivery Reliability", value: 45, relevance: "high", trend: 'stable', trendPct: 0, priority: 'low' },
          { name: "Technical Support", value: 37, relevance: "high", trend: 'down', trendPct: 4, priority: 'medium' },
          { name: "Product Range Breadth", value: 31, relevance: "medium", trend: 'stable', trendPct: 0, priority: 'low' },
          { name: "Quality Certifications", value: 24, relevance: "high", trend: 'down', trendPct: 6, priority: 'high' },
          { name: "VMI Service", value: 16, relevance: "high", trend: 'down', trendPct: 9, priority: 'high' }
        ],
        absoluteAlerts: ["Next step discipline down 8% — pipeline predictability at critical risk", "Team PICA down 5% — broad quality decline across industrial sales team"],
        uspAlerts: ["VMI service mentions down 9% — highest-resonance differentiator losing voice", "Quality certifications down 6% — IATF positioning weakening in key automotive accounts"],
        absoluteSummary: "Next step discipline and PICA score declining — industrial sales quality deteriorating across the team.",
        uspSummary: "Delivery reliability stable but VMI and certifications declining — the high-value differentiators are disappearing.",
        comparison: "**What we see:** Clear next steps down 8% to 60%, team PICA down 5% to 62%. VMI service mentions declining 9% and quality certifications declining 6% as USPs.\n\n**Probable cause:** The pattern mirrors the diagnostic questioning decline: salespeople who don't discover technical needs can't link VMI programs, IATF certifications, and engineering support to a customer problem. The result is a conversation that stays at the delivery-and-range level while the differentiating USPs remain invisible.\n\n**Operational impact:** Declining next steps (−8%) combined with declining USP breadth means conversations are both less deep and less likely to result in specific commitments. The VMI decline (−9%) is especially concerning: VMI is the highest-resonance proposition element, and its disappearance directly weakens conversion rates.\n\n**Strategic impact:** A team that systematically under-communicates VMI and IATF certification is competing primarily on delivery and price — exactly the battle that Würth and Asian alternatives are best positioned to win. Restoring VMI and certification to every conversation is a commercial necessity.\n\n**Recommended management action:** Implement weekly USP tracking per salesperson: VMI and IATF certification must appear in conversation reports. Link next step discipline to deal status progression in CRM. Coaching priority: technical questioning → VMI introduction → certification positioning."
      },
      resistanceNeeds: {
        resistances: [
          { name: "Price vs. Asian Alternatives", value: 41, trend: 'up', trendPct: 14, priority: 'high' },
          { name: "Satisfied with Current Supplier", value: 32, trend: 'stable', trendPct: 0, priority: 'medium' },
          { name: "MOQ Too High", value: 25, trend: 'up', trendPct: 6, priority: 'medium' },
          { name: "Custom Component Lead Time", value: 19, trend: 'stable', trendPct: 0, priority: 'low' },
          { name: "Unfamiliar with Full Range", value: 13, trend: 'down', trendPct: 4, priority: 'low' }
        ],
        triggers: [
          { name: "Supplier Delivery Failure", value: 43, trend: 'up', trendPct: 11, priority: 'high' },
          { name: "IATF Certification Requirement", value: 36, trend: 'up', trendPct: 8, priority: 'high' },
          { name: "New Product Line / Model Launch", value: 31, trend: 'up', trendPct: 5, priority: 'medium' },
          { name: "Quality Incident / NCR at Current Supplier", value: 29, trend: 'up', trendPct: 9, priority: 'high' },
          { name: "Procurement Consolidation Project", value: 24, trend: 'stable', trendPct: 0, priority: 'medium' }
        ],
        resistanceAlerts: ["Price vs. Asian alternatives up 14% — TCO argumentation deployment critical and urgent", "MOQ resistance up 6% — commercial barrier at early account development stage"],
        triggerAlerts: ["Supplier delivery failure trigger up 11% — highest opportunity signal, must be probed in every account", "Quality incident/NCR trigger up 9% — active buying event, immediate response required"],
        resistanceSummary: "Price vs. Asia dominates and is rising — TCO argumentation must be deployed systematically.",
        triggerSummary: "Supplier failure and IATF certification are the two strongest buying triggers — probe for them proactively.",
        comparison: "**What we see:** Price vs. Asian alternatives is the dominant resistance at 33% and rising 14%. Satisfaction with current supplier (26%) is stable but represents a structural barrier. MOQ resistance growing (+6%). Simultaneously, supplier delivery failure is growing strongly as a trigger (+11%) and IATF certification pressure growing (+8%).\n\n**Probable cause:** Price resistance is high because salespeople are not deploying TCO argumentation. 'Satisfied with current supplier' resistance signals that salespeople are not discovering the latent dissatisfaction — delivery reliability issues, quality concerns, certification gaps — because diagnostic questions are too few and too shallow.\n\n**Operational impact:** The growing supplier delivery failure trigger (+11%) and quality NCR trigger (+9%) are the most powerful sales opportunities in industrial component accounts. These are moments when customers are actively looking for alternatives. Salespeople who are not proactively asking about delivery performance and quality incidents are missing these buying windows entirely.\n\n**Strategic impact:** Customers under IATF certification pressure must use certified European suppliers and are far less price-sensitive in that decision. This customer segment is structurally underserviced because salespeople don't reach the certification conversation.\n\n**Recommended management action:** Train salespeople to systematically probe for the five buying triggers in every account visit. Develop a TCO counter-argument script for Asian price comparisons. Treat IATF certification as a mandatory discovery question in all automotive and Tier 1 accounts."
      },
      nextStepDiscipline: {
        absolute: [
          { name: "With Clear Next Step", value: 88, trend: 'down', trendPct: 7, priority: 'high' },
          { name: "Without Next Step", value: 50, trend: 'up', trendPct: 16, priority: 'high' },
          { name: "SMART Next Steps", value: 47, trend: 'down', trendPct: 6, priority: 'medium' }
        ],
        percentages: [
          { name: "Correctly Formulated %", value: 58, trend: 'stable', trendPct: 0, priority: 'medium' },
          { name: "Followed Up %", value: 76, trend: 'up', trendPct: 3, priority: 'low' }
        ],
        absoluteAlerts: ["Conversations without next step up 16% — critical pipeline leak in industrial sales", "SMART next steps down 6% — commitments too vague to drive action"],
        percentageAlerts: [],
        absoluteSummary: "Next step discipline deteriorating sharply — 36% of all conversations end without a concrete follow-up commitment.",
        percentageSummary: "Follow-up rate improving slightly but SMART formulation well below standard.",
        comparison: "**What we see:** Conversations without a next step up 16% — now 50 of 138 conversations (36%) end without a concrete follow-up. With clear next step down 7%. SMART formulation down 6% to 47%. Positive: follow-up rate improved slightly to 76%.\n\n**Probable cause:** In industrial component sales, follow-up commitments are often 'sample order pending' or 'technical visit to be planned' — inherently vague formulations that lack the date and action owner that make them binding. Salespeople end conversations once the content discussion is complete, without transforming the intent into a concrete commitment. The 16% increase is particularly alarming given that industrial sales cycles are 8-16 weeks.\n\n**Operational impact:** Every conversation without a next step is a pipeline leak. At 36%, more than a third of all sales conversations end without an actionable commitment. This directly translates to forecast uncertainty and quarter-end pressure.\n\n**Strategic impact:** Delivery reliability is Essentra's core value proposition — but next step discipline is the operational equivalent for the sales team. A team that promises reliability to customers but cannot reliably close conversations with concrete commitments sends an inconsistent signal.\n\n**Recommended management action:** Implement a mandatory closing protocol for every visit: a sample request must include a delivery date, a technical visit must have a calendar date, a proposal must have a response deadline. Train the team on SMART formulation. Target: conversations without next step below 20% within Q2."
      },
      dmuInsights: {
        dmuMentioned: true,
        decisionProcessClear: false,
        stakeholders: [
          { name: "Purchasing Manager", role: "decision-maker", mentioned: true },
          { name: "Technical Engineer / Designer", role: "influencer", mentioned: true },
          { name: "Production Manager", role: "user", mentioned: false },
          { name: "Quality Manager", role: "influencer", mentioned: false }
        ],
        dmuClarity: 54,
        dmuAlerts: ["Production manager not identified in 71% of conversations — key user stakeholder creating blind spot", "Quality manager missing in 68% of conversations — critical for IATF certification decisions"],
        dmuSummary: "DMU mapping incomplete — quality and production roles systematically missed, creating late-stage objection risk.",
        comparison: "**What we see:** DMU mapping occurs in 64% of conversations (target 80%). Purchasing manager and technical engineer are mapped consistently. Production manager is identified in only 29% of conversations. Quality manager is mapped in only 32% of conversations — despite being the primary stakeholder in IATF certification decisions.\n\n**Probable cause:** Salespeople call primarily on purchasing managers and occasionally on technical engineers — the most accessible contacts. Production managers and quality managers require a specific reason to involve: a delivery risk concern, a quality audit, or a certification requirement. Without diagnostic questions that surface these topics, there is no reason to ask for the meeting.\n\n**Operational impact:** The quality manager is the key decision-maker for IATF certification compliance — the most powerful buying trigger in automotive accounts. A salesperson who never meets the quality manager cannot position IATF certification guidance as a differentiator, even if it is the most relevant value proposition for that account.\n\n**Strategic impact:** In automotive Tier 1 and Tier 2 accounts, the buying decision for certified components involves quality, production, and purchasing jointly. A salesperson who maps only purchasing is working with one-third of the relevant DMU.\n\n**Recommended management action:** Add quality manager and production manager to the mandatory DMU checklist for all automotive and production-critical accounts. Create a specific value proposition for each DMU role: purchasing (TCO and consolidation), engineering (design-in support and range), quality (IATF certification), production (VMI and delivery reliability). Target: DMU mapping rate above 75% within Q2."
      },
      uspMentions: {
        usps: [
          { name: "Delivery Reliability", value: 45, relevance: "high", trend: 'stable', trendPct: 0, priority: 'low' },
          { name: "Technical Support", value: 37, relevance: "high", trend: 'down', trendPct: 4, priority: 'medium' },
          { name: "Product Range Breadth", value: 31, relevance: "medium", trend: 'stable', trendPct: 0, priority: 'low' },
          { name: "Quality Certifications", value: 24, relevance: "high", trend: 'down', trendPct: 6, priority: 'high' },
          { name: "VMI Service", value: 16, relevance: "high", trend: 'down', trendPct: 9, priority: 'high' }
        ],
        uspAlerts: ["VMI service mentions down 9% — highest-resonance differentiator systematically underused", "Quality certifications down 6% — IATF positioning weakening despite growing customer demand"],
        uspSummary: "Delivery reliability stable but VMI and certifications declining — value proposition is narrowing to its weakest elements.",
        comparison: "**What we see:** Delivery reliability (29%) and product range breadth (20%) are stable and together account for 49% of USP mentions. Technical support down 4% to 24%. Quality certifications down 6% to 15%. VMI service down 9% to 10% — despite being the proposition element with the highest and fastest-growing customer resonance.\n\n**Probable cause:** Salespeople communicate what they are most comfortable with — delivery and range are the foundation USPs that require no customer discovery to mention. VMI, certification, and engineering support require a customer problem to link to. This is the direct consequence of insufficient diagnostic questioning.\n\n**Operational impact:** The concentration on two foundation USPs creates a proposition indistinguishable from Würth's. VMI, quality certifications, and engineering support are the USPs that Würth cannot match and that Asian alternatives structurally cannot provide. By not communicating them, salespeople are voluntarily giving up their competitive advantage.\n\n**Strategic impact:** VMI at 10% of USP mentions is a significant structural failure: the highest-demand proposition element (growing +16% in customer needs) and the highest-resonance element (58% resonance when mentioned) is being communicated in barely one in ten conversations.\n\n**Recommended management action:** Introduce a conversation template that requires VMI and IATF certification to be raised in every conversation with automotive, machine building, or high-volume manufacturing customers. Create a VMI introduction script. Track VMI mention rate per salesperson as a weekly coaching metric."
      }
    };
  }

  if (lang === 'de') {
    return {
      conversationActivity: {
        absolute: [
          { name: "Gesamtgespräche", value: 138 },
          { name: "Durchschnittliche Dauer", value: 34 },
          { name: "Offene Fragen", value: 502 },
          { name: "Geschlossene Fragen", value: 289 },
          { name: "Diagnostische Fragen", value: 78 },
          { name: "Nachfass-Momente", value: 164 },
          { name: "Zusammenfassungen", value: 112 }
        ],
        percentages: [
          { name: "Sprech-Hör-Verhältnis", value: 38 },
          { name: "Offene Fragen %", value: 63 },
          { name: "Geschlossene Fragen %", value: 41 },
          { name: "Diagnose %", value: 11 },
          { name: "Nachfass %", value: 16 }
        ],
        comparison: "Das Gesprächsvolumen wächst 7%, aber diagnostische Fragen sinken 9% auf 11% — weit unter dem Ziel von 20% für komplexe industrielle Verkäufe. Im technischen Industrievertrieb erfordern diagnostische Fragen tiefes Produkt- und Anwendungswissen: Fragen zu Produktionsprozessen, Konsequenzen von Komponentenausfällen, Zertifizierungsanforderungen und Lieferantenrisiken. Ohne diagnostische Fragen bleiben kritische Kaufauslöser verborgen: Produktionsstillstandrisiken, IATF-Zertifizierungsdruck, Qualitätsvorfälle und bevorstehende Modellstarts — genau die Auslöser, die Dringlichkeit erzeugen und Premiumpreise rechtfertigen. Empfehlung: Mindestens 3 diagnostische Fragen pro Gespräch als Pflicht-KPI einführen."
      },
      picaPerformance: {
        phaseScores: [
          { name: "Proposition", value: 74, trend: 'stable', trendPct: 0, description: "Verkäufer eröffnen Gespräche gut — Vorstellung, Sortimentsüberblick und Gesprächszweck sind eingebettet. Die Zielfrage an den Kunden fehlt jedoch in einem Drittel der Gespräche." },
          { name: "Analyse", value: 43, trend: 'down', trendPct: 7, description: "Verkäufer verstehen die Rolle des Kunden und die Produkte des Unternehmens, fragen aber selten nach Produktionskonsequenzen von Komponentenausfällen oder IATF-Zertifizierungsanforderungen." },
          { name: "Überzeugung", value: 62, trend: 'stable', trendPct: 0, description: "Lieferzuverlässigkeit und Sortiment werden gut verknüpft, aber VMI-Programme, IATF-Zertifizierungen und TCO-Argumente werden selten mit entdeckten Bedürfnissen verbunden." },
          { name: "Abschluss", value: 67, trend: 'down', trendPct: 4, description: "Folgegespräche werden angefragt, aber Vereinbarungen sind oft vage — Musterbestellungen ohne festes Lieferdatum, Technikbesuche ohne konkreten Termin." }
        ],
        phaseDetails: [
          { phase: 1, metrics: [
            { key: "breakTheIce", value: 82 }, { key: "salesPitch", value: 77 },
            { key: "goalQuestion", value: 64 }, { key: "expectationMgt", value: 66 }
          ]},
          { phase: 2, metrics: [
            { key: "contactPerson", value: 71 }, { key: "company", value: 67 },
            { key: "cooperation", value: 52 }, { key: "consequences", value: 27 },
            { key: "cure", value: 25 }, { key: "deepQuestioning", value: 31 },
            { key: "customerType", value: 48 }
          ]},
          { phase: 3, metrics: [
            { key: "uspUbrLink", value: 61 }, { key: "result", value: 55 },
            { key: "acknowledgement", value: 68 }
          ]},
          { phase: 4, metrics: [
            { key: "agreement", value: 67 }
          ]}
        ],
        comparison: "Verkäufer eröffnen Gespräche in industriellen Konten gut: Vorstellung, Sortimentsüberblick und Gesprächszweck sind konsistent vorhanden. Aber die Qualität sinkt schnell in der Analysephase. Verkäufer erfahren, wen sie vor sich haben und was das Unternehmen produziert, hören aber dort auf. Sie fragen nie: Was passiert, wenn eine Komponente auf Ihrer Produktionslinie ausfällt? Was sind Ihre IATF-Zertifizierungspflichten? Welche Komponenten sind kritischsten für Ihre Kontinuität? Ohne diese Antworten ist alles, was folgt, generisch. In der Abschlussphase werden 'Musterbestellung' und 'Technikerbesuch' häufig erwähnt, aber ohne konkretes Datum oder Verpflichtung."
      },
      dealHealth: {
        leadWarmth: [
          { name: "Heiße Leads", value: 25 },
          { name: "Warme Leads", value: 48 },
          { name: "Kalte Leads", value: 65 }
        ],
        dealScores: [
          { name: "Konversionschance", value: 64 },
          { name: "Dringlichkeitswert", value: 51 },
          { name: "Interessenwert", value: 74 },
          { name: "Absichtswert", value: 58 }
        ],
        comparison: "Kalte Leads steigen 13% auf 47% der Pipeline, während heiße Leads auf 18% sinken. Die Dringlichkeitsscore von 51% ist das kritische Warnsignal. Industrielle Verkaufsdringlichkeit wird durch spezifische Produktionsereignisse ausgelöst: Lieferausfälle, IATF-Auditbefunde, Qualitätsvorfälle und Modellstarts. Verkäufer stellen nicht genug diagnostische Fragen, um diese Auslöser zu entdecken. Interesseskore (74%) zeigt, dass Kunden engagiert sind — das Defizit liegt nicht im Interesse, sondern in der Überführung in Entscheidungsdruck. Empfehlung: Urgency-Trigger-Fragen als Pflichtbestandteil jedes Gesprächs einführen."
      },
      teamInsights: {
        absolute: [
          { name: "Durchschn. Team PICA", value: 62 },
          { name: "Norm Erreicht", value: 74 },
          { name: "Klare Nächste Schritte", value: 60 },
          { name: "Widerstände Erkannt", value: 54 }
        ],
        percentages: [
          { name: "Norm Erreicht %", value: 74 },
          { name: "Klare Nächste Schritte %", value: 60 },
          { name: "Widerstand Korrekt %", value: 68 }
        ],
        uspOverview: [
          { name: "Lieferzuverlässigkeit", value: 45, relevance: "high" },
          { name: "Technischer Support", value: 37, relevance: "high" },
          { name: "Produktsortimentsbreite", value: 31, relevance: "medium" },
          { name: "Qualitätszertifizierungen", value: 24, relevance: "high" },
          { name: "VMI-Service", value: 16, relevance: "high" }
        ],
        comparison: "Klare Nächste Schritte sinken 8% auf 60%, Team PICA sinkt 5% auf 62%. VMI-Service-Nennungen sinken 9% und Qualitätszertifizierungen sinken 6% als USPs. Das Muster spiegelt den Rückgang diagnostischer Fragen wider: Verkäufer, die technische Bedürfnisse nicht entdecken, können VMI-Programme, IATF-Zertifizierungen und Engineering-Support nicht mit einem Kundenproblem verknüpfen. Ein Team, das VMI und IATF systematisch nicht kommuniziert, konkurriert hauptsächlich über Lieferung und Preis — genau der Wettbewerb, den Würth und asiatische Alternativen am besten gewinnen können."
      },
      resistanceNeeds: {
        resistances: [
          { name: "Preis vs. asiatische Alternativen", value: 41 },
          { name: "Zufrieden mit aktuellem Lieferanten", value: 32 },
          { name: "Mindestbestellmenge zu hoch", value: 25 },
          { name: "Lieferzeit Sonderanfertigungen", value: 19 },
          { name: "Unbekannt mit vollem Sortiment", value: 13 }
        ],
        triggers: [
          { name: "Lieferausfall aktueller Lieferant", value: 43 },
          { name: "IATF-Zertifizierungsanforderung", value: 36 },
          { name: "Neue Produktlinie / Modellstart", value: 31 },
          { name: "Qualitätsvorfall / NCR beim Lieferanten", value: 29 },
          { name: "Beschaffungskonsolidierungsprojekt", value: 24 }
        ],
        comparison: "Preis vs. asiatische Alternativen dominiert mit 33% und steigt 14%. Zufriedenheit mit aktuellem Lieferanten (26%) ist stabil aber strukturell eine Barriere. Gleichzeitig wächst der Lieferausfall als Kaufauslöser stark (+11%) und IATF-Zertifizierungsdruck wächst (+8%) — beide stellen aktive Kaufereignisse dar. Preiswiderstände sind hoch, weil Verkäufer keine TCO-Argumentation einsetzen. Kunden unter IATF-Zertifizierungsdruck müssen zertifizierte europäische Lieferanten nutzen und sind für diese Entscheidung weit weniger preissensibel — dieses Kundensegment wird strukturell unterversorgt."
      },
      nextStepDiscipline: {
        absolute: [
          { name: "Mit Klarem Nächsten Schritt", value: 88 },
          { name: "Ohne Nächsten Schritt", value: 50 },
          { name: "SMART Nächste Schritte", value: 47 }
        ],
        percentages: [
          { name: "Korrekt Formuliert %", value: 58 },
          { name: "Nachverfolgt %", value: 76 }
        ],
        comparison: "Gespräche ohne nächsten Schritt steigen 16% — jetzt 50 von 138 Gesprächen (36%) enden ohne konkrete Folgevereinbarung. Im industriellen Komponentenvertrieb sind Folgevereinbarungen oft 'Musterbestellung ausstehend' oder 'Technikerbesuch zu planen' — inhärent vage Formulierungen, die das Datum und den Aktionsverantwortlichen fehlen. Bei industriellen Verkaufszyklen von 8-16 Wochen überträgt sich jeder verlorene Schwung direkt in Prognoseunzuverlässigkeit. Empfehlung: Verbindliches Abschlussprotokoll einführen — jeder Besuch endet mit Datum, Aktion und Verantwortlichem."
      },
      dmuInsights: {
        dmuMentioned: true,
        decisionProcessClear: false,
        stakeholders: [
          { name: "Einkaufsleiter", role: "Entscheider", mentioned: true },
          { name: "Technischer Ingenieur / Konstrukteur", role: "Beeinflusser", mentioned: true },
          { name: "Produktionsleiter", role: "Benutzer", mentioned: false },
          { name: "Qualitätsmanager", role: "Beeinflusser", mentioned: false }
        ],
        dmuClarity: 54,
        comparison: "DMU-Mapping findet in 64% der Gespräche statt (Ziel 80%). Einkaufsleiter und technischer Ingenieur werden konsistent erfasst. Der Produktionsleiter wird in nur 29% der Gespräche identifiziert. Der Qualitätsmanager wird in nur 32% der Gespräche erfasst — obwohl er der primäre Stakeholder bei IATF-Zertifizierungsentscheidungen ist. In Automotive-Tier-1- und Tier-2-Konten umfasst die Kaufentscheidung für zertifizierte Komponenten Qualität, Produktion und Einkauf gemeinsam. Empfehlung: Qualitätsmanager und Produktionsleiter zur Pflicht-DMU-Checkliste für alle Automobilkonten hinzufügen."
      },
      uspMentions: {
        usps: [
          { name: "Lieferzuverlässigkeit", value: 45, relevance: "high" },
          { name: "Technischer Support", value: 37, relevance: "high" },
          { name: "Produktsortimentsbreite", value: 31, relevance: "medium" },
          { name: "Qualitätszertifizierungen", value: 24, relevance: "high" },
          { name: "VMI-Service", value: 16, relevance: "high" }
        ],
        comparison: "Lieferzuverlässigkeit (29%) und Sortimentsbreite (20%) sind stabil und zusammen für 49% der USP-Nennungen verantwortlich. Qualitätszertifizierungen sinken 6% auf 15%. VMI-Service sinkt 9% auf 10% — trotz höchster und am schnellsten wachsender Kundenresonanz. Verkäufer kommunizieren, womit sie am vertrautesten sind — Lieferung und Sortiment sind die Basis-USPs, die keine Kundenentdeckung erfordern. VMI bei 10% der USP-Nennungen ist ein erhebliches strukturelles Versagen: das Element mit der höchsten Nachfrage (+16%) und der höchsten Resonanz (58%) wird in kaum einem von zehn Gesprächen kommuniziert."
      }
    };
  }

  if (lang === 'fr') {
    return {
      conversationActivity: {
        absolute: [
          { name: "Total conversations", value: 138 },
          { name: "Durée moyenne", value: 34 },
          { name: "Questions ouvertes", value: 502 },
          { name: "Questions fermées", value: 289 },
          { name: "Questions diagnostiques", value: 78 },
          { name: "Moments de relance", value: 164 },
          { name: "Résumés", value: 112 }
        ],
        percentages: [
          { name: "Ratio parole-écoute", value: 38 },
          { name: "Questions ouvertes %", value: 63 },
          { name: "Questions fermées %", value: 37 },
          { name: "Diagnostique %", value: 11 },
          { name: "Relance %", value: 16 }
        ],
        comparison: "Le volume de conversations progresse de 7%, mais les questions diagnostiques reculent de 9% à 11% — bien en dessous de l'objectif de 20% pour les ventes industrielles complexes. Dans la vente technique industrielle, les questions diagnostiques exigent une connaissance approfondie des produits et des applications. Sans questions diagnostiques, les déclencheurs d'achat critiques restent cachés : risque d'arrêt de ligne, pression IATF, incidents qualité et lancements de modèles. Recommandation : introduire au minimum 3 questions diagnostiques par conversation comme KPI de coaching obligatoire."
      },
      picaPerformance: {
        phaseScores: [
          { name: "Proposition", value: 74, trend: 'stable', trendPct: 0, description: "Les vendeurs ouvrent bien les conversations — présentation, aperçu de la gamme et objectif sont présents. La question-objectif au client manque dans un tiers des conversations." },
          { name: "Investigation", value: 43, trend: 'down', trendPct: 7, description: "Les vendeurs comprennent le rôle du client et les produits de l'entreprise, mais questionnent rarement les conséquences des défaillances de composants sur la production ou les exigences IATF." },
          { name: "Conviction", value: 62, trend: 'stable', trendPct: 0, description: "La fiabilité de livraison et la gamme sont bien liées, mais les programmes VMI, certifications IATF et arguments TCO sont rarement connectés aux besoins découverts." },
          { name: "Conclusion", value: 67, trend: 'down', trendPct: 4, description: "Les suivis sont demandés mais souvent vagues — commandes d'échantillons sans date fixe, visites techniques sans rendez-vous confirmé." }
        ],
        phaseDetails: [
          { phase: 1, metrics: [
            { key: "breakTheIce", value: 82 }, { key: "salesPitch", value: 77 },
            { key: "goalQuestion", value: 64 }, { key: "expectationMgt", value: 66 }
          ]},
          { phase: 2, metrics: [
            { key: "contactPerson", value: 71 }, { key: "company", value: 67 },
            { key: "cooperation", value: 52 }, { key: "consequences", value: 27 },
            { key: "cure", value: 25 }, { key: "deepQuestioning", value: 31 },
            { key: "customerType", value: 48 }
          ]},
          { phase: 3, metrics: [
            { key: "uspUbrLink", value: 61 }, { key: "result", value: 55 },
            { key: "acknowledgement", value: 68 }
          ]},
          { phase: 4, metrics: [
            { key: "agreement", value: 67 }
          ]}
        ],
        comparison: "Les vendeurs ouvrent bien les conversations dans les comptes industriels : présentation, aperçu gamme et objet de visite sont cohérents. Mais la qualité chute rapidement en phase d'investigation. Les vendeurs n'interrogent jamais : que se passe-t-il si un composant tombe en panne sur votre ligne ? Quelles sont vos obligations IATF ? Quels composants sont les plus critiques ? Sans ces réponses, tout ce qui suit est générique. En phase de conclusion, 'commande d'échantillons' et 'visite technique' sont fréquemment mentionnés mais sans date concrète ni engagement."
      },
      dealHealth: {
        leadWarmth: [
          { name: "Leads chauds", value: 25 },
          { name: "Leads tièdes", value: 48 },
          { name: "Leads froids", value: 65 }
        ],
        dealScores: [
          { name: "Chance de conversion", value: 64 },
          { name: "Score d'urgence", value: 51 },
          { name: "Score d'intérêt", value: 74 },
          { name: "Score d'intention", value: 58 }
        ],
        comparison: "Les leads froids progressent de 13% à 47% du pipeline tandis que les leads chauds reculent à 18%. Le score d'urgence de 51% est l'indicateur d'alerte critique. L'urgence dans la vente industrielle est déclenchée par des événements spécifiques : défaillances de livraison fournisseur, conclusions d'audit IATF, incidents qualité et lancements de modèles. Les vendeurs ne posent pas assez de questions diagnostiques pour découvrir ces déclencheurs. Les clients sous pression IATF doivent utiliser des fournisseurs européens certifiés et sont beaucoup moins sensibles au prix dans cette décision."
      },
      teamInsights: {
        absolute: [
          { name: "PICA moy. équipe", value: 62 },
          { name: "Norme atteinte", value: 74 },
          { name: "Prochaines étapes claires", value: 60 },
          { name: "Résistances traitées", value: 54 }
        ],
        percentages: [
          { name: "Norme atteinte %", value: 74 },
          { name: "Prochaines étapes claires %", value: 60 },
          { name: "Résistances correctes %", value: 68 }
        ],
        uspOverview: [
          { name: "Fiabilité de livraison", value: 45, relevance: "high" },
          { name: "Support technique", value: 37, relevance: "high" },
          { name: "Largeur de gamme", value: 31, relevance: "medium" },
          { name: "Certifications qualité", value: 24, relevance: "high" },
          { name: "Service VMI", value: 16, relevance: "high" }
        ],
        comparison: "Les prochaines étapes claires reculent de 8% à 60%, le PICA équipe recule de 5% à 62%. Les mentions VMI diminuent de 9% et les certifications qualité de 6%. Un équipe qui ne communique pas systématiquement le VMI et la certification IATF concurrence principalement sur la livraison et le prix — exactement le combat que Würth et les alternatives asiatiques sont les mieux placés pour gagner."
      },
      resistanceNeeds: {
        resistances: [
          { name: "Prix vs. alternatives asiatiques", value: 41 },
          { name: "Satisfait du fournisseur actuel", value: 32 },
          { name: "Quantité minimale trop élevée", value: 25 },
          { name: "Délai composants personnalisés", value: 19 },
          { name: "Méconnaissance de la gamme complète", value: 13 }
        ],
        triggers: [
          { name: "Défaillance livraison fournisseur actuel", value: 43 },
          { name: "Exigence de certification IATF", value: 36 },
          { name: "Nouvelle ligne / lancement modèle", value: 31 },
          { name: "Incident qualité / NCR chez le fournisseur", value: 29 },
          { name: "Projet de consolidation achats", value: 24 }
        ],
        comparison: "Le prix face aux alternatives asiatiques domine avec 33% et progresse de 14%. La satisfaction avec le fournisseur actuel (26%) est stable mais représente une barrière structurelle. Simultanément, la défaillance de livraison progresse fortement (+11%) et la pression IATF progresse (+8%). Les résistances aux prix sont élevées parce que les vendeurs ne déploient pas d'argumentation TCO. Le déclencheur de défaillance de livraison (+11%) et le déclencheur de NCR qualité (+9%) sont les opportunités les plus puissantes — les vendeurs qui ne sondent pas ces événements manquent complètement les fenêtres d'achat."
      },
      nextStepDiscipline: {
        absolute: [
          { name: "Avec prochaine étape claire", value: 88 },
          { name: "Sans prochaine étape", value: 50 },
          { name: "Prochaines étapes SMART", value: 47 }
        ],
        percentages: [
          { name: "Correctement formulé %", value: 58 },
          { name: "Suivi effectué %", value: 76 }
        ],
        comparison: "Les conversations sans prochaine étape progressent de 16% — maintenant 50 des 138 conversations (36%) se terminent sans engagement de suivi concret. Dans la vente de composants industriels, les engagements de suivi sont souvent 'commande d'échantillons en attente' — des formulations vagues qui manquent de date et de responsable. Dans les cycles de vente industrielle de 8-16 semaines, chaque élan perdu se traduit directement en incertitude de prévision. Recommandation : protocole de clôture obligatoire pour chaque visite — date, action et responsable."
      },
      dmuInsights: {
        dmuMentioned: true,
        decisionProcessClear: false,
        stakeholders: [
          { name: "Responsable achats", role: "décideur", mentioned: true },
          { name: "Ingénieur technique / Concepteur", role: "influenceur", mentioned: true },
          { name: "Responsable production", role: "utilisateur", mentioned: false },
          { name: "Responsable qualité", role: "influenceur", mentioned: false }
        ],
        dmuClarity: 54,
        comparison: "La cartographie DMU se fait dans 64% des conversations (objectif 80%). Le responsable achats et l'ingénieur technique sont systématiquement cartographiés. Le responsable production n'est identifié que dans 29% des conversations. Le responsable qualité n'est cartographié que dans 32% — malgré son rôle de principal partie prenante dans les décisions IATF. Dans les comptes Tier 1 et Tier 2 automobile, la décision implique conjointement qualité, production et achats. Un vendeur qui ne cartographie que les achats travaille avec un tiers du DMU pertinent."
      },
      uspMentions: {
        usps: [
          { name: "Fiabilité de livraison", value: 45, relevance: "high" },
          { name: "Support technique", value: 37, relevance: "high" },
          { name: "Largeur de gamme produits", value: 31, relevance: "medium" },
          { name: "Certifications qualité", value: 24, relevance: "high" },
          { name: "Service VMI", value: 16, relevance: "high" }
        ],
        comparison: "Fiabilité de livraison (29%) et largeur de gamme (20%) sont stables et représentent ensemble 49% des mentions USP. Certifications qualité reculent de 6% à 15%. Service VMI recule de 9% à 10% — malgré la résonance client la plus élevée (+14%). Le VMI à 10% des mentions est un échec structurel significatif : l'élément à la plus forte demande (+16%) et à la plus haute résonance (58%) est communiqué dans à peine une conversation sur dix."
      }
    };
  }

  if (lang === 'es') {
    return {
      conversationActivity: {
        absolute: [
          { name: "Total conversaciones", value: 138 },
          { name: "Duración media", value: 34 },
          { name: "Preguntas abiertas", value: 502 },
          { name: "Preguntas cerradas", value: 289 },
          { name: "Preguntas diagnósticas", value: 78 },
          { name: "Momentos de seguimiento", value: 164 },
          { name: "Resúmenes", value: 112 }
        ],
        percentages: [
          { name: "Ratio hablar-escuchar", value: 38 },
          { name: "Preguntas abiertas %", value: 63 },
          { name: "Preguntas cerradas %", value: 37 },
          { name: "Diagnóstico %", value: 11 },
          { name: "Seguimiento %", value: 16 }
        ],
        comparison: "El volumen de conversaciones crece un 7%, pero las preguntas diagnósticas caen un 9% hasta el 11% — muy por debajo del objetivo del 20% para ventas industriales complejas. Sin preguntas diagnósticas, los disparadores de compra críticos permanecen ocultos: riesgo de parada de línea, presión IATF, incidentes de calidad y lanzamientos de modelos. Recomendación: introducir un mínimo de 3 preguntas diagnósticas por conversación como KPI de coaching obligatorio."
      },
      picaPerformance: {
        phaseScores: [
          { name: "Proposición", value: 74, trend: 'stable', trendPct: 0, description: "Los vendedores abren bien las conversaciones — presentación, visión general de la gama y propósito son consistentes. La pregunta-objetivo al cliente falta en un tercio de las conversaciones." },
          { name: "Investigación", value: 43, trend: 'down', trendPct: 7, description: "Los vendedores entienden el papel del cliente y los productos de la empresa, pero raramente preguntan sobre las consecuencias productivas de fallos de componentes o requisitos IATF." },
          { name: "Convicción", value: 62, trend: 'stable', trendPct: 0, description: "La fiabilidad de entrega y la gama se vinculan bien, pero los programas VMI, certificaciones IATF y argumentos TCO raramente se conectan a las necesidades descubiertas." },
          { name: "Acuerdo", value: 67, trend: 'down', trendPct: 4, description: "Se solicitan seguimientos pero los acuerdos son a menudo vagos — pedidos de muestras sin fecha comprometida, visitas técnicas sin cita confirmada." }
        ],
        phaseDetails: [
          { phase: 1, metrics: [
            { key: "breakTheIce", value: 82 }, { key: "salesPitch", value: 77 },
            { key: "goalQuestion", value: 64 }, { key: "expectationMgt", value: 66 }
          ]},
          { phase: 2, metrics: [
            { key: "contactPerson", value: 71 }, { key: "company", value: 67 },
            { key: "cooperation", value: 52 }, { key: "consequences", value: 27 },
            { key: "cure", value: 25 }, { key: "deepQuestioning", value: 31 },
            { key: "customerType", value: 48 }
          ]},
          { phase: 3, metrics: [
            { key: "uspUbrLink", value: 61 }, { key: "result", value: 55 },
            { key: "acknowledgement", value: 68 }
          ]},
          { phase: 4, metrics: [
            { key: "agreement", value: 67 }
          ]}
        ],
        comparison: "Los vendedores abren bien las conversaciones en cuentas industriales. Pero la calidad cae rápidamente en la fase de investigación. Los vendedores nunca preguntan: ¿qué pasa si un componente falla en su línea? ¿Cuáles son sus obligaciones IATF? ¿Qué componentes son más críticos? Sin estas respuestas, todo lo que sigue es genérico. En la fase de acuerdo, 'pedido de muestra' y 'visita técnica' se mencionan frecuentemente, pero sin fecha concreta ni compromiso."
      },
      dealHealth: {
        leadWarmth: [
          { name: "Leads calientes", value: 25 },
          { name: "Leads templados", value: 48 },
          { name: "Leads fríos", value: 65 }
        ],
        dealScores: [
          { name: "Probabilidad de conversión", value: 64 },
          { name: "Puntuación de urgencia", value: 51 },
          { name: "Puntuación de interés", value: 74 },
          { name: "Puntuación de intención", value: 58 }
        ],
        comparison: "Los leads fríos suben un 13% al 47% del pipeline mientras los leads calientes caen al 18%. La puntuación de urgencia de 51% es la métrica de alerta crítica. La urgencia en la venta industrial es impulsada por eventos específicos: fallos de entrega, hallazgos IATF, incidentes de calidad y lanzamientos. Los vendedores no hacen suficientes preguntas diagnósticas para descubrir estos disparadores. Los clientes bajo presión IATF deben usar proveedores europeos certificados y son mucho menos sensibles al precio en esa decisión."
      },
      teamInsights: {
        absolute: [
          { name: "PICA promedio equipo", value: 62 },
          { name: "Norma alcanzada", value: 74 },
          { name: "Próximos pasos claros", value: 60 },
          { name: "Resistencias tratadas", value: 54 }
        ],
        percentages: [
          { name: "Norma alcanzada %", value: 74 },
          { name: "Próximos pasos claros %", value: 60 },
          { name: "Resistencias correctas %", value: 68 }
        ],
        uspOverview: [
          { name: "Fiabilidad de entrega", value: 45, relevance: "high" },
          { name: "Soporte técnico", value: 37, relevance: "high" },
          { name: "Amplitud de gama", value: 31, relevance: "medium" },
          { name: "Certificaciones de calidad", value: 24, relevance: "high" },
          { name: "Servicio VMI", value: 16, relevance: "high" }
        ],
        comparison: "Los próximos pasos claros caen un 8% al 60%, el PICA del equipo cae un 5% al 62%. Las menciones VMI disminuyen un 9% y las certificaciones de calidad un 6%. Un equipo que no comunica sistemáticamente el VMI y la certificación IATF compite principalmente en entrega y precio — exactamente la batalla que Würth y las alternativas asiáticas están mejor posicionados para ganar."
      },
      resistanceNeeds: {
        resistances: [
          { name: "Precio vs. alternativas asiáticas", value: 41 },
          { name: "Satisfecho con proveedor actual", value: 32 },
          { name: "Cantidad mínima demasiado alta", value: 25 },
          { name: "Plazo componentes personalizados", value: 19 },
          { name: "Desconocimiento de la gama completa", value: 13 }
        ],
        triggers: [
          { name: "Fallo de entrega proveedor actual", value: 43 },
          { name: "Requisito de certificación IATF", value: 36 },
          { name: "Nueva línea / lanzamiento de modelo", value: 31 },
          { name: "Incidente de calidad / NCR en proveedor", value: 29 },
          { name: "Proyecto de consolidación de compras", value: 24 }
        ],
        comparison: "El precio frente a alternativas asiáticas domina con el 33% y sube un 14%. La satisfacción con el proveedor actual (26%) es estable pero representa una barrera estructural. El fallo de entrega crece fuertemente como disparador (+11%) y la presión IATF crece (+8%). Las resistencias de precio son altas porque los vendedores no despliegan argumentación TCO. Los vendedores que no sondean proactivamente fallos de entrega e incidentes de calidad pierden completamente las ventanas de compra."
      },
      nextStepDiscipline: {
        absolute: [
          { name: "Con próximo paso claro", value: 88 },
          { name: "Sin próximo paso", value: 50 },
          { name: "Próximos pasos SMART", value: 47 }
        ],
        percentages: [
          { name: "Correctamente formulado %", value: 58 },
          { name: "Seguido %", value: 76 }
        ],
        comparison: "Las conversaciones sin próximo paso suben un 16% — ahora 50 de las 138 conversaciones (36%) terminan sin compromiso de seguimiento concreto. En la venta de componentes industriales, los compromisos de seguimiento son a menudo 'pedido de muestra pendiente' — formulaciones vagues que carecen de fecha y responsable. En ciclos de venta industrial de 8-16 semanas, cada impulso perdido se traduce directamente en incertidumbre de previsión. Recomendación: protocolo de cierre obligatorio para cada visita."
      },
      dmuInsights: {
        dmuMentioned: true,
        decisionProcessClear: false,
        stakeholders: [
          { name: "Responsable de compras", role: "decisor", mentioned: true },
          { name: "Ingeniero técnico / Diseñador", role: "influyente", mentioned: true },
          { name: "Responsable de producción", role: "usuario", mentioned: false },
          { name: "Responsable de calidad", role: "influyente", mentioned: false }
        ],
        dmuClarity: 54,
        comparison: "La cartografía DMU se realiza en el 64% de las conversaciones (objetivo 80%). El responsable de compras y el ingeniero técnico se mapean sistemáticamente. El responsable de producción se identifica en solo el 29% de las conversaciones. El responsable de calidad se mapea solo en el 32% — a pesar de ser el principal stakeholder en las decisiones IATF. En cuentas Tier 1 y Tier 2 del automóvil, la decisión implica conjuntamente calidad, producción y compras. Recomendación: añadir responsable de calidad y producción a la lista DMU obligatoria."
      },
      uspMentions: {
        usps: [
          { name: "Fiabilidad de entrega", value: 45, relevance: "high" },
          { name: "Soporte técnico", value: 37, relevance: "high" },
          { name: "Amplitud de gama de productos", value: 31, relevance: "medium" },
          { name: "Certificaciones de calidad", value: 24, relevance: "high" },
          { name: "Servicio VMI", value: 16, relevance: "high" }
        ],
        comparison: "Fiabilidad de entrega (29%) y amplitud de gama (20%) son estables y representan juntas el 49% de las menciones USP. Certificaciones de calidad caen un 6% al 15%. El servicio VMI cae un 9% al 10% — a pesar de tener la resonancia más alta (+14%). El VMI al 10% de las menciones es un fallo estructural significativo: el elemento con mayor demanda (+16%) y mayor resonancia (58%) se comunica en apenas una de cada diez conversaciones."
      }
    };
  }

  if (lang === 'it') {
    return {
      conversationActivity: {
        absolute: [
          { name: "Totale conversazioni", value: 138 },
          { name: "Durata media", value: 34 },
          { name: "Domande aperte", value: 502 },
          { name: "Domande chiuse", value: 289 },
          { name: "Domande diagnostiche", value: 78 },
          { name: "Momenti di follow-up", value: 164 },
          { name: "Riepiloghi", value: 112 }
        ],
        percentages: [
          { name: "Rapporto parlato-ascolto", value: 38 },
          { name: "Domande aperte %", value: 63 },
          { name: "Domande chiuse %", value: 37 },
          { name: "Diagnostico %", value: 11 },
          { name: "Follow-up %", value: 16 }
        ],
        comparison: "Il volume di conversazioni cresce del 7%, ma le domande diagnostiche calano del 9% all'11% — ben al di sotto dell'obiettivo del 20%. Senza domande diagnostiche, i trigger di acquisto critici rimangono nascosti: rischio di fermo produzione, pressione IATF, incidenti qualità e lanci di modelli. Raccomandazione: introdurre almeno 3 domande diagnostiche per conversazione come KPI di coaching obbligatorio."
      },
      picaPerformance: {
        phaseScores: [
          { name: "Proposizione", value: 74, trend: 'stable', trendPct: 0, description: "I venditori aprono bene le conversazioni — presentazione, panoramica della gamma e scopo sono coerenti. La domanda-obiettivo al cliente manca in un terzo delle conversazioni." },
          { name: "Analisi", value: 43, trend: 'down', trendPct: 7, description: "I venditori capiscono il ruolo del cliente e i prodotti dell'azienda, ma raramente indagano le conseguenze produttive dei guasti dei componenti o i requisiti IATF." },
          { name: "Convinzione", value: 62, trend: 'stable', trendPct: 0, description: "Affidabilità di consegna e gamma sono ben collegate, ma i programmi VMI, le certificazioni IATF e gli argomenti TCO raramente vengono connessi ai bisogni scoperti." },
          { name: "Accordo", value: 67, trend: 'down', trendPct: 4, description: "I follow-up vengono richiesti ma gli accordi sono spesso vaghi — ordini campione senza data impegnata, visite tecniche senza appuntamento confermato." }
        ],
        phaseDetails: [
          { phase: 1, metrics: [
            { key: "breakTheIce", value: 82 }, { key: "salesPitch", value: 77 },
            { key: "goalQuestion", value: 64 }, { key: "expectationMgt", value: 66 }
          ]},
          { phase: 2, metrics: [
            { key: "contactPerson", value: 71 }, { key: "company", value: 67 },
            { key: "cooperation", value: 52 }, { key: "consequences", value: 27 },
            { key: "cure", value: 25 }, { key: "deepQuestioning", value: 31 },
            { key: "customerType", value: 48 }
          ]},
          { phase: 3, metrics: [
            { key: "uspUbrLink", value: 61 }, { key: "result", value: 55 },
            { key: "acknowledgement", value: 68 }
          ]},
          { phase: 4, metrics: [
            { key: "agreement", value: 67 }
          ]}
        ],
        comparison: "I venditori aprono bene le conversazioni nei clienti industriali. Ma la qualità cala rapidamente nella fase di analisi. I venditori non chiedono mai: cosa succede se un componente si guasta sulla linea? Quali sono gli obblighi IATF? Quali componenti sono più critici? Senza queste risposte, tutto ciò che segue è generico. Nella fase di accordo, 'ordine campione' e 'visita tecnica' sono spesso menzionati, ma senza data concreta né impegno."
      },
      dealHealth: {
        leadWarmth: [
          { name: "Lead caldi", value: 25 },
          { name: "Lead tiepidi", value: 48 },
          { name: "Lead freddi", value: 65 }
        ],
        dealScores: [
          { name: "Probabilità di conversione", value: 64 },
          { name: "Punteggio urgenza", value: 51 },
          { name: "Punteggio interesse", value: 74 },
          { name: "Punteggio intenzione", value: 58 }
        ],
        comparison: "I lead freddi salgono del 13% al 47% della pipeline mentre i lead caldi scendono al 18%. Il punteggio urgenza di 51% è la metrica di allerta critica. L'urgenza nelle vendite industriali è guidata da eventi specifici: guasti di consegna, risultati di audit IATF, incidenti di qualità e lanci di modelli. I venditori non pongono abbastanza domande diagnostiche per scoprire questi trigger. I clienti sotto pressione IATF devono utilizzare fornitori europei certificati e sono molto meno sensibili al prezzo in tale decisione."
      },
      teamInsights: {
        absolute: [
          { name: "PICA medio team", value: 62 },
          { name: "Norma raggiunta", value: 74 },
          { name: "Prossimi passi chiari", value: 60 },
          { name: "Resistenze gestite", value: 54 }
        ],
        percentages: [
          { name: "Norma raggiunta %", value: 74 },
          { name: "Prossimi passi chiari %", value: 60 },
          { name: "Resistenze corrette %", value: 68 }
        ],
        uspOverview: [
          { name: "Affidabilità consegne", value: 45, relevance: "high" },
          { name: "Supporto tecnico", value: 37, relevance: "high" },
          { name: "Ampiezza gamma prodotti", value: 31, relevance: "medium" },
          { name: "Certificazioni qualità", value: 24, relevance: "high" },
          { name: "Servizio VMI", value: 16, relevance: "high" }
        ],
        comparison: "I prossimi passi chiari calano dell'8% al 60%, il PICA del team cala del 5% al 62%. Le menzioni VMI diminuiscono del 9% e le certificazioni qualità del 6%. Un team che non comunica sistematicamente VMI e certificazione IATF compete principalmente su consegna e prezzo — esattamente la battaglia che Würth e le alternative asiatiche sono meglio posizionate per vincere."
      },
      resistanceNeeds: {
        resistances: [
          { name: "Prezzo vs. alternative asiatiche", value: 41 },
          { name: "Soddisfatto del fornitore attuale", value: 32 },
          { name: "Quantità minima d'ordine troppo alta", value: 25 },
          { name: "Tempi consegna componenti personalizzati", value: 19 },
          { name: "Sconoscenza della gamma completa", value: 13 }
        ],
        triggers: [
          { name: "Guasto consegna fornitore attuale", value: 43 },
          { name: "Requisito certificazione IATF", value: 36 },
          { name: "Nuova linea / lancio modello", value: 31 },
          { name: "Incidente qualità / NCR dal fornitore", value: 29 },
          { name: "Progetto consolidamento acquisti", value: 24 }
        ],
        comparison: "Il prezzo rispetto alle alternative asiatiche domina con il 33% e cresce del 14%. La soddisfazione con il fornitore attuale (26%) è stabile ma rappresenta una barriera strutturale. Il guasto di consegna cresce fortemente come trigger (+11%) e la pressione IATF cresce (+8%). Le resistenze di prezzo sono alte perché i venditori non dispiegano argomentazione TCO. I venditori che non sondano proattivamente guasti di consegna e incidenti qualità perdono completamente le finestre di acquisto."
      },
      nextStepDiscipline: {
        absolute: [
          { name: "Con prossimo passo chiaro", value: 88 },
          { name: "Senza prossimo passo", value: 50 },
          { name: "Prossimi passi SMART", value: 47 }
        ],
        percentages: [
          { name: "Correttamente formulato %", value: 58 },
          { name: "Seguito %", value: 76 }
        ],
        comparison: "Le conversazioni senza prossimo passo salgono del 16% — ora 50 delle 138 conversazioni (36%) terminano senza un impegno di follow-up concreto. Nella vendita di componenti industriali, gli impegni di follow-up sono spesso 'ordine campione in sospeso' — formulazioni vaghe che mancano di data e responsabile. Nei cicli di vendita industriale di 8-16 settimane, ogni slancio perduto si traduce direttamente in incertezza di previsione. Raccomandazione: protocollo di chiusura obbligatorio per ogni visita."
      },
      dmuInsights: {
        dmuMentioned: true,
        decisionProcessClear: false,
        stakeholders: [
          { name: "Responsabile acquisti", role: "decisore", mentioned: true },
          { name: "Ingegnere tecnico / Progettista", role: "influenzatore", mentioned: true },
          { name: "Responsabile produzione", role: "utente", mentioned: false },
          { name: "Responsabile qualità", role: "influenzatore", mentioned: false }
        ],
        dmuClarity: 54,
        comparison: "La mappatura DMU avviene nel 64% delle conversazioni (obiettivo 80%). Il responsabile acquisti e l'ingegnere tecnico vengono mappati sistematicamente. Il responsabile produzione viene identificato solo nel 29% delle conversazioni. Il responsabile qualità viene mappato solo nel 32% — nonostante sia il principale stakeholder nelle decisioni IATF. In Tier 1 e Tier 2 automotive, la decisione coinvolge congiuntamente qualità, produzione e acquisti. Raccomandazione: aggiungere responsabile qualità e produzione alla lista DMU obbligatoria."
      },
      uspMentions: {
        usps: [
          { name: "Affidabilità consegne", value: 45, relevance: "high" },
          { name: "Supporto tecnico", value: 37, relevance: "high" },
          { name: "Ampiezza gamma prodotti", value: 31, relevance: "medium" },
          { name: "Certificazioni qualità", value: 24, relevance: "high" },
          { name: "Servizio VMI", value: 16, relevance: "high" }
        ],
        comparison: "Affidabilità consegne (29%) e ampiezza gamma (20%) sono stabili e rappresentano insieme il 49% delle menzioni USP. Certificazioni qualità calano del 6% al 15%. Il servizio VMI cala del 9% al 10% — nonostante la risonanza più alta (+14%). Il VMI al 10% delle menzioni è un fallimento strutturale significativo: l'elemento con la maggiore domanda (+16%) e la maggiore risonanza (58%) viene comunicato in appena una conversazione su dieci."
      }
    };
  }

  return {
    conversationActivity: {
      absolute: [
        { name: "Totaal Gesprekken", value: 138, trend: 'up', trendPct: 7, priority: 'hoog' },
        { name: "Gemiddelde Duur", value: 34, trend: 'stable', trendPct: 0, priority: 'middel' },
        { name: "Open Vragen", value: 502, trend: 'up', trendPct: 5, priority: 'middel' },
        { name: "Gesloten Vragen", value: 289, trend: 'stable', trendPct: 0, priority: 'laag' },
        { name: "Diagnose Vragen", value: 78, trend: 'down', trendPct: 9, priority: 'hoog' },
        { name: "Vervolgvraag Momenten", value: 164, trend: 'down', trendPct: 4, priority: 'middel' },
        { name: "Samenvattingen", value: 112, trend: 'stable', trendPct: 0, priority: 'laag' }
      ],
      percentages: [
        { name: "Spreek-Luister Ratio", value: 38, trend: 'stable', trendPct: 0, priority: 'laag' },
        { name: "Open Vragen %", value: 63, trend: 'stable', trendPct: 0, priority: 'middel' },
        { name: "Gesloten Vragen %", value: 37, trend: 'stable', trendPct: 0, priority: 'laag' },
        { name: "Diagnose %", value: 11, trend: 'down', trendPct: 9, priority: 'hoog' },
        { name: "Vervolgvraag %", value: 16, trend: 'down', trendPct: 4, priority: 'middel' }
      ],
      absoluteAlerts: ["Diagnostische vragen dalen 9% — technische behoefteninventarisatie verslechtert in industriële verkoopgesprekken", "Gespreksvolume stijgt 7% — kwaliteitsborging nu kritiek"],
      percentageAlerts: ["Diagnose % daalt naar 11% — ver onder de norm van 20% voor complexe industriële verkoop"],
      absoluteSummary: "Gespreksvolume groeit maar diagnostische diepgang daalt sterk — industriële componentgesprekken vereisen diepgaander technisch doorvragen.",
      percentageSummary: "Spreek-luisterratio goed, maar diagnose-vragen structureel afwezig in de meeste gesprekken.",
      comparison: "**Wat we zien:** Gespreksvolume stijgt 7% maar diagnostische vragen dalen 9% naar 11% — ver onder de norm van 20% voor complexe industriële verkoop. Vervolgvraagmomenten dalen eveneens (−4%). De spreek-luisterratio van 38% (norm 35%) is positief, maar groeiend volume gaat ten koste van diagnostische kwaliteit.\n\n**Waarschijnlijke oorzaak:** In technische industriële verkoop vereisen diagnostische vragen diepgaande product- en toepassingskennis: vragen over productieprocessen, gevolgen van componentdefecten, certificeringseisen en leveranciersrisico's. Onder tijdsdruk beperken verkopers zich tot oppervlakkige vragen over de huidige leverancier en prijs, en slaan het technisch doorvragen over dat consultatieve verkoop onderscheidt van transactionele verkoop.\n\n**Operationele betekenis:** Zonder diagnostische vragen blijven kritieke kooptriggers verborgen: productiestilstandrisico, IATF-certificeringsdruk, kwaliteitsincidenten bij de huidige leverancier en aankomende seriestarts. Dit zijn precies de triggers die urgentie creëren en premium-prijzen rechtvaardigen.\n\n**Strategische betekenis:** Industriële componentverkoop hangt af van consultatieve differentiatie. Een team dat minder diagnostische vragen stelt, verliest progressief het vermogen om VMI, IATF-certificeringsbegeleiding en engineering support als relevante oplossingen te positioneren.\n\n**Aanbevolen managementactie:** Introduceer minimaal 3 diagnostische vragen per gesprek als verplicht coaching-KPI: productieproces, kwaliteitseisen en leveranciersrisico. Stel een technisch vraagraamwerk op per klantsegment. Target: diagnose % naar 16% binnen zes weken."
    },
    picaPerformance: {
      phaseScores: [
        { name: "Propositie", value: 74, trend: 'stable', trendPct: 0, priority: 'laag', description: "Verkopers openen gesprekken goed — ze stellen zichzelf voor, geven een assortimentsoverzicht en leggen het gespreksdoel uit. De doelvraag aan de klant ontbreekt echter in een derde van de gesprekken." },
        { name: "Inventarisatie", value: 43, trend: 'down', trendPct: 7, priority: 'hoog', description: "Verkopers begrijpen de rol van de klant en wat het bedrijf produceert, maar vragen zelden door naar de productiegevolgen van componentdefecten, IATF-certificeringseisen of de impact van leveringsproblemen." },
        { name: "Overtuiging", value: 62, trend: 'stable', trendPct: 0, priority: 'middel', description: "Leverbetrouwbaarheid en assortiment worden goed gekoppeld, maar VMI-programma's, IATF-certificaten en TCO-argumenten worden zelden verbonden aan ontdekte klantbehoeften." },
        { name: "Afsluiting", value: 67, trend: 'down', trendPct: 4, priority: 'middel', description: "Vervolgstappen worden aangevraagd maar afspraken zijn vaak vaag — monsterbestellingen zonder toegezegde datum, technische bezoeken zonder bevestigde afspraak." }
      ],
      phaseDetails: [
        { phase: 1, metrics: [
          { key: "breakTheIce", value: 82 }, { key: "salesPitch", value: 77 },
          { key: "goalQuestion", value: 64 }, { key: "expectationMgt", value: 66 }
        ]},
        { phase: 2, metrics: [
          { key: "contactPerson", value: 71 }, { key: "company", value: 67 },
          { key: "cooperation", value: 52 }, { key: "consequences", value: 27 },
          { key: "cure", value: 25 }, { key: "deepQuestioning", value: 31 },
          { key: "customerType", value: 48 }
        ]},
        { phase: 3, metrics: [
          { key: "uspUbrLink", value: 61 }, { key: "result", value: 55 },
          { key: "acknowledgement", value: 68 }
        ]},
        { phase: 4, metrics: [
          { key: "agreement", value: 67 }
        ]}
      ],
      phaseAlerts: ["Inventarisatie daalt 7% — verkopers begrijpen de klant maar bereiken de productie- en kwaliteitsgevolgen die koopurgentie creëren niet", "Afsluiting daalt 4% — commitment wordt gevraagd maar zelden geformaliseerd met concrete datum en actie"],
      phaseSummary: "Opening en pitch solide. Klantbehoefteninventarisatie te oppervlakkig — productiegevolgen en IATF-behoeften worden nooit bereikt.",
      subskillSummary: "Technische inventarisatiediepgang is het centrale gat — consequences- en cure-metrics zwaar onderontwikkeld.",
      comparison: "**Wat we zien — gespreksopbouw:** \n\nVerkopers openen gesprekken goed in industriële accounts: ze stellen zichzelf voor, geven een assortimentsoverzicht en leggen hun doel uit. Dit is consistent in het team. Maar de kwaliteit daalt sterk in de inventarisatiefase. Verkopers leren wie ze voor zich hebben en wat het bedrijf maakt, maar houden daar op. Ze vragen nooit: wat gebeurt er als een component uitvalt op je productielijn? Wat zijn je IATF-certificeringsverplichtingen? Welke componenten zijn het meest kritisch voor je continuïteit? Zonder die antwoorden is alles wat volgt generisch.\n\n**Wat we zien — specifiek gespreksgedrag:** \n\nDe doelvraag ontbreekt in een derde van de gesprekken. In de inventarisatiefase stellen verkopers vragen over de huidige leverancier en bestelfrequentie, maar vragen bijna nooit door naar de productiegevolgen van leveringsproblemen, kwaliteitscertificeringseisen of de kosten van componentdefecten. Dit zijn precies de vragen die een prijsgesprek omzetten in een waardegesprek. In de afsluitingsfase worden 'monsterstelling' en 'technisch bezoek' frequent vermeld, maar zonder concrete datum of commitment."
    },
    dealHealth: {
      leadWarmth: [
        { name: "Warme Leads", value: 25, trend: 'down', trendPct: 9, priority: 'hoog' },
        { name: "Lauwe Leads", value: 48, trend: 'up', trendPct: 6, priority: 'middel' },
        { name: "Koude Leads", value: 65, trend: 'up', trendPct: 13, priority: 'hoog' }
      ],
      dealScores: [
        { name: "Conversie Kans", value: 64, trend: 'stable', trendPct: 0, priority: 'laag' },
        { name: "Urgentie Score", value: 51, trend: 'down', trendPct: 8, priority: 'hoog' },
        { name: "Interesse Score", value: 74, trend: 'up', trendPct: 4, priority: 'laag' },
        { name: "Intentie Score", value: 58, trend: 'down', trendPct: 5, priority: 'middel' }
      ],
      warmthAlerts: ["Koude leads stijgen 13% — pipeline-kwaliteit verslechtert snel", "Warme leads dalen 9% — actieve koopmomenten nemen af"],
      dealScoreAlerts: ["Urgentiescore daalt 8% — productie-urgentietriggers worden niet geactiveerd in gesprekken"],
      warmthSummary: "Pipeline koelt snel af: koude leads groeien, warme leads dalen.",
      dealScoreSummary: "Klantinteresse sterk maar urgentie en intentie dalen — de brug naar beslissing is gebroken.",
      comparison: "**Wat we zien:** Koude leads stijgen 13% naar 47% van de pipeline terwijl warme leads dalen naar 18%. Urgentiescore daalt 8% naar 51% — het kritieke waarschuwingssignaal. Interessescore (74%, +4%) blijft positief maar vertaalt zich niet naar intentie (58%, −5%).\n\n**Waarschijnlijke oorzaak:** Industriële verkoopurgentie wordt gedreven door specifieke productie-gebeurtenissen: leveringsuitval bij leverancier, IATF-auditbevindingen, kwaliteitsincidenten en modelstarts. Verkopers stellen onvoldoende diagnostische vragen om deze triggers te ontdekken. Zonder trigger-ontdekking voelt elk account 'geïnteresseerd maar niet dringend' aan.\n\n**Operationele betekenis:** Een pipeline met 47% koude leads betekent dat het merendeel van de tijd wordt besteed aan accounts die nog niet beslissingsklaar zijn. Naarmate het aantal warme leads daalt, heeft het team proportioneel meer gesprekken nodig voor dezelfde output.\n\n**Strategische betekenis:** Industriële klanten die 'lauw maar koud' zijn worden onvermijdelijk door concurrenten opgepakt die op het juiste moment bellen. Het venster voor Essentra is wanneer een leveringsuitval plaatsvindt, een kwaliteits-NCR wordt opgesteld, of een seriestart nadert.\n\n**Aanbevolen managementactie:** Introduceer urgentie-trigger-vraagstelling als verplicht element: vraag in elk gesprek specifiek naar leveringsbetrouwbaarheid huidige leverancier, IATF-auditstatus, kwaliteitsincidenten en aankomende seriestarts. Bouw een urgentiekaart per account. Target: warme leads terug boven 25% binnen Q2."
    },
    teamInsights: {
      absolute: [
        { name: "Gem. Team PICA", value: 62, trend: 'down', trendPct: 5, priority: 'hoog' },
        { name: "Norm Behaald", value: 74, trend: 'down', trendPct: 4, priority: 'middel' },
        { name: "Duidelijke Next Steps", value: 60, trend: 'down', trendPct: 8, priority: 'hoog' },
        { name: "Weerstand Behandeld", value: 54, trend: 'stable', trendPct: 0, priority: 'middel' }
      ],
      percentages: [
        { name: "Norm Behaald %", value: 74, trend: 'down', trendPct: 4, priority: 'middel' },
        { name: "Duidelijke Next Steps %", value: 60, trend: 'down', trendPct: 8, priority: 'hoog' },
        { name: "Weerstand Correct %", value: 68, trend: 'stable', trendPct: 0, priority: 'middel' }
      ],
      uspOverview: [
        { name: "Leverbetrouwbaarheid", value: 45, relevance: "high", trend: 'stable', trendPct: 0, priority: 'laag' },
        { name: "Technische Support", value: 37, relevance: "high", trend: 'down', trendPct: 4, priority: 'middel' },
        { name: "Breed Assortiment", value: 31, relevance: "medium", trend: 'stable', trendPct: 0, priority: 'laag' },
        { name: "Kwaliteitscertificaten", value: 24, relevance: "high", trend: 'down', trendPct: 6, priority: 'hoog' },
        { name: "VMI Service", value: 16, relevance: "high", trend: 'down', trendPct: 9, priority: 'hoog' }
      ],
      absoluteAlerts: ["Next step discipline daalt 8% — pipeline-voorspelbaarheid in kritiek risico", "Team PICA daalt 5% — brede kwaliteitsachteruitgang in industrieel salesteam"],
      uspAlerts: ["VMI service-vermelding daalt 9% — differentiator met hoogste resonantie verliest stem", "Kwaliteitscertificaten dalen 6% — IATF-positionering verzwakt in sleutel automotive accounts"],
      absoluteSummary: "Next step discipline en PICA-score dalen — industriële verkoopkwaliteit verslechtert over het team.",
      uspSummary: "Leverbetrouwbaarheid stabiel maar VMI en certificaten dalen — de hoge-waarde differentiators verdwijnen.",
      comparison: "**Wat we zien:** Duidelijke next steps dalen 8% naar 60%, team PICA daalt 5% naar 62%. VMI service-vermeldingen dalen 9% en kwaliteitscertificaten dalen 6% als USP. Het patroon weerspiegelt de diagnosevraag-daling: verkopers die geen technische behoeften ontdekken, kunnen VMI, IATF-certificaten en engineering support niet koppelen aan een klantprobleem. Het resultaat is een gesprek dat op het levering-en-assortimentsniveau blijft, terwijl de differentierende USPs die een prijspremium rechtvaardigen, onzichtbaar blijven.\n\n**Waarschijnlijke oorzaak:** Een team dat VMI en IATF systematisch niet communiceert, concurreert hoofdzakelijk op levering en prijs — precies de strijd die Würth en Aziatische alternatieven het best kunnen winnen.\n\n**Operationele betekenis:** Afnemende next steps (−8%) gecombineerd met afnemende USP-breedte betekent dat gesprekken minder diepgaand zijn EN minder resulteren in specifieke commitments. De VMI-daling (−9%) is bijzonder zorgwekkend: VMI is het propositie-element met de hoogste resonantie.\n\n**Strategische betekenis:** Leverbetrouwbaarheid communiceren is noodzakelijk maar niet voldoende. De echte concurrentiepositie van Essentra ligt in VMI, engineering en IATF — precies wat er nu uit gesprekken verdwijnt.\n\n**Aanbevolen managementactie:** Implementeer wekelijkse USP-tracking per verkoper: VMI en IATF-certificering moeten in gespreksrapportages verschijnen. Koppel next step discipline aan deal-statuspromotie in het CRM. Coachingprioriteit: technisch doorvragen → VMI-introductie → certificeringspositionering."
    },
    resistanceNeeds: {
      resistances: [
        { name: "Prijs vs. Aziatische Alternatieven", value: 41, trend: 'up', trendPct: 14, priority: 'hoog' },
        { name: "Tevreden met Huidige Leverancier", value: 32, trend: 'stable', trendPct: 0, priority: 'middel' },
        { name: "MOQ Te Hoog", value: 25, trend: 'up', trendPct: 6, priority: 'middel' },
        { name: "Levertijd Maatwerk Te Lang", value: 19, trend: 'stable', trendPct: 0, priority: 'laag' },
        { name: "Onbekendheid Volledig Assortiment", value: 13, trend: 'down', trendPct: 4, priority: 'laag' }
      ],
      triggers: [
        { name: "Leveringsuitval Huidige Leverancier", value: 43, trend: 'up', trendPct: 11, priority: 'hoog' },
        { name: "IATF-certificeringsverplichting", value: 36, trend: 'up', trendPct: 8, priority: 'hoog' },
        { name: "Nieuwe Productlijn / Seriestart", value: 31, trend: 'up', trendPct: 5, priority: 'middel' },
        { name: "Kwaliteitsincident / NCR bij Huidig Leverancier", value: 29, trend: 'up', trendPct: 9, priority: 'hoog' },
        { name: "Inkoopconsolidatieproject", value: 24, trend: 'stable', trendPct: 0, priority: 'middel' }
      ],
      resistanceAlerts: ["Prijs vs. Aziatische alternatieven stijgt 14% — TCO-argumentatie inzet kritiek en urgent", "MOQ-weerstand stijgt 6% — commerciële drempel bij vroege accountontwikkeling"],
      triggerAlerts: ["Leveringsuitval trigger stijgt 11% — hoogste kansignaal, moet in elk account worden doorgevraagd", "Kwaliteitsincident/NCR trigger stijgt 9% — actief koopevenement, directe opvolging vereist"],
      resistanceSummary: "Prijs vs. Aziatisch domineert en stijgt — TCO-argumentatie moet systematisch worden ingezet.",
      triggerSummary: "Leveringsuitval en IATF-certificering zijn de twee sterkste kooptriggers — pro-actief op doorvragen.",
      comparison: "**Wat we zien:** Prijs vs. Aziatische alternatieven is de dominante weerstand met 33% en stijgt 14%. Tevredenheid met huidige leverancier (26%) is stabiel maar vormt een structurele barrière. MOQ-weerstand groeit (+6%). Tegelijkertijd groeit leveringsuitval sterk als trigger (+11%) en IATF-certificeringsdruk groeit (+8%) — beide zijn actieve koopevenementen.\n\n**Waarschijnlijke oorzaak:** Prijsweerstand is hoog omdat verkopers geen TCO-argumentatie inzetten. 'Tevreden met huidige leverancier' is een signaal dat verkopers de latente onvrede niet ontdekken — leveringsproblemen, kwaliteitszorgen, certificeringsgaten — omdat diagnostische vragen te schaars en te oppervlakkig zijn.\n\n**Operationele betekenis:** De groeiende leveringsuitval-trigger (+11%) en kwaliteits-NCR-trigger (+9%) zijn de krachtigste verkoopkansen in industriële componentaccounts. Verkopers die niet pro-actief doorvragen naar leveringsprestaties en kwaliteitsincidenten, missen deze koopvensters volledig.\n\n**Strategische betekenis:** Klanten met IATF-certificeringsdruk moeten gecertificeerde Europese leveranciers gebruiken en zijn voor die beslissing veel minder prijsgevoelig. Dit klantsegment wordt structureel onderbenut.\n\n**Aanbevolen managementactie:** Train verkopers om systematisch naar de vijf kooptriggers te vragen bij elk accountbezoek. Ontwikkel een TCO-tegenargumentscript voor Aziatische prijsvergelijkingen. Behandel IATF-certificering als verplichte inventarisatievraag in alle automotive- en Tier-1-accounts."
    },
    nextStepDiscipline: {
      absolute: [
        { name: "Met Duidelijke Next Step", value: 88, trend: 'down', trendPct: 7, priority: 'hoog' },
        { name: "Zonder Next Step", value: 50, trend: 'up', trendPct: 16, priority: 'hoog' },
        { name: "SMART Next Steps", value: 47, trend: 'down', trendPct: 6, priority: 'middel' }
      ],
      percentages: [
        { name: "Correct Geformuleerd %", value: 58, trend: 'stable', trendPct: 0, priority: 'middel' },
        { name: "Opgevolgd %", value: 76, trend: 'up', trendPct: 3, priority: 'laag' }
      ],
      absoluteAlerts: ["Gesprekken zonder next step stijgen 16% — kritiek pipeline-lek in industriële verkoop", "SMART next steps dalen 6% — commitments te vaag om actie op te sturen"],
      percentageAlerts: [],
      absoluteSummary: "Next step discipline verslechtert sterk — 36% van alle gesprekken eindigt zonder concrete vervolgafspraak.",
      percentageSummary: "Follow-up rate stijgt licht maar SMART-formulering ver onder de norm.",
      comparison: "**Wat we zien:** Gesprekken zonder next step stijgen 16% — nu 50 van de 138 gesprekken (36%) eindigt zonder concrete vervolgafspraak. Met duidelijke next step daalt 7%. SMART-formulering daalt 6% naar 47%. Positief: follow-up rate stijgt licht naar 76%.\n\n**Waarschijnlijke oorzaak:** In industriële componentverkoop zijn vervolgafspraken vaak 'monsterstelling in behandeling' of 'technisch bezoek in te plannen' — inherent vage formuleringen zonder datum en actie-eigenaar. Verkopers beëindigen gesprekken zodra de inhoudelijke bespreking klaar is, zonder de intentie te formaliseren in een concrete afspraak. De stijging van 16% is bijzonder alarmerend gezien de industriële verkoopcycli van 8-16 weken.\n\n**Operationele betekenis:** Elk gesprek zonder next step is een pipeline-lek. Bij 36% eindigt meer dan een derde van alle verkoopgesprekken zonder een uitvoerbare afspraak. Dit vertaalt zich direct naar forecasting-onzekerheid.\n\n**Strategische betekenis:** Leverbetrouwbaarheid is de kernwaardepropositie van Essentra Components — maar next step discipline is het operationele equivalent voor het salesteam.\n\n**Aanbevolen managementactie:** Implementeer een verplicht afsluitingsprotocol voor elk bezoek: een monsterstelling moet een leverdatum bevatten, een technisch bezoek moet een datum in de agenda hebben, een offerte moet een responsdatum hebben. Train het team in SMART-formulering. Target: gesprekken zonder next step onder 20% binnen Q2."
    },
    dmuInsights: {
      dmuMentioned: true,
      decisionProcessClear: false,
      stakeholders: [
        { name: "Inkoopmanager", role: "beslisser", mentioned: true },
        { name: "Technisch Engineer / Constructeur", role: "beïnvloeder", mentioned: true },
        { name: "Productiemanager", role: "gebruiker", mentioned: false },
        { name: "Kwaliteitsmanager", role: "beïnvloeder", mentioned: false }
      ],
      dmuClarity: 54,
      dmuAlerts: ["Productiemanager niet geïdentificeerd in 71% van gesprekken — sleutel gebruikersstakeholder creëert blind spot", "Kwaliteitsmanager ontbreekt in 68% van gesprekken — kritiek voor IATF-certificeringsbeslissingen"],
      dmuSummary: "DMU-mapping onvolledig — kwaliteits- en productiefuncties systematisch gemist, waardoor laat-in-het-proces bezwaarrisico ontstaat.",
      comparison: "**Wat we zien:** DMU-mapping vindt plaats in 64% van de gesprekken (norm 80%). Inkoopmanager en technisch engineer worden consistent in kaart gebracht. Productiemanager wordt slechts in 29% van de gesprekken geïdentificeerd. Kwaliteitsmanager wordt slechts in 32% van de gesprekken in kaart gebracht — ondanks zijn rol als primaire stakeholder bij IATF-certificeringsbeslissingen.\n\n**Waarschijnlijke oorzaak:** Verkopers bellen primair op inkoopmanagers en soms op technische engineers. Productiemanagers en kwaliteitsmanagers vereisen een specifieke reden voor contact: een leveringsrisicozorg, een kwaliteitsaudit of een certificeringsvereiste. Zonder diagnostische vragen die deze onderwerpen naar boven brengen, is er geen reden om de afspraak te vragen.\n\n**Operationele betekenis:** De kwaliteitsmanager is de sleutelbeslisser voor IATF-certificeringsconformiteit. Een verkoper die nooit de kwaliteitsmanager spreekt, kan IATF-certificeringsbegeleiding niet als differentiator positioneren.\n\n**Strategische betekenis:** Bij automotive Tier 1 en Tier 2 accounts omvat de aankoopbeslissing voor gecertificeerde componenten kwaliteit, productie en inkoop gezamenlijk. Een verkoper die alleen inkoop in kaart brengt, werkt met een derde van de relevante DMU.\n\n**Aanbevolen managementactie:** Voeg kwaliteitsmanager en productiemanager toe aan de verplichte DMU-checklist voor alle automotive- en productiekritieke accounts. Maak een specifieke waardepropositie per DMU-rol: inkoop (TCO en consolidatie), engineering (design-in ondersteuning), kwaliteit (IATF-certificering), productie (VMI en leverbetrouwbaarheid). Target: DMU-mappinggraad boven 75% binnen Q2."
    },
    uspMentions: {
      usps: [
        { name: "Leverbetrouwbaarheid", value: 45, relevance: "high", trend: 'stable', trendPct: 0, priority: 'laag' },
        { name: "Technische Support", value: 37, relevance: "high", trend: 'down', trendPct: 4, priority: 'middel' },
        { name: "Breed Assortiment", value: 31, relevance: "medium", trend: 'stable', trendPct: 0, priority: 'laag' },
        { name: "Kwaliteitscertificaten", value: 24, relevance: "high", trend: 'down', trendPct: 6, priority: 'hoog' },
        { name: "VMI Service", value: 16, relevance: "high", trend: 'down', trendPct: 9, priority: 'hoog' }
      ],
      uspAlerts: ["VMI service-vermeldingen dalen 9% — differentiator met hoogste resonantie systematisch onderbenut", "Kwaliteitscertificaten dalen 6% — IATF-positionering verzwakt ondanks groeiende klantvraag"],
      uspSummary: "Leverbetrouwbaarheid stabiel maar VMI en certificaten dalen — waardepropositie versmalt naar haar zwakste elementen.",
      comparison: "**Wat we zien:** Leverbetrouwbaarheid (29%) en breed assortiment (20%) zijn stabiel en samen goed voor 49% van alle USP-vermeldingen. Technische support daalt 4% naar 24%. Kwaliteitscertificaten dalen 6% naar 15%. VMI service daalt 9% naar 10% — ondanks de hoogste en snelst groeiende klantvraag.\n\n**Waarschijnlijke oorzaak:** Verkopers communiceren wat ze het meest vertrouwd mee zijn — levering en assortiment zijn de basis-USPs die geen klantinventarisatie vereisen. VMI, certificering en engineering support vereisen een klantprobleem om aan te koppelen. Dit is het directe gevolg van onvoldoende diagnostisch doorvragen.\n\n**Operationele betekenis:** Door te concentreren op twee basis-USPs wordt de propositie ononderscheidbaar van die van Würth. VMI, kwaliteitscertificaten en engineering support zijn de USPs die Würth niet kan evenaren en die Aziatische alternatieven structureel niet kunnen leveren.\n\n**Strategische betekenis:** VMI bij 10% van USP-vermeldingen is een significante structurele mislukking: het element met de hoogste vraag (groeiend +16%) en de hoogste resonantie (58% bij vermelding) wordt gecommuniceerd in nauwelijks één op de tien gesprekken.\n\n**Aanbevolen managementactie:** Introduceer een gesprekssjabloon dat vereist dat VMI en IATF-certificering in elk gesprek met automotive-, machinebouw- of hoge-volume-productieklanten worden besproken. Stel een VMI-introductiescript op. Monitor VMI-vermeldingsgraad per verkoper als wekelijkse coaching-metric."
    }
  };
}
