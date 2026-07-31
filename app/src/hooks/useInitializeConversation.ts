import { getAuthHeaders } from "@/utils/getAuthHeaders";
import { useState } from "react";
import * as Sentry from "@sentry/nextjs";

const APP_BASE_URL = process.env.APP_BASE_URL;

interface InitializeConversationResponse {
  success: boolean;
  conversationId: string;
  message: string;
}

interface UseInitializeConversationReturn {
  data: InitializeConversationResponse | null;
  loading: boolean;
  error: string | Error | null;
  fetch: () => Promise<InitializeConversationResponse | null>;
  refetch: () => Promise<InitializeConversationResponse | null>;
}

export function useInitializeConversation(): UseInitializeConversationReturn {
  const [data, setData] = useState<InitializeConversationResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | Error | null>(null);

  const request = async (): Promise<InitializeConversationResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const headers = getAuthHeaders({}, true);

      if (!headers) {
        const msg = "No auth token available";

        setError(msg);

        throw new Error(msg);
      }

      const res = await fetch(`${APP_BASE_URL}/api/conversations/initialize`, {
        method: "POST",
        headers: headers,
      });

      if (!res.ok) {
        const msg = `HTTP ${res.status}: ${res.statusText}`;

        setError(msg);

        throw new Error(msg);
      }

      const json = await res.json().catch(() => null);

      setData(json);

      return json;
    } catch (err) {
      Sentry.captureException(err);
      console.error("Initialize conversation error:", err);

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
