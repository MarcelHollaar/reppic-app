import React, { useState } from "react";
import Image from "next/image";
import { ChatBubbleBottomCenterIcon, XCircleIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";
import { escapeHtml } from "@/utils/safeHtml";

interface PhaseCardItemProps {
  iconSrc: string;
  title: string;
  description: any; // Now expecting an object with phase details
  points: number;
  maxPoints?: number;
  pointLabel?: string;
}

const PhaseCardItem: React.FC<PhaseCardItemProps> = ({
  iconSrc,
  title,
  description,
  points,
  maxPoints,
  pointLabel = "Point",
}) => {
  const { t } = useTranslation("common");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  pointLabel = pointLabel === "Point" ? t("phaseCardItem.point") : pointLabel;

  // Translate the fixed phase title to the active UI language; fall back to
  // the stored title for older analyses with non-canonical titles.
  const displayTitle = t(`phaseCardTitles.${title?.trim()}`, {
    defaultValue: title?.trim() || "",
  });
  const openDialog = () => {
    setIsDialogOpen(true);
    document.body.style.overflow = "hidden"; // Prevent scrolling when dialog is open
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    document.body.style.overflow = "auto"; // Restore scrolling
  };

  // ✅ Get the `Doel` field from the description and truncate it
  const shortDescription = description?.Doel
    ? `${description.Doel.substring(0, 80)}${
        description.Doel.length > 80 ? "... " : ""
      }`
    : t("phaseCardItem.noDescriptionAvailable");
  // ✅ Filter out "Doel" and "PuntenGoed" before displaying in the modal
  const filteredDetails = Object.entries(description).filter(
    ([key]) =>
      key !== "Doel" &&
      key !== "PuntenGoed" &&
      key !== "Fase" &&
      key !== "Titel" &&
      key !== "Score" &&
      key !== "Toekenning punten fout" &&
      key !== "Toekenning punten goed" &&
      key !== "Toekenning punten deels goed" &&
      key !== "PuntenDeelsGoed" &&
      // Also filter out the new English format
      key !== "ToekenningPuntenFout" &&
      key !== "ToekenningPuntenGoed" &&
      key !== "ToekenningPuntenDeelsGoed"
  );
  const pointsAllocationDetails = Object.entries(description).filter(
    ([key]) => 
      // Support both old Dutch and new English formats
      key === "Toekenning punten fout" || 
      key === "Toekenning punten goed" || 
      key === "Toekenning punten deels goed" ||
      key === "ToekenningPuntenFout" ||
      key === "ToekenningPuntenGoed" ||
      key === "ToekenningPuntenDeelsGoed"
  );

  // The modal shows the full rubric (goal, analysis points, examples, point
  // allocation), which exists for every phase — so "read more" must be available
  // whenever there is expandable content, not only when the truncated goal text
  // overflowed. The old `Doel.length > 80` check hid the modal for phases with a
  // short goal (e.g. Company / Result, and the borderline Doorvragen).
  const hasExpandableContent =
    Boolean(description?.Doel) ||
    filteredDetails.length > 0 ||
    pointsAllocationDetails.length > 0;

  return (
    <>
      {/* Phase Card */}
      <div className="tw-bg-white tw-rounded-2xl tw-shadow-sm tw-p-6">
        <div className="tw-flex tw-justify-between tw-items-start tw-mb-4">
          <div className="tw-rounded-full tw-bg-blue-50 tw-p-3">
            <Image src={iconSrc} alt={title} width={24} height={24} />
          </div>
          <p className="tw-text-sm tw-text-gray-500 tw-font-medium">
            {description?.Score || 0}{" "}
            {points === 1 ? pointLabel : t('resistanceCard.points')}
          </p>
        </div>

        {/* Title */}
        <h2 className="tw-text-base tw-font-semibold tw-text-gray-900 tw-mb-2">
          <span suppressHydrationWarning>{displayTitle}</span>
        </h2>

        {/* ✅ Truncated `Doel` with Read More button */}
        <p className="tw-text-sm tw-text-gray-500 tw-font-normal">
          {shortDescription}{" "}
          {hasExpandableContent && (
            <button
              className="tw-text-blue-900 tw-font-medium"
              onClick={openDialog}
            >
              {t('phaseCardItem.readMore')}
            </button>
          )}
        </p>
      </div>

      {/* ✅ Full Details Popup Modal */}
      {isDialogOpen && (
        <div
          className="tw-fixed tw-inset-0 tw-bg-black tw-bg-opacity-50 tw-z-50 tw-flex tw-items-center tw-justify-center tw-p-4"
          onClick={closeDialog}
        >
          <div
            className="tw-bg-white tw-rounded-xl tw-shadow-lg tw-max-w-3xl tw-w-full tw-max-h-[90vh] table-scrollbar tw-overflow-y-auto tw-relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ✅ Close Icon */}
            <button
              onClick={closeDialog}
              className="tw-absolute tw-top-4 tw-right-4 tw-text-gray-400 hover:tw-text-gray-600"
            >
              <XMarkIcon className="tw-w-8 tw-h-8"/>
            </button>

            <div className="tw-p-8">
              {/* Header */}
              <div className="tw-flex tw-items-center tw-gap-4 tw-mb-4">
                <div className="tw-rounded-full tw-bg-blue-50 tw-p-4">
                  <Image src={iconSrc} alt={title} width={32} height={32} />
                </div>
                <div>
                  <h2 className="tw-text-base tw-font-bold tw-text-gray-900 tw-capitalize">
                    <span suppressHydrationWarning>{displayTitle}</span>
                  </h2>
                  <p className="tw-text-sm tw-text-gray-600">
                    {description?.Score || 0}{" "}
                    {points <= 2 ? pointLabel : t('resistanceCard.points')}
                  </p>
                </div>
              </div>

              {/* Full `Doel` description */}
              <p className="tw-text-sm tw-text-gray-700 tw-mb-4">
                <strong>{t('phaseCardItem.goal')}:</strong>{" "}
                {description?.Doel || t('phaseCardItem.noGoalProvided')}
              </p>

              {/* Additional Phase Details */}
              <div className="tw-bg-gray-100 tw-rounded-lg tw-p-4 tw-mb-6">
                {filteredDetails.map(([key, value]) => {
                  if (!value || key === 'PuntenFout') return null;

                  const lines = value.toString().split('\n');

                  return (
                    <p key={key} className="tw-text-sm tw-text-gray-700 tw-mb-3 custom-br">
                      <strong>{t(`insightPopup.${key.replace(/_/g, " ")}`)}:</strong>{" "}
                      {key === 'AnalysePunten' && <br />}
                      {lines.length > 1 ? (
                        // Multi-line handling
                        lines.map((line, index) => {
                          if (line === '') return null; // Skip empty lines
                          const trimmed = line.trim();

                          if (trimmed.startsWith('Effect:')) {
                            return (
                              <React.Fragment key={index}>
                                <br />
                                <span className="small-gap-2"></span>
                                <span
                                  dangerouslySetInnerHTML={{
                                    __html: escapeHtml(trimmed).replace(
                                      /^Effect:/,
                                      `<strong>${t('insightPopup.effect')}:</strong>`
                                    ),
                                  }}
                                ></span>
                              </React.Fragment>
                            );
                          }

                          return (
                            <React.Fragment key={index}>
                              {index > 0 && <br />}
                              <span
                                dangerouslySetInnerHTML={{
                                  __html: escapeHtml(trimmed.replace(/^Start:/, '').trim()),
                                }}
                              ></span>
                            </React.Fragment>
                          );
                        })
                      ) : (
                        // Single line with no '\n'
                        (() => {
                          let text = lines[0].trim();

                          // Remove "Start:" at beginning if present
                          text = text.replace(/^Start:/, '').trim();

                          if (text.includes('Effect:')) {
                            const parts = text.split(/Effect:/);
                            return (
                              <>
                                {parts[0]}
                                <span className="small-gap-2"></span>
                                <strong>{t('insightPopup.effect')}:</strong>
                                {parts[1]}
                              </>
                            );
                          }

                          return <>{text}</>;
                        })()
                      )}
                    </p>
                  );
                })}

                <p className="tw-text-sm tw-text-gray-700 tw-mb-3">
                  <strong>{t('insightPopup.ToekenningPunten')}</strong>
                </p>
                {pointsAllocationDetails.map(([key, value]) =>{
                  if (!value || key === 'PuntenFout') return null;
                  
                  // For translation, we always want to use the old Dutch names
                  // But we need to map the new English field names to get the right values
                  let translationKey = key;
                  let displayValue = value;
                  
                  // If we have new English format, map to old Dutch for translation
                  if (key === "ToekenningPuntenFout") {
                    translationKey = "Toekenning punten fout";
                  } else if (key === "ToekenningPuntenGoed") {
                    translationKey = "Toekenning punten goed";
                  } else if (key === "ToekenningPuntenDeelsGoed") {
                    translationKey = "Toekenning punten deels goed";
                  }
                  
                  return (
                    <p key={key} className="tw-text-sm tw-text-gray-700 tw-mb-2">
                      <strong>
                        {t(`insightPopup.${translationKey.replace(/_/g, " ")}`, {
                          PuntenFout: description?.PuntenFout,
                          PuntenDeelsGoed: description?.PuntenDeelsGoed,
                          Score: description?.PuntenGoed,
                        })}:</strong>{" "}
                      {displayValue.toString()}
                    </p>
                  )
                })}
              </div>

              {/* Close Button */}
              <div className="tw-flex tw-justify-start">
                <button
                  onClick={closeDialog}
                  className="tw-bg-[#5971F6] tw-text-white tw-rounded-full tw-px-6 tw-py-2 tw-font-medium hover:tw-bg-blue-600"
                >
                  {t('phaseCardItem.okayGotIt')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PhaseCardItem;
