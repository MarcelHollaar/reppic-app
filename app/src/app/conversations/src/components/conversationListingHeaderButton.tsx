import { t } from "i18next";
import { ArrowLeftIcon } from "lucide-react";
import { useRouter } from "next/navigation";

export const ConversationListingHeaderButton = () => {
  const router = useRouter();
  return (
    <div className="tw-mb-4 tw-mt-0 md:tw-mt-4">
      <div className="tw-flex tw-items-center tw-justify-between tw-mb-4">
        <button
          onClick={() => router.push("/conversations")}
          className="tw-flex tw-items-center tw-gap-2 tw-bg-blue-100 tw-text-blue-800 tw-rounded-full tw-h-10 tw-px-5 tw-font-medium tw-text-[0.875rem] hover:tw-bg-blue-200"
        >
          <ArrowLeftIcon className="tw-w-5 tw-h-5" />
          {t("conversationsListing.conversations")}
        </button>
      </div>
    </div>
  );
};
