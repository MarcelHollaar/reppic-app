import React, { useState, useEffect, useRef } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/solid";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import { STATUS } from "@/configs/constants";
import DropdownCloseIcon from "./DropdownCloseIcon";
import { useTranslation } from "react-i18next";

const TagDropdown = ({
  value,
  onChange,
  onInputChange,
  forLibrary = false,
  isDropdown = false
}: {
  value: string[];
  onChange: (value: string[]) => void;
  onInputChange?: (value: string) => void; 
  forLibrary: boolean;
  isDropdown?: boolean;
}) => {
  const [tags, setTags] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>(value || []);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef(null);
  const headers = getAuthHeaders() || {
    "Content-Type": "application/json",
  };
  const { t, i18n } = useTranslation('common');
  useEffect(() => {
    const fetchTags = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/tags?type=GET_TAGS&status=${STATUS.ACTIVE}&lang_code=${i18n.language}&is_dropdown=${isDropdown}`, {
          method: "GET",
          headers,
        });
        const result = await response.json();
        if (result.data && result.data.records) {
          setTags(result.data.records);

          // If value is an array of tag IDs and forLibrary is false, populate tag names
          if (!forLibrary && value.length > 0) {
            const selectedTagNames = result.data.records
              .filter((tag: any) => value.includes(tag.id))
              .map((tag: any) => tag.id);
            setSelectedTags(selectedTagNames);
          }
        }
      } catch (error) {
        console.error("Error fetching tags:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTags();
  }, [forLibrary]);

  useEffect(() => {
    // If value is an array of tag IDs and forLibrary is false, populate tag names
    if (!forLibrary && value.length > 0) {
      const selectedTagNames = tags
        .filter((tag: any) => value.includes(tag.id))
        .map((tag: any) => tag.id);
      setSelectedTags(selectedTagNames);
    }
  }, [value, tags, forLibrary]);

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

  const handleTagSelect = (tag: any) => {
    if (forLibrary) {
      // Single-select behavior
      const selectedTagName = tag.name;
      setSelectedTags([tag.id]);
      onChange([tag.id]);
      if (onInputChange) {
        onInputChange(selectedTagName); // Notify parent about input value change
      }
      setIsOpen(false);
    } else {
      // Multi-select behavior
      const updatedTags = selectedTags.includes(tag.id)
        ? selectedTags.filter((id) => id !== tag.id) // Remove tag if already selected
        : [...selectedTags, tag.id]; // Add tag if not selected
      setSelectedTags(updatedTags);
      onChange(updatedTags);
    }
  };

  useEffect(() => {
    // If value is cleared, also clear selectedTags
    if (!value || value.length === 0) {
      setSelectedTags([]);
      if (onInputChange) {
        onInputChange("");
      }
    }
  }, [value, onInputChange]);

  return (
    <div className="tw-w-full tw-mb-4" ref={dropdownRef}>
      <div className="tw-relative">
        <div className="tw-flex tw-items-center tw-relative tw-cursor-pointer">
          <input
            type="text"
            className="tw-w-full tw-px-4 tw-py-2 tw-rounded-3xl tw-bg-white tw-border tw-border-gray-400 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 tw-font-normal tw-text-black tw-placeholder-gray-500 tw-cursor-pointer"
            placeholder={t("common.tags")}
            value={selectedTags
              .map((id) => tags.find((tag: any) => tag.id === id)?.name)
              .join(", ")}
            readOnly
            onClick={() => setIsOpen(!isOpen)}
            style={{ border: "1px solid #D0D5DD" }}
          />
          <ChevronDownIcon
            className="tw-w-5 tw-h-5 tw-absolute tw-right-3 tw-text-gray-500 tw-cursor-pointer"
            onClick={() => setIsOpen(!isOpen)}
          />
        </div>

        {isOpen && (
          <div
            className="tw-absolute !tw-z-50 tw-w-full tw-mt-1 tw-bg-white tw-rounded-3xl tw-shadow-lg tw-border tw-border-gray-200 tw-max-h-60 tw-custom-scrollbar tw-overflow-y-auto"
            style={{ width: forLibrary ? "155px" : "100%", borderRadius:  "5px" }}
          >
            {/* <DropdownCloseIcon onClick={() => setIsOpen(false)} /> */}
            <div className={`tw-p-3 tw-m-2 tw-font-medium tw-rounded-xl tw-bg-blue-50 tw-text-black`}>
              {t('tagsDropdown.selectTags')}
            </div>

            {isLoading ? (
              <div className="tw-p-3 tw-text-center tw-text-gray-500">
                {t('loadingMessages.loading')}...
              </div>
            ) : tags.length > 0 ? (
              tags.map((tag: any) => (
                <div
                  key={tag.id}
                  className={`tw-p-3 tw-cursor-pointer hover:tw-bg-gray-100 tw-text-black ${
                    selectedTags.includes(tag.id) ? "tw-bg-blue-100" : ""
                  }`}
                  onClick={() => handleTagSelect(tag)}
                >
                  {tag.name}
                </div>
              ))
            ) : (
              <div className="tw-p-3 tw-text-center tw-text-gray-500">
                {t('tagsDropdown.noTagsFound')}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TagDropdown;
