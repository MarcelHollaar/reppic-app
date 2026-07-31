"use client";
import { USER_ROLE } from "@/configs/constants";
import authMiddleware from "@/middleware/authMiddleware";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import { PlusIcon } from "@heroicons/react/24/outline";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/solid";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast, ToastContainer } from "react-toastify";

// Import our components
import { useTranslation } from "react-i18next";
import CompanyUsersInvite from "../companies/CompanyUsersInvite";

export function AdminsListing() {
  const [teamMembers, setTeamMembers] = useState([]);
  const [filtering, setFiltering] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [totalRecords, setTotalRecords] = useState(0);
  const [rowSelection, setRowSelection] = useState({});

  const router = useRouter();
  const headers = getAuthHeaders();
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const { t, i18n } = useTranslation("common");
  useEffect(() => {
    if (filtering.length >= 2 || filtering.length === 0) {
      const timer = setTimeout(() => {
        setPage(1); // Reset to page 1 when search changes
        fetchTeamMembers();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [filtering]);

  useEffect(() => {
    fetchTeamMembers();
  }, [page, pageSize]);

  const fetchTeamMembers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/admins?page=${page}&per_page=${pageSize}&search=${filtering}`,
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
        setTeamMembers(result.data.records);
        setTotalPages(result.data.pagination.total_pages);
        setTotalRecords(result.data.pagination.total_records);
      }
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setIsLoading(false);
    }
  };
  const getColumns = () => {
    let baseColumns = [
      {
        accessorKey: "name",
        header: t("common.name"),
        cell: (info: any) => {
          const member = info.row.original;
          const avatar = member.avatar ? `${member.avatar}` : "/img/avatar.png";

          return (
            <span className="tw-flex tw-items-center tw-gap-2 tw-text-[#101828]">
              <img
                src={avatar}
                alt="User Avatar"
                className="tw-w-10 tw-h-10 tw-rounded-full tw-border tw-border-gray-300"
              />
              <span className="tw-text-sm tw-font-medium">
                {info.getValue()}
              </span>
            </span>
          );
        },
      },
      {
        accessorKey: "email",
        header: t("common.emailAddress"),
        cell: (info: any) => (
          <span className="tw-text-black tw-text-sm tw-font-normal">
            {info.getValue()}
          </span>
        ),
      },
      {
        accessorKey: "created_at",
        header: t("categoriesListing.createdAt"),
        cell: ({ row }) => {
          const value = row.original.created_at;
          const formattedDate = (() => {
            const date = new Date(value);
            const month = format(date, "MMM");
            const day = format(date, "d");
            const year = format(date, "yyyy");
            const time = format(date, "h:mm a");
            const translatedMonth = t(`months.${month.toLowerCase()}`, month);

            return i18n.language === "en"
              ? `${translatedMonth} ${day}, ${year}, ${time}`
              : `${day} ${translatedMonth}, ${year}, ${time}`;
          })();

          return (
            <span className="tw-text-sm tw-text-black">{formattedDate}</span>
          );
        },
      },
    ];

    return baseColumns;
  };

  const columns = getColumns();

  const table = useReactTable({
    data: teamMembers,
    columns,
    state: {
      globalFilter: filtering,
      rowSelection,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setFiltering,
    getFilteredRowModel: getFilteredRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  useEffect(() => {
    setTimeout(() => {
      const memberAdded = localStorage.getItem("memberAdded");
      if (memberAdded === "true") {
        toast.success(t("successMessages.userAdded"));
        localStorage.removeItem("memberAdded");
      }
    }, 0);
  }, []);

  return (
    <>
      <ToastContainer />
      <div
        className="tw-bg-white tw-rounded-2xl tw-font-inter tw-p-0"
        style={{
          boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <div className="tw-flex tw-flex-col tw-p-4  tw-border-b tw-border-gray-200">
          <div className="tw-mt-2 tw-flex tw-flex-col md:tw-flex-row tw-items-center md:tw-items-start tw-justify-between tw-gap-4 tw-w-full">
            {/* Left side (Admins Heading) */}
            <div className="tw-flex tw-flex-col tw-items-center md:tw-items-start">
              <h2 className="tw-font-medium tw-text-lg tw-text-gray-900">
                {t("common.admins")}
              </h2>
            </div>

            {/* Right side (Search + Invite) */}
            <div className="tw-flex tw-flex-col tw-items-center md:tw-items-end tw-gap-2 tw-w-full md:tw-w-auto">
              {/* Search Bar */}
              <div className="tw-w-full md:tw-w-80">
                <input
                  type="text"
                  className="tw-w-full tw-pl-4 tw-pr-4 tw-py-2 tw-rounded-3xl tw-bg-white tw-border tw-border-gray-400 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 tw-placeholder-gray-500"
                  placeholder={t("adminsListing.searchForAdmins")}
                  value={filtering}
                  onChange={(e) => setFiltering(e.target.value)}
                />
              </div>

              {/* Invite Button */}
              <button
                onClick={() => setIsInviteModalOpen(true)}
                className="tw-flex tw-items-center tw-gap-2 btn-bg-blue tw-text-white tw-rounded-full tw-h-10 tw-px-5 tw-font-medium tw-text-[0.875rem] hover:tw-bg-blue-700"
              >
                <PlusIcon className="tw-w-5 tw-h-5" />
                {t("adminsListing.inviteAdmin")}
              </button>
            </div>
          </div>

          {/* Invite Modal */}
          <CompanyUsersInvite
            adminInvite={true}
            open={isInviteModalOpen}
            onClose={() => setIsInviteModalOpen(false)}
            onSuccess={() => {
              fetchTeamMembers();
            }}
          />
        </div>

        {isLoading ? (
          <div className="tw-flex tw-justify-center tw-items-center tw-h-40">
            <div className="tw-w-8 tw-h-8 tw-border-2 tw-border-[#5971F6] tw-border-t-transparent tw-rounded-full tw-animate-spin" />
          </div>
        ) : (
          <>
            {table.getRowModel().rows.length > 0 || isLoading ? (
              <>
                <div className="tw-p-0 tw-overflow-auto table-scrollbar">
                  <table className="tw-table-auto tw-text-left tw-w-full tw-min-w-max">
                    <thead className="tw-bg-[#F9FAFB]">
                      {table.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id}>
                          {headerGroup.headers.map((header) => (
                            <th
                              key={header.id}
                              className={`tw-p-4 !tw-text-black tw-font-medium ${header.column.id === "select" ? "tw-w-8" : ""}`}
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
                      {table.getRowModel().rows.map((row) => (
                        <tr key={row.id} className="hover:tw-bg-gray-50">
                          {row.getVisibleCells().map((cell) => (
                            <td
                              key={cell.id}
                              className="tw-border-y tw-py-4 tw-px-4 tw-text-black"
                            >
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext(),
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="tw-flex tw-items-center tw-justify-end tw-gap-6 tw-px-10 tw-py-6">
                  <span className="tw-flex tw-items-center tw-text-black tw-gap-1 tw-text-sm">
                    <span>{t("common.page")}</span>
                    <span>
                      {page} {t("common.of")} {totalPages}
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
                  No team admins found.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

export default authMiddleware(AdminsListing, USER_ROLE.SUPER_ADMIN);
