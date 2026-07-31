import React from "react";
import "@/app/globals.css";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export const metadata = {
  title: "Authentication",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="tw-relative !tw-min-h-screen tw-w-full tw-bg-white">
      {/* <div className="tw-flex tw-justify-end tw-bg-indigo-50">
        <div className="tw-mt-2 tw-me-4">
         <LanguageSwitcher />
        </div>
      </div> */}
      {children}
    </div>
  );
}
