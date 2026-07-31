import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  useReactTable,
  flexRender,
  getSortedRowModel,
} from "@tanstack/react-table";
import { PencilIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  EllipsisVerticalIcon,
} from "@heroicons/react/24/solid";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/MaterialTailwind";
import { toast, ToastContainer } from "react-toastify";
import { useUserRole } from "@/hooks/useUserRole";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import { format } from "date-fns";
import { useBreadcrumb } from "@/context/BreadcrumbContext";
import { useTranslation } from "react-i18next";

export function EntityListing({ entityType }) {
  const {t} = useTranslation('common');
   const { i18n } = useTranslation();
  // Determine entity properties based on type
  const entityConfig = {
    categories: {
      singularName: t("categoriesListing.category"),
      pluralName: t("developments.categories"),
      apiEndpoint: "/api/categories",
      apiType: "GET_CATEGORIES",
      routeBase: "/developments/categories",
    },
    tags: {
      singularName: t("categoriesListing.tag"),
      pluralName: t("common.tags"),
      apiEndpoint: "/api/tags",
      apiType: "GET_TAGS",
      routeBase: "/developments/tags",
    },
  }[entityType];

  const { singularName, pluralName, apiEndpoint, apiType, routeBase } =
    entityConfig;

  const [entities, setEntities] = useState([]);
  const [filtering, setFiltering] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [sorting, setSorting] = useState([]);
  const router = useRouter();
  const userRole = useUserRole();
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedEntityId, setSelectedEntityId] = useState(null);
  const { setBreadcrumbs } = useBreadcrumb();

  // set custom breadcrumbs for the page
  useEffect(() => {
    if (userRole) {
      setBreadcrumbs([
        {
          label: "Developments",
          href: "/developments/library",
        },
        {
          label: entityType === "categories" ? "Categories" : "Tags",
          href: "#",
        },
      ]);
    }
  }, [userRole]);

  useEffect(() => {
    if (userRole !== undefined && userRole !== null) {
      setRoleLoaded(true);
    }
  }, [userRole]);

  const headers = getAuthHeaders();

  const handleNewEntityBtnClick = () => {
    router.push(`${routeBase}/new`);
  };

  useEffect(() => {
    if (filtering.length >= 2 || filtering.length === 0) {
      const timer = setTimeout(() => {
        setPage(1);
        if (userRole) {
          fetchEntities();
        }
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [filtering]);

  useEffect(() => {
    if (userRole && page && pageSize) {
      fetchEntities();
    }
  }, [userRole, page, pageSize, sorting, i18n.language]);

  const fetchEntities = async () => {
    try {
      let sortParams = "";
      if (sorting.length > 0) {
        const sortColumn = sorting[0].id;
        const sortDirection = sorting[0].desc ? "desc" : "asc";
        const columnMapping = {
          name: "name",
          slug: "slug",
        };

        const apiSortColumn = columnMapping[sortColumn] || sortColumn;
        sortParams = `&sort_col=${apiSortColumn}&sort_dir=${sortDirection}`;
      }

      const response = await fetch(
        `${apiEndpoint}?page=${page}&per_page=${pageSize}&search=${filtering}&type=${apiType}&lang_code=${i18n.language}`,
        {
          method: "GET",
          headers,
        }
      );

      const result = await response.json();
      if (!response.ok) {
        console.error(
          `Error fetching ${pluralName.toLowerCase()}:`,
          result.message
        );
        setIsLoading(false);
        return;
      }

      if (result.data) {
        setEntities(result.data.records);
        setTotalPages(result.data.pagination.total_pages);
      }
    } catch (error) {
      console.error(`Error fetching ${pluralName.toLowerCase()}:`, error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = useCallback((entityId) => {
    router.push(`${routeBase}/${entityId}/edit`);
  }, [router, routeBase]);

  const openDeleteDialog = useCallback((e, entityId) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedEntityId(entityId);
    setIsDialogOpen(true);
  }, []);

 const columns = useMemo(() => [
      {
        accessorFn: (row) => row.name,
        id: "name",
        header: t("common.name"),
        cell: (info) => info.getValue(),
      },
      {
        accessorFn: (row) => row.status,
        id: "status",
        header: t("categoriesListing.status"),
        cell: (info) => {
          return <span className="tw-capitalize">{t(`statusDropdown.${info.getValue()?.toLowerCase()}`)}</span>;
        },
      },
      {
        accessorFn: (row) => row.created_at,
        id: "created_at",
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

            return i18n.language === 'en'
              ? `${translatedMonth} ${day}, ${year}, ${time}`
              : `${day} ${translatedMonth}, ${year}, ${time}`;
          })();

          return (
            <span className="tw-text-sm tw-text-black">{formattedDate}</span>
          );
        },
      },
      {
        accessorKey: "actions",
        header: t("common.actions"),
        cell: (info) => {
          const entityId = info.row.original.id;
          return (
              <Menu as="span" className="tw-relative">
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
                        onClick={() => handleEditClick(entityId)}
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
                        onClick={(e) => openDeleteDialog(e, entityId)}
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
  ], [t, handleEditClick, openDeleteDialog]);

  // const columns = getColumns();

  const table = useReactTable({
    data: entities,
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

  const handleDeleteEntity = async () => {
    try {
      const response = await fetch(`${apiEndpoint}/${selectedEntityId}`, {
        method: "DELETE",
        headers,
      });

      if (response.ok) {
        toast.success(`${t('successMessages.elementDeletedSuccessfully', { element: singularName })}`);
        fetchEntities();
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || `${t('errorMessages.failedToDeleteElement', { element: singularName })}.`);
      }
    } catch (error) {
      toast.error(t("errorMessages.somethingWentWrong"));
    } finally {
      setIsDialogOpen(false);
    }
  };


  return (
    <>
      <ToastContainer />
      {/* Header Section */}
      <div className="tw-mb-4 tw-mt-4">
        <div className="tw-flex tw-flex-col md:tw-flex-row tw-items-center tw-justify-center md:tw-justify-between tw-mb-4 tw-gap-3 text-center">
          <h1 className="tw-text-xl tw-font-medium tw-text-gray-900">
            {pluralName}
          </h1>
          <button
            onClick={handleNewEntityBtnClick}
            className="tw-flex tw-items-center tw-gap-2 btn-bg-blue tw-text-white tw-rounded-full tw-h-10 tw-px-5 tw-font-medium tw-text-[0.875rem] hover:tw-bg-blue-700"
          >
            <PlusIcon className="tw-w-5 tw-h-5" />
            {t('common.newElement', { element: singularName })}
          </button>
        </div>
      </div>

      {/* Table Card */}
      <div className="tw-bg-white tw-rounded-2xl tw-font-inter tw-p-0" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)" }}>
        {/* Header Section */}
        <div className="tw-flex tw-flex-col md:tw-flex-row tw-items-center md:tw-items-center tw-justify-center md:tw-justify-between tw-gap-3 tw-p-4 tw-border-b tw-border-gray-200 tw-text-center md:tw-text-left">
          <h2 className="tw-font-medium tw-text-gray-900">
            {t('categoriesListing.recentElement', {element: pluralName })}
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
              placeholder={`${t('categoriesListing.searchForElement', {element: pluralName.toLowerCase()})}`}
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
                    table.getRowModel().rows.map((row) => (
                      <tr
                        key={row.id}
                        className="hover:tw-bg-gray-50 tw-cursor-pointer"
                        onClick={(e) => {
                          // Only redirect if NOT clicking inside the actions cell
                          if (
                            !(e.target as HTMLElement).closest('.actions-cell')
                          ) {
                            handleEditClick(row.original.id);
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
                    <tr>
                      <td
                        colSpan={columns.length}
                        className="tw-text-center tw-py-10"
                      >
                        <div className="tw-flex tw-flex-col tw-items-center tw-justify-center tw-gap-4">
                          <img
                            src="/img/conversation_empty.svg"
                            alt={`No ${pluralName}`}
                            className="tw-w-[8.625rem] tw-h-auto"
                          />
                          <p className="tw-text-lg tw-font-normal tw-text-gray-700">
                            {t('common.noElementsFound', { element: pluralName })}.
                          </p>
                          <button
                            onClick={handleNewEntityBtnClick}
                            className="tw-flex tw-items-center tw-gap-2 btn-bg-blue tw-text-white tw-rounded-full tw-h-10 tw-px-5 tw-font-medium tw-text-[0.875rem] hover:tw-bg-blue-700"
                          >
                            <PlusIcon className="tw-w-5 tw-h-5" />
                            {t('common.newElement', { element: singularName })}
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
              alt={`No ${pluralName}`}
              className="tw-w-[8.625rem] tw-h-auto"
            />
            <p className="tw-text-lg tw-font-normal tw-text-gray-700">
              {t('common.noElementsFound', { element: pluralName })}.
            </p>
            <button
              onClick={handleNewEntityBtnClick}
              className="tw-flex tw-items-center tw-gap-2 btn-bg-blue tw-text-white tw-rounded-full tw-h-10 tw-px-5 tw-font-medium tw-text-[0.875rem] hover:tw-bg-blue-700"
            >
              <PlusIcon className="tw-w-5 tw-h-5" />
              {t('common.newElement', { element: singularName })}
            </button>
          </div>
        )}
      </div>
      <DeleteConfirmDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onConfirm={handleDeleteEntity}
        entityName={singularName?.toLowerCase()}
      />
    </>
  );
}

export default EntityListing;
