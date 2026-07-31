import { useState } from "react";
import { getAuthHeaders } from "@/utils/getAuthHeaders";

const APP_BASE_URL = process.env.APP_BASE_URL;

interface DeleteAudioChunksResponse {
  message: string;
}

interface UseDeleteAudioChunksReturn {
  data: DeleteAudioChunksResponse | null;
  loading: boolean;
  error: string | Error | null;
  fetch: (conversationId: string) => Promise<DeleteAudioChunksResponse | null>;
  refetch: (
    conversationId: string
  ) => Promise<DeleteAudioChunksResponse | null>;
}

export function useDeleteAudioChunks(): UseDeleteAudioChunksReturn {
  const [data, setData] = useState<DeleteAudioChunksResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | Error | null>(null);

  const request = async (
    conversationId: string
  ): Promise<DeleteAudioChunksResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${APP_BASE_URL}/api/audio-chunks?conversationId=${conversationId}`,
        {
          method: "DELETE",
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
      console.error("Delete audio chunks error:", err);
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
