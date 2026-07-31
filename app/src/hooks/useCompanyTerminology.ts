"use client";
import { useEffect, useState } from "react";
import { getAuthHeaders } from "@/utils/getAuthHeaders";

export type TerminologyMapping = Record<string, string>;

// Module-level cache so multiple dashboard tiles share one fetch per session.
let cache: TerminologyMapping | null = null;
let inflight: Promise<TerminologyMapping> | null = null;

async function loadGlossary(): Promise<TerminologyMapping> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const headers = getAuthHeaders();
      if (!headers) return {};
      const res = await fetch("/api/terminology/mine", {
        method: "GET",
        headers,
      });
      if (!res.ok) return {};
      const data = await res.json();
      cache = (data?.mapping as TerminologyMapping) || {};
      return cache;
    } catch {
      return {};
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/**
 * Returns the logged-in user's company terminology glossary (concept key ->
 * company term). Empty object when there is none. Cached for the session.
 */
export function useCompanyTerminology(): TerminologyMapping {
  const [mapping, setMapping] = useState<TerminologyMapping>(cache || {});

  useEffect(() => {
    let active = true;
    loadGlossary().then((m) => {
      if (active) setMapping(m);
    });
    return () => {
      active = false;
    };
  }, []);

  return mapping;
}
