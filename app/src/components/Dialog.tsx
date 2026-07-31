"use client";
import { type ReactNode, useEffect, useState } from "react";
import {
  Dialog as MTDialog,
  DialogHeader,
  DialogBody,
  DialogFooter,
} from "@material-tailwind/react";

type DialogProps = {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
};

const Dialog = ({ open = false, onClose, children }: DialogProps) => {
  const [isOpen, setIsOpen] = useState<boolean>(open);
  const handleClose = () => {
    setIsOpen(false);

    if (onClose) {
      onClose();
    }
  };

  useEffect(() => {
    setIsOpen(open);
  }, [open]);

  return (
    <MTDialog open={isOpen} handler={handleClose} size="sm" className="tw-p-4">
      {children}
    </MTDialog>
  );
};

export { DialogHeader, DialogBody, DialogFooter };
export default Dialog;
