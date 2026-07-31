import React, { useState, useRef, useEffect } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/solid";
import DropdownCloseIcon from "./DropdownCloseIcon";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";

interface RoleDropdownProps {
  value: string;
  onChange: (value: string) => void;
}

const RoleDropdown: React.FC<RoleDropdownProps> = ({ value, onChange }) => {
  const { t } = useTranslation("common");
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const options = [
    { value: "user", label: t("common.user") },
    { value: "manager", label: t("dashboard.manager") },
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

useEffect(() => {
  if (isOpen && inputRef.current) {
    const rect = inputRef.current.getBoundingClientRect();
    const dropdownHeight = 115; // Approximate dropdown height
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    let style: React.CSSProperties = {
      position: "absolute",
      left: rect.left + window.scrollX,
      width: rect.width,
      zIndex: 9999,
      borderRadius: "5px",
    };
    if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
      // Show above input
      style.top = rect.top + window.scrollY - dropdownHeight;
    } else {
      // Show below input
      style.top = rect.bottom + window.scrollY;
    }
    setDropdownStyle(style);
  }
}, [isOpen]);

  const selectedLabel = options.find((opt) => opt.value === value)?.label || "";

  return (
    <div className="tw-w-full" style={{ position: "relative" }}>
      <div className="tw-flex tw-items-center tw-relative">
        <input
          type="text"
          className="tw-w-full tw-px-4 tw-py-2 tw-rounded-3xl tw-bg-white tw-border tw-border-gray-400 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 tw-font-normal tw-text-black tw-placeholder-gray-500"
          placeholder={t("common.role")}
          name="role"
          value={selectedLabel}
          readOnly
          onClick={() => setIsOpen(!isOpen)}
          ref={inputRef}
        />
        <ChevronDownIcon
          className="tw-w-5 tw-h-5 tw-absolute tw-right-3 tw-text-gray-500 tw-cursor-pointer"
          onClick={() => setIsOpen(!isOpen)}
        />
      </div>
      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            className="tw-bg-white tw-rounded-3xl tw-shadow-lg tw-border tw-border-gray-200 tw-max-h-60 tw-overflow-y-auto"
            style={dropdownStyle}
          >
            {options.map((opt) => (
              <div
                key={opt.value}
                className="tw-p-3 tw-py-1 tw-cursor-pointer tw-text-black hover:tw-bg-gray-100"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
              >
                {opt.label}
              </div>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
};

export default RoleDropdown;