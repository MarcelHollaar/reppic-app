import { useState } from "react";
import { getAuthHeaders } from "@/utils/getAuthHeaders";

const APP_BASE_URL = process.env.APP_BASE_URL;

interface UpdateConversationResponse {
  message: string;
  data: any;
}

interface UseUpdateConversationReturn {
  data: UpdateConversationResponse | null;
  loading: boolean;
  error: string | Error | null;
  fetch: (
    conversationId: string,
    body: Record<string, any>
  ) => Promise<UpdateConversationResponse | null>;
  refetch: (
    conversationId: string,
    body: Record<string, any>
  ) => Promise<UpdateConversationResponse | null>;
}

export function useUpdateConversation(): UseUpdateConversationReturn {
  const [data, setData] = useState<UpdateConversationResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | Error | null>(null);

  const request = async (
    conversationId: string,
    body: Record<string, any>
  ): Promise<UpdateConversationResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${APP_BASE_URL}/api/conversationsx/${conversationId}`,
        {
          method: "PUT",
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
      console.error("Update conversation error:", err);
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
