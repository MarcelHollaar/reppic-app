import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Route } from "@/utils/getRoutes";
import { buildRoutes } from "@/utils/getRoutes";

export const useRoutes = (userRole: string | null): Route[] => {
  const { t } = useTranslation("common");
  const [user, setUser] = useState<any | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const raw = window.localStorage.getItem("user_data");
      if (!raw) {
        setUser(null);
        return;
      }
      const parsed = JSON.parse(raw);
      setUser(parsed);
    } catch (error) {
      console.error("Failed to parse user_data from localStorage", error);
      setUser(null);
    }
  }, []);

  return useMemo(() => buildRoutes({ t, userRole, user }), [t, userRole, user]);
};
