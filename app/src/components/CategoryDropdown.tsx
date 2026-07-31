import React, { useState, useEffect, useRef } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/solid";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import { STATUS } from "@/configs/constants";
import DropdownCloseIcon from "./DropdownCloseIcon";
import { useTranslation } from "react-i18next";

const CategoryDropdown = ({ value, onChange, onInputChange, forListing = false, isDropdown = false }: any) => {
  const [categories, setCategories] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef(null);
  const headers = getAuthHeaders() || {
    "Content-Type": "application/json",
  };
  const { t, i18n } = useTranslation('common');
  useEffect(() => {
    const fetchCategories = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/categories?type=GET_CATEGORIES&status=${STATUS.ACTIVE}&lang_code=${i18n.language}&is_dropdown=${isDropdown}`, {
          method: "GET",
          headers,
        });
        const result = await response.json();
        if (result.data && result.data.records) {
          setCategories(result.data.records);

          // If value is a category ID, find and set the corresponding category name
          const selectedCategory = result.data.records.find(
            (category: any) => category.id === value
          );
          if (selectedCategory) {
            setInputValue(selectedCategory.name);
          }
        }
      } catch (error) {
        console.error("Error fetching categories:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategories();
  }, []);

  useEffect(() => {
    // If value is a category ID, find and set the corresponding category name
    const selectedCategory = categories.find(
      (category: any) => category.id === value
    );
    if (selectedCategory?.name) {
      setInputValue(selectedCategory.name);
    }
  },[value, categories])

  useEffect(() => {
    // Close dropdown when clicking outside
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

  const handleCategorySelect = (category: any) => {
    setInputValue(category.name);
    if (onInputChange) {
      onInputChange(category.name); // Notify parent about inputValue change
    }
    onChange(category.id);
    setIsOpen(false);
  };

  useEffect(() => {
    if (onInputChange) {
      onInputChange(inputValue); // Notify parent about initial inputValue
    }
  }, [inputValue, onInputChange]);

  useEffect(() => {
    // If value is cleared, also clear inputValue
    if (!value) {
      setInputValue("");
      if (onInputChange) {
        onInputChange("");
      }
    }
  }, [value, onInputChange]);

  return (
    <div className="tw-w-full tw-mb-4" ref={dropdownRef}>
      <div className="tw-relative">
        <div className="tw-flex tw-items-center tw-relative">
          <input
            type="text"
            className="tw-w-full tw-px-4 tw-py-2 tw-rounded-3xl tw-bg-white tw-border tw-border-gray-400 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 tw-font-normal tw-text-black tw-placeholder-gray-500 tw-cursor-pointer"
            placeholder={t("developments.categories")}
            name="category_name"
            value={inputValue}
            readOnly
            onClick={() => setIsOpen((prev) => !prev)}
            style={{
              border: "1px solid #D0D5DD",
              
            }}
          />
          <ChevronDownIcon
            className="tw-w-5 tw-h-5 tw-absolute tw-right-3 tw-text-gray-500 tw-cursor-pointer"
            onClick={() => setIsOpen(!isOpen)}
          />
        </div>

        {isOpen && (
          <div
            className="tw-absolute !tw-z-50 tw-w-full tw-mt-1 tw-bg-white tw-rounded-3xl tw-shadow-lg tw-border tw-border-gray-200 tw-max-h-60 tw-custom-scrollbar tw-overflow-y-auto"
            style={{ width: forListing ? "265px" : "100%", borderRadius:  "5px" }}
          >
          {/* <DropdownCloseIcon onClick={() => setIsOpen(false)} /> */}

            <div className={`tw-p-3 tw-m-2 tw-font-medium tw-rounded-xl tw-bg-blue-50 tw-text-black`}>
              {t('categoryDropdown.selectFromCategories')}
            </div>

            {isLoading ? (
              <div className="tw-p-3 tw-text-center tw-text-gray-500">
                {t('loadingMessages.loading')}...
              </div>
            ) : categories.length > 0 ? (
              categories.map((category: any) => (
                <div
                  key={category.id}
                  className="tw-p-3 tw-cursor-pointer tw-text-black hover:tw-bg-gray-100"
                  onClick={() => handleCategorySelect(category)}
                >
                  {category.name}
                </div>
              ))
            ) : (
              <div className="tw-p-3 tw-text-center tw-text-gray-500">
                {t('categoryDropdown.noCategoriesFound')}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryDropdown;
