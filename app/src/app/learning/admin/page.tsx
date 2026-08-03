"use client";
/**
 * /learning/admin — leerbeheer voor de bedrijfs-leerbeheerder (Fase 5).
 * Medewerkers met leerstatistieken, leer-rol aanpassen en modules toewijzen.
 * Tenant-isolatie wordt server-side afgedwongen (eigen bedrijf).
 */
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast, ToastContainer } from "react-toastify";
import authMiddleware from "@/middleware/authMiddleware";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import DropdownCloseIcon from "@/components/DropdownCloseIcon";
import CompanyPicker from "@/components/learning/CompanyPicker";

type Employee = {
  id: string;
  name: string;
  email: string;
  learning_role: string;
  sales_role: string;
  assigned: number;
  completed: number;
  in_progress: number;
  certificates: number;
};

type ModuleItem = {
  id: string;
  title: string;
  learning_path_type: string;
  phase: number | null;
  assignment: { is_required: boolean } | null;
};

type PathItem = {
  id: string;
  job_function: string;
  level: string;
  path_modules: { module: { title: string } }[];
};

function LearningAdminPage() {
  const { t } = useTranslation("common");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignFor, setAssignFor] = useState<Employee | null>(null);
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());
  const [assignRequired, setAssignRequired] = useState(true);
  const [saving, setSaving] = useState(false);
  // Leerpad toewijzen (uitbreiding B)
  const [paths, setPaths] = useState<PathItem[]>([]);
  const [assignPathFor, setAssignPathFor] = useState<Employee | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  // Superadmin beheert leren per bedrijf (superadmin-uitbreiding); voor
  // learning_admins blijft dit null en geldt het eigen bedrijf.
  const [companyId, setCompanyId] = useState<string | null>(null);
  const isSuperAdmin = (() => {
    try {
      return (
        JSON.parse(localStorage.getItem("user_data") || "{}")?.role?.name ===
        "superadmin"
      );
    } catch {
      return false;
    }
  })();

  const loadEmployees = (forCompanyId?: string | null) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    const cid = forCompanyId ?? companyId;
    // Superadmin zonder gekozen bedrijf: wachten tot de kiezer een keuze zet.
    if (isSuperAdmin && !cid) return;
    const qs = cid ? `?company_id=${encodeURIComponent(cid)}` : "";
    fetch(`/api/learning/admin/employees${qs}`, { headers })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((res) => setEmployees(res.data || []))
      .catch(() => setEmployees([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadEmployees();
    const headers = getAuthHeaders();
    if (!headers) return;
    fetch("/api/learning/modules", { headers })
      .then((r) => r.json())
      .then((res) => setModules(res.data || []))
      .catch(() => {});
    fetch("/api/learning/paths", { headers })
      .then((r) => r.json())
      .then((res) => setPaths(res.data || []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const submitAssignPath = async () => {
    if (!assignPathFor || !selectedPath) return;
    const headers = getAuthHeaders();
    if (!headers) return;
    setSaving(true);
    const res = await fetch("/api/learning/paths/assignments", {
      method: "POST",
      headers,
      body: JSON.stringify({
        user_id: assignPathFor.id,
        path_id: selectedPath,
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success(t("learning.assigned"));
      setAssignPathFor(null);
      setSelectedPath(null);
      loadEmployees();
    } else {
      toast.error("Error");
    }
  };

  const changeLearningRole = async (emp: Employee, newRole: string) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    const res = await fetch(`/api/learning/admin/employees/${emp.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ learning_role: newRole }),
    });
    if (res.ok) {
      setEmployees((list) =>
        list.map((e) =>
          e.id === emp.id ? { ...e, learning_role: newRole } : e,
        ),
      );
      toast.success(t("successMessages.changesSaved", { defaultValue: "✓" }));
    } else {
      toast.error("Error");
    }
  };

  const openAssign = (emp: Employee) => {
    setAssignFor(emp);
    setSelectedModules(new Set());
    setAssignRequired(true);
  };

  const submitAssign = async () => {
    if (!assignFor || selectedModules.size === 0) return;
    const headers = getAuthHeaders();
    if (!headers) return;
    setSaving(true);
    const res = await fetch("/api/learning/admin/assignments", {
      method: "POST",
      headers,
      body: JSON.stringify({
        user_id: assignFor.id,
        module_ids: Array.from(selectedModules),
        is_required: assignRequired,
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success(t("learning.assigned"));
      setAssignFor(null);
      loadEmployees();
    } else {
      toast.error("Error");
    }
  };

  const roleOptions = useMemo(
    () => [
      { value: "learner", label: t("learning.learningRole_learner") },
      {
        value: "learning_admin",
        label: t("learning.learningRole_learning_admin"),
      },
      { value: "none", label: t("learning.learningRole_none") },
    ],
    [t],
  );

  return (
    <div className="tw-p-6 tw-max-w-6xl tw-mx-auto">
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="tw-flex tw-items-center tw-justify-between tw-flex-wrap tw-gap-3 tw-mb-6">
        <div className="tw-flex tw-items-center tw-gap-3 tw-flex-wrap">
          <h1 className="tw-text-2xl tw-font-bold tw-text-gray-900">
            {t("learning.adminNav")}
          </h1>
          {/* Superadmin: kies het bedrijf waarvoor je leren beheert */}
          <CompanyPicker value={companyId} onChange={setCompanyId} />
        </div>
        {/* Snelkoppelingen naar de beheeronderdelen (uitbreiding B) */}
        <div className="tw-flex tw-gap-2 tw-flex-wrap">
          {[
            { href: "/learning/manage", label: t("learning.manageModules") },
            { href: "/learning/manage/paths", label: t("learning.paths") },
            { href: "/learning/manage/job-roles", label: t("learning.jobRoles") },
            { href: "/learning/library", label: t("learning.library") },
          ].map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="tw-text-sm tw-font-semibold tw-text-[#5971F6] tw-bg-indigo-50 hover:tw-bg-indigo-100 tw-rounded-full tw-px-4 tw-py-1.5"
            >
              {l.label}
            </a>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="tw-flex tw-justify-center tw-py-20">
          <div className="tw-animate-spin tw-rounded-full tw-h-8 tw-w-8 tw-border-b-2 tw-border-[#5971F6]" />
        </div>
      ) : (
        <div className="tw-bg-white tw-rounded-2xl tw-border tw-border-gray-200 tw-overflow-x-auto">
          <table className="tw-w-full tw-text-sm">
            <thead>
              <tr className="tw-text-left tw-text-xs tw-uppercase tw-tracking-wide tw-text-gray-400 tw-border-b tw-border-gray-100">
                <th className="tw-px-5 tw-py-3">{t("learning.employees")}</th>
                <th className="tw-px-3 tw-py-3">{t("learning.learningRole")}</th>
                <th className="tw-px-3 tw-py-3 tw-text-center">{t("learning.assigned")}</th>
                <th className="tw-px-3 tw-py-3 tw-text-center">{t("learning.completed")}</th>
                <th className="tw-px-3 tw-py-3 tw-text-center">{t("learning.certificates")}</th>
                <th className="tw-px-3 tw-py-3"></th>
              </tr>
            </thead>
            <tbody className="tw-divide-y tw-divide-gray-50">
              {employees.map((e) => (
                <tr key={e.id}>
                  <td className="tw-px-5 tw-py-3">
                    <div className="tw-font-medium tw-text-gray-900">
                      {e.name}
                    </div>
                    <div className="tw-text-xs tw-text-gray-500">{e.email}</div>
                  </td>
                  <td className="tw-px-3 tw-py-3">
                    <select
                      value={e.learning_role}
                      disabled={e.sales_role === "superadmin"}
                      onChange={(ev) => changeLearningRole(e, ev.target.value)}
                      className="tw-border tw-border-gray-300 tw-rounded-lg tw-px-2 tw-py-1.5 tw-text-sm tw-bg-white"
                    >
                      {roleOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="tw-px-3 tw-py-3 tw-text-center">{e.assigned}</td>
                  <td className="tw-px-3 tw-py-3 tw-text-center">{e.completed}</td>
                  <td className="tw-px-3 tw-py-3 tw-text-center">{e.certificates}</td>
                  <td className="tw-px-3 tw-py-3 tw-text-right tw-whitespace-nowrap">
                    <button
                      onClick={() => openAssign(e)}
                      className="tw-text-sm tw-font-semibold tw-text-[#5971F6] hover:tw-underline"
                      disabled={e.learning_role === "none"}
                    >
                      {t("learning.assignModules")}
                    </button>
                    {paths.length > 0 && (
                      <button
                        onClick={() => {
                          setAssignPathFor(e);
                          setSelectedPath(null);
                        }}
                        className="tw-text-sm tw-font-semibold tw-text-[#5971F6] hover:tw-underline tw-ml-3"
                        disabled={e.learning_role === "none"}
                      >
                        {t("learning.assignPath")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Leerpad-toewijzen-dialog (uitbreiding B) */}
      {assignPathFor && (
        <div className="tw-fixed tw-inset-0 tw-z-50 tw-overflow-y-auto">
          <div className="tw-flex tw-items-center tw-justify-center tw-min-h-screen tw-px-4">
            <div
              className="tw-fixed tw-inset-0 tw-bg-black tw-bg-opacity-30"
              onClick={() => setAssignPathFor(null)}
            />
            <div className="tw-relative tw-bg-white tw-rounded-lg tw-shadow-xl tw-max-w-lg tw-w-full tw-p-8">
              <DropdownCloseIcon
                className="tw-top-4 tw-right-4"
                onClick={() => setAssignPathFor(null)}
              />
              <h2 className="tw-text-xl tw-font-bold tw-text-gray-900 tw-mb-1">
                {t("learning.assignPath")}
              </h2>
              <p className="tw-text-sm tw-text-gray-500 tw-mb-4">
                {assignPathFor.name}
              </p>
              <div className="tw-border tw-border-gray-200 tw-rounded-xl tw-divide-y tw-divide-gray-50 tw-max-h-72 tw-overflow-y-auto">
                {paths.map((p) => (
                  <label
                    key={p.id}
                    className="tw-flex tw-items-center tw-gap-3 tw-px-4 tw-py-2.5 tw-cursor-pointer hover:tw-bg-gray-50"
                  >
                    <input
                      type="radio"
                      name="assign-path"
                      checked={selectedPath === p.id}
                      onChange={() => setSelectedPath(p.id)}
                    />
                    <span className="tw-flex-1 tw-text-sm tw-text-gray-800">
                      {p.job_function}{" "}
                      <span className="tw-text-xs tw-text-gray-500">
                        · {p.level} · {p.path_modules.length} modules
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              <button
                onClick={submitAssignPath}
                disabled={saving || !selectedPath}
                className={`tw-mt-4 tw-bg-[#5971F6] tw-text-white tw-rounded-full tw-px-6 tw-py-2.5 tw-font-semibold hover:tw-bg-blue-700 ${
                  saving || !selectedPath ? "tw-opacity-50" : ""
                }`}
              >
                {t("learning.assignPath")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toewijzen-dialog */}
      {assignFor && (
        <div className="tw-fixed tw-inset-0 tw-z-50 tw-overflow-y-auto">
          <div className="tw-flex tw-items-center tw-justify-center tw-min-h-screen tw-px-4">
            <div
              className="tw-fixed tw-inset-0 tw-bg-black tw-bg-opacity-30"
              onClick={() => setAssignFor(null)}
            />
            <div className="tw-relative tw-bg-white tw-rounded-lg tw-shadow-xl tw-max-w-2xl tw-w-full tw-p-8 tw-max-h-[80vh] tw-flex tw-flex-col">
              <DropdownCloseIcon
                className="tw-top-4 tw-right-4"
                onClick={() => setAssignFor(null)}
              />
              <h2 className="tw-text-xl tw-font-bold tw-text-gray-900 tw-mb-1">
                {t("learning.assignModules")}
              </h2>
              <p className="tw-text-sm tw-text-gray-500 tw-mb-4">
                {assignFor.name}
              </p>

              <label className="tw-flex tw-items-center tw-gap-2 tw-mb-3 tw-cursor-pointer">
                <input
                  type="checkbox"
                  checked={assignRequired}
                  onChange={(e) => setAssignRequired(e.target.checked)}
                  className="tw-h-4 tw-w-4"
                />
                <span className="tw-text-sm tw-text-gray-700">
                  {t("learning.required")}
                </span>
              </label>

              <div className="tw-flex-1 tw-overflow-y-auto tw-border tw-border-gray-200 tw-rounded-xl tw-divide-y tw-divide-gray-50">
                {modules.map((m) => (
                  <label
                    key={m.id}
                    className="tw-flex tw-items-center tw-gap-3 tw-px-4 tw-py-2.5 tw-cursor-pointer hover:tw-bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedModules.has(m.id)}
                      onChange={(e) => {
                        setSelectedModules((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(m.id);
                          else next.delete(m.id);
                          return next;
                        });
                      }}
                      className="tw-h-4 tw-w-4"
                    />
                    <span className="tw-flex-1 tw-text-sm tw-text-gray-800">
                      {m.title}
                    </span>
                    {m.phase != null && (
                      <span className="tw-text-[10px] tw-font-semibold tw-bg-indigo-100 tw-text-[#5971F6] tw-rounded-full tw-px-2 tw-py-0.5">
                        {t("learning.phase")} {m.phase}
                      </span>
                    )}
                  </label>
                ))}
              </div>

              <button
                onClick={submitAssign}
                disabled={saving || selectedModules.size === 0}
                className={`tw-mt-4 tw-bg-[#5971F6] tw-text-white tw-rounded-full tw-px-6 tw-py-2.5 tw-font-semibold hover:tw-bg-blue-700 ${
                  saving || selectedModules.size === 0 ? "tw-opacity-50" : ""
                }`}
              >
                {t("learning.assignModules")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default authMiddleware(LearningAdminPage, undefined, false, "learning_admin");
