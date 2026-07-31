import React from "react";

// @material-tailwind/react
import { Typography } from "@material-tailwind/react";

// @heroicons/react
import { HeartIcon } from "@heroicons/react/24/solid";
import { useTranslation } from 'react-i18next';

type PropTypes = {
  brandName?: string;
  brandLink?: string;
  routes?: { name: string; path: string; external?: boolean; }[];
};

export function Footer({
  brandName = process.env.NEXT_PUBLIC_APP_NAME || "Reppic",
  brandLink = "/dashboard",
  routes = [
    { name: "Tutorial", path: "#" },
    { name: "License", path: "#" },
  ],
}: PropTypes) {
  const year = new Date().getFullYear();
  const { t } = useTranslation('common')
  routes = [
    {name: t("footer.tutorial"), path: "#"},
    {name: t('footer.license'), path: "#"},
    {name: t('footer.privacyPolicy'), path: "https://reppic.ai/privacy-policy/", external: true},
    {name: t('footer.termsOfService'), path: "https://reppic.ai/terms-of-service/", external: true}
  ]
  return (
    <footer className="tw-py-6 tw-pt-10">
    <div className="tw-flex tw-w-full tw-flex-wrap tw-items-center tw-justify-center tw-gap-6 tw-px-2 md:tw-justify-between">
      <div className="tw-flex tw-w-full tw-text-black tw-flex-col-reverse tw-items-center tw-gap-4 md:tw-flex-row md:tw-justify-between">
        <Typography variant="small" className="!tw-font-normal tw-text-inherit tw-text-center md:tw-text-left">
          &copy;{' '}          
          <a
            href={brandLink}
            className="tw-transition-colors tw-text-black hover:tw-text-black hover:tw-underline"
          >
            {brandName} {' '}
          </a>
          {year}
        </Typography>
        <ul className="tw-flex tw-flex-wrap tw-items-center tw-justify-center tw-gap-2 md:tw-gap-4 md:tw-justify-end">
          {routes.map(({ name, path, external }: { name: string; path: string; external?: boolean; }) => (
            <li key={name}>
              <Typography
                as="a"
                href={path}
                variant="small"
                className="tw-py-0.5 tw-px-1 !tw-font-normal hover:tw-underline tw-text-inherit tw-transition-colors hover:tw-text-blue-gray-900 tw-text-center tw-break-words tw-whitespace-normal md:tw-whitespace-normal"
                target={external ? "_blank" : undefined}
                rel={external ? "noopener noreferrer" : undefined}
                style={{ whiteSpace: "pre-line" }}
              >
                <span className="tw-block md:tw-inline" suppressHydrationWarning>
                  {(() => {
                    const words = name.split(" ");
                    if (words.length === 1) return name;
                    return (
                      <>
                        {words[0]}
                        <span className="tw-block md:tw-hidden">
                          {words.slice(1).join(" ")}
                        </span>
                        <span className="tw-hidden md:tw-inline"> {words.slice(1).join(" ")}</span>
                      </>
                    );
                  })()}
                </span>
              </Typography>
            </li>
          ))}
        </ul>
      </div>
    </div>
    </footer>
  );
}

export default Footer;
