import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useBreadcrumb } from "@/context/BreadcrumbContext";
// @heroicons/react
import {
  Bars3Icon,
  HomeIcon,
  Bars3CenterLeftIcon,
} from "@heroicons/react/24/solid";

// @context
import {
  useMaterialTailwindController,
  setOpenSidenav,
} from "@/context";

import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useTranslation } from "react-i18next";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import supportedLocalesJson from '../../../supported-locales.json';

export function DashboardNavbar() {
  const { breadcrumbs, setBreadcrumbs } = useBreadcrumb();
  const [controller, dispatch] = useMaterialTailwindController();
  const { fixedNavbar, openSidenav } = controller;
  const pathname = usePathname();
  const [layout, page] = pathname.split("/").filter((el) => el !== "");
  const { t } = useTranslation('common')
  const { i18n } = useTranslation();
  const headers = getAuthHeaders();
  // Fallback breadcrumbs if none are set
  const fallbackBreadcrumbs = [
    { label: layout, href: `/${layout}` },
    { label: page?.split("-").join(" ") ?? "" },
  ];
  const activeBreadcrumbs = breadcrumbs.length > 0 ? breadcrumbs : fallbackBreadcrumbs;

  // Reset breadcrumbs on path change
  useEffect(() => {
    setBreadcrumbs([]); // Clear breadcrumbs so fallback gets used
  }, [pathname]);

  
  useEffect(() => {
    (async () => {
      try {
        const localePattern = new RegExp(`^/(${supportedLocalesJson.join('|')})(?=/|$)`, 'i');
        const pathname = window.location.pathname;
        if (localePattern.test(pathname)) {
          const token = localStorage.getItem("token") || null;
          // Remove NEXT_LOCALE cookie
          document.cookie = "NEXT_LOCALE=; path=/; max-age=0; SameSite=Strict";
          let newPathname = pathname.replace(localePattern, '');
          if (!newPathname.startsWith('/')) newPathname = '/' + newPathname;
          newPathname = newPathname.replace(/\/{2,}/g, '/');

          if (token) {
            window.location.replace("/dashboard");
          } else {
            window.location.replace('/auth/signin/basic');
          }
        }

        const response = await fetch("/api/user/settings?type=GET_USER_LANG_PREFERENCES", {
          method: "GET",
          headers,
        });
        const result = await response.json();
        if (!response.ok) {
          return;
        }
        const { lang_code } = result.data;
        if (lang_code) {
          i18n.changeLanguage(lang_code)
            .then(() => {
              // Set NEXT_LOCALE cookie client-side
              document.cookie = `NEXT_LOCALE=${lang_code}; path=/; SameSite=Strict`;
            })
            .catch((error) => {
              console.error(`[LanguageSwitcher] Error setting initial language:`, error);
            });
        }
      } catch (error) {
        console.error(error);
      }
    })();
  }, []);

  return (
    <div className={`!tw-transition-all !tw-max-w-full sm:tw-mt-0 tw-mt-16 ${fixedNavbar ? "!tw-sticky tw-top-0 tw-z-40" : ""}`}>
      {/* Mobile header */}
      <div className="tw-fixed tw-top-0 tw-left-0 tw-right-0 tw-z-10 tw-flex tw-items-center tw-justify-between tw-w-full tw-px-4 tw-py-3 tw-bg-white tw-border-b tw-border-gray-100 sm:tw-hidden"
        style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}>
        <Link href="/dashboard">
          <img src="/img/reppic_mobile.png" alt="Logo" className="tw-h-10 tw-w-auto" />
        </Link>
        <button
          className="tw-p-2 tw-rounded-xl tw-text-gray-500 hover:tw-bg-[#F5F6F8] tw-transition-colors"
          onClick={() => setOpenSidenav(dispatch, !openSidenav)}
        >
          {openSidenav
            ? <Bars3Icon strokeWidth={2} className="tw-h-5 tw-w-5 tw-text-[#5971F6]" />
            : <Bars3CenterLeftIcon strokeWidth={2} className="tw-h-5 tw-w-5 tw-text-[#5971F6]" />
          }
        </button>
      </div>

      {/* Desktop topbar */}
      <div className="tw-hidden sm:tw-flex tw-justify-between tw-items-center tw-w-full tw-bg-[#F5F6F8] tw-py-3 tw-px-1">
        {/* Breadcrumbs */}
        <nav className="tw-flex tw-items-center tw-gap-1.5 tw-capitalize">
          <Link href="/dashboard" className="tw-p-1.5 tw-rounded-lg hover:tw-bg-white tw-text-gray-400 hover:tw-text-gray-700 tw-transition-colors">
            <HomeIcon className="tw-h-4 tw-w-4" />
          </Link>
          {activeBreadcrumbs
            .filter(crumb => crumb.label && crumb.label.trim() !== "")
            .map((crumb, idx, arr) => {
              const cleanLabel = crumb.label.replace(/\/$/, "");
              const translationKey = `breadCrumbs.${cleanLabel.toLowerCase()}`;
              const translated = cleanLabel && t(translationKey) !== translationKey ? t(translationKey) : cleanLabel;
              const isLast = idx === arr.length - 1;
              return (
                <React.Fragment key={idx}>
                  <span className="tw-text-gray-300 tw-text-xs">/</span>
                  {isLast ? (
                    <span className="tw-text-sm tw-font-medium tw-text-gray-700">{translated}</span>
                  ) : crumb.href ? (
                    <Link href={crumb.href} className="tw-text-sm tw-text-gray-400 hover:tw-text-gray-700 tw-transition-colors">{translated}</Link>
                  ) : (
                    <span className="tw-text-sm tw-text-gray-400">{translated}</span>
                  )}
                </React.Fragment>
              );
            })}
        </nav>

        <button
          className="tw-p-2 tw-rounded-xl tw-text-gray-400 hover:tw-bg-white hover:tw-text-gray-700 tw-transition-colors xl:tw-hidden"
          onClick={() => setOpenSidenav(dispatch, !openSidenav)}
        >
          {openSidenav
            ? <Bars3Icon strokeWidth={2} className="tw-h-5 tw-w-5" />
            : <Bars3CenterLeftIcon strokeWidth={2} className="tw-h-5 tw-w-5" />
          }
        </button>
      </div>
    </div>
  );
}

export default DashboardNavbar;