import { useState } from "react";
import { getAuthHeaders } from "@/utils/getAuthHeaders";

const APP_BASE_URL = process.env.APP_BASE_URL;

interface SaveDraftResponse {
  message: string;
  data: any;
}

interface UseSaveDraftReturn {
  data: SaveDraftResponse | null;
  loading: boolean;
  error: string | Error | null;
  fetch: (
    conversationId: string,
    body: Record<string, any>
  ) => Promise<SaveDraftResponse | null>;
  refetch: (
    conversationId: string,
    body: Record<string, any>
  ) => Promise<SaveDraftResponse | null>;
}

export function useSaveDraft(): UseSaveDraftReturn {
  const [data, setData] = useState<SaveDraftResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | Error | null>(null);

  const request = async (
    conversationId: string,
    body: Record<string, any>
  ): Promise<SaveDraftResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${APP_BASE_URL}/api/conversations/${conversationId}/save-draft`,
        {
          method: "POST",
          body: JSON.stringify(body),
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders({}, true),
          },
        }
      );

      if (!res.ok) {
        const msg = `HTTP ${res.status}: ${res.statusText}`;
        console.error(msg);
        setError(msg);
        return null;
      }

      const json = await res.json().catch(() => null);
      setData(json);
      return json;
    } catch (err) {
      console.error("Save draft error:", err);
      setError(err as Error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const refetch = request;

  return {
    data,
    loading,
    error,
    fetch: request,
    refetch,
  };
}
