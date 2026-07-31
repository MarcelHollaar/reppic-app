"use client";
import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import authMiddleware from "@/middleware/authMiddleware";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import StatCard from "./StatCard";
import { useTranslation } from "react-i18next";

const AdminDashboard: React.FC = () => {
  const [activeRange, setActiveRange] = React.useState("30d");
  const [statsData, setStatsData] = useState({
    total_users: 0,
    total_companies: 0,
    total_conversations: 0,
  });
  const { t } = useTranslation('common');
  const timeRanges = {
    "12m": { label: t('dashboard.lastYear'), days: 365 },
    "30d": { label: t('dashboard.lastMonth'), days: 30 },
    "7d": { label: t('dashboard.lastWeek'), days: 7 },
    "24h": { label: t('dashboard.yesterday'), days: 1 },
  };

  useEffect(() => {
    const dashboardRedirect = localStorage.getItem("dashboardRedirect");
    if (dashboardRedirect === "true") {
      toast.error(t("errorMessages.notAuthorized"));
      localStorage.removeItem("dashboardRedirect");
    }

    const fetchStats = async () => {
      try {
        const headers = getAuthHeaders();
        const response = await fetch("/api/dashboard-stats", {
          method: "GET",
          headers,
        });

        const result = await response.json();
        if (!response.ok) {
          console.error("Error fetching stats:", result.message);
          return;
        }

        if (result.data) {
          setStatsData(result.data);
        }
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
      }
    };

    fetchStats();
  }, []);

  const cards = [
    {
      title: t("dashboard.totalUsers"),
      value: statsData.total_users?.current?.toString() ?? "0",
      change: statsData.total_users?.change ?? 0,
      pastState: `${
        statsData.total_users?.change?.toFixed(2) ?? "0.00"
      }% vs ${timeRanges[activeRange]?.label ?? ""}`,
    },
    {
      title: t("dashboard.totalCompanies"),
      value: statsData.total_companies?.current?.toString(),
      change: statsData.total_companies?.change ?? 0,
      pastState: `${
        statsData.total_companies?.change?.toFixed(2) ?? "0.00"
      }% vs ${timeRanges[activeRange]?.label ?? ""}`,
    },
    {
      title: t("dashboard.totalConversations"),
      value: statsData.total_conversations?.current?.toString(),
      change: statsData.total_conversations?.change ?? 0,
      pastState: `${
        statsData.total_conversations?.change?.toFixed(2) ?? "0.00"
      }% vs ${timeRanges[activeRange]?.label ?? ""}`,
    },
  ];

  return (
    <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 md:tw-grid-cols-3 tw-gap-4 tw-py-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className="tw-relative tw-flex tw-items-center"
        >
          <StatCard
            title={card.title}
            trend={
              card?.change >= 0 ? "up" : "down"
            }
            pastState={card.pastState}
            value={card.value}
            />
        </div>
      ))}
    </div>
  );
};

export default authMiddleware(AdminDashboard);
