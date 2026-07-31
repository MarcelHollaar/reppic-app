import React, { useState, useRef, useEffect } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/solid";
import DropdownCloseIcon from "./DropdownCloseIcon";
import { useTranslation } from "react-i18next";

const StatusDropdown = ({ value, onChange }: { value: string; onChange: (val: string) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState("");
  const { t } = useTranslation('common');
  const statusOptions = [
    { id: "active", name: t("statusDropdown.active" )},
    { id: "inactive", name: t("statusDropdown.inactive") },
  ];

  useEffect(() => {
    const selectedStatus = statusOptions.find((status) => status.id === value);
    if (selectedStatus) {
      setInputValue(selectedStatus.name);
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleStatusSelect = (status: { id: string; name: string }) => {
    setInputValue(status.name);
    onChange(status.id);
    setIsOpen(false);
  };

  return (
    <div className="tw-w-full tw-mb-4" ref={dropdownRef}>
      <div className="tw-relative">
        <div className="tw-flex tw-items-center tw-relative">
          <input
            type="text"
            className="tw-w-full tw-px-4 tw-py-2 tw-rounded-3xl tw-bg-white tw-border tw-border-gray-400 focus:tw-outline-none focus:tw-ring-2 !focus:tw-ring-blue-500 tw-font-normal tw-text-black tw-placeholder-gray-500 tw-cursor-pointer"
            placeholder={t("statusDropdown.selectStatus")}
            value={inputValue}
            readOnly
            onClick={() => setIsOpen((prev) => !prev)}
            style={{ border: "1px solid #D0D5DD" }}
          />
          <ChevronDownIcon
            className="tw-w-5 tw-h-5 tw-absolute tw-right-3 tw-text-gray-500 tw-cursor-pointer"
            onClick={() => setIsOpen(!isOpen)}
          />
        </div>

        {isOpen && (
          <div className="tw-absolute tw-z-10 tw-w-full tw-mt-1 tw-bg-white tw-rounded-3xl tw-shadow-lg tw-border tw-border-gray-200 tw-max-h-60 tw-overflow-y-auto" style={{ borderRadius: "5px"}}>
            {/* <DropdownCloseIcon onClick={() => setIsOpen(false)} /> */}
            {statusOptions.map((status) => (
              <div
                key={status.id}
                className="tw-p-3 tw-cursor-pointer hover:tw-bg-gray-100"
                onClick={() => handleStatusSelect(status)}
              >
                {status.name}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatusDropdown;
