"use client";

import { Spinner } from "@/components/MaterialTailwind";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast, ToastContainer } from "react-toastify";

type ProviderId = "hubspot" | "salesforce" | "dynamics";

type ProviderInfo = { id: ProviderId; label: string; configured: boolean };

type CrmStatus = {
  connected: boolean;
  provider?: ProviderId;
  externalAccountId?: string;
  status?: "active" | "broken" | string;
  connectedAt?: string;
  providers: ProviderInfo[];
};

// Herkenbare merk-logo's (inline SVG, geen externe afbeeldingen) zodat de
// koppelknoppen in één oogopslag te onderscheiden zijn.
const HubspotLogo = () => (
  <svg width="16" height="16" viewBox="0 0 32 32" aria-hidden="true">
    <path
      fill="#FF7A59"
      d="M23 12.7V9.4a2.6 2.6 0 1 0-3 0v3.3a7.6 7.6 0 0 0-3.5 1.5l-9-7a2.9 2.9 0 1 0-1.4 1.8l8.8 6.9a7.6 7.6 0 0 0 .1 8.6l-2.7 2.7a2.5 2.5 0 1 0 1.3 1.3l2.7-2.7A7.7 7.7 0 1 0 23 12.7Zm-2.5 11.6a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z"
    />
  </svg>
);

const SalesforceLogo = () => (
  <svg width="20" height="20" viewBox="0 0 32 32" aria-hidden="true">
    <path
      fill="#00A1E0"
      d="M13.3 8.6a5 5 0 0 1 8.5 1 6 6 0 0 1 8 5.7 6 6 0 0 1-6 6 5.9 5.9 0 0 1-1.2-.1 4.4 4.4 0 0 1-3.8 2.3 4.3 4.3 0 0 1-1.9-.4 5 5 0 0 1-9.3-1.5 4.6 4.6 0 0 1-1-.1 4.7 4.7 0 0 1 .8-9.3 5 5 0 0 1 7.1-3.5Z"
    />
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

const LOGOS: Record<ProviderId, () => JSX.Element> = {
  hubspot: HubspotLogo,
  salesforce: SalesforceLogo,
  dynamics: MicrosoftLogo,
};

/**
 * Beheer-kaart voor de CRM-koppeling van de eigen tenant (company-admin).
 * Eén CRM per bedrijf; de gebruiker kiest zijn provider (HubSpot, Salesforce
 * of Dynamics) — precies zoals bij de agenda-koppeling. Nog niet ingestelde
 * providers tonen "nog niet beschikbaar". De koppeling voedt de automatische
 * gespreksvoorbereiding met CRM-context (dealfase, contactpersoon, notities).
 */
const CrmConnectionComponent = () => {
  const { t } = useTranslation("common");
  const [status, setStatus] = useState<CrmStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState<ProviderId | "disconnect" | null>(null);

  const loadStatus = async () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const res = await fetch("/api/crm/status", { headers });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setStatus(await res.json());
    } catch {
      toast.error(t("crm.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
    // Terugkomst uit de OAuth-flow: toon resultaat en maak de URL schoon.
    const params = new URLSearchParams(window.location.search);
    const result = params.get("crm");
    if (result === "connected") {
      toast.success(t("crm.connected"));
    } else if (result === "error") {
      toast.error(t("crm.connectFailed"));
    }
    if (result) {
      params.delete("crm");
      const query = params.toString();
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}${query ? `?${query}` : ""}`
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnect = async (provider: ProviderId) => {
    const headers = getAuthHeaders();
    if (!headers) return;

    // Dynamics heeft de org-URL van de klant nodig (tegelijk API-basis én
    // OAuth-scope), dus die vragen we vóór de redirect.
    let query = `provider=${provider}`;
    if (provider === "dynamics") {
      const orgUrl = window.prompt(t("crm.dynamicsOrgPrompt"));
      if (!orgUrl) return;
      query += `&instance_url=${encodeURIComponent(orgUrl.trim())}`;
    }

    setBusy(provider);
    try {
      const res = await fetch(`/api/crm/connect?${query}`, { headers });
      if (res.status === 501) {
        toast.info(t("crm.notConfigured"));
        setBusy(null);
        return;
      }
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      window.location.href = data.url;
    } catch {
      toast.error(t("crm.connectFailed"));
      setBusy(null);
    }
  };

  const handleDisconnect = async () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    if (!window.confirm(t("crm.disconnectConfirm"))) return;
    setBusy("disconnect");
    try {
      const res = await fetch("/api/crm/disconnect", {
        method: "POST",
        headers,
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      toast.success(t("crm.disconnected"));
      await loadStatus();
    } catch {
      toast.error(t("crm.disconnectFailed"));
    } finally {
      setBusy(null);
    }
  };

  const providers = status?.providers ?? [];
  const connectedLabel =
    providers.find((p) => p.id === status?.provider)?.label ??
    status?.provider ??
    "";
  const anyBusy = busy !== null;

  return (
    <div className="tw-max-w-2xl">
      <ToastContainer />
      <h2 className="tw-text-xl tw-font-semibold tw-mb-2">{t("crm.title")}</h2>
      <p className="tw-text-sm tw-text-gray-600 tw-mb-6">
        {t("crm.description")}
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
                    ? t("crm.statusActive")
                    : t("crm.statusBroken")}{" "}
                  — {connectedLabel}
                </span>
              </div>
              {status.externalAccountId && (
                <p className="tw-text-sm tw-text-gray-600 tw-mb-4">
                  {t("crm.account")}: {status.externalAccountId}
                </p>
              )}
              {status.status !== "active" && (
                <p className="tw-text-sm tw-text-red-600 tw-mb-4">
                  {t("crm.brokenHint")}
                </p>
              )}
              <div className="tw-flex tw-gap-3">
                {status.status !== "active" && status.provider && (
                  <button
                    type="button"
                    onClick={() => handleConnect(status.provider as ProviderId)}
                    disabled={anyBusy}
                    className="tw-bg-button tw-text-white tw-py-2 tw-px-5 tw-rounded-lg tw-text-sm disabled:tw-opacity-50"
                  >
                    {t("crm.reconnect")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={anyBusy}
                  className="tw-bg-white tw-text-red-600 tw-border tw-border-red-300 tw-py-2 tw-px-5 tw-rounded-lg tw-text-sm hover:tw-bg-red-50 disabled:tw-opacity-50"
                >
                  {t("crm.disconnect")}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="tw-text-sm tw-text-gray-600 tw-mb-4">
                {t("crm.notConnected")}
              </p>
              {/* Eén knop per CRM; nog niet geconfigureerde providers zijn
                  zichtbaar maar uitgeschakeld met "nog niet beschikbaar". */}
              <div className="tw-flex tw-flex-wrap tw-gap-3">
                {providers.map((p) => {
                  const Logo = LOGOS[p.id];
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleConnect(p.id)}
                      disabled={anyBusy || !p.configured}
                      title={!p.configured ? t("crm.notConfigured") : undefined}
                      className="tw-flex tw-flex-1 tw-min-w-[210px] tw-items-center tw-justify-center tw-gap-2.5 tw-bg-white tw-text-[#344054] tw-font-medium tw-border tw-border-[#D0D5DD] tw-py-2.5 tw-px-5 tw-rounded-lg tw-text-sm hover:tw-bg-[#F9FAFB] hover:tw-border-[#98A2B3] tw-transition disabled:tw-opacity-50 disabled:tw-cursor-not-allowed"
                    >
                      <Logo />
                      {busy === p.id
                        ? t("crm.connecting")
                        : p.configured
                        ? t("crm.connect", { provider: p.label })
                        : `${p.label} — ${t("crm.notAvailable")}`}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default CrmConnectionComponent;
