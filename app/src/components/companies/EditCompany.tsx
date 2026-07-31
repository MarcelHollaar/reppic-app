"use client";
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  memo,
  use,
} from "react";
import { Button, Card, CardFooter, Typography } from "@material-tailwind/react";
import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
} from "@heroicons/react/24/solid";
import { Spinner } from "@/components/MaterialTailwind";
import {
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  useReactTable,
  flexRender,
} from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { toast, ToastContainer } from "react-toastify";
import authMiddleware from "@/middleware/authMiddleware";
import { useUserRole } from "@/hooks/useUserRole";
import { USER_ROLE } from "@/configs/constants";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import { PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import { format } from "date-fns";
import CompanyUsersImport from "./CompanyUsersImport";
import CompanyUsersInvite from "./CompanyUsersInvite";
import { object } from "zod";
import { useBreadcrumb } from "@/context/BreadcrumbContext";
import { loggedInUser } from "@/hooks/useUserRole";
import { useTranslation } from "react-i18next";
import DeleteConfirmDialog from "../DeleteConfirmDialog";
import RoleDropdown from "../RoleDropdown";
// Create memoized row components to prevent unnecessary rerenders
const EditableCell = memo(({ value, onChange, placeholder }) => {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={onChange}
      className="tw-w-full tw-px-4 tw-py-2 tw-rounded-3xl tw-bg-white tw-border tw-border-gray-400 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 tw-font-normal tw-text-black tw-placeholder-gray-500"
    />
  );
});

const EditableSelect = memo(({ value, onChange, t }: any) => {
  return (
    <RoleDropdown value={value} onChange={onChange} />
  );
});

const TableRow = memo(
  ({ row, editingRowId, updateRow, handleDeleteRow, setEditingRowId, t, setSelectUserId, setIsDialogOpen, i18n }: any) => {
    const isEditing = editingRowId === row.original.id;

    const handleEditToggle = useCallback(() => {
      setEditingRowId(isEditing ? null : row.original.id);
    }, [isEditing, row.original.id, setEditingRowId]);

    const openDeleteDialog = () => {
      setSelectUserId(row.original.id);
      setIsDialogOpen(true);
    };
    const handleDelete = useCallback(() => {
      handleDeleteRow(row.original.id);
    }, [handleDeleteRow, row.original.id]);

    const updateFirstName = useCallback(
      (e) => updateRow(row.original.id, "first_name", e.target.value),
      [updateRow, row.original.id]
    );

    const updateLastName = useCallback(
      (e) => updateRow(row.original.id, "last_name", e.target.value),
      [updateRow, row.original.id]
    );

    const updateEmail = useCallback(
      (e) => updateRow(row.original.id, "email", e.target.value),
      [updateRow, row.original.id]
    );

    const updateRole = useCallback(
      (value: string) => updateRow(row.original.id, "role", value),
      [updateRow, row.original.id]
    );

    return (
      <tr>
        <td className="tw-p-4 tw-text-sm">
          {isEditing ? (
            <EditableCell
              value={row.original.first_name}
              onChange={updateFirstName}
              placeholder={t("form.enterFirstName")}
            />
          ) : (
            <span className="tw-text-sm !tw-text-black tw-font-medium">
              {row.original.first_name}
            </span>
          )}
        </td>
        <td className="tw-p-4 tw-text-sm">
          {isEditing ? (
            <EditableCell
              value={row.original.last_name}
              onChange={updateLastName}
              placeholder={t("form.enterLastName")}
            />
          ) : (
            <span className="tw-text-sm !tw-text-black">
              {row.original.last_name}
            </span>
          )}
        </td>
        <td className="tw-p-4 tw-text-sm">
          {isEditing ? (
            <EditableCell
              value={row.original.email}
              onChange={updateEmail}
              placeholder={t("addCompany.enterEmail")}
            />
          ) : (
            <span className="!tw-text-black tw-text-sm">
              {row.original.email}
            </span>
          )}
        </td>
        <td className="tw-p-4 tw-text-sm" style={{ width: isEditing ? "163px" : "auto"}}>
          {isEditing ? (
            <EditableSelect value={row.original.role} onChange={updateRole} t={t}/>
          ) : (
            <span className="tw-text-sm tw-capitalize !tw-text-black">
              {t(`common.${row.original.role?.toLowerCase()}`, row.original.role)}
            </span>
          )}
        </td>
        <td className="tw-p-4 tw-text-sm">
          <span className="tw-text-sm !tw-text-black">
            {(() => {
              const date = new Date(row.original.created_at);
              const month = format(date, "MMM");
              const day = format(date, "dd");
              const year = format(date, "yyyy");
              const translatedMonth = t(`months.${month.toLowerCase()}`, month);

              return i18n.language === 'en'
                ? `${translatedMonth} ${day}, ${year}`
                : `${day} ${translatedMonth}, ${year}`;
            })()}
          </span>
        </td>
        <td className="tw-p-4 tw-text-sm">
          <p className="tw-flex tw-gap-3">
            <button
              className="tw-p-2 tw-rounded-lg tw-border tw-border-gray-200 tw-bg-white hover:tw-border-blue-500"
              onClick={handleEditToggle}
            >
              <PencilSquareIcon className="tw-h-5 tw-w-5 tw-text-black" />
            </button>
            <button
              className="tw-p-2 tw-rounded-lg tw-border tw-border-gray-200 tw-bg-white hover:tw-border-red-500"
              onClick={openDeleteDialog}
            >
              <TrashIcon className="tw-h-5 tw-w-5 tw-text-[#FF3B30]" />
            </button>
          </p>
        </td>
      </tr>
    );
  }
);

const TabButton = memo(({ isActive, onClick, label, count }) => (
  <button
    onClick={onClick}
    className={`tw-relative tw-flex tw-items-center tw-gap-2 tw-rounded-full tw-px-4 tw-py-1.5 tw-font-medium tw-transition ${
      isActive ? "tw-bg-[#4E6EF2] tw-text-white" : "tw-text-gray-600"
    }`}
  >
    {label}
    <span
      className={`tw-ml-1 tw-rounded-full tw-px-2 tw-py-0.5 tw-text-xs tw-font-semibold ${
        isActive
          ? "tw-bg-[#1F3BB3] tw-text-white"
          : "tw-bg-gray-200 tw-text-gray-800"
      }`}
    >
      {count}
    </span>
  </button>
));

export function EditCompany({ companyId }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [editingRowId, setEditingRowId] = useState(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [existingUsers, setExistingUsers] = useState([]);
  const [removedUsers, setRemovedUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [company, setCompany] = useState(object({}));
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const { setBreadcrumbs } = useBreadcrumb();
  const [isDragActive, setIsDragActive] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 10,
    total_pages: 1,
    total_records: 0,
  });
  const [selectedTab, setSelectedTab] = useState('all');
  const [isUserLimitReached, setIsUserLimitReached] = useState(false);
  const user = loggedInUser();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [ selectUserId, setSelectUserId ] = useState('');
  const isContactPerson = user?.is_company_contact_manager;
  const { t, i18n } = useTranslation("common");
  const userRole = useUserRole();
  // Calculate counts for display
  const userCount = existingUsers
    .filter((u) => u.role === "user")
    .filter((u) => !removedUsers.includes(u.id)).length;

  const managerCount = existingUsers
    .filter((u) => u.role === "manager")
    .filter((u) => !removedUsers.includes(u.id)).length;

  const [formData, setFormData] = useState({
    title: "",
    contactPerson: "",
    email: "",
    phone: "",
    notes: "",
    maxUsers: 0,
  });

  // Validation errors state
  const [errors, setErrors] = useState({
    title: "",
    email: "",
    phone: "",
    contactPerson: "",
    maxUsers: "",
  });

  // Fetch company details and users
  useEffect(() => {
    if (companyId) {
      fetchCompanyDetails();
      fetchCompanyUsers(1);
    }
  }, [companyId]);

  // Handle page change for users
  useEffect(() => {
    if (companyId) {
      fetchCompanyUsers(page);
    }
  }, [page]);

  useEffect(() => {
    setTimeout(() => {
      const companyAdded = localStorage.getItem("companyAdded");
      if (companyAdded === "true") {
        toast.success(t("successMessages.companyCreated"));
        localStorage.removeItem("companyAdded");
      }
    }, 0);
  }, []);

  const fetchCompanyDetails = async () => {
    try {
      const headers = getAuthHeaders();
      const response = await fetch(`/api/companies/${companyId}`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(t("errorMessages.failedToFetchCompany"));
      }

      const result = await response.json();
      const company = result.data;
      setCompany(company);

      setFormData({
        title: company.title || "",
        contactPerson: company.contact_person || "",
        email: company.email || "",
        phone: company.phone || "",
        notes: company.notes || "",
        maxUsers: company.max_users || "",
      });
      // set custom breadcrumbs for the page
      setBreadcrumbs( [
        { label: isContactPerson ? "My Company" : "Companies", href: isContactPerson ? "#" : "/companies" },
        {
          label: company.title,
          href: isContactPerson ? "#" : `/companies/${companyId}`,
        },
      ]);
    } catch (error) {
      console.error("Error fetching company details:", error);
      toast.error(t("errorMessages.failedToFetchCompany"));
    }
  };



  const fetchCompanyUsers = async (pageNum = 1) => {
    try {
      // setFetchingData(true);
      const headers = getAuthHeaders();
      const response = await fetch(
        `/api/companies/users/${companyId}?page=${pageNum}&per_page=10`,
        {
          headers,
        }
      );

      if (!response.ok) {
        throw new Error(t("errorMessages.failedToFetchCompanyUsers"));
      }

      const result = await response.json();

      // Map API data to our format
      const formattedUsers = result.data.records.map((user) => ({
        id: user.id,
        first_name: user.name.split(" ")[0] || "",
        last_name: user.name.split(" ").slice(1).join(" ") || "",
        email: user.email,
        role: user.role,
        created_at: user.created_at
          ? format(new Date(user.created_at), i18n.language === 'en' ? "MMM dd, yyyy" : "dd MMM, yyyy")
          : "",
        isExisting: true,
      }));

      setExistingUsers(formattedUsers);

      setPagination({
        page: result.data.pagination.page,
        per_page: result.data.pagination.per_page,
        total_pages: result.data.pagination.total_pages,
        total_records: result.data.pagination.total_records,
      });
      // setPage(result.data.pagination.page);
    } catch (error) {
      console.error("Error fetching company users:", error);
      toast.error(t("errorMessages.failedToFetchCompanyUsers"));
    } finally {
      setFetchingData(false);
    }
  };

  useEffect(() => {
    if (company && company.max_users) {
      setIsUserLimitReached(pagination.total_records >= formData.maxUsers);
    }
  }, [company, existingUsers, formData]);
  // Validation function
  const validateField = (field, value) => {
    let errorMessage = "";

    if (field === "title" && !value.trim()) {
      errorMessage = t("errorMessages.companyTitleRequired");
    } else if (field === "contactPerson" && !value.trim()) {
      errorMessage = t("errorMessages.contactPersonRequired");
    } else if (field === "email" && value.trim()) {
      // Only validate email if provided
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        errorMessage = t("errorMessages.pleaseEnterEmail");
      }
    } else if (field === "phone" && value.trim()) {
      if (!value.trim()) {
        errorMessage = t("errorMessages.phoneNumberRequired");
      } else if (!/^[0-9\-]+$/.test(value)) {
        errorMessage = t("errorMessages.phoneNumberInvalidFormat");
      } else if (value.replace(/[^0-9]/g, '').length > 20 || value.length > 20) {
        errorMessage = t("errorMessages.phoneNumberMaxLengthTwenty");
      }
    } else if (field === "maxUsers") {
      const num = Number(value);
      if (!value.trim()) {
        errorMessage = t("errorMessages.maximumSubscriptionAccountsRequired");
      } else if (!Number.isInteger(num) || num <= 0) {
        errorMessage = t("errorMessages.maximumSubscriptionAccountsMustBeNumber");
      }
    }

    setErrors((prevErrors) => ({ ...prevErrors, [field]: errorMessage }));
    return errorMessage === "";
  };

  const handleBackBtnClick = () => {
    router.push("/companies");
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let newValue = value;
    if (name === "phone") {
      // Only allow numbers and dashes, and max length 20
      newValue = newValue.replace(/[^0-9\-]/g, "").slice(0, 20);
    } else if (name === "maxUsers") {
      if (userRole !== USER_ROLE.SUPER_ADMIN) {
        toast.error(t("errorMessages.onlySuperAdminCanChangeMaxUsers"));
        return;
      }
      if (newValue < formData.maxUsers) {
        // If reducing max users, ensure no existing users exceed this limit
        const currentUserCount = existingUsers.filter(
          (user) => !removedUsers.includes(user.id)
        ).length;
        if (currentUserCount > newValue) {
          toast.error(t("errorMessages.maximumSubscriptionAccountsCannotBeLess"));
          return;
        }
      }
    }

    setFormData((prev) => ({ ...prev, [name]: newValue }));
    validateField(name, newValue);
  };

  const isFormValid = () => {
    // Check if title is present (required field)
    if (!formData.title.trim()) {
      setErrors((prev) => ({ ...prev, title: t("errorMessages.companyTitleRequired") }));
      return false;
    }

    // Validate email and phone if provided
    if (formData.email && !validateField("email", formData.email)) {
      return false;
    }

    if (formData.phone && !validateField("phone", formData.phone)) {
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isFormValid()) return;

    setLoading(true);

    try {
      const headers = getAuthHeaders();

      // Format data for API
      const payload = {
        title: formData.title,
        contact_person: formData.contactPerson,
        email: formData.email,
        phone: formData.phone,
        notes: formData.notes,
        max_users: parseInt(formData.maxUsers),
        // Include existing users (not removed)
        users: existingUsers
          .filter((user) => !removedUsers.includes(user.id))
          .map((user) => ({
            name: `${user?.first_name} ${user?.last_name}`.trim(),
            email: user?.email,
            role: user?.role,
            id: user.id,
          })),
        // Include IDs of removed users
        removed_users: removedUsers,
      };

      const response = await fetch(`/api/companies/${companyId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.message || `${t("errorMessages.failedToUpdateCompany")}`);
      }

      toast.success(t("successMessages.companyUpdated"));
    } catch (error) {
      console.error("Error updating company:", error);
      toast.error(
        error instanceof Error ? error?.message : `${t("errorMessages.failedToUpdateCompany")}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRow = (userId) => {
    // Find the user to remove by ID
    const userToRemove = existingUsers.find((user) => user.id === userId);
    if (userToRemove) {
      setRemovedUsers((prev) => [...prev, userToRemove.id]);
    }
    setIsDialogOpen(false);
  };

  const updateRow = useCallback((userId, key, value) => {
    setExistingUsers((prev) => {
      return prev.map((user) => {
        if (user.id === userId) {
          return { ...user, [key]: value };
        }
        return user;
      });
    });
  }, []);

  const setTabToManager = useCallback(
    () => setSelectedTab(USER_ROLE.MANAGER),
    []
  );
  const setTabToUser = useCallback(() => setSelectedTab(USER_ROLE.USER), []);
  const setTabToAll = useCallback(() => setSelectedTab('all'), []);


  // Filter users based on selected tab
  const filteredData = useMemo(() => {
    return existingUsers
      .filter((u) => selectedTab === 'all' || u.role === selectedTab)
      .filter((u) => !removedUsers.includes(u.id));
  }, [existingUsers, selectedTab, removedUsers]);

  const columns = useMemo(
    () => [
      {
        accessorKey: "first_name",
        header: t("form.firstName"),
      },
      {
        accessorKey: "last_name",
        header: t("form.lastName"),
      },
      {
        accessorKey: "email",
        header: t("form.email"),
      },
      {
        accessorKey: "role",
        header: t("common.role"),
      },
      {
        accessorKey: "created_at",
        header: t("categoriesListing.createdAt"),
      },
      {
        accessorKey: "actions",
        header: t("common.actions"),
      },
    ],
    [t]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    getFilteredRowModel: getFilteredRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  const showSuccessToast = (message: string) => {
    fetchCompanyUsers();
    toast.success(message);
  };

  const handleAddUser = useCallback(() => {
    const newId = Date.now();
    const newUser = {
      id: newId,
      first_name: "",
      last_name: "",
      email: "",
       role: selectedTab === 'all' ? USER_ROLE.USER : selectedTab,
    };

    setExistingUsers((prev) => [newUser, ...prev]); // Prepend to the beginning
    setEditingRowId(newId); // Start editing immediately
  }, [selectedTab]);

  const handleDeleteUser = () => {
    handleDeleteRow(selectUserId);
  }

  if (fetchingData) {
    return (
      <div className="tw-flex tw-justify-center tw-items-center tw-h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <>
      <ToastContainer />
      {/* Header Section */}
      {!isContactPerson && (
        <div className="tw-mt-4">
          <div className="tw-flex tw-flex-col md:tw-flex-row tw-items-center md:tw-items-center tw-justify-between tw-mb-0">
            <button
              onClick={handleBackBtnClick}
              className="tw-flex tw-items-center tw-gap-2 tw-text-[#1D49A7] tw-bg-blue-100 tw-rounded-full tw-h-10 tw-px-5 tw-font-medium tw-text-[0.875rem] hover:tw-bg-blue-200
              tw-text-center md:tw-text-left"
            >
              <ArrowLeftIcon className="tw-w-5 tw-h-5" />
              {t('companiesListing.companies')}
            </button>
          </div>
        </div>
      )}

      <div className="tw-flex tw-flex-col md:tw-flex-row tw-items-center md:tw-items-center tw-justify-between tw-my-4 tw-gap-3">
        <Typography
          variant="h3"
          className="!tw-font-medium tw-text-blue-gray-900 tw-text-center md:tw-text-left"
        >
          {t('companyEdit.editCompany')}
        </Typography>
      </div>


      {/* Main Card */}
      <Card className="tw-border tw-border-blue-gray-100 tw-shadow-sm tw-font-inter tw-bg-indigo-50 tw-p-6">
        <form onSubmit={handleSubmit}>
          <div className="tw-flex tw-flex-col lg:tw-flex-row tw-gap-8">
            {/* Left Column (Company Fields) */}
            <div className="tw-w-full lg:tw-w-1/2">
              <div className="tw-w-full lg:tw-w-full tw-flex tw-flex-col">
                {/* Company Title */}
                <div className="tw-w-full tw-mb-4">
                  <Typography
                    variant="h6"
                    className="!tw-font-semibold !tw-text-black tw-mb-2 tw-font-[system-ui]"
                  >
                    {t('addCompany.companyTitle')}
                  </Typography>
                  <input
                    type="text"
                    className="tw-w-full tw-px-4 tw-py-2 tw-rounded-3xl tw-bg-white tw-border tw-border-gray-400 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 tw-font-normal tw-text-black tw-placeholder-gray-500"
                    placeholder={t("addCompany.enterCompanyTitle")}
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                  />
                  {errors.title && (
                    <p className="tw-text-red-500 tw-text-sm tw-mt-1">
                      {errors.title}
                    </p>
                  )}
                </div>

                {/* Contact Person */}
                <div className="tw-w-full tw-mb-4">
                  <Typography
                    variant="h6"
                    className="!tw-font-semibold !tw-text-black tw-mb-2 tw-font-[system-ui]"
                  >
                    {t('companiesListing.contactPerson')}
                  </Typography>
                  <input
                    type="text"
                    className="tw-w-full tw-px-4 tw-py-2 tw-rounded-3xl tw-bg-white tw-border tw-border-gray-400 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 tw-font-normal tw-text-black tw-placeholder-gray-500"
                    placeholder={t("addCompany.enterContactPerson")}
                    name="contactPerson"
                    value={formData.contactPerson}
                    onChange={handleInputChange}
                  />
                  {errors.contactPerson && (
                    <p className="tw-text-red-500 tw-text-sm tw-mt-1">
                      {errors.contactPerson}
                    </p>
                  )}
                </div>

                {/* Email */}
                <div className="tw-w-full tw-mb-4">
                  <Typography
                    variant="h6"
                    className="!tw-font-semibold !tw-text-black tw-mb-2 tw-font-[system-ui]"
                  >
                    {t('form.email')}
                  </Typography>
                  <input
                    type="email"
                    className="tw-w-full tw-px-4 tw-py-2 tw-rounded-3xl tw-bg-white tw-border tw-border-gray-400 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 tw-font-normal tw-text-black tw-placeholder-gray-500"
                    placeholder={t("addCompany.enterEmail")}
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                  />
                  {errors.email && (
                    <p className="tw-text-red-500 tw-text-sm tw-mt-1">
                      {errors.email}
                    </p>
                  )}
                </div>

                {/* Phone Number */}
                <div className="tw-w-full tw-mb-4">
                  <Typography
                    variant="h6"
                    className="!tw-font-semibold !tw-text-black tw-mb-2 tw-font-[system-ui]"
                  >
                    {t('form.phoneNo')}
                  </Typography>
                  <input
                    type="tel"
                    className="tw-w-full tw-px-4 tw-py-2 tw-rounded-3xl tw-bg-white tw-border tw-border-gray-400 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 tw-font-normal tw-text-black tw-placeholder-gray-500"
                    placeholder={t("companyEdit.enterPhoneNumber")}
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    pattern="^[0-9\-]+$"
                    maxLength={20}
                    autoComplete="off"
                  />
                  {errors.phone && (
                    <p className="tw-text-red-500 tw-text-sm tw-mt-1">
                      {errors.phone}
                    </p>
                  )}
                </div>
                <div className="tw-w-sm tw-mb-4">
                  <Typography
                    variant="h6"
                    className="!tw-font-semibold !tw-text-black tw-mb-2 tw-font-[system-ui]"
                  >
                    {t('addCompany.maximumSubscriptionAccounts')}
                  </Typography>
                  <input
                    type="number"
                    className="tw-w-full tw-px-4 tw-py-2 tw-rounded-3xl tw-bg-white tw-border tw-border-gray-400 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 tw-font-normal tw-text-black tw-placeholder-gray-500"
                    placeholder={t("addCompany.enterMaximumSubscriptionAccounts")}
                    name="maxUsers"
                    value={formData.maxUsers}
                    onChange={handleInputChange}
                  />
                  {errors.maxUsers && (
                    <p className="tw-text-red-500 tw-text-sm tw-mt-1">
                      {errors.maxUsers}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column (Notes & File Upload) */}
            <div className="tw-w-full lg:tw-w-1/2">
              {/* Notes */}
              <div className="tw-w-full tw-mb-4">
                <Typography
                  variant="h6"
                  className="!tw-font-semibold !tw-text-black tw-mb-2 tw-font-[system-ui]"
                >
                  {t('companiesListing.notes')}
                </Typography>
                <textarea
                  className="tw-w-full tw-h-[5.125rem] tw-px-8 tw-py-4 !tw-rounded-[20px] tw-bg-white tw-border tw-border-gray-400 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 tw-font-normal tw-text-black tw-placeholder-gray-500"
                  placeholder={t("addCompany.enterAnyRelevantNotes")}
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                />
              </div>
              <CompanyUsersImport
                currentUsers={pagination.total_records}
                maxUserLmt={formData.maxUsers}
                company={company}
                onImportSuccess={showSuccessToast}
              />
            </div>
          </div>
        </form>
      </Card>

      <div className="tw-flex tw-flex-col sm:tw-flex-row tw-items-center sm:tw-items-start sm:tw-justify-between tw-px-0 tw-py-9 tw-gap-4 sm:tw-gap-0">
        {/* Heading */}
        <div className="tw-flex tw-items-center tw-justify-center sm:tw-justify-start tw-gap-2">
          <Typography
            color="blue-gray"
            className="!tw-font-medium !tw-text-3xl"
            variant="h1"
          >
            {t('common.subscriptions')}
          </Typography>
        </div>

        {/* Pills: Add User Button + Tabs */}
        <div className="tw-flex tw-flex-col sm:tw-flex-row tw-items-center tw-justify-center sm:tw-justify-start tw-gap-4">
          {/* Add User Button */}
          {/* <button
            onClick={handleAddUser}
            disabled={isUserLimitReached}
            className={`
                tw-flex tw-items-center tw-gap-2 tw-rounded-full tw-h-8 tw-px-5 
                tw-font-medium tw-text-[0.875rem]
                ${
                  isUserLimitReached
                    ? "tw-bg-gray-400 tw-text-white tw-cursor-not-allowed"
                    : "btn-bg-blue tw-text-white hover:tw-bg-blue-700"
                }
              `}
          >
            <PlusIcon className="tw-h-4 tw-w-4 tw-text-white" />
            <span className="tw-text-white">Add User</span>
          </button> */}

          {/* Tabs */}
          <div className="tw-inline-flex tw-rounded-full tw-bg-[#FFFFFF] tw-p-1 tw-text-sm">
              <TabButton
                isActive={selectedTab === 'all'}
                onClick={setTabToAll}
                label={t("addCompany.all")}
                count={managerCount + userCount}
              />
            <TabButton
              isActive={selectedTab === USER_ROLE.MANAGER}
              onClick={setTabToManager}
              label={t("common.managers")}
              count={managerCount}
            />
            <TabButton
              isActive={selectedTab === USER_ROLE.USER}
              onClick={setTabToUser}
              label={t("common.users")}
              count={userCount}
            />
          </div>
        </div>
      </div>

      <Card className="tw-border">
        <div className="tw-m-4">
          <button
            onClick={() => setIsInviteModalOpen(true)}
            disabled={isUserLimitReached}
            className={`
              tw-flex tw-items-center tw-gap-2 tw-rounded-full tw-h-10 tw-px-5 
              tw-font-medium tw-text-[0.875rem] 
              ${
                isUserLimitReached
                  ? "tw-bg-gray-400 tw-text-white tw-cursor-not-allowed"
                  : "btn-bg-blue tw-text-white hover:tw-bg-blue-700"
              }
            `}
          >
            <PlusIcon className="tw-w-5 tw-h-5" />
            {t('companyEdit.inviteUser')}
          </button>
        </div>
        <CompanyUsersInvite
          companyId={companyId}
          open={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          onSuccess={() => {
            fetchCompanyUsers();
          }}
        />

        <CardFooter className="tw-p-0 tw-overflow-auto table-scrollbar">
          <table className="tw-table-auto tw-text-left tw-w-full tw-min-w-max">
            <thead className="tw-bg-[#F9FAFB]">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="tw-p-4 !tw-text-black tw-font-medium"
                    >
                      <Typography className="tw-text-xs !tw-text-black tw-font-medium">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                      </Typography>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length > 0 ? (
                table
                  .getRowModel()
                  .rows.map((row) => (
                    <TableRow
                      key={row.id}
                      row={row}
                      editingRowId={editingRowId}
                      updateRow={updateRow}
                      handleDeleteRow={handleDeleteRow}
                      setEditingRowId={setEditingRowId}
                      t={t}
                      setSelectUserId={setSelectUserId}
                      setIsDialogOpen={setIsDialogOpen}
                      i18n={i18n}
                    />
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
                        alt="No Users"
                        className="tw-w-[8.625rem] tw-h-auto"
                      />
                      <Typography className="tw-text-lg tw-font-normal tw-text-gray-700">
                        {t('addCompany.noUsersFound')}
                      </Typography>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardFooter>

        {pagination.total_pages > 1 && (
          <div className="tw-flex tw-items-center tw-justify-end tw-gap-6 tw-px-10 tw-py-6">
            <span className="tw-flex tw-items-center tw-gap-1">
              <Typography className="tw-font-bold !tw-text-black">{t('common.page')}</Typography>
              <Typography className="!tw-text-black">{pagination.page} {t('common.of')} {pagination.total_pages}</Typography>
            </span>
            <div className="tw-flex tw-items-center tw-gap-2">
              <Button
                variant="outlined"
                size="sm"
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                disabled={pagination.page === 1 || fetchingData}
                className="disabled:tw-opacity-30 tw-py-2 tw-px-2"
              >
                <ChevronLeftIcon className="tw-w-4 tw-h-4" />
              </Button>
              <Button
                variant="outlined"
                size="sm"
                onClick={() => setPage((prev) => (prev < pagination.total_pages ? prev + 1 : prev))}
                disabled={pagination.page === pagination.total_pages || fetchingData}
                className="disabled:tw-opacity-30 tw-py-2 tw-px-2"
              >
                <ChevronRightIcon className="tw-w-4 tw-h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Submit Button */}
      <div className="tw-w-full tw-my-9 tw-flex tw-justify-center md:tw-justify-end">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className={`tw-py-2 btn-bg-blue tw-h-10 tw-px-5 tw-font-medium tw-text-[0.875rem] hover:tw-bg-blue-700 tw-text-white tw-bg-button tw-rounded-3xl ${
            loading ? "tw-opacity-50 tw-cursor-not-allowed" : ""
          }`}
        >
          {loading ? <Spinner className="tw-mx-14" /> : t("companyEdit.saveCompany")}
        </button>
      </div>
      <DeleteConfirmDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onConfirm={handleDeleteUser}
        entityName={t("common.user")?.toLowerCase()}
      />
    </>
  );
}

export default authMiddleware(EditCompany);
