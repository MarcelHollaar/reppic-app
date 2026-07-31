"use client";

import { Spinner } from "@/components/MaterialTailwind";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast, ToastContainer } from "react-toastify";

type LiteLLMModelRoute = {
  routeId: string;
  model: string;
  tag: string | null;
  upstream: string;
  label: string;
  usesAdaptiveThinking?: boolean;
};

type AnalysisModelSettings = {
  currentRouteId: string;
  currentModel: string;
  availableRoutes: LiteLLMModelRoute[];
  modelsLoadError?: string;
};

const AnalysisModelComponent = () => {
  const { t } = useTranslation("common");
  const [settings, setSettings] = useState<AnalysisModelSettings | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const dropdownOptions = useMemo(() => {
    if (!settings) return [];

    const options = [...settings.availableRoutes];

    if (
      settings.currentRouteId &&
      !options.some((route) => route.routeId === settings.currentRouteId)
    ) {
      options.unshift({
        routeId: settings.currentRouteId,
        model: settings.currentModel,
        tag: null,
        upstream: "",
        label: settings.currentModel,
      });
    }

    return options;
  }, [settings]);

  const currentRouteUnavailable =
    Boolean(settings?.currentRouteId) &&
    Boolean(settings?.availableRoutes.length) &&
    !settings?.availableRoutes.some(
      (route) => route.routeId === settings.currentRouteId,
    );

  const modelsLoadError = settings?.modelsLoadError;
  const isDropdownDisabled =
    Boolean(modelsLoadError) || dropdownOptions.length === 0;

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const headers = getAuthHeaders();
      const response = await fetch("/api/platform-settings/analysis-model", {
        method: "GET",
        headers,
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.message || t("analysisModelSettings.loadFailed"));
        return;
      }

      const data = result.data as AnalysisModelSettings;
      setSettings(data);
      setSelectedRouteId(data.currentRouteId);
    } catch (error) {
      toast.error(t("analysisModelSettings.loadFailed"));
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    if (isDropdownDisabled || !selectedRouteId) {
      return;
    }

    try {
      setIsSaving(true);
      const headers = getAuthHeaders();

      const response = await fetch("/api/platform-settings/analysis-model", {
        method: "PUT",
        headers,
        body: JSON.stringify({ routeId: selectedRouteId }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.message || t("analysisModelSettings.saveFailed"));
        return;
      }

      const savedRouteId = result.data?.currentRouteId as string;
      const savedLabel = result.data?.currentModel as string;

      setSettings((prev) =>
        prev
          ? {
              ...prev,
              currentRouteId: savedRouteId,
              currentModel: savedLabel,
              modelsLoadError: undefined,
            }
          : prev,
      );
      setSelectedRouteId(savedRouteId);
      toast.success(t("analysisModelSettings.saved"));
    } catch (error) {
      toast.error(t("analysisModelSettings.saveFailed"));
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="tw-flex tw-justify-center tw-items-center tw-h-48">
        <div className="tw-animate-spin tw-rounded-full tw-h-10 tw-w-10 tw-border-t-2 tw-border-b-2 tw-border-blue-500" />
      </div>
    );
  }

  return (
    <>
      <ToastContainer />
      <div className="tw-bg-white tw-rounded-3xl tw-shadow-md tw-py-6 tw-px-8">
        <h2 className="tw-text-lg tw-font-medium tw-mb-0 tw-font-[system-ui]">
          {t("analysisModelSettings.title")}
        </h2>
        <p className="tw-text-sm tw-text-[#667085] tw-font-normal tw-mt-2 tw-mb-4 tw-font-[system-ui]">
          {t("analysisModelSettings.scopeNote")}
        </p>

        {modelsLoadError && (
          <p className="tw-text-sm tw-text-red-600 tw-mb-4 tw-font-[system-ui]">
            {t("analysisModelSettings.modelsLoadError")}
          </p>
        )}

        {currentRouteUnavailable && (
          <p className="tw-text-sm tw-text-amber-600 tw-mb-4 tw-font-[system-ui]">
            {t("analysisModelSettings.modelNoLongerAvailable")}
          </p>
        )}

        <div className="tw-flex tw-flex-col sm:tw-flex-row sm:tw-items-center tw-gap-3">
          <label
            htmlFor="analysis-model-select"
            className="tw-text-sm tw-text-[#344054] tw-font-medium tw-font-[system-ui] tw-shrink-0"
          >
            {t("analysisModelSettings.selectModel")}
          </label>
          <select
            id="analysis-model-select"
            value={selectedRouteId}
            onChange={(event) => setSelectedRouteId(event.target.value)}
            disabled={isDropdownDisabled}
            className="tw-border tw-border-[#D0D5DD] tw-rounded-lg tw-px-3 tw-py-2 tw-text-sm tw-min-w-[320px] tw-max-w-full disabled:tw-opacity-50 disabled:tw-cursor-not-allowed"
          >
            {dropdownOptions.map((route) => (
              <option key={route.routeId} value={route.routeId}>
                {route.label}
              </option>
            ))}
          </select>
        </div>

        <div className="tw-w-full tw-flex tw-justify-center md:tw-justify-start tw-mt-6">
          <button
            type="button"
            onClick={saveSettings}
            disabled={isSaving || isDropdownDisabled || !selectedRouteId}
            className={`tw-px-4 tw-py-2 !tw-text-sm tw-text-white tw-bg-button tw-rounded-3xl ${
              isSaving || isDropdownDisabled || !selectedRouteId
                ? "tw-opacity-50 tw-cursor-not-allowed"
                : ""
            }`}
          >
            {isSaving ? (
              <Spinner className="tw-mx-7" />
            ) : (
              t("analysisModelSettings.save")
            )}
          </button>
        </div>
      </div>
    </>
  );
};

export default AnalysisModelComponent;
