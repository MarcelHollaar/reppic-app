import {
  ConversationSummaries,
  Phase,
} from "@/app/conversations/[id]/src/providers/ConversationDetailProvider";
import CustomerTypeSection from "@/app/conversations/insights/[id]/src/components/phases/CustomerTypeSection";
import PhaseSection from "@/app/conversations/insights/[id]/src/components/phases/PhaseSection";
import ResistancesSection from "@/app/conversations/insights/[id]/src/components/phases/ResistancesSection";
import { t } from "i18next";

interface PhasesProps {
  customerType: string;
  conversationSummaries: ConversationSummaries[];
}

export const Phases = ({
  conversationSummaries,
  customerType,
}: PhasesProps) => {
  const iconMap: Record<string, string> = {
    "Break the Ice": "/img/meeting.svg",
    "Sales Pitch": "/img/presentation.svg",
    "Goal of the meeting": "/img/bullseye-arrow.svg",
    "Managing expectations of the meeting": "/img/career-growth.svg",
    "Contact Person": "/img/address-book.svg",
    Company: "/img/company.svg",
    Cooperation: "/img/meeting.svg",
    Consequences: "/img/consequences.svg",
    Cure: "/img/treatment.svg",
    Questioning: "/img/comment-question.svg",
    "Customer Type": "/img/target-audience.svg",
    "USP to UBR Connection": "/img/terms-info.svg",
    Result: "/img/result.svg",
    Acknowledgement: "/img/acknowledgement.svg",
    Agreement: "/img/document.svg",
  };

  const mappedPhaseData = conversationSummaries[0]?.phases?.reduce(
    (acc: any, phase: Phase) => {
      const phaseNumber = phase?.Fase;
      const originalPhaseTitle = phase?.Titel;
      const phaseTitle = phase?.Titel?.toLowerCase();

      // Find a matching icon in iconMap (converted to lowercase for comparison)
      const phaseIcon = Object.keys(iconMap).find(
        (key) => key.toLowerCase() === phaseTitle
      )
        ? iconMap[
            Object.keys(iconMap).find(
              (key) => key.toLowerCase() === phaseTitle
            )!
          ]
        : "/img/document.svg"; // Fallback if no match

      // Find or create the phase group
      let existingPhase = acc.find((p) => p?.phaseNumber === phaseNumber);
      if (!existingPhase) {
        existingPhase = { phaseNumber, cards: [] };
        acc.push(existingPhase);
      }

      // Add the phase details as a card
      existingPhase.cards.push({
        iconSrc: phaseIcon,
        title: originalPhaseTitle,
        description: phase, // Store the **whole phase object** for modal view
        points: phase.Score,
      });

      return acc;
    },
    []
  );

  return (
    <>
      {mappedPhaseData && mappedPhaseData.length > 0 ? (
        mappedPhaseData.map((phase: Phase, index: number) => (
          <PhaseSection
            key={phase.phaseNumber}
            phaseNumber={phase.phaseNumber}
            cards={phase.cards}
          />
        ))
      ) : (
        <p className="tw-text-sm tw-text-gray-500">
          {t("insightsPage.phaseDataNotAvailable")}
        </p>
      )}

      {conversationSummaries[0]?.resistances &&
        conversationSummaries[0]?.resistances.length > 0 && (
          <ResistancesSection
            resistances={conversationSummaries[0]?.resistances}
          />
        )}
      <CustomerTypeSection customerType={customerType} />
    </>
  );
};
