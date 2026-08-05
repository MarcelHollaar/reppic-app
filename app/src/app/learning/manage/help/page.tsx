"use client";
/**
 * /learning/manage/help — Help-center-beheer (LMS 1:1 P3, port van productie
 * AdminHelp.tsx + HelpCategoryManagement.tsx): artikelen en categorieën CRUD.
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
  PencilSquareIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

type Article = {
  id: string;
  title: string;
  content: string;
  excerpt: string | null;
  category_id: string | null;
  page_context: string | null;
  target_role: string;
  language: string;
  is_published: boolean;
  sort_order: number;
  view_count: number;
};

type Category = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
};

const emptyArticle = {
  title: "",
  content: "",
  excerpt: "",
  category_id: "",
  page_context: "",
  target_role: "all",
  language: "en",
  is_published: true,
  sort_order: 0,
};

function ManageHelpPage() {
  const router = useRouter();
  const { t } = useTranslation("common");
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<(typeof emptyArticle & { id?: string }) | null>(null);
  const [editingCat, setEditingCat] = useState<{ id?: string; name: string; icon: string; description: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const inputCls =
    "tw-w-full tw-border tw-border-gray-300 tw-rounded-lg tw-px-3 tw-py-2 tw-text-sm tw-mt-1 focus:tw-outline-none focus:tw-border-[#5971F6]";

  const load = () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    Promise.all([
      fetch("/api/learning/help/articles?all=1", { headers })
        .then((r) => (r.ok ? r.json() : { data: [] }))
        .then((res) => setArticles(res.data || [])),
      fetch("/api/learning/help/categories", { headers })
        .then((r) => (r.ok ? r.json() : { data: [] }))
        .then((res) => setCategories(res.data || [])),
    ]).finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);

  const saveArticle = async () => {
    if (!editing?.title.trim() || !editing.content.trim()) return;
    const headers = getAuthHeaders();
    if (!headers) return;
    setSaving(true);
    const payload = {
      ...editing,
      category_id: editing.category_id || null,
      page_context: editing.page_context || null,
      excerpt: editing.excerpt || null,
    };
    const res = await fetch(
      editing.id
        ? `/api/learning/help/articles/${editing.id}`
        : "/api/learning/help/articles",
      {
        method: editing.id ? "PUT" : "POST",
        headers,
        body: JSON.stringify(payload),
      },
    );
    setSaving(false);
    if (res.ok) {
      toast.success("✓");
      setEditing(null);
      load();
    } else {
      toast.error("Error");
    }
  };

  const deleteArticle = async (id: string) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    const res = await fetch(`/api/learning/help/articles/${id}`, {
      method: "DELETE",
      headers,
    });
    if (res.ok) load();
  };

  const saveCategory = async () => {
    if (!editingCat?.name.trim()) return;
    const headers = getAuthHeaders();
    if (!headers) return;
    setSaving(true);
    const res = await fetch(
      editingCat.id
        ? `/api/learning/help/categories/${editingCat.id}`
        : "/api/learning/help/categories",
      {
        method: editingCat.id ? "PUT" : "POST",
        headers,
        body: JSON.stringify(editingCat),
      },
    );
    setSaving(false);
    if (res.ok) {
      toast.success("✓");
      setEditingCat(null);
      load();
    } else {
      toast.error("Error");
    }
  };

  const deleteCategory = async (id: string) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    const res = await fetch(`/api/learning/help/categories/${id}`, {
      method: "DELETE",
      headers,
    });
    if (res.ok) load();
  };

  if (loading) {
    return (
      <div className="tw-flex tw-justify-center tw-py-20">
        <div className="tw-animate-spin tw-rounded-full tw-h-8 tw-w-8 tw-border-b-2 tw-border-[#5971F6]" />
      </div>
    );
  }

  return (
    <div className="tw-p-6 tw-max-w-5xl tw-mx-auto">
      <ToastContainer position="top-right" autoClose={3000} />
      <button
        onClick={() => router.push("/learning/manage")}
        className="tw-flex tw-items-center tw-gap-1 tw-text-sm tw-text-gray-500 hover:tw-text-gray-800 tw-mb-4"
      >
        <ChevronLeftIcon className="tw-w-4 tw-h-4" /> {t("learning.manage")}
      </button>
      <h1 className="tw-text-2xl tw-font-bold tw-text-gray-900 tw-mb-6">
        {t("learning.helpManage")}
      </h1>

      {/* Categorieën */}
      <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
        <h2 className="tw-text-lg tw-font-bold tw-text-gray-900">
          {t("learning.helpCategories")}
        </h2>
        <button
          onClick={() => setEditingCat({ name: "", icon: "", description: "" })}
          className="tw-flex tw-items-center tw-gap-1 tw-text-sm tw-font-semibold tw-text-[#5971F6]"
        >
          <PlusIcon className="tw-w-4 tw-h-4" /> {t("learning.addCategory")}
        </button>
      </div>
      <div className="tw-flex tw-flex-wrap tw-gap-2 tw-mb-8">
        {categories.map((c) => (
          <span
            key={c.id}
            className="tw-flex tw-items-center tw-gap-2 tw-bg-white tw-border tw-border-gray-200 tw-rounded-full tw-px-3 tw-py-1.5 tw-text-sm"
          >
            {c.icon ? `${c.icon} ` : ""}
            {c.name}
            <button
              onClick={() =>
                setEditingCat({
                  id: c.id,
                  name: c.name,
                  icon: c.icon || "",
                  description: c.description || "",
                })
              }
              className="tw-text-gray-400 hover:tw-text-gray-700"
            >
              <PencilSquareIcon className="tw-w-4 tw-h-4" />
            </button>
            <button
              onClick={() => deleteCategory(c.id)}
              className="tw-text-gray-400 hover:tw-text-red-500"
            >
              <TrashIcon className="tw-w-4 tw-h-4" />
            </button>
          </span>
        ))}
        {categories.length === 0 && (
          <span className="tw-text-sm tw-text-gray-400">—</span>
        )}
      </div>

      {editingCat && (
        <div className="tw-bg-white tw-border tw-border-gray-200 tw-rounded-2xl tw-p-5 tw-mb-8">
          <div className="tw-grid md:tw-grid-cols-3 tw-gap-3">
            <div>
              <label className="tw-text-sm tw-font-semibold tw-text-gray-800">
                {t("learning.name")}
              </label>
              <input
                className={inputCls}
                value={editingCat.name}
                onChange={(e) =>
                  setEditingCat({ ...editingCat, name: e.target.value })
                }
              />
            </div>
            <div>
              <label className="tw-text-sm tw-font-semibold tw-text-gray-800">
                Icon (emoji)
              </label>
              <input
                className={inputCls}
                value={editingCat.icon}
                onChange={(e) =>
                  setEditingCat({ ...editingCat, icon: e.target.value })
                }
                placeholder="📘"
              />
            </div>
            <div>
              <label className="tw-text-sm tw-font-semibold tw-text-gray-800">
                {t("companiesListing.notes")}
              </label>
              <input
                className={inputCls}
                value={editingCat.description}
                onChange={(e) =>
                  setEditingCat({ ...editingCat, description: e.target.value })
                }
              />
            </div>
          </div>
          <div className="tw-flex tw-gap-2 tw-mt-4">
            <button
              onClick={saveCategory}
              disabled={saving}
              className="tw-bg-[#5971F6] tw-text-white tw-rounded-full tw-px-5 tw-py-2 tw-text-sm tw-font-semibold"
            >
              {t("learning.save")}
            </button>
            <button
              onClick={() => setEditingCat(null)}
              className="tw-text-sm tw-text-gray-500"
            >
              {t("learning.cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Artikelen */}
      <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
        <h2 className="tw-text-lg tw-font-bold tw-text-gray-900">
          {t("learning.helpArticles")}
        </h2>
        <button
          onClick={() => setEditing({ ...emptyArticle })}
          className="tw-flex tw-items-center tw-gap-1 tw-text-sm tw-font-semibold tw-text-[#5971F6]"
        >
          <PlusIcon className="tw-w-4 tw-h-4" /> {t("learning.helpAddArticle")}
        </button>
      </div>

      {editing && (
        <div className="tw-bg-white tw-border tw-border-gray-200 tw-rounded-2xl tw-p-5 tw-mb-6">
          <div className="tw-grid md:tw-grid-cols-2 tw-gap-3 tw-mb-3">
            <div>
              <label className="tw-text-sm tw-font-semibold tw-text-gray-800">
                {t("learning.title")}
              </label>
              <input
                className={inputCls}
                value={editing.title}
                onChange={(e) =>
                  setEditing({ ...editing, title: e.target.value })
                }
              />
            </div>
            <div>
              <label className="tw-text-sm tw-font-semibold tw-text-gray-800">
                {t("learning.category")}
              </label>
              <select
                className={inputCls}
                value={editing.category_id}
                onChange={(e) =>
                  setEditing({ ...editing, category_id: e.target.value })
                }
              >
                <option value="">—</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="tw-mb-3">
            <label className="tw-text-sm tw-font-semibold tw-text-gray-800">
              {t("learning.helpExcerpt")}
            </label>
            <input
              className={inputCls}
              value={editing.excerpt}
              onChange={(e) =>
                setEditing({ ...editing, excerpt: e.target.value })
              }
            />
          </div>
          <div className="tw-mb-3">
            <label className="tw-text-sm tw-font-semibold tw-text-gray-800">
              Content
            </label>
            <textarea
              className={`${inputCls} tw-h-40`}
              value={editing.content}
              onChange={(e) =>
                setEditing({ ...editing, content: e.target.value })
              }
            />
          </div>
          <div className="tw-grid tw-grid-cols-2 md:tw-grid-cols-4 tw-gap-3 tw-mb-3">
            <div>
              <label className="tw-text-sm tw-font-semibold tw-text-gray-800">
                {t("learning.helpTargetRole")}
              </label>
              <select
                className={inputCls}
                value={editing.target_role}
                onChange={(e) =>
                  setEditing({ ...editing, target_role: e.target.value })
                }
              >
                <option value="all">{t("learning.helpRoleAll")}</option>
                <option value="learner">{t("learning.helpRoleLearner")}</option>
                <option value="admin">{t("learning.helpRoleAdmin")}</option>
              </select>
            </div>
            <div>
              <label className="tw-text-sm tw-font-semibold tw-text-gray-800">
                {t("learning.language")}
              </label>
              <select
                className={inputCls}
                value={editing.language}
                onChange={(e) =>
                  setEditing({ ...editing, language: e.target.value })
                }
              >
                {["en", "nl", "de", "fr", "es", "it"].map((l) => (
                  <option key={l} value={l}>
                    {l.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="tw-text-sm tw-font-semibold tw-text-gray-800">
                Page context
              </label>
              <input
                className={inputCls}
                value={editing.page_context}
                onChange={(e) =>
                  setEditing({ ...editing, page_context: e.target.value })
                }
                placeholder="/learning"
              />
            </div>
            <label className="tw-flex tw-items-end tw-gap-2 tw-pb-2 tw-cursor-pointer">
              <input
                type="checkbox"
                checked={editing.is_published}
                onChange={(e) =>
                  setEditing({ ...editing, is_published: e.target.checked })
                }
                className="tw-h-4 tw-w-4"
              />
              <span className="tw-text-sm tw-text-gray-700">
                {t("learning.published")}
              </span>
            </label>
          </div>
          <div className="tw-flex tw-gap-2">
            <button
              onClick={saveArticle}
              disabled={saving}
              className="tw-bg-[#5971F6] tw-text-white tw-rounded-full tw-px-5 tw-py-2 tw-text-sm tw-font-semibold"
            >
              {t("learning.save")}
            </button>
            <button
              onClick={() => setEditing(null)}
              className="tw-text-sm tw-text-gray-500"
            >
              {t("learning.cancel")}
            </button>
          </div>
        </div>
      )}

      <div className="tw-flex tw-flex-col tw-gap-2">
        {articles.map((a) => (
          <div
            key={a.id}
            className="tw-flex tw-items-center tw-justify-between tw-bg-white tw-border tw-border-gray-200 tw-rounded-xl tw-px-4 tw-py-3"
          >
            <div>
              <span className="tw-font-semibold tw-text-gray-900 tw-text-sm">
                {a.title}
              </span>
              <div className="tw-flex tw-gap-2 tw-text-[11px] tw-text-gray-400 tw-mt-0.5">
                <span>{a.language.toUpperCase()}</span>
                <span>· {a.target_role}</span>
                {!a.is_published && <span>· {t("learning.draft")}</span>}
                <span>· {a.view_count}× 👁</span>
              </div>
            </div>
            <div className="tw-flex tw-gap-2">
              <button
                onClick={() =>
                  setEditing({
                    id: a.id,
                    title: a.title,
                    content: a.content,
                    excerpt: a.excerpt || "",
                    category_id: a.category_id || "",
                    page_context: a.page_context || "",
                    target_role: a.target_role,
                    language: a.language,
                    is_published: a.is_published,
                    sort_order: a.sort_order,
                  })
                }
                className="tw-text-gray-400 hover:tw-text-gray-700"
              >
                <PencilSquareIcon className="tw-w-5 tw-h-5" />
              </button>
              <button
                onClick={() => deleteArticle(a.id)}
                className="tw-text-gray-400 hover:tw-text-red-500"
              >
                <TrashIcon className="tw-w-5 tw-h-5" />
              </button>
            </div>
          </div>
        ))}
        {articles.length === 0 && (
          <p className="tw-text-sm tw-text-gray-400">
            {t("learning.helpNoArticles")}
          </p>
        )}
      </div>
    </div>
  );
}

export default authMiddleware(ManageHelpPage, undefined, false, "learning_admin");
