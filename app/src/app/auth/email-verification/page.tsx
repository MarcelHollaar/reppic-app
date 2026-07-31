/* eslint-disable @next/next/no-img-element */
"use client";
import { useState, ChangeEvent, FormEvent, KeyboardEvent, useEffect, Suspense } from "react";
import Link from "next/link";
import { Button, Typography } from "@/components/MaterialTailwind";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { useRouter, useSearchParams } from "next/navigation";
import { toast, ToastContainer } from "react-toastify";
import { types } from "@/app/api/utils/type-constants";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";

interface FormData {
  code: string[];
}

interface FormErrors {
  code?: string;
}

export default function EmailVerificationContent() {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>({ code: ["", "", "", "", "", ""] });
  const [errors, setErrors] = useState<FormErrors>({ code: "" });
  const [loading, setLoading] = useState(false);
  const [client, setClient] = useState(false);
  const [email , setEmail] = useState("");
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
    return null;
  }
  const handleCodeChange = (index: number, e: ChangeEvent<HTMLInputElement>) => {
    setErrors({});
    const { value } = e.target;
    if (!/^[0-9]?$/.test(value)) return;

    const newCode = [...formData.code];
    newCode[index] = value;
    setFormData({ code: newCode });

    if (value && index < formData.code.length - 1) {
      document.getElementById(`code-${index + 1}`)?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !formData.code[index] && index > 0) {
      document.getElementById(`code-${index - 1}`)?.focus();
    }
  };

  const validateForm = (): boolean => {
    if (formData.code.some((digit) => digit === "")) {
      setErrors({ code: t("errorMessages.enterAllDigits") });
      return false;
    }
    setErrors({});
    return true;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: types.VERIFY_EMAIL,
          userData: {
            email,
            otp: formData.code.join(""),
          },
        }),
      });

      const result = await response.json();
      if (response.ok) {
        toast.success(result.message);
        router.push("/auth/email-verification/verified");
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error("Error verifying email:", error);
      toast.error(t("errorMessages.somethingWentWrong"));
    }
    setLoading(false);
  };

  const resendCode = async () => {
    if (!email) {
      toast.error(t("errorMessages.emailRequired"));
      return;
    }

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: types.RESEND_EMAIL_VERIFICATION_CODE,
          userData: { email: email },
        }),
      });

      const result = await response.json();
      if (response.ok) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error("Error resending code:", error);
      toast.error(t("errorMessages.somethingWentWrong"));
    }
  };

  return (
    <>
      <ToastContainer />
      <section className="tw-flex tw-justify-center tw-items-center tw-min-h-screen tw-bg-indigo-50">
        <div className="tw-max-w-[65rem] tw-bg-white tw-shadow-lg tw-rounded-3xl tw-flex tw-flex-col tw-items-center tw-pt-5 tw-px-20 tw-pb-10">
          <img src="/img/mail-icon.svg" alt="verification" className="tw-w-14 tw-h-14 tw-mb-4" />
          <Typography variant="h3" className="!tw-font-bold tw-mb-2 tw-text-center">{t('auth.checkYourEmail')}</Typography>
          <Typography className="tw-text-center tw-text-base tw-font-light !tw-text-blue-gray-500">
            {t('auth.codeSentTo')} <br /> <span className="tw-font-bold">{email}</span>
          </Typography>

          <form className="tw-mt-4 tw-w-full tw-flex tw-flex-col tw-items-center" onSubmit={handleSubmit}>
            <div className="tw-mb-4">
              <div className="tw-flex tw-space-x-2">
                {formData.code.map((digit, index) => (
                  <input
                    key={index}
                    id={`code-${index}`}
                    type="text"
                    className="tw-w-16 tw-h-16 tw-text-center tw-text-xl tw-rounded-lg tw-border tw-border-gray-400 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleCodeChange(index, e)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                  />
                ))}
              </div>
              {errors.code && <p className="tw-text-red-500 tw-text-xs tw-text-center">{errors.code}</p>}
            </div>

            <button
              className={`tw-bg-button tw-mt-4 tw-bg-blue tw-text-white tw-rounded-3xl tw-h-10 tw-w-full
                ${loading ? "tw-opacity-50 tw-cursor-not-allowed" : ""}`}
              type="submit"
              disabled={loading}
            >
              {loading ? `${t('loadingMessages.verifying')}...` : t("auth.verifyEmail")}
            </button>

            <div className="tw-mt-4 tw-flex tw-flex-col tw-justify-center tw-items-center">
              <p className="tw-text-sm tw-font-normal !tw-text-blue-gray-500">
                {t('auth.notReceivedMail')} {" "}
                <button
                  type="button"
                  onClick={(e: any) => {
                    e.preventDefault();
                    resendCode()
                  }}
                  className="tw-font-medium tw-text-button tw-text-button-600"
                >
                  {t('auth.clickToResend')}
                </button>
              </p>
              {/* <div className="tw-space-y-2 tw-mt-4 tw-self-start">
                <div className="tw-flex tw-flex-row tw-gap-2 tw-items-center tw-text-sm tw-font-medium">
                  <span>{t('common.selectLanguage')}:</span>  
                  <div><LanguageSwitcher /></div>
                </div>
              </div> */}
              <a href="/auth/signin/basic" className="tw-flex tw-text-sm tw-mt-5 tw-text-gray-700 tw-items-center tw-font-medium">
                <ArrowLeftIcon className="tw-w-4 tw-text-gray-700" /> &nbsp; {t('auth.backToLogIn')}
              </a>
            </div>
          </form>
        </div>
      </section>
    </>
  );
}