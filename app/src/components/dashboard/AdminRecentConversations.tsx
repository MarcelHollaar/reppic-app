"use client";
import React, { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  useReactTable,
  getSortedRowModel,
  flexRender,
} from "@tanstack/react-table";
import {
  ArrowDownIcon,
  ArrowUpIcon,
} from "@heroicons/react/24/solid";
import { useRouter, useSearchParams } from "next/navigation";

// Import our new components
import { Spinner } from "@/components/MaterialTailwind";
import { types } from "@/app/api/utils/type-constants";
import { toast, ToastContainer } from "react-toastify";
import { useUserRole } from "@/hooks/useUserRole";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import { useTranslation } from "react-i18next";

export function AdminRecentConversations() {
  const [conversations, setConversations] = useState([]);
  const [filtering, setFiltering] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [dateRange, setDateRange] = useState([null, null]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const userRole = useUserRole();
  const headers = getAuthHeaders();
  const { t, i18n } = useTranslation('common');
  const [sorting, setSorting] = useState([]);

  useEffect(() => {
    // Extract date from the URL
    const dateParam = searchParams.get("date");
    if (dateParam) {
      const parsedDate = parseISO(dateParam);
      setDateRange([parsedDate, parsedDate]);
    }
  }, [searchParams]);

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

  const fetchConversations = async () => {
    try {
      const [startDate, endDate] = dateRange;
      const formattedStartDate = startDate
        ? format(startDate, "yyyy-MM-dd")
        : "";
      const formattedEndDate = endDate ? format(endDate, "yyyy-MM-dd") : "";

      const response = await fetch(
        `/api/conversations?type=${types.GET_ALL_CONVERSATIONS}&page=${page}&per_page=${pageSize}&search=${filtering}&start_date=${formattedStartDate}&
        end_date=${formattedEndDate}`,
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
      }
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getColumns = () => {
    const baseColumns = [
      {
        accessorFn: (row: any) => row?.user?.company?.title || "N/A",
        id: "company_name",
        header: ({ column }) => (
          <span
            className="tw-flex tw-items-center tw-cursor-pointer"
            onClick={() => column.toggleSorting()}
          >
            <span>{t('form.companyName')}</span>
            {column.getIsSorted() && (
              <span className="tw-ml-1">
                {column.getIsSorted() === "desc" ? (
                  <ArrowDownIcon className="tw-w-4 tw-h-4 tw-text-blue-800" />
                ) : (
                  <ArrowUpIcon className="tw-w-4 tw-h-4 tw-text-blue-800" />
                )}
              </span>
            )}
          </span>
        ),
        cell: (info: any) => info.getValue(),
        enableSorting: true,
      },
      {
        accessorFn: (row: any) => row.user?.name,
        id: "user_name",
        header: ({ column }) => (
          <span
            className="tw-flex tw-items-center tw-cursor-pointer"
            onClick={() => column.toggleSorting()}
          >
            <span>{t('form.userName')}</span>
            {column.getIsSorted() && (
              <span className="tw-ml-1">
                {column.getIsSorted() === "desc" ? (
                  <ArrowDownIcon className="tw-w-4 tw-h-4 tw-text-blue-800" />
                ) : (
                  <ArrowUpIcon className="tw-w-4 tw-h-4 tw-text-blue-800" />
                )}
              </span>
            )}
          </span>
        ),
        cell: (info: any) => {
          const row = info.row.original;
          const avatar = row.user?.avatar
            ? `${row.user?.avatar}`
            : "/img/avatar.png";

          return (
            <span className="tw-flex tw-items-center tw-gap-2 tw-text-[#101828]">
              <img
                src={avatar}
                alt="User Avatar"
                className="tw-w-8 tw-h-8 tw-rounded-full tw-border tw-border-gray-300"
              />
              <span className="tw-text-sm tw-font-medium">
                {info.getValue()}
              </span>
            </span>
          );
        },
        enableSorting: true,
      },
      {
        accessorFn: (row: any) => row.customer?.name,
        id: "customer_name",
        header: ({ column }) => (
          <span
            className="tw-flex tw-items-center tw-cursor-pointer"
            onClick={() => column.toggleSorting()}
          >
            <span>{t('conversationsListing.customerName')}</span>
            {column.getIsSorted() && (
              <span className="tw-ml-1">
                {column.getIsSorted() === "desc" ? (
                  <ArrowDownIcon className="tw-w-4 tw-h-4 tw-text-blue-800" />
                ) : (
                  <ArrowUpIcon className="tw-w-4 tw-h-4 tw-text-blue-800" />
                )}
              </span>
            )}
          </span>
        ),
        cell: (info: any) => (
          <span className="tw-flex tw-items-center tw-gap-2">
            <img
              src="/img/avatar.png"
              alt="Customer Avatar"
              className="tw-w-8 tw-h-8 tw-rounded-full tw-border tw-border-gray-300"
            />
            <span className="tw-text-black">{info.getValue()}</span>
          </span>
        ),
        enableSorting: true,
      },
    ];

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
        cell: (info: any) => info.getValue(),
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
          <span className="tw-bg-gray-100 tw-text-black tw-px-3 tw-py-1 tw-rounded-full tw-text-sm tw-font-semibold tw-inline-block tw-w-14 tw-text-center">
            {info.getValue()}
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

          return i18n.language === 'en'
            ? `${translatedMonth} ${day}, ${year}`
            : `${day} ${translatedMonth}, ${year}`;
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
      sorting,
    },
    onGlobalFilterChange: setFiltering,
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  useEffect(() => {
    setTimeout(() => {
      const conversationAdded = localStorage.getItem("conversationAdded");
      if (conversationAdded === "true") {
        toast.success(t("successMessages.conversationSaved"));
        localStorage.removeItem("conversationAdded");
      }
    }, 0);
  }, []);

  return (
    <>
      <div className="tw-min-h-[28rem] tw-bg-white tw-rounded-xl tw-shadow tw-w-full">
        {/* Header */}
        <div className="tw-flex tw-p-4 tw-justify-between tw-items-center tw-mb-1">
          <h3 className="tw-text-lg tw-font-medium tw-text-[#101828]">
            {t('conversationsCard.recentConversations')}
          </h3>
        </div>
        <div className="tw-border-b tw-border-gray-200 tw--mx-4 tw-mb-0"></div>

        {isLoading ? (
          <div className="tw-flex tw-justify-center tw-items-center tw-py-10">
            <div className="tw-w-8 tw-h-8 tw-border-2 tw-border-[#5971F6] tw-border-t-transparent tw-rounded-full tw-animate-spin" />
          </div>
        ) : conversations.length > 0 ? (
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
                          className="tw-p-4 !tw-text-black tw-font-medium"
                        >
                          <span className="tw-text-xs tw-font-medium">
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                          </span>
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
                          <div className="tw-w-8 tw-h-8 tw-border-2 tw-border-[#5971F6] tw-border-t-transparent tw-rounded-full tw-animate-spin" />
                        </div>
                      </td>
                    </tr>
                  ) : table.getRowModel().rows.length > 0 ? (
                    // Show table rows when data is available
                    table.getRowModel().rows.map((row, index) => (
                      <tr
                        key={row.id}
                        onClick={() => handleRowClick(row.original.id)}
                        className={`tw-cursor-pointer hover:tw-bg-gray-50 ${index === 4 ? "" : "tw-border-y"}`}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            className={`tw-py-4 tw-px-4 ${
                              cell.column.id === table.getAllColumns()[0].id
                                ? "tw-font-bold tw-text-black" // First column: bold and black
                                : "tw-text-black" // Other columns: gray text
                            }`}
                          >
                            <span className="tw-leading-[1.25rem] tw-font-normal tw-text-lg">
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext()
                              )}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))
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
                            alt={t('conversationsCard.noConversationsFound')}
                            className="tw-w-[8.625rem] tw-h-auto"
                          />
                          <p className="tw-text-lg tw-font-normal tw-text-gray-700">
                            {t('conversationsCard.noConversationsFound')}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="tw-flex tw-flex-col tw-items-center tw-justify-center tw-gap-4 tw-py-6">
            <img
              src="/img/conversation_empty.svg"
              alt={t('conversationsCard.noConversationsFound')}
              className="tw-w-[8.625rem] tw-h-auto"
            />
            <p className="tw-text-lg tw-font-normal tw-text-gray-700">
              {t('conversationsCard.noConversationsFound')}
            </p>
          </div>
        )}
      </div>
    </>
  );
}

export default AdminRecentConversations;
