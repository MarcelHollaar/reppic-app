/* eslint-disable @next/next/no-img-element */
"use client"
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { Typography } from "@/components/MaterialTailwind";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function EmailVerifiedPage() {
  const router = useRouter();
    const [client, setIsClient] = useState(false);
    const { t } = useTranslation('common')
    useEffect(() => {
      setIsClient(true);
    }, []);
  
    if (!client) return null;
  return (
    <section className="tw-flex tw-justify-center tw-items-center tw-min-h-screen tw-bg-indigo-50">
      <div className="tw-w-full tw-max-w-lg tw-bg-white tw-shadow-lg tw-rounded-3xl tw-p-8 tw-flex tw-flex-col tw-items-center">
        <img src="/img/check.svg" alt="forget password" className="tw-w-16 tw-h-16 tw-text-blue-200 tw-mb-6 tw-relative" />
        <Typography variant="h2" className="!tw-font-bold tw-mb-2 tw-text-center tw-font-[system-ui]">
          {t('auth.emailVerified')}
        </Typography>
        <Typography className="tw-text-center ttw-text-base tw-font-[system-ui] tw-font-light tw-w-[80%] !tw-text-blue-gray-500">
          {t('auth.emailSent')}
        </Typography>
        
        <button className="tw-bg-button tw-mt-8 tw-bg-blue tw-text-white tw-rounded-3xl tw-h-10 tw-w-[77%] tw-flex tw-items-center tw-justify-center tw-gap-2 tw-mb-6"
          onClick={(e) => { router.push("/auth/signin/basic") }}
        >
          <ArrowLeftIcon className="tw-w-5 tw-h-5 tw-text-white" />
          <span>{t('auth.backToLogIn')}</span>
        </button>
        {/* <div className="tw-space-y-2 tw-mt-4 tw-self-start">
          <div className="tw-flex tw-flex-row tw-gap-2 tw-items-center tw-text-sm tw-font-medium">
            <span>{t('common.selectLanguage')}:</span>  
            <div><LanguageSwitcher /></div>
          </div>
        </div> */}
      </div>
    </section>
  );
}