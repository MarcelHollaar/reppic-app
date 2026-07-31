"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  subDays,
  subMonths,
  addMonths,
  isSameDay,
} from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon, XMarkIcon } from "@heroicons/react/24/solid";
import DropdownCloseIcon from "./DropdownCloseIcon";
import { useTranslation } from "react-i18next";
import { localeMap } from "@/configs/constants";
import { capitalizeMonthInFormattedDate } from "@/utils/helperFunctions";
interface DateRangePickerProps {
  dateRange: [Date | null, Date | null];
  setDateRange: (range: [Date | null, Date | null]) => void;
  onFilterApplied?: () => void;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  dateRange,
  setDateRange,
  onFilterApplied,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const {t, i18n} = useTranslation('common');
  const currentLocaleForCalendar = localeMap[i18n.language] || localeMap.en;
  const formatStr = i18n.language === 'en' ? "MMM d, yyyy" : "d MMM, yyyy";
  // Function to close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Function to set date ranges based on preset options
  const setPresetDateRange = (option: string) => {
    const today = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    switch (option) {
      case "Today":
        startDate = endDate = today;
        break;
      case "Yesterday":
        startDate = endDate = subDays(today, 1);
        break;
      case "This Week":
        startDate = startOfWeek(today, { weekStartsOn: 1 });
        endDate = endOfWeek(today, { weekStartsOn: 1 });
        break;
      case "Last Week":
        startDate = startOfWeek(subDays(today, 7), { weekStartsOn: 1 });
        endDate = endOfWeek(subDays(today, 7), { weekStartsOn: 1 });
        break;
      case "This Month":
        startDate = startOfMonth(today);
        endDate = endOfMonth(today);
        break;
      case "Last Month":
        startDate = startOfMonth(subMonths(today, 1));
        endDate = endOfMonth(subMonths(today, 1));
        break;
      default:
        return;
    }

    setDateRange([startDate, endDate]);
    setSelectedPreset(option);
    setIsOpen(false);

    // Trigger the callback to notify parent component
    if (onFilterApplied) {
      onFilterApplied();
    }
  };

  // Navigate to previous month
  const prevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  // Navigate to next month
  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  // Generate calendar days for the current month view
  const generateCalendarDays = () => {
    const month = currentMonth.getMonth();
    const year = currentMonth.getFullYear();

    const firstDayOfMonth = startOfMonth(currentMonth);
    const lastDayOfMonth = endOfMonth(currentMonth);

    const startDay = startOfWeek(firstDayOfMonth, { weekStartsOn: 1 }); // Monday
    const endDay = endOfWeek(lastDayOfMonth, { weekStartsOn: 1 });

    const days = [];
    let day = startDay;

    while (day <= endDay) {
      days.push({
        date: new Date(day),
        isCurrentMonth: day.getMonth() === month,
      });
      day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
    }

    return days;
  };

  // Handle date selection
  const handleDateClick = (date: Date) => {
    if (!dateRange[0] || (dateRange[0] && dateRange[1])) {
      // If no start date is selected or both dates are selected, set the clicked date as start date
      setDateRange([date, null]);
    } else {
      // If only start date is selected, set the clicked date as end date
      // Make sure start date is before end date
      if (date < dateRange[0]) {
        setDateRange([date, dateRange[0]]);
      } else {
        setDateRange([dateRange[0], date]);
      }
  
      if (dateRange[0]) {
        // Both dates are now selected, close the calendar
        setIsOpen(false);
        if (onFilterApplied) {
          onFilterApplied();
        }
      }
    }
  
    setSelectedPreset(null);
  };  

  // Check if a date is in the selected range
  const isInRange = (date: Date) => {
    if (!dateRange[0] || !dateRange[1]) {
      return false;
    }
    return date >= dateRange[0] && date <= dateRange[1];
  };

  // Check if a date is in the hover range
  const isInHoverRange = (date: Date) => {
    if (!dateRange[0] || dateRange[1] || !hoverDate) {
      return false;
    }

    return (
      (date > dateRange[0] && date <= hoverDate) ||
      (date < dateRange[0] && date >= hoverDate)
    );
  };

  // Format the display date range text
  const formatDateRangeText = () => {
    if (selectedPreset) {
      return t(`customCalendar.${selectedPreset}`, selectedPreset);
    }

    if (dateRange[0] && dateRange[1]) {
      if (isSameDay(dateRange[0], dateRange[1])) {
        return capitalizeMonthInFormattedDate(format(dateRange[0], formatStr, { locale: currentLocaleForCalendar }), formatStr);
      }
      return `${capitalizeMonthInFormattedDate(
        format(dateRange[0], formatStr, { locale: currentLocaleForCalendar }),
        formatStr
      )} - ${capitalizeMonthInFormattedDate(
        format(dateRange[1], formatStr, { locale: currentLocaleForCalendar }),
        formatStr
      )}`;
    }

    if (dateRange[0]) {
      return `${capitalizeMonthInFormattedDate(
        format(dateRange[0], formatStr, { locale: currentLocaleForCalendar }),
        formatStr
      )} - ${t('dateRangePicker.selectEndDate')}`;
    }

    return t("dateRangePicker.selectDateRange");
  };

    // Get translated month name
  const monthKey = format(currentMonth, "MMMM").toLowerCase(); // e.g., "march"
  const translatedMonth =
    t(`fullMonths.${monthKey}`) !== `fullMonths.${monthKey}`
      ? t(`fullMonths.${monthKey}`)
      : format(currentMonth, "MMMM");
  const year = format(currentMonth, "yyyy");

  return (
    <div className="tw-relative tw-inline-block" ref={pickerRef}>
      {/* Date Range Selector Button */}
      <button
        className="tw-flex tw-items-center tw-justify-start tw-w-auto tw-px-4 tw-py-2 tw-border tw-border-gray-300 tw-rounded-full tw-bg-white"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="tw-mr-4">
          <img src="/img/calendar_icon.svg" alt="calendar icon" />
        </span>
        <span className="tw-text-black">{formatDateRangeText()}</span>
      </button>

      {/* DatePicker Dropdown - Fixed positioning issues */}
      {isOpen && (
        <div className="tw-absolute tw-right-0 tw-mt-2 tw-bg-white tw-shadow-lg tw-border tw-border-gray-200 tw-rounded-3xl tw-z-50 tw-flex tw-flex-col md:tw-flex-row tw-w-72 md:tw-w-auto" style={{ borderRadius: "5px"}}>
        {/* Close Icon */}
         {/* <DropdownCloseIcon onClick={() => setIsOpen(false)} /> */}
          {/* Preset Filters */}
          <div className="tw-p-4 md:tw-border-r tw-border-gray-200 tw-w-full md:tw-w-40">
            <div className="tw-grid tw-grid-cols-2 md:tw-block tw-gap-2 md:tw-space-y-2 tw-font-normal">
              {[
                "Today",
                "Yesterday",
                "This Week",
                "Last Week",
                "This Month",
                "Last Month",
              ].map((option) => (
                <button
                  key={option}
                  className={`tw-text-left tw-p-2 tw-rounded-lg tw-text-sm ${
                    selectedPreset === option
                      ? "tw-bg-blue-500 tw-text-white"
                      : "hover:tw-bg-blue-100 tw-text-gray-500 tw-text-[#008bff]"
                  }`}
                  
                  onClick={() => setPresetDateRange(option)}
                >
                  {t(`customCalendar.${option}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Calendar */}
          <div className="tw-p-4 tw-pt-8 tw-w-full md:tw-w-72">
            {/* Month navigation */}
            <div className="tw-flex tw-justify-between tw-items-center tw-mb-4 tw-text-gray-500">
              <button type="button" className="tw-p-1" onClick={prevMonth}>
                <ChevronLeftIcon className="tw-w-5 tw-h-5" />
              </button>
              <span className="tw-font-medium">
                {translatedMonth} {year}
              </span>
              <button type="button" className="tw-p-1" onClick={nextMonth}>
                <ChevronRightIcon className="tw-w-5 tw-h-5" />
              </button>
            </div>

            {/* Selected date range */}
            <div className="tw-mb-4 tw-border tw-border-gray-200 tw-rounded-lg tw-p-2">
              <div className="tw-flex tw-justify-between tw-items-center">
                <div className="tw-text-sm tw-text-gray-600">
                 {dateRange[0]
                    ? capitalizeMonthInFormattedDate(format(dateRange[0], formatStr, { locale: currentLocaleForCalendar }), formatStr)
                    : t("common.startDate")}
                </div>
                <div className="tw-mx-2">-</div>
                <div className="tw-text-sm tw-text-gray-600">
                  {dateRange[1]
                    ? capitalizeMonthInFormattedDate(format(dateRange[1], formatStr, { locale: currentLocaleForCalendar }), formatStr)
                    : t("common.endDate")}
                </div>
              </div>
            </div>

            {/* Calendar days */}
            <div className="tw-grid tw-grid-cols-7 tw-gap-1 tw-text-center tw-text-gray-500">
              {[t("weekDays.mo"), t("weekDays.tu"), t("weekDays.we"),
                  t("weekDays.th"), t("weekDays.fr"), t("weekDays.sa"), t("weekDays.su")].map((day) => (
                <div key={day} className="tw-font-medium tw-text-sm tw-py-1">
                  {day}
                </div>
              ))}

              {generateCalendarDays().map((day, index) => {
                const isStart =
                  dateRange[0] && isSameDay(day.date, dateRange[0]);
                const isEnd = dateRange[1] && isSameDay(day.date, dateRange[1]);
                const isSelected = isStart || isEnd;
                const isRange = isInRange(day.date);
                const isHoverRange = isInHoverRange(day.date);

                return (
                  <div
                    key={index}
                    className={`tw-rounded-full tw-w-8 tw-h-8 tw-flex tw-items-center tw-justify-center tw-cursor-pointer tw-text-sm
                    ${day.isCurrentMonth ? "tw-text-gray-900" : "tw-text-gray-400"}
                    ${isSelected ? "tw-bg-blue-500 tw-text-white" : ""}
                    ${isRange && !isSelected ? "tw-bg-blue-100" : ""}
                    ${isHoverRange ? "tw-bg-blue-50" : ""}
                    ${!isSelected && !isRange ? "hover:tw-bg-blue-100" : ""}
                  `}
                    onClick={() => handleDateClick(day.date)}
                    onMouseEnter={() => setHoverDate(day.date)}
                    onMouseLeave={() => setHoverDate(null)}
                  >
                    {format(day.date, "d")}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;
