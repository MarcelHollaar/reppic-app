import React from "react";

interface DashboardCardProps {
  title: string;
  value: string | number;
  children?: React.ReactNode;
  rightContent?: React.ReactNode;
  showLine?: boolean;
}

const DashboardCard: React.FC<DashboardCardProps> = ({
  title,
  value,
  children,
  rightContent,
  showLine = false,
}) => {
  return (
    <div className="tw-bg-white tw-rounded-xl tw-shadow tw-p-6 tw-w-full">
      {/* Header with Right Content */}
      <div className="tw-flex tw-justify-between tw-items-center tw-mb-6">
        <h3 className="tw-text-base tw-font-medium tw-text-[#101828]">
          {title}
        </h3>

        {/* Ensure right content (icon) is fully aligned right */}
        {rightContent && (
          <div className="tw-flex tw-items-center tw-ml-auto">
            {rightContent}
          </div>
        )}
      </div>

      {/* Value and Additional Content */}
      <div className="tw-flex tw-items-center tw-justify-between">
        <p className="tw-text-4xl tw-font-semibold tw-text-gray-900">
          {value}
        </p>

        {/* Dash line aligned to the right */}
        {showLine && (
          <div className="tw-w-14 tw-mt-3 tw-h-1 tw-bg-[#667085] tw-rounded-full"></div>
        )}
      </div>

      {/* Additional Children Content */}
      {children && <div className="tw-mt-4">{children}</div>}
    </div>
  );
};

export default DashboardCard;
