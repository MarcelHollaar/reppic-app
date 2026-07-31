/* eslint-disable @next/next/no-img-element */
"use client";
import { useState, ChangeEvent, useEffect, FormEvent } from "react";
import { Spinner, Typography } from "@/components/MaterialTailwind";
import { ArrowLeftIcon, KeyIcon } from "@heroicons/react/24/solid";
import { useRouter } from "next/navigation";
import Carousel from "@/components/signComponents/caraousel";
import { toast, ToastContainer } from "react-toastify";
import { types } from "@/app/api/utils/type-constants";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";

// Define the type for the form data
interface FormData {
  email: string;
}

// Define the type for the error messages
interface FormErrors {
  email?: string;
}

export default function BasicResetPage() {
  const router = useRouter();

  const [formData, setFormData] = useState<FormData>({
    email: "",
  });

  const [errors, setErrors] = useState<FormErrors>({
    email: "",
  });

  const [loading, setLoading] = useState(false);

  const [client, setIsClient] = useState(false);
  const { t } = useTranslation('common')
  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!client) return null;

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prevState) => ({
      ...prevState,
      [name]: value,
    }));
  };

  const validateForm = (): boolean => {
    let isValid = true;
    let validationErrors: FormErrors = {}; // Using FormErrors type

    if (!formData.email) {
      validationErrors.email = t("errorMessages.emailRequired");
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      validationErrors.email = t("errorMessages.pleaseEnterEmail");
      isValid = false;
    }

    setErrors(validationErrors);
    return isValid;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    if (validateForm()) {
      setErrors({});
      try {
        const response = await fetch("/api/auth", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: types.FORGOT_PASSWORD,
            userData: {
              email: formData.email,
            },
          }),
        });

        const result = await response.json();

        if (response.ok) {
          toast.success(result.message)
          localStorage.setItem("resetEmail", formData.email);
          router.push(`/auth/reset/email-verification`);
        } else {
          toast.error(result.message);
        }
      } catch (error) {
        console.error("Error submitting form:", error);
      }
    }
    setLoading(false);
  };

  return (
    <>
      <ToastContainer />
      <section className="tw-flex tw-items-center tw-justify-center tw-min-h-screen tw-bg-indigo-50 tw-px-4 sm:tw-px-12 lg:tw-px-20">
        <div className="tw-w-full tw-max-w-lg tw-bg-white tw-shadow-md tw-rounded-lg tw-p-6 sm:tw-p-10">
          {/* Logo */}
         <div 
            className="tw-rounded-3xl tw-p-2 tw-h-[8rem] tw-bg-cover tw-bg-left tw-bg-no-repeat"
            style={{ backgroundImage: "url('/img/reppic_transparant.svg')" }}
          >
          </div>

          {/* Heading */}
          <div className="tw-text-center tw-mt-4">
            <img src="/img/key.svg" alt="Forgot Password" className="tw-w-16 tw-h-16 tw-mx-auto tw-mb-4" />
            <Typography variant="h3" className="tw-font-[system-ui] tw-mb-1">
              {t('auth.forgotPassword')}
            </Typography>
            <Typography className="tw-font-[system-ui] tw-text-blue-gray-300 tw-text-base xl:tw-ml-10 tw-mb-6 tw-w-4/5">
              {t('auth.emailVerificationMsg')}
            </Typography>
          </div>

          {/* Form */}
          <form className="tw-w-full tw-flex tw-flex-col tw-items-center" onSubmit={handleSubmit}>
            {/* Email Field */}
            <div className="tw-w-full tw-mb-4">
              <input
                type="email"
                className="tw-w-full tw-px-4 tw-py-2 tw-rounded-3xl tw-bg-white tw-border tw-border-gray-400 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 tw-placeholder-gray-600"
                placeholder={t("auth.enterYourEmail")}
                name="email"
                value={formData.email}
                onChange={handleInputChange}
              />
              {errors.email && <p className="tw-text-red-500 tw-text-xs">{errors.email}</p>}
            </div>

            {/* Submit Button */}
            <button
              className={`tw-font-inter tw-w-full tw-mt-4 tw-bg-button tw-text-white tw-rounded-3xl tw-h-12 tw-tracking-wide tw-font-normal tw-flex tw-items-center tw-justify-center
                ${loading ? "tw-opacity-50 tw-cursor-not-allowed" : ""}`}
              type="submit"
            >
              {loading ? <Spinner /> : t("common.continue")}
            </button>
            {/* <div className="tw-space-y-2 tw-mt-4 tw-self-start">
              <div className="tw-flex tw-flex-row tw-gap-2 tw-items-center tw-text-sm tw-font-medium">
                <span>{t('common.selectLanguage')}:</span>  
                <div><LanguageSwitcher /></div>
              </div>
            </div> */}
            {/* Back to Login */}
            <div className="tw-mt-5">
              <a href="/auth/signin/basic" className="tw-flex tw-items-center tw-text-button tw-font-medium">
                <ArrowLeftIcon className="tw-w-4 tw-text-bold" /> &nbsp; {t('auth.backToLogIn')}
              </a>
            </div>
          </form>
        </div>
      </section>

    </>
  );
}