import { ChevronDownIcon } from "@heroicons/react/24/solid";
import { Typography } from "@material-tailwind/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const CustomerDropdown = ({ value, onChange, customers }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || "");
  const dropdownRef = useRef(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<"bottom" | "top">(
    "bottom"
  );
  const { t } = useTranslation("common");

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
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
      const dropdownHeight = 260; // Approximate dropdown height (max-h-60 = 15rem = 240px + padding)
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
        setDropdownPosition("top");
      } else {
        setDropdownPosition("bottom");
      }
    }
  }, [isOpen]);

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    onChange(e.target.value);
  };

  const handleCustomerSelect = (customer) => {
    setInputValue(customer.name);
    onChange(customer.name);
    setIsOpen(false);
  };
  useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  return (
    <div className="tw-w-full tw-mb-2" ref={dropdownRef}>
      <Typography
        variant="h6"
        className="!tw-font-semibold !tw-text-black tw-mb-2 tw-font-[system-ui]"
      >
        {t("customerDropdown.customerName")}
        <span className="tw-text-red-500">*</span>
      </Typography>
      <div className="tw-relative">
        <div className="tw-flex tw-items-center tw-relative">
          <input
            type="text"
            className="tw-w-full tw-px-4 tw-py-2 tw-rounded-3xl tw-bg-white tw-border tw-border-gray-400 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 tw-font-normal tw-text-black tw-placeholder-gray-500"
            placeholder={t("customerDropdown.enterCustomerName")}
            name="customer_name"
            value={inputValue}
            onChange={handleInputChange}
            onClick={() => setIsOpen((prev) => !prev)}
            ref={inputRef}
          />
          <ChevronDownIcon
            className="tw-w-5 tw-h-5 tw-absolute tw-right-3 tw-text-gray-500 tw-cursor-pointer"
            onClick={() => setIsOpen(!isOpen)}
          />
        </div>

        {isOpen && (
          <div
            className={`tw-absolute tw-z-10 tw-w-full tw-bg-white tw-rounded-3xl tw-shadow-lg tw-border tw-border-gray-200 tw-max-h-60 tw-overflow-y-auto tw-custom-scrollbar
              ${
                dropdownPosition === "top"
                  ? "tw-bottom-full tw-mb-1"
                  : "tw-mt-1"
              }
            `}
            style={{
              ...(dropdownPosition === "top"
                ? { bottom: "100%" }
                : { top: "100%" }),
              borderRadius: "5px",
            }}
          >
            {/* <DropdownCloseIcon onClick={() => setIsOpen(false)} /> */}
            <div className="tw-p-3 tw-m-2 tw-bg-blue-50 tw-text-gray-700 tw-font-medium tw-rounded-xl">
              {t("customerDropdown.existingCustomer")}
            </div>

            {customers.length > 0 ? (
              customers.map((customer) => (
                <div
                  key={customer.id}
                  className="tw-p-3 tw-cursor-pointer hover:tw-bg-gray-100"
                  onClick={() => handleCustomerSelect(customer)}
                >
                  {customer.name}
                </div>
              ))
            ) : (
              <div className="tw-p-3 tw-text-center tw-text-gray-500">
                {t("customerDropdown.noCustomersFound")}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerDropdown;
