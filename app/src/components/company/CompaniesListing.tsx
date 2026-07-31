"use client";
import React, { useEffect, useState } from "react";
import {
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  useReactTable,
  flexRender,
  getSortedRowModel,
} from "@tanstack/react-table";
import { PencilIcon, PlusIcon, TrashIcon, ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  EllipsisVerticalIcon,
} from "@heroicons/react/24/solid";
import { useRouter, useSearchParams } from "next/navigation";
import DateRangePicker from "@/components/DateRangePicker";

// Import our new components
import { Spinner } from "@/components/MaterialTailwind";
import { toast, ToastContainer } from "react-toastify";
import { useUserRole } from "@/hooks/useUserRole";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import DeleteConfirmDialog from "../DeleteConfirmDialog";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { TranscriptUploadModal } from "@/components/salesDashboards/TranscriptUploadModal";

export function CompaniesListing() {
  const [companies, setCompanies] = useState([]);
  const [filtering, setFiltering] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [dateRange, setDateRange] = useState([null, null]);
  const [isLoading, setIsLoading] = useState(true);
  const [sorting, setSorting] = useState([]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const userRole = useUserRole();
  const [roleLoaded, setRoleLoaded] = React.useState(false); // Track if userRole is set
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectCompanyId, setSelectCompanyId] = useState<number | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadPreselectedCompany, setUploadPreselectedCompany] = useState<{ id: string | number; title: string } | null>(null);
  const { t, i18n } = useTranslation('common');
  React.useEffect(() => {
    if (userRole !== undefined && userRole !== null) {
      setRoleLoaded(true);
    }
  }, [userRole]);

  const headers = getAuthHeaders();

  const handleNewConvBtnClick = () => {
    router.push("/companies/new");
  };

  const handleEditClick = (e: any, companyId: String) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/companies/${companyId}/edit`);
  };

  useEffect(() => {
    if (filtering.length >= 2 || filtering.length === 0) {
      const timer = setTimeout(() => {
        setPage(1); // Reset to page 1 when search changes
        if (userRole) {
          fetchCompanies();
        }
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [filtering, dateRange]);

  useEffect(() => {
    if (userRole && page && pageSize) {
      fetchCompanies();
    }
  }, [userRole, page, pageSize, sorting]);

  const handleFilterChange = () => {
    setPage(1);
  };

  const fetchCompanies = async () => {
    try {
      // Construct sort parameters for API
      let sortParams = "";
      if (sorting.length > 0) {
        const sortColumn = sorting[0].id;
        const sortDirection = sorting[0].desc ? "desc" : "asc";

        // Map table column IDs to API sort column names
        const columnMapping = {
          title: "title",
          contact_person: "contact_person",
        };

        const apiSortColumn = columnMapping[sortColumn] || sortColumn;
        sortParams = `&sort_col=${apiSortColumn}&sort_dir=${sortDirection}`;
      }
      const [startDate, endDate] = dateRange;
      const formattedStartDate = startDate ? format(startDate, "yyyy-MM-dd") : "";
      const formattedEndDate = endDate ? format(endDate, "yyyy-MM-dd") : "";

      const response = await fetch(
        `/api/companies?page=${page}&per_page=${pageSize}&search=${filtering}${sortParams}&start_date=${formattedStartDate}&end_date=${formattedEndDate}`,
        {
          method: "GET",
          headers,
        }
      );

      const result = await response.json();
      if (!response.ok) {
        console.error("Error fetching companies:", result.message);
        setIsLoading(false);
        return;
      }

      if (result.data) {
        setCompanies(result.data.records);
        setTotalPages(result.data.pagination.total_pages);
      }
    } catch (error) {
      console.error("Error fetching companies:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getColumns = () => {
    const baseColumns = [
      {
        accessorFn: (row: any) => row.title,
        id: "title",
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
        accessorFn: (row: any) => row.contact_person,
        id: "contact_person",
        header: ({ column }) => (
          <span
            className="tw-flex tw-items-center tw-cursor-pointer"
            onClick={() => column.toggleSorting()}
          >
            {t('companiesListing.contactPerson')}
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
            <span>{info.getValue()}</span>
          </span>
        ),
        enableSorting: true,
      },
      {
        accessorFn: (row: any) => row.email,
        id: "email",
        header: t("companiesListing.contactEmail"),
        cell: (info: any) => info.getValue(),
      },
      {
        accessorFn: (row: any) => row.phone,
        id: "phone",
        header: t("form.phoneNo"),
        cell: (info: any) => info.getValue(),
      },
      {
        accessorFn: (row: any) => row.notes,
        id: "notes",
        header: t("companiesListing.notes"),
        cell: (info: any) => info.getValue(),
      },
      {
        accessorFn: (row: any) => row.total_users,
        id: "total_users",
        header: t("common.users"),
        cell: (info: any) => (
          <span className="tw-bg-[#F2F4F7] tw-text-[#344054] tw-px-3 tw-py-1 tw-rounded-full tw-text-sm tw-font-semibold tw-inline-block tw-w-14 tw-text-center">
            {info.getValue()}
          </span>
        ),
      },
      {
        accessorKey: "actions",
        header: t("common.actions"),
        cell: (info: any) => {
          const companyId = info.row.original;

          return (
            <Menu as="div" className="tw-relative">
              <MenuButton className="tw-p-1 tw-rounded-full hover:tw-bg-gray-100 focus:tw-outline-none">
                <EllipsisVerticalIcon className="tw-w-5 tw-h-5 tw-text-gray-600" />
              </MenuButton>
              <MenuItems
                anchor="bottom"
                className="tw-absolute tw-right-0 tw-z-10 tw-mt-2 tw-w-32 tw-origin-top-right tw-rounded-md tw-bg-white tw-shadow-lg tw-ring-1 tw-ring-black tw-ring-opacity-5 tw-focus:outline-none"
              >
                <div className="tw-py-1">
                  <MenuItem>
                    {({ active }) => (
                      <button
                        onClick={(e) => handleEditClick(e, companyId.id)}
                        className={`tw-flex tw-items-center tw-w-full tw-px-4 tw-py-2 tw-text-sm ${
                          active ? "tw-bg-gray-100" : ""
                        }`}
                      >
                        <PencilIcon className="tw-w-4 tw-h-4 tw-mr-2 tw-text-blue-500" />
                        {t('form.edit')}
                      </button>
                    )}
                  </MenuItem>
                  <MenuItem>
                    {({ active }) => (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setUploadPreselectedCompany({ id: companyId.id, title: companyId.title });
                          setUploadModalOpen(true);
                        }}
                        className={`tw-flex tw-items-center tw-w-full tw-px-4 tw-py-2 tw-text-sm ${
                          active ? "tw-bg-gray-100" : ""
                        }`}
                      >
                        <ArrowUpTrayIcon className="tw-w-4 tw-h-4 tw-mr-2 tw-text-[#5971F6]" />
                        Transcript
                      </button>
                    )}
                  </MenuItem>
                  <MenuItem>
                    {({ active }) => (
                      <button
                        onClick={(e) => openDeleteDialog(e, companyId.id)}
                        className={`tw-flex tw-items-center tw-w-full ${i18n?.language === 'nl' ? 'tw-px-3' : 'tw-px-4'} tw-py-2 tw-text-sm ${
                          active ? "tw-bg-gray-100" : ""
                        }`}
                      >
                        <TrashIcon className="tw-w-4 tw-h-4 tw-mr-2 tw-text-red-500" />
                        {t('form.delete')}
                      </button>
                    )}
                  </MenuItem>
                </div>
              </MenuItems>
            </Menu>
          );
        },
      },
    ];

    return baseColumns;
  };

  const columns = getColumns();

  const table = useReactTable({
    data: companies,
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

  const handleDeleteCompany = async () => {
    const companyId = selectCompanyId;

    try {
      const response = await fetch(`/api/companies/${companyId}`, {
        method: "DELETE",
        headers,
      });

      if (response.ok) {
        toast.success(t("successMessages.companyDeleted"));
        fetchCompanies();
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || `${t("errorMessages.failedToDeleteCompany")}`);
      }
    } catch (error) {
      toast.error(t("errorMessages.somethingWentWrong"));
    } finally {
      setIsDialogOpen(false);
    }
  };

  const openDeleteDialog = (e: any, companyId: number) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectCompanyId(companyId);
    setIsDialogOpen(true);
  };

  return (
    <>
      <ToastContainer />
      {/* Header Section (Separate) */}
      <div className="tw-mb-4 tw-mt-4">
      <div className="tw-flex tw-flex-col md:tw-flex-row tw-items-center tw-justify-center md:tw-justify-between tw-mb-4 tw-gap-3 text-center">
      <h1 className="tw-text-xl tw-font-medium tw-text-gray-900">
            {t('companiesListing.companies')}
          </h1>
          <div className="tw-flex tw-items-center tw-gap-2">
            <button
              onClick={() => { setUploadPreselectedCompany(null); setUploadModalOpen(true); }}
              className="tw-flex tw-items-center tw-gap-2 tw-text-[#5971F6] tw-border tw-border-[#5971F6] tw-rounded-full tw-h-10 tw-px-5 tw-font-medium tw-text-[0.875rem] hover:tw-bg-blue-50"
            >
              <ArrowUpTrayIcon className="tw-w-5 tw-h-5" />
              Transcript uploaden
            </button>
            <button
              onClick={handleNewConvBtnClick}
              className="tw-flex tw-items-center tw-gap-2 btn-bg-blue tw-text-white tw-rounded-full tw-h-10 tw-px-5 tw-font-medium tw-text-[0.875rem] hover:tw-bg-blue-700"
            >
              <PlusIcon className="tw-w-5 tw-h-5" />
              {t('companiesListing.newCompany')}
            </button>
          </div>
        </div>
        {/* <div className="tw-flex tw-justify-center md:tw-justify-end">
        <DateRangePicker
              dateRange={dateRange}
              setDateRange={setDateRange}
              onFilterApplied={handleFilterChange}
            />
        </div> */}
      </div>

      {/* Table Card */}
      <div className="tw-bg-white tw-rounded-2xl tw-font-inter tw-p-0" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)" }}>
        {/* Header Section */}
        <div className="tw-flex tw-flex-col md:tw-flex-row tw-items-start md:tw-items-center tw-justify-between tw-gap-3 tw-p-4 tw-border-b tw-border-gray-200">
          <h2 className="tw-font-medium tw-text-gray-900">
            {t('companiesListing.recentCompanies')}
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
              placeholder={t("companiesListing.searchForCompanies")}
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
                    table.getRowModel().rows.map((row) => (
                      <tr
                        key={row.id}
                        className="hover:tw-bg-gray-50 tw-cursor-pointer"
                        onClick={(e) => {
                          // Only redirect if NOT clicking inside the actions cell
                          // Find the actions cell by class or index
                          if (
                            !(e.target as HTMLElement).closest('.actions-cell')
                          ) {
                            handleEditClick(e, row.original.id);
                          }
                        }}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            className={`tw-border-y tw-py-4 tw-px-4 ${
                              cell.column.id === table.getAllColumns()[1].id
                                ? "tw-font-bold tw-text-black"
                                : "!tw-text-black tw-text-xl"
                            }${cell.column.id === "actions" ? " actions-cell" : ""}`}
                          >
                            <span className="tw-leading-[1.25rem] tw-font-normal tw-text-sm">
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
                    // Show "No Companies Found" when there's no data
                    <tr>
                      <td
                        colSpan={columns.length}
                        className="tw-text-center tw-py-10"
                      >
                        <div className="tw-flex tw-flex-col tw-items-center tw-justify-center tw-gap-4">
                          <img
                            src="/img/conversation_empty.svg"
                            alt="No Companies"
                            className="tw-w-[8.625rem] tw-h-auto"
                          />
                          <p className="tw-text-lg tw-font-normal tw-text-gray-700">
                            {t('companiesListing.noCompaniesFound')}
                          </p>
                          <button
                            onClick={handleNewConvBtnClick}
                            className="tw-flex tw-items-center tw-gap-2 btn-bg-blue tw-text-white tw-rounded-full tw-h-10 tw-px-5 tw-font-medium tw-text-[0.875rem] hover:tw-bg-blue-700"
                          >
                            <PlusIcon className="tw-w-5 tw-h-5" />
                            {t('companiesListing.newCompany')}
                          </button>
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
                <span>{t('common.page')}</span>
                <span>{page} {t('common.of')} {totalPages}</span>
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
              alt="No Companies"
              className="tw-w-[8.625rem] tw-h-auto"
            />
            <p className="tw-text-lg tw-font-normal tw-text-gray-700">
              {t('companiesListing.noCompaniesFound')}
            </p>
            <button
              onClick={handleNewConvBtnClick}
              className="tw-flex tw-items-center tw-gap-2 btn-bg-blue tw-text-white tw-rounded-full tw-h-10 tw-px-5 tw-font-medium tw-text-[0.875rem] hover:tw-bg-blue-700"
            >
              <PlusIcon className="tw-w-5 tw-h-5" />
              {t('companiesListing.newCompany')}
            </button>
          </div>
        )}
      </div>
      <TranscriptUploadModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        preselectedCompany={uploadPreselectedCompany}
      />
      <DeleteConfirmDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onConfirm={handleDeleteCompany}
        entityName={t("common.company")}
      />
    </>
  );
}

export default CompaniesListing;
