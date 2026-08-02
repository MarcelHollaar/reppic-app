"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import { Spinner } from "@/components/MaterialTailwind";
import { toast, ToastContainer } from "react-toastify";
import { useTranslation } from "react-i18next";

interface CompanyOption {
  id: string;
  title: string;
  hasGlossary: boolean;
}

interface Concept {
  key: string;
  standardLabel: string;
  phaseKey?: string;
}

type Mapping = Record<string, string>;

export default function TerminologyManager() {
  const { t } = useTranslation("common");

  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [phases, setPhases] = useState<Concept[]>([]);
  const [topics, setTopics] = useState<Concept[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});

  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loadingGlossary, setLoadingGlossary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [proposalCount, setProposalCount] = useState<number | null>(null);
  // Productnamen/kernbegrippen voor transcriptie-keyterms — als vrije tekst
  // (komma- of regel-gescheiden) zodat plakken vanuit een lijst makkelijk is.
  const [productTermsText, setProductTermsText] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load company list once.
  useEffect(() => {
    const load = async () => {
      try {
        const headers = getAuthHeaders();
        const res = await fetch("/api/superadmin/terminology/companies", {
          method: "GET",
          headers: headers || undefined,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "error");
        setCompanies(data.companies || []);
      } catch (e) {
        console.error("[terminology] load companies failed", e);
        toast.error(t("terminology.loadCompaniesError"));
      } finally {
        setLoadingCompanies(false);
      }
    };
    load();
  }, [t]);

  // Load the glossary whenever a company is selected.
  useEffect(() => {
    setProposalCount(null);
    setPastedText("");
    setProductTermsText("");
    if (!selectedCompanyId) {
      setPhases([]);
      setTopics([]);
      setMapping({});
      return;
    }
    const load = async () => {
      setLoadingGlossary(true);
      try {
        const headers = getAuthHeaders();
        const res = await fetch(
          `/api/superadmin/terminology?companyId=${encodeURIComponent(selectedCompanyId)}`,
          { method: "GET", headers: headers || undefined },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "error");
        setPhases(data.phases || []);
        setTopics(data.topics || []);
        setMapping(data.mapping || {});
        setProductTermsText(
          Array.isArray(data.productTerms) ? data.productTerms.join(", ") : "",
        );
      } catch (e) {
        console.error("[terminology] load glossary failed", e);
        toast.error(t("terminology.loadGlossaryError"));
      } finally {
        setLoadingGlossary(false);
      }
    };
    load();
  }, [selectedCompanyId, t]);

  const topicsByPhase = useMemo(() => {
    const grouped: Record<string, Concept[]> = {};
    for (const topic of topics) {
      const key = topic.phaseKey || "";
      (grouped[key] = grouped[key] || []).push(topic);
    }
    return grouped;
  }, [topics]);

  const handleChange = (key: string, value: string) => {
    setMapping((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!selectedCompanyId) return;
    setSaving(true);
    try {
      const headers = getAuthHeaders();
      // Trim + drop empty values before sending; server sanitizes too.
      const clean: Mapping = {};
      for (const [k, v] of Object.entries(mapping)) {
        const term = (v || "").trim();
        if (term) clean[k] = term;
      }
      const productTerms = productTermsText
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch("/api/superadmin/terminology", {
        method: "PUT",
        headers: headers || undefined,
        body: JSON.stringify({
          companyId: selectedCompanyId,
          mapping: clean,
          productTerms,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "error");
      setMapping(data.mapping || {});
      setProductTermsText(
        Array.isArray(data.productTerms) ? data.productTerms.join(", ") : "",
      );
      // Mark the company as having a glossary (for the picker hint).
      setCompanies((prev) =>
        prev.map((c) =>
          c.id === selectedCompanyId
            ? { ...c, hasGlossary: Object.keys(data.mapping || {}).length > 0 }
            : c,
        ),
      );
      toast.success(t("terminology.saved"));
    } catch (e) {
      console.error("[terminology] save failed", e);
      toast.error(t("terminology.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    const cleared: Mapping = {};
    setMapping(cleared);
    setProposalCount(null);
  };

  const applyProposal = (proposal: Mapping) => {
    const keys = Object.keys(proposal);
    // The proposal pre-fills the table (proposal wins over existing values);
    // nothing is saved until the superadmin reviews and clicks Save.
    setMapping((prev) => ({ ...prev, ...proposal }));
    setProposalCount(keys.length);
    if (keys.length > 0) {
      toast.success(t("terminology.proposalReady", { count: keys.length }));
    } else {
      toast.info(t("terminology.proposalEmpty"));
    }
  };

  const runSuggest = async (form: FormData) => {
    if (!selectedCompanyId) return;
    setSuggesting(true);
    setProposalCount(null);
    try {
      // getAuthHeaders with isFormData=true omits Content-Type so the browser
      // sets the multipart boundary itself.
      const headers = getAuthHeaders({}, true);
      const res = await fetch("/api/superadmin/terminology/suggest", {
        method: "POST",
        headers: headers || undefined,
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.error === "UNSUPPORTED_FILETYPE") {
          toast.error(t("terminology.unsupportedFile"));
        } else {
          toast.error(t("terminology.suggestError"));
        }
        return;
      }
      applyProposal(data.mapping || {});
    } catch (e) {
      console.error("[terminology] suggest failed", e);
      toast.error(t("terminology.suggestError"));
    } finally {
      setSuggesting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    await runSuggest(form);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePastedSuggest = async () => {
    if (!pastedText.trim()) return;
    const form = new FormData();
    form.append("text", pastedText);
    await runSuggest(form);
  };

  const filledCount = useMemo(
    () => Object.values(mapping).filter((v) => (v || "").trim()).length,
    [mapping],
  );

  const renderRow = (concept: Concept, isPhase: boolean) => (
    <tr
      key={concept.key}
      className={isPhase ? "bg-gray-50 dark:bg-gray-800/60" : ""}
    >
      <td
        className={`px-4 py-2 align-middle ${
          isPhase
            ? "font-semibold text-gray-900 dark:text-gray-100"
            : "text-gray-700 dark:text-gray-300 pl-8"
        }`}
      >
        {concept.standardLabel}
      </td>
      <td className="px-4 py-2">
        <input
          type="text"
          value={mapping[concept.key] || ""}
          onChange={(e) => handleChange(concept.key, e.target.value)}
          placeholder={t("terminology.termPlaceholder")}
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </td>
    </tr>
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <ToastContainer position="top-right" autoClose={3000} />

      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        {t("terminology.title")}
      </h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        {t("terminology.intro")}
      </p>

      {/* Company picker */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t("terminology.selectCompany")}
        </label>
        {loadingCompanies ? (
          <Spinner />
        ) : (
          <select
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            className="w-full sm:w-96 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">{t("terminology.selectCompanyPlaceholder")}</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
                {c.hasGlossary ? " ✓" : ""}
              </option>
            ))}
          </select>
        )}
      </div>

      {selectedCompanyId && loadingGlossary && (
        <div className="py-10 flex justify-center">
          <Spinner />
        </div>
      )}

      {selectedCompanyId && !loadingGlossary && (phases.length > 0 || topics.length > 0) && (
        <>
          {/* AI-assisted proposal from an uploaded document or pasted text */}
          <div className="mb-6 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-4 bg-gray-50/60 dark:bg-gray-800/40">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">
              {t("terminology.aiTitle")}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              {t("terminology.aiHelp")}
            </p>
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.csv,.text,.docx"
                  onChange={handleFileChange}
                  disabled={suggesting}
                  className="block text-sm text-gray-700 dark:text-gray-300 file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-blue-700 file:cursor-pointer disabled:opacity-50"
                />
                {suggesting && <Spinner />}
              </div>
              <details className="text-sm">
                <summary className="cursor-pointer text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
                  {t("terminology.orPaste")}
                </summary>
                <div className="mt-2">
                  <textarea
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    disabled={suggesting}
                    rows={5}
                    placeholder={t("terminology.pastePlaceholder")}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handlePastedSuggest}
                    disabled={suggesting || !pastedText.trim()}
                    className="mt-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {t("terminology.suggestFromText")}
                  </button>
                </div>
              </details>
              {proposalCount !== null && proposalCount > 0 && (
                <div className="rounded-md bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
                  {t("terminology.proposalBanner", { count: proposalCount })}
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-800 text-left">
                  <th className="px-4 py-2 font-medium text-gray-700 dark:text-gray-300 w-1/2">
                    {t("terminology.standardConcept")}
                  </th>
                  <th className="px-4 py-2 font-medium text-gray-700 dark:text-gray-300 w-1/2">
                    {t("terminology.companyTerm")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {phases.map((phase) => (
                  <React.Fragment key={phase.key}>
                    {renderRow(phase, true)}
                    {(topicsByPhase[phase.key] || []).map((topic) =>
                      renderRow(topic, false),
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              {t("terminology.productTermsTitle")}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("terminology.productTermsIntro")}
            </p>
            <textarea
              value={productTermsText}
              onChange={(e) => setProductTermsText(e.target.value)}
              rows={3}
              placeholder={t("terminology.productTermsPlaceholder")}
              className="mt-2 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {t("terminology.filledCount", { count: filledCount })}
            </span>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClear}
                disabled={saving}
                className="rounded-md border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
              >
                {t("terminology.clearAll")}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? t("terminology.saving") : t("terminology.save")}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
