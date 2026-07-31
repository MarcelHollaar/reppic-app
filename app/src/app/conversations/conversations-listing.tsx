"use client";
import { PlusIcon } from "@heroicons/react/24/outline";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/solid";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { format, parseISO } from "date-fns";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useState } from "react";

import DateRangePicker from "@/components/DateRangePicker";
import { Spinner } from "@/components/MaterialTailwind";
import {
  CONVERSATION_STATUS,
  FAILED_UPLOAD_STATUS,
  USER_ROLE,
} from "@/configs/constants";
import { useUserRole } from "@/hooks/useUserRole";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import { useTranslation } from "react-i18next";
import { toast, ToastContainer } from "react-toastify";
import { types } from "../api/utils/type-constants";

export function SearchDataTables() {
  const [conversations, setConversations] = useState([]);
  const [filtering, setFiltering] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [dateRange, setDateRange] = useState([null, null]);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const userRole = useUserRole();
  const [roleLoaded, setRoleLoaded] = React.useState(false); // Track if userRole is set
  const { t, i18n } = useTranslation("common");

  React.useEffect(() => {
    if (userRole !== undefined && userRole !== null) {
      setRoleLoaded(true);
    }
  }, [userRole]);
  const headers = getAuthHeaders();

  useEffect(() => {
    // Extract date from the URL
    const dateParam = searchParams.get("date");
    if (dateParam) {
      const parsedDate = parseISO(dateParam);
      setDateRange([parsedDate, parsedDate]);
    }
  }, [searchParams]);

  const handleNewConvBtnClick = () => {
    router.push("/conversations/create");
  };
  const handleRowClick = (conversationId: any) => {
    router.push(`/conversations/${conversationId}`);
  };

  useEffect(() => {
    if (filtering.length >= 2 || filtering.length === 0) {
      const timer = setTimeout(() => {
        setPage(1); // Reset to page 1 when search changes
        if (userRole) {
          fetchConversations();
        }
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [filtering, dateRange]);

  useEffect(() => {
    if (userRole && page && pageSize) {
      fetchConversations();
    }
  }, [userRole, page, pageSize]);

  const handleFilterChange = () => {
    setPage(1);
  };

  const fetchConversations = async () => {
    try {
      setIsLoading(true);
      const [startDate, endDate] = dateRange;
      const formattedStartDate = startDate
        ? format(startDate, "yyyy-MM-dd")
        : "";
      const formattedEndDate = endDate ? format(endDate, "yyyy-MM-dd") : "";

      const apiType =
        userRole === USER_ROLE.MANAGER
          ? types.GET_TEAM_CONVERSATIONS
          : types.GET_ALL_CONVERSATIONS;

      const response = await fetch(
        `/api/conversations?type=${apiType}&page=${page}&per_page=${pageSize}&search=${filtering}&start_date=${formattedStartDate}&end_date=${formattedEndDate}`,
        {
          method: "GET",
          headers,
        }
      );

      const result = await response.json();
      if (!response.ok) {
        console.error("Error fetching conversations:", result.message);
        setIsLoading(false);
        return;
      }

      if (result.data) {
        setConversations(result.data.records);
        console.log(result.data.records);
        setTotalPages(result.data.pagination.total_pages);
      }
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const translateDate = (dateString: string) => {
    if (!dateString) return "--";
    const date = new Date(dateString);
    const month = format(date, "MMM");
    const day = format(date, "d");
    const year = format(date, "yyyy");
    const translatedMonth = t(`months.${month.toLowerCase()}`, month);
    return i18n.language === "en"
      ? `${translatedMonth} ${day}, ${year}`
      : `${day} ${translatedMonth}, ${year}`;
  };

  const getColumns = () => {
    const baseColumns = [
      {
        accessorFn: (row: any) => row.customer?.name,
        id: "customer",
        header: t("conversationsListing.customerName"),
        cell: (info: any) => (
          <span className="tw-flex tw-items-center tw-gap-2">
            <img
              src="/img/avatar.png"
              alt="Customer Avatar"
              className="tw-w-8 tw-h-8 tw-rounded-full tw-border tw-border-gray-300"
            />
            <span>{info.getValue() || "--"}</span>
          </span>
        ),
      },
      {
        accessorFn: (row: any) => row.title,
        id: "title",
        header: t("conversationsListing.conversation"),
        cell: (info: any) => {
          const value = info.getValue() || "";
          const conversation_status = info.row.original.conversation_status;
          return value.length > 20
            ? `${value.slice(0, 20)}...`
            : value
            ? value
            : conversation_status === CONVERSATION_STATUS.CONVERSATION_PAUSED
            ? `${t("conversationsListing.draft")} (${t(
                "conversationsListing.paused"
              )})`
            : `${t("conversationsListing.draft")} (${t(
                "conversationsListing.stopped"
              )})`;
        },
      },
    ];

    if (roleLoaded && userRole === USER_ROLE.MANAGER) {
      baseColumns.push({
        accessorFn: (row) => row.user.name,
        id: "team_member",
        header: t("conversationsListing.teamMember"),
        cell: (info) => info.getValue() || "--",
      });
    }

    baseColumns.push(
      {
        accessorFn: (row) =>
          row.file_duration
            ? `${Math.floor(row.file_duration / 60)}:${String(
                Math.floor(row.file_duration % 60)
              ).padStart(2, "0")} min`
            : "N/A",
        id: "duration",
        header: t("conversationsListing.duration"),
        cell: (info: any) => info.getValue() || "--",
      },
      {
        accessorFn: (row) => {
          const scoreX = row.conversation_summaries_x?.[0]?.total_score;
          const scoreLegacy = row.conversation_summaries?.[0]?.score;
          if (scoreX != null) return scoreX.toFixed(1);
          if (scoreLegacy != null) return Number(scoreLegacy).toFixed(1);
          return "N/A";
        },
        id: "score",
        header: t("conversationsListing.score"),
        cell: (info: any) => (
          <span className="tw-bg-gray-100 tw-text-[#344054] tw-px-3 tw-py-1 tw-rounded-full tw-text-sm tw-font-semibold tw-inline-block tw-w-14 tw-text-center">
            {info.getValue() || "--"}
          </span>
        ),
      },
      {
        accessorFn: (row) => row.meeting_date,
        id: "meeting_date",
        header: t("conversationsListing.date"),
        cell: (info) => {
          const date = new Date(info.getValue());
          const month = format(date, "MMM");
          const day = format(date, "d");
          const year = format(date, "yyyy");
          const translatedMonth = t(`months.${month.toLowerCase()}`, month);

          return translateDate(info.getValue());
        },
      }
    );

    return baseColumns;
  };

  const columns = getColumns();

  const table = useReactTable({
    data: conversations,
    columns,
    state: {
      globalFilter: filtering,
    },
    onGlobalFilterChange: setFiltering,
    getFilteredRowModel: getFilteredRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  useEffect(() => {
    setTimeout(() => {
      const conversationAdded = localStorage.getItem("conversationAdded");
      const conversationDraftAdded = localStorage.getItem(
        "conversationDraftAdded"
      );
      if (conversationAdded === "true") {
        toast.success(t("successMessages.conversationSaved"));
        localStorage.removeItem("conversationAdded");
      } else if (conversationDraftAdded === "true") {
        toast.success(t("successMessages.draftSaved"));
        localStorage.removeItem("conversationDraftAdded");
      }
    }, 0);
  }, []);

  return (
    <>
      <ToastContainer />
      <div className="md:tw-hidden tw-mb-4 tw-mt-4">
        <div className="tw-flex tw-flex-col-reverse md:tw-flex-row tw-items-center md:tw-items-center tw-justify-between tw-gap-4 tw-mb-4">
          <h1 className="tw-text-xl tw-font-bold tw-text-gray-900 tw-mb-1 tw-w-full md:tw-w-auto tw-text-center md:tw-text-left">
            {userRole === "manager"
              ? t("conversationsListing.teamConversations")
              : t("conversationsListing.conversations")}
          </h1>

          <div className="tw-flex tw-flex-col tw-items-end tw-w-full md:tw-w-auto tw-gap-3">
            {/* Button */}
            <button
              onClick={handleNewConvBtnClick}
              className="tw-flex tw-items-center tw-gap-2 btn-bg-blue tw-text-white tw-rounded-full tw-h-10 tw-px-5 tw-font-medium tw-text-[0.875rem] hover:tw-bg-blue-700"
            >
              <PlusIcon className="tw-w-5 tw-h-5" />
              {t("conversationsCard.newConversation")}
            </button>

            {/* Date Picker / Search Input */}
            <DateRangePicker
              dateRange={dateRange}
              setDateRange={setDateRange}
              onFilterApplied={handleFilterChange}
            />
          </div>
        </div>
      </div>

      {/* Title */}

      <div className="tw-hidden md:tw-block tw-mb-4 tw-mt-4">
        <div className="tw-flex tw-flex-col md:tw-flex-row tw-items-start md:tw-items-center tw-justify-between tw-mb-4 tw-gap-3">
          <h1 className="tw-text-xl tw-font-bold tw-text-gray-900 tw-mb-1">
            {userRole === "manager"
              ? t("conversationsListing.teamConversations")
              : t("common.conversations")}
          </h1>
          <button
            onClick={handleNewConvBtnClick}
            className="tw-flex tw-items-center tw-gap-2 btn-bg-blue tw-text-white tw-rounded-full tw-h-10 tw-px-5 tw-font-medium tw-text-[0.875rem] hover:tw-bg-blue-700"
          >
            <PlusIcon className="tw-w-5 tw-h-5" />
            {t("conversationsCard.newConversation")}
          </button>
        </div>

        {/* Date Picker and Preset Filters (Using our new component) */}
        <div className="tw-flex tw-items-center tw-gap-4 tw-justify-end">
          <DateRangePicker
            dateRange={dateRange}
            setDateRange={setDateRange}
            onFilterApplied={handleFilterChange}
          />
        </div>
      </div>
      {/* Table Card */}
      <div className="tw-bg-white tw-rounded-2xl tw-font-inter tw-p-0" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)" }}>
        {/* Header Section */}
        <div className="tw-flex tw-flex-col md:tw-flex-row tw-items-center md:tw-items-center tw-justify-center md:tw-justify-between tw-gap-3 tw-p-4 tw-border-b tw-border-gray-200 tw-text-center md:tw-text-left">
          <h2 className="tw-text-base tw-font-semibold tw-text-gray-900">
            {t("conversationsCard.recentConversations")}
          </h2>

          <div className="tw-w-full md:tw-w-80 tw-relative tw-flex tw-justify-center md:tw-justify-end">
            {/* Search Icon */}
            <img
              className="tw-absolute tw-left-3 tw-top-1/2 -tw-translate-y-1/2 tw-text-gray-500"
              src="/img/search_icon.svg"
              alt="search icon"
            />

            {/* Input Field */}
            <input
              type="text"
              className="tw-w-full md:tw-w-80 tw-pl-10 tw-pr-4 tw-py-2 tw-rounded-3xl tw-bg-white tw-border tw-border-gray-400 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 tw-placeholder-gray-500"
              placeholder={t("conversationsListing.searchForConversations")}
              value={filtering}
              onChange={(e) => setFiltering(e.target.value)}
            />
          </div>
        </div>

        {table.getRowModel().rows.length > 0 || isLoading ? (
          <>
            {/* Table */}
            <div className="tw-p-0 tw-overflow-auto table-scrollbar">
              <table className="tw-table-auto tw-text-left tw-w-full tw-min-w-max">
                <thead className="tw-bg-[#F9FAFB]">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          className="tw-p-4 tw-text-[10px] tw-font-semibold tw-text-gray-400 tw-uppercase tw-tracking-widest"
                        >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {isLoading ? (
                    // Show a single row spanning all columns with the spinner centered
                    <tr>
                      <td
                        colSpan={columns.length}
                        className="tw-text-center tw-py-10"
                      >
                        <div className="tw-flex tw-justify-center tw-items-center tw-h-full">
                          <Spinner />
                        </div>
                      </td>
                    </tr>
                  ) : table.getRowModel().rows.length > 0 ? (
                    <>
                      {/* Then render API conversations */}
                      {table.getRowModel().rows.map((row) => (
                        <tr
                          key={row.id}
                          onClick={() => handleRowClick(row.original.id)}
                          className="tw-cursor-pointer hover:tw-bg-gray-50"
                          style={{
                            background:
                              row?.original?.conversation_status ===
                                CONVERSATION_STATUS.DRAFT ||
                              row?.original?.conversation_status ===
                                CONVERSATION_STATUS.CONVERSATION_PAUSED
                                ? "#fcf9f5"
                                : FAILED_UPLOAD_STATUS.includes(
                                    row?.original?.conversation_status
                                  )
                                ? "#f9e5e5ff"
                                : "",
                          }}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <td
                              key={cell.id}
                              className={`tw-border-y tw-py-4 tw-px-4 ${
                                cell.column.id === table.getAllColumns()[0].id
                                  ? "tw-font-bold tw-text-black"
                                  : "tw-text-black"
                              }`}
                            >
                              <span className="tw-text-sm tw-leading-[1.25rem] tw-font-normal">
                                {flexRender(
                                  cell.column.columnDef.cell,
                                  cell.getContext()
                                )}
                              </span>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </>
                  ) : (
                    // Show "No Conversations Found" when there's no data
                    <tr>
                      <td
                        colSpan={columns.length}
                        className="tw-text-center tw-py-10"
                      >
                        <div className="tw-flex tw-flex-col tw-items-center tw-justify-center tw-gap-4">
                          <img
                            src="/img/conversation_empty.svg"
                            alt="No Conversations"
                            className="tw-w-[8.625rem] tw-h-auto"
                          />
                          <p className="tw-text-sm tw-text-gray-500">
                            {t("conversationsCard.noConversationsFound")}
                          </p>
                          {userRole !== USER_ROLE.MANAGER && (
                            <button
                              onClick={handleNewConvBtnClick}
                              className="tw-flex tw-items-center tw-gap-2 btn-bg-blue tw-text-white tw-rounded-full tw-h-10 tw-px-5 tw-font-medium tw-text-[0.875rem] hover:tw-bg-blue-700"
                            >
                              <PlusIcon className="tw-w-5 tw-h-5" />
                              {t("conversationsCard.newConversation")}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="tw-flex tw-items-center tw-justify-end tw-gap-6 tw-px-10 tw-py-6">
              <span className="tw-flex tw-items-center tw-gap-1 tw-text-sm tw-text-black">
                {t("common.page")} {page} {t("common.of")} {totalPages}
              </span>
              <div className="tw-flex tw-items-center tw-gap-2">
                <button
                  onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                  disabled={page === 1 || isLoading}
                  className="tw-bg-[#F5F6F8] tw-text-gray-700 tw-rounded-xl tw-p-2 tw-text-sm tw-font-medium hover:tw-bg-gray-200 tw-transition-colors disabled:tw-opacity-30"
                >
                  <ChevronLeftIcon className="tw-w-4 tw-h-4" />
                </button>
                <button
                  onClick={() =>
                    setPage((prev) => (prev < totalPages ? prev + 1 : prev))
                  }
                  disabled={page === totalPages || isLoading}
                  className="tw-bg-[#F5F6F8] tw-text-gray-700 tw-rounded-xl tw-p-2 tw-text-sm tw-font-medium hover:tw-bg-gray-200 tw-transition-colors disabled:tw-opacity-30"
                >
                  <ChevronRightIcon className="tw-w-4 tw-h-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="tw-flex tw-flex-col tw-items-center tw-justify-center tw-gap-4 tw-p-10 custom-margin">
            <img
              src="/img/conversation_empty.svg"
              alt="No Conversations"
              className="tw-w-[8.625rem] tw-h-auto"
            />
            <p className="tw-text-lg tw-font-normal tw-text-gray-700">
              {t("conversationsCard.noConversationsFound")}
            </p>
            {userRole !== USER_ROLE.MANAGER && (
              <button
                onClick={handleNewConvBtnClick}
                className="tw-flex tw-items-center tw-gap-2 btn-bg-blue tw-text-white tw-rounded-full tw-h-10 tw-px-5 tw-font-medium tw-text-[0.875rem] hover:tw-bg-blue-700"
              >
                <PlusIcon className="tw-w-5 tw-h-5" />
                {t("conversationsCard.newConversation")}
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default SearchDataTables;
