import React, { useState, useRef, useEffect } from "react";
import { Typography } from "@material-tailwind/react";
import { ChevronDownIcon, XMarkIcon } from "@heroicons/react/24/solid";
import DropdownCloseIcon from "./DropdownCloseIcon";
import { useTranslation } from "react-i18next";
const AmPmDropdown = ({
  value,
  onChange,
}: {
  value: "AM" | "PM";
  onChange: (value: "AM" | "PM") => void;
}) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="tw-relative tw-w-12 tw-rounded-xl" ref={dropdownRef}>
      <div
        onClick={(e) => {
          e.stopPropagation(); // <-- this prevents outside click listener from TimeSlotDropdown
          setOpen(!open);
        }}
        className="tw-flex tw-items-center tw-rounded-xl tw-justify-center tw-h-full tw-cursor-pointer tw-bg-gray-100 !tw-text-sm tw-border-l tw-border-gray-300 tw-px-1 tw-py-[.15rem]"
      >
        {value}
        <ChevronDownIcon className="tw-w-4 tw-h-4 tw-ml-1" />
      </div>

      {open && (
        <div className="tw-absolute tw-top-full tw-left-0 tw-z-10 tw-w-full tw-bg-white tw-border tw-border-gray-300 tw-rounded-md tw-shadow-md">
          {["AM", "PM"].map((period) => (
            <div
              key={period}
              onClick={() => {
                onChange(period as "AM" | "PM");
                setOpen(false);
              }}
              className={`tw-py-1 tw-text-center tw-text-[11px] hover:tw-bg-blue-100 tw-cursor-pointer ${
                value === period ? "tw-font-semibold" : ""
              }`}
            >
              {period}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface TimeSlotDropdownProps {
  onStartTimeChange: (time: string) => void;
  onEndTimeChange: (time: string) => void;
  startTime?: string;
  endTime?: string;
}

const TimeSlotDropdown: React.FC<TimeSlotDropdownProps> = ({
  onStartTimeChange,
  onEndTimeChange,
  startTime = "",
  endTime = "",
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [selectedStartTime, setSelectedStartTime] = useState<string>(startTime);
  const [selectedEndTime, setSelectedEndTime] = useState<string>(endTime);
  const [dropdownPosition, setDropdownPosition] = useState<"bottom" | "top">("bottom");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const { t, i18n } = useTranslation('common');
  // Helper function to convert 24h to 12h format
  const convertTo12Hour = (time24: string): string => {
    if (!time24) return "";
    const [hours, minutes] = time24.split(":");
    const hour = parseInt(hours, 10);
    const period = hour >= 12 ? "PM" : "AM";
    const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${hour12.toString().padStart(2, "0")}:${minutes} ${period}`;
  };

  // Helper function to convert 12h to 24h format
  const convertTo24Hour = (time12: string): string => {
    if (!time12) return "";
    const [time, period] = time12.split(" ");
    const [hours, minutes] = time.split(":");
    let hour = parseInt(hours, 10);

    if (period === "AM" && hour === 12) {
      hour = 0;
    } else if (period === "PM" && hour !== 12) {
      hour += 12;
    }

    return `${hour.toString().padStart(2, "0")}:${minutes}`;
  };

  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = `${String(hour).padStart(2, "0")}:${String(
          minute
        ).padStart(2, "0")}`;
        slots.push(time);
      }
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

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
    if (startTime && startTime !== selectedStartTime) {
      setSelectedStartTime(startTime);
    }
    if (endTime && endTime !== selectedEndTime) {
      setSelectedEndTime(endTime);
    }
  }, [startTime, endTime]);

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const dropdownHeight = 420; // Approximate dropdown height (adjust as needed)
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
        setDropdownPosition("top");
      } else {
        setDropdownPosition("bottom");
      }
    }
  }, [isOpen]);

  const handleStartTimeSelect = (time: string) => {
    setSelectedStartTime(time);
    onStartTimeChange(time); // Send 24h format to parent
    // Reset end time if it's before or equal to the new start time
    if (
      selectedEndTime &&
      timeSlots.indexOf(selectedEndTime) <= timeSlots.indexOf(time)
    ) {
      setSelectedEndTime("");
      onEndTimeChange("");
    }
  };

  const handleEndTimeSelect = (time: string) => {
    setSelectedEndTime(time);
    onEndTimeChange(time); // Send 24h format to parent
  };

  const handleManualStartTimeChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const inputValue = e.target.value;
    if (!inputValue) return;

    let time24 = inputValue;
    if (i18n.language === "en") {
      // For English, input is 12-hour, so convert
      time24 = convertTo24Hour(inputValue);
    }
    setSelectedStartTime(time24);
    onStartTimeChange(time24);

    // Reset end time if it's before or equal to the create start time
    if (selectedEndTime && selectedEndTime <= time24) {
      setSelectedEndTime("");
      onEndTimeChange("");
    }
  };

  const handleManualEndTimeChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const inputValue = e.target.value;
    if (!inputValue) return;

    // Convert input to 24h format for internal state and parent callback
    const time24 = convertTo24Hour(inputValue);

    // Only allow end times that are after the start time
    if (!selectedStartTime || time24 > selectedStartTime) {
      setSelectedEndTime(time24);
      onEndTimeChange(time24);
    }
  };

  const displayText =
    selectedStartTime && selectedEndTime
      ? `${selectedStartTime} - ${selectedEndTime}`
      : t("timeSlot.selectTheTime");

  return (
    <div className="tw-w-full tw-mb-2" ref={dropdownRef}>
      <Typography
        variant="h6"
        className="!tw-font-semibold !tw-text-black tw-mb-2 tw-font-[system-ui]"
      >
        {t('timeSlot.meetingTime')}
        <span className="tw-text-red-500">*</span>
      </Typography>
      <div className="tw-relative">
        <div
          className="tw-w-full tw-px-4 tw-py-2 tw-rounded-3xl tw-bg-white tw-border tw-border-gray-400 tw-flex tw-items-center tw-justify-between tw-cursor-pointer"
          onClick={() => setIsOpen(!isOpen)}
          ref={triggerRef}
        >
          <span
            className={`${
              !selectedStartTime && !selectedEndTime
                ? "tw-font-normal tw-text-black tw-placeholder-gray-600"
                : "tw-font-normal tw-text-black tw-placeholder-gray-600"
            }`}
          >
            {displayText}
          </span>
          <ChevronDownIcon className="tw-w-5 tw-h-5 tw-text-gray-500" />
        </div>

        {isOpen && (
          <div
            className={`tw-absolute tw-w-auto sm:tw-w-[23rem] tw-z-10 tw-w-sm tw-bg-white tw-rounded-3xl tw-shadow-lg tw-border tw-border-gray-200 tw-overflow-hidden ${
              dropdownPosition === "top" ? "tw-bottom-full tw-mb-1" : "tw-mt-1"
            }`}
            style={{...(dropdownPosition === "top" ? { bottom: "100%" } : { top: "100%" }), borderRadius: "5px"}}
          >
            <div className="tw-p-4">
              {/* <DropdownCloseIcon onClick={() => setIsOpen(false)} /> */}
              <div className="tw-flex tw-items-center tw-justify-center tw-gap-4 tw-mb-3 tw-mt-2">
                <div className="tw-flex-1 tw-text-center tw-font-medium">
                  {t('timeSlot.from')}
                </div>
                <div className="tw-font-bold">—</div>
                <div className="tw-flex-1 tw-text-center tw-font-medium">
                  {t('timeSlot.to')}
                </div>
              </div>

              <div className="tw-flex tw-gap-2">
                {/* Start Time Column */}
                <div className="tw-flex-1 tw-h-64 tw-overflow-y-auto tw-pr-2 tw-custom-scrollbar">
                  {/* Custom 12h Time Input for Start Time */}
                  <div className="tw-w-full tw-h-[32px] tw-mb-2">
                    <div className="tw-flex tw-flex-col">
                      {/* Row for input and AM/PM */}
                      <div className="tw-flex tw-w-full tw-items-center tw-space-x-2">
                        {/* Time Input */}
                        <div className="tw-flex-1 tw-h-full tw-border tw-border-gray-300 tw-rounded-full tw-overflow-hidden">
                          <input
                            type="time"
                            value={
                              selectedStartTime
                                ? i18n.language === "en"
                                  ? convertTo12Hour(selectedStartTime).split(" ")[0] // 12h for English
                                  : selectedStartTime // 24h for other languages
                                : ""
                            }
                            onChange={handleManualStartTimeChange}
                            className="tw-w-full tw-h-full tw-text-center tw-text-[13px] tw-border-none tw-outline-none"
                          />
                        </div>

                        {/* AM/PM Dropdown */}
                        {i18n.language === 'en' && (<AmPmDropdown
                          value={
                            selectedStartTime
                              ? (convertTo12Hour(selectedStartTime).split(
                                  " "
                                )[1] as "AM" | "PM")
                              : "AM"
                          }
                          onChange={(ampm) => {
                            if (selectedStartTime) {
                              const timeOnly =
                                convertTo12Hour(selectedStartTime).split(
                                  " "
                                )[0];
                              const newTime12 = `${timeOnly} ${ampm}`;
                              const time24 = convertTo24Hour(newTime12);
                              setSelectedStartTime(time24);
                              onStartTimeChange(time24);

                              if (
                                selectedEndTime &&
                                selectedEndTime <= time24
                              ) {
                                setSelectedEndTime("");
                                onEndTimeChange("");
                              }
                            }
                          }}
                        />)}
                      </div>
                    </div>
                  </div>

                  {timeSlots.map((time) => {
                    const isDisabled =
                      selectedEndTime &&
                      timeSlots.indexOf(time) >=
                        timeSlots.indexOf(selectedEndTime);
                    return (
                      <div
                        key={`start-${time}`}
                        className={`tw-w-[120px] tw-h-[32px] tw-text-[15px] tw-rounded-full tw-mb-2 tw-text-center tw-flex tw-items-center tw-justify-center ${
                          isDisabled
                            ? "tw-bg-gray-200 tw-text-gray-500 tw-cursor-not-allowed"
                            : selectedStartTime === time
                            ? "tw-bg-indigo-50"
                            : "tw-bg-gray-100 hover:tw-bg-gray-200 tw-cursor-pointer"
                        }`}
                        onClick={
                          !isDisabled
                            ? () => handleStartTimeSelect(time)
                            : undefined
                        }
                      >
                        {time}
                      </div>
                    );
                  })}
                </div>

                {/* End Time Column */}
                <div className="tw-flex-1 tw-h-64 tw-overflow-y-auto tw-pl-2 tw-pr-2 tw-custom-scrollbar">
                  <div className="tw-w-full tw-h-[32px] tw-mb-2">
                    <div className="tw-flex tw-flex-col">
                      {/* Row for input and AM/PM */}
                      <div className="tw-flex tw-w-full tw-items-center tw-space-x-2">
                        {/* Time Input */}
                        <div className="tw-flex-1 tw-h-full tw-border tw-border-gray-300 tw-rounded-full tw-overflow-hidden">
                          <input
                            type="time"
                            value={
                              selectedEndTime
                                ? i18n.language === "en"
                                  ? convertTo12Hour(selectedEndTime).split(" ")[0] // 12h for English
                                  : selectedEndTime // 24h for other languages
                                : ""
                            }
                            onChange={handleManualEndTimeChange}
                            className="tw-w-full tw-h-full tw-text-center tw-text-[13px] tw-border-none tw-outline-none"
                          />
                        </div>

                        {/* AM/PM Dropdown */}
                        {i18n.language === 'en' && (<AmPmDropdown
                          value={
                            selectedEndTime
                              ? (convertTo12Hour(selectedEndTime).split(
                                  " "
                                )[1] as "AM" | "PM")
                              : "AM"
                          }
                          onChange={(ampm) => {
                            if (selectedEndTime) {
                              const timeOnly =
                                convertTo12Hour(selectedEndTime).split(" ")[0];
                              const newTime12 = `${timeOnly} ${ampm}`;
                              const time24 = convertTo24Hour(newTime12);

                              if (
                                !selectedStartTime ||
                                time24 > selectedStartTime
                              ) {
                                setSelectedEndTime(time24);
                                onEndTimeChange(time24);
                              }
                            }
                          }}
                        />)}
                      </div>
                    </div>
                  </div>

                  {timeSlots.map((time) => {
                    const isDisabled =
                      selectedStartTime &&
                      timeSlots.indexOf(time) <=
                        timeSlots.indexOf(selectedStartTime);
                    return (
                      <div
                        key={`end-${time}`}
                        className={`tw-w-[120px] tw-h-[32px] tw-text-[15px] tw-rounded-full tw-mb-2 tw-text-center tw-flex tw-items-center tw-justify-center ${
                          isDisabled
                            ? "tw-bg-gray-200 tw-text-gray-500 tw-cursor-not-allowed"
                            : selectedEndTime === time
                            ? "tw-bg-indigo-50"
                            : "tw-bg-gray-100 hover:tw-bg-gray-200 tw-cursor-pointer"
                        }`}
                        onClick={
                          !isDisabled
                            ? () => handleEndTimeSelect(time)
                            : undefined
                        }
                      >
                        {time}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Custom scrollbar styles */}
      <style jsx global>{`
        .tw-custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }

        .tw-custom-scrollbar::-webkit-scrollbar-track {
          background: #e0f2fe; /* Light blue track */
          border-radius: 10px;
        }

        .tw-custom-scrollbar::-webkit-scrollbar-thumb {
          background: #a2aef7; /* Blue thumb */
          border-radius: 10px;
        }

        .tw-custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #a2aef7; /* Darker blue on hover */
        }
      `}</style>
    </div>
  );
};

export default TimeSlotDropdown;