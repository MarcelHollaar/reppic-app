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

// Herkenbare merk-logo's (inline SVG, geen externe afbeeldingen) zodat de twee
// koppelknoppen in één oogopslag te onderscheiden zijn.
const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
  </svg>
);

const MicrosoftLogo = () => (
  <svg width="16" height="16" viewBox="0 0 23 23" aria-hidden="true">
    <path fill="#f35325" d="M1 1h10v10H1z" />
    <path fill="#81bc06" d="M12 1h10v10H12z" />
    <path fill="#05a6f0" d="M1 12h10v10H1z" />
    <path fill="#ffba08" d="M12 12h10v10H12z" />
  </svg>
);

/**
 * Beheer-kaart voor de agenda-koppeling van de ingelogde verkoper (per
 * gebruiker, elke rol). De koppeling laat Reppic aankomende afspraken lezen om
 * automatisch een gespreksvoorbereiding te sturen — puur lezen, geen opname.
 */
const CalendarConnectionComponent = () => {
  const { t, i18n } = useTranslation("common");
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyPlatform, setBusyPlatform] = useState<Platform | "disconnect" | null>(
    null
  );
  // Schakelbare pilot-disclaimer (DB-instelling); leeg = niets tonen.
  const [notice, setNotice] = useState<string>("");

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

  const loadNotice = async () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const lang = encodeURIComponent(i18n.language || "");
      const res = await fetch(`/api/calendar/notice?lang=${lang}`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      setNotice(typeof data.notice === "string" ? data.notice : "");
    } catch {
      // Disclaimer is niet-kritiek: bij een fout tonen we simpelweg niets.
    }
  };

  useEffect(() => {
    loadStatus();
    loadNotice();
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

      {/* Schakelbare pilot-disclaimer (DB-instelling calendar_pilot_notice).
          Toont niets als de waarde leeg is — developer kan 'm zonder deploy
          aanpassen of leegmaken. */}
      {notice && (
        <div className="tw-flex tw-gap-2 tw-items-start tw-bg-amber-50 tw-border tw-border-amber-200 tw-text-amber-900 tw-rounded-lg tw-p-4 tw-mb-6 tw-text-sm">
          <span aria-hidden="true">⏳</span>
          <span>{notice}</span>
        </div>
      )}

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
              {/* Twee gelijkwaardige knoppen, elk met eigen merk-logo, zodat
                  Google en Outlook niet te verwarren zijn. */}
              <div className="tw-flex tw-flex-wrap tw-gap-3">
                <button
                  type="button"
                  onClick={() => handleConnect("google_calendar")}
                  disabled={busy}
                  className="tw-flex tw-flex-1 tw-min-w-[210px] tw-items-center tw-justify-center tw-gap-2.5 tw-bg-white tw-text-[#344054] tw-font-medium tw-border tw-border-[#D0D5DD] tw-py-2.5 tw-px-5 tw-rounded-lg tw-text-sm hover:tw-bg-[#F9FAFB] hover:tw-border-[#98A2B3] tw-transition disabled:tw-opacity-50"
                >
                  <GoogleLogo />
                  {busyPlatform === "google_calendar"
                    ? t("calendar.connecting")
                    : t("calendar.connectGoogle")}
                </button>
                <button
                  type="button"
                  onClick={() => handleConnect("microsoft_outlook")}
                  disabled={busy}
                  className="tw-flex tw-flex-1 tw-min-w-[210px] tw-items-center tw-justify-center tw-gap-2.5 tw-bg-white tw-text-[#344054] tw-font-medium tw-border tw-border-[#D0D5DD] tw-py-2.5 tw-px-5 tw-rounded-lg tw-text-sm hover:tw-bg-[#F9FAFB] hover:tw-border-[#98A2B3] tw-transition disabled:tw-opacity-50"
                >
                  <MicrosoftLogo />
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
