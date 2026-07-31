import { useState } from "react";
import { getAuthHeaders } from "@/utils/getAuthHeaders";

const APP_BASE_URL = process.env.APP_BASE_URL;

interface AssembleAndProcessResponse {
  success: boolean;
  message: string;
  transcriptId: string;
}

interface UseAssembleAndProcessReturn {
  data: AssembleAndProcessResponse | null;
  loading: boolean;
  error: string | Error | null;
  fetch: (conversationId: string) => Promise<AssembleAndProcessResponse | null>;
  refetch: (
    conversationId: string
  ) => Promise<AssembleAndProcessResponse | null>;
}

export function useAssembleAndProcess(): UseAssembleAndProcessReturn {
  const [data, setData] = useState<AssembleAndProcessResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | Error | null>(null);

  const request = async (
    conversationId: string
  ): Promise<AssembleAndProcessResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${APP_BASE_URL}/api/conversations/assemble-and-process`,
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
        return null;
      }

      const json = await res.json().catch(() => null);
      setData(json);
      return json;
    } catch (err) {
      console.error("Assemble and process error:", err);
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
