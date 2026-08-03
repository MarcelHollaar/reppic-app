"use client";
/**
 * /learning/manage — modulebeheer (Fase 5).
 * Superadmin: alle (globale) modules; learning_admin: knowledge-modules
 * van het eigen bedrijf (server-side afgedwongen).
 */
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast, ToastContainer } from "react-toastify";
import authMiddleware from "@/middleware/authMiddleware";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import { PencilIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";

type ModuleItem = {
  id: string;
  title: string;
  learning_path_type: string;
  phase: number | null;
  content_type: string;
  duration: number;
  question_count: number;
  category: { id: string; name: string } | null;
};

function ManageModulesPage() {
  const router = useRouter();
  const { t } = useTranslation("common");
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<ModuleItem | null>(null);

  const load = () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    fetch("/api/learning/modules", { headers })
      .then((r) => r.json())
      .then((res) => setModules(res.data || []))
      .catch(() => setModules([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const doDelete = async () => {
    if (!deleteTarget) return;
    const headers = getAuthHeaders();
    if (!headers) return;
    const res = await fetch(
      `/api/learning/manage/modules/${deleteTarget.id}`,
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

  return (
    <div className="tw-p-6 tw-max-w-6xl tw-mx-auto">
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="tw-flex tw-items-center tw-justify-between tw-mb-6">
        <h1 className="tw-text-2xl tw-font-bold tw-text-gray-900">
          {t("learning.manageModules")}
        </h1>
        <div className="tw-flex tw-items-center tw-gap-2 tw-flex-wrap">
          <button
            onClick={() => router.push("/learning/manage/paths")}
            className="tw-text-sm tw-font-semibold tw-text-[#5971F6] tw-bg-indigo-50 hover:tw-bg-indigo-100 tw-rounded-full tw-px-4 tw-py-2"
          >
            {t("learning.paths")}
          </button>
          <button
            onClick={() => router.push("/learning/manage/job-roles")}
            className="tw-text-sm tw-font-semibold tw-text-[#5971F6] tw-bg-indigo-50 hover:tw-bg-indigo-100 tw-rounded-full tw-px-4 tw-py-2"
          >
            {t("learning.jobRoles")}
          </button>
          <button
            onClick={() => router.push("/learning/manage/categories")}
            className="tw-text-sm tw-font-semibold tw-text-[#5971F6] tw-bg-indigo-50 hover:tw-bg-indigo-100 tw-rounded-full tw-px-4 tw-py-2"
          >
            {t("learning.categories")}
          </button>
          <button
            onClick={() => router.push("/learning/manage/module")}
            className="tw-flex tw-items-center tw-gap-1.5 tw-bg-[#5971F6] tw-text-white tw-rounded-full tw-px-4 tw-py-2 tw-text-sm tw-font-semibold hover:tw-bg-blue-700"
          >
            <PlusIcon className="tw-w-4 tw-h-4" /> {t("learning.addModule")}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="tw-flex tw-justify-center tw-py-20">
          <div className="tw-animate-spin tw-rounded-full tw-h-8 tw-w-8 tw-border-b-2 tw-border-[#5971F6]" />
        </div>
      ) : modules.length === 0 ? (
        <p className="tw-text-gray-500 tw-py-10 tw-text-center">
          {t("learning.noModules")}
        </p>
      ) : (
        <div className="tw-bg-white tw-rounded-2xl tw-border tw-border-gray-200 tw-overflow-x-auto">
          <table className="tw-w-full tw-text-sm">
            <thead>
              <tr className="tw-text-left tw-text-xs tw-uppercase tw-tracking-wide tw-text-gray-400 tw-border-b tw-border-gray-100">
                <th className="tw-px-5 tw-py-3">{t("learning.title")}</th>
                <th className="tw-px-3 tw-py-3">{t("learning.category")}</th>
                <th className="tw-px-3 tw-py-3 tw-text-center">
                  {t("learning.phase")}
                </th>
                <th className="tw-px-3 tw-py-3 tw-text-center">
                  {t("learning.questions")}
                </th>
                <th className="tw-px-3 tw-py-3"></th>
              </tr>
            </thead>
            <tbody className="tw-divide-y tw-divide-gray-50">
              {modules.map((m) => (
                <tr key={m.id}>
                  <td className="tw-px-5 tw-py-3">
                    <div className="tw-font-medium tw-text-gray-900">
                      {m.title}
                    </div>
                    <div className="tw-text-xs tw-text-gray-500">
                      {m.learning_path_type === "sales_skills"
                        ? t("learning.salesSkills")
                        : t("learning.knowledge")}{" "}
                      · {m.content_type} · {m.duration} {t("learning.minutes")}
                    </div>
                  </td>
                  <td className="tw-px-3 tw-py-3">{m.category?.name || "—"}</td>
                  <td className="tw-px-3 tw-py-3 tw-text-center">
                    {m.phase ?? "—"}
                  </td>
                  <td className="tw-px-3 tw-py-3 tw-text-center">
                    {m.question_count}
                  </td>
                  <td className="tw-px-3 tw-py-3 tw-text-right tw-whitespace-nowrap">
                    <button
                      onClick={() =>
                        router.push(`/learning/manage/module?id=${m.id}`)
                      }
                      className="tw-p-1.5 tw-text-gray-500 hover:tw-text-[#5971F6]"
                      title={t("learning.editModule")}
                    >
                      <PencilIcon className="tw-w-4 tw-h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(m)}
                      className="tw-p-1.5 tw-text-gray-500 hover:tw-text-red-500"
                    >
                      <TrashIcon className="tw-w-4 tw-h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

export default authMiddleware(ManageModulesPage, undefined, false, "learning_admin");
