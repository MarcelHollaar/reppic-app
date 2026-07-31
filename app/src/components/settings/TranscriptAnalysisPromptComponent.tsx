"use client";

import { Spinner } from "@/components/MaterialTailwind";
import {
  EXPECTED_FASES,
  REQUIRED_FASE_KEYS,
  REQUIRED_JSON_KEYS,
  REQUIRED_PLACEHOLDERS,
  REQUIRED_WEERSTANDEN_KEYS,
  validateTranscriptAnalysisPrompt,
  type PromptValidationResult,
} from "@/lib/transcript-analysis/promptSchema";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast, ToastContainer } from "react-toastify";

type PromptVersion = {
  id: string;
  version: number;
  content: string;
  isActive: boolean;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
};

const API_BASE = "/api/platform-settings/transcript-analysis-prompt";

const TranscriptAnalysisPromptComponent = () => {
  const { t } = useTranslation("common");
  const [content, setContent] = useState("");
  const [note, setNote] = useState("");
  const [activeVersion, setActiveVersion] = useState<PromptVersion | null>(null);
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [loadingVersionId, setLoadingVersionId] = useState<string | null>(null);

  const validation = useMemo(
    (): PromptValidationResult => validateTranscriptAnalysisPrompt(content),
    [content],
  );

  const hasChanges = useMemo(() => {
    if (!activeVersion) return content.trim().length > 0;
    return content !== activeVersion.content;
  }, [activeVersion, content]);

  useEffect(() => {
    loadPromptData();
  }, []);

  const loadPromptData = async () => {
    try {
      const headers = getAuthHeaders();
      const [activeRes, versionsRes] = await Promise.all([
        fetch(API_BASE, { method: "GET", headers }),
        fetch(`${API_BASE}/versions`, { method: "GET", headers }),
      ]);

      const activeJson = await activeRes.json();
      const versionsJson = await versionsRes.json();

      if (!activeRes.ok) {
        toast.error(
          activeJson.message ||
            t("transcriptAnalysisPromptSettings.loadFailed"),
        );
        return;
      }

      if (!versionsRes.ok) {
        toast.error(
          versionsJson.message ||
            t("transcriptAnalysisPromptSettings.versionsLoadFailed"),
        );
        return;
      }

      const active = activeJson.data as PromptVersion | null;
      setActiveVersion(active);
      setContent(active?.content ?? "");
      setVersions((versionsJson.data as PromptVersion[]) ?? []);
    } catch (error) {
      toast.error(t("transcriptAnalysisPromptSettings.loadFailed"));
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const savePrompt = async () => {
    if (!validation.valid) {
      toast.error(t("transcriptAnalysisPromptSettings.validationFailed"));
      return;
    }

    try {
      setIsSaving(true);
      const headers = getAuthHeaders();
      const response = await fetch(API_BASE, {
        method: "POST",
        headers,
        body: JSON.stringify({ content, note, activate: true }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(
          result.message || t("transcriptAnalysisPromptSettings.saveFailed"),
        );
        return;
      }

      toast.success(t("transcriptAnalysisPromptSettings.saved"));
      setNote("");
      await loadPromptData();
    } catch (error) {
      toast.error(t("transcriptAnalysisPromptSettings.saveFailed"));
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const loadVersionIntoEditor = async (versionId: string) => {
    try {
      setLoadingVersionId(versionId);
      const headers = getAuthHeaders();
      const response = await fetch(`${API_BASE}/${versionId}`, {
        method: "GET",
        headers,
      });
      const result = await response.json();

      if (!response.ok) {
        toast.error(
          result.message ||
            t("transcriptAnalysisPromptSettings.versionLoadFailed"),
        );
        return;
      }

      const version = result.data as PromptVersion;
      setContent(version.content);
      setNote(version.note ?? "");
    } catch (error) {
      toast.error(t("transcriptAnalysisPromptSettings.versionLoadFailed"));
      console.error(error);
    } finally {
      setLoadingVersionId(null);
    }
  };

  const activateVersion = async (versionId: string) => {
    try {
      setActivatingId(versionId);
      const headers = getAuthHeaders();
      const response = await fetch(`${API_BASE}/${versionId}/activate`, {
        method: "PUT",
        headers,
      });
      const result = await response.json();

      if (!response.ok) {
        toast.error(
          result.message ||
            t("transcriptAnalysisPromptSettings.activateFailed"),
        );
        return;
      }

      toast.success(t("transcriptAnalysisPromptSettings.activated"));
      await loadPromptData();
    } catch (error) {
      toast.error(t("transcriptAnalysisPromptSettings.activateFailed"));
      console.error(error);
    } finally {
      setActivatingId(null);
    }
  };

  const resetToActive = () => {
    if (activeVersion) {
      setContent(activeVersion.content);
      setNote("");
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
          {t("transcriptAnalysisPromptSettings.title")}
        </h2>
        <p className="tw-text-sm tw-text-[#667085] tw-font-normal tw-mt-2 tw-mb-4 tw-font-[system-ui]">
          {t("transcriptAnalysisPromptSettings.scopeNote")}
        </p>

        {activeVersion && (
          <p className="tw-text-sm tw-text-[#344054] tw-mb-4 tw-font-[system-ui]">
            {t("transcriptAnalysisPromptSettings.activeVersion", {
              version: activeVersion.version,
            })}
          </p>
        )}

        <div className="tw-grid tw-grid-cols-1 xl:tw-grid-cols-[minmax(0,1fr)_320px] tw-gap-6">
          <div>
            <label
              htmlFor="transcript-analysis-prompt"
              className="tw-text-sm tw-text-[#344054] tw-font-medium tw-font-[system-ui] tw-block tw-mb-2"
            >
              {t("transcriptAnalysisPromptSettings.promptLabel")}
            </label>
            <textarea
              id="transcript-analysis-prompt"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className="tw-w-full tw-min-h-[420px] tw-border tw-border-[#D0D5DD] tw-rounded-lg tw-px-3 tw-py-2 tw-text-sm tw-font-mono tw-leading-5"
              spellCheck={false}
            />

            <label
              htmlFor="transcript-analysis-prompt-note"
              className="tw-text-sm tw-text-[#344054] tw-font-medium tw-font-[system-ui] tw-block tw-mt-4 tw-mb-2"
            >
              {t("transcriptAnalysisPromptSettings.noteLabel")}
            </label>
            <input
              id="transcript-analysis-prompt-note"
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t("transcriptAnalysisPromptSettings.notePlaceholder")}
              className="tw-w-full tw-border tw-border-[#D0D5DD] tw-rounded-lg tw-px-3 tw-py-2 tw-text-sm"
            />

            <div className="tw-w-full tw-flex tw-flex-wrap tw-gap-3 tw-mt-6">
              <button
                type="button"
                onClick={savePrompt}
                disabled={isSaving || !validation.valid || !hasChanges}
                className={`tw-px-4 tw-py-2 !tw-text-sm tw-text-white tw-bg-button tw-rounded-3xl ${
                  isSaving || !validation.valid || !hasChanges
                    ? "tw-opacity-50 tw-cursor-not-allowed"
                    : ""
                }`}
              >
                {isSaving ? (
                  <Spinner className="tw-mx-7" />
                ) : (
                  t("transcriptAnalysisPromptSettings.save")
                )}
              </button>

              <button
                type="button"
                onClick={resetToActive}
                disabled={!hasChanges}
                className={`tw-px-4 tw-py-2 !tw-text-sm tw-text-[#344054] tw-border tw-border-[#D0D5DD] tw-rounded-3xl ${
                  !hasChanges ? "tw-opacity-50 tw-cursor-not-allowed" : ""
                }`}
              >
                {t("transcriptAnalysisPromptSettings.reset")}
              </button>
            </div>
          </div>

          <div className="tw-space-y-4">
            <div
              className={`tw-rounded-xl tw-border tw-p-4 ${
                validation.valid
                  ? "tw-border-green-200 tw-bg-green-50"
                  : "tw-border-red-200 tw-bg-red-50"
              }`}
            >
              <h3 className="tw-text-sm tw-font-semibold tw-text-[#344054] tw-mb-2">
                {validation.valid
                  ? t("transcriptAnalysisPromptSettings.validationOk")
                  : t("transcriptAnalysisPromptSettings.validationErrors")}
              </h3>

              {validation.errors.length > 0 && (
                <ul className="tw-list-disc tw-pl-5 tw-space-y-1 tw-text-sm tw-text-red-700">
                  {validation.errors.map((issue) => (
                    <li key={`${issue.code}-${issue.message}`}>
                      {issue.message}
                    </li>
                  ))}
                </ul>
              )}

              {validation.warnings.length > 0 && (
                <div className="tw-mt-3">
                  <p className="tw-text-sm tw-font-medium tw-text-amber-800 tw-mb-1">
                    {t("transcriptAnalysisPromptSettings.validationWarnings")}
                  </p>
                  <ul className="tw-list-disc tw-pl-5 tw-space-y-1 tw-text-sm tw-text-amber-700">
                    {validation.warnings.map((issue) => (
                      <li key={`${issue.code}-${issue.message}`}>
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {validation.valid && validation.warnings.length === 0 && (
                <p className="tw-text-sm tw-text-green-700">
                  {t("transcriptAnalysisPromptSettings.validationReady")}
                </p>
              )}
            </div>

            <div className="tw-rounded-xl tw-border tw-border-[#EAECF0] tw-p-4">
              <h3 className="tw-text-sm tw-font-semibold tw-text-[#344054] tw-mb-2">
                {t("transcriptAnalysisPromptSettings.requiredStructure")}
              </h3>
              <p className="tw-text-xs tw-text-[#667085] tw-mb-2">
                {t("transcriptAnalysisPromptSettings.placeholders")}:{" "}
                {REQUIRED_PLACEHOLDERS.join(", ")}
              </p>
              <p className="tw-text-xs tw-text-[#667085] tw-mb-2">
                {t("transcriptAnalysisPromptSettings.jsonKeys")}:{" "}
                {REQUIRED_JSON_KEYS.join(", ")}
              </p>
              <p className="tw-text-xs tw-text-[#667085] tw-mb-2">
                {t("transcriptAnalysisPromptSettings.weerstandenKeys")}:{" "}
                {REQUIRED_WEERSTANDEN_KEYS.join(", ")}
              </p>
              <p className="tw-text-xs tw-text-[#667085] tw-mb-2">
                {t("transcriptAnalysisPromptSettings.faseKeys")}:{" "}
                {REQUIRED_FASE_KEYS.join(", ")}
              </p>
              <p className="tw-text-xs tw-text-[#667085]">
                {t("transcriptAnalysisPromptSettings.phaseCount", {
                  count: EXPECTED_FASES.length,
                })}
              </p>
            </div>

            <div className="tw-rounded-xl tw-border tw-border-[#EAECF0] tw-p-4">
              <h3 className="tw-text-sm tw-font-semibold tw-text-[#344054] tw-mb-3">
                {t("transcriptAnalysisPromptSettings.versionHistory")}
              </h3>

              {versions.length === 0 ? (
                <p className="tw-text-sm tw-text-[#667085]">
                  {t("transcriptAnalysisPromptSettings.noVersions")}
                </p>
              ) : (
                <ul className="tw-space-y-2">
                  {versions.map((version) => (
                    <li
                      key={version.id}
                      className="tw-flex tw-flex-col tw-gap-2 tw-border tw-border-[#EAECF0] tw-rounded-lg tw-p-3"
                    >
                      <div className="tw-flex tw-items-center tw-justify-between tw-gap-2">
                        <span className="tw-text-sm tw-font-medium tw-text-[#344054]">
                          v{version.version}
                          {version.isActive
                            ? ` (${t("transcriptAnalysisPromptSettings.active")})`
                            : ""}
                        </span>
                        <span className="tw-text-xs tw-text-[#667085]">
                          {new Date(version.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {version.note && (
                        <p className="tw-text-xs tw-text-[#667085]">
                          {version.note}
                        </p>
                      )}
                      <div className="tw-flex tw-flex-wrap tw-gap-2">
                        <button
                          type="button"
                          onClick={() => loadVersionIntoEditor(version.id)}
                          disabled={loadingVersionId === version.id}
                          className="tw-px-3 tw-py-1 tw-text-xs tw-rounded-full tw-border tw-border-[#D0D5DD]"
                        >
                          {loadingVersionId === version.id
                            ? t("transcriptAnalysisPromptSettings.loading")
                            : t("transcriptAnalysisPromptSettings.loadIntoEditor")}
                        </button>
                        {!version.isActive && (
                          <button
                            type="button"
                            onClick={() => activateVersion(version.id)}
                            disabled={activatingId === version.id}
                            className="tw-px-3 tw-py-1 tw-text-xs tw-rounded-full tw-bg-button tw-text-white"
                          >
                            {activatingId === version.id
                              ? t("transcriptAnalysisPromptSettings.loading")
                              : t("transcriptAnalysisPromptSettings.activate")}
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default TranscriptAnalysisPromptComponent;
