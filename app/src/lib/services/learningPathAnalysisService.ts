/**
 * Embedding/competentie-gebaseerde leerpadgeneratie (LMS 1:1 P4) — port van
 * productie ai-competency-extractor.ts + ai-module-matcher.ts +
 * ai-embedding-service.ts (module-deel) + de drie routes
 * analyze-job-profile / match-modules / create-from-analysis.
 *
 * Flow (3 stappen, met menselijke tussenstap zoals productie):
 *  1. functieprofiel (tekst of document) → AI extraheert competenties;
 *  2. competenties + profieltekst → hybride module-matching
 *     (60% competentietag-overlap + 40% semantische embedding-similariteit);
 *  3. admin kiest modules → leerpad + competentie-audit opgeslagen.
 *
 * Chat-stappen lopen via de LiteLLM-gateway (pathgen-modelpicker);
 * embeddings via het bestaande LMS-embeddings-model (superadmin-instelbaar).
 * Zonder embeddings-model werkt de matching op alleen tags (gelogd).
 */
import { PLATFORM_SETTING_KEYS } from "@/configs/constants";
import { prisma } from "@/app/api/utils/prisma";
import { completeChat } from "@/app/api/services/litellmClient";
import {
  getLmsChatRoute,
  getLmsEmbeddingsModel,
} from "@/app/api/services/learningModelSettingsService";
import {
  getEmbedding,
  cosineSimilarity,
} from "@/lib/services/learningEmbeddingsService";

export interface ExtractedCompetency {
  name: string;
  category: string;
  importance: "high" | "medium" | "low";
  description?: string;
}

export interface ModuleMatch {
  moduleId: string;
  moduleName: string;
  matchScore: number; // 0-100
  tagMatchCount: number;
  semanticScore: number;
  matchingTags: string[];
  category: string | null;
  learningPathType: string;
}

function parseJsonObject(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("AI response was not valid JSON");
  }
}

/** Stap 1 — competenties uit functieprofiel (prompt 1-op-1 met productie). */
export async function extractCompetenciesFromJobProfile(
  documentText: string,
): Promise<{
  jobTitle: string;
  competencies: ExtractedCompetency[];
  summary: string;
}> {
  const prompt = `Je bent een expert in HR en competentie-analyse voor sales-functies.
Je taak is om een functieprofiel of vacaturetekst te analyseren en de benodigde competenties te identificeren.

Focus op:
1. Product kennis - kennis van producten, diensten, features
2. Markt kennis - kennis van de markt, concurrentie, trends, industrie
3. Sales vaardigheden - gespreksvaardigheden, onderhandeling, klantcommunicatie
4. Service kennis - klantenservice, after-sales support

Analyseer het volgende functieprofiel en extraheer de benodigde competenties:

${documentText}

Geef je antwoord in dit exacte JSON formaat (ALLEEN de JSON, geen extra tekst):
{
  "jobTitle": "functietitel",
  "competencies": [
    {
      "name": "competentie naam (kort, lowercase, bijv: 'product features', 'klantcommunicatie')",
      "category": "product-knowledge|market-knowledge|sales-skills|service-knowledge",
      "importance": "high|medium|low",
      "description": "optionele korte beschrijving"
    }
  ],
  "summary": "korte samenvatting van de functie en vereisten"
}`;

  const route = await getLmsChatRoute(
    PLATFORM_SETTING_KEYS.LMS_PATHGEN_LITELLM_MODEL,
  );
  const result = parseJsonObject(await completeChat(prompt, undefined, route));
  if (!Array.isArray(result.competencies)) {
    throw new Error("AI leverde geen competenties");
  }
  result.competencies = result.competencies.map((c: any) => ({
    ...c,
    name: String(c.name || "").toLowerCase().trim(),
  }));
  return {
    jobTitle: result.jobTitle || "",
    competencies: result.competencies,
    summary: result.summary || "",
  };
}

/** Moduletekst voor de embedding — zelfde opzet als productie prepareModuleText. */
function prepareModuleText(module: {
  title: string;
  description: string | null;
  competency_tags: unknown;
}): string {
  const tags = Array.isArray(module.competency_tags)
    ? (module.competency_tags as unknown[]).map(String).join(", ")
    : "";
  return [module.title, module.description || "", tags]
    .filter(Boolean)
    .join("\n");
}

/** Embedding van één module opslaan/verversen. */
export async function updateModuleEmbedding(moduleId: string): Promise<boolean> {
  const model = await getLmsEmbeddingsModel();
  if (!model) return false;
  const module = await prisma.learningModule.findUnique({
    where: { id: moduleId },
    select: { id: true, title: true, description: true, competency_tags: true },
  });
  if (!module) return false;
  const vector = await getEmbedding(prepareModuleText(module), model);
  if (!vector) return false;
  await prisma.learningModuleEmbedding.upsert({
    where: { module_id: moduleId },
    create: {
      module_id: moduleId,
      embedding: JSON.stringify(vector),
      model,
    },
    update: { embedding: JSON.stringify(vector), model },
  });
  return true;
}

/** Embeddings voor alle (of ontbrekende) modules bijwerken — beheeractie. */
export async function updateAllModuleEmbeddings(
  onlyMissing = true,
): Promise<{ updated: number; skipped: number; failed: number }> {
  const model = await getLmsEmbeddingsModel();
  if (!model) return { updated: 0, skipped: 0, failed: 0 };
  const modules = await prisma.learningModule.findMany({
    select: { id: true, embedding: { select: { id: true } } },
  });
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  for (const m of modules) {
    if (onlyMissing && m.embedding) {
      skipped++;
      continue;
    }
    try {
      (await updateModuleEmbedding(m.id)) ? updated++ : failed++;
    } catch {
      failed++;
    }
  }
  return { updated, skipped, failed };
}

/**
 * Stap 2 — hybride matching (60% tags / 40% semantisch), drempel >10,
 * 1-op-1 met productie ModuleMatcher.
 */
export async function matchModulesToJobProfile(
  competencies: ExtractedCompetency[],
  jobProfileText: string,
  // Tenant-scoping: alleen globale (company_id NULL) + eigen-bedrijf-modules.
  // Zonder dit lekken titels/omschrijvingen/tags van álle bedrijven.
  companyId: string | null,
): Promise<{
  matches: ModuleMatch[];
  totalModulesAnalyzed: number;
  competenciesUsed: string[];
  semanticUsed: boolean;
}> {
  const jobTags = competencies
    .map((c) => c.name.toLowerCase())
    .filter(Boolean);

  const model = await getLmsEmbeddingsModel();
  const jobEmbedding = model
    ? await getEmbedding(jobProfileText.slice(0, 8000), model)
    : null;
  if (!jobEmbedding) {
    console.warn(
      "[pathAnalysis] geen embeddings-model/vector — matching op alleen tags",
    );
  }

  const modules = await prisma.learningModule.findMany({
    where: { OR: [{ company_id: null }, { company_id: companyId }] },
    select: {
      id: true,
      title: true,
      description: true,
      competency_tags: true,
      learning_path_type: true,
      category: { select: { name: true } },
      embedding: { select: { embedding: true } },
    },
  });

  const matches: ModuleMatch[] = [];
  for (const m of modules) {
    const moduleTags = Array.isArray(m.competency_tags)
      ? (m.competency_tags as unknown[]).map((t) => String(t).toLowerCase())
      : [];

    let moduleVector: number[] | null = null;
    if (m.embedding?.embedding) {
      try {
        moduleVector = JSON.parse(m.embedding.embedding);
      } catch {
        moduleVector = null;
      }
    }

    if (moduleTags.length === 0 && !moduleVector) continue; // geen verrijking

    // Tag-score: percentage van de functietags dat matcht (productie-logica).
    const tagSet = new Set(moduleTags);
    const matchingTags = jobTags.filter((tag) => tagSet.has(tag));
    const tagScore =
      jobTags.length > 0 ? (matchingTags.length / jobTags.length) * 100 : 0;

    // Semantische score: cosine → 0-100.
    const semanticScore =
      moduleVector && jobEmbedding
        ? Math.max(
            0,
            Math.min(100, cosineSimilarity(moduleVector, jobEmbedding) * 100),
          )
        : 0;

    const hybridScore = tagScore * 0.6 + semanticScore * 0.4;
    if (hybridScore > 10) {
      matches.push({
        moduleId: m.id,
        moduleName: m.title,
        matchScore: Math.round(hybridScore),
        tagMatchCount: matchingTags.length,
        semanticScore: Math.round(semanticScore),
        matchingTags,
        category: m.category?.name ?? null,
        learningPathType: m.learning_path_type,
      });
    }
  }

  matches.sort((a, b) => b.matchScore - a.matchScore);
  return {
    matches,
    totalModulesAnalyzed: modules.length,
    competenciesUsed: jobTags,
    semanticUsed: Boolean(jobEmbedding),
  };
}

/** Prioriteitsindeling voor de UI — zelfde drempels als productie. */
export function categorizeMatches(matches: ModuleMatch[]) {
  return {
    highPriority: matches.filter((m) => m.matchScore >= 70),
    mediumPriority: matches.filter((m) => m.matchScore >= 40 && m.matchScore < 70),
    lowPriority: matches.filter((m) => m.matchScore >= 10 && m.matchScore < 40),
  };
}

/** Stap 3 — leerpad + modules + competentie-audit aanmaken. */
export async function createPathFromAnalysis(input: {
  jobFunction: string;
  level: string;
  description: string | null;
  companyId: string | null;
  jobRoleId: string | null;
  selectedModuleIds: string[];
  competencies: ExtractedCompetency[];
  jobProfileText: string;
}) {
  // Alleen modules die zichtbaar zijn voor dit bedrijf (globaal of eigen bedrijf)
  // mogen aan het pad gekoppeld worden — voorkomt cross-tenant koppelingen via
  // meegestuurde vreemde module-ids. Volgorde uit de invoer blijft behouden.
  const visible = await prisma.learningModule.findMany({
    where: {
      id: { in: input.selectedModuleIds },
      OR: [{ company_id: null }, { company_id: input.companyId }],
    },
    select: { id: true },
  });
  const visibleIds = new Set(visible.map((m) => m.id));
  const allowedModuleIds = input.selectedModuleIds.filter((id) =>
    visibleIds.has(id),
  );

  const path = await prisma.learningPath.create({
    data: {
      job_function: input.jobFunction,
      level: input.level,
      description: input.description,
      company_id: input.companyId,
      job_role_id: input.jobRoleId,
    },
  });
  if (allowedModuleIds.length > 0) {
    await prisma.learningPathModule.createMany({
      data: allowedModuleIds.map((moduleId, i) => ({
        learning_path_id: path.id,
        module_id: moduleId,
        order_index: i + 1,
      })),
    });
  }
  await prisma.learningPathCompetency.create({
    data: {
      learning_path_id: path.id,
      competencies: input.competencies as object[],
      job_profile_text: input.jobProfileText || null,
    },
  });
  return { path, moduleCount: input.selectedModuleIds.length };
}
