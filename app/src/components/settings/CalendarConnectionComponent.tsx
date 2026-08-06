"use client";

import { Spinner } from "@/components/MaterialTailwind";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast, ToastContainer } from "react-toastify";

type CalendarStatus = {
  connected: boolean;
  platform: string | null;
  email: string | null;
};

type Platform = "google_calendar" | "microsoft_outlook";

/**
 * Beheer-kaart voor de agenda-koppeling van de ingelogde verkoper (per
 * gebruiker, elke rol). De koppeling laat Reppic aankomende afspraken lezen om
 * automatisch een gespreksvoorbereiding te sturen — puur lezen, geen opname.
 */
const CalendarConnectionComponent = () => {
  const { t } = useTranslation("common");
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyPlatform, setBusyPlatform] = useState<Platform | "disconnect" | null>(
    null
  );

  const loadStatus = async () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const res = await fetch("/api/calendar/status", { headers });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setStatus(await res.json());
    } catch {
      toast.error(t("calendar.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
    // Terugkomst uit de OAuth-flow: toon resultaat en maak de URL schoon.
    const params = new URLSearchParams(window.location.search);
    const result = params.get("calendar");
    if (result === "connected") {
      toast.success(t("calendar.connected"));
    } else if (result === "error") {
      toast.error(t("calendar.connectFailed"));
    }
    if (result) {
      params.delete("calendar");
      const query = params.toString();
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}${query ? `?${query}` : ""}`
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnect = async (platform: Platform) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    setBusyPlatform(platform);
    try {
      const res = await fetch(`/api/calendar/connect?platform=${platform}`, {
        headers,
      });
      if (res.status === 501) {
        toast.info(t("calendar.notConfigured"));
        setBusyPlatform(null);
        return;
      }
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      window.location.href = data.url;
    } catch {
      toast.error(t("calendar.connectFailed"));
      setBusyPlatform(null);
    }
  };

  const handleDisconnect = async () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    if (!window.confirm(t("calendar.disconnectConfirm"))) return;
    setBusyPlatform("disconnect");
    try {
      const res = await fetch("/api/calendar/disconnect", {
        method: "POST",
        headers,
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      toast.success(t("calendar.disconnected"));
      await loadStatus();
    } catch {
      toast.error(t("calendar.disconnectFailed"));
    } finally {
      setBusyPlatform(null);
    }
  };

  const platformLabel = (platform: string | null) => {
    if (platform === "google_calendar") return t("calendar.platformGoogle");
    if (platform === "microsoft_outlook")
      return t("calendar.platformMicrosoft");
    return platform ?? "";
  };

  const busy = busyPlatform !== null;

  return (
    <div className="tw-max-w-2xl">
      <ToastContainer />
      <h2 className="tw-text-xl tw-font-semibold tw-mb-2">
        {t("calendar.title")}
      </h2>
      <p className="tw-text-sm tw-text-gray-600 tw-mb-6">
        {t("calendar.description")}
      </p>

      {isLoading ? (
        <Spinner className="tw-h-6 tw-w-6" />
      ) : (
        <div className="tw-border tw-border-[#D0D5DD] tw-rounded-lg tw-p-5">
          {status?.connected ? (
            <>
              <div className="tw-flex tw-items-center tw-gap-2 tw-mb-1">
                <span className="tw-inline-block tw-h-2.5 tw-w-2.5 tw-rounded-full tw-bg-green-500" />
                <span className="tw-font-medium">
                  {t("calendar.statusConnected")}
                </span>
              </div>
              <p className="tw-text-sm tw-text-gray-600 tw-mb-4">
                {platformLabel(status.platform)}
                {status.email ? ` — ${status.email}` : ""}
              </p>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={busy}
                className="tw-bg-white tw-text-red-600 tw-border tw-border-red-300 tw-py-2 tw-px-5 tw-rounded-lg tw-text-sm hover:tw-bg-red-50 disabled:tw-opacity-50"
              >
                {t("calendar.disconnect")}
              </button>
            </>
          ) : (
            <>
              <p className="tw-text-sm tw-text-gray-600 tw-mb-4">
                {t("calendar.notConnected")}
              </p>
              <div className="tw-flex tw-flex-wrap tw-gap-3">
                <button
                  type="button"
                  onClick={() => handleConnect("google_calendar")}
                  disabled={busy}
                  className="tw-bg-button tw-text-white tw-py-2 tw-px-5 tw-rounded-lg tw-text-sm disabled:tw-opacity-50"
                >
                  {busyPlatform === "google_calendar"
                    ? t("calendar.connecting")
                    : t("calendar.connectGoogle")}
                </button>
                <button
                  type="button"
                  onClick={() => handleConnect("microsoft_outlook")}
                  disabled={busy}
                  className="tw-bg-white tw-text-gray-700 tw-border tw-border-[#D0D5DD] tw-py-2 tw-px-5 tw-rounded-lg tw-text-sm hover:tw-bg-gray-50 disabled:tw-opacity-50"
                >
                  {busyPlatform === "microsoft_outlook"
                    ? t("calendar.connecting")
                    : t("calendar.connectMicrosoft")}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default CalendarConnectionComponent;
