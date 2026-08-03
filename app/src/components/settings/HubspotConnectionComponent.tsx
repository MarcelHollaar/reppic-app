"use client";

import { Spinner } from "@/components/MaterialTailwind";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast, ToastContainer } from "react-toastify";

type HubspotStatus =
  | { connected: false }
  | {
      connected: true;
      portalId: string;
      status: "active" | "broken" | string;
      connectedAt: string;
    };

/**
 * Beheer-kaart voor de HubSpot-koppeling van de eigen tenant (company-admin).
 * De koppeling voedt de automatische gespreksvoorbereiding met CRM-context
 * (dealfase, contactpersoon, notities).
 */
const HubspotConnectionComponent = () => {
  const { t } = useTranslation("common");
  const [status, setStatus] = useState<HubspotStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);

  const loadStatus = async () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const res = await fetch("/api/hubspot/status", { headers });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setStatus(await res.json());
    } catch {
      toast.error(t("hubspot.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
    // Terugkomst uit de OAuth-flow: toon resultaat en maak de URL schoon.
    const params = new URLSearchParams(window.location.search);
    const result = params.get("hubspot");
    if (result === "connected") {
      toast.success(t("hubspot.connected"));
    } else if (result === "error") {
      toast.error(t("hubspot.connectFailed"));
    }
    if (result) {
      params.delete("hubspot");
      const query = params.toString();
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}${query ? `?${query}` : ""}`
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnect = async () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    setIsBusy(true);
    try {
      const res = await fetch("/api/hubspot/connect", { headers });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      window.location.href = data.url;
    } catch {
      toast.error(t("hubspot.connectFailed"));
      setIsBusy(false);
    }
  };

  const handleDisconnect = async () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    if (!window.confirm(t("hubspot.disconnectConfirm"))) return;
    setIsBusy(true);
    try {
      const res = await fetch("/api/hubspot/disconnect", {
        method: "POST",
        headers,
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      toast.success(t("hubspot.disconnected"));
      await loadStatus();
    } catch {
      toast.error(t("hubspot.disconnectFailed"));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="tw-max-w-2xl">
      <ToastContainer />
      <h2 className="tw-text-xl tw-font-semibold tw-mb-2">
        {t("hubspot.title")}
      </h2>
      <p className="tw-text-sm tw-text-gray-600 tw-mb-6">
        {t("hubspot.description")}
      </p>

      {isLoading ? (
        <Spinner className="tw-h-6 tw-w-6" />
      ) : (
        <div className="tw-border tw-border-[#D0D5DD] tw-rounded-lg tw-p-5">
          {status?.connected ? (
            <>
              <div className="tw-flex tw-items-center tw-gap-2 tw-mb-1">
                <span
                  className={`tw-inline-block tw-h-2.5 tw-w-2.5 tw-rounded-full ${
                    status.status === "active"
                      ? "tw-bg-green-500"
                      : "tw-bg-red-500"
                  }`}
                />
                <span className="tw-font-medium">
                  {status.status === "active"
                    ? t("hubspot.statusActive")
                    : t("hubspot.statusBroken")}
                </span>
              </div>
              <p className="tw-text-sm tw-text-gray-600 tw-mb-4">
                {t("hubspot.portal")}: {status.portalId}
              </p>
              {status.status !== "active" && (
                <p className="tw-text-sm tw-text-red-600 tw-mb-4">
                  {t("hubspot.brokenHint")}
                </p>
              )}
              <div className="tw-flex tw-gap-3">
                {status.status !== "active" && (
                  <button
                    type="button"
                    onClick={handleConnect}
                    disabled={isBusy}
                    className="tw-bg-button tw-text-white tw-py-2 tw-px-5 tw-rounded-lg tw-text-sm disabled:tw-opacity-50"
                  >
                    {t("hubspot.reconnect")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={isBusy}
                  className="tw-bg-white tw-text-red-600 tw-border tw-border-red-300 tw-py-2 tw-px-5 tw-rounded-lg tw-text-sm hover:tw-bg-red-50 disabled:tw-opacity-50"
                >
                  {t("hubspot.disconnect")}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="tw-text-sm tw-text-gray-600 tw-mb-4">
                {t("hubspot.notConnected")}
              </p>
              <button
                type="button"
                onClick={handleConnect}
                disabled={isBusy}
                className="tw-bg-button tw-text-white tw-py-2 tw-px-5 tw-rounded-lg tw-text-sm disabled:tw-opacity-50"
              >
                {isBusy ? t("hubspot.connecting") : t("hubspot.connect")}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default HubspotConnectionComponent;
