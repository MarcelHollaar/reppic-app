"use client";
/**
 * /learning/manage/module[?id=…] — module aanmaken/bewerken incl. quizvragen
 * (Fase 5). Superadmin maakt globale content (sales_skills + knowledge);
 * learning_admin alleen knowledge voor het eigen bedrijf (server-side check).
 */
import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast, ToastContainer } from "react-toastify";
import authMiddleware from "@/middleware/authMiddleware";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import { useUserRole } from "@/hooks/useUserRole";
import { USER_ROLE } from "@/configs/constants";
import { ChevronLeftIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";

type QuestionForm = {
  id?: string;
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string;
};

type CategoryItem = { id: string; name: string; learning_path_type: string };

function ModuleFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const moduleId = searchParams.get("id");
  const { t } = useTranslation("common");
  const userRole = useUserRole();
  const isSuperAdmin = userRole === USER_ROLE.SUPER_ADMIN;

  const [loading, setLoading] = useState(Boolean(moduleId));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [genFile, setGenFile] = useState<File | null>(null);
  const [generating, setGenerating] = useState(false);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    duration: 5,
    learning_path_type: isSuperAdmin ? "sales_skills" : "knowledge",
    phase: "" as string,
    category_id: "",
    content_type: "video",
    video_url: "",
    video_embed_code: "",
    thumbnail_url: "",
    is_required: false,
  });
  const [questions, setQuestions] = useState<QuestionForm[]>([]);
  // Functierol-koppeling (uitbreiding B): job_role_id -> 'required'|'recommended'
  const [jobRoles, setJobRoles] = useState<{ id: string; name: string }[]>([]);
  const [roleCouplings, setRoleCouplings] = useState<Record<string, string>>({});
  // Meertalige content (AI-uitbreiding): welke talen zijn al vertaald.
  const [translatedLangs, setTranslatedLangs] = useState<string[]>([]);
  const [translating, setTranslating] = useState(false);
  const ALL_LANGS = ["en", "nl", "de", "fr", "es", "it"];

  useEffect(() => {
    const headers = getAuthHeaders();
    if (!headers) return;
    fetch("/api/learning/categories", { headers })
      .then((r) => r.json())
      .then((res) => setCategories(res.data || []))
      .catch(() => {});
    fetch("/api/learning/job-roles", { headers })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((res) => setJobRoles(res.data || []))
      .catch(() => {});
    if (moduleId) {
      fetch(`/api/learning/manage/modules/${moduleId}/job-roles`, { headers })
        .then((r) => (r.ok ? r.json() : { data: [] }))
        .then((res) => {
          const map: Record<string, string> = {};
          (res.data || []).forEach((c: any) => {
            map[c.job_role_id] = c.visibility;
          });
          setRoleCouplings(map);
        })
        .catch(() => {});
      fetch(`/api/learning/manage/modules/${moduleId}/translations`, { headers })
        .then((r) => (r.ok ? r.json() : { data: [] }))
        .then((res) => setTranslatedLangs((res.data || []).map((x: any) => x.language)))
        .catch(() => {});
    }
    if (moduleId) {
      fetch(`/api/learning/manage/modules/${moduleId}`, { headers })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((res) => {
          const m = res.data;
          setForm({
            title: m.title,
            description: m.description || "",
            duration: m.duration,
            learning_path_type: m.learning_path_type,
            phase: m.phase != null ? String(m.phase) : "",
            category_id: m.category_id || "",
            content_type: m.content_type,
            video_url: m.video_url || "",
            video_embed_code: m.video_embed_code || "",
            thumbnail_url: m.thumbnail_url || "",
            is_required: m.is_required,
          });
          setQuestions(
            (m.questions || []).map((q: any) => ({
              id: q.id,
              question: q.question,
              options: q.options || ["", "", "", ""],
              correct_answer: q.correct_answer,
              explanation: q.explanation || "",
            })),
          );
        })
        .catch(() => router.replace("/learning/manage"))
        .finally(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId]);

  const set = (key: string, value: any) =>
    setForm((f) => ({ ...f, [key]: value }));

  // AI-modulegeneratie (1-op-1 met productie): upload → /api/learning/
  // generate-module → formulier + quizvragen voorvullen; daarna gewoon
  // bewerken en opslaan zoals altijd.
  const generateFromFile = async () => {
    if (!genFile) return;
    const headers = getAuthHeaders({}, true);
    if (!headers) return;
    setGenerating(true);
    try {
      const fd = new FormData();
      fd.set("document", genFile);
      const res = await fetch("/api/learning/generate-module", {
        method: "POST",
        headers,
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || "generation_failed");
      const mod = json.data.module;
      // Productie-categorieën (slug) worden geen category_id; de admin kiest
      // zelf de categorie in het formulier. Duration/titel/beschrijving en
      // vragen nemen we 1-op-1 over.
      setForm((f) => ({
        ...f,
        title: mod.title || f.title,
        description: mod.description || f.description,
        duration: mod.duration || f.duration,
      }));
      setQuestions(
        (mod.questions || []).map((q: any) => ({
          question: q.question,
          options: q.options,
          correct_answer: q.correctAnswer,
          explanation: "",
        })),
      );
      toast.success(t("learning.aiGenerateSuccess"));
    } catch (e: any) {
      const msg = String(e?.message || "");
      toast.error(
        msg === "insufficient_text"
          ? t("learning.aiGenerateInsufficientText")
          : msg === "transcription_unavailable"
            ? t("learning.aiGenerateNoTranscription")
            : t("learning.aiGenerateFailed"),
      );
    } finally {
      setGenerating(false);
    }
  };

  // Bestand uploaden naar de DAM (1-op-1 met productie): het bestand gaat naar
  // /api/learning/upload en de teruggegeven publieke URL komt in het doelveld
  // (video_url of thumbnail_url). Zo speelt een geüploade video direct af.
  const uploadMedia = async (
    kind: "video" | "thumbnail",
    file: File | null,
    targetField: "video_url" | "thumbnail_url",
  ) => {
    if (!file) return;
    const headers = getAuthHeaders({}, true);
    if (!headers) return;
    setUploading(kind);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("kind", kind);
      const res = await fetch("/api/learning/upload", {
        method: "POST",
        headers,
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || "upload_failed");
      set(targetField, json.data.url);
      toast.success(t("learning.uploadSuccess"));
    } catch (e: any) {
      toast.error(
        e?.message === "file_too_large"
          ? t("learning.uploadTooLarge")
          : t("learning.uploadFailed"),
      );
    } finally {
      setUploading(null);
    }
  };

  const generateTranslations = async (langs: string[]) => {
    if (!moduleId || langs.length === 0) return;
    const headers = getAuthHeaders();
    if (!headers) return;
    setTranslating(true);
    try {
      const res = await fetch(
        `/api/learning/manage/modules/${moduleId}/translations`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ languages: langs }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      setTranslatedLangs((prev) =>
        Array.from(new Set([...prev, ...json.data.languages])),
      );
      toast.success(`✓ ${json.data.languages.join(", ")}`);
    } catch {
      toast.error(t("learning.aiGenerateFailed"));
    }
    setTranslating(false);
  };

  const deleteTranslation = async (lang: string) => {
    if (!moduleId) return;
    const headers = getAuthHeaders();
    if (!headers) return;
    const res = await fetch(
      `/api/learning/manage/modules/${moduleId}/translations?language=${lang}`,
      { method: "DELETE", headers },
    );
    if (res.ok) {
      setTranslatedLangs((prev) => prev.filter((l) => l !== lang));
    }
  };

  const addQuestion = () =>
    setQuestions((q) => [
      ...q,
      { question: "", options: ["", "", "", ""], correct_answer: 0, explanation: "" },
    ]);

  const save = async () => {
    if (!form.title.trim()) {
      toast.error(t("learning.title"));
      return;
    }
    const headers = getAuthHeaders();
    if (!headers) return;
    setSaving(true);
    const payload = {
      ...form,
      duration: Number(form.duration) || 0,
      phase: form.phase ? parseInt(form.phase, 10) : null,
      category_id: form.category_id || null,
      questions: questions
        .filter((q) => q.question.trim() && q.options.some((o) => o.trim()))
        .map((q, i) => ({
          question: q.question,
          options: q.options.filter((o) => o.trim()),
          correct_answer: q.correct_answer,
          explanation: q.explanation || null,
          order_index: i,
        })),
    };
    const res = await fetch(
      moduleId
        ? `/api/learning/manage/modules/${moduleId}`
        : "/api/learning/manage/modules",
      {
        method: moduleId ? "PUT" : "POST",
        headers,
        body: JSON.stringify(payload),
      },
    );
    if (res.ok) {
      // Functierol-koppelingen apart opslaan (uitbreiding B); het POST-antwoord
      // levert het module-id voor nieuwe modules.
      const saved = await res.json().catch(() => ({}));
      const savedId = moduleId || saved?.data?.id;
      if (savedId && jobRoles.length > 0) {
        await fetch(`/api/learning/manage/modules/${savedId}/job-roles`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            job_roles: Object.entries(roleCouplings).map(
              ([job_role_id, visibility]) => ({ job_role_id, visibility }),
            ),
          }),
        }).catch(() => {});
      }
      setSaving(false);
      toast.success("✓");
      router.push("/learning/manage");
    } else {
      setSaving(false);
      const json = await res.json().catch(() => ({}));
      toast.error(json.message || "Error");
    }
  };

  if (loading) {
    return (
      <div className="tw-flex tw-justify-center tw-py-20">
        <div className="tw-animate-spin tw-rounded-full tw-h-8 tw-w-8 tw-border-b-2 tw-border-[#5971F6]" />
      </div>
    );
  }

  const inputCls =
    "tw-w-full tw-px-4 tw-py-2 tw-rounded-xl tw-bg-white tw-border tw-border-gray-300 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 tw-text-sm";

  return (
    <div className="tw-p-6 tw-max-w-3xl tw-mx-auto">
      <ToastContainer position="top-right" autoClose={3000} />
      <button
        onClick={() => router.push("/learning/manage")}
        className="tw-flex tw-items-center tw-gap-1 tw-text-sm tw-text-gray-500 hover:tw-text-gray-800 tw-mb-4"
      >
        <ChevronLeftIcon className="tw-w-4 tw-h-4" />{" "}
        {t("learning.manageModules")}
      </button>
      <h1 className="tw-text-2xl tw-font-bold tw-text-gray-900 tw-mb-6">
        {moduleId ? t("learning.editModule") : t("learning.addModule")}
      </h1>

      {/* AI-modulegeneratie (1-op-1 met productie AIModuleGenerator): upload
          een document/video/audio, de AI vult het formulier + quizvragen. */}
      {!moduleId && (
        <div className="tw-bg-indigo-50 tw-border tw-border-indigo-100 tw-rounded-2xl tw-p-6 tw-mb-6">
          <h2 className="tw-text-base tw-font-bold tw-text-gray-900 tw-mb-1">
            ✨ {t("learning.aiGenerateTitle")}
          </h2>
          <p className="tw-text-sm tw-text-gray-600 tw-mb-3">
            {t("learning.aiGenerateNote")}
          </p>
          <div className="tw-flex tw-flex-col sm:tw-flex-row sm:tw-items-center tw-gap-3">
            <input
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.mp3,.wav,.m4a,.ogg,.mp4,.mov,.webm"
              disabled={generating}
              onChange={(e) => setGenFile(e.target.files?.[0] || null)}
              className="tw-text-sm"
            />
            <button
              type="button"
              onClick={generateFromFile}
              disabled={!genFile || generating}
              className={`tw-bg-[#5971F6] tw-text-white tw-rounded-full tw-px-5 tw-py-2 tw-text-sm tw-font-semibold ${
                !genFile || generating
                  ? "tw-opacity-50 tw-cursor-not-allowed"
                  : "hover:tw-bg-[#4a5fe0]"
              }`}
            >
              {generating
                ? `⏳ ${t("learning.aiModuleGenerating")}`
                : t("learning.aiGenerateButton")}
            </button>
          </div>
          {generating && (
            <p className="tw-text-xs tw-text-gray-500 tw-mt-2">
              {t("learning.aiGenerateWait")}
            </p>
          )}
        </div>
      )}

      <div className="tw-flex tw-flex-col tw-gap-4 tw-bg-white tw-rounded-2xl tw-border tw-border-gray-200 tw-p-6">
        <div>
          <label className="tw-text-sm tw-font-semibold tw-text-gray-800">
            {t("learning.title")}
          </label>
          <input
            className={inputCls}
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </div>
        <div>
          <label className="tw-text-sm tw-font-semibold tw-text-gray-800">
            {t("companiesListing.notes")}
          </label>
          <textarea
            className={`${inputCls} tw-h-24`}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </div>

        <div className="tw-grid tw-grid-cols-2 md:tw-grid-cols-4 tw-gap-3">
          {isSuperAdmin && (
            <div>
              <label className="tw-text-sm tw-font-semibold tw-text-gray-800">
                Type
              </label>
              <select
                className={inputCls}
                value={form.learning_path_type}
                onChange={(e) => set("learning_path_type", e.target.value)}
              >
                <option value="sales_skills">{t("learning.salesSkills")}</option>
                <option value="knowledge">{t("learning.knowledge")}</option>
              </select>
            </div>
          )}
          {form.learning_path_type === "sales_skills" && (
            <div>
              <label className="tw-text-sm tw-font-semibold tw-text-gray-800">
                {t("learning.phase")}
              </label>
              <select
                className={inputCls}
                value={form.phase}
                onChange={(e) => set("phase", e.target.value)}
              >
                <option value="">—</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="tw-text-sm tw-font-semibold tw-text-gray-800">
              {t("learning.category")}
            </label>
            <select
              className={inputCls}
              value={form.category_id}
              onChange={(e) => set("category_id", e.target.value)}
            >
              <option value="">—</option>
              {categories
                .filter(
                  (c) => c.learning_path_type === form.learning_path_type,
                )
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="tw-text-sm tw-font-semibold tw-text-gray-800">
              {t("learning.minutes")}
            </label>
            <input
              type="number"
              className={inputCls}
              value={form.duration}
              onChange={(e) => set("duration", e.target.value)}
            />
          </div>
        </div>

        <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-3">
          <div>
            <label className="tw-text-sm tw-font-semibold tw-text-gray-800">
              Content
            </label>
            <select
              className={inputCls}
              value={form.content_type}
              onChange={(e) => set("content_type", e.target.value)}
            >
              <option value="video">Video</option>
              <option value="presentation">Presentation</option>
              <option value="document">Document</option>
            </select>
          </div>
          <div>
            <label className="tw-text-sm tw-font-semibold tw-text-gray-800">
              Video URL
            </label>
            <input
              className={inputCls}
              value={form.video_url}
              onChange={(e) => set("video_url", e.target.value)}
              placeholder="https://…"
            />
            <label className="tw-mt-2 tw-inline-flex tw-items-center tw-gap-2 tw-cursor-pointer tw-text-sm tw-text-[#5971F6] tw-font-semibold">
              <input
                type="file"
                accept="video/*"
                className="tw-hidden"
                disabled={uploading === "video"}
                onChange={(e) =>
                  uploadMedia("video", e.target.files?.[0] || null, "video_url")
                }
              />
              {uploading === "video"
                ? `⏳ ${t("learning.uploading")}`
                : `⬆ ${t("learning.uploadVideo")}`}
            </label>
          </div>
        </div>
        <div>
          <label className="tw-text-sm tw-font-semibold tw-text-gray-800">
            {t("learning.thumbnail")}
          </label>
          <div className="tw-flex tw-items-center tw-gap-3">
            {form.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.thumbnail_url}
                alt=""
                className="tw-h-16 tw-w-28 tw-object-cover tw-rounded-lg tw-border tw-border-gray-200"
              />
            ) : null}
            <label className="tw-inline-flex tw-items-center tw-gap-2 tw-cursor-pointer tw-text-sm tw-text-[#5971F6] tw-font-semibold">
              <input
                type="file"
                accept="image/*"
                className="tw-hidden"
                disabled={uploading === "thumbnail"}
                onChange={(e) =>
                  uploadMedia(
                    "thumbnail",
                    e.target.files?.[0] || null,
                    "thumbnail_url",
                  )
                }
              />
              {uploading === "thumbnail"
                ? `⏳ ${t("learning.uploading")}`
                : `⬆ ${t("learning.uploadThumbnail")}`}
            </label>
            {form.thumbnail_url ? (
              <button
                type="button"
                onClick={() => set("thumbnail_url", "")}
                className="tw-text-sm tw-text-gray-400 hover:tw-text-red-500"
              >
                ✕
              </button>
            ) : null}
          </div>
        </div>
        <div>
          <label className="tw-text-sm tw-font-semibold tw-text-gray-800">
            Embed code
          </label>
          <textarea
            className={`${inputCls} tw-h-20 tw-font-mono tw-text-xs`}
            value={form.video_embed_code}
            onChange={(e) => set("video_embed_code", e.target.value)}
            placeholder="<iframe …></iframe>"
          />
        </div>
        <label className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_required}
            onChange={(e) => set("is_required", e.target.checked)}
            className="tw-h-4 tw-w-4"
          />
          <span className="tw-text-sm tw-text-gray-700">
            {t("learning.required")}
          </span>
        </label>
      </div>

      {/* Quizvragen */}
      <div className="tw-mt-6">
        <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
          <h2 className="tw-text-lg tw-font-bold tw-text-gray-900">
            {t("learning.questions")}
          </h2>
          <button
            onClick={addQuestion}
            className="tw-flex tw-items-center tw-gap-1 tw-text-sm tw-font-semibold tw-text-[#5971F6] hover:tw-underline"
          >
            <PlusIcon className="tw-w-4 tw-h-4" /> {t("learning.question")}
          </button>
        </div>
        <div className="tw-flex tw-flex-col tw-gap-4">
          {questions.map((q, qi) => (
            <div
              key={qi}
              className="tw-bg-white tw-rounded-2xl tw-border tw-border-gray-200 tw-p-5"
            >
              <div className="tw-flex tw-items-start tw-gap-2 tw-mb-3">
                <input
                  className={inputCls}
                  placeholder={`${t("learning.question")} ${qi + 1}`}
                  value={q.question}
                  onChange={(e) =>
                    setQuestions((list) =>
                      list.map((x, i) =>
                        i === qi ? { ...x, question: e.target.value } : x,
                      ),
                    )
                  }
                />
                <button
                  onClick={() =>
                    setQuestions((list) => list.filter((_, i) => i !== qi))
                  }
                  className="tw-p-2 tw-text-gray-400 hover:tw-text-red-500"
                >
                  <TrashIcon className="tw-w-4 tw-h-4" />
                </button>
              </div>
              <div className="tw-flex tw-flex-col tw-gap-2">
                {q.options.map((opt, oi) => (
                  <div key={oi} className="tw-flex tw-items-center tw-gap-2">
                    <input
                      type="radio"
                      name={`correct-${qi}`}
                      checked={q.correct_answer === oi}
                      onChange={() =>
                        setQuestions((list) =>
                          list.map((x, i) =>
                            i === qi ? { ...x, correct_answer: oi } : x,
                          ),
                        )
                      }
                      title={t("learning.passed")}
                    />
                    <input
                      className={inputCls}
                      placeholder={`${String.fromCharCode(65 + oi)}.`}
                      value={opt}
                      onChange={(e) =>
                        setQuestions((list) =>
                          list.map((x, i) =>
                            i === qi
                              ? {
                                  ...x,
                                  options: x.options.map((o, j) =>
                                    j === oi ? e.target.value : o,
                                  ),
                                }
                              : x,
                          ),
                        )
                      }
                    />
                  </div>
                ))}
              </div>
              <input
                className={`${inputCls} tw-mt-3`}
                placeholder="Uitleg (optioneel)"
                value={q.explanation}
                onChange={(e) =>
                  setQuestions((list) =>
                    list.map((x, i) =>
                      i === qi ? { ...x, explanation: e.target.value } : x,
                    ),
                  )
                }
              />
            </div>
          ))}
        </div>
      </div>

      {/* Meertalige content — vertalingen genereren (alleen bij bestaande module) */}
      {moduleId && (
        <div className="tw-mt-6">
          <h2 className="tw-text-lg tw-font-bold tw-text-gray-900 tw-mb-1">
            {t("learning.translations")}
          </h2>
          <p className="tw-text-xs tw-text-gray-500 tw-mb-3">
            {t("learning.translationsHint")}
          </p>
          <div className="tw-bg-white tw-rounded-2xl tw-border tw-border-gray-200 tw-p-4 tw-flex tw-flex-wrap tw-gap-2 tw-items-center">
            {ALL_LANGS.map((lang) => {
              const done = translatedLangs.includes(lang);
              return (
                <div
                  key={lang}
                  className={`tw-flex tw-items-center tw-gap-1 tw-rounded-full tw-px-3 tw-py-1.5 tw-text-sm tw-border ${
                    done
                      ? "tw-bg-green-50 tw-border-green-300 tw-text-green-700"
                      : "tw-bg-white tw-border-gray-300 tw-text-gray-600"
                  }`}
                >
                  <span className="tw-uppercase tw-font-semibold">{lang}</span>
                  {done ? (
                    <button
                      onClick={() => deleteTranslation(lang)}
                      className="tw-text-green-600 hover:tw-text-red-500"
                      title="✕"
                    >
                      ✕
                    </button>
                  ) : (
                    <button
                      onClick={() => generateTranslations([lang])}
                      disabled={translating}
                      className="tw-text-[#5971F6] hover:tw-underline tw-disabled:tw-opacity-50"
                    >
                      +
                    </button>
                  )}
                </div>
              );
            })}
            <button
              onClick={() => generateTranslations(ALL_LANGS)}
              disabled={translating}
              className={`tw-ml-2 tw-bg-white tw-border tw-border-[#5971F6] tw-text-[#5971F6] tw-rounded-full tw-px-4 tw-py-1.5 tw-text-sm tw-font-semibold hover:tw-bg-indigo-50 ${translating ? "tw-opacity-50" : ""}`}
            >
              {translating ? t("learning.aiGenerating") : `✨ ${t("learning.translateAll")}`}
            </button>
          </div>
        </div>
      )}

      {/* Functierollen: voor wie is deze module verplicht/aanbevolen? */}
      {jobRoles.length > 0 && (
        <div className="tw-mt-6">
          <h2 className="tw-text-lg tw-font-bold tw-text-gray-900 tw-mb-3">
            {t("learning.jobRoles")}
          </h2>
          <div className="tw-bg-white tw-rounded-2xl tw-border tw-border-gray-200 tw-divide-y tw-divide-gray-50">
            {jobRoles.map((jr) => {
              const coupled = jr.id in roleCouplings;
              return (
                <div
                  key={jr.id}
                  className="tw-flex tw-items-center tw-gap-3 tw-px-4 tw-py-2.5"
                >
                  <input
                    type="checkbox"
                    checked={coupled}
                    onChange={(e) =>
                      setRoleCouplings((m) => {
                        const next = { ...m };
                        if (e.target.checked) next[jr.id] = "required";
                        else delete next[jr.id];
                        return next;
                      })
                    }
                    className="tw-h-4 tw-w-4"
                  />
                  <span className="tw-flex-1 tw-text-sm tw-text-gray-800">
                    {jr.name}
                  </span>
                  {coupled && (
                    <select
                      className="tw-border tw-border-gray-300 tw-rounded-lg tw-px-2 tw-py-1 tw-text-xs tw-bg-white"
                      value={roleCouplings[jr.id]}
                      onChange={(e) =>
                        setRoleCouplings((m) => ({
                          ...m,
                          [jr.id]: e.target.value,
                        }))
                      }
                    >
                      <option value="required">{t("learning.required")}</option>
                      <option value="recommended">
                        {t("learning.recommended")}
                      </option>
                    </select>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button
        onClick={save}
        disabled={saving}
        className={`tw-mt-6 tw-bg-[#5971F6] tw-text-white tw-rounded-full tw-px-8 tw-py-2.5 tw-font-semibold hover:tw-bg-blue-700 ${
          saving ? "tw-opacity-50" : ""
        }`}
      >
        {t("form.send")}
      </button>
    </div>
  );
}

function ModuleFormPage() {
  return (
    <Suspense fallback={null}>
      <ModuleFormInner />
    </Suspense>
  );
}

export default authMiddleware(ModuleFormPage, undefined, false, "learning_admin");
