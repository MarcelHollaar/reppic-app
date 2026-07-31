"use client";

import { XMarkIcon } from "@heroicons/react/24/solid";
import React from "react";

interface DropdownCloseIconProps {
  onClick: () => void;
  className?: string;
}

const DropdownCloseIcon: React.FC<DropdownCloseIconProps> = ({
  onClick,
  className = "",
}) => {
  return (
    <div
      className="tw-absolute tw-top-2 tw-right-2 tw-cursor-pointer hover:tw-bg-blue-50 tw-rounded-full tw-p-1"
    >
      <XMarkIcon
        onClick={onClick}
        className={`tw-w-5 tw-h-5 tw-cursor-pointer tw-text-blue-400 hover:tw-text-blue-700 ${className}`}
      />
    </div>
  );
};

export default DropdownCloseIcon;
