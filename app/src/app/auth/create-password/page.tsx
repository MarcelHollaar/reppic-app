/* eslint-disable @next/next/no-img-element */
"use client";
import { types } from "@/app/api/utils/type-constants";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast, ToastContainer } from "react-toastify";
import { CARD_SHADOW, PAGE_BG, primaryButtonClasses } from "@/theme/uiTokens";

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
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      let emailValue = urlParams.get("email") || "";
      emailValue = emailValue.replace(/ /g, "+"); // Convert spaces back to `+`
      setEmail(emailValue);
      setToken(urlParams.get("token") || "");
    }
  }, []);

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
  const { t } = useTranslation("common");

  useEffect(() => {
    setClient(true);
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
          type: types.CREATE_PASSWORD,
          userData: {
            email,
            token,
            newPassword: formData.password,
          },
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(result.message);
        localStorage.removeItem("resetEmail");
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
      <section
        className="tw-flex tw-items-center tw-justify-center tw-min-h-screen tw-px-4 sm:tw-px-12 lg:tw-px-20"
        style={{ backgroundColor: PAGE_BG }}
      >
        <div
          className="tw-w-full tw-max-w-lg tw-bg-white tw-rounded-2xl tw-p-6 sm:tw-p-10"
          style={{ boxShadow: CARD_SHADOW }}
        >
          {/* Logo */}
          <div
            className="tw-rounded-3xl tw-p-2 tw-h-[8rem] tw-bg-cover tw-bg-left tw-bg-no-repeat"
            style={{ backgroundImage: "url('/img/reppic_transparant.svg')" }}
          ></div>

          {/* Icon */}
          <div className="tw-flex tw-justify-center tw-mt-4">
            <img
              src="/img/key.svg"
              alt="Reset password"
              className="tw-w-16 tw-h-16"
            />
          </div>

          {/* Heading */}
          <h1 className="tw-font-bold tw-text-[28px] tw-text-gray-900 tw-text-center tw-mt-3 tw-mb-6">
            {t("auth.setNewPassword")}
          </h1>

          {/* Reset Password Form */}
          <form
            className="tw-w-full tw-flex tw-flex-col tw-items-center"
            onSubmit={handleSubmit}
          >
            {/* New Password Field */}
            <div className="tw-w-full tw-mb-4">
              <label className="tw-block tw-text-sm tw-font-normal tw-text-gray-900 tw-mb-2">
                {t("auth.newPassword")}*
              </label>
              <input
                type="password"
                className="tw-w-full tw-px-4 tw-py-2.5 tw-rounded-xl tw-bg-[#F5F6F8] tw-border-0 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-[#5971F6] tw-placeholder-gray-500 tw-text-sm"
                placeholder="Enter your password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
              />
              <p className="tw-text-sm tw-font-normal tw-text-gray-500 tw-mt-1">
                {t("passwordReset.passwordValidationDescription")}
              </p>
            </div>

            {/* Confirm Password Field */}
            <div className="tw-w-full tw-mb-4">
              <label className="tw-block tw-text-sm tw-font-medium tw-text-gray-900 tw-mb-2">
                {t("auth.confirmPassword")}*
              </label>
              <input
                type="password"
                className="tw-w-full tw-px-4 tw-py-2.5 tw-rounded-xl tw-bg-[#F5F6F8] tw-border-0 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-[#5971F6] tw-placeholder-gray-500 tw-text-sm"
                placeholder="Enter your password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
              />
              {errors.password && (
                <p className="tw-text-red-500 tw-text-xs">{errors.password}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              className={`tw-w-full tw-mt-4 tw-h-12 tw-flex tw-items-center tw-justify-center ${primaryButtonClasses} ${loading ? "tw-opacity-50 tw-cursor-not-allowed" : ""}`}
              type="submit"
            >
              {loading ? <svg className="tw-animate-spin tw-h-5 tw-w-5 tw-text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="tw-opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="tw-opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : t("auth.createPassword")}
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
