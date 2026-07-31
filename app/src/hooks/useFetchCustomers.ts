import { useState } from "react";
import { getAuthHeaders } from "@/utils/getAuthHeaders";

const APP_BASE_URL = process.env.APP_BASE_URL;

interface Customer {
  created_at: string;
  id: string;
  name: string;
  updated_at: string;
  user_id: string;
}

interface FetchCustomersResponse {
  message: string;
  data: Customer[];
}

interface UseFetchCustomersReturn {
  data: FetchCustomersResponse | null;
  loading: boolean;
  error: string | Error | null;
  fetch: () => Promise<FetchCustomersResponse | null>;
  refetch: () => Promise<FetchCustomersResponse | null>;
}

export function useFetchCustomers(): UseFetchCustomersReturn {
  const [data, setData] = useState<FetchCustomersResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | Error | null>(null);

  const request = async (): Promise<FetchCustomersResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const headers = getAuthHeaders();

      const res = await fetch(`${APP_BASE_URL}/api/customers`, {
        method: "GET",
        headers: headers || {},
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
      console.error("Fetch customers error:", err);
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
