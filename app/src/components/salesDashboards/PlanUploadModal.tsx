"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardBody, Typography, Button } from "@material-tailwind/react";
import { ArrowUpTrayIcon, TrashIcon, XMarkIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { useTranslation } from "react-i18next";
import { useDashboardApi } from "./useDashboardApi";
import { fileToBase64 } from "./fileToBase64";
import { PlanStructureReview } from "./PlanStructureReview";

interface PlanStatus {
  active: boolean;
  filename?: string;
  uploadedAt?: string;
}

interface ExtractedDoc {
  filename: string;
  text: string;
  chars: number;
}

interface PlanUploadModalProps {
  open: boolean;
  onClose: () => void;
  planType: "strategic" | "operational";
  title: string;
  description: string;
  onUploaded?: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_DASHBOARD_API_URL || "http://localhost:5001";
const PREVIEW_CHARS = 1500;

function detectFileType(file: File): "pdf" | "docx" | "doc" | "text" {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".docx")) return "docx";
  if (name.endsWith(".doc")) return "doc";
  return "text";
}

export function PlanUploadModal({ open, onClose, planType, title, description, onUploaded }: PlanUploadModalProps) {
  const { get } = useDashboardApi();
  const { t, i18n } = useTranslation("common");
  const lang = (i18n.language || "nl").split("-")[0];

  const [status, setStatus] = useState<PlanStatus>({ active: false });
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  // Step 2: extracted text awaiting the manager's confirmation before saving.
  const [extracted, setExtracted] = useState<ExtractedDoc | null>(null);
  // Step 3 (optional): AI structuring + manager review, or manual plan entry.
  const [structureMode, setStructureMode] = useState<null | "review" | "manual">(null);
  const [offerStructure, setOfferStructure] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setExtracted(null);
    setError(null);
    setSuccess(null);
    setStructureMode(null);
    setOfferStructure(false);
    get(`/api/plans/status/${lang}`)
      .then((data) => setStatus(data[planType] || { active: false }))
      .catch(() => {});
  }, [open, planType, get, lang]);

  // Step 1: parse the document server-side and show what was read (no save).
  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setSuccess(null);
    setExtracted(null);
    setExtracting(true);
    try {
      const fileType = detectFileType(file);
      let content: string;
      if (fileType === "pdf" || fileType === "docx" || fileType === "doc") {
        content = await fileToBase64(file);
      } else {
        content = await file.text();
      }

      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/plans/extract`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, content, fileType }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 413) throw new Error(t("plans.tooLarge"));
        if (res.status === 403) throw new Error(t("plans.noPermission"));
        throw new Error(d.error || t("plans.extractFailed", { status: res.status }));
      }
      setExtracted({ filename: file.name, text: d.text, chars: d.chars });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setExtracting(false);
    }
  }, [t]);

  // Step 2: the manager confirmed the preview — store the plan and trigger reanalysis.
  const handleConfirm = async () => {
    if (!extracted) return;
    setError(null);
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/plans/${planType}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: extracted.filename,
          content: extracted.text,
          language: lang,
          fileType: "text",
        }),
      });
      if (!res.ok) {
        if (res.status === 403) throw new Error(t("plans.noPermission"));
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || t("plans.uploadFailed", { status: res.status }));
      }
      setSuccess(t("plans.uploadSuccess", { filename: extracted.filename }));
      setStatus({ active: true, filename: extracted.filename, uploadedAt: new Date().toISOString() });
      setExtracted(null);
      setOfferStructure(true);
      onUploaded?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/plans/${planType}?lang=${lang}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (res.status === 403) throw new Error(t("plans.noPermission"));
        throw new Error(t("plans.deleteFailed"));
      }
      setStatus({ active: false });
      setSuccess(t("plans.deleteSuccess"));
      onUploaded?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeleting(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  if (!open) return null;

  return (
    <div className="tw-fixed tw-inset-0 tw-z-50 tw-flex tw-items-center tw-justify-center tw-bg-black/50 tw-p-4">
      <Card className="tw-w-full tw-max-w-lg tw-shadow-2xl tw-max-h-[90vh] tw-overflow-y-auto">
        <CardBody className="tw-p-6">
          {/* Header */}
          <div className="tw-flex tw-items-start tw-justify-between tw-mb-4">
            <div>
              <Typography variant="h6" className="tw-font-semibold tw-text-blue-gray-900">{title}</Typography>
              <Typography variant="small" className="tw-text-blue-gray-500 tw-mt-0.5">{description}</Typography>
            </div>
            <button onClick={onClose} className="tw-text-blue-gray-400 hover:tw-text-blue-gray-700 tw-ml-4">
              <XMarkIcon className="tw-w-5 tw-h-5" />
            </button>
          </div>

          {structureMode ? (
            /* Step 3: AI structuring review, or manual plan entry */
            <PlanStructureReview
              planType={planType}
              lang={lang}
              mode={structureMode}
              onDone={() => {
                if (structureMode === "manual") {
                  setStatus({ active: true, filename: t("plansReview.manualFilename"), uploadedAt: new Date().toISOString() });
                }
                setStructureMode(null);
                setOfferStructure(false);
                setSuccess(t("plansReview.confirmedSuccess"));
                onUploaded?.();
              }}
              onCancel={() => setStructureMode(null)}
            />
          ) : (
          <>
          {/* Current plan status */}
          {status.active && status.filename && !extracted && (
            <div className="tw-flex tw-items-center tw-gap-3 tw-p-4 tw-rounded-lg tw-bg-green-50 tw-border tw-border-green-200 tw-mb-4">
              <CheckCircleIcon className="tw-w-8 tw-h-8 tw-text-green-500 tw-flex-shrink-0" />
              <div className="tw-flex-1 tw-min-w-0">
                <Typography variant="small" className="tw-font-semibold tw-text-green-800 tw-truncate">{status.filename}</Typography>
                {status.uploadedAt && (
                  <Typography variant="small" className="tw-text-green-600 tw-text-xs">
                    {t("plans.uploadedOn", {
                      date: new Date(status.uploadedAt).toLocaleDateString(i18n.language, { day: "numeric", month: "short", year: "numeric" }),
                    })}
                  </Typography>
                )}
              </div>
              <div className="tw-flex tw-flex-col tw-gap-1 tw-flex-shrink-0">
                <Button
                  size="sm"
                  variant="outlined"
                  className="tw-flex tw-items-center tw-gap-1 tw-border-[#5971F6] tw-text-[#5971F6]"
                  onClick={() => setStructureMode("review")}
                >
                  {t("plansReview.editStructure")}
                </Button>
                <Button
                  size="sm"
                  variant="outlined"
                  color="red"
                  className="tw-flex tw-items-center tw-gap-1"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  <TrashIcon className="tw-w-4 tw-h-4" />
                  {deleting ? "..." : t("plans.delete")}
                </Button>
              </div>
            </div>
          )}

          {/* After a fresh upload: recommend the AI structuring step */}
          {offerStructure && !extracted && (
            <div className="tw-rounded-lg tw-border tw-border-[#5971F6]/30 tw-bg-blue-50/50 tw-p-3 tw-mb-4">
              <Typography variant="small" className="tw-text-blue-gray-700 tw-text-xs tw-mb-2">
                {t("plansReview.offer")}
              </Typography>
              <div className="tw-flex tw-gap-2">
                <Button size="sm" className="tw-bg-[#5971F6]" onClick={() => setStructureMode("review")}>
                  {t("plansReview.offerAccept")}
                </Button>
                <Button size="sm" variant="text" color="blue-gray" onClick={() => setOfferStructure(false)}>
                  {t("plansReview.offerSkip")}
                </Button>
              </div>
            </div>
          )}

          {extracted ? (
            /* Step 2: preview of the extracted text — confirm before saving */
            <div>
              <div className="tw-flex tw-items-center tw-gap-2 tw-mb-2">
                <DocumentTextIcon className="tw-w-5 tw-h-5 tw-text-blue-gray-500" />
                <Typography variant="small" className="tw-font-semibold tw-text-blue-gray-800 tw-truncate">
                  {extracted.filename}
                </Typography>
                <Typography variant="small" className="tw-text-blue-gray-400 tw-text-xs tw-flex-shrink-0">
                  {t("plans.charsRead", { count: extracted.chars })}
                </Typography>
              </div>
              <Typography variant="small" className="tw-text-blue-gray-600 tw-mb-2">
                {t("plans.previewIntro")}
              </Typography>
              <div className="tw-border tw-border-blue-gray-100 tw-rounded-lg tw-bg-blue-gray-50/50 tw-p-3 tw-max-h-56 tw-overflow-y-auto tw-whitespace-pre-wrap tw-text-xs tw-text-blue-gray-700">
                {extracted.text.slice(0, PREVIEW_CHARS)}
                {extracted.text.length > PREVIEW_CHARS && "…"}
              </div>
              <div className="tw-flex tw-justify-end tw-gap-2 tw-mt-4">
                <Button size="sm" variant="outlined" color="blue-gray" onClick={() => setExtracted(null)} disabled={saving}>
                  {t("plans.chooseOther")}
                </Button>
                <Button size="sm" className="tw-bg-[#5971F6]" onClick={handleConfirm} disabled={saving}>
                  {saving ? t("plans.saving") : t("plans.confirmActivate")}
                </Button>
              </div>
            </div>
          ) : (
            /* Step 1: drop zone */
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`tw-border-2 tw-border-dashed tw-rounded-xl tw-p-8 tw-text-center tw-cursor-pointer tw-transition-colors ${
                dragging ? "tw-border-[#5971F6] tw-bg-blue-50" : "tw-border-blue-gray-200 hover:tw-border-[#5971F6] hover:tw-bg-blue-50/50"
              }`}
            >
              <input ref={inputRef} type="file" accept=".pdf,.docx,.txt,.md" className="tw-hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
              <ArrowUpTrayIcon className="tw-w-8 tw-h-8 tw-text-blue-gray-400 tw-mx-auto tw-mb-2" />
              <Typography variant="small" className="tw-font-medium tw-text-blue-gray-700">
                {extracting ? t("plans.reading") : t("plans.dropHere")}
              </Typography>
              <Typography variant="small" className="tw-text-blue-gray-400 tw-text-xs tw-mt-1">
                {t("plans.supported")}
              </Typography>
            </div>
          )}

          {/* Manual entry: compose the plan without a document */}
          {!extracted && (
            <button
              type="button"
              onClick={() => setStructureMode("manual")}
              className="tw-mt-3 tw-text-xs tw-text-[#5971F6] hover:tw-underline"
            >
              {t("plansReview.manualLink")}
            </button>
          )}

          {/* Feedback */}
          {error && <Typography variant="small" className="tw-text-red-500 tw-mt-3">{error}</Typography>}
          {success && <Typography variant="small" className="tw-text-green-600 tw-mt-3">{success}</Typography>}
          </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
