"use client";

import React, { useState } from "react";
import Papa from "papaparse";
import {
  Dialog,
  DialogHeader,
  DialogBody,
  DialogFooter,
  Spinner,
  Typography,
} from "@material-tailwind/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { toast } from "react-toastify";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import { useTranslation } from "react-i18next";

interface CompanyUsersImportProps {
  company: Object;
  onImportSuccess: (message: string) => void;
  currentUsers: any
  maxUserLmt: any
}

export default function CompanyUsersImport({
  onImportSuccess,
  company,
  currentUsers,
  maxUserLmt
}: CompanyUsersImportProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [isDisabled, setIsDisabled] = useState(false);
  const headers = getAuthHeaders()
  const { t } = useTranslation("common");
  const [isDragActive, setIsDragActive] = useState(false);

  const handleCSVFile = (file: File) => {
    if (file && file.type === "text/csv") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results: any) => {
          const parsedData = results.data.map((item: any, idx: number) => ({
            id: Date.now() + idx,
            first_name: item.first_name || "",
            last_name: item.last_name || "",
            email: item.email || "",
            role: item.role || "user",
          }));
          const currentUserCount = currentUsers;
          const maxUsers = maxUserLmt || company?.max_users;
          const allowedToAdd = maxUsers - currentUserCount;

          if (allowedToAdd <= 0) {
            toast.error(`${t("errorMessages.maxAccountsReached")}`);
            return;
          }

          if (parsedData.length > allowedToAdd) {
            toast.error(`${t("errorMessages.allowedToAddLimit", { allowedToAdd })}`);
            return;
          }

          setFileName(file.name);
          setCsvData(parsedData);
          setShowModal(true); // Show confirmation modal
        },
        error: (error: any) => {
          toast.error(t("errorMessages.csvParsingError"));
          console.error("CSV parsing error:", error);
        },
      });
    } else {
      toast.error(t("errorMessages.uploadValidCSV"));
    }
  };
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleCSVFile(file);
  };

  const handleImportConfirm = async () => {
    setIsDisabled(true);
    try {
      // Format data for API
      const payload = {
        title: company?.title,
        contact_person: company?.contactPerson,
        email: company?.email,
        phone: company?.phone,
        notes: company?.notes,
        users: csvData.map((user) => ({
          name: `${user?.first_name} ${user?.last_name}`.trim(),
          email: user?.email,
          role: user?.role,
        })),
      };
      const response = await fetch(`/api/companies/${company?.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(t("errorMessages.importFailed"));
      }

      setCsvData([]);
      setFileName(null);
      setShowModal(false);
      onImportSuccess(t("successMessages.usersImported"));
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || t("errorMessages.importFailed"));
    }
    setIsDisabled(false);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setIsDisabled(false);
    setCsvData([]);
    setFileName(null);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

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

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  return (
    <div className="tw-w-full tw-mb-4">
      <Typography
        variant="h6"
        className="!tw-font-semibold !tw-text-black tw-mb-2 tw-font-[system-ui]"
      >
        {t('form.file')}
      </Typography>
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
        />
        <img
          src="/img/upload_cloud_icon.svg"
          alt="upload icon"
          className="tw-mb-2"
        />
        <span className="tw-text-blue-500">{t('form.uploadText')}</span>
        <span className="tw-text-gray-500 tw-text-sm">{t('form.dragText')}</span>
        <span className="tw-text-xs tw-text-gray-500 tw-mt-1">{t('form.CSV')}</span>
      </label>
    </div>
      <a
        href="/users.csv"
        download
        className="tw-text-sm tw-text-blue-600 hover:tw-underline tw-m-8"
      >
        {t('addCompany.downloadSampleCSV')}
      </a>

      {/* If a file is uploaded, show filename */}
      {fileName && (
        <div className="tw-flex tw-items-center tw-justify-between tw-border tw-border-gray-400 tw-rounded-full tw-px-4 tw-py-3 tw-mt-2 tw-text-sm">
          <span className="tw-text-gray-700 tw-truncate">{fileName}</span>
          <XMarkIcon
            className="tw-w-5 tw-h-5 tw-cursor-pointer tw-ml-2"
            onClick={handleModalClose}
          />
        </div>
      )}

      {/* Modal */}
      <Dialog
        className="!tw-min-22 tw-p-4"
        size="sm"
        open={showModal}
        handler={handleModalClose}
      >
        <DialogHeader>{t('companyEdit.bulkImportUsers')}</DialogHeader>
        <DialogBody className="!tw-p-4">

          {t('companyEdit.wantToImport', {length: csvData.length})}
        </DialogBody>
        <DialogFooter className="tw-flex tw-justify-center tw-gap-4">
          <button
            type="button"
            onClick={handleModalClose}
            className="tw-border tw-border-[#D0D5DD] tw-text-[#344054] tw-text-sm tw-font-medium tw-py-2 tw-px-4 tw-rounded-3xl"
          >
            {t('form.cancel')}
          </button>
          <button
            type="submit"
            onClick={handleImportConfirm}
            disabled={isDisabled}
            className={`tw-px-6 tw-py-2 tw-bg-blue-600 tw-text-white tw-rounded-3xl ${
              isDisabled
                ? "tw-opacity-50 tw-cursor-not-allowed"
                : "hover:tw-bg-blue-400"
            }`}
          >
            {isDisabled ? <Spinner className="tw-mx-2" /> : t("common.yes")}
          </button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
