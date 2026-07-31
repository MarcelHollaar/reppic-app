/* eslint-disable @next/next/no-img-element */
"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { Typography } from "@/components/MaterialTailwind";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function EmailLandingContent() {
  const router = useRouter();
  const [client, setClient] = useState(false);
  const [email, setEmail] = useState("");
  const { t } = useTranslation('common')
  useEffect(() => {
    setClient(true);
    const token = localStorage.getItem("token") || null;
    const userData = localStorage.getItem("user_data") || null;

    if (!userData) {
      router.push("/auth/signin/basic");
      return;
    } else {
      if(userData) {
        const data = JSON.parse(userData);
        setEmail(data.email);
      }
    }
  }, []);

  if (!client) {
    return;
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    router.push(`/auth/email-verification`);
  };

  return (
    <section className="tw-flex tw-justify-center tw-items-center tw-min-h-screen tw-bg-indigo-50">
      <div className="tw-max-w-lg tw-bg-white tw-shadow-lg tw-rounded-3xl tw-flex tw-flex-col tw-items-center tw-px-20 tw-py-20">
        <img
          src="/img/mail-icon.svg"
          alt="forget password"
          className="tw-w-16 tw-h-16 tw-text-blue-200 tw-mb-4"
        />
        <Typography variant="h3" className="!tw-font-bold tw-mb-2 tw-text-center">
          {t('auth.checkYourEmail')}
        </Typography>
        <Typography className="tw-text-center tw-text-base tw-font-light !tw-text-blue-gray-500">
          {t('auth.sentLinkTo')} <br />
          <span className="tw-font-bold tw-font-inter">{email}</span>
        </Typography>

        <form className="tw-mt-4 tw-w-full tw-flex tw-flex-col tw-items-center" onSubmit={handleSubmit}>
          <button
            className="tw-bg-button tw-mt-4 tw-bg-blue tw-text-white tw-rounded-3xl tw-h-10 tw-w-[19rem]"
            type="submit"
          >
            {t('auth.enterCodeManually')}
          </button>
          <div className="tw-mt-4 tw-flex tw-flex-col tw-justify-center tw-items-center">
            <a
              href="/auth/signin/basic"
              className="tw-flex tw-text-sm tw-mt-5 tw-text-gray-700 tw-items-center tw-font-medium"
            >
              <ArrowLeftIcon className="tw-w-4 tw-text-gray-700" /> &nbsp; {t('auth.backToLogIn')}
            </a>
          </div>
          {/* <div className="tw-space-y-2 tw-mt-4 tw-self-start">
            <div className="tw-flex tw-flex-row tw-gap-2 tw-items-center tw-text-sm tw-font-medium">
              <span>{t('common.selectLanguage')}:</span>  
              <div><LanguageSwitcher /></div>
            </div>
          </div> */}
        </form>
      </div>
    </section>
  );
}
