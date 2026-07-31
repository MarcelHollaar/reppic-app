"use client";
import { types } from "@/app/api/utils/type-constants";
import {
  CONVERSATION_STATUS,
  FAILED_UPLOAD_STATUS,
  USER_ROLE,
} from "@/configs/constants";
import { useUserRole } from "@/hooks/useUserRole";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import { PlusIcon } from "@heroicons/react/24/solid";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
interface RecentConversationsCardProps {
  userId?: string | null;
  startDate?: string;
  endDate?: string;
  selectedTab?: string;
  setRecentConversations?: any;
}

const RecentConversationsCard: React.FC<RecentConversationsCardProps> = ({
  userId,
  startDate,
  endDate,
  selectedTab,
  setRecentConversations,
}) => {
  const headers = getAuthHeaders();
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const userRole = useUserRole();
  const [roleLoaded, setRoleLoaded] = React.useState(false); // Track if userRole is set
  const { t, i18n } = useTranslation("common");

  React.useEffect(() => {
    if (userRole !== undefined && userRole !== null) {
      setRoleLoaded(true);
    }
  }, [userRole]);

  const handleNewConvBtnClick = () => {
    router.push("/conversations/create");
  };

  const handleRowClick = (conversationId: any, conversationStatus?: string) => {
    if (
      conversationStatus &&
      (conversationStatus === CONVERSATION_STATUS.DRAFT ||
        conversationStatus === CONVERSATION_STATUS.CONVERSATION_PAUSED ||
        FAILED_UPLOAD_STATUS.includes(conversationStatus))
    ) {
      router.push(`/conversations/${conversationId}`);
      return;
    }
    router.push(`/conversations/${conversationId}`);
  };

  useEffect(() => {
    if (roleLoaded) {
      fetchRecentConversations();
    }
  }, [roleLoaded, userRole, userId, startDate, endDate, selectedTab]);

  const fetchRecentConversations = async () => {
    setIsLoading(true);
    try {
      let apiType = null;
      if (roleLoaded) {
        apiType =
          userRole === USER_ROLE.MANAGER && selectedTab === "team"
            ? types.GET_TEAM_CONVERSATIONS
            : types.GET_ALL_CONVERSATIONS;
      } else {
        return;
      }

      // Construct API URL with conditional userId param
      let apiUrl = `/api/conversations?type=${apiType}&page=1&per_page=5`;
      if (userId) {
        apiUrl += `&user_id=${userId}`;
      }
      if (startDate && endDate) {
        apiUrl += `&start_date=${startDate}&end_date=${endDate}`;
      }

      const response = await fetch(apiUrl, {
        method: "GET",
        headers,
      });

      const result = await response.json();
      if (!response.ok) {
        console.error("Error fetching recent conversations:", result.message);
        setIsLoading(false);
        return;
      }

      if (result.data) {
        setConversations(result.data.records);
        setRecentConversations(result.data.records);
      }
    } catch (error) {
      console.error("Error fetching recent conversations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="tw-min-h-[28rem] tw-bg-white tw-rounded-xl tw-shadow tw-w-full">
      {/* Header */}
      <div className="tw-flex tw-p-4 tw-justify-between tw-items-center tw-mb-1">
        <h3 className="tw-text-lg tw-font-medium tw-text-[#101828]">
          {t("conversationsCard.recentConversations")}
        </h3>
      </div>
      <div className="tw-border-b tw-border-gray-200 tw--mx-4 tw-mb-0"></div>

      {isLoading ? (
        <div className="tw-flex tw-justify-center tw-items-center tw-py-10">
          <div className="tw-w-8 tw-h-8 tw-border-2 tw-border-[#5971F6] tw-border-t-transparent tw-rounded-full tw-animate-spin" />
        </div>
      ) : conversations.length > 0 ? (
        <div className="tw-overflow-x-auto tw-px-0 table-scrollbar">
          <table className="tw-table-auto tw-text-left tw-w-full tw-min-w-max">
            <thead className="tw-bg-[#F9FAFB]">
              <tr>
                <th className="tw-p-3 !tw-text-black tw-font-medium">
                  <span className="tw-text-xs tw-font-medium">
                    {t("conversationsListing.customerName")}
                  </span>
                </th>
                <th className="tw-p-3 !tw-text-black tw-font-medium">
                  <span className="tw-text-xs tw-font-medium">
                    {t("conversationsListing.conversation")}
                  </span>
                </th>
                {userRole === USER_ROLE.MANAGER && selectedTab === "team" && (
                  <th className="tw-p-3 !tw-text-black tw-font-medium">
                    <span className="tw-text-xs tw-font-medium">
                      {t("conversationsListing.teamMember")}
                    </span>
                  </th>
                )}

                <th className="tw-p-3 !tw-text-black tw-font-medium">
                  <span className="tw-text-xs tw-font-medium">
                    {t("conversationsListing.duration")}
                  </span>
                </th>
                <th className="tw-hidden sm:tw-table-cell tw-p-3 !tw-text-black tw-font-medium">
                  <span className="tw-text-xs tw-font-medium">
                    {t("conversationsListing.score")}
                  </span>
                </th>
                <th className="tw-p-3 !tw-text-black tw-font-medium">
                  <span className="tw-text-xs tw-font-medium">
                    {t("conversationsListing.date")}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {conversations.map((conversation, index) => (
                <tr
                  key={conversation.id}
                  onClick={() =>
                    handleRowClick(
                      conversation.id,
                      conversation?.conversation_status,
                    )
                  }
                  className={`tw-cursor-pointer hover:tw-bg-gray-50 ${
                    index === 4 ? "" : "tw-border-y"
                  }`}
                  style={{
                    background:
                      conversation?.conversation_status ===
                        CONVERSATION_STATUS.DRAFT ||
                      conversation?.conversation_status ===
                        CONVERSATION_STATUS.CONVERSATION_PAUSED
                        ? "#fcf9f5"
                        : FAILED_UPLOAD_STATUS.includes(
                              conversation?.conversation_status,
                            )
                          ? "#f9e5e5ff"
                          : "",
                  }}
                >
                  <td className=" tw-py-[.75rem] tw-px-3 tw-font-bold tw-text-black">
                    <div className="tw-flex tw-items-center tw-gap-2">
                      <img
                        src="/img/avatar.png"
                        alt="Customer Avatar"
                        className="tw-w-10 tw-h-10 tw-rounded-full tw-border tw-border-gray-300"
                      />
                      <span className="tw-leading-[1.25rem] tw-text-sm tw-font-medium">
                        {conversation?.customer?.name || "--"}
                      </span>
                      {/* <span>{conversation.customer.name}</span> */}
                    </div>
                  </td>
                  <td className="tw-py-3 tw-px-3 tw-text-black">
                    <span className="tw-text-sm tw-leading-[1.25rem] tw-font-normal">
                      {conversation?.title?.length > 20
                        ? `${conversation?.title.slice(0, 20)}...`
                        : conversation?.title || "--"}
                    </span>
                  </td>
                  {userRole === USER_ROLE.MANAGER && selectedTab === "team" && (
                    <td className="tw-py-3 tw-px-3 tw-text-black">
                      <span className="tw-text-sm tw-leading-[1.25rem] tw-font-normal">
                        {conversation?.user?.name
                          ? conversation?.user?.name
                          : "N/A"}
                      </span>
                    </td>
                  )}
                  <td className="tw-py-3 tw-px-3 tw-text-black">
                    <span className="tw-text-sm tw-leading-[1.25rem] tw-font-normal">
                      {`${Math.floor(
                        conversation?.file_duration / 60,
                      )}:${String(
                        Math.floor(conversation?.file_duration % 60),
                      ).padStart(2, "0")} min`}
                    </span>
                  </td>
                  <td className="tw-hidden sm:tw-table-cell tw-py-3 tw-px-3 tw-text-black">
                    <span className="tw-bg-gray-100 tw-text-[#344054] tw-px-3 tw-py-1 tw-rounded-lg tw-text-sm tw-font-semibold tw-inline-block tw-w-14 tw-text-center">
                      {conversation?.conversation_summaries_x?.[0]
                        ?.total_score != null
                        ? conversation.conversation_summaries_x[0].total_score.toFixed(
                            1,
                          )
                        : conversation?.conversation_summaries?.[0]?.score !=
                            null
                          ? Number(
                              conversation.conversation_summaries[0].score,
                            ).toFixed(1)
                          : "N/A"}
                    </span>
                  </td>
                  <td className="tw-py-3 tw-px-3 tw-text-black">
                    <span className="tw-leading-[1.25rem] tw-text-sm tw-font-normal">
                      {(() => {
                        const date = new Date(conversation?.meeting_date);
                        const month = format(date, "MMM");
                        const day = format(date, "d");
                        const year = format(date, "yyyy");
                        const translatedMonth = t(
                          `months.${month.toLowerCase()}`,
                          month,
                        );

                        return i18n.language === "en"
                          ? `${translatedMonth} ${day}, ${year}`
                          : `${day} ${translatedMonth}, ${year}`;
                      })()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="tw-flex tw-flex-col tw-items-center tw-justify-center tw-gap-4 tw-py-6">
          <img
            src="/img/conversation_empty.svg"
            alt={t("conversationsCard.noConversationsFound")}
            className="tw-w-[8.625rem] tw-h-auto"
          />
          <p className="tw-text-lg tw-font-normal tw-text-gray-700">
            {t("conversationsCard.noConversationsFound")}
          </p>
          <button
            onClick={handleNewConvBtnClick}
            className="tw-flex tw-items-center tw-gap-2 btn-bg-blue tw-text-white tw-rounded-full tw-h-10 tw-px-5 tw-font-medium tw-text-[0.875rem] hover:tw-bg-blue-700"
          >
            <PlusIcon className="tw-w-5 tw-h-5" />
            {t("conversationsCard.newConversation")}
          </button>
        </div>
      )}
    </div>
  );
};

export default RecentConversationsCard;
