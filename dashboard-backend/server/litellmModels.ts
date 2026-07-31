// Lists the available analysis models from the LiteLLM gateway (/model/info).
// Ported verbatim from the app's litellmClient.ts (model-listing part only),
// so the dashboard-model picker offers exactly the same routes as the
// conversation-analysis picker. No completeChat here — the backend uses the
// OpenAI SDK pointed at the gateway for the actual analysis.

type ModelInfoEntry = {
  model_name?: string;
  litellm_params?: {
    model?: string;
    tags?: string[];
    thinking?: { type?: string; display?: string } | boolean;
  };
  model_info?: {
    id?: string;
    db_model?: boolean;
  };
};

type ModelInfoResponse = {
  data?: ModelInfoEntry[];
  error?: { message?: string };
};

export type LiteLLMModelRoute = {
  routeId: string;
  model: string;
  tag: string | null;
  upstream: string;
  label: string;
  isUiModel: boolean;
  usesAdaptiveThinking: boolean;
};

function routeUsesAdaptiveThinking(
  litellmParams: ModelInfoEntry["litellm_params"],
): boolean {
  const thinkingConfig = litellmParams?.thinking;
  if (!thinkingConfig) return false;

  if (typeof thinkingConfig === "object") {
    const thinkingModeType = thinkingConfig.type?.toLowerCase();
    return thinkingModeType === "adaptive" || thinkingModeType === "enabled";
  }

  return Boolean(thinkingConfig);
}

const TAG_ORDER = [
  "baseline",
  "eu",
  "openai",
  "anthropic",
  "mistral",
  "gemini",
  "kimi",
  "qwen",
] as const;

const TWINAI_TIER_ORDER = [
  "small",
  "medium",
  "large",
  "vision",
  "audio",
] as const;

/** Reppic conversation analysis uses text-only twinai chat tiers from config.yaml. */
const ANALYSIS_CHAT_TIERS = new Set<string>(["small", "medium", "large"]);

const NON_CHAT_TWINAI_TIERS = new Set<string>(["vision", "audio"]);

function isWildcardProxyRouteName(name: string): boolean {
  return name.endsWith("/*");
}

function isAnalysisModelRoute(route: LiteLLMModelRoute): boolean {
  if (isWildcardProxyRouteName(route.model)) return false;

  if (route.isUiModel) {
    if (route.model.startsWith("twinai/")) {
      const tier = route.model.slice("twinai/".length);
      return !NON_CHAT_TWINAI_TIERS.has(tier);
    }

    // Custom aliases added in the LiteLLM UI (any model_name + tag).
    return true;
  }

  if (!route.model.startsWith("twinai/")) return false;

  const tier = route.model.slice("twinai/".length);
  return ANALYSIS_CHAT_TIERS.has(tier);
}

function getLiteLLMConfig() {
  const baseUrl = process.env.LITELLM_BASE_URL;
  const apiKey = process.env.LITELLM_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error("LITELLM_BASE_URL and LITELLM_API_KEY must be set");
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    apiKey,
    model: process.env.LITELLM_MODEL || "twinai/medium",
    tag: process.env.LITELLM_TAG || "baseline",
  };
}

function isConfiguredProxyRoute(entry: ModelInfoEntry): boolean {
  const name = entry.model_name?.trim() ?? "";

  if (!name || isWildcardProxyRouteName(name)) return false;

  if (entry.model_info?.db_model === true) {
    return true;
  }

  return /^twinai\//.test(name);
}

export function formatRouteLabel(
  model: string,
  upstream: string,
  tag: string | null,
): string {
  const tagPrefix = tag ? `[${tag}] ` : "";
  return `${tagPrefix}${model} — ${upstream}`;
}

function toModelRoute(entry: ModelInfoEntry): LiteLLMModelRoute | null {
  const model = entry.model_name?.trim();
  const routeId = entry.model_info?.id?.trim();
  const upstream = entry.litellm_params?.model?.trim() ?? "";
  const tag = entry.litellm_params?.tags?.[0]?.trim() ?? null;
  const isUiModel = entry.model_info?.db_model === true;

  if (!model || !routeId || !upstream) return null;

  return {
    routeId,
    model,
    tag,
    upstream,
    label: formatRouteLabel(model, upstream, tag),
    isUiModel,
    usesAdaptiveThinking: routeUsesAdaptiveThinking(entry.litellm_params),
  };
}

function sortRoutesLikeLiteLLMUi(routes: LiteLLMModelRoute[]): LiteLLMModelRoute[] {
  return [...routes].sort((a, b) => {
    const rank = (route: LiteLLMModelRoute): [number, number, number, string] => {
      if (route.isUiModel && !route.model.startsWith("twinai/")) {
        return [9000, 0, 0, route.label];
      }

      if (route.isUiModel || route.model.startsWith("twinai/")) {
        const tier = route.model.startsWith("twinai/")
          ? route.model.slice("twinai/".length)
          : "";
        const tagIndex = route.tag
          ? TAG_ORDER.indexOf(route.tag as (typeof TAG_ORDER)[number])
          : 999;
        const tierIndex = TWINAI_TIER_ORDER.indexOf(
          tier as (typeof TWINAI_TIER_ORDER)[number],
        );
        const group = route.isUiModel ? 5000 : 1000;

        return [
          group + (tagIndex >= 0 ? tagIndex : 999),
          tierIndex >= 0 ? tierIndex : 999,
          0,
          route.upstream,
        ];
      }

      return [8500, 0, 0, route.model];
    };

    const aRank = rank(a);
    const bRank = rank(b);

    for (let i = 0; i < aRank.length; i += 1) {
      if (aRank[i] < bRank[i]) return -1;
      if (aRank[i] > bRank[i]) return 1;
    }

    return 0;
  });
}

// Fallback for keys restricted to llm_api_routes: the OpenAI-compatible
// /v1/models endpoint is always allowed, but only returns model ids (no tags,
// thinking or db_model metadata). We build minimal routes from the ids.
async function listRoutesViaOpenAiModels(
  baseUrl: string,
  apiKey: string,
): Promise<LiteLLMModelRoute[]> {
  const response = await fetch(`${baseUrl}/v1/models`, {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    throw new Error(
      `LiteLLM /v1/models request failed with status ${response.status}`,
    );
  }

  const body = (await response.json()) as { data?: Array<{ id?: string }> };

  const routes = (body.data ?? [])
    .map((entry): LiteLLMModelRoute | null => {
      const model = entry.id?.trim();
      if (!model) return null;
      return {
        routeId: model,
        model,
        tag: null,
        upstream: model,
        label: model,
        isUiModel: false,
        usesAdaptiveThinking: false,
      };
    })
    .filter((route): route is LiteLLMModelRoute => route !== null)
    .filter(isAnalysisModelRoute);

  return sortRoutesLikeLiteLLMUi(routes);
}

export async function listAvailableModelRoutes(): Promise<LiteLLMModelRoute[]> {
  const { baseUrl, apiKey } = getLiteLLMConfig();

  // Prefer /model/info — rich metadata (tags, thinking, db_model), matches the
  // app's conversation-model picker. Requires a key allowed to call admin
  // routes. A virtual key restricted to llm_api_routes gets 403 here, so on any
  // failure (or an empty result) we fall back to /v1/models.
  try {
    const response = await fetch(`${baseUrl}/model/info`, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (response.ok) {
      const body = (await response.json()) as ModelInfoResponse;
      const routes = (body.data ?? [])
        .filter(isConfiguredProxyRoute)
        .map(toModelRoute)
        .filter((route): route is LiteLLMModelRoute => route !== null)
        .filter(isAnalysisModelRoute);

      if (routes.length > 0) return sortRoutesLikeLiteLLMUi(routes);
    }
  } catch {
    // fall through to /v1/models
  }

  return listRoutesViaOpenAiModels(baseUrl, apiKey);
}

