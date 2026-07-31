"use client";
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Card, CardFooter, Typography } from "@material-tailwind/react";
import { ArrowLeftIcon, PlusIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { Spinner } from "@/components/MaterialTailwind";
import Papa from "papaparse";
import {
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  useReactTable,
  flexRender,
} from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { toast, ToastContainer } from "react-toastify";
import { USER_ROLE } from "@/configs/constants";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import { PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";
import RoleDropdown from "../RoleDropdown";
import CompanyUsersInvite from "./CompanyUsersInvite";

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
    <RoleDropdown value={value} onChange={onChange} showAtTop={true}/>
  );
});

const TableRow = memo(
  ({ row, editingRowId, updateRow, handleDeleteRow, setEditingRowId, t }) => {
    const isEditing = editingRowId === row.original.id;

    const handleEditToggle = useCallback(() => {
      setEditingRowId(isEditing ? null : row.original.id);
    }, [isEditing, row.original.id, setEditingRowId]);

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
    <tr className="hover:tw-bg-gray-50">
      <td className="tw-p-4 tw-text-sm tw-rounded-3xl">
        {isEditing ? (
          <EditableCell
            value={row.original.first_name}
            onChange={updateFirstName}
            placeholder={t("form.enterFirstName")}
          />
        ) : (
          <span className="tw-text-sm tw-font-medium tw-text-black">{row.original.first_name}</span>
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
          <span className="tw-text-sm tw-text-black">{row.original.last_name}</span>
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
          <span className="tw-text-black tw-text-sm">{row.original.email}</span>
        )}
      </td>
      <td className="tw-p-4 tw-text-sm">
        {isEditing ? (
          <EditableSelect
            value={row.original.role}
            onChange={updateRole}
            t={t}
          />
        ) : (
          <span className="tw-text-sm tw-capitaliz tw-text-black">{t(`common.${row.original.role?.toLowerCase()}`, row.original.role)}</span>
        )}
      </td>
      <td className="tw-p-4 tw-text-sm tw-rounded-3xl">
        <p className="tw-flex tw-gap-3">
          <button
            className="tw-p-2 tw-rounded-lg tw-border tw-border-gray-200 tw-bg-white hover:tw-border-blue-500"
            onClick={handleEditToggle}
            type="button"
          >
            <PencilSquareIcon className="tw-h-5 tw-w-5 tw-text-black" />
          </button>
          <button
            className="tw-p-2 tw-rounded-lg tw-border tw-border-gray-200 tw-bg-white hover:tw-border-red-500"
            onClick={handleDelete}
            type="button"
          >
            <TrashIcon className="tw-h-5 tw-w-5 tw-text-[#FF3B30]" />
          </button>
        </p>
      </td>
    </tr>
  );
});

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

export function AddEditCompany() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const [csvData, setCsvData] = useState([]);
  const { t } = useTranslation("common");
  const [isDragActive, setIsDragActive] = useState(false);
  const userCount = useMemo(
    () => csvData.filter((u) => u.role === USER_ROLE.USER).length,
    [csvData]
  );

  const managerCount = useMemo(
    () => csvData.filter((u) => u.role === USER_ROLE.MANAGER).length,
    [csvData]
  );
  const [maxSubscriptions, setMaxSubscriptions] = useState<boolean>(true);

  const [selectedTab, setSelectedTab] = useState<
    USER_ROLE.USER | USER_ROLE.MANAGER | "all"
  >('all');

  const [formData, setFormData] = useState({
    title: "",
    contactPerson: "",
    email: "",
    phone: "",
    notes: "",
    maxUsers: "",
  });

  // Validation errors state
  const [errors, setErrors] = useState({
    title: "",
    email: "",
    phone: "",
    contactPerson: "",
    csvData: "",
    maxUsers: "",
  });

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  // Form validation function
  const validateField = (field: string, value: string) => {
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

  // Validate CSV data
  const validateCsvData = () => {
    if (csvData.length === 0) {
      return true; // No data to validate is still valid
    }

    let isValid = true;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Check for required fields and valid email
    for (const user of csvData) {
      if (
        !user.first_name.trim() ||
        !user.last_name.trim() ||
        !user.email.trim()
      ) {
        setErrors((prev) => ({
          ...prev,
          csvData: t('errorMessages.mustHaveFirstName'),
        }));
        isValid = false;
        break;
      }

      if (!emailRegex.test(user.email)) {
        setErrors((prev) => ({
          ...prev,
          csvData: t("errorMessages.mustHaveValidEmail"),
        }));
        isValid = false;
        break;
      }
    }

    return isValid;
  };

  const handleBackBtnClick = () => {
    router.push("/companies");
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    let newValue = value;
    if (name === "phone") {
      // Only allow numbers and dashes, and max length 20
      newValue = newValue.replace(/[^0-9\-]/g, "").slice(0, 20);
    }
    setFormData((prev) => ({ ...prev, [name]: newValue }));
    validateField(name, newValue);
  };

  const isFormValid = () => {
    // Check if there's at least one user
    const hasUser = csvData.some((user) => user.role === USER_ROLE.USER);

    // Only check for manager if at least one user exists
    if (hasUser) {
      const hasManager = csvData.some((user) => user.role === USER_ROLE.MANAGER);
      if (!hasManager) {
        toast.error(t("errorMessages.managerRoleIsRequired"));
        return false;
      }
    }

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

    // Validate CSV data
    if (!validateCsvData()) {
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
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
        users: csvData.map((user) => ({
          name: `${user?.first_name} ${user?.last_name}`.trim(),
          email: user?.email,
          role: user?.role,
        })),
      };

      const response = await fetch("/api/companies", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.message || t("errorMessages.failedToSaveCompany"));
      }

      const companyId = result?.company?.id;

      if (companyId) {
        localStorage.setItem("companyAdded", "true");
        router.push(`/companies/${companyId}/edit`);
      } else {
        throw new Error("Company ID not found in response");
      }
    } catch (error) {
      console.error("Error saving company:", error);
      toast.error(
        error instanceof Error ? error?.message : t("errorMessages.failedToSaveCompany")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFile = () => {
    setFileName(null);
    setCsvData([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setErrors((prev) => ({ ...prev, csvData: "" }));
  };

  const handleCSVFile = (file: File) => {
    if (file && file.type === "text/csv") {
      setFileName(file.name);
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const parsedData = results.data.map((item: any, idx: number) => ({
            id: Date.now() + idx,
            first_name: item.first_name || "",
            last_name: item.last_name || "",
            email: item.email || "",
            role: item.role || "user",
          }));

          if (parsedData.length > Number(formData.maxUsers)) {
            toast.error(
              `${t('errorMessages.containsUsersMaxAllowed', {length: parsedData.length, maxUsers: formData.maxUsers})}`
            );
            return;
          }

          setCsvData((prev) => {
            const merged = [...prev, ...parsedData];

            const uniqueByEmail = Array.from(
              new Map(merged.map((item) => [item.email, item])).values()
            );

            return uniqueByEmail;
          });

          // Validate the parsed data
          validateCsvData();
        },
        error: (error) => {
          toast.error(t("errorMessages.csvParsingError"));
          console.error("CSV parsing error:", error);
        },
      });
    } else {
      toast.error(t("errorMessages.uploadValidCSV"));
    }
  };

  const handleCSVUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleCSVFile(file);
    },
    [formData]
  );

  const handleDeleteRow = useCallback((id: number) => {
    setCsvData((prev) => {
      const newData = prev.filter((item) => item.id !== id);
      // Clear CSV error when data changes
      setErrors((prevErrors) => ({ ...prevErrors, csvData: "" }));
      return newData;
    });
  }, []);

  const handleAddUser = useCallback(() => {
    const newId = Date.now(); 
    const newUser = {
      id: newId,
      first_name: "",
      last_name: "",
      email: "",
     role: selectedTab === 'all' ? USER_ROLE.USER : selectedTab,
    };

    setCsvData((prev) => [newUser, ...prev]); // Prepend to the beginning
    setEditingRowId(newId);
  }, [selectedTab]);

  const handleInviteUser = useCallback((invitedUser) => {
    const newId = Date.now();
    setCsvData((prev) => [
      {
        id: newId,
        first_name: invitedUser.first_name,
        last_name: invitedUser.last_name,
        email: invitedUser.email,
        role: invitedUser.role,
      },
      ...prev,
    ]);
    setEditingRowId(null); // Not editing by default
  }, []);

  const updateRow = useCallback((userId, key, value) => {
    setCsvData((prev) => {
      return prev.map((user) => {
        if (user.id === userId) {
          return { ...user, [key]: value };
        }
        return user;
      });
    });
  }, []);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) {
      handleCSVFile(file);
    } else {
      toast.error(t("errorMessages.uploadValidCSV"));
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  useEffect(() => {
    const preventDefaults = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("dragover", preventDefaults, false);
    window.addEventListener("drop", preventDefaults, false);
    return () => {
      window.removeEventListener("dragover", preventDefaults, false);
      window.removeEventListener("drop", preventDefaults, false);
    };
  }, []);

  const setTabToManager = useCallback(
    () => setSelectedTab(USER_ROLE.MANAGER),
    []
  );
  const setTabToUser = useCallback(() => setSelectedTab(USER_ROLE.USER), []);
  const setTabToAll = useCallback(() => setSelectedTab("all"), []);

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
        accessorKey: "actions",
        header: t("common.actions"),
      },
    ],
    [t]
  );

  // const filteredData = useMemo(() => {
  //   return csvData.filter((u) => u.role === selectedTab);
  // }, [csvData, selectedTab]);

  const filteredData = useMemo(() => {
    return csvData
      .filter((u) => selectedTab === 'all' || u.role === selectedTab)
      .filter((u) => !csvData.includes(u.id));
  }, [csvData, selectedTab]);

  const table = useReactTable({
    data: filteredData,
    columns,
    getFilteredRowModel: getFilteredRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  useEffect(() => {
    if (formData.maxUsers) {
      setMaxSubscriptions(csvData.length >= parseInt(formData.maxUsers));
    }
  }, [csvData, formData]);

  return (
    <>
      <ToastContainer />
      {/* Header Section */}
      <div className="tw-mb-6 tw-mt-4">
        <div className="tw-flex tw-flex-col md:tw-flex-row tw-items-center md:tw-items-center tw-justify-between tw-mb-4">
          <button
            onClick={handleBackBtnClick}
            className="tw-flex tw-items-center tw-gap-2 tw-text-[#1D49A7] tw-bg-blue-100 tw-rounded-full tw-h-10 tw-px-5 tw-font-medium tw-text-[0.875rem] hover:tw-bg-blue-200"
          >
            <ArrowLeftIcon className="tw-w-5 tw-h-5" />
            {t('companiesListing.companies')}
          </button>
        </div>
      </div>
      <div className="tw-flex tw-flex-col md:tw-flex-row tw-items-start md:tw-items-center tw-justify-between tw-mb-4 tw-gap-3">
        <Typography
          variant="h3"
          className="!tw-font-medium tw-text-blue-gray-900 tw-text-center md:tw-text-left"
        >
          {t('addCompany.createNewCompany')}
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
                <div className="tw-w-sm tw-mb-4">
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
                    {t("form.phoneNo")}
                  </Typography>
                  <input
                    type="tel"
                    className="tw-w-full tw-px-4 tw-py-2 tw-rounded-3xl tw-bg-white tw-border tw-border-gray-400 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 tw-font-normal tw-text-black tw-placeholder-gray-500"
                    placeholder={t("addCompany.enterPhoneNo")}
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
                {/* Max Users */}
                <div className="tw-w-full tw-mb-4">
                  <Typography
                    variant="h6"
                    className="!tw-font-semibold !tw-text-black tw-mb-2 tw-font-[system-ui]"
                  >
                    {t('addCompany.maximumSubscriptionAccounts')}
                  </Typography>
                  <input
                    type="number"
                    min="1"
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

              {/* File Upload */}
             <div className="tw-w-full tw-mb-4">
                <Typography
                  variant="h6"
                  className="!tw-font-semibold !tw-text-black tw-mb-2 tw-font-[system-ui]"
                >
                  {t('form.file')}
                </Typography>
                <div
                  className={`tw-w-full tw-bg-white`}
                >
                  {fileName ? (
                    <div className="tw-flex tw-items-center tw-justify-between tw-border tw-border-gray-400 tw-rounded-full tw-px-4 tw-py-3 tw-text-sm">
                      <span className="tw-text-gray-700 tw-truncate">
                        {fileName}
                      </span>
                      <XMarkIcon
                        className="tw-w-5 tw-h-5 tw-cursor-pointer tw-ml-2"
                        onClick={handleRemoveFile}
                      />
                    </div>
                  ) : (
                    <div
                      className={`tw-w-full tw-h-32 tw-border tw-border-solid tw-border-gray-400 tw-rounded-full tw-flex tw-flex-col tw-items-center tw-justify-center tw-cursor-pointer ${
                        isDragActive ? "tw-bg-blue-50 tw-border-blue-500" : ""
                      }`}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      onDragLeave={handleDragLeave}
                    >
                      <label className="tw-w-full tw-h-full tw-flex tw-flex-col tw-items-center tw-justify-center tw-cursor-pointer">
                        <input
                          type="file"
                          accept=".csv"
                          className="tw-hidden"
                          onChange={handleCSVUpload}
                          ref={fileInputRef}
                        />
                        <img
                          src="/img/upload_cloud_icon.svg"
                          alt="upload icon"
                          className="tw-mb-2"
                        />
                        <span className="tw-text-blue-500">{t('form.uploadText')}</span>
                        <span className="tw-text-gray-500 tw-text-sm">
                          {t('form.dragText')}
                        </span>
                        <span className="tw-text-xs tw-text-gray-500 tw-mt-1">
                          {t('form.CSV')}
                        </span>
                      </label>
                    </div>
                  )}

                  <a
                    href="/users.csv"
                    download
                    className="tw-text-sm tw-text-blue-600 hover:tw-underline tw-m-8"
                  >
                    {t('addCompany.downloadSampleCSV')}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </form>
      </Card>
      <div className="tw-flex tw-flex-col sm:tw-flex-row tw-items-center sm:tw-items-start sm:tw-justify-between tw-px-0 tw-py-9 tw-gap-4 sm:tw-gap-0">
        <div className="tw-flex tw-items-center tw-justify-center sm:tw-justify-start tw-gap-2">
          <Typography
            color="blue-gray"
            className="!tw-font-medium !tw-text-3xl"
            variant="h1"
          >
            {t('common.subscriptions')}
          </Typography>
        </div>
        {/* Pills */}
        <div className="tw-flex tw-flex-col sm:tw-flex-row tw-items-center tw-justify-center sm:tw-justify-start tw-gap-4">
          {/* Add User Button */}
          {/* <button
            onClick={handleAddUser}
            disabled={maxSubscriptions}
            className={`
              tw-flex tw-items-center tw-gap-2 tw-rounded-full tw-h-8 tw-px-5 
              tw-font-medium tw-text-[0.875rem] 
              ${
                maxSubscriptions
                  ? "tw-bg-gray-400 tw-text-white tw-cursor-not-allowed"
                  : "btn-bg-blue tw-text-white hover:tw-bg-blue-700"
              }
            `}
            type="button"
          >
            <PlusIcon className="tw-h-4 tw-w-4 tw-text-white" />
            <span className="tw-text-white">{t('addCompany.addUser')}</span>
          </button> */}
          {/* Invite User Button */}
         
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
      {/* Invite User Modal */}
      <CompanyUsersInvite
        open={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onSuccess={handleInviteUser}
        localOnly={true}
      />
      {csvData.length > 0 ? (
        <Card className="tw-border tw-p-0 tw-my-4">
          <div className="tw-m-4">
            <button
              onClick={() => setIsInviteModalOpen(true)}
              disabled={maxSubscriptions}
              className={`
                tw-flex tw-items-center tw-gap-2 tw-rounded-full tw-h-8 tw-px-5 
                tw-font-medium tw-text-[0.875rem] 
                ${
                  maxSubscriptions
                    ? "tw-bg-gray-400 tw-text-white tw-cursor-not-allowed"
                    : "btn-bg-blue tw-text-white hover:tw-bg-blue-700"
                }
              `}
              type="button"
            >
              <PlusIcon className="tw-h-4 tw-w-4 tw-text-white" />
              <span className="tw-text-white">{t('companyEdit.inviteUser')}</span>
            </button>
          </div>
          {errors.csvData && (
            <div className="tw-px-4 tw-py-2">
              <p className="tw-text-red-500 tw-text-sm">{errors.csvData}</p>
            </div>
          )}
          <CardFooter className="tw-p-0 tw-overflow-auto table-scrollbar">
            <table className="tw-table-auto tw-w-full">
              <thead className="tw-bg-gray-100 !tw-text-black">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th key={header.id} className="tw-p-4 tw-text-left">
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
                {table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    row={row}
                    editingRowId={editingRowId}
                    updateRow={updateRow}
                    handleDeleteRow={handleDeleteRow}
                    setEditingRowId={setEditingRowId}
                    t={t}
                  />
                ))}
              </tbody>
            </table>
          </CardFooter>
        </Card>
      ) : (
        <Card className="tw-border tw-border-blue-gray-100 tw-shadow-sm tw-font-inter tw-bg-indigo-50 tw-p-0">
          <div className="tw-m-4">
            <button
              onClick={() => setIsInviteModalOpen(true)}
              disabled={maxSubscriptions}
              className={`
                tw-flex tw-items-center tw-gap-2 tw-rounded-full tw-h-8 tw-px-5 
                tw-font-medium tw-text-[0.875rem] 
                ${
                  maxSubscriptions
                    ? "tw-bg-gray-400 tw-text-white tw-cursor-not-allowed"
                    : "btn-bg-blue tw-text-white hover:tw-bg-blue-700"
                }
              `}
              type="button"
            >
              <PlusIcon className="tw-h-4 tw-w-4 tw-text-white" />
              <span className="tw-text-white">{t('companyEdit.inviteUser')}</span>
            </button>
          </div>
          <div className="tw-flex tw-flex-col tw-items-center tw-justify-center tw-gap-4 tw-p-10 custom-margin">
            <img
              src="/img/conversation_empty.svg"
              alt={t('addCompany.noUsersFound')}
              className="tw-w-[8.625rem] tw-h-auto"
            />
            <Typography className="tw-text-lg tw-font-normal tw-text-gray-700">
             {t('addCompany.noUsersFound')}
            </Typography>
          </div>
        </Card>
      )}

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
    </>
  );
}

export default memo(AddEditCompany);
