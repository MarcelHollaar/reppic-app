/* eslint-disable @next/next/no-img-element */
import React from "react";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUserRole } from "@/hooks/useUserRole";
import { useRoutes } from "@/routes";
import MenuItem from "./MenuItem";

import {
  ChevronDownIcon,
  XMarkIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";

import { useOnClickOutside } from "usehooks-ts";
import { useMaterialTailwindController, setOpenSidenav } from "@/context";
import { useTranslation } from "react-i18next";

type PropTypes = {
  brandImg?: string;
  brandName?: string;
  routes?: {}[];
};

export default function Sidenav({}: PropTypes) {
  const userRole = useUserRole();
  const routes = useRoutes(userRole);
  const pathname = usePathname();
  const router = useRouter();
  const [controller, dispatch] = useMaterialTailwindController();

  const { openSidenav }: any = controller;

  const [openCollapse, setOpenCollapse] = React.useState(null);
  const [openSubCollapse, setOpenSubCollapse] = React.useState(null);
  const { t } = useTranslation('common');


  const handleOpenCollapse = (value: any) => {
    setOpenCollapse((cur) => (cur === value ? null : value));
  };

  const handleOpenSubCollapse = (value: any) => {
    setOpenSubCollapse((cur) => (cur === value ? null : value));
  };

  const sidenavRef = React.useRef(null);

  const handleClickOutside = () => {
    setOpenSidenav(dispatch, false);
  };

  useOnClickOutside(sidenavRef, handleClickOutside);

  const collapseItemClasses = "tw-text-gray-600 hover:tw-bg-[#F5F6F8] hover:tw-text-gray-900 tw-rounded-xl tw-transition-colors";
  const collapseHeaderClasses = "tw-border-b-0 !tw-p-3 tw-rounded-xl hover:tw-bg-[#F5F6F8] tw-text-inherit hover:tw-text-gray-900";
  const activeRouteClasses = "tw-bg-[#5971F6] !tw-text-white hover:tw-bg-[#4A60E8] tw-rounded-xl";
  const handleLogout = async () => {
    // LMS is nu native onderdeel van de app: geen aparte LMS-sessie meer
    // om te invalideren bij uitloggen.
    localStorage.removeItem("user_data");
    localStorage.removeItem("token");

    router.push("/auth/signin/basic");
  };

  return (
    <div
      ref={sidenavRef}
      className={`!tw-fixed tw-top-0 !tw-z-50 tw-h-[calc(100vh)] tw-w-full tw-max-w-[18rem] tw-flex tw-flex-col tw-bg-white tw-border-r tw-border-gray-100 ${
        openSidenav ? "tw-left-0" : "-tw-left-72"
      } tw-transition-all tw-duration-300 tw-ease-in-out xl:tw-left-0 tw-overflow-y-auto`}
      style={{ boxShadow: "2px 0 12px rgba(0,0,0,0.04)" }}
    >
      <Link
        href="/dashboard"
        className="tw-mb-2 tw-flex tw-items-center tw-gap-1 !tw-p-4"
      >
        <div className="tw-flex tw-items-center tw-justify-center tw-rounded-3xl tw-p-2 tw-h-[8rem] tw-w-full">
          <img
            src="/img/reppic_transparant.svg"
            className="tw-h-auto tw-w-64 tw-transform tw-scale-110"
            alt={process.env.NEXT_PUBLIC_APP_NAME || "Reppic"}
          />
        </div>
      </Link>
      <button
        className="!tw-absolute tw-top-3 tw-right-3 tw-block xl:tw-hidden tw-p-1.5 tw-rounded-lg tw-text-gray-400 hover:tw-text-gray-700 hover:tw-bg-gray-100 tw-transition-colors"
        onClick={() => setOpenSidenav(dispatch, false)}
      >
        <XMarkIcon className="tw-w-5 tw-h-5" />
      </button>
      <div className="tw-flex-1 tw-px-3 tw-pb-4">
        {routes.map(
          (
            { name, icon, iconBlack, pages, title, divider, external, path }: any,
            key
          ) =>
            pages ? (
              <React.Fragment key={key}>
                {title && (
                  <p className="tw-ml-3 tw-mt-5 tw-mb-1 tw-text-[10px] tw-font-semibold tw-text-gray-400 tw-uppercase tw-tracking-widest">
                    {title}
                  </p>
                )}
                {/* Accordion group */}
                <div>
                  <button
                    onClick={() => handleOpenCollapse(name)}
                    className={`tw-w-full tw-flex tw-items-center tw-gap-3 tw-px-3 tw-py-2.5 tw-rounded-xl tw-text-sm tw-transition-colors tw-text-left ${
                      openCollapse === name
                        ? "tw-bg-[#F5F6F8] tw-text-gray-900 tw-font-medium"
                        : "tw-text-gray-600 hover:tw-bg-[#F5F6F8] hover:tw-text-gray-900"
                    }`}
                  >
                    <span className="tw-flex-shrink-0">{pathname === path ? icon : iconBlack}</span>
                    <span className="tw-mr-auto tw-capitalize" suppressHydrationWarning>{name}</span>
                    <ChevronDownIcon
                      strokeWidth={2.5}
                      className={`tw-h-3 tw-w-3 tw-text-gray-400 tw-transition-transform tw-flex-shrink-0 ${
                        openCollapse === name ? "tw-rotate-180" : ""
                      }`}
                    />
                  </button>
                  {openCollapse === name && (
                    <div className="tw-pl-3 tw-pt-0.5 tw-pb-1">
                      {pages.map((page: any, key: number) =>
                        page.pages ? (
                          /* Sub-accordion */
                          <div key={key}>
                            <button
                              onClick={() => handleOpenSubCollapse(page.name)}
                              className={`tw-w-full tw-flex tw-items-center tw-gap-3 tw-px-3 tw-py-2.5 tw-rounded-xl tw-text-sm tw-transition-colors tw-text-left ${
                                openSubCollapse === page.name
                                  ? "tw-bg-[#F5F6F8] tw-text-gray-900 tw-font-medium"
                                  : "tw-text-gray-600 hover:tw-bg-[#F5F6F8] hover:tw-text-gray-900"
                              }`}
                            >
                              <span className="tw-flex-shrink-0">{page.icon}</span>
                              <span className="tw-mr-auto tw-capitalize" suppressHydrationWarning>{page.name}</span>
                              <ChevronDownIcon
                                strokeWidth={2.5}
                                className={`tw-h-3 tw-w-3 tw-text-gray-400 tw-transition-transform tw-flex-shrink-0 ${
                                  openSubCollapse === page.name ? "tw-rotate-180" : ""
                                }`}
                              />
                            </button>
                            {openSubCollapse === page.name && (
                              <div className="tw-pl-3 tw-pt-0.5 tw-pb-1">
                                {page.pages.map((subPage: any, k: number) =>
                                  subPage.external ? (
                                    <a href={subPage.path} target="_blank" rel="noopener noreferrer" key={k}>
                                      <div className="tw-flex tw-items-center tw-gap-3 tw-px-3 tw-py-2.5 tw-rounded-xl tw-text-sm tw-text-gray-600 hover:tw-bg-[#F5F6F8] hover:tw-text-gray-900 tw-transition-colors tw-capitalize">
                                        <span className="tw-flex-shrink-0">{subPage.icon}</span>
                                        <span suppressHydrationWarning>{subPage.name}</span>
                                      </div>
                                    </a>
                                  ) : (
                                    <Link href={subPage.path} key={k}>
                                      <div className={`tw-flex tw-items-center tw-gap-3 tw-px-3 tw-py-2.5 tw-rounded-xl tw-text-sm tw-transition-colors tw-capitalize ${
                                        pathname === subPage.path ? activeRouteClasses : collapseItemClasses
                                      }`}>
                                        <span className="tw-flex-shrink-0">{subPage.icon}</span>
                                        <span suppressHydrationWarning>{subPage.name}</span>
                                      </div>
                                    </Link>
                                  )
                                )}
                              </div>
                            )}
                          </div>
                        ) : page.external ? (
                          <a key={key} href={page.path} target="_blank" rel="noopener noreferrer">
                            <div className="tw-flex tw-items-center tw-gap-3 tw-px-3 tw-py-2.5 tw-rounded-xl tw-text-sm tw-text-gray-600 hover:tw-bg-[#F5F6F8] hover:tw-text-gray-900 tw-transition-colors tw-capitalize">
                              <span className="tw-flex-shrink-0">{page.icon}</span>
                              <span suppressHydrationWarning>{page.name}</span>
                            </div>
                          </a>
                        ) : (
                          <Link href={page.path} key={key}>
                            <div className={`tw-flex tw-items-center tw-gap-3 tw-px-3 tw-py-2.5 tw-rounded-xl tw-text-sm tw-transition-colors tw-capitalize ${
                              pathname === page.path ? activeRouteClasses : collapseItemClasses
                            }`}>
                              <span className="tw-flex-shrink-0">{page.icon}</span>
                              <span className="tw-mr-auto" suppressHydrationWarning>{page.name}</span>
                              <ArrowRightIcon className="tw-h-3.5 tw-w-3.5 tw-opacity-40 tw-flex-shrink-0" />
                            </div>
                          </Link>
                        )
                      )}
                    </div>
                  )}
                </div>
                {divider && <hr className="tw-my-2 tw-border-gray-100" />}
              </React.Fragment>
            ) : (
              <div key={key}>
                {external ? (
                  <a href={path} target="_blank" rel="noopener noreferrer" suppressHydrationWarning>
                    <div className={`tw-flex tw-items-center tw-gap-3 tw-px-3 tw-py-2.5 tw-rounded-xl tw-text-sm tw-transition-colors tw-capitalize ${collapseItemClasses}`}>
                      <span className="tw-flex-shrink-0">{iconBlack}</span>
                      <span suppressHydrationWarning>{name}</span>
                    </div>
                  </a>
                ) : (
                  <MenuItem
                    path={path}
                    icon={icon}
                    iconBlack={iconBlack}
                    name={name}
                    key={key}
                    activeRouteClasses={activeRouteClasses}
                    collapseItemClasses={collapseItemClasses}
                  />
                )}
              </div>
            )
        )}
        <button
          className="tw-w-full tw-flex tw-items-center tw-gap-3 tw-px-3 tw-py-2.5 tw-rounded-xl tw-text-sm tw-text-gray-500 hover:tw-bg-[#F5F6F8] hover:tw-text-gray-800 tw-transition-colors tw-cursor-pointer tw-mt-1"
          onClick={handleLogout}
        >
          <img src="/img/logout2_dark.svg" alt="Logout" className="tw-w-5 tw-h-5 tw-flex-shrink-0" />
          <span suppressHydrationWarning>{t("common.logOut")}</span>
        </button>
      </div>
    </div>
  );
}
