import { types } from "@/app/api/utils/type-constants";
import { USER_ROLE } from "@/configs/constants";
import { useUserRole } from "@/hooks/useUserRole";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import { BellIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
interface Notification {
  id: string;
  message: string;
  created_at: string;
  reference_id: string;
  reference_type: string;
}

interface PaginationInfo {
  page: number;
  per_page: number;
  total_records: number;
  total_pages: number;
}

interface EvaluationCardProps {
  userId?: string | null;
}

const EvaluationCard: React.FC<EvaluationCardProps> = ({ userId }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    per_page: 3,
    total_records: 0,
    total_pages: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [infiniteScrollActive, setInfiniteScrollActive] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const headers = getAuthHeaders();
  const userRole = useUserRole();
  const [roleLoaded, setRoleLoaded] = useState(false);
  const { t } = useTranslation("common");

  useEffect(() => {
    if (userRole !== undefined && userRole !== null) {
      setRoleLoaded(true);
    }
  }, [userRole]);

  useEffect(() => {
    if (roleLoaded) {
      fetchNotifications(1);
    }
  }, [roleLoaded, userRole, userId]);

  const fetchNotifications = async (page: number) => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      let apiType = roleLoaded
        ? userRole === USER_ROLE.MANAGER
          ? types.GET_TEAM_NOTIFICATIONS
          : types.GET_ALL_NOTIFICATIONS
        : null;
      if (!apiType) return;

      let apiUrl = `/api/notifications?type=${apiType}&page=${page}&per_page=3`;
      if (userId) apiUrl += `&user_id=${userId}`;

      const response = await fetch(apiUrl, { method: "GET", headers });
      const result = await response.json();
      const { records, pagination: newPagination } = result.data;

      setNotifications((prev) =>
        page === 1 ? records : [...prev, ...records],
      );
      setPagination(newPagination);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (notification.reference_type === "conversations") {
      router.push(`/conversations/${notification.reference_id}`);
    }
  };

  const handleLoadMore = () => {
    if (pagination.page < pagination.total_pages) {
      fetchNotifications(pagination.page + 1);
      setInfiniteScrollActive(true);
    }
  };

  useEffect(() => {
    if (!infiniteScrollActive || !containerRef.current) return;

    const handleScroll = () => {
      if (!containerRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      if (scrollTop + clientHeight >= scrollHeight - 10 && !isLoading) {
        handleLoadMore();
      }
    };

    const container = containerRef.current;
    container.addEventListener("scroll", handleScroll);

    return () => container.removeEventListener("scroll", handleScroll);
  }, [infiniteScrollActive, isLoading, pagination.page]);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.round(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60),
    );

    if (diffInHours < 1) return t("common.justNow");
    if (diffInHours < 24)
      return `${diffInHours} ${diffInHours !== 1 ? t("common.hour") : t("common.hours")} ${t("common.ago")}`;
    return date.toLocaleDateString();
  };

  return (
    <div className="tw-bg-white tw-rounded-xl tw-shadow tw-p-6 tw-w-full">
      <div className="tw-flex tw-justify-between tw-items-center tw-mb-4">
        <h2 className="tw-text-lg tw-font-medium tw-text-[#101828]">
          {t("evaluationCard.evaluationComplete")}
        </h2>
      </div>
      <div className="tw-border-b tw-mb-1 tw-border-gray-200"></div>

      <div
        ref={containerRef}
        className={`tw-space-y-0 tw-overflow-y-auto tw-custom-scrollbar ${
          infiniteScrollActive ? "tw-max-h-96" : "tw-min-h-60"
        }`}
      >
        {notifications.map((notification) => (
          <React.Fragment key={notification.id}>
            <div
              className="tw-flex tw-items-start tw-gap-3 tw-py-4 tw-cursor-pointer hover:tw-bg-gray-50"
              onClick={() => handleNotificationClick(notification)}
            >
              <div className="tw-bg-indigo-50 tw-p-2 tw-rounded-full">
                <BellIcon className="tw-h-5 tw-w-5 tw-text-[#5870F6]" />
              </div>
              <div>
                <p className="tw-text-sm tw-font-medium">
                  {notification.message.includes("for")
                    ? notification.message
                        .replace(
                          "Evaluation completed for",
                          t("notificationService.evaluationCompletedFor"),
                        )
                        .replace("with", t("common.with"))
                    : notification.message.replace(
                        "Evaluation completed with",
                        t("notificationService.evaluationCompletedWith"),
                      )}
                </p>
                <p className="tw-text-sm tw-text-gray-500">
                  {formatTimeAgo(notification.created_at)}
                </p>
              </div>
            </div>
            <div className="tw-border-b tw-border-gray-200 tw-mb-0"></div>
          </React.Fragment>
        ))}

        {!infiniteScrollActive && pagination.page < pagination.total_pages && (
          <div className="tw-pt-1">
            <button
              className="tw-text-sm tw-text-blue-600 hover:tw-underline"
              onClick={handleLoadMore}
              disabled={isLoading}
            >
              {isLoading
                ? `${t("loadingMessages.loading")}...`
                : t("loadingMessages.showMore")}
            </button>
          </div>
        )}

        {isLoading && (
          <div className="tw-text-center tw-text-gray-500 tw-py-2">
            {t("loadingMessages.loading")}...
          </div>
        )}

        {notifications.length === 0 && !isLoading && (
          <div className="tw-text-center tw-text-gray-500 tw-py-4">
            {t("evaluationCard.noEvaluationsFound")}
          </div>
        )}
      </div>
    </div>
  );
};

export default EvaluationCard;
