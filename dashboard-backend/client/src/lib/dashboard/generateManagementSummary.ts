/**
 * generateManagementSummary.ts
 *
 * Client-side types, sectie-metadata en React-hook voor de management
 * conclusiegenerator. Canonieke bron — vervangt lib/managementConclusion.ts.
 *
 * Wraps POST /api/ai/management-conclusion.
 */

import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import type { EnrichedInsightItem } from "./enrichInsightItems";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConclusionThemeType = 'weerstanden' | 'triggers' | 'general';

export interface ManagementConclusionItem {
  label: string;
  pct: number;
  trend?: string;
  trendPct?: number;
  deltaAbsolute?: number;
  priorityLabel?: string;
  alertText?: string;
}

export interface ManagementConclusionInput {
  theme: string;
  type: ConclusionThemeType;
  items: ManagementConclusionItem[];
  language?: string;
  demo?: boolean;
}

export interface ManagementConclusionOutput {
  whatWeSee: string;
  likelyCause: string;
  operationalMeaning: string;
  strategicMeaning: string;
  recommendedAction: string;
}

// ─── Sectie-metadata per taal ─────────────────────────────────────────────────

export const CONCLUSION_SECTION_META: Record<string, {
  whatWeSee: string;
  likelyCause: string;
  operationalMeaning: string;
  strategicMeaning: string;
  recommendedAction: string;
}> = {
  nl: { whatWeSee: 'Wat zien we?',          likelyCause: 'Waarschijnlijke oorzaak',      operationalMeaning: 'Operationele betekenis',  strategicMeaning: 'Strategische betekenis',  recommendedAction: 'Aanbevolen managementactie' },
  en: { whatWeSee: 'What we see',           likelyCause: 'Probable cause',               operationalMeaning: 'Operational impact',      strategicMeaning: 'Strategic impact',        recommendedAction: 'Recommended management action' },
  de: { whatWeSee: 'Was wir sehen',         likelyCause: 'Wahrscheinliche Ursache',      operationalMeaning: 'Operationale Bedeutung',  strategicMeaning: 'Strategische Bedeutung',  recommendedAction: 'Empfohlene Maßnahme' },
  fr: { whatWeSee: 'Ce que nous voyons',    likelyCause: 'Cause probable',               operationalMeaning: 'Impact opérationnel',     strategicMeaning: 'Impact stratégique',      recommendedAction: 'Action recommandée' },
  es: { whatWeSee: 'Lo que vemos',          likelyCause: 'Causa probable',               operationalMeaning: 'Impacto operacional',     strategicMeaning: 'Impacto estratégico',     recommendedAction: 'Acción recomendada' },
  it: { whatWeSee: 'Quello che vediamo',    likelyCause: 'Causa probabile',              operationalMeaning: 'Impatto operativo',       strategicMeaning: 'Impatto strategico',      recommendedAction: 'Azione raccomandata' },
};

// ─── Helper: bouw API-invoer vanuit verrijkte items ────────────────────────────

export function enrichedToMgmtItems(
  enriched: EnrichedInsightItem[],
): ManagementConclusionItem[] {
  return enriched.map(item => ({
    label:         item.name,
    pct:           item.pct ?? item.currentValue ?? 0,
    trend:         item.trend,
    trendPct:      item.trendPct,
    deltaAbsolute: item.deltaAbsolute,
    priorityLabel: item.priorityLabel,
    alertText:     item.alertText,
  }));
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseManagementConclusionReturn {
  conclusion: ManagementConclusionOutput | null;
  loading: boolean;
  error: string | null;
  generate: (input: ManagementConclusionInput) => Promise<void>;
  reset: () => void;
}

export function useManagementConclusion(): UseManagementConclusionReturn {
  const [conclusion, setConclusion] = useState<ManagementConclusionOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async (input: ManagementConclusionInput) => {
    setLoading(true);
    setError(null);
    setConclusion(null);
    try {
      const res = await apiRequest("POST", "/api/ai/management-conclusion", input);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data: ManagementConclusionOutput = await res.json();
      setConclusion(data);
    } catch (e: any) {
      setError(e.message ?? 'Fout bij genereren van conclusie');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setConclusion(null);
    setError(null);
  };

  return { conclusion, loading, error, generate, reset };
}
