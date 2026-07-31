/* eslint-disable @next/next/no-img-element */
"use client";
import { useState, ChangeEvent, FormEvent, KeyboardEvent, useEffect, Suspense } from "react";
import Link from "next/link";
import { Spinner, Typography } from "@/components/MaterialTailwind";
import Carousel from "@/components/signComponents/caraousel";
import { useRouter, useSearchParams } from "next/navigation";
import { types } from "@/app/api/utils/type-constants";
import { toast, ToastContainer } from "react-toastify";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";

// Define types for form data and errors
interface FormData {
  code: string[];
}

interface FormErrors {
  code?: string;
}

export default function EmailVerificationContent() {
  const router = useRouter();

  const [formData, setFormData] = useState<FormData>({
    code: ["", "", "", "", "", ""], // Six inputs for verification code
  });
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<FormErrors>({
    code: "",
  });
  const [loading, setLoading] = useState(false);
  const [client, setClient] = useState(false);
  const { t } = useTranslation('common')
  useEffect(() => {
    setClient(true);
    const token = localStorage.getItem("token") || null;
    const resetEmail = localStorage.getItem("resetEmail") || null;

    if (!resetEmail) {
      router.push("/auth/reset/basic-reset");
      return;
    } else {
      if (resetEmail) {
        setEmail(resetEmail);
      }
    }
  }, []);

  if (!client) {
    return null;
  }

  const handleCodeChange = (index: number, e: ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    if (!/^\d?$/.test(value)) return; // Allow only one digit

    const newCode = [...formData.code];
    newCode[index] = value;
    setFormData((prevState) => ({ ...prevState, code: newCode }));

    // Auto-focus next input
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
    let isValid = true;
    let validationErrors: FormErrors = {};
    if (formData.code.some((digit) => digit === "")) {
      validationErrors.code = t("errorMessages.enterAllDigits");
      isValid = false;
    }
    setErrors(validationErrors);
    return isValid;
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
          type: types.VERIFY_OTP,
          userData: {
            email,
            otp: formData.code.join(""),
          },
        }),
      });

      const result = await response.json();
      if (response.ok) {
        toast.success(result.message);
        localStorage.setItem("token", result.token);
        router.push("/auth/reset/password-reset");
      } else {
        toast.error(result.message);
        setLoading(false);
        return;
      }
    } catch (error) {
      console.error("Error verifying email:", error);
      toast.error(t('errorMessages.somethingWentWrong'));
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
          type: types.RESEND_PASSWORD_CODE,
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
      toast.error(t('errorMessages.somethingWentWrong'));
    }
  };

  return (
    <>
      <ToastContainer />
      <section className="tw-flex tw-items-center tw-justify-center tw-min-h-screen tw-bg-indigo-50 tw-px-4 sm:tw-px-12 lg:tw-px-20">
        <div className="tw-w-full tw-max-w-lg tw-bg-white tw-shadow-md tw-rounded-lg tw-p-6 sm:tw-p-10">
          {/* Logo (Always at the top, centered) */}
         <div 
            className="tw-rounded-3xl tw-p-2 tw-h-[8rem] tw-bg-cover tw-bg-left tw-bg-no-repeat"
            style={{ backgroundImage: "url('/img/reppic_transparant.svg')" }}
          >
          </div>

          {/* Mail Icon & Heading */}
          <div className="tw-flex tw-flex-col tw-items-center tw-mt-6">
            <img src="/img/mail-icon.svg" alt="Forget password" className="tw-w-16 tw-h-16 tw-text-blue-200 tw-mb-4" />
            <Typography variant="h2" className="tw-font-semibold tw-mb-2 tw-font-[system-ui] tw-text-center">
              {t('auth.checkYourEmail')}
            </Typography>
            <Typography className="tw-tracking-wide tw-text-base tw-font-normal !tw-text-blue-gray-500 tw-text-center">
              {t('auth.sentLinkTo')} <br /> <b className="tw-font-semibold">{email}</b>
            </Typography>
          </div>

          {/* Verification Code Form */}
          <form className="tw-mt-6 tw-w-full tw-flex tw-flex-col tw-items-center" onSubmit={handleSubmit}>
            {/* Verification Code Inputs */}
            <div className="tw-mb-4">
              <div className="tw-flex tw-space-x-2">
                {formData.code.map((digit, index) => (
                  <input
                    key={index}
                    id={`code-${index}`}
                    type="text"
                    className="tw-w-12 tw-h-12 tw-text-center tw-text-xl tw-rounded-lg tw-border tw-border-black focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleCodeChange(index, e)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                  />
                ))}
              </div>
              {errors.code && <p className="tw-text-red-500 tw-text-xs">{errors.code}</p>}
            </div>

            {/* Submit Button */}
            <button
              className={`tw-font-inter tw-w-full tw-mt-4 tw-bg-button tw-text-white tw-rounded-3xl tw-h-12 tw-tracking-wide tw-font-normal tw-flex tw-items-center tw-justify-center
                ${loading ? "tw-opacity-50 tw-cursor-not-allowed" : ""}`}
              type="submit"
            >
              {loading ? <Spinner /> : t("auth.verifyNow")}
            </button>

            {/* Resend Code */}
            <div className="tw-mt-4 tw-flex tw-flex-col tw-justify-center tw-items-center">
              <p className="tw-text-sm tw-font-normal !tw-text-blue-gray-500">
                {t('auth.notReceivedCode')}
              </p>
              <button
                onClick={(e) => { e.preventDefault(); resendCode(); }}
                className="tw-font-medium tw-text-blue-900 hover:tw-text-blue-800"
                disabled={loading}
              >
                {t("auth.resendCode")}
              </button>
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
    </>

  );
}