/**
 * Fase-gebaseerde module-aanbevelingen (AI-uitbreiding, deel 1).
 *
 * Vervangt het oude LMS-mechanisme (externe api.reppic.ai-call + OpenAI-
 * embeddings) door een directe, interne koppeling: de gespreksanalyse scoort
 * 15 subfasen (0-3) die 1-op-1 op de 4 PICA-hoofdfasen mappen
 * (1 Propositie, 2 Inventarisatie, 3 Overtuiging, 4 Afsluiting).
 * De zwakste hoofdfasen van de verkoper bepalen welke leermodules
 * (LearningModule.phase 1-4) worden aanbevolen. Deterministisch, geen LLM.
 */
import { prisma } from "@/app/api/utils/prisma";
import { AuthUser } from "@/lib/services/learningService";

const MAX_FASE_SCORE = 3;
const RECENT_CONVERSATIONS = 10; // venster: laatste N geanalyseerde gesprekken
const WEAK_THRESHOLD = 66; // fase telt als "zwak" onder deze score (0-100)
const MAX_RECOMMENDATIONS = 6;

/** Zelfde labels als de PICA-tegel op het dashboard. */
const PHASE_NAMES: Record<number, string> = {
  1: "Propositie",
  2: "Inventarisatie",
  3: "Overtuiging",
  4: "Afsluiting",
};

type StoredPhase = { Fase?: number; Titel?: string; Score?: unknown };

function normalizePhases(value: unknown): StoredPhase[] {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }
  return Array.isArray(parsed) ? (parsed as StoredPhase[]) : [];
}

function clampScore(value: unknown): number | null {
  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.min(MAX_FASE_SCORE, n));
}

export const learningRecommendationsService = {
  /**
   * Aanbevolen modules voor deze learner, met de reden (zwakke fasen).
   * Kijkt naar de laatste RECENT_CONVERSATIONS geanalyseerde salesgesprekken.
   */
  async getRecommendations(user: AuthUser, requestedLanguage?: string) {
    // Expliciete keuze wint; anders de profieltaal van de gebruiker.
    const language =
      requestedLanguage || (user as { lang_code?: string | null }).lang_code || undefined;
    // 1. Fase-scores uit de recente gespreksanalyses van deze gebruiker.
    const summaries = await prisma.conversationSummaryX.findMany({
      where: {
        user_conversation: { user_id: user.id },
        geen_salesgesprek: false,
      },
      orderBy: { created_at: "desc" },
      take: RECENT_CONVERSATIONS,
      select: { phases: true },
    });

    if (summaries.length === 0) {
      return { weak_phases: [], modules: [], based_on_conversations: 0 };
    }

    // 2. Gemiddelde per hoofdfase (0-100), zoals de PICA-tegel.
    const totals = new Map<number, { sum: number; count: number }>();
    for (const s of summaries) {
      for (const p of normalizePhases(s.phases)) {
        const fase = p.Fase;
        const score = clampScore(p.Score);
        if (!fase || fase < 1 || fase > 4 || score === null) continue;
        const t = totals.get(fase) || { sum: 0, count: 0 };
        t.sum += (score / MAX_FASE_SCORE) * 100;
        t.count += 1;
        totals.set(fase, t);
      }
    }

    const phaseAverages = Array.from(totals.entries())
      .map(([fase, t]) => ({
        phase: fase,
        name: PHASE_NAMES[fase] || String(fase),
        score: Math.round(t.sum / t.count),
      }))
      .sort((a, b) => a.score - b.score);

    // 3. Zwakke fasen (onder drempel); als alles goed gaat: geen aanbevelingen.
    const weakPhases = phaseAverages.filter((p) => p.score < WEAK_THRESHOLD);
    if (weakPhases.length === 0) {
      return {
        weak_phases: [],
        modules: [],
        based_on_conversations: summaries.length,
      };
    }

    // 4. Modules voor die fasen die de learner mag zien en nog niet afrondde.
    const companyOk = user.company_id
      ? await prisma.company.findUnique({
          where: { id: user.company_id },
          select: { lms_enabled: true },
        })
      : null;
    const completed = await prisma.learningProgress.findMany({
      where: { user_id: user.id, status: "completed" },
      select: { module_id: true },
    });
    const completedIds = new Set(completed.map((c) => c.module_id));

    const modules = await prisma.learningModule.findMany({
      where: {
        deleted_at: null,
        phase: { in: weakPhases.map((p) => p.phase) },
        OR: [
          { company_id: null },
          ...(companyOk?.lms_enabled ? [{ company_id: user.company_id }] : []),
        ],
      },
      select: {
        id: true,
        title: true,
        description: true,
        duration: true,
        phase: true,
        thumbnail_url: true,
        content_type: true,
      },
      orderBy: [{ phase: "asc" }, { created_at: "asc" }],
    });

    // Zwakste fase eerst; afgeronde modules overslaan.
    const phaseRank = new Map(weakPhases.map((p, i) => [p.phase, i]));
    const recommended = modules
      .filter((m) => !completedIds.has(m.id))
      .sort(
        (a, b) =>
          (phaseRank.get(a.phase!) ?? 99) - (phaseRank.get(b.phase!) ?? 99),
      )
      .slice(0, MAX_RECOMMENDATIONS)
      .map((m) => ({
        ...m,
        reason_phase: PHASE_NAMES[m.phase!] || String(m.phase),
        reason_score:
          weakPhases.find((p) => p.phase === m.phase)?.score ?? null,
      }));

    // Titels in de gebruikerstaal (zelfde bron als de detailpagina).
    if (language && recommended.length > 0) {
      const translations = await prisma.learningModuleTranslation.findMany({
        where: {
          module_id: { in: recommended.map((m) => m.id) },
          language,
        },
        select: { module_id: true, content: true },
      });
      const byModule = new Map(
        translations.map((t) => [
          t.module_id,
          (t.content ?? {}) as { title?: string; description?: string },
        ]),
      );
      for (const m of recommended) {
        const tr = byModule.get(m.id);
        if (tr?.title) m.title = tr.title;
        if (tr?.description) m.description = tr.description;
      }
    }

    return {
      weak_phases: weakPhases,
      modules: recommended,
      based_on_conversations: summaries.length,
    };
  },
};
