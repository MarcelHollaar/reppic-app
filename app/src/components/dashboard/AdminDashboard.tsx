"use client";
import React, { useEffect } from "react";
import authMiddleware from "@/middleware/authMiddleware";
import { toast, ToastContainer } from "react-toastify";
import AdminStatsCards from "./AdminStatsCards";
import AdminRecentConversations from "./AdminRecentConversations";
import CalendarCard from "./CalendarCard";
import { loggedInUser } from "@/hooks/useUserRole";
import { useTranslation } from "react-i18next";

const AdminDashboard: React.FC<{}> = () => {
  const user = loggedInUser();
  const {t} = useTranslation('common');
  useEffect(() => {
    setTimeout(() => {
      const dashboardRedirect = localStorage.getItem("dashboardRedirect");
      if (dashboardRedirect === "true") {
        toast.error(t("errorMessages.notAuthorized"));
        localStorage.removeItem("dashboardRedirect");
      }
    }, 0);
  }, []);

  return (
    <>
      <ToastContainer />
      <div className="tw-mx-auto">
        <div className="tw-flex tw-flex-col md:tw-flex-row tw-items-center md:tw-items-center tw-justify-center md:tw-justify-between tw-gap-4 tw-text-center tw-mb-0">
          <h2 className="tw-text-xl tw-font-medium tw-text-gray-900">
           {t('dashboard.welcomeMessage', { name: user?.name })}
          </h2>
        </div>
      </div>
      <AdminStatsCards />
      <div className="tw-grid tw-grid-cols-1 lg:tw-grid-cols-3 tw-gap-6">
        <div className="lg:tw-col-span-2">
          <AdminRecentConversations />
        </div>
        <div>
          <CalendarCard initialMonth={new Date(2025, 0)} />
        </div>
      </div>
    </>
  );
};

export default authMiddleware(AdminDashboard);
