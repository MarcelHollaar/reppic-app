import i18n from "@/lib/i18n";
import { t } from "i18next";
import { useRouter } from "next/navigation";
import moment from "moment-timezone";

interface ConversationProfileCardProps {
  conversationId: string;
  name: string;
  role: string;
  score: number | string;
  salespersonSpeaks: number | string;
  atmosphere: string;
  createdAt: string;
}

export const ConversationProfileCard = ({
  conversationId,
  name,
  role,
  score,
  salespersonSpeaks,
  atmosphere,
  createdAt,
}: ConversationProfileCardProps) => {
  const router = useRouter();

  const handleDevelopmentPlanClick = () => {
    // LMS is nu native onderdeel van de app: direct naar de leeromgeving.
    router.push("/learning");
  };

  return (
    <div className="tw-w-full md:tw-w-1/3">
      <div className="tw-bg-white tw-rounded-2xl tw-p-5" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)" }}>
        <div className="tw-flex tw-flex-col">
          <div className="tw-flex tw-items-center tw-gap-4 tw-mb-6">
            <img
              src="/img/avatar.png"
              alt="Profile"
              className="tw-w-16 tw-h-16 tw-rounded-full"
            />
            <div>
              <h2 className="tw-text-base tw-font-semibold tw-text-gray-900">
                {name === "Unknown Customer"
                  ? t("common.unknownCustomer")
                  : name}
              </h2>
              <p className="tw-text-sm tw-text-gray-500">
                {role === "Customer" ? t("common.customer") : role}
              </p>
            </div>
          </div>

          <div className="tw-space-y-2 tw-mb-6">
            <div className="tw-flex tw-justify-between tw-items-center">
              <span className="tw-text-sm tw-font-semibold tw-text-gray-900">
                {t("conversationsListing.score")}
              </span>
              <span className="tw-bg-[#E1F1FF] tw-text-black tw-px-3 tw-py-1 tw-rounded-full tw-text-sm tw-font-medium tw-inline-block tw-w-14 tw-text-center tw-min-w-[4.5rem] tw-text-center">
                {Number.isFinite(Number(score))
                  ? Number(score).toFixed(1)
                  : score ?? "N/A"}
              </span>
            </div>
            <div className="tw-flex tw-justify-between tw-items-center">
              <span className="tw-text-sm tw-font-semibold tw-text-gray-900">
                {t("conversationsListing.salespersonSpeaks")}
              </span>
              <div className="tw-bg-[#E1F1FF] tw-text-black tw-px-4 tw-py-1 tw-rounded-full tw-text-sm tw-min-w-[4.5rem] tw-text-center">
                {salespersonSpeaks === "N/A"
                  ? salespersonSpeaks
                  : `${salespersonSpeaks}%`}
              </div>
            </div>
            <div className="tw-flex tw-justify-between tw-items-center">
              <span className="tw-text-sm tw-font-semibold tw-text-gray-900">
                {t("conversationsListing.atmosphere")}
              </span>
              <span className="tw-bg-[#E1F1FF] tw-text-black tw-px-4 tw-py-1 tw-rounded-full tw-text-sm tw-min-w-[4.5rem] tw-text-center">
                {t(`atmosphereValues.${atmosphere}`, "N/A")}
              </span>
            </div>
            <div>
              <div className="tw-flex tw-justify-between tw-items-center">
                <span className="tw-text-sm tw-font-semibold tw-text-gray-900">
                  {t("conversationsListing.dateCreated")}{" "}
                </span>
                <span className="tw-text-black tw-text-sm">
                  {createdAt &&
                    moment(createdAt).locale(i18n.language).format("ll")}
                </span>
              </div>
            </div>
          </div>

          <div className="tw-flex tw-flex-col lg:tw-flex-row tw-gap-3 tw-mb-6">
            <button
              onClick={() =>
                router.push(`/conversations/insights/${conversationId}`)
              }
              className="tw-flex-1 tw-bg-[#5971F6] tw-text-white tw-rounded-xl tw-px-4 tw-py-2 tw-text-sm tw-font-semibold hover:tw-opacity-90 tw-transition-opacity"
            >
              {t("conversationsListing.viewInsights")}
            </button>
            <button
              onClick={handleDevelopmentPlanClick}
              className="tw-flex-1 tw-bg-[#F5F6F8] tw-text-gray-700 tw-rounded-xl tw-px-4 tw-py-2 tw-text-sm tw-font-medium hover:tw-bg-gray-200 tw-transition-colors"
            >
              {t("conversationsListing.developmentPlan")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
