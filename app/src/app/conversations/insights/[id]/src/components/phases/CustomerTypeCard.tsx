import React from "react";
import { useTranslation } from "react-i18next";

interface CustomerTypeCardProps {
  color: string;
  title: string;
  description: string;
}

const CustomerTypeCard: React.FC<CustomerTypeCardProps> = ({
  color,
  title,
  description,
}) => {
  const colorMap: Record<string, string> = {
    red: "tw-bg-red-500",
    blue: "tw-bg-blue-800",
    green: "tw-bg-green-500",
    yellow: "tw-bg-[#E1D90E]",
  };
  const { t } = useTranslation('common');
  return (
    <div className="tw-bg-white tw-rounded-xl tw-shadow-sm tw-p-6 tw-flex-1">
      <div className="tw-mb-4">
        <span
          className={`tw-text-white tw-text-sm tw-font-medium tw-px-4 tw-py-1 tw-rounded-full tw-capitalize ${colorMap[color]}`}
        >
          {t(`customerTypeSection.${color}`)}
        </span>
      </div>
      <h3 className="tw-text-base tw-font-semibold tw-mb-2">{title}</h3>
      <p className="!tw-text-[#757575] tw-font-normal tw-text-sm">{description}</p>
    </div>
  );
};

export default CustomerTypeCard;
