"use client";
import { loggedInUser } from "@/hooks/useUserRole";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import {
  PencilIcon,
  TrashIcon,
  UserPlusIcon,
} from "@heroicons/react/24/outline";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/solid";
import {
  createColumnHelper,
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
import DeleteUserDialog from "./DeleteTeamMemberConfirm";
interface TeamMembersListingProps {
  settingsPage?: boolean;
}

// Import our components
import { useTranslation } from "react-i18next";
import InviteMemberDialog from "./InviteMemberDialog";
export function TeamMembersListing({ settingsPage = false }) {
  const [teamMembers, setTeamMembers] = useState([]);
  const [filtering, setFiltering] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPresentSubscriptions, setTotalPresentSubscriptions] = useState(0);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [rowSelection, setRowSelection] = useState({});
  const [isBulkDelete, setIsBulkDelete] = useState(false);
  const [isMaxSubsLimitReached, setIsMaxSubsLimitReached] = useState(false);
  const [maxSubscriptionsLimit, setMaxSubscriptionsLimit] = useState<
    number | null
  >(null);

  const router = useRouter();
  const headers = getAuthHeaders();
  const userInfo = JSON.parse(localStorage.getItem("user_data") || "{}");
  const { t, i18n } = useTranslation("common");
  const user = loggedInUser();
  const isContactPerson = user?.is_company_contact_manager;
  const companyId = user?.company_id;

  useEffect(() => {
    (async () => {
      const currentMaxSubscriptionsLimit = (await fetchUserProfile()) || null;
      if (currentMaxSubscriptionsLimit) {
        setIsMaxSubsLimitReached(
          currentMaxSubscriptionsLimit <= totalPresentSubscriptions,
        );
      }
    })();
  }, [isDialogOpen]);

  useEffect(() => {
    // Only fetch when filtering is valid or empty
    if (filtering.length >= 2 || filtering.length === 0) {
      const timer = setTimeout(() => {
        fetchTeamMembers();
      }, 500);

      return () => clearTimeout(timer);
    }
    // Don't fetch if filtering is too short
  }, [filtering, page]);

  const fetchTeamMembers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/team-members?page=${page}&per_page=${pageSize}&search=${filtering}`,
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
        setTotalPresentSubscriptions(
          result.data.pagination.total_subscriptions,
        );
      }
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserProfile = async () => {
    try {
      const response = await fetch("/api/user", {
        method: "GET",
        headers,
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setMaxSubscriptionsLimit(result?.data?.company?.max_users || null);
      return result?.data?.company?.max_users;
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  };

  const openInviteDialog = async () => {
    if (isMaxSubsLimitReached) {
      toast.error(t("errorMessages.canNotInviteMoreMembers"));
      return;
    }
    setIsDialogOpen(true);
  };

  const closeInviteDialog = () => {
    setIsDialogOpen(false);
  };
  const openDeleteDialog = (userId: number) => {
    setSelectedUserId(userId);
    setIsDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setSelectedUserId(null);
  };

  const showSuccessToast = (message: string) => {
    fetchTeamMembers();
    toast.success(message);
  };

  const handleRowClick = (row: any) => {
    if (!settingsPage) {
      router.push(`/dashboard/?user_id=${row.original?.id}`);
    }
  };

  const columnHelper = createColumnHelper<any>();

  // Define the selection column first
  const selectionColumn = columnHelper.display({
    id: "select",
    header: ({ table }) => (
      <p className="tw-px-0">
        <input
          type="checkbox"
          checked={table.getIsAllRowsSelected()}
          onChange={table.getToggleAllRowsSelectedHandler()}
          className="tw-h-5 tw-w-5 tw-rounded tw-border-gray-300 tw-text-indigo-600 focus:tw-ring-indigo-500"
        />
      </p>
    ),
    cell: ({ row }) => (
      <p className="tw-px-0" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          className="tw-h-5 tw-w-5 tw-rounded tw-border-gray-300 tw-text-indigo-600 focus:tw-ring-indigo-500"
        />
      </p>
    ),
  });

  const getColumns = () => {
    // Create columns based on settingsPage flag
    let baseColumns;

    if (settingsPage) {
      baseColumns = [
        {
          accessorKey: "name",
          header: t("common.name"),
          cell: (info: any) => {
            const member = info.row.original;
            const avatar = member.avatar
              ? `${member.avatar}`
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
          accessorKey: "role",
          header: t("common.role"),
          cell: (info: any) => (
            <span className="tw-text-black tw-capitalize tw-text-sm tw-font-normal">
              {info.row.original.role?.name || "N/A"}
            </span>
          ),
        },
        {
          accessorKey: "conversations_this_month",
          header: t("teamMembersListing.conversationsThisMonth"),
          cell: (info: any) => (
            <span className="tw-ml-6 tw-text-black tw-text-sm tw-font-normal">
              {info.getValue() || "N/A"}
            </span>
          ),
        },
        {
          accessorFn: (row) =>
            row.avg_conversation_length
              ? `${Math.floor(row.avg_conversation_length / 60)}:${String(
                  Math.floor(row.avg_conversation_length % 60),
                ).padStart(2, "0")} min`
              : "N/A",
          id: "avg_conversation_length",
          header: t("teamMembersListing.avgConversationLength"),
          cell: (info: any) => (
            <span className="tw-ml-6 tw-text-black tw-text-sm tw-font-normal">
              {info.getValue() || "N/A"}
            </span>
          ),
        },
        {
          accessorKey: "actions",
          header: "",
          cell: (info: any) => {
            const userId = info.row.original.id;
            return (
              <span
                className="tw-flex tw-gap-3"
                onClick={(e) => e.stopPropagation()}
              >
                {isContactPerson && companyId && (
                  <button
                    className="hover:tw-text-blue-800"
                    onClick={() => {
                      if (isContactPerson && companyId) {
                        window.location.href = `/companies/${companyId}/edit`;
                      }
                    }}
                  >
                    <PencilIcon className="tw-h-5 tw-w-5" />
                  </button>
                )}
                <button
                  onClick={() => openDeleteDialog(userId)}
                  className="hover:tw-text-red-800"
                >
                  <TrashIcon className="tw-h-5 tw-w-5" />
                </button>
              </span>
            );
          },
        },
      ];
    } else {
      baseColumns = [
        {
          accessorKey: "name",
          header: t("common.name"),
          cell: (info: any) => {
            const member = info.row.original;
            const avatar = member.avatar
              ? `${member.avatar}`
              : "/img/avatar.png";

            return (
              <span className="tw-flex tw-items-center tw-gap-2 tw-text-black">
                <img
                  src={avatar}
                  alt="User Avatar"
                  className="tw-w-8 tw-h-8 tw-rounded-full tw-border tw-border-gray-300"
                />
                <span>{info.getValue()}</span>
              </span>
            );
          },
        },
        {
          accessorKey: "number_of_conversations",
          header: t("teamMembersListing.numberOfConversations"),
          cell: (info: any) => (
            <span className="tw-text-[#344054] tw-ml-12">
              {info.getValue()}
            </span>
          ),
        },
        {
          accessorKey: "avg_score",
          header: t("teamMembersListing.avgScore"),
          cell: (info: any) => (
            <span className="tw-bg-gray-100 tw-text-[#344054] tw-px-3 tw-py-1 tw-rounded-full tw-text-sm tw-font-semibold tw-inline-block tw-w-14 tw-text-center">
              {info.getValue() || "N/A"}
            </span>
          ),
        },
        {
          accessorKey: "created_at",
          header: t("teamMembersListing.memberSince"),
          cell: (info: any) => (
            <span className="tw-text-[#344054]">
              {format(
                new Date(info.getValue()),
                i18n.language === "en" ? "MMM d, yyyy" : "d MMM, yyyy",
              )}
            </span>
          ),
        },
        {
          accessorKey: "actions",
          header: "",
          cell: (info: any) => {
            const userId = info.row.original.id;
            return (
              <span
                className="tw-flex tw-gap-3"
                onClick={(e) => e.stopPropagation()}
              >
                {isContactPerson && companyId && (
                  <button
                    className="hover:tw-text-blue-800"
                    onClick={() => {
                      if (isContactPerson && companyId) {
                        window.location.href = `/companies/${companyId}/edit`;
                      }
                    }}
                  >
                    <PencilIcon className="tw-h-5 tw-w-5" />
                  </button>
                )}
                <button
                  onClick={() => openDeleteDialog(userId)}
                  className="hover:tw-text-red-800"
                >
                  <TrashIcon className="tw-h-5 tw-w-5" />
                </button>
              </span>
            );
          },
        },
      ];
    }

    // Insert selection column at the beginning
    return [selectionColumn, ...baseColumns];
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

  // Add a function to handle selected rows actions if needed
  const handleBulkAction = () => {
    setIsBulkDelete(true);
    setIsDeleteDialogOpen(true);
  };

  const deleteUser = async () => {
    const user_ids = isBulkDelete
      ? Object.keys(rowSelection)
          .map((index) => teamMembers[parseInt(index)])
          .filter(Boolean)
          .map((user) => user?.id)
      : selectedUserId
        ? [selectedUserId]
        : [];

    if (user_ids.length === 0) return;
    try {
      const response = await fetch("/api/user", {
        method: "DELETE",
        headers,
        body: JSON.stringify({ user_ids }),
      });

      if (response.ok) {
        toast.success(t("successMessages.teamMemberDeleted"));
        fetchTeamMembers();
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || "Failed to delete team member");
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error(t("errorMessages.somethingWentWrong"));
    } finally {
      closeDeleteDialog();
      setIsBulkDelete(false);
      setRowSelection({});
    }
  };

  // Count selected rows
  const selectedCount = Object.keys(rowSelection).length;

  return (
    <>
      <ToastContainer />
      {!settingsPage && (
        <div className="tw-mb-4 tw-mt-4">
          <div className="tw-flex tw-items-center tw-justify-between tw-mb-4">
            <h1 className="tw-text-xl tw-font-medium tw-text-gray-900">
              {t("common.myTeam")}
            </h1>
            <div className="tw-ml-auto tw-flex tw-gap-4">
              <button
                onClick={openInviteDialog}
                className="tw-flex tw-items-center tw-gap-2 tw-bg-white tw-text-black tw-rounded-full tw-h-10 tw-px-5 tw-font-medium tw-text-[0.875rem] tw-border tw-border-gray-400 hover:tw-bg-gray-200"
              >
                <UserPlusIcon className="tw-w-5 tw-h-5" />
                {t("teamMembersListing.inviteMember")}
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className="tw-bg-white tw-rounded-2xl tw-font-inter tw-p-0"
        style={{
          boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <div className="tw-flex tw-flex-col sm:tw-flex-row tw-items-center sm:tw-items-start tw-justify-center sm:tw-justify-between tw-p-4 tw-border-b tw-border-gray-200">
          <div className="tw-flex tw-items-center tw-gap-2">
            <h2 className="tw-font-medium tw-text-lg tw-text-gray-900">
              {t("teamMembersListing.teamMembers")}
            </h2>
            {settingsPage && (
              <span className="tw-bg-[#EFF2FF] tw-text-[#5870F6] tw-text-xs tw-font-medium tw-px-3 tw-py-1 tw-rounded-full">
                {totalRecords} {t("common.users")}
              </span>
            )}
            {selectedCount > 0 && (
              <span className="tw-bg-indigo-100 tw-text-indigo-800 tw-text-xs tw-font-medium tw-px-3 tw-py-1 tw-rounded-full">
                {selectedCount} {t("common.selected")}
              </span>
            )}
          </div>
          <div className="tw-w-auto tw-relative tw-mt-2 sm:tw-mt-0">
            <input
              type="text"
              className="tw-w-full tw-pl-4 tw-pr-4 tw-py-2 tw-rounded-3xl tw-bg-white tw-border tw-border-gray-400 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 tw-placeholder-gray-500"
              placeholder={t("teamMembersListing.searchForMembers")}
              value={filtering}
              onChange={(e) => {
                setFiltering(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        {/* Bulk action controls */}
        {selectedCount > 0 && (
          <div className="tw-bg-indigo-50 tw-p-2 tw-flex tw-justify-between tw-items-center tw-border-b tw-border-gray-200">
            <span className="tw-text-sm tw-text-gray-700">
              {selectedCount} {selectedCount === 1 ? "user" : "users"}{" "}
              {t("common.selected")}
            </span>
            <div className="tw-flex tw-gap-2">
              <button
                onClick={() => setRowSelection({})}
                className="tw-text-gray-600 tw-text-sm tw-px-3 tw-py-1 tw-rounded-2xl hover:tw-bg-gray-200"
              >
                {t("form.cancel")}
              </button>
              <button
                onClick={handleBulkAction}
                className="tw-bg-red-600 tw-text-white tw-text-sm tw-px-3 tw-py-1 tw-rounded-2xl hover:tw-bg-red-700"
              >
                {t("form.bulkDelete")}
              </button>
            </div>
          </div>
        )}

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
                              className={`tw-p-4 !tw-text-black tw-font-medium ${
                                header.column.id === "select" ? "tw-w-8" : ""
                              }`}
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
                        <tr
                          key={row.id}
                          className={`hover:tw-bg-gray-50 ${
                            !settingsPage ? "tw-cursor-pointer" : ""
                          } ${row.getIsSelected() ? "tw-bg-indigo-50" : ""}`}
                          onClick={() => handleRowClick(row)}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <td
                              key={cell.id}
                              className="tw-border-y tw-py-4 tw-px-4 tw-text-gray-500"
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
                  <span className="tw-flex tw-items-center tw-gap-1 tw-text-sm tw-text-black">
                    <span className="tw-text-black">{t("common.page")}</span>
                    <span className="tw-text-black">
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
                  {t("teamMembersListing.noTeamMembersFound")}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Invite Member Dialog */}
      <InviteMemberDialog
        isOpen={isDialogOpen}
        onClose={closeInviteDialog}
        onSuccess={showSuccessToast}
        maxSubscriptionsLimit={maxSubscriptionsLimit}
        totalPresentSubscriptions={totalPresentSubscriptions}
      />
      <DeleteUserDialog
        isOpen={isDeleteDialogOpen}
        onClose={closeDeleteDialog}
        onConfirm={deleteUser}
        bulkDelete={isBulkDelete}
      />
    </>
  );
}

export default TeamMembersListing;
