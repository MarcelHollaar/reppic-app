import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface MenuItemProps {
  key?: string | number;
  path: string;
  icon: ReactNode;
  iconBlack: ReactNode;
  name: string;
  activeRouteClasses: string;
  collapseItemClasses: string;
  external?: boolean;
}

const MenuItem = ({
  path,
  icon,
  iconBlack,
  name,
  activeRouteClasses,
  collapseItemClasses,
  external = false,
}: MenuItemProps) => {
  const pathname = usePathname();
  const [isHovered, setIsHovered] = useState(false);

  const isActive =
    !external &&
    (pathname === path || pathname.startsWith(`${path}/`));

  const content = (
    <div
      className={`tw-flex tw-items-center tw-gap-3 tw-px-3 tw-py-2.5 tw-rounded-xl tw-text-sm tw-transition-colors tw-capitalize ${
        isActive ? activeRouteClasses : collapseItemClasses
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span className="tw-flex-shrink-0">
        {isActive && isHovered ? iconBlack : isActive ? icon : iconBlack}
      </span>
      <span suppressHydrationWarning>{name}</span>
    </div>
  );

  if (external) {
    return (
      <a href={path} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    );
  }

  return <Link href={path}>{content}</Link>;
};

export default MenuItem;
