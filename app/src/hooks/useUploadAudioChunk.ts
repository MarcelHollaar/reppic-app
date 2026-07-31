import { useState } from "react";
import { getAuthHeaders } from "@/utils/getAuthHeaders";

const APP_BASE_URL = process.env.APP_BASE_URL;

interface UploadAudioChunkResponse {
  success: boolean;
  conversationId: string;
  path: string;
  message: string;
}

interface UseUploadAudioChunkReturn {
  data: UploadAudioChunkResponse | null;
  loading: boolean;
  error: string | Error | null;
  fetch: (
    conversationId: string,
    chunk: Blob
  ) => Promise<UploadAudioChunkResponse | null>;
  refetch: (
    conversationId: string,
    chunk: Blob
  ) => Promise<UploadAudioChunkResponse | null>;
}

export function useUploadAudioChunk(): UseUploadAudioChunkReturn {
  const [data, setData] = useState<UploadAudioChunkResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | Error | null>(null);

  const request = async (
    conversationId: string,
    chunk: Blob
  ): Promise<UploadAudioChunkResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("audio", chunk, `chunk-${Date.now()}.webm`);
      formData.append("conversationId", conversationId);

      const res = await fetch(`${APP_BASE_URL}/api/upload-audio-chunk`, {
        method: "POST",
        body: formData,
        headers: {
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
      console.error("Upload audio chunk error:", err);
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
