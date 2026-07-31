// @material-tailwind/react
import { Avatar, Typography } from "@material-tailwind/react";

// @heroicons/react
import {
  Squares2X2Icon,
  ShoppingBagIcon,
  ClipboardDocumentIcon,
  PhotoIcon,
  ClipboardIcon,
  RectangleGroupIcon,
  CubeTransparentIcon,
} from "@heroicons/react/24/solid";

const icon = {
  className: "tw-w-5 tw-h-5 tw-text-inherit",
};

const text = {
  color: "inherit",
  className: "tw-w-5 tw-grid place-items-center !tw-font-medium",
};

export const routes = [
  {
    name: "Dashboard",
    icon: <RectangleGroupIcon {...icon} />,
    path: "https://github.com/creativetimofficial/material-tailwind/releases",
    external: true,
  },
  {
    name: "Conversations",
    icon: <ClipboardDocumentIcon {...icon} />,
    path: "/conversations",
    external: false,
  },
  {
    name: "Developments",
    icon: <CubeTransparentIcon {...icon} />,
    path: "/development",
    external: true,
  },
  {
    name: "Settings",
    icon: <ShoppingBagIcon {...icon} />,
    path: "/settings",
    external: true,
  },
];
export default routes;