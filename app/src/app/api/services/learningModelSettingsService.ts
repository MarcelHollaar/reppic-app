/**
 * Modelkeuze voor de LMS-analyses (superadmin-instelbaar, per analyse):
 *
 *   1. AI-leerpadgeneratie   (chat)        key: lms_pathgen_litellm_model
 *   2. Module-vertalingen    (chat)        key: lms_translation_litellm_model
 *   3. Kennisbibliotheek     (embeddings)  key: lms_embeddings_model
 *
 * Zelfde opslag- en resolutiepatroon als de bestaande gespreksanalyse-picker
 * (platformSettingsService): route opgeslagen als JSON {routeId, model, tag} in
 * platform_settings, met terugval op de env-defaults. De embeddings-keuze is
 * een plat model-id (geen tag-routing) met terugval op
 * LEARNING_EMBEDDINGS_MODEL.
 */
import { PLATFORM_SETTING_KEYS } from "@/configs/constants";
import { prisma } from "../utils/prisma";
import {
  listAllModelIds,
  listAvailableModelRoutes,
  type LiteLLMModelRoute,
} from "./litellmClient";

export type LmsChatSettingKey =
  | typeof PLATFORM_SETTING_KEYS.LMS_PATHGEN_LITELLM_MODEL
  | typeof PLATFORM_SETTING_KEYS.LMS_TRANSLATION_LITELLM_MODEL
  | typeof PLATFORM_SETTING_KEYS.LMS_MODULEGEN_LITELLM_MODEL;

type StoredRoute = { routeId: string; model: string; tag: string | null };

export type LmsChatRouteConfig = {
  model?: string;
  tag?: string | null;
  usesAdaptiveThinking?: boolean;
};

function defaultChatModelFromEnv(): string {
  return process.env.LITELLM_MODEL || "twinai/medium";
}

function defaultChatTagFromEnv(): string | null {
  return process.env.LITELLM_TAG?.trim() || "baseline";
}

function parseStoredRoute(value: string): StoredRoute | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as Partial<StoredRoute>;
    if (parsed.routeId && parsed.model) {
      return {
        routeId: parsed.routeId,
        model: parsed.model,
        tag: parsed.tag ?? null,
      };
    }
  } catch {
    // Plat model-alias (legacy/handmatig gezet).
  }
  return { routeId: "", model: trimmed, tag: null };
}

function resolveStoredRoute(
  stored: StoredRoute,
  available: LiteLLMModelRoute[],
): LiteLLMModelRoute | null {
  if (stored.routeId) {
    const byId = available.find((r) => r.routeId === stored.routeId);
    if (byId) return byId;
  }
  const byModelAndTag = available.find(
    (r) =>
      r.model === stored.model &&
      (stored.tag ? r.tag === stored.tag : r.tag === defaultChatTagFromEnv()),
  );
  if (byModelAndTag) return byModelAndTag;
  return available.find((r) => r.model === stored.model) ?? null;
}

// ───────────────────────── Chat-analyses (leerpad, vertaling) ─────────────────

/**
 * Runtime-config voor een LMS-chat-analyse. Leeg object = geen keuze
 * opgeslagen → completeChat valt zelf terug op de env-defaults (zelfde gedrag
 * als vóór deze feature).
 */
export async function getLmsChatRoute(
  key: LmsChatSettingKey,
): Promise<LmsChatRouteConfig> {
  const setting = await prisma.platformSetting.findUnique({ where: { key } });
  if (!setting?.value?.trim()) return {};

  const stored = parseStoredRoute(setting.value);
  if (!stored) return {};

  try {
    const available = await listAvailableModelRoutes();
    const resolved = resolveStoredRoute(stored, available);
    if (resolved) {
      return {
        model: resolved.model,
        tag: resolved.tag,
        usesAdaptiveThinking: resolved.usesAdaptiveThinking,
      };
    }
  } catch {
    // Gateway onbereikbaar voor de lijst: gebruik de opgeslagen waarden as-is.
  }
  return { model: stored.model, tag: stored.tag };
}

export async function setLmsChatRoute(
  key: LmsChatSettingKey,
  routeId: string,
): Promise<StoredRoute> {
  const trimmed = routeId.trim();
  if (!trimmed) throw new Error("Model route is required");

  const available = await listAvailableModelRoutes();
  if (available.length === 0) {
    throw new Error("Could not load models from LiteLLM");
  }
  const selected = available.find((r) => r.routeId === trimmed);
  if (!selected) {
    throw new Error("Selected model route is not available in LiteLLM");
  }

  const stored: StoredRoute = {
    routeId: selected.routeId,
    model: selected.model,
    tag: selected.tag,
  };
  await prisma.platformSetting.upsert({
    where: { key },
    create: { key, value: JSON.stringify(stored) },
    update: { value: JSON.stringify(stored) },
  });
  return stored;
}

/** Instellingen voor de picker-UI van een LMS-chat-analyse. */
export async function getLmsChatModelSettings(key: LmsChatSettingKey): Promise<{
  currentRouteId: string;
  currentModel: string;
  availableRoutes: LiteLLMModelRoute[];
  modelsLoadError?: string;
}> {
  const setting = await prisma.platformSetting.findUnique({ where: { key } });
  const stored = setting?.value?.trim()
    ? parseStoredRoute(setting.value)
    : null;

  try {
    const available = await listAvailableModelRoutes();
    const active = stored
      ? resolveStoredRoute(stored, available)
      : (available.find(
          (r) =>
            r.model === defaultChatModelFromEnv() &&
            r.tag === defaultChatTagFromEnv(),
        ) ?? available.find((r) => r.model === defaultChatModelFromEnv()));

    return {
      currentRouteId: active?.routeId ?? "",
      currentModel: active?.label ?? defaultChatModelFromEnv(),
      availableRoutes: available,
      ...(available.length === 0
        ? { modelsLoadError: "Could not load models from LiteLLM" }
        : {}),
    };
  } catch (error) {
    return {
      currentRouteId: stored?.routeId ?? "",
      currentModel: stored?.model ?? defaultChatModelFromEnv(),
      availableRoutes: [],
      modelsLoadError:
        error instanceof Error
          ? error.message
          : "Could not load models from LiteLLM",
    };
  }
}

// ───────────────────────── Embeddings (kennisbibliotheek) ─────────────────────

/** Sentinel: superadmin heeft semantisch zoeken expliciet uitgezet (wint van env). */
export const EMBEDDINGS_DISABLED = "__disabled__";

/**
 * Actief embeddings-model: DB-keuze → env LEARNING_EMBEDDINGS_MODEL → null
 * (semantisch zoeken uit; tekst-fallback). De sentinel EMBEDDINGS_DISABLED
 * zet semantisch zoeken geforceerd uit, óók als de env een model heeft.
 */
export async function getLmsEmbeddingsModel(): Promise<string | null> {
  const setting = await prisma.platformSetting.findUnique({
    where: { key: PLATFORM_SETTING_KEYS.LMS_EMBEDDINGS_MODEL },
  });
  const fromDb = setting?.value?.trim();
  if (fromDb === EMBEDDINGS_DISABLED) return null;
  if (fromDb) return fromDb;
  return process.env.LEARNING_EMBEDDINGS_MODEL?.trim() || null;
}

export async function setLmsEmbeddingsModel(modelId: string): Promise<string> {
  const trimmed = modelId.trim();
  // Lege waarde = keuze wissen (terug naar env/uit).
  await prisma.platformSetting.upsert({
    where: { key: PLATFORM_SETTING_KEYS.LMS_EMBEDDINGS_MODEL },
    create: {
      key: PLATFORM_SETTING_KEYS.LMS_EMBEDDINGS_MODEL,
      value: trimmed,
    },
    update: { value: trimmed },
  });
  return trimmed;
}

/** Instellingen voor de embeddings-picker-UI. */
export async function getLmsEmbeddingsSettings(): Promise<{
  currentModel: string;
  fromEnvDefault: boolean;
  explicitlyDisabled: boolean;
  indexedDocuments: number;
  availableModels: string[];
  modelsLoadError?: string;
}> {
  const setting = await prisma.platformSetting.findUnique({
    where: { key: PLATFORM_SETTING_KEYS.LMS_EMBEDDINGS_MODEL },
  });
  const fromDb = setting?.value?.trim() || "";
  const explicitlyDisabled = fromDb === EMBEDDINGS_DISABLED;
  const envDefault = process.env.LEARNING_EMBEDDINGS_MODEL?.trim() || "";
  const currentModel = explicitlyDisabled ? "" : fromDb || envDefault;
  const indexedDocuments = await prisma.libraryDocumentEmbedding.count();

  const base = {
    currentModel,
    fromEnvDefault: !explicitlyDisabled && !fromDb && Boolean(envDefault),
    explicitlyDisabled,
    indexedDocuments,
  };

  try {
    const availableModels = await listAllModelIds();
    return { ...base, availableModels };
  } catch (error) {
    return {
      ...base,
      availableModels: [],
      modelsLoadError:
        error instanceof Error
          ? error.message
          : "Could not load models from LiteLLM",
    };
  }
}
