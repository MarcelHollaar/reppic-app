"use client";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import { Spinner } from "@/components/MaterialTailwind";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import { useTranslation } from "react-i18next";

const PasswordUpdateForm = () => {
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });

  const [errors, setErrors] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });

  const [passwordVisible, setPasswordVisible] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [client, setClient] = useState(false);
  const headers = getAuthHeaders();
  const { t } = useTranslation("common");
  useEffect(() => {
    setClient(true);
  }, []);

  if (!client) {
    return null;
  }

  // Handle Input Changes
  const handleChange = (e: any) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Toggle Password Visibility
  const togglePassword = (field: "current" | "new" | "confirm") => {
    setPasswordVisible((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  // Validate Form Fields
  const validateForm = () => {
    let newErrors = {
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    };
    let isValid = true;

    if (!form.currentPassword.trim()) {
      newErrors.currentPassword = "Current password is required.";
      isValid = false;
    }
    if (!form.newPassword.trim()) {
      newErrors.newPassword = "New password is required.";
      isValid = false;
    } else if (form.newPassword.length < 8) {
      newErrors.newPassword = "Password must be at least 8 characters.";
      isValid = false;
    }
    if (!form.confirmNewPassword.trim()) {
      newErrors.confirmNewPassword = "Please confirm your new password.";
      isValid = false;
    } else if (form.newPassword !== form.confirmNewPassword) {
      newErrors.confirmNewPassword = "Passwords do not match.";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  // Handle Form Submission
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateForm()) return;
    setIsLoading(true);

    try {
      const response = await fetch("/api/user/update-password", {
        method: "POST",
        headers,
        body: JSON.stringify({
          oldPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        if (result?.error?.issues?.length > 0) {
          result.error.issues.map((issue: any) => toast.error(issue?.message));
        } else if (result.message) {
          toast.error(result.message);
        }
        return;
      }
      toast.success(t("successMessages.passwordUpdated"));
    } catch (error) {
      console.error("Error updating password:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <ToastContainer />
      <div className="tw-bg-white tw-rounded-2xl tw-shadow-lg tw-p-6 tw-border tw-border-gray-200">
        <h2 className="tw-text-lg tw-mb-2 tw-font-medium tw-text-gray-900">
          {t("passwordReset.password")}
        </h2>
        <p className="tw-text-sm tw-text-[#667085] tw-mb-2 tw-font-normal">
          {t('passwordReset.passwordText')}
        </p>
        <hr className="tw-my-3" />

        <form onSubmit={handleSubmit} className="tw-space-y-6">
          {/* Current Password */}
          <div className="tw-flex tw-flex-col sm:tw-flex-row tw-items-center sm:tw-items-start tw-gap-4 sm:tw-gap-8">
            <label className="tw-text-sm tw-font-medium tw-text-[#344054] tw-w-full sm:tw-w-1/3 md:tw-w-1/4">
              {t('passwordReset.currentPassword')}
            </label>

            <div className="tw-w-full sm:tw-w-2/3 md:tw-w-1/2">
              {/* Input Field with Eye Icon */}
              <div className="tw-relative tw-flex tw-items-center tw-border tw-border-gray-400 tw-rounded-3xl tw-shadow-sm focus-within:tw-ring-2 focus-within:tw-ring-button">
                <input
                  type={passwordVisible.current ? "text" : "password"}
                  name="currentPassword"
                  className="tw-flex-1 tw-h-[2.75rem] tw-py-1 tw-pl-4 tw-pr-10 tw-rounded-3xl focus:tw-outline-none"
                  value={form.currentPassword}
                  onChange={handleChange}
                />
                {passwordVisible.current ? (
                  <EyeSlashIcon
                    className="tw-w-5 tw-h-5 tw-mr-3 tw-text-gray-500 tw-font-medium cursor-pointer"
                    onClick={() => togglePassword("current")}
                  />
                ) : (
                  <EyeIcon
                    className="tw-w-5 tw-h-5 tw-mr-3 tw-text-gray-500 tw-font-medium cursor-pointer"
                    onClick={() => togglePassword("current")}
                  />
                )}
              </div>

              {/* Error Message */}
              {errors.currentPassword && (
                <p className="tw-text-red-500 tw-text-sm tw-mt-1">
                  {errors.currentPassword}
                </p>
              )}
            </div>
          </div>

          <hr className="tw-my-3" />

          {/* New Password */}
          <div className="tw-flex tw-flex-col sm:tw-flex-row tw-items-center sm:tw-items-start tw-gap-4 sm:tw-gap-8">
            <label className="tw-text-sm tw-font-medium tw-text-[#344054] tw-w-full sm:tw-w-1/3 md:tw-w-1/4">
              {t('passwordReset.newPassword')}
            </label>

            <div className="tw-w-full sm:tw-w-2/3 md:tw-w-1/2">
              <div className="tw-relative tw-flex tw-items-center tw-border tw-border-gray-400 tw-rounded-3xl tw-shadow-sm focus-within:tw-ring-2 focus-within:tw-ring-button">
                <input
                  type={passwordVisible.new ? "text" : "password"}
                  name="newPassword"
                  className="tw-flex-1 tw-h-[2.75rem] tw-py-1 tw-pl-4 tw-pr-10 tw-rounded-3xl focus:tw-outline-none"
                  value={form.newPassword}
                  onChange={handleChange}
                />
                {passwordVisible.new ? (
                  <EyeSlashIcon
                    className="tw-w-5 tw-h-5 tw-mr-3 tw-text-gray-500 tw-font-medium cursor-pointer"
                    onClick={() => togglePassword("new")}
                  />
                ) : (
                  <EyeIcon
                    className="tw-w-5 tw-h-5 tw-mr-3 tw-text-gray-500 tw-font-medium cursor-pointer"
                    onClick={() => togglePassword("new")}
                  />
                )}
              </div>

              {errors.newPassword && (
                <p className="tw-text-red-500 tw-text-sm">
                  {errors.newPassword}
                </p>
              )}
              <p className="tw-text-sm tw-text-[#667085] tw-mt-1">
                {t("passwordReset.passwordValidationDescription")}
              </p>
            </div>
          </div>

          <hr className="tw-my-3" />

          {/* Confirm New Password */}
          <div className="tw-flex tw-flex-col sm:tw-flex-row tw-items-center sm:tw-items-start tw-gap-4 sm:tw-gap-8">
            <label className="tw-text-sm tw-font-medium tw-text-[#344054] tw-w-full sm:tw-w-1/3 md:tw-w-1/4">
              {t('passwordReset.confirmPassword')}
            </label>

            <div className="tw-w-full sm:tw-w-2/3 md:tw-w-1/2">
              {/* Input Field with Eye Icon */}
              <div className="tw-relative tw-flex tw-items-center tw-border tw-border-gray-400 tw-rounded-3xl tw-shadow-sm focus-within:tw-ring-2 focus-within:tw-ring-button">
                <input
                  type={passwordVisible.confirm ? "text" : "password"}
                  name="confirmNewPassword"
                  className="tw-flex-1 tw-h-[2.75rem] tw-py-1 tw-pl-4 tw-pr-10 tw-rounded-3xl focus:tw-outline-none"
                  value={form.confirmNewPassword}
                  onChange={handleChange}
                />
                {passwordVisible.confirm ? (
                  <EyeSlashIcon
                    className="tw-w-5 tw-h-5 tw-mr-3 tw-text-gray-500 tw-font-medium cursor-pointer"
                    onClick={() => togglePassword("confirm")}
                  />
                ) : (
                  <EyeIcon
                    className="tw-w-5 tw-h-5 tw-mr-3 tw-text-gray-500 tw-font-medium cursor-pointer"
                    onClick={() => togglePassword("confirm")}
                  />
                )}
              </div>

              {/* Error Message Below Input */}
              {errors.confirmNewPassword && (
                <p className="tw-text-red-500 tw-text-sm tw-mt-1">
                  {errors.confirmNewPassword}
                </p>
              )}
            </div>
          </div>

          <hr className="tw-my-5" />

          {/* Buttons */}
          <div className="tw-flex tw-flex-row tw-justify-center md:tw-justify-start tw-gap-3 tw-mt-6">
            <button
              type="button"
              className=" tw-border tw-border-[#D0D5DD] tw-text-[#344054] tw-text-sm tw-font-medium tw-py-2 tw-px-4 tw-rounded-3xl"
            >
              {t('passwordReset.cancel')}
            </button>
            <button
              type="submit"
              className={`tw-px-4 tw-py-2 !tw-text-sm tw-text-white tw-bg-button tw-rounded-3xl ${
                isLoading || !form.currentPassword || !form.newPassword || !form.confirmNewPassword ? "tw-opacity-50 tw-cursor-not-allowed" : ""
              }`}
              disabled={isLoading || !form.currentPassword || !form.newPassword || !form.confirmNewPassword}
            >
              {isLoading ? <Spinner className="tw-mx-7" /> : t("passwordReset.updatePassword")}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default PasswordUpdateForm;
