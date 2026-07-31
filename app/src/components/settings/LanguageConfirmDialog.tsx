"use client";
import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogHeader,
  DialogBody,
  DialogFooter,
  Spinner,
  Typography,
} from "@material-tailwind/react";
import { useTranslation } from "react-i18next";

interface LanguageConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  entityName?: string;
}

const LanguageConfirmDialog: React.FC<LanguageConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  entityName = "item",
}) => {
  const [isDisabled, setIsDisabled] = useState(false);
  const { t } = useTranslation('common')
  const handleConfirm = () => {
    setIsDisabled(true);
    onConfirm();
  };

  useEffect(() => {
    if (isOpen) {
      setIsDisabled(false);
    }
  }, [isOpen]);

  return (
    <Dialog
      className="!tw-min-22 tw-p-4"
      size="sm"
      open={isOpen}
      handler={onClose}
    >
      <DialogHeader className="tw-justify-center tw-text-center tw-w-full">{t('languageConfirmDialog.languageChange')}</DialogHeader>
      <DialogBody className="!tw-p-4 tw-text-center tw-text-blue-gray-900 ">
        <Typography className="tw-mb-4 !tw-text-blue-gray-900 ">{t('languageConfirmDialog.infoText')}</Typography>
        <Typography className="!tw-text-blue-gray-900 ">{t('languageConfirmDialog.confirmText')}</Typography>
       
      </DialogBody>
      <DialogFooter className="tw-flex tw-justify-center tw-gap-4">
        <button
          type="button"
          onClick={onClose}
          className="tw-border tw-border-[#D0D5DD] tw-bg-blue-600 tw-text-white tw-text-sm tw-font-medium tw-py-2 tw-px-4 tw-rounded-3xl"
        >
          {t('languageConfirmDialog.cancel')}
        </button>
        <button
          type="submit"
          onClick={handleConfirm}
          disabled={isDisabled}
          className={`tw-px-6 tw-py-2 tw-bg-red-600 tw-text-white tw-rounded-3xl ${
            isDisabled
              ? "tw-opacity-50 tw-cursor-not-allowed"
              : "hover:tw-bg-red-400"
          }`}
        >
          {isDisabled ? <Spinner className="tw-mx-2" /> : t("languageConfirmDialog.changeLanguage")}
        </button>
      </DialogFooter>
    </Dialog>
  );
};

export default LanguageConfirmDialog;
