"use client";
/**
 * Eén bron van waarheid voor de gebruikerstaal (architect-bevinding B4).
 *
 * De server-kant (gespreksanalyse, dashboard-snapshots, maandrapport) gebruikt
 * `user.lang_code`; de UI-taal kwam uit cookie/browser (LanguageDetector).
 * Die twee liepen uiteen: een Duitse gebruiker met een Engelse browser kreeg
 * lege dashboards, omdat snapshots per taal worden opgeslagen en opgevraagd.
 *
 * Dit component staat in de root-layout en trekt de UI-taal bij het laden
 * gelijk aan de PROFIELTAAL VAN DE SERVER (zelfde endpoint als de
 * LanguageSwitcher gebruikt) — dus op élke pagina, niet alleen waar de
 * switcher toevallig gemount is. Een bewuste taalwissel via de switcher blijft
 * gewoon werken: die werkt het profiel server-side bij, waarna deze sync
 * dezelfde waarde ziet.
 */
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

export default function LanguageSync() {
  const { i18n } = useTranslation();

  useEffect(() => {
    const token = typeof window !== "undefined" && localStorage.getItem("token");
    if (!token) return; // niet ingelogd → browser/cookie-taal is prima

    fetch("/api/user/settings?type=GET_USER_LANG_PREFERENCES", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((result) => {
        const code = String(result?.data?.lang_code || "")
          .toLowerCase()
          .slice(0, 2);
        if (code && i18n.language?.slice(0, 2) !== code) {
          return i18n.changeLanguage(code).then(() => {
            document.cookie = `NEXT_LOCALE=${code}; path=/; SameSite=Strict`;
          });
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
