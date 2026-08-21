import { PLATFORM_SETTING_KEYS } from "@/configs/constants";
import { prisma } from "../utils/prisma";
import {
  listAvailableModelRoutes,
  type LiteLLMModelRoute,
} from "./litellmClient";

const DEFAULT_ANALYSIS_MODEL = "twinai/medium";

type StoredAnalysisRoute = {
  routeId: string;
  model: string;
  tag: string | null;
};

function getDefaultAnalysisModelAliasFromEnv(): string {
  return process.env.LITELLM_MODEL || DEFAULT_ANALYSIS_MODEL;
}

function getDefaultAnalysisRoutingTagFromEnv(): string | null {
  return process.env.LITELLM_TAG?.trim() || "baseline";
}

function serializeStoredRoute(storedAnalysisRoute: StoredAnalysisRoute): string {
  return JSON.stringify(storedAnalysisRoute);
}

function parseStoredRoute(value: string): StoredAnalysisRoute | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed) as Partial<StoredAnalysisRoute>;

    if (parsed.routeId && parsed.model) {
      return {
        routeId: parsed.routeId,
        model: parsed.model,
        tag: parsed.tag ?? null,
      };
    }
  } catch {
    // Legacy plain model name before route-aware storage.
  }

  return {
    routeId: "",
    model: trimmed,
    tag: null,
  };
}

function resolveStoredAnalysisRoute(
  storedAnalysisRoute: StoredAnalysisRoute,
  availableLiteLLMRoutes: LiteLLMModelRoute[],
): LiteLLMModelRoute | null {
  if (storedAnalysisRoute.routeId) {
    const routeMatchingStoredId = availableLiteLLMRoutes.find(
      (liteLLMRoute) => liteLLMRoute.routeId === storedAnalysisRoute.routeId,
    );
    if (routeMatchingStoredId) return routeMatchingStoredId;
  }

  const defaultRoutingTagFromEnv = getDefaultAnalysisRoutingTagFromEnv();

  const routeMatchingStoredModelAndTag = availableLiteLLMRoutes.find(
    (liteLLMRoute) =>
      liteLLMRoute.model === storedAnalysisRoute.model &&
      (storedAnalysisRoute.tag
        ? liteLLMRoute.tag === storedAnalysisRoute.tag
        : liteLLMRoute.tag === defaultRoutingTagFromEnv),
  );
  if (routeMatchingStoredModelAndTag) return routeMatchingStoredModelAndTag;

  return (
    availableLiteLLMRoutes.find(
      (liteLLMRoute) => liteLLMRoute.model === storedAnalysisRoute.model,
    ) ?? null
  );
}

function findDefaultAnalysisRouteFromEnvironment(
  availableLiteLLMRoutes: LiteLLMModelRoute[],
): LiteLLMModelRoute | null {
  const defaultModelAliasFromEnv = getDefaultAnalysisModelAliasFromEnv();
  const defaultRoutingTagFromEnv = getDefaultAnalysisRoutingTagFromEnv();

  return (
    availableLiteLLMRoutes.find(
      (liteLLMRoute) =>
        liteLLMRoute.model === defaultModelAliasFromEnv &&
        liteLLMRoute.tag === defaultRoutingTagFromEnv,
    ) ??
    availableLiteLLMRoutes.find(
      (liteLLMRoute) => liteLLMRoute.model === defaultModelAliasFromEnv,
    ) ??
    null
  );
}

function toAnalysisRouteRuntimeConfig(liteLLMRoute: LiteLLMModelRoute): {
  model: string;
  tag: string | null;
  usesAdaptiveThinking: boolean;
} {
  return {
    model: liteLLMRoute.model,
    // Val terug op de env-tag ("baseline") als de route zelf geen tag heeft.
    // Met een virtuele sleutel is /model/info geblokkeerd, dus routes komen kaal
    // uit /v1/models (tag=null); de gateway weigert een tag-loze analyse-call
    // met HTTP 500 ("'>' not supported between NoneType and int"). De overige
    // paden in getAnalysisLiteLLMRoute deden deze terugval al — dit sluit het gat.
    tag: liteLLMRoute.tag ?? getDefaultAnalysisRoutingTagFromEnv(),
    usesAdaptiveThinking: liteLLMRoute.usesAdaptiveThinking,
  };
}

export async function getAnalysisLiteLLMRoute(): Promise<{
  model: string;
  tag: string | null;
  usesAdaptiveThinking: boolean;
}> {
  const setting = await prisma.platformSetting.findUnique({
    where: { key: PLATFORM_SETTING_KEYS.ANALYSIS_LITELLM_MODEL },
  });

  if (setting?.value?.trim()) {
    const storedAnalysisRoute = parseStoredRoute(setting.value);
    if (storedAnalysisRoute) {
      try {
        const availableLiteLLMRoutes = await listAvailableModelRoutes();
        const resolvedLiteLLMRoute = resolveStoredAnalysisRoute(
          storedAnalysisRoute,
          availableLiteLLMRoutes,
        );

        if (resolvedLiteLLMRoute) {
          return toAnalysisRouteRuntimeConfig(resolvedLiteLLMRoute);
        }
      } catch {
        return {
          model: storedAnalysisRoute.model,
          tag:
            storedAnalysisRoute.tag ?? getDefaultAnalysisRoutingTagFromEnv(),
          usesAdaptiveThinking: false,
        };
      }

      return {
        model: storedAnalysisRoute.model,
        tag: storedAnalysisRoute.tag ?? getDefaultAnalysisRoutingTagFromEnv(),
        usesAdaptiveThinking: false,
      };
    }
  }

  try {
    const availableLiteLLMRoutes = await listAvailableModelRoutes();
    const defaultAnalysisRouteFromEnv =
      findDefaultAnalysisRouteFromEnvironment(availableLiteLLMRoutes);

    if (defaultAnalysisRouteFromEnv) {
      return toAnalysisRouteRuntimeConfig(defaultAnalysisRouteFromEnv);
    }
  } catch {
    // Fall through to env-only defaults when LiteLLM is unreachable.
  }

  return {
    model: getDefaultAnalysisModelAliasFromEnv(),
    tag: getDefaultAnalysisRoutingTagFromEnv(),
    usesAdaptiveThinking: false,
  };
}

export async function getAnalysisLiteLLMModel(): Promise<string> {
  const analysisRoute = await getAnalysisLiteLLMRoute();

  return analysisRoute.model;
}

export async function setAnalysisLiteLLMRoute(
  routeId: string,
): Promise<StoredAnalysisRoute> {
  const trimmedRouteId = routeId.trim();

  if (!trimmedRouteId) {
    throw new Error("Model route is required");
  }

  const availableLiteLLMRoutes = await listAvailableModelRoutes();

  if (availableLiteLLMRoutes.length === 0) {
    throw new Error("Could not load models from LiteLLM");
  }

  const selectedLiteLLMRoute = availableLiteLLMRoutes.find(
    (liteLLMRoute) => liteLLMRoute.routeId === trimmedRouteId,
  );

  if (!selectedLiteLLMRoute) {
    throw new Error("Selected model route is not available in LiteLLM");
  }

  const storedAnalysisRoute: StoredAnalysisRoute = {
    routeId: selectedLiteLLMRoute.routeId,
    model: selectedLiteLLMRoute.model,
    tag: selectedLiteLLMRoute.tag,
  };

  await prisma.platformSetting.upsert({
    where: { key: PLATFORM_SETTING_KEYS.ANALYSIS_LITELLM_MODEL },
    create: {
      key: PLATFORM_SETTING_KEYS.ANALYSIS_LITELLM_MODEL,
      value: serializeStoredRoute(storedAnalysisRoute),
    },
    update: { value: serializeStoredRoute(storedAnalysisRoute) },
  });

  return storedAnalysisRoute;
}

export async function getAnalysisModelSettings(): Promise<{
  currentRouteId: string;
  currentModel: string;
  availableRoutes: LiteLLMModelRoute[];
  modelsLoadError?: string;
}> {
  const setting = await prisma.platformSetting.findUnique({
    where: { key: PLATFORM_SETTING_KEYS.ANALYSIS_LITELLM_MODEL },
  });

  const storedAnalysisRoute = setting?.value?.trim()
    ? parseStoredRoute(setting.value)
    : null;

  try {
    const availableLiteLLMRoutes = await listAvailableModelRoutes();
    const defaultModelAliasFromEnv = getDefaultAnalysisModelAliasFromEnv();
    const defaultRoutingTagFromEnv = getDefaultAnalysisRoutingTagFromEnv();

    const activeLiteLLMRoute = storedAnalysisRoute
      ? resolveStoredAnalysisRoute(storedAnalysisRoute, availableLiteLLMRoutes)
      : (availableLiteLLMRoutes.find(
          (liteLLMRoute) =>
            liteLLMRoute.model === defaultModelAliasFromEnv &&
            liteLLMRoute.tag === defaultRoutingTagFromEnv,
        ) ??
        availableLiteLLMRoutes.find(
          (liteLLMRoute) => liteLLMRoute.model === defaultModelAliasFromEnv,
        ));

    return {
      currentRouteId: activeLiteLLMRoute?.routeId ?? "",
      currentModel:
        activeLiteLLMRoute?.label ?? getDefaultAnalysisModelAliasFromEnv(),
      availableRoutes: availableLiteLLMRoutes,
      ...(availableLiteLLMRoutes.length === 0
        ? { modelsLoadError: "Could not load models from LiteLLM" }
        : {}),
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not load models from LiteLLM";

    return {
      currentRouteId: storedAnalysisRoute?.routeId ?? "",
      currentModel:
        storedAnalysisRoute?.model ?? getDefaultAnalysisModelAliasFromEnv(),
      availableRoutes: [],
      modelsLoadError: message,
    };
  }
}

export const platformSettingsService = {
  getAnalysisLiteLLMModel,
  getAnalysisLiteLLMRoute,
  setAnalysisLiteLLMRoute,
  getAnalysisModelSettings,
};
