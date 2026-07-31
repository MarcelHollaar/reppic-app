import React from "react";
import PhaseCardItem from "./PhaseCardItem";
import { useTranslation } from "react-i18next";

interface PhaseCardData {
  iconSrc: string;
  title: string;
  description: string;
  points: number;
}

interface PhaseSectionProps {
  phaseNumber: number;
  title?: string;
  cards: PhaseCardData[];
}

const PhaseSection: React.FC<PhaseSectionProps> = ({
  phaseNumber,
  title = `Phase ${phaseNumber}`,
  cards,
}) => {
  const { t } = useTranslation('common');
  title = `${t('addVideo.phase')} ${phaseNumber}`
  return (
    <div className="tw-mb-8">
      <h2 className="tw-text-[1.375rem] tw-font-medium tw-text-gray-900 tw-mb-4 tw-text-center md:tw-text-left">
        {title}
      </h2>

      <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 lg:tw-grid-cols-4 tw-gap-4">
        {cards.map((card, index) => (
          <PhaseCardItem
            key={index}
            iconSrc={card.iconSrc}
            title={card.title}
            description={card.description}
            points={card.points}
          />
        ))}
      </div>
    </div>
  );
};

export default PhaseSection;
