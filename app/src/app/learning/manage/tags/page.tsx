"use client";
/**
 * /learning/manage/tags — los beheer van competentietags (LMS 1:1 P6, port
 * van productie TagManagement.tsx + /api/tags). Tags worden gebruikt voor de
 * module-competentiekoppeling en de embedding-leerpadmatching.
 */
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast, ToastContainer } from "react-toastify";
import authMiddleware from "@/middleware/authMiddleware";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import {
  ChevronLeftIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

type Tag = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  usage_count: number;
};

const CATEGORIES = [
  "product-knowledge",
  "service-knowledge",
  "market-knowledge",
  "sales-skills",
];

function ManageTagsPage() {
  const router = useRouter();
  const { t } = useTranslation("common");
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    fetch("/api/learning/tags", { headers })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((res) => setTags(res.data || []))
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);

  const addTag = async () => {
    if (!newName.trim()) return;
    const headers = getAuthHeaders();
    if (!headers) return;
    setSaving(true);
    const res = await fetch("/api/learning/tags", {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: newName,
        category: newCategory || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setNewName("");
      load();
    } else {
      const json = await res.json().catch(() => ({}));
      toast.error(json.message === "duplicate" ? t("learning.tagDuplicate") : "Error");
    }
  };

  const removeTag = async (id: string) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    const res = await fetch(`/api/learning/tags/${id}`, {
      method: "DELETE",
      headers,
    });
    if (res.ok) load();
  };

  return (
    <div className="tw-p-6 tw-max-w-4xl tw-mx-auto">
      <ToastContainer position="top-right" autoClose={3000} />
      <button
        onClick={() => router.push("/learning/manage")}
        className="tw-flex tw-items-center tw-gap-1 tw-text-sm tw-text-gray-500 hover:tw-text-gray-800 tw-mb-4"
      >
        <ChevronLeftIcon className="tw-w-4 tw-h-4" /> {t("learning.manage")}
      </button>
      <h1 className="tw-text-2xl tw-font-bold tw-text-gray-900 tw-mb-1">
        {t("learning.tags")}
      </h1>
      <p className="tw-text-sm tw-text-gray-500 tw-mb-6">
        {t("learning.tagsNote")}
      </p>

      <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2 tw-mb-6">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTag()}
          placeholder={t("learning.tagName")}
          className="tw-border tw-border-gray-300 tw-rounded-lg tw-px-3 tw-py-2 tw-text-sm focus:tw-outline-none focus:tw-border-[#5971F6]"
        />
        <select
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          className="tw-border tw-border-gray-300 tw-rounded-lg tw-px-3 tw-py-2 tw-text-sm"
        >
          <option value="">—</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          onClick={addTag}
          disabled={saving || !newName.trim()}
          className="tw-flex tw-items-center tw-gap-1 tw-bg-[#5971F6] tw-text-white tw-rounded-full tw-px-4 tw-py-2 tw-text-sm tw-font-semibold disabled:tw-opacity-50"
        >
          <PlusIcon className="tw-w-4 tw-h-4" /> {t("learning.addTag")}
        </button>
      </div>

      {loading ? (
        <div className="tw-flex tw-justify-center tw-py-16">
          <div className="tw-animate-spin tw-rounded-full tw-h-8 tw-w-8 tw-border-b-2 tw-border-[#5971F6]" />
        </div>
      ) : (
        <div className="tw-flex tw-flex-wrap tw-gap-2">
          {tags.map((tag) => (
            <span
              key={tag.id}
              className="tw-flex tw-items-center tw-gap-2 tw-bg-white tw-border tw-border-gray-200 tw-rounded-full tw-px-3 tw-py-1.5 tw-text-sm"
            >
              {tag.name}
              {tag.category && (
                <span className="tw-text-[10px] tw-text-gray-400">
                  {tag.category}
                </span>
              )}
              <button
                onClick={() => removeTag(tag.id)}
                className="tw-text-gray-400 hover:tw-text-red-500"
              >
                <TrashIcon className="tw-w-4 tw-h-4" />
              </button>
            </span>
          ))}
          {tags.length === 0 && (
            <span className="tw-text-sm tw-text-gray-400">—</span>
          )}
        </div>
      )}
    </div>
  );
}

export default authMiddleware(ManageTagsPage, undefined, false, "learning_admin");
