"use client";
/**
 * /learning/manage/media — Media-bibliotheek / Brand Kit (LMS 1:1 P5, port
 * van productie BrandKit.tsx): media uploaden (Office → automatisch ook PDF),
 * hernoemen/taggen, verwijderen en URL kopiëren voor gebruik in modules.
 */
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast, ToastContainer } from "react-toastify";
import authMiddleware from "@/middleware/authMiddleware";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import {
  ChevronLeftIcon,
  TrashIcon,
  ClipboardIcon,
  DocumentIcon,
  FilmIcon,
  PhotoIcon,
  PresentationChartBarIcon,
} from "@heroicons/react/24/outline";

type MediaItem = {
  id: string;
  name: string;
  type: string;
  url: string;
  pdf_url: string | null;
  file_size: number | null;
  tags: string[] | null;
  created_at: string;
};

function typeIcon(type: string) {
  switch (type) {
    case "video":
      return <FilmIcon className="tw-w-6 tw-h-6" />;
    case "image":
      return <PhotoIcon className="tw-w-6 tw-h-6" />;
    case "presentation":
      return <PresentationChartBarIcon className="tw-w-6 tw-h-6" />;
    default:
      return <DocumentIcon className="tw-w-6 tw-h-6" />;
  }
}

function MediaLibraryPage() {
  const router = useRouter();
  const { t } = useTranslation("common");
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    fetch("/api/learning/media", { headers })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((res) => setItems(res.data || []))
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);

  const upload = async (file: File | null) => {
    if (!file) return;
    const headers = getAuthHeaders({}, true);
    if (!headers) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/learning/media", {
        method: "POST",
        headers,
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || "upload_failed");
      toast.success(t("learning.uploadSuccess"));
      load();
    } catch (e: any) {
      toast.error(
        e?.message === "conversion_failed"
          ? t("learning.mediaConversionFailed")
          : t("learning.uploadFailed"),
      );
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id: string) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    const res = await fetch(`/api/learning/media/${id}`, {
      method: "DELETE",
      headers,
    });
    if (res.ok) load();
  };

  const copyUrl = (url: string) => {
    navigator.clipboard?.writeText(url).then(
      () => toast.success(t("learning.mediaUrlCopied")),
      () => toast.error("Error"),
    );
  };

  return (
    <div className="tw-p-6 tw-max-w-5xl tw-mx-auto">
      <ToastContainer position="top-right" autoClose={3000} />
      <button
        onClick={() => router.push("/learning/manage")}
        className="tw-flex tw-items-center tw-gap-1 tw-text-sm tw-text-gray-500 hover:tw-text-gray-800 tw-mb-4"
      >
        <ChevronLeftIcon className="tw-w-4 tw-h-4" /> {t("learning.manage")}
      </button>
      <div className="tw-flex tw-items-center tw-justify-between tw-mb-2">
        <h1 className="tw-text-2xl tw-font-bold tw-text-gray-900">
          {t("learning.mediaLibrary")}
        </h1>
        <label className="tw-flex tw-items-center tw-gap-2 tw-bg-[#5971F6] tw-text-white tw-rounded-full tw-px-5 tw-py-2 tw-text-sm tw-font-semibold tw-cursor-pointer hover:tw-bg-blue-700">
          <input
            type="file"
            className="tw-hidden"
            disabled={uploading}
            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,image/*,video/*"
            onChange={(e) => upload(e.target.files?.[0] || null)}
          />
          {uploading ? `⏳ ${t("learning.uploading")}` : `⬆ ${t("learning.mediaUpload")}`}
        </label>
      </div>
      <p className="tw-text-sm tw-text-gray-500 tw-mb-6">
        {t("learning.mediaLibraryNote")}
      </p>

      {loading ? (
        <div className="tw-flex tw-justify-center tw-py-20">
          <div className="tw-animate-spin tw-rounded-full tw-h-8 tw-w-8 tw-border-b-2 tw-border-[#5971F6]" />
        </div>
      ) : items.length === 0 ? (
        <p className="tw-text-gray-400 tw-text-center tw-py-16">
          {t("learning.mediaEmpty")}
        </p>
      ) : (
        <div className="tw-grid sm:tw-grid-cols-2 lg:tw-grid-cols-3 tw-gap-3">
          {items.map((m) => (
            <div
              key={m.id}
              className="tw-bg-white tw-border tw-border-gray-200 tw-rounded-2xl tw-p-4 tw-flex tw-flex-col tw-gap-2"
            >
              <div className="tw-flex tw-items-center tw-gap-3">
                <span className="tw-text-[#5971F6]">{typeIcon(m.type)}</span>
                <div className="tw-min-w-0">
                  <p className="tw-font-semibold tw-text-sm tw-text-gray-900 tw-truncate">
                    {m.name}
                  </p>
                  <p className="tw-text-[11px] tw-text-gray-400">
                    {m.type}
                    {m.file_size
                      ? ` · ${(m.file_size / 1024 / 1024).toFixed(1)}MB`
                      : ""}
                  </p>
                </div>
              </div>
              <div className="tw-flex tw-items-center tw-gap-2 tw-mt-auto">
                <button
                  onClick={() => copyUrl(m.url)}
                  className="tw-flex tw-items-center tw-gap-1 tw-text-xs tw-font-semibold tw-text-[#5971F6] tw-bg-indigo-50 hover:tw-bg-indigo-100 tw-rounded-full tw-px-3 tw-py-1.5"
                >
                  <ClipboardIcon className="tw-w-3.5 tw-h-3.5" /> URL
                </button>
                {m.pdf_url && (
                  <button
                    onClick={() => copyUrl(m.pdf_url!)}
                    className="tw-flex tw-items-center tw-gap-1 tw-text-xs tw-font-semibold tw-text-[#5971F6] tw-bg-indigo-50 hover:tw-bg-indigo-100 tw-rounded-full tw-px-3 tw-py-1.5"
                  >
                    <ClipboardIcon className="tw-w-3.5 tw-h-3.5" /> PDF
                  </button>
                )}
                <a
                  href={m.url}
                  target="_blank"
                  rel="noreferrer"
                  className="tw-text-xs tw-text-gray-400 hover:tw-text-gray-700"
                >
                  ↗
                </a>
                <button
                  onClick={() => remove(m.id)}
                  className="tw-ml-auto tw-text-gray-400 hover:tw-text-red-500"
                >
                  <TrashIcon className="tw-w-4 tw-h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default authMiddleware(MediaLibraryPage, undefined, false, "learning_admin");
