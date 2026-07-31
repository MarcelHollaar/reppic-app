import MetricCard from "@/app/conversations/insights/[id]/src/components/metrics/MetricCard";
import { t } from "i18next";

interface MetricsProps {
  title: string;
  totalScore: number;
  atmosphere: string;
  salespersonPercentage: number | null;
}

export const Metrics = ({
  title,
  totalScore,
  atmosphere,
  salespersonPercentage,
}: MetricsProps) => {
  return (
    <div className="tw-bg-white tw-rounded-xl tw-shadow-sm tw-p-6 tw-mb-6">
      <div className="tw-flex tw-flex-col md:tw-flex-row tw-justify-between tw-gap-6">
        <div className="tw-flex-1 tw-max-w-[150vh]">
          <h1 className="tw-text-[1rem] md:tw-text-[1.375rem] tw-font-bold tw-text-gray-900 tw-mb-2">
            {title ? title.charAt(0).toUpperCase() + title.slice(1) : ""}
          </h1>
          <p className="tw-text-sm tw-text-gray-500 tw-mb-6">
            {t("insightsPage.description")}
          </p>
        </div>

        <div className="tw-flex tw-gap-2 md:tw-gap-4 tw-flex-nowrap tw-overflow-x-auto md:tw-overflow-x-clip">
          <MetricCard
            value={
              Number.isFinite(Number(totalScore))
                ? Number(totalScore).toFixed(1)
                : "N/A"
            }
            label={t("conversationsListing.score")}
            bgColor="tw-bg-blue-50"
          />

          <MetricCard
            value={t(`atmosphereValues.${atmosphere || "N/A"}`)}
            label={t("conversationsListing.atmosphere")}
            bgColor="tw-bg-indigo-50"
          />

          <MetricCard
            value={
              salespersonPercentage === null ||
              salespersonPercentage === undefined
                ? "N/A"
                : `${salespersonPercentage}%`
            }
            label={t("conversationsListing.salespersonSpeaks")}
            bgColor="tw-bg-gray-100"
          />
        </div>
      </div>
    </div>
  );
};
