"use client";
/**
 * Bedrijfskiezer voor superadmin (LMS-integratie, superadmin-uitbreiding).
 * Rendert alleen voor superadmin; kiest het bedrijf waarvoor leerbeheer of
 * de kennisbibliotheek wordt getoond. Voor andere rollen rendert dit niets
 * (zij werken altijd binnen hun eigen bedrijf).
 */
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import { useUserRole } from "@/hooks/useUserRole";
import { USER_ROLE } from "@/configs/constants";

type Company = { id: string; title: string };

interface CompanyPickerProps {
  value: string | null;
  onChange: (companyId: string | null) => void;
}

const CompanyPicker: React.FC<CompanyPickerProps> = ({ value, onChange }) => {
  const { t } = useTranslation("common");
  const userRole = useUserRole();
  const [companies, setCompanies] = useState<Company[]>([]);

  const isSuperAdmin = userRole === USER_ROLE.SUPER_ADMIN;

  useEffect(() => {
    if (!isSuperAdmin) return;
    const headers = getAuthHeaders();
    if (!headers) return;
    fetch("/api/companies?per_page=200", { headers })
      .then((r) => r.json())
      .then((data) => {
        const list: Company[] =
          data?.data?.records || data?.records || data || [];
        setCompanies(list);
        // Automatisch het eerste bedrijf kiezen zodat het scherm direct vult.
        if (!value && list.length > 0) {
          onChange(String(list[0].id));
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin]);

  if (!isSuperAdmin) return null;

  return (
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="tw-border tw-border-gray-300 tw-rounded-xl tw-px-3 tw-py-2 tw-text-sm tw-bg-white tw-font-semibold tw-text-gray-800"
      title={t("common.company")}
    >
      {companies.length === 0 && <option value="">—</option>}
      {companies.map((c) => (
        <option key={c.id} value={c.id}>
          {c.title}
        </option>
      ))}
    </select>
  );
};

export default CompanyPicker;
