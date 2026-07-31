"use client";
import AdminsListing from "@/components/settings/AdminsListing";
import AnalysisModelComponent from "@/components/settings/AnalysisModelComponent";
import DashboardModelComponent from "@/components/settings/DashboardModelComponent";
import TranscriptAnalysisPromptComponent from "@/components/settings/TranscriptAnalysisPromptComponent";
import LanguageSettings from "@/components/settings/LanguageComponent";
import NotificationSettings from "@/components/settings/NotificationComponent";
import PasswordUpdateForm from "@/components/settings/PasswordResetComponent";
import ProfileForm from "@/components/settings/ProfileComponent";
import TeamMembersListing from "@/components/settings/TeamMembersListing";
import { USER_ROLE } from "@/configs/constants";
import { useUserRole } from "@/hooks/useUserRole";
import authMiddleware from "@/middleware/authMiddleware";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

function SettingsPage() {
  const [activeTab, setActiveTab] = useState("account");
  const userRole = useUserRole();
  const [roleLoaded, setRoleLoaded] = React.useState(false);
  const { t } = useTranslation("common");
  React.useEffect(() => {
    if (userRole !== undefined && userRole !== null) {
      setRoleLoaded(true);
    }
  }, [userRole]);

  const dynamicTabs = [];

  if (userRole === USER_ROLE.MANAGER) {
    dynamicTabs.push({
      label: t("dashboard.team"),
      value: "team",
      component: <TeamMembersListing />,
    });
  }

  if (userRole === USER_ROLE.SUPER_ADMIN) {
    dynamicTabs.push({
      label: t("settings.analysisModel"),
      value: "analysis-model",
      component: <AnalysisModelComponent />,
    });
    dynamicTabs.push({
      label: t("settings.dashboardModel"),
      value: "dashboard-model",
      component: <DashboardModelComponent />,
    });
    dynamicTabs.push({
      label: t("settings.transcriptAnalysisPrompt"),
      value: "transcript-analysis-prompt",
      component: <TranscriptAnalysisPromptComponent />,
    });
    dynamicTabs.push({
      label: t("common.admins"),
      value: "admins",
      component: <AdminsListing />,
    });
  }

  const tabs = [
    {
      label: t("settings.account"),
      value: "account",
      component: <ProfileForm userRole={userRole} />,
    },
    {
      label: t("settings.notifications"),
      value: "notifications",
      component: <NotificationSettings />,
    },
    {
      label: t("settings.security"),
      value: "security",
      component: <PasswordUpdateForm />,
    },
    {
      label: t("settings.languages"),
      value: "languages",
      component: <LanguageSettings />,
    },
    ...dynamicTabs,
  ];

  return (
    <div className="tw-ml-0 tw-mt-4">
      <h1 className="tw-text-3xl tw-font-semibold tw-mb-4 tw-text-center sm:tw-text-left">
        {t("common.settings")}
      </h1>
      {/* Responsive tabs: a single wrapping row of pill buttons. Wraps onto
          extra lines so every tab stays within the screen at any width, no
          horizontal overflow. */}
      <div className="tw-flex tw-flex-wrap tw-gap-2 tw-max-w-full">
        {tabs.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setActiveTab(value)}
            type="button"
            className={`tw-inline-flex tw-items-center tw-justify-center tw-py-2 tw-px-5 tw-text-sm tw-rounded-lg tw-border tw-outline-none tw-transition tw-whitespace-nowrap
              ${
                activeTab === value
                  ? "tw-bg-button tw-text-white tw-border-transparent"
                  : "tw-bg-white tw-text-[#344054] tw-border-[#D0D5DD] hover:tw-bg-[#F9FAFB]"
              }
            `}
          >
            {label}
          </button>
        ))}
      </div>
      {/* Tab Content */}
      <div className="tw-mt-10">
        {tabs.find((tab) => tab.value === activeTab)?.component}
      </div>
    </div>
  );
}

export default authMiddleware(SettingsPage);
