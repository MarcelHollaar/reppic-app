"use client";
import { TrashIcon } from "@heroicons/react/24/outline";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/solid";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { format, parseISO } from "date-fns";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import DeleteConfirmDialog from "../DeleteConfirmDialog";

// Import our new components
import { types } from "@/app/api/utils/type-constants";
import DateRangePicker from "@/components/DateRangePicker";
import { USER_ROLE } from "@/configs/constants";
import { useUserRole } from "@/hooks/useUserRole";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import { useTranslation } from "react-i18next";
import { toast, ToastContainer } from "react-toastify";

export function SuperAdminConversationListing() {
  const [conversations, setConversations] = useState([]);
  const [filtering, setFiltering] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [dateRange, setDateRange] = useState([null, null]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const userRole = useUserRole();
  const [scoreFilter, setScoreFilter] = useState<{
    gte: number | null;
    lte: number | null;
  }>({ gte: null, lte: null });

  const [sorting, setSorting] = useState([]);
  const headers = getAuthHeaders();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<
    number | null
  >(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { t, i18n } = useTranslation("common");
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
  }, [userRole, page, pageSize, sorting, scoreFilter]);

  const handleFilterChange = () => {
    setPage(1);
  };

  const fetchConversations = async () => {
    try {
      const [startDate, endDate] = dateRange;
      const formattedStartDate = startDate
        ? format(startDate, "yyyy-MM-dd")
        : "";
      const formattedEndDate = endDate ? format(endDate, "yyyy-MM-dd") : "";

      const apiType =
        userRole === USER_ROLE.MANAGER
          ? types.GET_TEAM_CONVERSATIONS
          : types.GET_ALL_CONVERSATIONS;

      let sortParams = "";
      if (sorting.length > 0) {
        const sortColumn = sorting[0].id;
        const sortDirection = sorting[0].desc ? "desc" : "asc";

        // Map table column IDs to API sort column names
        const columnMapping: Record<string, string> = {
          company_name: "company_name",
          contact_person: "contact_person",
          customer_name: "customer_name",
        };

        const apiSortColumn = columnMapping[sortColumn] || sortColumn;
        sortParams = `&sort_col=${apiSortColumn}&sort_dir=${sortDirection}`;
      }

      let scoreParams = "";

      if (scoreFilter) {
        if (scoreFilter.gte !== null) {
          scoreParams += `&score_gte=${scoreFilter.gte}`;
        }
        if (scoreFilter.lte !== null) {
          scoreParams += `&score_lte=${scoreFilter.lte}`;
        }
      }

      const response = await fetch(
        `/api/conversations?type=${apiType}&page=${page}&per_page=${pageSize}&search=${filtering}&start_date=${formattedStartDate}&end_date=${formattedEndDate}${sortParams}${scoreParams}`,
        {
          method: "GET",
          headers,
        },
      );

      const result = await response.json();
      if (!response.ok) {
        console.error("Error fetching conversations:", result.message);
        setIsLoading(false);
        return;
      }

      if (result.data) {
        setConversations(result.data.records);
        setTotalPages(result.data.pagination.total_pages);
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
            <span>{t("form.companyName")}</span>
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
          <span className="tw-flex tw-items-center tw-gap-2 tw-text-sm">
            <span>{info.getValue()}</span>
          </span>
        ),
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
            <span>{t("form.userName")}</span>
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
            <span>{t("customerDropdown.customerName")}</span>
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
            <span>{info.getValue()}</span>
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
                Math.floor(row.file_duration % 60),
              ).padStart(2, "0")} min`
            : "N/A",
        id: "duration",
        header: t("conversationsListing.duration"),
        cell: (info: any) => info.getValue(),
      },
      {
        accessorFn: (row: any) => {
          const scoreX = row.conversation_summaries_x?.[0]?.total_score;
          const scoreLegacy = row.conversation_summaries?.[0]?.score;
          if (scoreX != null) return scoreX.toFixed(1);
          if (scoreLegacy != null) return Number(scoreLegacy).toFixed(1);
          return "N/A";
        },
        id: t("conversationsListing.score"),
        header: ({ column }) => (
          <span
            className="tw-flex tw-items-center tw-cursor-pointer"
            onClick={() => column.toggleSorting()}
          >
            <span>Score</span>
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
          <span className="tw-bg-gray-100 tw-text-[#344054] tw-px-3 tw-py-1 tw-rounded-full tw-text-sm tw-font-semibold tw-inline-block tw-w-14 tw-text-center">
            {info.getValue()}
          </span>
        ),
        enableSorting: true,
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

          return i18n.language === "en"
            ? `${translatedMonth} ${day}, ${year}`
            : `${day} ${translatedMonth}, ${year}`;
        },
      },
      {
        accessorKey: "actions",
        header: t("common.actions"),
        cell: (info: any) => {
          const conversationId = info.row.original.id;
          return (
            <span
              className="tw-flex tw-gap-3"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => openDeleteDialog(conversationId)}
                className="hover:tw-text-red-800"
              >
                <TrashIcon className="tw-h-5 tw-w-5" />
              </button>
              {/* <button
                onClick={() => handleRowClick(conversationId)}
                className="hover:tw-text-[#5971F6]"
              >
                <ArrowRightIcon className="tw-h-5 tw-w-5" />
              </button> */}
            </span>
          );
        },
      },
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

  const scoreRanges = [
    { label: "All", gte: null, lte: null },
    { label: "5 - 10", gte: 5, lte: 10 },
    { label: "7 - 10", gte: 7, lte: 10 },
    { label: "1 - 7", gte: 1, lte: 7 },
  ];

  const [showDropdown, setShowDropdown] = useState(false);

  const openDeleteDialog = (conversationId: number) => {
    setSelectedConversationId(conversationId);
    setIsDialogOpen(true);
  };

  const handleDeleteConversation = async () => {
    const conversationId = selectedConversationId;

    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: "DELETE",
        headers,
      });

      if (response.ok) {
        toast.success(t("successMessages.conversationDeleted"));
        fetchConversations();
      } else {
        const errorData = await response.json();
        toast.error(
          errorData.message ||
            `${t("errorMessages.failedToDeleteConversation")}.`,
        );
      }
    } catch (error) {
      toast.error(t("errorMessages.somethingWentWrong"));
    } finally {
      setIsDialogOpen(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <>
      <ToastContainer />
      {/* Header Section (Separate) */}
      <div className="tw-mb-4 tw-mt-4">
        <div className="tw-flex tw-flex-col md:tw-flex-row tw-items-center md:tw-items-center tw-justify-between tw-mb-4 tw-gap-3">
          <h1 className="tw-text-xl tw-font-medium tw-text-gray-900 tw-text-center md:tw-text-left">
            {t("common.conversations")}
          </h1>
        </div>

        {/* Date Picker and Preset Filters (Using our new component) */}
        <div className="tw-flex tw-items-center tw-gap-4 tw-justify-end">
          <DateRangePicker
            dateRange={dateRange}
            setDateRange={setDateRange}
            onFilterApplied={handleFilterChange}
          />
          <div ref={dropdownRef} className="tw-relative">
            <button
              ref={buttonRef}
              className="filter-btn tw-flex tw-items-center border border-slate-300 tw-gap-2 tw-outline-solid tw-text-black tw-rounded-full tw-h-10 tw-px-5 tw-font-medium tw-text-[0.875rem]"
              onClick={() => setShowDropdown((prev) => !prev)}
            >
              <img src="/img/filter_icon.svg" alt="filter icon" />
              {t("adminConversationListing.scoreRange")}
            </button>

            {showDropdown && (
              <div
                className="tw-absolute tw-p-4 tw-z-10 tw-bg-white tw-border tw-shadow-md tw-mt-2 tw-rounded-2xl tw-w-48"
                style={{ width: "152px", borderRadius: "5px" }}
              >
                <div className="tw-flex tw-flex-col tw-gap-2">
                  {/* <DropdownCloseIcon onClick={() => setShowDropdown((prev) => !prev)} /> */}
                  <input
                    type="number"
                    min="1"
                    max="10"
                    step="0.1"
                    placeholder={t("timeSlot.from")}
                    value={scoreFilter?.gte ?? ""}
                    className="tw-w-full tw-px-3 tw-mt-1 tw-py-2 tw-border tw-rounded-md tw-text-sm tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500"
                    onChange={(e) => {
                      const val = e.target.value;
                      // Allow only numbers with up to one decimal place
                      if (val === "" || /^\d{0,2}(\.\d{0,1})?$/.test(val)) {
                        const value = val ? parseFloat(val) : null;
                        setScoreFilter((prev) => {
                          const updatedFilter = { ...prev, gte: value };
                          if (
                            updatedFilter.gte !== null &&
                            updatedFilter.lte !== null
                          ) {
                            setPage(1);
                          }
                          return updatedFilter;
                        });
                      }
                    }}
                  />
                  <input
                    type="number"
                    min="1"
                    max="10"
                    step="0.1"
                    placeholder={t("timeSlot.to")}
                    value={scoreFilter?.lte ?? ""}
                    className="tw-w-full tw-px-3 tw-py-2 tw-border tw-rounded-md tw-text-sm tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500"
                    onChange={(e) => {
                      const val = e.target.value;
                      // Allow only numbers with up to one decimal place
                      if (val === "" || /^\d{0,2}(\.\d{0,1})?$/.test(val)) {
                        const value = val ? parseFloat(val) : null;
                        setScoreFilter((prev) => {
                          const updatedFilter = { ...prev, lte: value };
                          if (
                            updatedFilter.gte !== null &&
                            updatedFilter.lte !== null
                          ) {
                            setPage(1);
                          }
                          return updatedFilter;
                        });
                      }
                    }}
                  />
                  {/* Action buttons */}
                  <div className="tw-flex tw-justify-between tw-pt-2">
                    <button
                      className="tw-rounded-full tw-bg-[#5971F6] tw-text-white tw-text-sm tw-px-3 tw-py-1 hover:tw-bg-blue-800"
                      onClick={() => {
                        setScoreFilter({ gte: null, lte: null });
                        setPage(1);
                      }}
                    >
                      {t("form.reset")}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div
        className="tw-bg-white tw-rounded-2xl tw-font-inter tw-p-0"
        style={{
          boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        {/* Header Section */}
        <div className="tw-flex tw-flex-col md:tw-flex-row tw-items-center md:tw-items-center tw-justify-center md:tw-justify-between tw-gap-3 tw-p-4 tw-border-b tw-border-gray-200 tw-text-center md:tw-text-left">
          <h2 className="tw-font-medium tw-text-gray-900">
            {t("conversationsCard.recentConversations")}
          </h2>
          <div className="tw-w-full md:tw-w-80 tw-relative">
            {/* Search Icon */}
            <img
              className="tw-absolute tw-left-3 tw-top-1/2 -tw-translate-y-1/2 tw-text-gray-500"
              src="/img/search_icon.svg"
              alt="search icon"
            />

            {/* Input Field */}
            <input
              type="text"
              className="tw-w-full tw-pl-10 tw-pr-4 tw-py-2 tw-rounded-3xl tw-bg-white tw-border tw-border-gray-400 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 tw-placeholder-gray-500"
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
                          className="tw-p-4 !tw-text-black tw-font-medium"
                        >
                          <span className="tw-text-xs tw-font-medium">
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
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
                    table.getRowModel().rows.map((row) => (
                      <tr
                        key={row.id}
                        onClick={() => handleRowClick(row.original.id)}
                        className="tw-cursor-pointer hover:tw-bg-gray-50"
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            className={`tw-border-y tw-py-4 tw-px-4 tw-text-black`}
                          >
                            <span className="tw-leading-[1.25rem] tw-font-normal tw-text-lg">
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext(),
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
                            alt={t("conversationsCard.noConversationsFound")}
                            className="tw-w-[8.625rem] tw-h-auto"
                          />
                          <p className="tw-text-lg tw-font-normal tw-text-gray-700">
                            {t("conversationsCard.noConversationsFound")}
                          </p>
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
                <span>{t("common.page")}</span>
                <span>
                  {" "}
                  {page} {t("common.of")} {totalPages}{" "}
                </span>
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
          </div>
        )}
      </div>
      <DeleteConfirmDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onConfirm={handleDeleteConversation}
        entityName={t("conversationsListing.conversation")?.toLowerCase()}
      />
    </>
  );
}

export default SuperAdminConversationListing;
