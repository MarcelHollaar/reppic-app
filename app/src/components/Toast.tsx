"use client";
import { type ReactNode, useEffect, useState } from "react";
import { Alert } from "@material-tailwind/react";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";

type ToastVariant = "success" | "error" | "warning" | "info";

type ToastProps = {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  variant?: ToastVariant;
  duration?: number; // Auto-close duration in ms, 0 = no auto-close
};

const variantConfig: Record<
  ToastVariant,
  { color: "green" | "red" | "amber" | "blue"; icon: ReactNode }
> = {
  success: {
    color: "green",
    icon: <CheckCircleIcon className="tw-w-5 tw-h-5" />,
  },
  error: {
    color: "red",
    icon: <XCircleIcon className="tw-w-5 tw-h-5" />,
  },
  warning: {
    color: "amber",
    icon: <ExclamationTriangleIcon className="tw-w-5 tw-h-5" />,
  },
  info: {
    color: "blue",
    icon: <InformationCircleIcon className="tw-w-5 tw-h-5" />,
  },
};

const Toast = ({
  open = false,
  onClose,
  children,
  variant = "info",
  duration = 5000,
}: ToastProps) => {
  const [isOpen, setIsOpen] = useState<boolean>(open);
  const config = variantConfig[variant];

  const handleClose = () => {
    setIsOpen(false);
    if (onClose) {
      onClose();
    }
  };

  useEffect(() => {
    setIsOpen(open);
  }, [open]);

  // Auto-close after duration
  useEffect(() => {
    if (isOpen && duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, duration]);

  if (!isOpen) return null;

  return (
    <div className="tw-fixed tw-top-4 tw-right-4 tw-z-50 tw-max-w-sm tw-w-full">
      <Alert
        open={isOpen}
        color={config.color}
        icon={config.icon}
        className="tw-flex tw-items-center"
        action={
          <button
            onClick={handleClose}
            className="!tw-absolute tw-top-3 tw-right-3 tw-text-current tw-opacity-70 hover:tw-opacity-100"
          >
            <XMarkIcon className="tw-w-5 tw-h-5" />
          </button>
        }
      >
        {children}
      </Alert>
    </div>
  );
};

export default Toast;
