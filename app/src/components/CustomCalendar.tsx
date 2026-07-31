"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  subMonths,
} from "date-fns";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import DropdownCloseIcon from "./DropdownCloseIcon";
import { useTranslation } from "react-i18next";
import { localeMap } from "@/configs/constants";
import { capitalizeMonthInFormattedDate } from "@/utils/helperFunctions";
interface CustomCalendarProps {
  onDateChange?: (date: Date) => void;
  selectedDate?: Date | string | null;
}

const CustomCalendar: React.FC<CustomCalendarProps> = ({ onDateChange, selectedDate }) => {
  const [internalSelectedDate, setInternalSelectedDate] = useState<Date | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dropdownPosition, setDropdownPosition] = useState<"bottom" | "top">("bottom");
  const calendarRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { t, i18n } = useTranslation('common');
  const formatStr = i18n.language === 'en' ? "MMM d, yyyy" : "d MMM, yyyy";
  const currentLocaleForCalendar = localeMap[i18n.language] || localeMap.en;
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
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
      const dropdownHeight = 340; // Approximate calendar height (adjust as needed)
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
        setDropdownPosition("top");
      } else {
        setDropdownPosition("bottom");
      }
    }
  }, [isOpen, currentMonth]);

  // Sync internal state with selectedDate prop
  useEffect(() => {
    if (selectedDate) {
      let dateObj: Date | null = null;
      if (typeof selectedDate === "string") {
        // Try to parse string as date
        dateObj = new Date(selectedDate);
        if (isNaN(dateObj.getTime())) dateObj = null;
      } else if (selectedDate instanceof Date) {
        dateObj = selectedDate;
      }
      setInternalSelectedDate(dateObj);
    }
  }, [selectedDate]);

  const handleDateClick = (date: Date) => {
    setInternalSelectedDate(date);
    setIsOpen(false);
    onDateChange?.(date);
  };

  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () =>
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
    );

  const selectToday = () => {
    const today = new Date();
    setInternalSelectedDate(today);
    setIsOpen(false);
    onDateChange?.(today);
  };

  const generateCalendarDays = () => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });

    const days = [];
    let day = start;
    while (day <= end) {
      days.push({
        date: day,
        isCurrentMonth: day.getMonth() === currentMonth.getMonth(),
      });
      day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
    }
    return days;
  };

    // Get translated month name
    const monthKey = format(currentMonth, "MMMM").toLowerCase(); // e.g., "march"
    const translatedMonth =
      t(`fullMonths.${monthKey}`) !== `fullMonths.${monthKey}`
        ? t(`fullMonths.${monthKey}`)
        : format(currentMonth, "MMMM");
    const year = format(currentMonth, "yyyy");

  return (
    <div className="tw-w-full tw-mb-2 tw-relative" ref={dropdownRef}>
      <label className="tw-font-semibold tw-text-black tw-mb-2 tw-block">
        {t('customCalendar.meetingDate')}
        <span className="tw-text-red-500">*</span>
      </label>
      <div className="tw-relative">
        <input
          type="text"
          className="tw-w-full tw-px-4 tw-py-2 tw-rounded-3xl tw-bg-white tw-border tw-border-gray-400 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 tw-text-black tw-placeholder-gray-500 tw-cursor-pointer"
          placeholder={t("customCalendar.selectMeetingDate")}
          value={internalSelectedDate ? capitalizeMonthInFormattedDate(format(internalSelectedDate, formatStr, { locale: currentLocaleForCalendar }), formatStr) : ""}
          onClick={() => setIsOpen((prev) => !prev)}
          readOnly
          ref={inputRef}
        />
        <div className="tw-absolute tw-right-3 tw-top-1/2 -tw-translate-y-1/2">
          <ChevronDownIcon className="tw-w-5 tw-h-5" />
        </div>
        {isOpen && (
          <div
            ref={calendarRef}
            className={`tw-absolute tw-z-50 tw-bg-white tw-rounded-3xl tw-shadow-lg tw-border tw-border-gray-200 ${dropdownPosition === "top" ? "tw-bottom-full tw-mb-2" : "tw-mt-2"}`}
            style={{...(dropdownPosition === "top" ? { bottom: "100%" } : { top: "100%" }), borderRadius: "5px"}}
          >
            <div className="tw-p-4">
            {/* <DropdownCloseIcon onClick={() => setIsOpen(false)} /> */}
              <div className="tw-flex tw-justify-between tw-items-center tw-mb-4 tw-mt-4">
                <button className="tw-p-1" onClick={prevMonth}>
                  <ChevronLeftIcon className="tw-w-5 tw-h-5" />
                </button>
                <span className="tw-font-medium">
                  {translatedMonth} {year}
                </span>
                <button className="tw-p-1" onClick={nextMonth}>
                  <ChevronRightIcon className="tw-w-5 tw-h-5" />
                </button>
              </div>

              <div className="tw-flex tw-justify-between tw-mb-2">
                <input
                  type="text"
                  className="tw-border tw-border-gray-300 tw-rounded-lg tw-p-2 tw-mr-2"
                  value={
                    internalSelectedDate ? capitalizeMonthInFormattedDate(format(internalSelectedDate, formatStr, { locale: currentLocaleForCalendar }), formatStr) : ""
                  }
                  readOnly
                />
                <button
                  type="button"
                  className="tw-border tw-border-gray-300 tw-rounded-lg tw-p-2"
                  onClick={selectToday}
                >
                  {t('customCalendar.today')}
                </button>
              </div>

              <div className="tw-grid tw-grid-cols-7 tw-text-center tw-gap-1">
                {[t("weekDays.mo"), t("weekDays.tu"), t("weekDays.we"),
                  t("weekDays.th"), t("weekDays.fr"), t("weekDays.sa"), t("weekDays.su")].map((day) => (
                  <div key={day} className="tw-font-medium tw-text-sm tw-py-1">
                    {day}
                  </div>
                ))}

                {generateCalendarDays().map((day, index) => (
                  <div
                    key={index}
                    className={`tw-rounded-full tw-w-8 tw-h-8 tw-flex tw-items-center tw-justify-center tw-cursor-pointer tw-text-sm
                      ${
                        day.isCurrentMonth
                          ? "tw-text-gray-900"
                          : "tw-text-gray-400"
                      }
                      ${
                        internalSelectedDate &&
                        format(internalSelectedDate, "yyyy-MM-dd") ===
                          format(day.date, "yyyy-MM-dd")
                          ? "tw-bg-blue-500 tw-text-white"
                          : "hover:tw-bg-blue-100 hover:tw-text-blue-300"
                      }
                    `}
                    onClick={() => handleDateClick(day.date)}
                  >
                    {format(day.date, "d")}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomCalendar;
