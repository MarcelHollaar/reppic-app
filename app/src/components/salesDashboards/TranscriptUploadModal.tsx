"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardBody, Typography, Button } from "@material-tailwind/react";
import { ArrowUpTrayIcon, XMarkIcon, DocumentTextIcon, CheckCircleIcon, ExclamationCircleIcon } from "@heroicons/react/24/outline";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import { fileToBase64 } from "./fileToBase64";

const LANGUAGE_OPTIONS = [
  { value: "nl", label: "Nederlands" },
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Français" },
  { value: "es", label: "Español" },
  { value: "it", label: "Italiano" },
];

interface Company {
  id: string | number;
  title: string;
}

interface TranscriptUploadModalProps {
  open: boolean;
  onClose: () => void;
  /** Pre-select a company — pass when opened from a company row */
  preselectedCompany?: Company | null;
}

type UploadStatus = "idle" | "uploading" | "success" | "error";

interface FileUploadState {
  file: File;
  status: UploadStatus;
  error?: string;
}

export function TranscriptUploadModal({ open, onClose, preselectedCompany }: TranscriptUploadModalProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [language, setLanguage] = useState<string>("nl");
  const [uploads, setUploads] = useState<FileUploadState[]>([]);
  const [dragging, setDragging] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load companies
  useEffect(() => {
    if (!open) return;
    const headers = getAuthHeaders() ?? undefined;
    fetch("/api/companies?per_page=200", { headers })
      .then((r) => r.json())
      .then((data) => {
        const list: Company[] = data?.data?.records || data?.records || data || [];
        setCompanies(list);
        if (preselectedCompany) {
          setSelectedCompanyId(String(preselectedCompany.id));
        } else if (list.length > 0 && !selectedCompanyId) {
          setSelectedCompanyId(String(list[0].id));
        }
      })
      .catch(() => {});
  }, [open]);

  // Apply preselection whenever it changes
  useEffect(() => {
    if (preselectedCompany) setSelectedCompanyId(String(preselectedCompany.id));
  }, [preselectedCompany]);

  const uploadFile = useCallback(async (file: File, index: number) => {
    setUploads((prev) => prev.map((u, i) => i === index ? { ...u, status: "uploading" } : u));

    try {
      const token = localStorage.getItem("token");
      const API_URL = process.env.NEXT_PUBLIC_DASHBOARD_API_URL || "http://localhost:5001";

      const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");
      let content: string;
      if (isPdf) {
        content = await fileToBase64(file);
      } else {
        content = await file.text();
      }

      const res = await fetch(`${API_URL}/api/transcripts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: file.name,
          content,
          isPdf,
          status: "pending",
          language,
          targetCompanyId: selectedCompanyId,
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Upload mislukt (${res.status})`);
      }

      setUploads((prev) => prev.map((u, i) => i === index ? { ...u, status: "success" } : u));
    } catch (e: any) {
      setUploads((prev) => prev.map((u, i) => i === index ? { ...u, status: "error", error: e.message } : u));
    }
  }, [language, selectedCompanyId]);

  const addFiles = (files: FileList | File[]) => {
    if (!selectedCompanyId) {
      setGlobalError("Selecteer eerst een bedrijf.");
      return;
    }
    setGlobalError(null);
    const arr = Array.from(files);
    const newEntries: FileUploadState[] = arr.map((f) => ({ file: f, status: "idle" }));
    setUploads((prev) => {
      const startIndex = prev.length;
      const next = [...prev, ...newEntries];
      // Kick off uploads
      newEntries.forEach((_, i) => {
        setTimeout(() => uploadFile(arr[i], startIndex + i), 0);
      });
      return next;
    });
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  };

  const handleClose = () => {
    setUploads([]);
    setGlobalError(null);
    onClose();
  };

  const pendingCount = uploads.filter((u) => u.status === "uploading" || u.status === "idle").length;
  const successCount = uploads.filter((u) => u.status === "success").length;

  if (!open) return null;

  return (
    <div className="tw-fixed tw-inset-0 tw-z-50 tw-flex tw-items-center tw-justify-center tw-bg-black/50 tw-p-4">
      <Card className="tw-w-full tw-max-w-xl tw-shadow-2xl">
        <CardBody className="tw-p-6">
          {/* Header */}
          <div className="tw-flex tw-items-start tw-justify-between tw-mb-5">
            <div>
              <Typography variant="h6" className="tw-font-semibold tw-text-blue-gray-900">
                Transcript uploaden voor bedrijf
              </Typography>
              <Typography variant="small" className="tw-text-blue-gray-500 tw-mt-0.5">
                Upload een verkoopgesprek transcript. De AI-analyse start automatisch.
              </Typography>
            </div>
            <button onClick={handleClose} className="tw-text-blue-gray-400 hover:tw-text-blue-gray-700 tw-ml-4">
              <XMarkIcon className="tw-w-5 tw-h-5" />
            </button>
          </div>

          {/* Company selector */}
          <div className="tw-mb-4">
            <Typography variant="small" className="tw-font-medium tw-text-blue-gray-700 tw-mb-1">
              Bedrijf *
            </Typography>
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="tw-w-full tw-rounded-lg tw-border tw-border-blue-gray-200 tw-px-3 tw-py-2 tw-text-sm tw-text-blue-gray-800 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-[#5971F6]"
            >
              <option value="">— Kies een bedrijf —</option>
              {companies.map((c) => (
                <option key={c.id} value={String(c.id)}>{c.title}</option>
              ))}
            </select>
          </div>

          {/* Language selector */}
          <div className="tw-mb-5">
            <Typography variant="small" className="tw-font-medium tw-text-blue-gray-700 tw-mb-1">
              Taal *
            </Typography>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="tw-w-full tw-rounded-lg tw-border tw-border-blue-gray-200 tw-px-3 tw-py-2 tw-text-sm tw-text-blue-gray-800 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-[#5971F6]"
            >
              {LANGUAGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`tw-border-2 tw-border-dashed tw-rounded-xl tw-p-6 tw-text-center tw-cursor-pointer tw-transition-colors ${
              dragging ? "tw-border-[#5971F6] tw-bg-blue-50" : "tw-border-blue-gray-200 hover:tw-border-[#5971F6] hover:tw-bg-blue-50/50"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".txt,.docx,.doc,.pdf"
              className="tw-hidden"
              onChange={(e) => { if (e.target.files) addFiles(e.target.files); }}
            />
            <ArrowUpTrayIcon className="tw-w-7 tw-h-7 tw-text-blue-gray-400 tw-mx-auto tw-mb-2" />
            <Typography variant="small" className="tw-font-medium tw-text-blue-gray-700">
              Sleep bestanden hier of klik om te selecteren
            </Typography>
            <Typography variant="small" className="tw-text-blue-gray-400 tw-text-xs tw-mt-0.5">
              Meerdere bestanden tegelijk mogelijk · TXT, DOCX, PDF
            </Typography>
          </div>

          {globalError && (
            <Typography variant="small" className="tw-text-red-500 tw-mt-2">{globalError}</Typography>
          )}

          {/* Upload list */}
          {uploads.length > 0 && (
            <div className="tw-mt-4 tw-space-y-2 tw-max-h-48 tw-overflow-y-auto">
              {uploads.map((u, i) => (
                <div key={i} className="tw-flex tw-items-center tw-gap-3 tw-p-2.5 tw-rounded-lg tw-bg-blue-gray-50">
                  <DocumentTextIcon className="tw-w-5 tw-h-5 tw-text-blue-gray-400 tw-flex-shrink-0" />
                  <Typography variant="small" className="tw-flex-1 tw-truncate tw-text-blue-gray-700">
                    {u.file.name}
                  </Typography>
                  <div className="tw-flex-shrink-0">
                    {u.status === "uploading" && (
                      <div className="tw-w-4 tw-h-4 tw-border-2 tw-border-[#5971F6] tw-border-t-transparent tw-rounded-full tw-animate-spin" />
                    )}
                    {u.status === "success" && (
                      <CheckCircleIcon className="tw-w-5 tw-h-5 tw-text-green-500" />
                    )}
                    {u.status === "error" && (
                      <div className="tw-flex tw-items-center tw-gap-1">
                        <ExclamationCircleIcon className="tw-w-5 tw-h-5 tw-text-red-500" />
                        <Typography variant="small" className="tw-text-red-500 tw-text-xs tw-max-w-[120px] tw-truncate">
                          {u.error}
                        </Typography>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer summary + close */}
          <div className="tw-flex tw-items-center tw-justify-between tw-mt-5">
            <div>
              {successCount > 0 && pendingCount === 0 && (
                <Typography variant="small" className="tw-text-green-600 tw-font-medium">
                  {successCount} transcript{successCount !== 1 ? "s" : ""} geüpload — AI-analyse gestart.
                </Typography>
              )}
              {pendingCount > 0 && (
                <Typography variant="small" className="tw-text-blue-gray-500">
                  {pendingCount} bestand{pendingCount !== 1 ? "en" : ""} worden verwerkt…
                </Typography>
              )}
            </div>
            <Button
              size="sm"
              variant={pendingCount === 0 && successCount > 0 ? "filled" : "outlined"}
              color="blue-gray"
              onClick={handleClose}
            >
              {pendingCount === 0 && successCount > 0 ? "Sluiten" : "Annuleren"}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
