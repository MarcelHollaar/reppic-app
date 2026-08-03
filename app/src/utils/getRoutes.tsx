import React from "react";
import { USER_ROLE } from "@/configs/constants";
import type { TFunction } from "i18next";

export interface RoutePage {
  name: string;
  path: string;
  icon: JSX.Element | null;
  external: boolean;
}

export interface Route {
  name: string;
  icon: JSX.Element;
  iconBlack: JSX.Element;
  path: string;
  external: boolean;
  pages?: RoutePage[];
}

interface BuildRoutesArgs {
  t: TFunction<"common">;
  userRole: string | null;
  user?: any | null;
}

export const buildRoutes = ({
  t,
  userRole,
  user,
}: BuildRoutesArgs): Route[] => {
  const isContactPerson = user?.is_company_contact_manager;
  const companyId = user?.company_id;

  const routes: Route[] = [
    {
      name: t("common.dashboard"),
      icon: (
        <img
          src="/img/dashboard_icon.svg"
          alt="Dashboard"
          className="w-5 h-5"
        />
      ),
      iconBlack: (
        <img
          src="/img/dashboard_icon_dark.svg"
          alt="Dashboard"
          className="w-5 h-5"
        />
      ),
      path: "/dashboard",
      external: false,
    },
  ];

  if (isContactPerson && companyId) {
    routes.splice(1, 0, {
      name: t("common.company"),
      icon: (
        <img src="/img/company_white.svg" className="w-5 h-5" alt="company" />
      ),
      iconBlack: (
        <img src="/img/company_black.svg" className="w-5 h-5" alt="company" />
      ),
      external: false,
      path: `/companies/${companyId}/edit`,
    });
  }

  if (userRole === USER_ROLE.SUPER_ADMIN) {
    routes.push({
      name: t("common.company"),
      icon: (
        <img src="/img/company_black.svg" className="w-5 h-5" alt="company" />
      ), // default icon
      iconBlack: (
        <img src="/img/company_black.svg" className="w-5 h-5" alt="company" />
      ),
      external: false,
      path: "#",
      pages: [
        {
          name: t("common.companiesList"),
          path: "/companies",
          icon: null,
          external: false,
        },
        {
          name: t("common.addCompany"),
          path: "/companies/new",
          icon: null,
          external: false,
        },
      ],
    });
  }

  routes.push({
    name: t("common.conversations"),
    icon: <img src="/img/chat.svg" alt="Conversations" className="w-5 h-5" />,
    iconBlack: (
      <img src="/img/chat_dark.svg" alt="Conversations" className="w-5 h-5" />
    ),
    path: "/conversations",
    external: false,
  });

  routes.push({
    name: "Sales Coach",
    icon: (
      <img
        src="/img/sales-trainer-white.svg"
        alt="SalesCoach"
        className="w-5 h-5"
      />
    ),
    iconBlack: (
      <img
        src="/img/sales-trainer-black.svg"
        alt="SalesCoach"
        className="w-5 h-5"
      />
    ),
    path: "/salescoach",
    external: false,
  });

  // LMS-integratie: leren is nu native (/learning), geen externe LMS-link meer.
  // Zichtbaar voor iedereen met een leer-rol (leer-as, los van de sales-rol);
  // superadmin krijgt de beheer-subpagina's.
  const learningRole = user?.learning_role;
  const hasLearningAccess =
    userRole === USER_ROLE.SUPER_ADMIN ||
    (learningRole && learningRole !== "none");

  if (hasLearningAccess) {
    routes.push({
      name: t("common.developments"),
      icon: (
        <img src="/img/ballot.svg" alt="Developments" className="w-5 h-5" />
      ),
      iconBlack: (
        <img
          src="/img/ballot_dark.svg"
          alt="Developments"
          className="w-5 h-5"
        />
      ),
      path: userRole === USER_ROLE.SUPER_ADMIN ? "#" : "/learning",
      external: false,
      ...(userRole === USER_ROLE.SUPER_ADMIN && {
        pages: [
          {
            name: t("learning.title"),
            path: "/learning",
            icon: null,
            external: false,
          },
          {
            name: t("learning.manageModules"),
            path: "/learning/manage",
            icon: null,
            external: false,
          },
          {
            name: t("learning.adminNav"),
            path: "/learning/admin",
            icon: null,
            external: false,
          },
          {
            name: t("learning.paths"),
            path: "/learning/manage/paths",
            icon: null,
            external: false,
          },
          {
            name: t("learning.jobRoles"),
            path: "/learning/manage/job-roles",
            icon: null,
            external: false,
          },
          {
            name: t("learning.categories"),
            path: "/learning/manage/categories",
            icon: null,
            external: false,
          },
          {
            name: t("learning.library"),
            path: "/learning/library",
            icon: null,
            external: false,
          },
          {
            name: t("common.library"),
            path: "/developments/library",
            icon: null,
            external: false,
          },
          {
            name: t("common.addVideo"),
            path: "/developments/videos/add",
            icon: null,
            external: false,
          },
          {
            name: t("developments.categories"),
            path: "/developments/categories",
            icon: null,
            external: false,
          },
          {
            name: t("common.tags"),
            path: "/developments/tags",
            icon: null,
            external: false,
          },
          {
            name: "Prompts",
            path: "/developments/prompts",
            icon: null,
            external: false,
          },
          {
            name: t("terminology.navTitle"),
            path: "/developments/terminology",
            icon: null,
            external: false,
          },
        ],
      }),
    });
  }

  // Leerbeheer voor bedrijfs-leerbeheerders (learning_admin): eigen medewerkers,
  // toewijzingen en voortgang. Superadmin beheert via de Ontwikkelingen-subpagina's.
  if (learningRole === "learning_admin" && userRole !== USER_ROLE.SUPER_ADMIN) {
    routes.push({
      name: t("learning.adminNav"),
      icon: (
        <img src="/img/ballot.svg" alt="Learning admin" className="w-5 h-5" />
      ),
      iconBlack: (
        <img
          src="/img/ballot_dark.svg"
          alt="Learning admin"
          className="w-5 h-5"
        />
      ),
      path: "/learning/admin",
      external: false,
    });
  }

  routes.push({
    name: t("common.settings"),
    icon: <img src="/img/setting.svg" alt="Settings" className="w-5 h-5" />,
    iconBlack: (
      <img src="/img/setting_dark.svg" alt="Settings" className="w-5 h-5" />
    ),
    path: "/settings",
    external: false,
  });

  if (userRole === USER_ROLE.MANAGER || userRole === USER_ROLE.SUPER_ADMIN) {
    routes.splice(3, 0, {
      name: t("common.myTeam"),
      icon: (
        <img src="/img/teams_light.svg" alt="My Team" className="w-5 h-5" />
      ),
      iconBlack: <img src="/img/teams.svg" alt="My Team" className="w-5 h-5" />,
      path: "/my-team",
      external: false,
    });

    routes.push({
      name: t("dashboards.strategic"),
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      iconBlack: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      path: "/dashboards/strategic",
      external: false,
    });

    routes.push({
      name: t("dashboards.operational"),
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      ),
      iconBlack: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      ),
      path: "/dashboards/operational",
      external: false,
    });
  }

  return routes;
};
