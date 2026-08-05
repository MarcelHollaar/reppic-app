"use client";
/**
 * /learning/help — Help-center voor gebruikers (LMS 1:1 P3, port van
 * productie HelpCenter.tsx): zoeken + artikelen per categorie lezen.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import authMiddleware from "@/middleware/authMiddleware";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import {
  ChevronLeftIcon,
  MagnifyingGlassIcon,
  QuestionMarkCircleIcon,
} from "@heroicons/react/24/outline";

type HelpArticle = {
  id: string;
  title: string;
  excerpt: string | null;
  content: string;
  category_id: string | null;
  view_count: number;
};

type HelpCategory = { id: string; name: string; icon: string | null };

function HelpCenterPage() {
  const router = useRouter();
  const { t, i18n } = useTranslation("common");
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [categories, setCategories] = useState<HelpCategory[]>([]);
  const [search, setSearch] = useState("");
  const [openArticle, setOpenArticle] = useState<HelpArticle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const headers = getAuthHeaders();
    if (!headers) return;
    Promise.all([
      fetch(`/api/learning/help/articles?lang=${i18n.language}`, { headers })
        .then((r) => (r.ok ? r.json() : { data: [] }))
        .then((res) => setArticles(res.data || [])),
      fetch("/api/learning/help/categories", { headers })
        .then((r) => (r.ok ? r.json() : { data: [] }))
        .then((res) => setCategories(res.data || [])),
    ]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language]);

  const filtered = useMemo(() => {
    if (!search.trim()) return articles;
    const q = search.toLowerCase();
    return articles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        (a.excerpt || "").toLowerCase().includes(q),
    );
  }, [articles, search]);

  const byCategory = useMemo(() => {
    const map = new Map<string, HelpArticle[]>();
    for (const a of filtered) {
      const key = a.category_id || "";
      map.set(key, [...(map.get(key) || []), a]);
    }
    return map;
  }, [filtered]);

  const openFull = async (article: HelpArticle) => {
    setOpenArticle(article);
    const headers = getAuthHeaders();
    if (!headers) return;
    // View-teller + actuele content (zoals productie /help/:id).
    fetch(`/api/learning/help/articles/${article.id}`, { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => res?.data && setOpenArticle(res.data))
      .catch(() => {});
  };

  if (loading) {
    return (
      <div className="tw-flex tw-justify-center tw-py-20">
        <div className="tw-animate-spin tw-rounded-full tw-h-8 tw-w-8 tw-border-b-2 tw-border-[#5971F6]" />
      </div>
    );
  }

  // Leesweergave van één artikel
  if (openArticle) {
    return (
      <div className="tw-p-6 tw-max-w-3xl tw-mx-auto">
        <button
          onClick={() => setOpenArticle(null)}
          className="tw-flex tw-items-center tw-gap-1 tw-text-sm tw-text-gray-500 hover:tw-text-gray-800 tw-mb-4"
        >
          <ChevronLeftIcon className="tw-w-4 tw-h-4" /> {t("learning.helpCenter")}
        </button>
        <h1 className="tw-text-2xl tw-font-bold tw-text-gray-900 tw-mb-4">
          {openArticle.title}
        </h1>
        <div className="tw-prose tw-max-w-none tw-text-gray-700 tw-whitespace-pre-line">
          {openArticle.content}
        </div>
      </div>
    );
  }

  return (
    <div className="tw-p-6 tw-max-w-4xl tw-mx-auto">
      <h1 className="tw-text-2xl tw-font-bold tw-text-gray-900 tw-mb-1">
        {t("learning.helpCenter")}
      </h1>
      <p className="tw-text-gray-500 tw-text-sm tw-mb-6">
        {t("learning.helpCenterNote")}
      </p>

      <div className="tw-relative tw-mb-8">
        <MagnifyingGlassIcon className="tw-w-5 tw-h-5 tw-text-gray-400 tw-absolute tw-left-3 tw-top-1/2 -tw-translate-y-1/2" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("learning.helpSearch")}
          className="tw-w-full tw-border tw-border-gray-300 tw-rounded-full tw-pl-10 tw-pr-4 tw-py-2.5 tw-text-sm focus:tw-outline-none focus:tw-border-[#5971F6]"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="tw-text-center tw-py-16 tw-text-gray-400">
          <QuestionMarkCircleIcon className="tw-w-12 tw-h-12 tw-mx-auto tw-mb-3" />
          {t("learning.helpNoArticles")}
        </div>
      ) : (
        Array.from(byCategory.entries()).map(([catId, items]) => {
          const cat = categories.find((c) => c.id === catId);
          return (
            <div key={catId || "uncat"} className="tw-mb-8">
              <h2 className="tw-text-base tw-font-bold tw-text-gray-800 tw-mb-3">
                {cat ? `${cat.icon ? `${cat.icon} ` : ""}${cat.name}` : t("learning.helpGeneral")}
              </h2>
              <div className="tw-flex tw-flex-col tw-gap-2">
                {items.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => openFull(a)}
                    className="tw-text-left tw-bg-white tw-border tw-border-gray-200 tw-rounded-xl tw-px-4 tw-py-3 hover:tw-border-[#5971F6] tw-transition-colors"
                  >
                    <span className="tw-font-semibold tw-text-gray-900 tw-text-sm">
                      {a.title}
                    </span>
                    {a.excerpt && (
                      <p className="tw-text-xs tw-text-gray-500 tw-mt-0.5">
                        {a.excerpt}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

export default authMiddleware(HelpCenterPage, undefined, false, "learner");
