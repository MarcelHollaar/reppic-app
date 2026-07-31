"use client";
import { useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_DASHBOARD_API_URL || "http://localhost:5001";

export function useDashboardApi() {
  const get = useCallback(async (path: string, params?: Record<string, string>) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) throw new Error("Not authenticated");

    const url = new URL(`${API_URL}${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error || `API error ${res.status}`);
    }
    return res.json();
  }, []);

  const post = useCallback(async (path: string, body: unknown) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) throw new Error("Not authenticated");

    const res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || `API error ${res.status}`);
    }
    return res.json();
  }, []);

  return { get, post };
}
