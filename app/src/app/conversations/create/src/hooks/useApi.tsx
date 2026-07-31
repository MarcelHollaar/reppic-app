import { useState } from "react";

interface UseApiProps {
  baseURL: string;
  defaultHeaders?: Record<string, string>;
}

export function useApi<T = Record<string, string>>({
  baseURL,
  defaultHeaders = {},
}: UseApiProps) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | Error | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const request = async (
    path: string,
    options: RequestInit = {}
  ): Promise<T | null> => {
    setLoading(true);
    setError(null);

    try {
      const url = baseURL + path;

      const res = await fetch(url, {
        ...options,
        headers: {
          ...defaultHeaders,
          ...(options.headers || {}),
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
      console.error("API request error:", err);
      setError(err as Error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    data,
    error,
    loading,
    get: (path: string) => request(path, { method: "GET" }),
    post: (path: string, body: any, headers: Record<string, string> = {}) =>
      request(path, {
        method: "POST",
        body: body,
        headers,
      }),
    put: (path: string, body: any, headers: Record<string, string> = {}) =>
      request(path, {
        method: "PUT",
        body: body,
        headers,
      }),
    del: (path: string, headers: Record<string, string> = {}) =>
      request(path, {
        method: "DELETE",
        headers,
      }),
  };
}
