"use client";
import AdminDashboard from "@/components/dashboard/AdminDashboard";
import { CalendarCard } from "@/components/dashboard/CalendarCard";
import RecentConversationsCard from "@/components/dashboard/RecentConversationsCard";
import LearningCard from "@/components/dashboard/LearningCard";
import { IndividualPicaSection } from "@/components/salesDashboards/IndividualPicaSection";
import StatCard from "@/components/dashboard/StatCard";
import { TEAM_STATS, USER_ROLE, USER_STATS } from "@/configs/constants";
import { loggedInUser, useUserRole } from "@/hooks/useUserRole";
import authMiddleware from "@/middleware/authMiddleware";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import { ChevronDownIcon, PlusIcon } from "@heroicons/react/24/solid";

import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast, ToastContainer } from "react-toastify";

interface TeamMember {
  id: string;
  name: string;
  avatar: string;
  email: string;
  role: {
    id: string;
    name: string;
    description: string;
    status: string;
    created_at: string;
    updated_at: string;
  };
  created_at: string;
  _count: {
    user_conversations: number;
  };
  number_of_conversations: number;
}

interface DashboardLayoutProps {
  username: string;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ username }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userIdFromUrl = searchParams.get("user_id");
  const userRole = useUserRole();
  const [roleLoaded, setRoleLoaded] = React.useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [recentConversations, setRecentConversations] = useState([]);
  const user = loggedInUser();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation("common");

  useEffect(() => {
    if (userIdFromUrl) {
      setSelectedUser(userIdFromUrl);
    }
  }, [userIdFromUrl]);

  React.useEffect(() => {
    if (userRole !== undefined && userRole !== null) {
      setRoleLoaded(true);
    }
  }, [userRole]);
  useEffect(() => {
    setTimeout(() => {
      const dashboardRedirect = localStorage.getItem("dashboardRedirect");
      if (dashboardRedirect === "true") {
        toast.error(t("errorMessages.notAuthorized"));
        localStorage.removeItem("dashboardRedirect");
      }
    }, 0);
  }, []);

  const timeRanges = {
    "12m": { label: t("dashboard.lastYear"), days: 365 },
    "30d": { label: t("dashboard.lastMonth"), days: 30 },
    "7d": { label: t("dashboard.lastWeek"), days: 7 },
    "24h": { label: t("dashboard.yesterday"), days: 1 },
  };

  const [activeRange, setActiveRange] = React.useState("30d");
  const [isLoading, setIsLoading] = useState(true);
  const [statsData, setStatsData] = useState();
  const [formattedStartDate, setStartDate] = useState("");
  const [formattedEndDate, setEndDate] = useState("");
  const [activeTab, setActiveTab] = useState<"manager" | "team">("team");

  // Update dates whenever activeRange changes
  useEffect(() => {
    if (!timeRanges[activeRange]) return;
    // Get current date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - timeRanges[activeRange].days);

    // Format dates as YYYY-MM-DD
    const formatDate = (date) => date.toISOString().split("T")[0];

    const newStartDate = formatDate(startDate);
    const newEndDate = formatDate(endDate);

    // Prevent unnecessary re-fetches
    if (
      newStartDate === formattedStartDate &&
      newEndDate === formattedEndDate
    ) {
      return;
    }

    setStartDate(formatDate(startDate));
    setEndDate(formatDate(endDate));
  }, [activeRange, selectedUser]);

  // Fetch team members
  const fetchTeamMembers = async () => {
    try {
      const headers = getAuthHeaders();

      const response = await fetch("/api/team-members", {
        method: "GET",
        headers,
      });

      const result = await response.json();
      if (!response.ok) {
        console.error("Error fetching team members:", result.message);
        return;
      }

      if (result.data && result.data.records) {
        setTeamMembers(result.data.records);
      }
    } catch (error) {
      console.error("Error fetching team members:", error);
    }
  };

  const fetchStats = async (startDate: any, endDate: any) => {
    try {
      const headers = getAuthHeaders();
      let type = activeTab == "team" && !selectedUser ? TEAM_STATS : USER_STATS;
      // Build the API URL with query parameters
      let apiUrl = `/api/dashboard-stats?start_date=${formattedStartDate}&end_date=${formattedEndDate}&type=${type}`;

      // Add user_id parameter if a user is selected
      if (selectedUser) {
        apiUrl += `&user_id=${selectedUser}`;
      }

      const response = await fetch(apiUrl, {
        method: "GET",
        headers,
      });

      const result = await response.json();
      if (!response.ok) {
        console.error("Error fetching stats:", result.message);
        setIsLoading(false);
        return;
      }

      if (result.data) {
        setStatsData(result.data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (roleLoaded && userRole === USER_ROLE.MANAGER) {
      fetchTeamMembers();
    }
  }, [roleLoaded]);

  useEffect(() => {
    if (formattedStartDate && formattedEndDate) {
      fetchStats(formattedStartDate, formattedEndDate);
    }
  }, [
    activeRange,
    selectedUser,
    formattedStartDate,
    formattedEndDate,
    activeTab,
  ]);

  // Handle user selection
  const handleUserSelect = (userId: string) => {
    setSelectedUser(userId);
    setDropdownOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownOpen]);

  return (
    <>
      {userRole === USER_ROLE.SUPER_ADMIN ? (
        <AdminDashboard />
      ) : (
        <>
          <ToastContainer />
          <div className="tw-mx-auto">
            <div className="tw-flex tw-flex-col md:tw-flex-row tw-items-center md:tw-items-center tw-justify-center md:tw-justify-between tw-gap-4 tw-text-center tw-mb-6">
              <h1 className="tw-text-xl tw-font-bold tw-text-gray-900 tw-mb-1">
                {t("dashboard.welcomeMessage", { name: user?.name })}
              </h1>
              <button
                onClick={() => router.push("/conversations/create")}
                className="tw-flex tw-items-center tw-gap-2 btn-bg-blue tw-text-white tw-rounded-full tw-h-10 tw-px-5 tw-font-medium tw-text-[0.875rem] hover:tw-bg-blue-700 tw-mt-4"
              >
                <PlusIcon className="tw-w-5 tw-h-5" />
                {t("dashboard.newConversation")}
              </button>
            </div>

            <div className="tw-flex tw-flex-wrap tw-items-center tw-justify-between tw-gap-2 tw-mb-6">
              {/* Manager & Team Tabs */}
              {roleLoaded && userRole === USER_ROLE.MANAGER && (
                <div className="tw-inline-flex tw-border tw-border-gray-300 tw-rounded-full tw-overflow-hidden">
                  {["team", "manager"].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab?.toLowerCase())}
                      className={`tw-px-4 tw-py-2 tw-text-sm tw-font-medium ${
                        activeTab === tab?.toLowerCase()
                          ? "btn-bg-blue tw-text-white"
                          : "tw-text-black tw-bg-white tw-border-l tw-border-gray-300"
                      }`}
                    >
                      {t(`dashboard.${tab?.toLowerCase()}`)
                        .charAt(0)
                        .toUpperCase() +
                        t(`dashboard.${tab?.toLowerCase()}`).slice(1)}
                    </button>
                  ))}
                </div>
              )}
              {/* User Selection Dropdown */}
              {roleLoaded &&
                userRole == USER_ROLE.MANAGER &&
                activeTab == "team" && (
                  <div className="tw-relative" ref={dropdownRef}>
                    <button
                      onClick={() => setDropdownOpen((prev) => !prev)}
                      className="tw-flex tw-items-center tw-gap-2 tw-border tw-border-gray-300 tw-bg-white tw-text-black tw-rounded-full tw-h-10 tw-px-4 tw-font-medium tw-text-sm"
                    >
                      {selectedUser
                        ? teamMembers.find(
                            (member) => member.id === selectedUser
                          )?.name || t("dashboard.selectUser")
                        : t("dashboard.allUsers")}
                      <ChevronDownIcon className="tw-w-4 tw-h-4" />
                    </button>

                    {dropdownOpen && (
                      <div
                        id="user-dropdown"
                        className="tw-absolute tw-right-0 tw-mt-1 tw-py-2 tw-bg-white tw-rounded-xl tw-shadow-lg tw-border tw-border-gray-200 tw-z-10 tw-min-w-[200px]"
                      >
                        {/* <DropdownCloseIcon onClick={() => setDropdownOpen((prev) => !prev)} /> */}
                        <div
                          className="tw-px-4 tw-py-2 tw-cursor-pointer hover:tw-bg-gray-100"
                          onClick={() => handleUserSelect("")}
                        >
                          <span className="tw-text-sm tw-text-gray-700">{t("dashboard.allUsers")}</span>
                        </div>
                        {teamMembers.map((member) => (
                          <div
                            key={member.id}
                            className="tw-px-4 tw-py-2 tw-cursor-pointer hover:tw-bg-gray-100"
                            onClick={() => handleUserSelect(member.id)}
                          >
                            <span className="tw-text-sm tw-text-gray-700">{member.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
            </div>

            <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 lg:tw-grid-cols-3 tw-gap-6 tw-mb-6">
              <StatCard
                title={t("dashboard.conversationThisMonth")}
                showLine={false}
                trend={
                  (statsData?.average_conversations?.change ?? 0) >= 0 ? `up` : `down`
                }
                pastState={`${(statsData?.average_conversations?.change ?? 0).toFixed(
                  2
                )}% vs ${timeRanges[activeRange].label}`}
                value={statsData?.average_conversations?.current || 0}
              />
              <StatCard
                title={t("dashboard.averageConversationLength")}
                symbol={t("common.min")}
                trend={
                  (statsData?.average_conversation_length?.change ?? 0) >= 0
                    ? `up`
                    : `down`
                }
                pastState={`${(statsData?.average_conversation_length?.change ?? 0).toFixed(
                  2
                )}% vs ${timeRanges[activeRange].label}`}
                value={statsData?.average_conversation_length?.current || 0}
                forTime={true}
              />
              <StatCard
                title={`${t("dashboard.talkRatio")} %`}
                trend={(statsData?.avg_talk_ratio?.change ?? 0) >= 0 ? `up` : `down`}
                pastState={`${(statsData?.avg_talk_ratio?.change ?? 0).toFixed(
                  2
                )}% vs ${timeRanges[activeRange].label}`}
                value={statsData?.avg_talk_ratio?.current || 0}
              />
            </div>
            <div className="tw-grid tw-grid-cols-1 lg:tw-grid-cols-3 tw-gap-6">
              <div className="lg:tw-col-span-2">
                <RecentConversationsCard
                  userId={selectedUser}
                  startDate={formattedStartDate}
                  endDate={formattedEndDate}
                  selectedTab={activeTab}
                  setRecentConversations={setRecentConversations}
                />
              </div>
              <div>
                <CalendarCard initialMonth={new Date(2025, 0)} />
              </div>
            </div>
            {/* Individual PICA sales-phase performance — same display as the
                team operational dashboard, scoped to this salesperson.
                Falls back to the logged-in user when no team member is selected. */}
            <div className="tw-mt-6">
              <IndividualPicaSection userId={selectedUser || (user as any)?.id} />
            </div>
            {/* Leerdata-tegel (LMS-integratie): eigen leervoortgang +
                AI-aanbeveling. Rendert alleen voor gebruikers met leer-toegang. */}
            <div className="tw-mt-6">
              <LearningCard />
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default authMiddleware(DashboardLayout);
