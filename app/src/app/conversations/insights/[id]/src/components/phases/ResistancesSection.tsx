import React, { useState } from "react";
import ResistanceCard from "./ResistanceCard";
import { useTranslation } from "react-i18next";
import { Resistance } from "@/app/conversations/[id]/src/providers/ConversationDetailProvider";

interface ResistancesSectionProps {
  resistances: Resistance[];
}

const ResistancesSection: React.FC<ResistancesSectionProps> = ({
  resistances,
}) => {
  const { t } = useTranslation("common");
  const [showAll, setShowAll] = useState(false);

  const displayCount = 4;
  const shouldShowReadMore = resistances.length > displayCount;
  const visibleResistances = showAll
    ? resistances
    : resistances.slice(0, displayCount);

  return (
    <div className="tw-mb-6">
      <h2 className="!tw-text-[1.375rem] !tw-font-medium tw-font-inter tw-mb-4 tw-text-center md:tw-text-left">
        {t("resistancesSection.resistances")}
      </h2>
      <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-6">
        {visibleResistances.map((item, index: number) => (
          <ResistanceCard
            key={index}
            isCorrect={
              item?.Conclusion === "Goed" || item?.Conclusion === "Good"
            }
            resistance={item?.Objection}
            response={item?.Response}
            explanation={item?.Reasoning}
          />
        ))}
      </div>
      {shouldShowReadMore && !showAll && (
        <div className="tw-mt-4 tw-text-center">
          <button
            className="tw-text-blue-600 tw-underline tw-cursor-pointer tw-bg-transparent tw-border-none tw-p-0 tw-font-medium"
            onClick={() => setShowAll(true)}
          >
            {t("phaseCardItem.readMore")}
          </button>
        </div>
      )}
      {shouldShowReadMore && showAll && (
        <div className="tw-mt-4 tw-text-center">
          <button
            className="tw-text-blue-600 tw-underline tw-cursor-pointer tw-bg-transparent tw-border-none tw-p-0 tw-font-medium"
            onClick={() => setShowAll(false)}
          >
            {t("phaseCardItem.readLess")}
          </button>
        </div>
      )}
    </div>
  );
};

export default ResistancesSection;
