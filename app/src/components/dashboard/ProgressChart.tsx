"use client";
import dynamic from "next/dynamic";
import { useTranslation } from "react-i18next";

const AreaChart = dynamic(() => import("@/theme/components/charts/area-chart"), {
  ssr: false,
});

type Props = {
  labels: string[];
  data: number[];
};

  const convertTo24Hour = (time12: string, langCode: string): string => {
    
    if (langCode === 'en') return time12;
    if (!time12 || (!time12.toUpperCase().includes('AM') && !time12.toUpperCase().includes('PM'))) return time12;
    
    const [time, period] = time12.split(" ");
    const [hours, minutes] = time.split(":");
    let hour = parseInt(hours, 10);

    if (period.toUpperCase() === "AM" && hour === 12) {
      hour = 0;
    } else if (period.toUpperCase() === "PM" && hour !== 12) {
      hour += 12;
    }

    return `${hour.toString().padStart(2, "0")}:${minutes}`;
  };

export default function ProgressChart({ labels, data }: Props) {
  // Dynamically set minWidth to allow scroll
  const chartMinWidth = `${labels.length * 60}px`; // adjust factor as needed
  const { t, i18n } = useTranslation('common');
 
    // Map labels to their translated version using months namespace
  const translatedLabels = labels.map(label => {
  // Match "Jun 03", "03 Jun", "01 Jul"
  const monthAtStart = /^([A-Za-z]+)\s(\d{2})$/.exec(label);
  const monthAtEnd = /^(\d{2})\s([A-Za-z]+)$/.exec(label);
  const monthOnly = /^([A-Za-z]+)$/.exec(label);
  let translated = label; 
  if (monthAtStart) {
    const [, month, day] = monthAtStart;
    const translatedMonth = t(`months.${month.toLowerCase()}`, month);
    translated = `${translatedMonth} ${day}`;
  } else if (monthAtEnd) {
    const [, day, month] = monthAtEnd;
    const translatedMonth = t(`months.${month.toLowerCase()}`, month);
    translated = `${day} ${translatedMonth}`;
  } else if (monthOnly) {
    const [, month] = monthOnly;
    translated = t(`months.${month.toLowerCase()}`, month);
  }
  // fallback: return as is
   return convertTo24Hour(translated, i18n.language);
});

  return (
    <div className=" tw-overflow-y-hidden tw-overflow-x-auto table-scrollbar tw-mb-2">
      <div style={{ minWidth: chartMinWidth }}>
        <AreaChart
          colors={["#5870F6"]}
          options={{
            chart: {
              height: 200,
            },
            xaxis: {
              categories: translatedLabels,
              labels: {
                rotate: -45,
                style: {
                  fontSize: "11px",
                },
              },
            },
            grid: {
              show: false,
            },
          }}
          series={[
            {
              name: "Average Score",
              data,
            },
          ]}
        />
      </div>
    </div>
  );
}

