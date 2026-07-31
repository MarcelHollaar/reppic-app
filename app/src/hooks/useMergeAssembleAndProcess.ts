import { useState } from "react";
import { getAuthHeaders } from "@/utils/getAuthHeaders";

const APP_BASE_URL = process.env.APP_BASE_URL;

interface MergeAssembleAndProcessResponse {
  success: boolean;
  processing: boolean;
  message: string;
  chunksCount: number;
}

interface UseMergeAssembleAndProcessReturn {
  loading: boolean;
  error: string | Error | null;
  fetch: (conversationId: string) => Promise<boolean>;
}

export function useMergeAssembleAndProcess(): UseMergeAssembleAndProcessReturn {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | Error | null>(null);

  const request = async (conversationId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${APP_BASE_URL}/api/conversations/merge-assemble-and-process`,
        {
          method: "POST",
          body: JSON.stringify({ conversationId }),
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
        return false;
      }

      const json: MergeAssembleAndProcessResponse = await res
        .json()
        .catch(() => null);
      return json?.success ?? false;
    } catch (err) {
      console.error("Merge assemble and process error:", err);
      setError(err as Error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    fetch: request,
  };
}
