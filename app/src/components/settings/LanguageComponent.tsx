"use client";
import { useTranslation } from "react-i18next";
import { ToastContainer } from "react-toastify";
import LanguageSwitcher from "../LanguageSwitcher";

const LanguageSettings = () => {
  const { t } = useTranslation("common");

  return (
    <>
      <ToastContainer />
      <div className="tw-bg-white tw-rounded-3xl tw-shadow-md tw-py-6 tw-px-8">
        <h2 className="tw-text-lg tw-font-medium tw-mb-0 tw-font-[system-ui]">
          {t("languageSettings.languageSettingsText")}
        </h2>
        <div className="tw-mt-4 tw-space-y-6">
          <div className="tw-flex tw-flex-row tw-gap-2 tw-items-center">
            {t("common.selectLanguage")}: <LanguageSwitcher />
          </div>
        </div>
      </div>
    </>
  );
};

export default LanguageSettings;
