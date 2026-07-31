/* eslint-disable @next/next/no-img-element */
"use client";
import { types } from "@/app/api/utils/type-constants";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  ChangeEvent,
  ClipboardEvent,
  FormEvent,
  KeyboardEvent,
  useEffect,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { toast, ToastContainer } from "react-toastify";
import {
  CARD_SHADOW,
  PAGE_BG,
  PRIMARY,
  primaryButtonClasses,
} from "@/theme/uiTokens";
import { PASSWORD_SPECIAL_CHAR_REGEX } from "@/utils/passwordRules";

const TRUSTED_DEVICE_STORAGE_KEY = "trusted_device_token";

interface FormData {
  email: string;
  password: string;
  remember_me: boolean;
}

type LoginStep = "credentials" | "otp";

function Spinner() {
  return (
    <svg
      className="tw-animate-spin tw-h-5 tw-w-5 tw-text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="tw-opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="tw-opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function completeLogin(
  result: {
    data: {
      accessToken?: string;
      user?: object;
      trustedDeviceToken?: string;
    };
  },
  router: ReturnType<typeof useRouter>,
  successMessage: string,
) {
  localStorage.setItem("token", result.data.accessToken || "");
  localStorage.setItem("user_data", JSON.stringify(result.data.user || ""));

  if (result.data.trustedDeviceToken) {
    localStorage.setItem(
      TRUSTED_DEVICE_STORAGE_KEY,
      result.data.trustedDeviceToken,
    );
  }
  router.push("/dashboard");

  toast.success(successMessage);
}

const inputClasses =
  "tw-w-full tw-px-4 tw-py-2.5 tw-rounded-xl tw-bg-[#F5F6F8] tw-border-0 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-[#5971F6] tw-placeholder-gray-500 tw-text-sm";

export default function BasicSigninPage() {
  const { t } = useTranslation("common");
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>({
    email: "",
    password: "",
    remember_me: false,
  });
  const [errors, setError] = useState<Record<string, string>>({});
  const ERROR_MESSAGE = t("auth.invalidEmailOrPassword");
  const [client, setIsClient] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [cookieAccepted, setCookieAccepted] = useState(false);
  const [showCookieNotice, setShowCookieNotice] = useState(true);
  const [step, setStep] = useState<LoginStep>("credentials");
  const [pendingToken, setPendingToken] = useState("");
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const [trustDevice, setTrustDevice] = useState(true);

  useEffect(() => {
    setIsClient(true);

    const token = localStorage.getItem("token") || null;

    if (token) {
      router.push("/dashboard");
    }
  }, [router]);

  useEffect(() => {
    setTimeout(() => {
      const tokenExpired = localStorage.getItem("tokenExpired");
      if (tokenExpired === "true") {
        toast.error(t("auth.sessionExpired"));
        localStorage.removeItem("tokenExpired");
      }
    }, 0);
  }, [t]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const consent = localStorage.getItem("cookieAccepted");
      if (consent === "true") {
        setCookieAccepted(true);
        setShowCookieNotice(false);
      }
    }
  }, []);

  const handleAcceptCookies = () => {
    setCookieAccepted(true);
    setShowCookieNotice(false);
    localStorage.setItem("cookieAccepted", "true");
  };

  if (!client) return null;

  const validateCredentials = () => {
    let isValid = true;

    const validationErrors: Record<string, string> = {};

    if (!formData.email || !/\S+@\S+\.\S+/.test(formData.email)) {
      validationErrors.email = ERROR_MESSAGE;
      isValid = false;
    }

    if (
      !formData.password ||
      formData.password.length < 8 ||
      !/[A-Z]/.test(formData.password) ||
      !/[a-z]/.test(formData.password) ||
      !/[0-9]/.test(formData.password) ||
      !PASSWORD_SPECIAL_CHAR_REGEX.test(formData.password)
    ) {
      validationErrors.password = ERROR_MESSAGE;
      isValid = false;
    }

    setError(validationErrors);
    return isValid;
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateCredentials()) {
      return;
    }

    setLoading(true);
    setBackendError(null);

    try {
      const trustedDeviceToken =
        localStorage.getItem(TRUSTED_DEVICE_STORAGE_KEY) || undefined;

      const response = await fetch("/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: types.LOGIN,
          userData: {
            ...formData,
            trusted_device_token: trustedDeviceToken,
          },
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        setBackendError(result.message);
        setLoading(false);
        return;
      }

      if (result.data?.requiresOtp) {
        setPendingToken(result.data.pendingToken);
        setStep("otp");
        setOtpCode(["", "", "", "", "", ""]);
        toast.success(result.message);
        setLoading(false);
        return;
      }

      completeLogin(result, router, t("successMessages.loginSuccessful"));
    } catch (error) {
      console.error("Login error:", error);
      setBackendError(t("errorMessages.somethingWentWrong"));
    }
    setLoading(false);
  };

  const fillOtpDigits = (raw: string, startIndex = 0) => {
    const digits = raw.replace(/\D/g, "").slice(0, otpCode.length - startIndex);
    if (!digits) return;

    const newCode = [...otpCode];
    for (let i = 0; i < digits.length; i++) {
      newCode[startIndex + i] = digits[i];
    }
    setOtpCode(newCode);
    setError({});

    const focusIndex = Math.min(startIndex + digits.length, otpCode.length - 1);
    document.getElementById(`login-code-${focusIndex}`)?.focus();
  };

  const handleCodeChange = (
    index: number,
    e: ChangeEvent<HTMLInputElement>,
  ) => {
    const { value } = e.target;
    if (value.length > 1) {
      fillOtpDigits(value, index);
      return;
    }
    if (!/^[0-9]?$/.test(value)) return;

    setError({});
    const newCode = [...otpCode];
    newCode[index] = value;
    setOtpCode(newCode);

    if (value && index < otpCode.length - 1) {
      document.getElementById(`login-code-${index + 1}`)?.focus();
    }
  };

  const handleCodePaste = (
    index: number,
    e: ClipboardEvent<HTMLInputElement>,
  ) => {
    e.preventDefault();
    fillOtpDigits(e.clipboardData.getData("text"), index);
  };

  const handleCodeKeyDown = (
    index: number,
    e: KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace" && !otpCode[index] && index > 0) {
      document.getElementById(`login-code-${index - 1}`)?.focus();
    }
  };

  const resetToCredentials = (message?: string) => {
    setStep("credentials");
    setPendingToken("");
    setOtpCode(["", "", "", "", "", ""]);
    setError({});
    if (message) {
      setBackendError(message);
      toast.error(message);
    } else {
      setBackendError(null);
    }
  };

  const handleOtpApiError = (result: {
    message?: string;
    errorCode?: string;
  }) => {
    const message = result.message || t("errorMessages.somethingWentWrong");

    if (result.errorCode === "LOGIN_SESSION_EXPIRED") {
      resetToCredentials(message);
      return;
    }

    setBackendError(null);
    setError({ code: message });

    if (result.errorCode === "LOGIN_OTP_INVALID") {
      setOtpCode(["", "", "", "", "", ""]);
      setTimeout(() => document.getElementById("login-code-0")?.focus(), 0);
    }
  };

  const handleOtpSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (otpCode.some((digit) => digit === "")) {
      setError({ code: t("errorMessages.loginOtpIncomplete") });
      return;
    }

    setLoading(true);
    setBackendError(null);
    setError({});

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: types.VERIFY_LOGIN_OTP,
          userData: {
            email: formData.email,
            otp: otpCode.join(""),
            pendingToken,
            trust_device: trustDevice,
          },
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        handleOtpApiError(result);
        setLoading(false);
        return;
      }

      completeLogin(result, router, t("successMessages.loginSuccessful"));
    } catch (error) {
      console.error("OTP verification error:", error);
      setError({ code: t("errorMessages.somethingWentWrong") });
    }
    setLoading(false);
  };

  const resendOtp = async () => {
    if (!pendingToken) return;

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: types.RESEND_LOGIN_OTP,
          userData: {
            email: formData.email,
            pendingToken,
          },
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setError({});
        setOtpCode(["", "", "", "", "", ""]);
        toast.success(result.message);
        setTimeout(() => document.getElementById("login-code-0")?.focus(), 0);
      } else {
        handleOtpApiError(result);
      }
    } catch (error) {
      console.error("Error resending login OTP:", error);

      toast.error(t("errorMessages.somethingWentWrong"));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setError({});
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <>
      <ToastContainer />
      {showCookieNotice && (
        <div
          className="tw-fixed tw-bottom-0 tw-left-0 tw-right-0 tw-bg-white tw-p-4 tw-z-50 tw-flex tw-flex-col sm:tw-flex-row tw-items-center tw-justify-between tw-gap-2 tw-rounded-t-2xl"
          style={{ boxShadow: CARD_SHADOW }}
        >
          <span className="tw-text-md tw-text-gray-700">
            {t("auth.disclaimerText")}&nbsp;
            <a
              href="https://reppic.ai/disclaimer"
              target="_blank"
              rel="noopener noreferrer"
              className="tw-underline hover:tw-opacity-80"
              style={{ color: PRIMARY }}
            >
              {t("auth.disclaimer")}
            </a>
            .
          </span>
          <div className="tw-flex tw-items-center tw-gap-2">
            <button
              className={`${primaryButtonClasses} tw-px-4 tw-py-1.5`}
              onClick={handleAcceptCookies}
            >
              {t("auth.agree")}
            </button>
            <a
              href="https://reppic.ai/disclaimer"
              target="_blank"
              rel="noopener noreferrer"
              className="tw-text-sm tw-font-medium tw-underline hover:tw-opacity-80"
              style={{ color: PRIMARY }}
            >
              {t("auth.moreInfo")}
            </a>
          </div>
        </div>
      )}
      <section
        className="tw-flex tw-items-center tw-justify-center tw-min-h-screen tw-px-4 sm:tw-px-12 lg:tw-px-20"
        style={{ backgroundColor: PAGE_BG }}
      >
        <div
          className="tw-w-full tw-max-w-lg tw-bg-white tw-rounded-2xl tw-p-6 sm:tw-p-10"
          style={{ boxShadow: CARD_SHADOW }}
        >
          <div
            className="tw-rounded-2xl tw-p-2 tw-h-[8rem] tw-bg-cover tw-bg-left tw-bg-no-repeat"
            style={{ backgroundImage: "url('/img/reppic_transparant.svg')" }}
          />

          {step === "credentials" ? (
            <>
              <h1 className="tw-font-bold tw-text-2xl tw-text-gray-900 tw-text-center tw-mt-4 tw-mb-2">
                {t("auth.logIn")}
              </h1>
              <p className="tw-text-sm tw-text-gray-500 tw-text-center tw-mb-8">
                {t("auth.welcomeMsg")}
              </p>
              {backendError && (
                <p className="tw-text-sm tw-text-red-600 tw-text-center tw-mb-4 -tw-mt-[2rem]">
                  {backendError}
                </p>
              )}

              <form
                className="tw-w-full tw-flex tw-flex-col tw-items-center"
                onSubmit={handleCredentialsSubmit}
              >
                <div className="tw-w-full tw-mb-4">
                  <label className="tw-block tw-text-sm tw-font-medium tw-text-gray-700 tw-mb-2">
                    {t("form.email")}
                  </label>
                  <input
                    type="email"
                    className={`${inputClasses} ${loading || !cookieAccepted ? "tw-opacity-50 tw-cursor-not-allowed" : ""}`}
                    placeholder={t("auth.enterYourEmail")}
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    disabled={!cookieAccepted}
                  />
                </div>

                <div className="tw-w-full tw-mb-4">
                  <label className="tw-block tw-text-sm tw-font-medium tw-text-gray-700 tw-mb-2">
                    {t("auth.password")}
                  </label>
                  <div className="tw-relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      className={`${inputClasses} tw-pr-12 ${loading || !cookieAccepted ? "tw-opacity-50 tw-cursor-not-allowed" : ""}`}
                      placeholder={t("auth.enterYourPassword")}
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      disabled={!cookieAccepted}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="tw-absolute tw-right-4 tw-top-1/2 -tw-translate-y-1/2 tw-text-gray-500 hover:tw-text-gray-700"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="tw-w-full tw-flex tw-flex-col sm:tw-flex-row tw-items-center tw-justify-between">
                  <div className="tw-flex tw-items-center tw-text-red-600">
                    {(errors.email || errors.password) && (
                      <p className="tw-text-sm tw-text-red-600 tw-text-center">
                        {ERROR_MESSAGE}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  className={`tw-w-full tw-mt-2 tw-h-12 tw-flex tw-items-center tw-justify-center ${primaryButtonClasses} ${loading || !cookieAccepted ? "tw-opacity-50 tw-cursor-not-allowed" : ""}`}
                  type="submit"
                  disabled={loading || !cookieAccepted}
                >
                  {loading ? <Spinner /> : t("auth.signIn")}
                </button>
                <div className="tw-mt-4 tw-ml-auto">
                  <a
                    href="/auth/reset/basic-reset"
                    className="tw-text-sm tw-font-medium hover:tw-opacity-80"
                    style={{ color: PRIMARY }}
                  >
                    {t("auth.forgotPassword")}
                  </a>
                </div>
              </form>
            </>
          ) : (
            <>
              <h1 className="tw-font-bold tw-text-2xl tw-text-gray-900 tw-text-center tw-mt-4 tw-mb-2">
                {t("auth.loginOtpTitle")}
              </h1>
              <p className="tw-text-sm tw-text-gray-500 tw-text-center tw-mb-8">
                {t("auth.codeSentTo")}{" "}
                <span className="tw-font-semibold tw-text-gray-700">
                  {formData.email}
                </span>
              </p>
              <form
                className="tw-w-full tw-flex tw-flex-col tw-items-center"
                onSubmit={handleOtpSubmit}
              >
                <div className="tw-mb-4 tw-w-full tw-flex tw-flex-col tw-items-center">
                  <div className="tw-flex tw-justify-center tw-gap-2">
                    {otpCode.map((digit, index) => (
                      <input
                        key={index}
                        id={`login-code-${index}`}
                        type="text"
                        inputMode="numeric"
                        className="tw-w-14 tw-h-14 tw-text-center tw-text-xl tw-rounded-xl tw-bg-[#F5F6F8] tw-border-0 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-[#5971F6]"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleCodeChange(index, e)}
                        onPaste={(e) => handleCodePaste(index, e)}
                        onKeyDown={(e) => handleCodeKeyDown(index, e)}
                        disabled={loading}
                      />
                    ))}
                  </div>
                  {errors.code && (
                    <p
                      className="tw-text-red-600 tw-text-sm tw-text-center tw-mt-3 tw-max-w-sm tw-mx-auto tw-leading-relaxed"
                      role="alert"
                    >
                      {errors.code}
                    </p>
                  )}
                </div>

                <label className="tw-flex tw-items-center tw-justify-center tw-gap-2 tw-mb-4 tw-w-full tw-cursor-pointer">
                  <input
                    type="checkbox"
                    checked={trustDevice}
                    onChange={(e) => setTrustDevice(e.target.checked)}
                    className="tw-rounded"
                  />
                  <span className="tw-text-sm tw-text-gray-700">
                    {t("auth.trustDevice")}
                  </span>
                </label>

                <button
                  className={`tw-w-full tw-h-12 tw-flex tw-items-center tw-justify-center ${primaryButtonClasses} ${loading ? "tw-opacity-50 tw-cursor-not-allowed" : ""}`}
                  type="submit"
                  disabled={loading}
                >
                  {loading ? <Spinner /> : t("auth.verifyAndSignIn")}
                </button>

                <div className="tw-mt-4 tw-flex tw-flex-col tw-items-center">
                  <p className="tw-text-sm tw-text-gray-500">
                    {t("auth.notReceivedCode")}{" "}
                    <button
                      type="button"
                      onClick={resendOtp}
                      className="tw-font-medium hover:tw-opacity-80"
                      style={{ color: PRIMARY }}
                    >
                      {t("auth.resendCode")}
                    </button>
                  </p>
                  <button
                    type="button"
                    onClick={() => resetToCredentials()}
                    className="tw-flex tw-text-sm tw-mt-5 tw-text-gray-700 tw-items-center tw-font-medium hover:tw-text-gray-900"
                  >
                    <ArrowLeftIcon className="tw-w-4" /> &nbsp;{" "}
                    {t("auth.backToLogIn")}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </section>
    </>
  );
}
