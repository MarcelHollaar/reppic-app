"use client";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface DeleteUserDialogProps {
isOpen: boolean;
onClose: () => void;
onConfirm: () => void;
bulkDelete: boolean
}

const DeleteUserDialog: React.FC<DeleteUserDialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    bulkDelete = false

    }) => {
    const [isDisabled, setIsDisabled] = useState(false);
    const {t} = useTranslation('common')
    const handleConfirm = () => {
    setIsDisabled(true);
    onConfirm();
    };

    useEffect(() => {
    if (isOpen) {
    setIsDisabled(false);
    }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
      <div className="tw-fixed tw-inset-0 tw-z-50 tw-flex tw-items-center tw-justify-center tw-bg-black/40">
        <div className="tw-bg-white tw-rounded-2xl tw-p-6 tw-w-full tw-max-w-sm tw-mx-4">
          <h2 className="tw-text-base tw-font-semibold tw-text-gray-900 tw-text-center tw-mb-4">{t('deleteModal.confirmDelete')}</h2>
          <p className="tw-text-sm tw-text-gray-700 tw-text-center tw-mb-6">
            {bulkDelete
              ? t('errorMessages.deleteBulk')
              : t('errorMessages.deleteTeamMember')}
          </p>
          <div className="tw-flex tw-justify-center tw-gap-4">
            <button type="button" onClick={onClose}
              className="tw-border tw-border-[#D0D5DD] tw-text-[#344054] tw-text-sm tw-font-medium tw-py-2 tw-px-4 tw-rounded-3xl">
              {t('form.cancel')}
            </button>
            <button type="submit" onClick={handleConfirm} disabled={isDisabled} className={`tw-px-6 tw-py-2 tw-bg-red-600 tw-text-white tw-rounded-3xl ${ isDisabled ? "tw-opacity-50 tw-cursor-not-allowed" : "hover:tw-bg-red-400" }`}>
              {isDisabled ?
                <svg className="tw-animate-spin tw-h-4 tw-w-4 tw-mx-2 tw-text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="tw-opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="tw-opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                : t("common.yes")}
            </button>
          </div>
        </div>
      </div>
      );
    };

    export default DeleteUserDialog;
