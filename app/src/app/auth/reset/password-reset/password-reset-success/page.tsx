/* eslint-disable @next/next/no-img-element */
"use client";
import { useState, ChangeEvent, FormEvent, useEffect } from "react";
import Link from "next/link";
import { Button, Checkbox, Typography } from "@/components/MaterialTailwind";
import { KeyIcon } from "@heroicons/react/24/solid";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import Carousel from "@/components/signComponents/caraousel";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";

// Define the type for the form data
interface FormData {
  confirmPassword: string;
  password: string;
}

// Define the type for the error messages
interface FormErrors {
  confirmPassword?: string;
  password?: string;
}

export default function BasicSigninPage() {
  const router = useRouter();
  const [client, setClient] = useState(false);
  const { t } = useTranslation('common')
  useEffect(() => {
    setClient(true);
  }, []);

  if (!client) {
    return null;
  }
  return (
    <section className="tw-flex tw-items-center tw-justify-center tw-min-h-screen tw-bg-indigo-50 tw-px-4 sm:tw-px-12 lg:tw-px-20">
      <div className="tw-w-full tw-max-w-lg tw-bg-white tw-shadow-md tw-rounded-lg tw-p-6 sm:tw-p-10">
        {/* Logo (Always at the top, centered) */}
         <div 
            className="tw-rounded-3xl tw-p-2 tw-h-[8rem] tw-bg-cover tw-bg-left tw-bg-no-repeat"
            style={{ backgroundImage: "url('/img/reppic_transparant.svg')" }}
          >
          </div>

        {/* Success Icon */}
        <div className="tw-flex tw-flex-col tw-items-center tw-mt-6">
          <img src="/img/check.svg" alt="Success" className="tw-w-16 tw-h-16 tw-mb-6" />
          <Typography variant="h3" className="!tw-font-bold tw-text-[28px] tw-mb-2">
            {t('auth.passwordReset')}
          </Typography>
          <Typography className="tw-text-base tw-font-[system-ui] tw-font-normal !tw-text-blue-gray-500 tw-text-center tw-w-5/5">
            {t('auth.passwordToLogin')}
          </Typography>
        </div>

        {/* Login Button */}
        <form className="tw-mt-6 tw-w-full tw-flex tw-flex-col tw-items-center">
          <button
            className="tw-w-full tw-mt-4 tw-bg-button tw-text-white tw-rounded-3xl tw-tracking-wide tw-py-2"
            onClick={(e) => {
              e.preventDefault();
              router.push("/auth/signin/basic");
            }}
          >
            {t('auth.logIn')}
          </button>
        </form>
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