"use client";
/**
 * /learning/library — kennisbibliotheek (uitbreiding B; add-on B5).
 * Learner: bladeren, zoeken, favorieten, documenten openen.
 * learning_admin/superadmin: bovendien uploaden, bewerken, verwijderen en
 * categorieën beheren. Gate = Company.has_knowledge_access (server-side).
 */
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast, ToastContainer } from "react-toastify";
import authMiddleware from "@/middleware/authMiddleware";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import {
  ChevronLeftIcon,
  DocumentTextIcon,
  FilmIcon,
  LinkIcon,
  PencilIcon,
  PlusIcon,
  PresentationChartBarIcon,
  StarIcon as StarOutline,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarSolid } from "@heroicons/react/24/solid";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import DropdownCloseIcon from "@/components/DropdownCloseIcon";
import CompanyPicker from "@/components/learning/CompanyPicker";

type Category = { id: string; name: string; _count: { documents: number } };
type Doc = {
  id: string;
  title: string;
  description: string | null;
  content_type: string;
  file_url: string | null;
  external_url: string | null;
  view_count: number;
  is_published: boolean;
  is_favorite: boolean;
  category: { id: string; name: string } | null;
};

const typeIcon = (type: string) => {
  switch (type) {
    case "video":
      return <FilmIcon className="tw-w-5 tw-h-5" />;
    case "presentation":
      return <PresentationChartBarIcon className="tw-w-5 tw-h-5" />;
    case "link":
      return <LinkIcon className="tw-w-5 tw-h-5" />;
    default:
      return <DocumentTextIcon className="tw-w-5 tw-h-5" />;
  }
};

function LibraryPage() {
  const router = useRouter();
  const { t } = useTranslation("common");
  const [categories, setCategories] = useState<Category[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [noAccess, setNoAccess] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Doc | null>(null);
  const [editing, setEditing] = useState<Partial<Doc> | null>(null);
  const [editFile, setEditFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  // Superadmin: bibliotheek per bedrijf (superadmin-uitbreiding)
  const [companyId, setCompanyId] = useState<string | null>(null);
  const isSuperAdmin = useMemo(() => {
    try {
      return (
        JSON.parse(localStorage.getItem("user_data") || "{}")?.role?.name ===
        "superadmin"
      );
    } catch {
      return false;
    }
  }, []);

  const isAdmin = useMemo(() => {
    try {
      const u = JSON.parse(localStorage.getItem("user_data") || "{}");
      return (
        u?.role?.name === "superadmin" || u?.learning_role === "learning_admin"
      );
    } catch {
      return false;
    }
  }, []);

  const load = () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    // Superadmin zonder gekozen bedrijf: wachten tot de kiezer een keuze zet.
    if (isSuperAdmin && !companyId) return;
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (categoryFilter) params.set("category", categoryFilter);
    if (companyId) params.set("company_id", companyId);
    const catParams = companyId ? `?company_id=${encodeURIComponent(companyId)}` : "";
    Promise.all([
      fetch(`/api/learning/library/categories${catParams}`, { headers }),
      fetch(`/api/learning/library/documents?${params}`, { headers }),
    ])
      .then(async ([c, d]) => {
        if (c.status === 402 || d.status === 402) {
          setNoAccess(true);
          return;
        }
        const cj = await c.json();
        const dj = await d.json();
        setCategories(cj.data || []);
        setDocs(dj.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [categoryFilter, companyId]);

  const toggleFavorite = async (doc: Doc) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    const res = await fetch(
      `/api/learning/library/documents/${doc.id}/favorite`,
      { method: "POST", headers },
    );
    if (res.ok) {
      const json = await res.json();
      setDocs((list) =>
        list.map((d) =>
          d.id === doc.id ? { ...d, is_favorite: json.data.is_favorite } : d,
        ),
      );
    }
  };

  const openDoc = async (doc: Doc) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    // View-teller + verse (volledige) URL ophalen.
    const qs = companyId ? `?company_id=${encodeURIComponent(companyId)}` : "";
    const res = await fetch(`/api/learning/library/documents/${doc.id}${qs}`, {
      headers,
    });
    if (!res.ok) return;
    const { data } = await res.json();
    const url = data.external_url || data.file_url;
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  const save = async () => {
    if (!editing?.title?.trim()) return;
    const headers = getAuthHeaders({}, true);
    if (!headers) return;
    setSaving(true);
    const fd = new FormData();
    if (editing.id) fd.set("id", editing.id);
    fd.set("title", editing.title);
    fd.set("description", editing.description || "");
    fd.set("category_id", editing.category?.id || (editing as any).category_id || "");
    fd.set("content_type", editing.content_type || "document");
    fd.set("external_url", editing.external_url || "");
    if (editFile) fd.set("file", editFile);
    const saveQs = companyId ? `?company_id=${encodeURIComponent(companyId)}` : "";
    const res = await fetch(`/api/learning/library/documents${saveQs}`, {
      method: "POST",
      headers,
      body: fd,
    });
    setSaving(false);
    if (res.ok) {
      toast.success("✓");
      setEditing(null);
      setEditFile(null);
      load();
    } else {
      const j = await res.json().catch(() => ({}));
      toast.error(j.message || "Error");
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    const headers = getAuthHeaders();
    if (!headers) return;
    const delQs = companyId ? `?company_id=${encodeURIComponent(companyId)}` : "";
    const res = await fetch(
      `/api/learning/library/documents/${deleteTarget.id}${delQs}`,
      { method: "DELETE", headers },
    );
    if (res.ok) {
      toast.success("✓");
      load();
    } else {
      toast.error("Error");
    }
    setDeleteTarget(null);
  };

  const visible = docs.filter((d) => !onlyFavorites || d.is_favorite);

  const inputCls =
    "tw-w-full tw-px-4 tw-py-2 tw-rounded-xl tw-bg-white tw-border tw-border-gray-300 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 tw-text-sm";

  if (noAccess) {
    return (
      <div className="tw-p-6 tw-max-w-3xl tw-mx-auto tw-text-center tw-py-24">
        <h1 className="tw-text-xl tw-font-bold tw-text-gray-900 tw-mb-2">
          {t("learning.library")}
        </h1>
        <p className="tw-text-gray-500">{t("learning.noKnowledgeAccess")}</p>
      </div>
    );
  }

  return (
    <div className="tw-p-6 tw-max-w-6xl tw-mx-auto">
      <ToastContainer position="top-right" autoClose={3000} />
      <button
        onClick={() => router.push("/learning")}
        className="tw-flex tw-items-center tw-gap-1 tw-text-sm tw-text-gray-500 hover:tw-text-gray-800 tw-mb-4"
      >
        <ChevronLeftIcon className="tw-w-4 tw-h-4" /> {t("learning.title")}
      </button>
      <div className="tw-flex tw-items-center tw-justify-between tw-mb-5 tw-gap-3 tw-flex-wrap">
        <div className="tw-flex tw-items-center tw-gap-3 tw-flex-wrap">
          <h1 className="tw-text-2xl tw-font-bold tw-text-gray-900">
            {t("learning.library")}
          </h1>
          <CompanyPicker value={companyId} onChange={setCompanyId} />
        </div>
        {isAdmin && (
          <button
            onClick={() => {
              setEditing({ title: "", description: "", content_type: "document" });
              setEditFile(null);
            }}
            className="tw-flex tw-items-center tw-gap-1.5 tw-bg-[#5971F6] tw-text-white tw-rounded-full tw-px-4 tw-py-2 tw-text-sm tw-font-semibold hover:tw-bg-blue-700"
          >
            <PlusIcon className="tw-w-4 tw-h-4" /> {t("learning.addDocument")}
          </button>
        )}
      </div>

      {/* Zoeken + filters */}
      <div className="tw-flex tw-gap-2 tw-flex-wrap tw-mb-5">
        <input
          className={`${inputCls} tw-max-w-xs`}
          placeholder={t("learning.searchLibrary")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
        />
        <button
          onClick={() => setOnlyFavorites((v) => !v)}
          className={`tw-px-3 tw-py-1.5 tw-text-sm tw-rounded-full tw-border ${
            onlyFavorites
              ? "tw-bg-amber-100 tw-text-amber-700 tw-border-amber-300"
              : "tw-bg-white tw-text-gray-600 tw-border-gray-300"
          }`}
        >
          ★ {t("learning.favorites")}
        </button>
        <button
          onClick={() => setCategoryFilter(null)}
          className={`tw-px-3 tw-py-1.5 tw-text-sm tw-rounded-full tw-border ${
            !categoryFilter
              ? "tw-bg-[#5971F6] tw-text-white tw-border-[#5971F6]"
              : "tw-bg-white tw-text-gray-600 tw-border-gray-300"
          }`}
        >
          {t("learning.allCategories")}
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategoryFilter(c.id)}
            className={`tw-px-3 tw-py-1.5 tw-text-sm tw-rounded-full tw-border ${
              categoryFilter === c.id
                ? "tw-bg-[#5971F6] tw-text-white tw-border-[#5971F6]"
                : "tw-bg-white tw-text-gray-600 tw-border-gray-300"
            }`}
          >
            {c.name} ({c._count.documents})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="tw-flex tw-justify-center tw-py-20">
          <div className="tw-animate-spin tw-rounded-full tw-h-8 tw-w-8 tw-border-b-2 tw-border-[#5971F6]" />
        </div>
      ) : visible.length === 0 ? (
        <p className="tw-text-gray-500 tw-py-10 tw-text-center">
          {t("learning.noDocuments")}
        </p>
      ) : (
        <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 lg:tw-grid-cols-3 tw-gap-4">
          {visible.map((d) => (
            <div
              key={d.id}
              className="tw-bg-white tw-rounded-2xl tw-border tw-border-gray-200 tw-p-4 tw-flex tw-flex-col tw-gap-2"
            >
              <div className="tw-flex tw-items-start tw-gap-2">
                <span className="tw-text-[#5971F6] tw-mt-0.5">
                  {typeIcon(d.content_type)}
                </span>
                <button
                  onClick={() => openDoc(d)}
                  className="tw-flex-1 tw-text-left tw-font-semibold tw-text-gray-900 hover:tw-text-[#5971F6] tw-line-clamp-2"
                >
                  {d.title}
                </button>
                <button
                  onClick={() => toggleFavorite(d)}
                  className="tw-text-amber-400"
                  title={t("learning.favorites")}
                >
                  {d.is_favorite ? (
                    <StarSolid className="tw-w-5 tw-h-5" />
                  ) : (
                    <StarOutline className="tw-w-5 tw-h-5" />
                  )}
                </button>
              </div>
              {d.description && (
                <p className="tw-text-sm tw-text-gray-500 tw-line-clamp-2">
                  {d.description}
                </p>
              )}
              <div className="tw-flex tw-items-center tw-gap-2 tw-mt-auto tw-pt-1">
                <span className="tw-text-xs tw-text-gray-400">
                  {d.category?.name || "—"} · {d.view_count}×
                </span>
                <span className="tw-flex-1" />
                {isAdmin && (
                  <>
                    {!d.is_published && (
                      <span className="tw-text-[10px] tw-font-semibold tw-uppercase tw-bg-gray-100 tw-text-gray-500 tw-rounded-full tw-px-2 tw-py-0.5">
                        Concept
                      </span>
                    )}
                    <button
                      onClick={() => {
                        setEditing({ ...d });
                        setEditFile(null);
                      }}
                      className="tw-p-1 tw-text-gray-400 hover:tw-text-[#5971F6]"
                    >
                      <PencilIcon className="tw-w-4 tw-h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(d)}
                      className="tw-p-1 tw-text-gray-400 hover:tw-text-red-500"
                    >
                      <TrashIcon className="tw-w-4 tw-h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Document-dialog (beheer) */}
      {editing && (
        <div className="tw-fixed tw-inset-0 tw-z-50 tw-overflow-y-auto">
          <div className="tw-flex tw-items-center tw-justify-center tw-min-h-screen tw-px-4">
            <div
              className="tw-fixed tw-inset-0 tw-bg-black tw-bg-opacity-30"
              onClick={() => setEditing(null)}
            />
            <div className="tw-relative tw-bg-white tw-rounded-lg tw-shadow-xl tw-max-w-xl tw-w-full tw-p-8">
              <DropdownCloseIcon
                className="tw-top-4 tw-right-4"
                onClick={() => setEditing(null)}
              />
              <h2 className="tw-text-xl tw-font-bold tw-text-gray-900 tw-mb-4">
                {editing.id ? t("learning.editDocument") : t("learning.addDocument")}
              </h2>
              <div className="tw-flex tw-flex-col tw-gap-3">
                <input
                  className={inputCls}
                  placeholder={t("learning.title")}
                  value={editing.title || ""}
                  onChange={(e) =>
                    setEditing((s) => ({ ...s!, title: e.target.value }))
                  }
                />
                <textarea
                  className={`${inputCls} tw-h-16`}
                  placeholder={t("companiesListing.notes")}
                  value={editing.description || ""}
                  onChange={(e) =>
                    setEditing((s) => ({ ...s!, description: e.target.value }))
                  }
                />
                <div className="tw-grid tw-grid-cols-2 tw-gap-3">
                  <select
                    className={inputCls}
                    value={editing.content_type || "document"}
                    onChange={(e) =>
                      setEditing((s) => ({ ...s!, content_type: e.target.value }))
                    }
                  >
                    <option value="document">Document</option>
                    <option value="presentation">Presentation</option>
                    <option value="video">Video</option>
                    <option value="link">Link</option>
                  </select>
                  <select
                    className={inputCls}
                    value={(editing as any).category_id ?? editing.category?.id ?? ""}
                    onChange={(e) =>
                      setEditing((s) => ({ ...s!, category_id: e.target.value } as any))
                    }
                  >
                    <option value="">{t("learning.allCategories")}</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                {editing.content_type === "link" ? (
                  <input
                    className={inputCls}
                    placeholder="https://…"
                    value={editing.external_url || ""}
                    onChange={(e) =>
                      setEditing((s) => ({ ...s!, external_url: e.target.value }))
                    }
                  />
                ) : (
                  <input
                    type="file"
                    className="tw-text-sm"
                    onChange={(e) => setEditFile(e.target.files?.[0] || null)}
                  />
                )}
                <button
                  onClick={save}
                  disabled={saving || !editing.title?.trim()}
                  className={`tw-bg-[#5971F6] tw-text-white tw-rounded-full tw-px-6 tw-py-2.5 tw-font-semibold hover:tw-bg-blue-700 ${saving || !editing.title?.trim() ? "tw-opacity-50" : ""}`}
                >
                  {t("form.send")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <DeleteConfirmDialog
          isOpen={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          onConfirm={doDelete}
          entityName={deleteTarget.title}
        />
      )}
    </div>
  );
}

export default authMiddleware(LibraryPage, undefined, false, "learner");
