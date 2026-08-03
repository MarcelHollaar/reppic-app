"use client";
/**
 * /learning/manage/categories — leercategorieën-beheer (superadmin-uitbreiding).
 * Superadmin beheert globale categorieën (salesvaardigheden + kennis);
 * learning_admin alleen kennis-categorieën van het eigen bedrijf.
 */
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast, ToastContainer } from "react-toastify";
import authMiddleware from "@/middleware/authMiddleware";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import { useUserRole } from "@/hooks/useUserRole";
import { USER_ROLE } from "@/configs/constants";
import { ChevronLeftIcon, PencilIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";

type CategoryItem = {
  id: string;
  name: string;
  description: string | null;
  learning_path_type: "sales_skills" | "knowledge";
  company_id: string | null;
};

function ManageCategoriesPage() {
  const router = useRouter();
  const { t } = useTranslation("common");
  const userRole = useUserRole();
  const isSuperAdmin = userRole === USER_ROLE.SUPER_ADMIN;
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<CategoryItem | null>(null);
  const [form, setForm] = useState<{
    id?: string;
    name: string;
    description: string;
    learning_path_type: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    fetch("/api/learning/categories", { headers })
      .then((r) => r.json())
      .then((res) => setCategories(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const save = async () => {
    if (!form?.name.trim()) return;
    const headers = getAuthHeaders();
    if (!headers) return;
    setSaving(true);
    const res = await fetch(
      form.id
        ? `/api/learning/categories/${form.id}`
        : "/api/learning/categories",
      {
        method: form.id ? "PUT" : "POST",
        headers,
        body: JSON.stringify(form),
      },
    );
    setSaving(false);
    if (res.ok) {
      toast.success("✓");
      setForm(null);
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
    const res = await fetch(
      `/api/learning/categories/${deleteTarget.id}`,
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

  const inputCls =
    "tw-w-full tw-px-4 tw-py-2 tw-rounded-xl tw-bg-white tw-border tw-border-gray-300 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 tw-text-sm";

  return (
    <div className="tw-p-6 tw-max-w-4xl tw-mx-auto">
      <ToastContainer position="top-right" autoClose={3000} />
      <button
        onClick={() => router.push("/learning/manage")}
        className="tw-flex tw-items-center tw-gap-1 tw-text-sm tw-text-gray-500 hover:tw-text-gray-800 tw-mb-4"
      >
        <ChevronLeftIcon className="tw-w-4 tw-h-4" /> {t("learning.manageModules")}
      </button>
      <div className="tw-flex tw-items-center tw-justify-between tw-mb-6">
        <h1 className="tw-text-2xl tw-font-bold tw-text-gray-900">
          {t("learning.categories")}
        </h1>
        <button
          onClick={() =>
            setForm({
              name: "",
              description: "",
              learning_path_type: isSuperAdmin ? "sales_skills" : "knowledge",
            })
          }
          className="tw-flex tw-items-center tw-gap-1.5 tw-bg-[#5971F6] tw-text-white tw-rounded-full tw-px-4 tw-py-2 tw-text-sm tw-font-semibold hover:tw-bg-blue-700"
        >
          <PlusIcon className="tw-w-4 tw-h-4" /> {t("learning.addCategory")}
        </button>
      </div>

      {/* Inline formulier */}
      {form && (
        <div className="tw-bg-white tw-rounded-2xl tw-border tw-border-gray-200 tw-p-5 tw-mb-5 tw-flex tw-flex-col tw-gap-3">
          <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-3 tw-gap-3">
            <input
              className={inputCls}
              placeholder={t("learning.category")}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f!, name: e.target.value }))}
            />
            <input
              className={inputCls}
              placeholder={t("companiesListing.notes")}
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f!, description: e.target.value }))
              }
            />
            {/* Type alleen bij aanmaken kiesbaar (en sales_skills alleen superadmin) */}
            {!form.id && (
              <select
                className={inputCls}
                value={form.learning_path_type}
                onChange={(e) =>
                  setForm((f) => ({ ...f!, learning_path_type: e.target.value }))
                }
              >
                {isSuperAdmin && (
                  <option value="sales_skills">{t("learning.salesSkills")}</option>
                )}
                <option value="knowledge">{t("learning.knowledge")}</option>
              </select>
            )}
          </div>
          <div className="tw-flex tw-gap-2">
            <button
              onClick={save}
              disabled={saving || !form.name.trim()}
              className={`tw-bg-[#5971F6] tw-text-white tw-rounded-full tw-px-5 tw-py-2 tw-text-sm tw-font-semibold hover:tw-bg-blue-700 ${saving || !form.name.trim() ? "tw-opacity-50" : ""}`}
            >
              {t("form.send")}
            </button>
            <button
              onClick={() => setForm(null)}
              className="tw-text-sm tw-text-gray-500 hover:tw-text-gray-800"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="tw-flex tw-justify-center tw-py-20">
          <div className="tw-animate-spin tw-rounded-full tw-h-8 tw-w-8 tw-border-b-2 tw-border-[#5971F6]" />
        </div>
      ) : categories.length === 0 ? (
        <p className="tw-text-gray-500 tw-py-10 tw-text-center">
          {t("learning.allCategories")}: 0
        </p>
      ) : (
        <div className="tw-bg-white tw-rounded-2xl tw-border tw-border-gray-200 tw-divide-y tw-divide-gray-50">
          {categories.map((c) => {
            // learning_admin mag globale categorieën niet bewerken.
            const editable = isSuperAdmin || c.company_id !== null;
            return (
              <div key={c.id} className="tw-flex tw-items-center tw-gap-3 tw-px-5 tw-py-3.5">
                <div className="tw-flex-1">
                  <div className="tw-font-medium tw-text-gray-900">
                    {c.name}{" "}
                    <span className="tw-text-[10px] tw-font-semibold tw-uppercase tw-bg-indigo-100 tw-text-[#5971F6] tw-rounded-full tw-px-2 tw-py-0.5 tw-ml-1">
                      {c.learning_path_type === "sales_skills"
                        ? t("learning.salesSkills")
                        : t("learning.knowledge")}
                    </span>
                    {c.company_id === null && (
                      <span className="tw-text-[10px] tw-font-semibold tw-uppercase tw-bg-gray-100 tw-text-gray-600 tw-rounded-full tw-px-2 tw-py-0.5 tw-ml-1">
                        {t("learning.globalTemplate")}
                      </span>
                    )}
                  </div>
                  {c.description && (
                    <div className="tw-text-xs tw-text-gray-500">{c.description}</div>
                  )}
                </div>
                {editable && (
                  <>
                    <button
                      onClick={() =>
                        setForm({
                          id: c.id,
                          name: c.name,
                          description: c.description || "",
                          learning_path_type: c.learning_path_type,
                        })
                      }
                      className="tw-p-1.5 tw-text-gray-500 hover:tw-text-[#5971F6]"
                    >
                      <PencilIcon className="tw-w-4 tw-h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(c)}
                      className="tw-p-1.5 tw-text-gray-500 hover:tw-text-red-500"
                    >
                      <TrashIcon className="tw-w-4 tw-h-4" />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {deleteTarget && (
        <DeleteConfirmDialog
          isOpen={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          onConfirm={doDelete}
          entityName={deleteTarget.name}
        />
      )}
    </div>
  );
}

export default authMiddleware(ManageCategoriesPage, undefined, false, "learning_admin");
