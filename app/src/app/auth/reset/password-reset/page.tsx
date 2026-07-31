/* eslint-disable @next/next/no-img-element */
"use client";
import { useState, ChangeEvent, FormEvent, useEffect } from "react";
import Link from "next/link";
import { Button, Checkbox, Spinner, Typography } from "@/components/MaterialTailwind";
import { KeyIcon } from "@heroicons/react/24/solid";
import Carousel from "@/components/signComponents/caraousel";
import { useRouter } from "next/navigation";
import { types } from "@/app/api/utils/type-constants";
import { toast, ToastContainer } from "react-toastify";
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
  const [formData, setFormData] = useState<FormData>({
    confirmPassword: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({
    confirmPassword: "",
    password: "",
  });
  const [client, setClient] = useState(false);
  const [email, setEmail] = useState("");
  const {t} = useTranslation('common')
  useEffect(() => {
    setClient(true);
    const resetEmail = localStorage.getItem("resetEmail") || null;
    if (!resetEmail) {
      router.push("/auth/signin/basic");
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

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prevState) => ({
      ...prevState,
      [name]: value,
    }));
  };

  const getToken = () => {
    const token = localStorage.getItem("token") || null;
    return token ? token : "";
  }

  const validateForm = (): boolean => {
    let isValid = true;
    let validationErrors: FormErrors = {}; // Using FormErrors type

    if (!formData.password || !formData.confirmPassword) {
      validationErrors.password = t("errorMessages.passwordRequired");
      isValid = false;
    }
    if (formData.password.length < 8 || formData.confirmPassword.length < 8) {
      validationErrors.password = t("errorMessages.passwordMustBeLength");
      isValid = false;
    }
    if (formData.password !== formData.confirmPassword) {
      validationErrors.password = t("errorMessages.passwordDoNotMatch");
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
          type: types.RESET_PASSWORD,
          userData: {
            email,
            token: getToken(),
            newPassword: formData.password
          },
        }),
      });

      const result = await response.json();
      if (response.ok) {
        toast.success(result.message);
        localStorage.removeItem('resetEmail');
        router.push("/auth/reset/password-reset/password-reset-success");
      } else {
        if (result?.error?.issues?.length > 0) {
          result.error.issues.map((issue: any) => toast.error(issue?.message));
          setLoading(false);
          return;
        }
        toast.error(result.message);
        setLoading(false);
        return;
      }
    } catch (error) {
      console.error("Error verifying email:", error);
      toast.error(t("errorMessages.somethingWentWrong"));
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

          {/* Icon */}
          <div className="tw-flex tw-justify-center tw-mt-4">
            <img src="/img/key.svg" alt="Reset password" className="tw-w-16 tw-h-16" />
          </div>

          {/* Heading */}
          <Typography variant="h3" className="!tw-font-bold tw-text-[28px] tw-text-center tw-mt-4">
            {t('auth.setNewPassword')}
          </Typography>
          <Typography className="tw-text-base tw-font-[system-ui] tw-font-normal !tw-text-blue-gray-500 tw-text-center tw-mb-6">
            {t('auth.mustBeDifferent')}
          </Typography>

          {/* Reset Password Form */}
          <form className="tw-w-full tw-flex tw-flex-col tw-items-center" onSubmit={handleSubmit}>
            {/* New Password Field */}
            <div className="tw-w-full tw-mb-4">
              <Typography variant="small" className="tw-font-normal tw-mb-2">{t('auth.newPassword')}*</Typography>
              <input
                type="password"
                className="tw-w-full tw-px-4 tw-py-2 tw-rounded-3xl tw-bg-white tw-border tw-border-gray-400 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 tw-placeholder-gray-600"
                placeholder={t("auth.enterYourPassword")}
                name="password"
                value={formData.password}
                onChange={handleInputChange}
              />
              <Typography className="tw-text-sm tw-font-normal !tw-text-blue-gray-500 tw-mt-1">
               {t("passwordReset.passwordValidationDescription")}
              </Typography>
            </div>

            {/* Confirm Password Field */}
            <div className="tw-w-full tw-mb-4">
              <Typography variant="small" className="!tw-font-medium tw-mb-2">{t('auth.confirmPassword')}*</Typography>
              <input
                type="password"
                className="tw-w-full tw-px-4 tw-py-2 tw-rounded-3xl tw-bg-white tw-border tw-border-gray-400 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 tw-placeholder-gray-600"
                placeholder={t("auth.enterYourPassword")}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
              />
              {errors.password && <p className="tw-text-red-500 tw-text-xs">{errors.password}</p>}
            </div>

            {/* Submit Button */}
            <button
              className={`tw-font-inter tw-w-full tw-mt-4 tw-bg-button tw-text-white tw-rounded-3xl tw-h-12 tw-tracking-wide tw-font-normal tw-flex tw-items-center tw-justify-center
                ${loading ? "tw-opacity-50 tw-cursor-not-allowed" : ""}`}
              type="submit"
            >
              {loading ? <Spinner /> : t("auth.resetPassword")}
            </button>
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