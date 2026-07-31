// Superadmin-chosen model for the DASHBOARD analysis. Mirrors the app's
// platformSettingsService (conversation-analysis model), but stores in the
// backend's own platform_settings table and defaults to DASHBOARD_LLM_MODEL
// (twinai/large). Route-aware: stores { routeId, model, tag } so the choice
// survives gateway renames; falls back to model+tag, then env, then twinai/large.
import { db } from "./db";
import { platformSettings } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { listAvailableModelRoutes, type LiteLLMModelRoute } from "./litellmModels";

const SETTING_KEY = "dashboard_litellm_model";
const DEFAULT_DASHBOARD_MODEL = "twinai/large";

type StoredRoute = { routeId: string; model: string; tag: string | null };

function getDefaultModelAlias(): string {
  return process.env.DASHBOARD_LLM_MODEL || DEFAULT_DASHBOARD_MODEL;
}
function getDefaultTag(): string | null {
  return process.env.DASHBOARD_LLM_TAG?.trim() || process.env.LITELLM_TAG?.trim() || "baseline";
}

function serializeStoredRoute(route: StoredRoute): string {
  return JSON.stringify(route);
}

function parseStoredRoute(value: string): StoredRoute | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as Partial<StoredRoute>;
    if (parsed.routeId && parsed.model) {
      return { routeId: parsed.routeId, model: parsed.model, tag: parsed.tag ?? null };
    }
  } catch {
    // Legacy plain model name before route-aware storage.
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
  const defaultTag = getDefaultTag();
  const byModelAndTag = available.find(
    (r) => r.model === stored.model && (stored.tag ? r.tag === stored.tag : r.tag === defaultTag),
  );
  if (byModelAndTag) return byModelAndTag;
  return available.find((r) => r.model === stored.model) ?? null;
}

function findDefaultRouteFromEnv(available: LiteLLMModelRoute[]): LiteLLMModelRoute | null {
  const model = getDefaultModelAlias();
  const tag = getDefaultTag();
  return (
    available.find((r) => r.model === model && r.tag === tag) ??
    available.find((r) => r.model === model) ??
    null
  );
}

function toRuntime(route: LiteLLMModelRoute): { model: string; tag: string | null; usesAdaptiveThinking: boolean } {
  return { model: route.model, tag: route.tag, usesAdaptiveThinking: route.usesAdaptiveThinking };
}

async function readSettingValue(): Promise<string | null> {
  const rows = await db.select().from(platformSettings).where(eq(platformSettings.key, SETTING_KEY));
  return rows[0]?.value ?? null;
}

async function writeSettingValue(value: string): Promise<void> {
  await db
    .insert(platformSettings)
    .values({ key: SETTING_KEY, value })
    .onConflictDoUpdate({ target: platformSettings.key, set: { value, updatedAt: sql`now()` } });
}

/** Resolved model+tag for the dashboard analysis at call time. */
export async function getDashboardLLMRoute(): Promise<{
  model: string;
  tag: string | null;
  usesAdaptiveThinking: boolean;
}> {
  const value = await readSettingValue();
  if (value?.trim()) {
    const stored = parseStoredRoute(value);
    if (stored) {
      try {
        const available = await listAvailableModelRoutes();
        const resolved = resolveStoredRoute(stored, available);
        if (resolved) return toRuntime(resolved);
      } catch {
        return { model: stored.model, tag: stored.tag ?? getDefaultTag(), usesAdaptiveThinking: false };
      }
      return { model: stored.model, tag: stored.tag ?? getDefaultTag(), usesAdaptiveThinking: false };
    }
  }
  try {
    const available = await listAvailableModelRoutes();
    const def = findDefaultRouteFromEnv(available);
    if (def) return toRuntime(def);
  } catch {
    // gateway unreachable -> env defaults
  }
  return { model: getDefaultModelAlias(), tag: getDefaultTag(), usesAdaptiveThinking: false };
}

export async function setDashboardLLMRoute(routeId: string): Promise<StoredRoute> {
  const trimmed = routeId.trim();
  if (!trimmed) throw new Error("Model route is required");
  const available = await listAvailableModelRoutes();
  if (available.length === 0) throw new Error("Could not load models from LiteLLM");
  const selected = available.find((r) => r.routeId === trimmed);
  if (!selected) throw new Error("Selected model route is not available in LiteLLM");
  const stored: StoredRoute = { routeId: selected.routeId, model: selected.model, tag: selected.tag };
  await writeSettingValue(serializeStoredRoute(stored));
  return stored;
}

export async function getDashboardModelSettings(): Promise<{
  currentRouteId: string;
  currentModel: string;
  availableRoutes: LiteLLMModelRoute[];
  modelsLoadError?: string;
}> {
  const value = await readSettingValue();
  const stored = value?.trim() ? parseStoredRoute(value) : null;
  try {
    const available = await listAvailableModelRoutes();
    const model = getDefaultModelAlias();
    const tag = getDefaultTag();
    const active = stored
      ? resolveStoredRoute(stored, available)
      : (available.find((r) => r.model === model && r.tag === tag) ??
        available.find((r) => r.model === model));
    return {
      currentRouteId: active?.routeId ?? "",
      currentModel: active?.label ?? getDefaultModelAlias(),
      availableRoutes: available,
      ...(available.length === 0 ? { modelsLoadError: "Could not load models from LiteLLM" } : {}),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load models from LiteLLM";
    return {
      currentRouteId: stored?.routeId ?? "",
      currentModel: stored?.model ?? getDefaultModelAlias(),
      availableRoutes: [],
      modelsLoadError: message,
    };
  }
}
