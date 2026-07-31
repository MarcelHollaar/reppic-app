import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/solid";
import React from "react";
import { useTranslation } from "react-i18next";

interface ResistanceCardProps {
  isCorrect: boolean;
  resistance: string;
  response: string;
  explanation: string;
}

const ResistanceCard: React.FC<ResistanceCardProps> = ({
  isCorrect,
  resistance,
  response,
  explanation,
}) => {
  const { t } = useTranslation("common");

  return (
    <div className="tw-bg-white tw-rounded-xl tw-shadow-sm tw-p-6 tw-flex-1">
      <div className="tw-flex tw-justify-between tw-items-center tw-mb-4">
        <div className="tw-flex tw-items-center">
          <div className={`tw-rounded-full`}>
            {isCorrect ? (
              <CheckCircleIcon className="tw-w-6 tw-h-6" color="green" />
            ) : (
              <XCircleIcon className="tw-w-6 tw-h-6" color="red" />
            )}
          </div>
          <span className="tw-ml-1 tw-text-base tw-font-semibold">
            {isCorrect
              ? t("resistanceCard.correct")
              : t("resistanceCard.incorrect")}
          </span>
        </div>
      </div>
      <div className="tw-border-b tw-border-gray-200 tw--mx-6 tw-mb-2"></div>

      <div className="tw-grid tw-gap-y-3 tw-gap-x-0 tw-grid-cols-1 lg:tw-grid-cols-[20%_80%]">
        <div className="tw-font-semibold tw-text-sm">
          {t("resistanceCard.resistance")}:
        </div>
        <div className="!tw-text-[#757575] tw-text-sm tw-font-normal">
          {resistance}
        </div>

        <div className="tw-font-semibold tw-text-sm">
          {t("resistanceCard.response")}:
        </div>
        <div className="!tw-text-[#757575] tw-text-sm tw-font-normal">
          {response}
        </div>

        <div className="tw-font-semibold tw-text-sm">
          {t("resistanceCard.explanation")}:
        </div>
        <div className="!tw-text-[#757575] tw-text-sm tw-font-normal">
          {explanation}
        </div>
      </div>
    </div>
  );
};

export default ResistanceCard;
