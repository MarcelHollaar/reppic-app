"use client";
/**
 * Modelpicker voor de Kennisbibliotheek-embeddings (indexeren + semantisch
 * zoeken gebruiken hetzelfde model). Bij een modelwissel worden bestaande
 * documenten automatisch op de achtergrond geherindexeerd; dat staat expliciet
 * in de uitleg. Leegmaken = semantisch zoeken uit (tekst-fallback).
 */
import { Spinner } from "@/components/MaterialTailwind";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast, ToastContainer } from "react-toastify";

type EmbeddingsSettings = {
  currentModel: string;
  fromEnvDefault: boolean;
  explicitlyDisabled: boolean;
  indexedDocuments: number;
  availableModels: string[];
  modelsLoadError?: string;
};

const ENDPOINT = "/api/platform-settings/lms-embeddings-model";

// Zelfde sentinel als server-side: expliciet uit (wint van de env-default).
const DISABLED = "__disabled__";

const LmsEmbeddingsModelComponent = () => {
  const { t } = useTranslation("common");
  const [settings, setSettings] = useState<EmbeddingsSettings | null>(null);
  const [selectedModel, setSelectedModel] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const headers = getAuthHeaders();
    fetch(ENDPOINT, { method: "GET", headers: headers || undefined })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) {
          toast.error(result.message || t("analysisModelSettings.loadFailed"));
          return;
        }
        const data = result.data as EmbeddingsSettings;
        setSettings(data);
        setSelectedModel(
          data.explicitlyDisabled ? DISABLED : data.currentModel || DISABLED,
        );
      })
      .catch((error) => {
        toast.error(t("analysisModelSettings.loadFailed"));
        console.error(error);
      })
      .finally(() => setIsLoading(false));
  }, [t]);

  const saveSettings = async () => {
    try {
      setIsSaving(true);
      const headers = getAuthHeaders();
      const response = await fetch(ENDPOINT, {
        method: "PUT",
        headers: headers || undefined,
        body: JSON.stringify({ model: selectedModel }),
      });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.message || t("analysisModelSettings.saveFailed"));
        return;
      }
      const saved = result.data as EmbeddingsSettings;
      setSettings(saved);
      setSelectedModel(
        saved.explicitlyDisabled ? DISABLED : saved.currentModel || DISABLED,
      );
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

  const options = settings?.availableModels ?? [];
  // De huidige (env- of DB-)waarde altijd kiesbaar houden, ook als de lijst
  // hem niet teruggeeft (bv. gateway tijdelijk onbereikbaar).
  const dropdownOptions =
    settings?.currentModel && !options.includes(settings.currentModel)
      ? [settings.currentModel, ...options]
      : options;

  return (
    <>
      <ToastContainer />
      <div className="tw-bg-white tw-rounded-3xl tw-shadow-md tw-py-6 tw-px-8">
        <h2 className="tw-text-lg tw-font-medium tw-mb-0 tw-font-[system-ui]">
          {t("lmsModelSettings.embeddingsTitle")}
        </h2>
        <p className="tw-text-sm tw-text-[#667085] tw-font-normal tw-mt-2 tw-mb-2 tw-font-[system-ui]">
          {t("lmsModelSettings.embeddingsNote")}
        </p>
        <p className="tw-text-sm tw-text-amber-600 tw-mb-4 tw-font-[system-ui]">
          {t("lmsModelSettings.embeddingsReindexWarning", {
            count: settings?.indexedDocuments ?? 0,
          })}
        </p>

        {settings?.modelsLoadError && (
          <p className="tw-text-sm tw-text-red-600 tw-mb-4 tw-font-[system-ui]">
            {t("analysisModelSettings.modelsLoadError")}
          </p>
        )}
        {settings?.fromEnvDefault && (
          <p className="tw-text-sm tw-text-[#667085] tw-mb-4 tw-font-[system-ui]">
            {t("lmsModelSettings.embeddingsFromEnv")}
          </p>
        )}

        <div className="tw-flex tw-flex-col sm:tw-flex-row sm:tw-items-center tw-gap-3">
          <label className="tw-text-sm tw-text-[#344054] tw-font-medium tw-font-[system-ui] tw-shrink-0">
            {t("analysisModelSettings.selectModel")}
          </label>
          <select
            value={selectedModel}
            onChange={(event) => setSelectedModel(event.target.value)}
            className="tw-border tw-border-[#D0D5DD] tw-rounded-lg tw-px-3 tw-py-2 tw-text-sm tw-min-w-[320px] tw-max-w-full"
          >
            <option value={DISABLED}>
              {t("lmsModelSettings.embeddingsDisabled")}
            </option>
            {dropdownOptions.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </div>

        <div className="tw-w-full tw-flex tw-justify-center md:tw-justify-start tw-mt-6">
          <button
            type="button"
            onClick={saveSettings}
            disabled={isSaving}
            className={`tw-px-4 tw-py-2 !tw-text-sm tw-text-white tw-bg-button tw-rounded-3xl ${
              isSaving ? "tw-opacity-50 tw-cursor-not-allowed" : ""
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

export default LmsEmbeddingsModelComponent;
