"use client";
import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/solid";
import { useTranslation } from "react-i18next";

interface CustomCalendarProps {
  selectedDate: Date | null;
  onDateChange: (date: Date) => void;
  onClose: () => void;
}

export const CalendarCard: React.FC<CustomCalendarProps> = ({
  selectedDate: initialSelectedDate,
  onDateChange,
  onClose,
}) => {
  // Set today's date as the default if no date is selected
  const router = useRouter(); 
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState<Date>(
    initialSelectedDate || today
  );
  const [currentMonth, setCurrentMonth] = useState(
    initialSelectedDate || today
  );

  const calendarRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation('common')
  // Navigate to previous month
  const prevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  // Navigate to next month
  const nextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
    );
  };

  // Handle date selection
  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    router.push(`/conversations?date=${format(date, "yyyy-MM-dd")}`);
  };

  // Generate calendar days
  const generateCalendarDays = () => {
    const month = currentMonth.getMonth();
    const year = currentMonth.getFullYear();

    const firstDayOfMonth = startOfMonth(currentMonth);
    const lastDayOfMonth = endOfMonth(currentMonth);

    const startDay = startOfWeek(firstDayOfMonth, { weekStartsOn: 1 });
    const endDay = endOfWeek(lastDayOfMonth, { weekStartsOn: 1 });

    const days = [];
    let day = startDay;

    while (day <= endDay) {
      days.push({
        date: day,
        isCurrentMonth: day.getMonth() === month,
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
    <div
      className="tw-bg-white tw-min-h-[28rem] tw-rounded-xl tw-shadow tw-p-6 tw-w-full tw-border tw-border-gray-200"
      ref={calendarRef}
    >
      {/* Header */}
      <div className="tw-flex tw-justify-between tw-items-center tw-mb-4">
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
      <div className="tw-border-b tw-border-gray-200 tw--mx-4 tw-mb-4"></div>

      {/* Weekdays */}
      <div className="tw-grid tw-grid-cols-7 tw-text-center tw-gap-1">
        {[t("weekDays.mo"), t("weekDays.tu"), t("weekDays.we"),
         t("weekDays.th"), t("weekDays.fr"), t("weekDays.sa"), t("weekDays.su")].map((day) => (
          <div key={day} className="tw-font-medium tw-text-sm tw-py-3">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Days */}
      <div className="tw-grid tw-grid-cols-7 tw-text-center tw-gap-1">
        {generateCalendarDays().map((day, index) => (
          <div
            key={index}
            className={`tw-rounded-full tw-py-5 tw-my-2 tw-w-10 tw-h-8 tw-flex tw-items-center tw-justify-center tw-cursor-pointer tw-text-sm
                ${day.isCurrentMonth ? "tw-text-gray-900" : "tw-text-gray-400"}
                ${
                  format(selectedDate, "yyyy-MM-dd") ===
                  format(day.date, "yyyy-MM-dd")
                    ? "tw-bg-gray-100 tw-text-black"
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
  );
};

export default CalendarCard;
