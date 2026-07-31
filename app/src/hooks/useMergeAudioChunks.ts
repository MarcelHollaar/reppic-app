import { useState } from "react";
import { getAuthHeaders } from "@/utils/getAuthHeaders";

const APP_BASE_URL = process.env.APP_BASE_URL;

interface MergeAudioChunksResponse {
  message: string;
  path: string;
  chunksCount: number;
  totalSize: number;
}

interface UseMergeAudioChunksReturn {
  data: MergeAudioChunksResponse | null;
  loading: boolean;
  error: string | Error | null;
  fetch: (conversationId: string) => Promise<MergeAudioChunksResponse | null>;
  refetch: (conversationId: string) => Promise<MergeAudioChunksResponse | null>;
}

export function useMergeAudioChunks(): UseMergeAudioChunksReturn {
  const [data, setData] = useState<MergeAudioChunksResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | Error | null>(null);

  const request = async (
    conversationId: string
  ): Promise<MergeAudioChunksResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${APP_BASE_URL}/api/merge-audio-chunks`, {
        method: "POST",
        body: JSON.stringify({ conversationId }),
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders({}, true),
        },
      });

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
      console.error("Merge audio chunks error:", err);
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
