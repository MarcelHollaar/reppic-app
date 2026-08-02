/**
 * Haalt de operationele + strategische dashboard-data voor één bedrijf en één
 * periode op bij de dashboard-backend. Authenticatie exact zoals
 * DashboardSyncService: een kortlevende JWT met { id, email, role, company_id }
 * getekend met de gedeelde JWT_SECRET, zodat de backend `getCompanyFilter` de
 * data op dat bedrijf scoopt.
 */

import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
const DASHBOARD_API_URL =
  process.env.DASHBOARD_API_URL ||
  process.env.NEXT_PUBLIC_DASHBOARD_API_URL ||
  "http://localhost:5001";

export type CompanyDashboards = { operational: any; strategic: any };

function companyToken(companyId: string): string {
  if (!JWT_SECRET) throw new Error("JWT_SECRET niet geconfigureerd");
  // rol "manager" → de backend scoopt op het bedrijf (niet superadmin = alles).
  return jwt.sign(
    {
      id: `monthly-report:${companyId}`,
      email: "monthly-report@reppic.internal",
      role: "manager",
      company_id: companyId,
    },
    JWT_SECRET,
    { expiresIn: "5m" },
  );
}

async function getJson(pathAndQuery: string, token: string): Promise<any> {
  const res = await fetch(`${DASHBOARD_API_URL}${pathAndQuery}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Dashboard-backend ${pathAndQuery} → ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * @param month 1-gebaseerd (1 = januari)
 */
export async function fetchCompanyDashboards(
  companyId: string,
  lang: string,
  year: number,
  month: number,
): Promise<CompanyDashboards> {
  const token = companyToken(companyId);
  const q = `lang=${encodeURIComponent(lang)}&year=${year}&month=${month}`;
  const [operational, strategic] = await Promise.all([
    getJson(`/api/analytics/operational?${q}`, token),
    getJson(`/api/analytics/summary?${q}`, token),
  ]);
  return { operational, strategic };
}
