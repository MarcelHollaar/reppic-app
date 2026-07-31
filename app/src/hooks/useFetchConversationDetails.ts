import { useState } from "react";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import { types } from "@/app/api/utils/type-constants";
import { ConversationDetailResponse } from "../app/conversations/[id]/src/providers/ConversationDetailProvider";

const APP_BASE_URL = process.env.APP_BASE_URL;

interface FetchConversationDetailsResponse {
  data: ConversationDetailResponse;
}

interface UseFetchConversationDetailsReturn {
  data: FetchConversationDetailsResponse | null;
  loading: boolean;
  error: string | Error | null;
  fetch: (
    conversationId: string
  ) => Promise<FetchConversationDetailsResponse | null>;
  refetch: (
    conversationId: string
  ) => Promise<FetchConversationDetailsResponse | null>;
}

export function useFetchConversationDetails(): UseFetchConversationDetailsReturn {
  const [data, setData] = useState<FetchConversationDetailsResponse | null>(
    null
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | Error | null>(null);

  const request = async (
    conversationId: string
  ): Promise<FetchConversationDetailsResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const headers = getAuthHeaders({}, true);

      if (!headers) {
        const msg = "No auth token available";
        console.error(msg);
        setError(msg);
        return null;
      }

      const res = await fetch(
        `${APP_BASE_URL}/api/conversations/?id=${conversationId}&type=${types.GET_CONVERSATIONS}`,
        {
          method: "GET",
          headers: headers,
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
      console.error("Fetch conversation details error:", err);
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
