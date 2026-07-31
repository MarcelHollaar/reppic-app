"use client";
import { Metrics } from "@/app/conversations/insights/[id]/src/components/metrics/Metrics";
import { Phases } from "@/app/conversations/insights/[id]/src/components/phases/Phases";
import { useConversationInsightsContext } from "@/app/conversations/insights/[id]/src/providers/ConversationInsightsProvider";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

export function ConversationInsightsPage() {
  const { t } = useTranslation("common");
  const { conversation } = useConversationInsightsContext();
  const router = useRouter();

  return (
    <>
      <div className="tw-mb-4 tw-mt-0 md:tw-mt-4">
        <div className="tw-flex tw-items-center tw-justify-between tw-mb-4">
          <button
            onClick={() => router.back()}
            className="tw-flex tw-items-center tw-gap-2 tw-bg-blue-100 tw-text-blue-800 tw-rounded-full tw-h-10 tw-px-5 tw-font-medium tw-text-[0.875rem] hover:tw-bg-blue-200"
          >
            <ArrowLeftIcon className="tw-w-5 tw-h-5" />
            {t("conversationsListing.summary")}
          </button>
        </div>
      </div>
      {conversation && (
        <>
          <Metrics
            title={conversation.title}
            totalScore={conversation.conversation_summaries[0].total_score}
            atmosphere={conversation.conversation_summaries[0].atmosphere}
            salespersonPercentage={
              conversation.conversation_summaries[0].salesperson_percentage
            }
          />
          <Phases
            conversationSummaries={conversation.conversation_summaries}
            customerType={
              conversation.conversation_summaries[0]?.customer_type || "Groen"
            }
          />
        </>
      )}
    </>
  );
}

export default ConversationInsightsPage;
