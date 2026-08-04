import { t } from "i18next";
import { formatBasicTextToSafeHtml } from "@/utils/safeHtml";

interface ConversationSummaryProps {
  summary: string;
  learningPoints: string[];
}

export const ConversationSummary = ({
  summary,
  learningPoints,
}: ConversationSummaryProps) => {
  return (
    <div className="tw-bg-white tw-rounded-2xl tw-p-5" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)" }}>
      <div className="tw-flex tw-flex-col">
        {/* Summary Section */}
        <h2 className="tw-text-base tw-font-semibold tw-text-gray-900 tw-mb-4">
          {summary ? t("conversationsListing.summary") : ""}
        </h2>
        <p className="tw-text-sm tw-text-gray-700 tw-mb-6">
          {/* Render summary with bold formatting for **text** */}
          <span
            className="tw-leading-tight custom-br"
            dangerouslySetInnerHTML={{ __html: formatBasicTextToSafeHtml(summary) }}
          />
        </p>

        {/* Learning Points Section — alleen tonen als er punten zijn, zodat er
            geen lege kop (of hardcoded placeholder) blijft staan. */}
        {learningPoints && learningPoints.length > 0 && (
          <>
            <h2 className="tw-text-base tw-font-semibold tw-text-gray-900 tw-mb-4">
              {t("conversationsListing.learningPoints")}
            </h2>
            <ul className="tw-list-disc tw-pl-5">
              {learningPoints.map((point, index) => (
                <li
                  key={index}
                  className="tw-text-sm tw-text-gray-700 tw-mb-1"
                >
                  {point}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
};
