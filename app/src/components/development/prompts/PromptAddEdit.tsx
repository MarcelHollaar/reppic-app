"use client";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supportedLanguages } from "@/configs/constants";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import { ToastContainer, toast } from "react-toastify";

type LangCode = "en" | "nl" | "de" | "fr" | "it" | "es";

type KnowledgeDoc = {
  type: "excel" | "text";
  fileName?: string;
  filePath?: string;
  fileSize?: number;
  uploadedAt?: string;
  fallbackText?: string;
};

const LANG_CODES = supportedLanguages.map((lang) => lang.code as LangCode);

const buildLangRecord = <T,>(value: T | null) => {
  return LANG_CODES.reduce((acc, code) => {
    (acc as any)[code] = value;
    return acc;
  }, {} as Record<LangCode, T | null>);
};

const ftpBaseUrl = (process.env.NEXT_PUBLIC_FTP_PUBLIC_URL || "").replace(/\/$/, "");

export default function PromptAddEdit() {
  const { t } = useTranslation("common");
  const [docs, setDocs] = useState<Record<LangCode, KnowledgeDoc | null>>(() => buildLangRecord<KnowledgeDoc>(null));
  const [pendingFiles, setPendingFiles] = useState<Record<LangCode, File | null>>(() => buildLangRecord<File>(null));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchAllPrompts();
  }, []);

  const fetchAllPrompts = async () => {
    try {
      const headers = getAuthHeaders() || { "Content-Type": "application/json" };
      const res = await fetch('/api/prompts?type=GET_PROMPTS&page=1&per_page=1000', { headers: headers as HeadersInit });
      if (!res.ok) return;
      const json = await res.json();
      const records = (json?.data?.records || []) as Array<any>;
      const next = buildLangRecord<KnowledgeDoc>(null);
      for (const record of records) {
        const lang = String(record.lang_code || '').slice(0, 2) as LangCode;
        if (!next[lang]) {
          next[lang] = parsePromptValue(record?.prompt);
        }
      }
      setDocs(next);
    } catch (error) {
      console.error('Failed to load prompts', error);
    }
  };

  const handleFileChange = (lang: LangCode, file: File | null) => {
    setPendingFiles((prev) => ({ ...prev, [lang]: file }));
  };

  const handleSave = async () => {
    const entries = Object.entries(pendingFiles).filter(([, file]) => file) as Array<[LangCode, File]>;
    if (!entries.length) {
      toast.error(t('errorMessages.fieldIsRequired', { field: 'Excel', defaultValue: 'Please select at least one Excel file.' }));
      return;
    }

    setIsSaving(true);
    try {
      const formData = new FormData();
      entries.forEach(([lang, file]) => {
        formData.append(lang, file);
      });
      const headers = getAuthHeaders({}, true) || {};
      const res = await fetch('/api/prompts', {
        method: 'POST',
        headers: headers as HeadersInit,
        body: formData,
      });
      if (res.ok) {
        toast.success(t('successMessages.elementUpdated', { element: 'Knowledge', defaultValue: 'Knowledge updated' }));
        setPendingFiles(buildLangRecord<File>(null));
        fetchAllPrompts();
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.message || t('errorMessages.somethingWentWrong', { defaultValue: 'Something went wrong' }));
      }
    } catch (error) {
      console.error('Failed to upload knowledge', error);
      toast.error(t('errorMessages.somethingWentWrong', { defaultValue: 'Something went wrong' }));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="tw-space-y-4">
      <ToastContainer />
      <p className="tw-text-sm tw-text-gray-600">
        {t('salescoach.knowledgeUploadHelper', 'Upload one Excel sheet per language. The SalesCoach will preload the sheet at startup and keep the context in memory.')}
      </p>
      <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4">
        {supportedLanguages.map((lang) => {
          const code = lang.code as LangCode;
          const current = docs[code];
          const selected = pendingFiles[code];
          const downloadUrl = current?.filePath && ftpBaseUrl ? `${ftpBaseUrl}/${current.filePath}`.replace(/\/+/g, '/') : null;
          return (
            <section key={lang.code} className="tw-border tw-rounded-2xl tw-p-4 tw-bg-white tw-space-y-3 tw-shadow-sm">
              <div className="tw-flex tw-items-center tw-justify-between">
                <div>
                  <p className="tw-text-sm tw-font-semibold tw-text-gray-700">{lang.label}</p>
                  <p className="tw-text-xs tw-text-gray-500">{t('salescoach.languageCodeLabel', { code: lang.code.toUpperCase(), defaultValue: lang.code.toUpperCase() })}</p>
                </div>
                <span className={`tw-text-xs tw-font-medium tw-rounded-full tw-px-2 tw-py-1 ${current?.type === 'excel' ? 'tw-bg-green-100 tw-text-green-700' : 'tw-bg-gray-100 tw-text-gray-600'}`}>
                  {current?.type === 'excel'
                    ? t('form.uploaded', { defaultValue: 'Uploaded' })
                    : t('form.notAvailable', { defaultValue: 'Not uploaded' })}
                </span>
              </div>
              <div className="tw-text-sm tw-space-y-1 tw-text-gray-700">
                {current?.type === 'excel' ? (
                  <>
                    <p className="tw-font-medium">{current.fileName || 'Excel document'}</p>
                    <p className="tw-text-xs tw-text-gray-500">
                      {current.uploadedAt ? new Date(current.uploadedAt).toLocaleString() : ''}
                      {current.fileSize ? ` • ${formatBytes(current.fileSize)}` : ''}
                    </p>
                    {downloadUrl && (
                      <a href={downloadUrl} target="_blank" rel="noreferrer" className="tw-text-xs tw-text-blue-600 hover:tw-underline">
                        {t('form.download', { defaultValue: 'Download' })} ({lang.label})
                      </a>
                    )}
                  </>
                ) : (
                  <p className="tw-text-xs tw-text-gray-500">
                    {current?.fallbackText
                      ? t('salescoach.legacyPromptFallback', 'Currently using the legacy text prompt for this language.')
                      : t('salescoach.noKnowledgeUploaded', 'No knowledge file uploaded yet.')}
                  </p>
                )}
                {selected && (
                  <p className="tw-text-xs tw-text-blue-600">{t('form.pendingUpload', { defaultValue: 'Pending upload' })}: {selected.name}</p>
                )}
              </div>
              <div className="tw-flex tw-items-center tw-gap-3">
                <label className="tw-flex-1 tw-inline-flex tw-justify-center tw-items-center tw-px-3 tw-py-2 tw-text-sm tw-font-medium tw-text-white tw-bg-blue-600 tw-rounded-lg hover:tw-bg-blue-700 tw-cursor-pointer">
                  {t('form.chooseFile', { defaultValue: 'Choose Excel' })}
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="tw-hidden"
                    onChange={(event) => handleFileChange(code, event.target.files?.[0] || null)}
                  />
                </label>
                {selected && (
                  <button
                    type="button"
                    onClick={() => handleFileChange(code, null)}
                    className="tw-text-xs tw-text-red-500 tw-font-medium"
                  >
                    {t('form.clear', { defaultValue: 'Clear' })}
                  </button>
                )}
              </div>
              <p className="tw-text-xs tw-text-gray-400">{t('salescoach.excelHint', 'Accepted formats: .xlsx, .xls')}</p>
            </section>
          );
        })}
      </div>

      <div className="tw-flex tw-justify-end tw-pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className={`tw-px-6 tw-py-2 tw-rounded-lg tw-font-medium tw-text-white ${isSaving ? 'tw-bg-blue-300 tw-cursor-not-allowed' : 'tw-bg-blue-600 hover:tw-bg-blue-700'}`}
        >
          {isSaving
            ? t('loadingMessages.saving', { defaultValue: 'Saving...' })
            : t('loadingMessages.save', { defaultValue: 'Save' })}
        </button>
      </div>
    </div>
  );
}

function parsePromptValue(value?: string | null): KnowledgeDoc | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.filePath) {
        return {
          type: 'excel',
          fileName: parsed.fileName,
          filePath: parsed.filePath,
          uploadedAt: parsed.uploadedAt,
          fileSize: parsed.fileSize,
        };
      }
    } catch (error) {
      console.warn('Failed to parse prompt payload', error);
    }
  }
  return { type: 'text', fallbackText: raw };
}

function formatBytes(value?: number) {
  if (!value) return '';
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB'];
  let size = value / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(1)} ${units[unit]}`;
}
