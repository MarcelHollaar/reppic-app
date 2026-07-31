"use client";
import React, { useMemo } from "react";
import {
  Dialog,
  DialogHeader,
  DialogBody,
  DialogFooter,
  Spinner,
  Typography,
} from "@material-tailwind/react";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/solid";
import { useTranslation } from "react-i18next";

type UploadStep = "uploading" | "transcribing" | "startingWorkflow";
type UploadState = "running" | "success" | "error";

export type UploadStatusModalProps = {
  isOpen: boolean;
  currentStep: UploadStep;
  status: UploadState;
  onClose: () => void;
  errorMessage?: string | null;
  progressPercentage?: number | null;
};

const UploadStatusModal: React.FC<UploadStatusModalProps> = ({
  isOpen,
  currentStep,
  status,
  onClose,
  errorMessage,
  progressPercentage,
}) => {
  const { t } = useTranslation("common");
  const canClose = status !== "running";

  const steps = useMemo<
    Array<{
      key: UploadStep;
      label: string;
    }>
  >(
    () => [
      { key: "uploading", label: t("uploadStatusModal.uploading") },
      { key: "transcribing", label: t("uploadStatusModal.transcribing") },
      { key: "startingWorkflow", label: t("uploadStatusModal.startingWorkflow") },
    ],
    [t]
  );

  const activeIndex = Math.max(
    0,
    steps.findIndex((step) => step.key === currentStep)
  );

  const getStepState = (index: number) => {
    if (status === "success") {
      return "done";
    }
    if (status === "error") {
      if (index < activeIndex) return "done";
      if (index === activeIndex) return "error";
      return "pending";
    }
    if (index < activeIndex) return "done";
    if (index === activeIndex) return "current";
    return "pending";
  };

  const handleClose = () => {
    if (canClose) {
      onClose();
    }
  };

  return (
    <Dialog
      open={isOpen}
      handler={handleClose}
      size="sm"
      className="tw-p-4 upload-status-modal"
    >
      <DialogHeader className="tw-justify-center tw-text-center tw-w-full">
        {status === "error"
          ? t("uploadStatusModal.errorTitle")
          : t("uploadStatusModal.title")}
      </DialogHeader>
      <DialogBody className="!tw-p-4 tw-flex tw-flex-col tw-gap-4">
        {status === "error" ? (
          <div className="tw-flex tw-flex-col tw-items-center tw-text-center tw-gap-3">
            <span className="tw-flex tw-items-center tw-justify-center tw-w-12 tw-h-12 tw-rounded-full tw-bg-red-100 tw-text-red-600">
              <ExclamationTriangleIcon className="tw-w-6 tw-h-6" />
            </span>
            <Typography className="tw-text-sm tw-text-blue-gray-900">
              {errorMessage || t("uploadStatusModal.errorMessage")}
            </Typography>
          </div>
        ) : (
          <>
            <Typography className="tw-text-center tw-text-blue-gray-900 tw-text-sm">
              {status === "success"
                ? t("uploadStatusModal.success")
                : t("uploadStatusModal.helper")}
            </Typography>
            <div className="tw-flex tw-flex-col tw-gap-3">
              {steps.map((step, index) => {
                const stepState = getStepState(index);
                const baseClass =
                  "tw-flex tw-items-center tw-gap-3 tw-rounded-2xl tw-px-3 tw-py-2 tw-border tw-border-gray-100";
                const iconWrapperBase =
                  "tw-flex tw-items-center tw-justify-center tw-w-9 tw-h-9 tw-rounded-full";
                let iconWrapperClass = "tw-bg-gray-100 tw-text-gray-400";
                if (stepState === "current") {
                  iconWrapperClass = "tw-bg-blue-100 tw-text-blue-600";
                } else if (stepState === "done") {
                  iconWrapperClass = "tw-bg-green-100 tw-text-green-600";
                } else if (stepState === "error") {
                  iconWrapperClass = "tw-bg-red-100 tw-text-red-600";
                }

                return (
                  <div key={step.key} className={baseClass}>
                    <span className={`${iconWrapperBase} ${iconWrapperClass}`}>
                      {stepState === "current" ? (
                        <Spinner className="tw-w-4 tw-h-4" />
                      ) : stepState === "done" ? (
                        <CheckCircleIcon className="tw-w-5 tw-h-5" />
                      ) : stepState === "error" ? (
                        <ExclamationTriangleIcon className="tw-w-5 tw-h-5" />
                      ) : (
                        <span className="tw-w-2 tw-h-2 tw-bg-gray-300 tw-rounded-full" />
                      )}
                    </span>
                    <Typography className="tw-text-sm tw-text-blue-gray-900">
                      {step.label}
                      {step.key === "uploading" &&
                        status === "running" &&
                        typeof progressPercentage === "number" &&
                        ` (${progressPercentage}%)`}
                    </Typography>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </DialogBody>
      {canClose && (
        <DialogFooter className="tw-flex tw-justify-center">
          <button
            type="button"
            onClick={handleClose}
            className="tw-border tw-border-[#D0D5DD] tw-bg-blue-600 tw-text-white tw-text-sm tw-font-medium tw-py-2 tw-px-6 tw-rounded-3xl"
          >
            {t("uploadStatusModal.close")}
          </button>
        </DialogFooter>
      )}
    </Dialog>
  );
};

export default UploadStatusModal;
