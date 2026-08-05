"use client";
/**
 * /learning/manage/paths — leerpaden-beheer (uitbreiding B).
 * Superadmin: globale leerpaden; learning_admin: leerpaden van eigen bedrijf.
 * Een leerpad = functie ("accountmanager") + niveau + geordende modules,
 * optioneel gekoppeld aan een functierol.
 */
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast, ToastContainer } from "react-toastify";
import authMiddleware from "@/middleware/authMiddleware";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import { ChevronLeftIcon, PencilIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import DropdownCloseIcon from "@/components/DropdownCloseIcon";

type PathItem = {
  id: string;
  job_function: string;
  level: string;
  description: string | null;
  job_role: { id: string; name: string } | null;
  path_modules: {
    id: string;
    order_index: number;
    module: { id: string; title: string; phase: number | null };
  }[];
  _count: { path_assignments: number };
};

type ModuleItem = { id: string; title: string; phase: number | null };
type JobRole = { id: string; name: string };

function ManagePathsPage() {
  const router = useRouter();
  const { t } = useTranslation("common");
  const [paths, setPaths] = useState<PathItem[]>([]);
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<PathItem | null>(null);
  const [editing, setEditing] = useState<Partial<PathItem> | null>(null);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  // AI-leerpadgeneratie via embedding-flow (LMS 1:1 P4)
  const [aiOpen, setAiOpen] = useState(false);
  const [aiProfile, setAiProfile] = useState("");
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiRationale, setAiRationale] = useState<string | null>(null);
  const [aiStep, setAiStep] = useState<"input" | "competencies" | "matches">(
    "input",
  );
  const [aiAnalysis, setAiAnalysis] = useState<{
    fullText: string;
    jobTitle: string;
    summary: string;
    competencies: {
      name: string;
      category: string;
      importance: string;
    }[];
  } | null>(null);
  const [aiMatches, setAiMatches] = useState<
    {
      moduleId: string;
      moduleName: string;
      matchScore: number;
      semanticScore: number;
      matchingTags: string[];
    }[]
  >([]);
  const [aiSelected, setAiSelected] = useState<string[]>([]);

  const load = () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    Promise.all([
      fetch("/api/learning/paths", { headers }).then((r) => r.json()),
      fetch("/api/learning/modules", { headers }).then((r) => r.json()),
      fetch("/api/learning/job-roles", { headers }).then((r) => r.json()),
    ])
      .then(([p, m, jr]) => {
        setPaths(p.data || []);
        setModules(m.data || []);
        setJobRoles(jr.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openEdit = (path?: PathItem) => {
    setEditing(path ? { ...path } : { job_function: "", level: "basis", description: "" });
    setSelectedModules(
      path ? path.path_modules.map((pm) => pm.module.id) : [],
    );
  };

  const save = async () => {
    if (!editing?.job_function?.trim()) {
      toast.error(t("learning.pathFunction"));
      return;
    }
    const headers = getAuthHeaders();
    if (!headers) return;
    setSaving(true);
    const res = await fetch(
      editing.id ? `/api/learning/paths/${editing.id}` : "/api/learning/paths",
      {
        method: editing.id ? "PUT" : "POST",
        headers,
        body: JSON.stringify({
          job_function: editing.job_function,
          level: editing.level || "basis",
          description: editing.description || null,
          job_role_id: (editing as any).job_role_id ?? editing.job_role?.id ?? null,
          module_ids: selectedModules,
        }),
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

  const doDelete = async () => {
    if (!deleteTarget) return;
    const headers = getAuthHeaders();
    if (!headers) return;
    const res = await fetch(`/api/learning/paths/${deleteTarget.id}`, {
      method: "DELETE",
      headers,
    });
    if (res.ok) {
      toast.success("✓");
      load();
    } else {
      toast.error("Error");
    }
    setDeleteTarget(null);
  };

  // Embedding-leerpadflow (1-op-1 met productie): 3 stappen met menselijke
  // tussenstappen — analyse → competenties beoordelen → gematchte modules
  // kiezen → leerpad aanmaken.
  const analyzeProfile = async () => {
    if (aiProfile.trim().length < 40 && !aiFile) {
      toast.error(t("learning.aiProfileTooShort"));
      return;
    }
    setAiBusy(true);
    setAiRationale(null);
    try {
      let res: Response;
      if (aiFile) {
        const headers = getAuthHeaders({}, true);
        if (!headers) return;
        const fd = new FormData();
        fd.set("document", aiFile);
        res = await fetch("/api/learning/paths/analyze", {
          method: "POST",
          headers,
          body: fd,
        });
      } else {
        const headers = getAuthHeaders();
        if (!headers) return;
        res = await fetch("/api/learning/paths/analyze", {
          method: "POST",
          headers,
          body: JSON.stringify({ job_profile_text: aiProfile }),
        });
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      setAiAnalysis(json.data);
      setAiStep("competencies");
    } catch {
      toast.error(t("learning.aiGenerateFailed"));
    }
    setAiBusy(false);
  };

  const matchModules = async () => {
    if (!aiAnalysis) return;
    const headers = getAuthHeaders();
    if (!headers) return;
    setAiBusy(true);
    try {
      const res = await fetch("/api/learning/paths/match", {
        method: "POST",
        headers,
        body: JSON.stringify({
          competencies: aiAnalysis.competencies,
          jobProfileText: aiAnalysis.fullText,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      setAiMatches(json.data.matches);
      // Hoge + gemiddelde prioriteit vooraf aangevinkt (productiegedrag).
      setAiSelected(
        json.data.matches
          .filter((m: any) => m.matchScore >= 40)
          .map((m: any) => m.moduleId),
      );
      setAiStep("matches");
    } catch {
      toast.error(t("learning.aiGenerateFailed"));
    }
    setAiBusy(false);
  };

  const createFromAnalysis = async () => {
    if (!aiAnalysis || aiSelected.length === 0) return;
    const headers = getAuthHeaders();
    if (!headers) return;
    setAiBusy(true);
    try {
      const res = await fetch("/api/learning/paths/create-from-analysis", {
        method: "POST",
        headers,
        body: JSON.stringify({
          job_function: aiAnalysis.jobTitle || t("learning.aiGeneratePath"),
          level: "medior",
          description: aiAnalysis.summary || null,
          selectedModuleIds: aiSelected,
          competencies: aiAnalysis.competencies,
          jobProfileText: aiAnalysis.fullText,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      toast.success(`✓ ${aiAnalysis.jobTitle}`);
      setAiStep("input");
      setAiAnalysis(null);
      setAiMatches([]);
      setAiSelected([]);
      setAiProfile("");
      setAiFile(null);
      load();
    } catch {
      toast.error(t("learning.aiGenerateFailed"));
    }
    setAiBusy(false);
  };

  const moveModule = (id: string, dir: -1 | 1) => {
    setSelectedModules((list) => {
      const i = list.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const inputCls =
    "tw-w-full tw-px-4 tw-py-2 tw-rounded-xl tw-bg-white tw-border tw-border-gray-300 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 tw-text-sm";

  return (
    <div className="tw-p-6 tw-max-w-5xl tw-mx-auto">
      <ToastContainer position="top-right" autoClose={3000} />
      <button
        onClick={() => router.push("/learning/manage")}
        className="tw-flex tw-items-center tw-gap-1 tw-text-sm tw-text-gray-500 hover:tw-text-gray-800 tw-mb-4"
      >
        <ChevronLeftIcon className="tw-w-4 tw-h-4" /> {t("learning.manageModules")}
      </button>
      <div className="tw-flex tw-items-center tw-justify-between tw-mb-6">
        <h1 className="tw-text-2xl tw-font-bold tw-text-gray-900">
          {t("learning.paths")}
        </h1>
        <div className="tw-flex tw-items-center tw-gap-2">
          <button
            onClick={() => setAiOpen(true)}
            className="tw-flex tw-items-center tw-gap-1.5 tw-bg-white tw-border tw-border-[#5971F6] tw-text-[#5971F6] tw-rounded-full tw-px-4 tw-py-2 tw-text-sm tw-font-semibold hover:tw-bg-indigo-50"
          >
            ✨ {t("learning.aiGeneratePath")}
          </button>
          <button
            onClick={() => openEdit()}
            className="tw-flex tw-items-center tw-gap-1.5 tw-bg-[#5971F6] tw-text-white tw-rounded-full tw-px-4 tw-py-2 tw-text-sm tw-font-semibold hover:tw-bg-blue-700"
          >
            <PlusIcon className="tw-w-4 tw-h-4" /> {t("learning.addPath")}
          </button>
        </div>
      </div>

      {/* AI-leerpadgeneratie */}
      {aiOpen && (
        <div className="tw-bg-white tw-rounded-2xl tw-border tw-border-indigo-200 tw-p-5 tw-mb-5">
          <div className="tw-flex tw-items-start tw-justify-between tw-gap-2">
            <div>
              <h3 className="tw-font-semibold tw-text-gray-900">
                ✨ {t("learning.aiGeneratePath")}
              </h3>
              <p className="tw-text-xs tw-text-gray-500 tw-mb-3">
                {t("learning.aiGenerateHint")}
              </p>
            </div>
            <button
              onClick={() => setAiOpen(false)}
              className="tw-text-gray-400 hover:tw-text-gray-700"
            >
              ✕
            </button>
          </div>
          {/* Stap 1 — invoer (tekst óf pdf/doc/docx) */}
          {aiStep === "input" && (
            <>
              <textarea
                className={`${inputCls} tw-h-28`}
                placeholder={t("learning.aiProfilePlaceholder")}
                value={aiProfile}
                onChange={(e) => setAiProfile(e.target.value)}
              />
              <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-3 tw-mt-3">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="tw-text-xs"
                  onChange={(e) => setAiFile(e.target.files?.[0] || null)}
                />
                <button
                  onClick={analyzeProfile}
                  disabled={aiBusy}
                  className={`tw-bg-[#5971F6] tw-text-white tw-rounded-full tw-px-5 tw-py-2 tw-text-sm tw-font-semibold hover:tw-bg-blue-700 ${aiBusy ? "tw-opacity-50" : ""}`}
                >
                  {aiBusy ? "…" : t("learning.aiAnalyzeProfile")}
                </button>
                {aiBusy && (
                  <span className="tw-text-xs tw-text-gray-500">
                    {t("learning.aiGenerating")}
                  </span>
                )}
              </div>
            </>
          )}

          {/* Stap 2 — competenties beoordelen */}
          {aiStep === "competencies" && aiAnalysis && (
            <>
              <p className="tw-text-sm tw-font-semibold tw-text-gray-900 tw-mb-1">
                {aiAnalysis.jobTitle}
              </p>
              <p className="tw-text-xs tw-text-gray-600 tw-mb-3">
                {aiAnalysis.summary}
              </p>
              <div className="tw-flex tw-flex-wrap tw-gap-1.5 tw-mb-4">
                {aiAnalysis.competencies.map((c, i) => (
                  <span
                    key={`${c.name}-${i}`}
                    className={`tw-flex tw-items-center tw-gap-1 tw-text-xs tw-rounded-full tw-px-2.5 tw-py-1 ${
                      c.importance === "high"
                        ? "tw-bg-indigo-100 tw-text-indigo-700"
                        : "tw-bg-gray-100 tw-text-gray-600"
                    }`}
                  >
                    {c.name}
                    <button
                      onClick={() =>
                        setAiAnalysis({
                          ...aiAnalysis,
                          competencies: aiAnalysis.competencies.filter(
                            (_, j) => j !== i,
                          ),
                        })
                      }
                      className="hover:tw-text-red-500"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
              <div className="tw-flex tw-gap-2">
                <button
                  onClick={matchModules}
                  disabled={aiBusy || aiAnalysis.competencies.length === 0}
                  className={`tw-bg-[#5971F6] tw-text-white tw-rounded-full tw-px-5 tw-py-2 tw-text-sm tw-font-semibold ${aiBusy ? "tw-opacity-50" : ""}`}
                >
                  {aiBusy ? "…" : t("learning.aiMatchModules")}
                </button>
                <button
                  onClick={() => setAiStep("input")}
                  className="tw-text-sm tw-text-gray-500"
                >
                  {t("learning.cancel")}
                </button>
              </div>
            </>
          )}

          {/* Stap 3 — gematchte modules kiezen en aanmaken */}
          {aiStep === "matches" && (
            <>
              {aiMatches.length === 0 ? (
                <p className="tw-text-sm tw-text-gray-500 tw-mb-3">
                  {t("learning.aiNoMatches")}
                </p>
              ) : (
                <div className="tw-flex tw-flex-col tw-gap-1.5 tw-mb-4 tw-max-h-72 tw-overflow-y-auto">
                  {aiMatches.map((m) => (
                    <label
                      key={m.moduleId}
                      className="tw-flex tw-items-center tw-gap-3 tw-bg-gray-50 tw-rounded-xl tw-px-3 tw-py-2 tw-cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={aiSelected.includes(m.moduleId)}
                        onChange={(e) =>
                          setAiSelected((sel) =>
                            e.target.checked
                              ? [...sel, m.moduleId]
                              : sel.filter((id) => id !== m.moduleId),
                          )
                        }
                        className="tw-h-4 tw-w-4"
                      />
                      <span className="tw-flex-1 tw-text-sm tw-text-gray-800">
                        {m.moduleName}
                        {m.matchingTags.length > 0 && (
                          <span className="tw-text-[11px] tw-text-gray-400 tw-ml-2">
                            {m.matchingTags.join(", ")}
                          </span>
                        )}
                      </span>
                      <span
                        className={`tw-text-xs tw-font-bold tw-rounded-full tw-px-2 tw-py-0.5 ${
                          m.matchScore >= 70
                            ? "tw-bg-green-100 tw-text-green-700"
                            : m.matchScore >= 40
                              ? "tw-bg-amber-100 tw-text-amber-700"
                              : "tw-bg-gray-100 tw-text-gray-500"
                        }`}
                      >
                        {m.matchScore}%
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <div className="tw-flex tw-gap-2">
                <button
                  onClick={createFromAnalysis}
                  disabled={aiBusy || aiSelected.length === 0}
                  className={`tw-bg-[#5971F6] tw-text-white tw-rounded-full tw-px-5 tw-py-2 tw-text-sm tw-font-semibold ${aiBusy || aiSelected.length === 0 ? "tw-opacity-50" : ""}`}
                >
                  {aiBusy
                    ? "…"
                    : `${t("learning.aiCreatePath")} (${aiSelected.length})`}
                </button>
                <button
                  onClick={() => setAiStep("competencies")}
                  className="tw-text-sm tw-text-gray-500"
                >
                  ← {t("learning.cancel")}
                </button>
              </div>
            </>
          )}

          {aiRationale && (
            <p className="tw-text-xs tw-text-gray-600 tw-bg-indigo-50 tw-rounded-xl tw-p-3 tw-mt-3 tw-whitespace-pre-line">
              {aiRationale}
            </p>
          )}
        </div>
      )}

      {loading ? (
        <div className="tw-flex tw-justify-center tw-py-20">
          <div className="tw-animate-spin tw-rounded-full tw-h-8 tw-w-8 tw-border-b-2 tw-border-[#5971F6]" />
        </div>
      ) : paths.length === 0 ? (
        <p className="tw-text-gray-500 tw-py-10 tw-text-center">
          {t("learning.noPaths")}
        </p>
      ) : (
        <div className="tw-flex tw-flex-col tw-gap-4">
          {paths.map((p) => (
            <div
              key={p.id}
              className="tw-bg-white tw-rounded-2xl tw-border tw-border-gray-200 tw-p-5"
            >
              <div className="tw-flex tw-items-start tw-justify-between tw-gap-3">
                <div>
                  <h3 className="tw-font-semibold tw-text-gray-900">
                    {p.job_function}{" "}
                    <span className="tw-text-xs tw-font-normal tw-text-gray-500">
                      · {p.level}
                      {p.job_role && ` · ${p.job_role.name}`}
                      {` · ${p._count.path_assignments}× ${t("learning.assigned").toLowerCase()}`}
                    </span>
                  </h3>
                  {p.description && (
                    <p className="tw-text-sm tw-text-gray-500">{p.description}</p>
                  )}
                </div>
                <div className="tw-whitespace-nowrap">
                  <button
                    onClick={() => openEdit(p)}
                    className="tw-p-1.5 tw-text-gray-500 hover:tw-text-[#5971F6]"
                  >
                    <PencilIcon className="tw-w-4 tw-h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(p)}
                    className="tw-p-1.5 tw-text-gray-500 hover:tw-text-red-500"
                  >
                    <TrashIcon className="tw-w-4 tw-h-4" />
                  </button>
                </div>
              </div>
              <ol className="tw-mt-3 tw-flex tw-flex-wrap tw-gap-2">
                {p.path_modules.map((pm, i) => (
                  <li
                    key={pm.id}
                    className="tw-text-xs tw-bg-indigo-50 tw-text-[#5971F6] tw-rounded-full tw-px-3 tw-py-1"
                  >
                    {i + 1}. {pm.module.title}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}

      {/* Bewerken/aanmaken-dialog */}
      {editing && (
        <div className="tw-fixed tw-inset-0 tw-z-50 tw-overflow-y-auto">
          <div className="tw-flex tw-items-center tw-justify-center tw-min-h-screen tw-px-4">
            <div
              className="tw-fixed tw-inset-0 tw-bg-black tw-bg-opacity-30"
              onClick={() => setEditing(null)}
            />
            <div className="tw-relative tw-bg-white tw-rounded-lg tw-shadow-xl tw-max-w-2xl tw-w-full tw-p-8 tw-max-h-[85vh] tw-flex tw-flex-col">
              <DropdownCloseIcon
                className="tw-top-4 tw-right-4"
                onClick={() => setEditing(null)}
              />
              <h2 className="tw-text-xl tw-font-bold tw-text-gray-900 tw-mb-4">
                {editing.id ? t("learning.editPath") : t("learning.addPath")}
              </h2>

              <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-3 tw-gap-3 tw-mb-3">
                <div className="md:tw-col-span-2">
                  <label className="tw-text-xs tw-font-semibold tw-text-gray-600">
                    {t("learning.pathFunction")}
                  </label>
                  <input
                    className={inputCls}
                    value={editing.job_function || ""}
                    onChange={(e) =>
                      setEditing((s) => ({ ...s!, job_function: e.target.value }))
                    }
                    placeholder="Accountmanager"
                  />
                </div>
                <div>
                  <label className="tw-text-xs tw-font-semibold tw-text-gray-600">
                    {t("learning.pathLevel")}
                  </label>
                  <input
                    className={inputCls}
                    value={editing.level || ""}
                    onChange={(e) =>
                      setEditing((s) => ({ ...s!, level: e.target.value }))
                    }
                    placeholder="basis / gevorderd"
                  />
                </div>
              </div>
              <div className="tw-mb-3">
                <label className="tw-text-xs tw-font-semibold tw-text-gray-600">
                  {t("learning.jobRole")}
                </label>
                <select
                  className={inputCls}
                  value={(editing as any).job_role_id ?? editing.job_role?.id ?? ""}
                  onChange={(e) =>
                    setEditing((s) => ({ ...s!, job_role_id: e.target.value || null } as any))
                  }
                >
                  <option value="">—</option>
                  {jobRoles.map((jr) => (
                    <option key={jr.id} value={jr.id}>
                      {jr.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="tw-mb-3">
                <label className="tw-text-xs tw-font-semibold tw-text-gray-600">
                  {t("companiesListing.notes")}
                </label>
                <textarea
                  className={`${inputCls} tw-h-16`}
                  value={editing.description || ""}
                  onChange={(e) =>
                    setEditing((s) => ({ ...s!, description: e.target.value }))
                  }
                />
              </div>

              <label className="tw-text-xs tw-font-semibold tw-text-gray-600 tw-mb-1">
                {t("learning.pathModules")} ({selectedModules.length})
              </label>
              <div className="tw-flex-1 tw-overflow-y-auto tw-border tw-border-gray-200 tw-rounded-xl tw-divide-y tw-divide-gray-50 tw-mb-4 tw-min-h-[8rem]">
                {/* Geselecteerde modules bovenaan, in volgorde en verplaatsbaar */}
                {selectedModules.map((id, i) => {
                  const m = modules.find((x) => x.id === id);
                  if (!m) return null;
                  return (
                    <div
                      key={id}
                      className="tw-flex tw-items-center tw-gap-2 tw-px-4 tw-py-2 tw-bg-indigo-50/50"
                    >
                      <span className="tw-text-xs tw-font-semibold tw-text-[#5971F6] tw-w-5">
                        {i + 1}.
                      </span>
                      <span className="tw-flex-1 tw-text-sm">{m.title}</span>
                      <button onClick={() => moveModule(id, -1)} className="tw-px-1 tw-text-gray-400 hover:tw-text-gray-700">↑</button>
                      <button onClick={() => moveModule(id, 1)} className="tw-px-1 tw-text-gray-400 hover:tw-text-gray-700">↓</button>
                      <button
                        onClick={() =>
                          setSelectedModules((l) => l.filter((x) => x !== id))
                        }
                        className="tw-px-1 tw-text-gray-400 hover:tw-text-red-500"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
                {modules
                  .filter((m) => !selectedModules.includes(m.id))
                  .map((m) => (
                    <label
                      key={m.id}
                      className="tw-flex tw-items-center tw-gap-3 tw-px-4 tw-py-2 tw-cursor-pointer hover:tw-bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={() =>
                          setSelectedModules((l) => [...l, m.id])
                        }
                        className="tw-h-4 tw-w-4"
                      />
                      <span className="tw-flex-1 tw-text-sm tw-text-gray-700">
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
                onClick={save}
                disabled={saving}
                className={`tw-bg-[#5971F6] tw-text-white tw-rounded-full tw-px-6 tw-py-2.5 tw-font-semibold hover:tw-bg-blue-700 ${saving ? "tw-opacity-50" : ""}`}
              >
                {t("form.send")}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <DeleteConfirmDialog
          isOpen={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          onConfirm={doDelete}
          entityName={deleteTarget.job_function}
        />
      )}
    </div>
  );
}

export default authMiddleware(ManagePathsPage, undefined, false, "learning_admin");
