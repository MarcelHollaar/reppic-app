import { USER_ROLE } from "@/configs/constants";
import i18next, { i18n as I18nInstance } from "i18next";
import Backend from "i18next-fs-backend";
import path from "path";

export function isSuperAdminUser(user: any) {
  return user?.role?.name === USER_ROLE.SUPER_ADMIN;
}

export function isContactManager(user: any) {
  return user?.company?.email === user?.email;
}

/**
 * Company-scope authorization guard. A superadmin may act on any company; every
 * other role (manager / contact-manager / user) may only act within their OWN
 * company. Use this on any handler that takes a companyId from the request to
 * prevent cross-tenant read/write (IDOR).
 */
export function canActOnCompany(caller: any, companyId: string | null | undefined): boolean {
  if (isSuperAdminUser(caller)) return true;
  return Boolean(companyId) && caller?.company_id === companyId;
}

/**
 * Whether `caller` is allowed to manage (edit/delete/read-profile of) the given
 * target user. Superadmin → anyone; manager/contact-manager → only users in
 * their own company and never a superadmin target; a normal user → only itself.
 */
export function canManageTargetUser(
  caller: any,
  target: { id?: string; company_id?: string | null; role?: { name?: string } | null },
): boolean {
  if (isSuperAdminUser(caller)) return true;
  if (caller?.id && caller.id === target?.id) return true;
  const callerIsManager =
    caller?.role?.name === USER_ROLE.MANAGER || isContactManager(caller);
  if (!callerIsManager) return false;
  if (target?.role?.name === USER_ROLE.SUPER_ADMIN) return false;
  return Boolean(caller?.company_id) && caller.company_id === target?.company_id;
}

export const initializeI18n = async (): Promise<I18nInstance> => {
  const instance = i18next.createInstance();
  await instance
    .use(Backend)
    .init({
      lng: "en",
      fallbackLng: "en",
      backend: {
        loadPath: path.join(process.cwd(), "public/locales/{{lng}}/common.json"),
      },
      ns: ["common"],
      defaultNS: "common",
      interpolation: { escapeValue: false },
      initImmediate: false,
    });
  return instance;
};