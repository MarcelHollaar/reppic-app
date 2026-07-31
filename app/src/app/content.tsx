"use client";

import { useRoutes } from "@/routes";
import React from "react";

import { DashboardNavbar, Footer } from "@/widgets/layout";

import Sidenav from "@/widgets/layout/sidenav";
import { usePathname } from "next/navigation";

import { BreadcrumbProvider } from "@/context/BreadcrumbContext";
import { useUserRole } from "@/hooks/useUserRole";
import { PAGE_BG } from "@/theme/uiTokens";

export default function InnerContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const userRole = useUserRole();
  const routes = useRoutes(userRole);
  const pathname = usePathname();

  const isAuthPages = pathname.startsWith("/auth");
  const isSimpleLayout = isAuthPages;

  return (
    <div
      className="!tw-min-h-screen tw-flex tw-flex-col"
      style={{ backgroundColor: PAGE_BG }}
    >
      {!isSimpleLayout && <Sidenav routes={routes} />}
      <div
        className={`${
          isSimpleLayout ? "m-0" : "tw-px-4 md:tw-px-8 xl:tw-pl-80"
        } tw-flex tw-flex-col tw-flex-grow`}
      >
        <BreadcrumbProvider>
          {!isSimpleLayout && <DashboardNavbar />}
          <div className="tw-flex-grow">{children}</div>
        </BreadcrumbProvider>
        {!isSimpleLayout && (
          <div className="tw-text-blue-gray-600">
            <Footer />
          </div>
        )}
      </div>
    </div>
  );
}
