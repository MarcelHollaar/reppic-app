// src/components/LanguageSwitcher.tsx
'use client';

import { getAuthHeaders } from '@/utils/getAuthHeaders';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDownIcon } from "@heroicons/react/24/solid";
import supportedLocalesJson from '../../supported-locales.json';
import DropdownCloseIcon from "./DropdownCloseIcon";
import { supportedLanguages } from "@/configs/constants";
import LanguageConfirmDialog from './settings/LanguageConfirmDialog';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const headers = getAuthHeaders();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const {t} = useTranslation('common')

  const [dropdownPosition, setDropdownPosition] = useState<"bottom" | "top">("bottom");
  const triggerRef = useRef<HTMLDivElement>(null);
  const [ openDialog, setOpenDialog ] = useState(false);
  const [selectedCode, setSelectedCode] = useState('')
  useEffect(() => {
    (async () => {
      try {

         // Check for lang code in the URL path
        const localePattern = new RegExp(`^/(${supportedLocalesJson.join('|')})(?=/|$)`, 'i');
        const pathname = window.location.pathname;
        if (localePattern.test(pathname)) {
          const token = localStorage.getItem("token") || null;
          // Remove NEXT_LOCALE cookie
          document.cookie = "NEXT_LOCALE=; path=/; max-age=0; SameSite=Strict";
          let newPathname = pathname.replace(localePattern, '');
          if (!newPathname.startsWith('/')) newPathname = '/' + newPathname;
          newPathname = newPathname.replace(/\/{2,}/g, '/');
          // if (token) {
          //   window.location.replace("/dashboard");
          // } else {
          //   window.location.replace('/auth/signin/basic');
          // }
        }

        const response = await fetch("/api/user/settings?type=GET_USER_LANG_PREFERENCES", {
          method: "GET",
          headers: {...headers},
        });
        const result = await response.json();
        if (!response.ok) {
          return;
        }
        const { lang_code } = result.data;
        if (lang_code) {
          i18n.changeLanguage(lang_code)
            .then(() => {
              // Set NEXT_LOCALE cookie client-side
              document.cookie = `NEXT_LOCALE=${lang_code}; path=/; SameSite=Strict`;
            })
            .catch((error) => {
              console.log(`[LanguageSwitcher] Error setting initial language:`, error);
            });
        }
      } catch (error) {
        console.log(error);
      }
    })();
  }, []);

  const changeLocale = useCallback(
    (locale: string) => {
      i18n.changeLanguage(locale)
        .then(() => {
          // Set NEXT_LOCALE cookie client-side
          document.cookie = `NEXT_LOCALE=${locale}; path=/; SameSite=Strict`;
        })
        .catch((error) => {
          console.error(`[LanguageSwitcher] Error changing language to ${locale}:`, error);
          i18n.changeLanguage('en');
          document.cookie = `NEXT_LOCALE=en; path=/; SameSite=Strict`;
        });
        const token = localStorage.getItem("token") || null;
        if (!token) {
          return;
        }

      if (locale) {
        fetch("/api/user/settings", {
          method: "POST",
          headers,
          body: JSON.stringify({ data:{ langCode: locale }, type: 'UPDATE_USER_LANG_PREFERENCES' }),
        })
          .then((response) => response.json())
          .then((data) => {
            if (!data?.data?.user?.success) {
              console.error(`[LanguageSwitcher] Error updating language preference:`, data.error);
            }
          })
          .catch((error) => {
            console.error(`[LanguageSwitcher] Error updating language preference:`, error);
          });
      }
    },
    [i18n]
  );

  // Close dropdown when clicking outside
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

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const dropdownHeight = 260; // Approximate dropdown height (adjust as needed)
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
        setDropdownPosition("top");
      } else {
        setDropdownPosition("bottom");
      }
    }
  }, [isOpen]);

  const handleDialog = (langCode: string) => {
    if (langCode) {
      setSelectedCode(langCode);
      setOpenDialog(true);
    }
  }

  const handleConfirm = () => {
    changeLocale(selectedCode);
    setOpenDialog(false);
  }

  return (
    <>
    <div className="tw-mb-0" ref={dropdownRef} style={{ width: "145px" }}>
      <div className="tw-relative">
        <div
          className="tw-flex tw-items-center tw-relative tw-cursor-pointer"
          ref={triggerRef}
        >
          <input
            type="text"
            className="tw-w-full tw-px-4 tw-py-2 tw-rounded-3xl tw-bg-white tw-border tw-border-gray-400 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 tw-font-normal tw-text-black tw-placeholder-gray-500 tw-cursor-pointer"
            placeholder="Language"
            value={t(`languageLabels.${supportedLanguages.find(l => l.code === i18n.language)?.label?.toLowerCase()}`) || ""}
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
            className={`tw-absolute !tw-z-50 tw-w-full tw-bg-white tw-rounded-3xl tw-shadow-lg tw-border tw-border-gray-200 tw-max-h-80
              ${dropdownPosition === "top" ? "tw-bottom-full tw-mb-1" : "tw-mt-1"}
            `}
            style={
              dropdownPosition === "top"
                ? { width: "155px", borderRadius: "5px", bottom: "100%" }
                : { width: "155px", borderRadius: "5px", top: "100%" }
            }
          >
            {supportedLanguages.map((lang, index) => (
              <div
                key={lang.code}
                className={`tw-p-3 tw-cursor-pointer hover:tw-bg-gray-100 tw-text-black ${
                  i18n.language === lang.code ? "tw-bg-blue-100" : ""
                } ${index === 0 ? "tw-rounded-tl-[5px] tw-rounded-tr-[5px]" : ""} ${index === supportedLanguages.length - 1 ? "tw-rounded-bl-[5px] tw-rounded-br-[5px]" : ""}`}
                onClick={() => {
                  handleDialog(lang.code);
                  setIsOpen(false);
                }}
              >
                {t(`languageLabels.${lang.label?.toLowerCase()}`) || lang.label}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    <LanguageConfirmDialog isOpen={openDialog} onClose={() => setOpenDialog(false)} onConfirm={handleConfirm} />
    </>
  );
}