import React from "react";
import CustomerTypeCard from "./CustomerTypeCard";
import { useTranslation } from "react-i18next";

interface CustomerTypeSectionProps {
  customerType?: string;
}

const CustomerTypeSection: React.FC<CustomerTypeSectionProps> = ({ customerType }) => {
  const { t } = useTranslation('common');
  // Mapping Dutch colors to English equivalents
  const colorMapping: Record<string, string> = {
    groen: "green",
    blauw: "blue",
    rood: "red",
    geel: "yellow",
  };

  const customerTypes = [
    {
      color: "red",
      title: t("customerTypeSection.theDominant"),
      description:
        t("customerTypeSection.theDominantDescription"),
    },
    {
      color: "blue",
      title: t("customerTypeSection.theRational"),
      description:
        t("customerTypeSection.theRationalDescription"),
    },
    {
      color: "green",
      title: t("customerTypeSection.theSafe"),
      description:
        t("customerTypeSection.theSafeDescription"),
    },
    {
      color: "yellow",
      title: t("customerTypeSection.theEnthusiastic"),
      description:
        t("customerTypeSection.theEnthusiasticDescription"),
    },
  ];

  // Get the English color from the Dutch input
  const normalizedType = customerType?.toLowerCase() ?? "";
  const selectedColor = colorMapping[normalizedType];

  // Find the corresponding customer type
  const selectedCustomer = customerTypes.find((type) => type.color === selectedColor);

  return (
    <div className="tw-mb-6">
      <h2 className="!tw-text-[1.375rem] !tw-font-medium tw-font-inter tw-mb-4 tw-text-center md:tw-text-left">{t("customerTypeSection.customerType")}</h2>
      <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 lg:tw-grid-cols-4 tw-gap-6">
        {selectedCustomer && (
          <CustomerTypeCard
            color={selectedCustomer.color}
            title={selectedCustomer.title}
            description={selectedCustomer.description}
          />
        )}
      </div>
    </div>
  );
};

export default CustomerTypeSection;
