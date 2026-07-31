import React, { useState, useRef, useEffect } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/solid";
import DropdownCloseIcon from "./DropdownCloseIcon";
import { useTranslation } from "react-i18next";

const PhaseDropdown = ({ value, onChange }: { value: number; onChange: (value: number) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const options = [1, 2, 3, 4];
  const { t } = useTranslation('common');
  const handlePhaseSelect = (phase: number) => {
    onChange(phase);
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: any) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="tw-w-full tw-mb-4" ref={dropdownRef}>
      <div className="tw-relative">
        <div className="tw-flex tw-items-center tw-relative">
          <input
            type="text"
            className="tw-w-full tw-px-4 tw-py-2 tw-rounded-3xl tw-bg-white tw-border tw-border-gray-400 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 tw-font-normal tw-text-black tw-placeholder-gray-500"
            placeholder={t("addVideo.phase")}
            name="phase"
            value={value}
            readOnly
            onClick={() => setIsOpen(!isOpen)}
            style={{ border: "1px solid #D0D5DD"}}
          />
          <ChevronDownIcon
            className="tw-w-5 tw-h-5 tw-absolute tw-right-3 tw-text-gray-500 tw-cursor-pointer"
            onClick={() => setIsOpen(!isOpen)}
          />
        </div>

        {isOpen && (
          <div className="tw-absolute tw-z-10 tw-w-full tw-mt-1 tw-bg-white tw-rounded-3xl tw-shadow-lg tw-border tw-border-gray-200 tw-max-h-60 tw-custom-scrollbar tw-overflow-y-auto" style={{ borderRadius:  "5px" }}>
            {/* <DropdownCloseIcon onClick={() => setIsOpen(false)} /> */}
            <div className="tw-p-3 tw-m-2 tw-bg-blue-50 tw-text-black tw-font-medium tw-rounded-xl">
              {t('addVideo.selectPhase')}
            </div>
            {options.map((phase) => (
              <div
                key={phase}
                className="tw-p-3 tw-cursor-pointer tw-text-black hover:tw-bg-gray-100"
                onClick={() => handlePhaseSelect(phase)}
              >
                {phase}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PhaseDropdown;
