"use client";
import { EnvelopeIcon } from "@heroicons/react/24/outline";
import React, { useEffect, useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import { Spinner } from "@/components/MaterialTailwind";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import { USER_ROLE } from "@/configs/constants";
import { useTranslation } from "react-i18next";

interface ProfileFormProps {
  userRole: string | null;
}
export default function ProfileForm({ userRole }: ProfileFormProps) {
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone_number: "",
    organization: "",
    avatar: "",
  });

  const [errors, setErrors] = useState({
    firstName: "",
    lastName: "",
    phone_number: "",
    email: "",
  });

  const [image, setImage] = useState<string | null>("img/avatar.png");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const headers = getAuthHeaders({}, true);
  const {t} = useTranslation('common')
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const response = await fetch("/api/user", {
          method: "GET",
          headers,
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.message);

        const fullName = result.data.name || "";
        const nameParts = fullName.split(" ");
        const firstName = nameParts.shift() || "";
        const lastName = nameParts.join(" ") || "";

        setProfileData({
          firstName,
          lastName,
          email: result.data.email || "",
          phone_number: result.data.phone_number || "",
          organization: result.data.company?.title || "",
          avatar: result.data.avatar || "",
        });

        if (result.data.avatar) {
          setImage(result.data.avatar);
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
      }
    };

    fetchUserProfile();
  }, []);

  const validateField = (field: string, value: string) => {
    let errorMessage = "";

    if (!value.trim()) {
      errorMessage = t("errorMessages.thisFieldIsRequired");
    } else if (field === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        errorMessage = t("errorMessages.pleaseEnterEmail");
      }
    } else if (field === "phone_number" && value.trim()) {
      if (!/^[0-9\-]+$/.test(value)) {
        errorMessage = t("errorMessages.phoneNumberInvalidFormat");
      } else if (value.replace(/[^0-9]/g, '').length > 20 || value.length > 20) {
        errorMessage = t("errorMessages.phoneNumberMaxLengthTwenty");
      }
    }

    setErrors((prevErrors) => ({ ...prevErrors, [field]: errorMessage }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let newValue = value;
    if (name === "phone_number") {
      // Only allow numbers and dashes, and max length 20
      newValue = newValue.replace(/[^0-9\-]/g, "").slice(0, 20);
    }
    setProfileData((prevData) => ({ ...prevData, [name]: newValue }));

    validateField(name, newValue);
  };

  // Handle Image Upload
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    let hasErrors = false;
    let newErrors = { ...errors };

    Object.keys(profileData).forEach((key) => {
      if (["firstName", "lastName", "phone_number", "email"].includes(key)) {
        if (!profileData[key as keyof typeof profileData].trim()) {
          newErrors = { ...newErrors, [key]: t("errorMessages.thisFieldIsRequired") };
          hasErrors = true;
        }
      }
    });

    if (errors.phone_number) {
      hasErrors = true;
    }

    setErrors(newErrors);
    if (hasErrors) return;

    setIsLoading(true);

    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const formData = new FormData();
      const fullName =
        `${profileData.firstName} ${profileData.lastName}`.trim();

      formData.append("name", fullName);
      formData.append("phone_number", profileData.phone_number);
      formData.append("email", profileData.email);

      if (selectedFile) {
        formData.append("file", selectedFile);
      }

      const response = await fetch("/api/user", {
        method: "PUT",
        headers,
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) {
        if (result.message === "Email is already taken.") {
          toast.error(t('errorMessages.emailAlreadyTaken'));
          setErrors((prev) => ({ ...prev, email: result.message }));
          return;
        }

        throw new Error(result.message);
      }

      toast.success(t('successMessages.profileUpdated'));

      if (selectedFile && result?.data?.avatar) {
        updateAvatar(result.data.avatar);
      }
    } catch (error) {
      toast.error(t("errorMessages.errorUpdatingProfile"));
      console.error("Error updating profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

/**
 * Updates the avatar of the user in local storage and dispatches an event to
 * notify other parts of the app that the avatar has been updated.
 *
 * @param {string} newAvatar The new avatar URL to set.
 */
  const updateAvatar = (newAvatar: string) => {
    const userData = JSON.parse(localStorage.getItem("user_data") || "{}");
    userData.avatar = newAvatar;
    localStorage.setItem("user_data", JSON.stringify(userData));
  
    window.dispatchEvent(new Event("avatarUpdated"));
  };

  return (
    <>
      <ToastContainer />
      <div className="tw-mx-auto tw-bg-white tw-p-6 tw-rounded-lg tw-shadow-md">
        <form
          onSubmit={handleSubmit}
          className="tw-w-full md:tw-w-1/2 tw-space-y-4"
        >
          <div className="tw-flex tw-flex-col md:tw-flex-row tw-gap-4">
            <div className="tw-w-full md:tw-w-1/2">
              <label className="tw-block tw-text-sm tw-font-medium tw-mb-2 tw-text-[#344054]">
                {t('form.firstName')}
              </label>
              <input
                type="text"
                name="firstName"
                value={profileData.firstName}
                onChange={handleInputChange}
                className="tw-w-full tw-px-4 tw-border-gray-400 tw-py-2 tw-border tw-rounded-3xl tw-focus:ring-2 tw-focus:ring-button focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500"
              />
              {errors.firstName && (
                <p className="tw-text-red-500 tw-text-sm">{errors.firstName}</p>
              )}
            </div>
            <div className="tw-w-full md:tw-w-1/2">
              <label className="tw-block tw-text-sm tw-font-medium tw-mb-2 tw-text-[#344054]">
                {t('form.lastName')}
              </label>
              <input
                type="text"
                name="lastName"
                value={profileData.lastName}
                onChange={handleInputChange}
                className="tw-w-full tw-px-4 tw-border-gray-400 tw-py-2 tw-border tw-rounded-3xl tw-focus:ring-2 tw-focus:ring-button focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500"
              />
              {errors.lastName && (
                <p className="tw-text-red-500 tw-text-sm">{errors.lastName}</p>
              )}
            </div>
          </div>

          {/* Email (Read-only) */}
          <div>
            <label className="tw-block tw-text-sm tw-font-medium tw-mb-2 tw-text-[#344054]">
              {t('form.email')}
            </label>
            <div className="tw-relative tw-w-full">
              <EnvelopeIcon className="tw-w-5 tw-h-5 tw-absolute tw-left-3 tw-top-1/2 -tw-translate-y-1/2 tw-text-gray-400" />
              <input
                type="email"
                name="email"
                value={profileData.email}
                onChange={handleInputChange}
                className="tw-w-full tw-pl-10 tw-pr-4 tw-py-2 tw-border tw-border-gray-400 tw-rounded-3xl focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500"
              />
            </div>
            {errors.email && (
              <p className="tw-text-red-500 tw-text-sm">{errors.email}</p>
            )}
          </div>

          {userRole != USER_ROLE.SUPER_ADMIN && (
            <div>
              <label className="tw-block tw-text-sm tw-font-medium tw-mb-2 tw-text-[#344054]">
                {t('form.companyName')}
              </label>
              <input
                type="text"
                name="organization"
                value={profileData.organization}
                onChange={handleInputChange}
                disabled
                className="tw-w-full tw-px-4 tw-border-gray-400 tw-py-2 tw-border tw-rounded-3xl tw-bg-white tw-cursor-not-allowed tw-text-gray-900 focus:tw-outline-none tw-opacity-100"
              />
            </div>
          )}

          <div>
            <label className="tw-block tw-text-sm tw-font-medium tw-mb-2 tw-text-[#344054]">
              {t('form.phoneNo')}
            </label>
            <input
              type="tel"
              name="phone_number"
              value={profileData.phone_number}
              onChange={handleInputChange}
              className="tw-w-full tw-px-4 tw-border-gray-400 tw-py-2 tw-border tw-rounded-3xl tw-focus:ring-2 tw-focus:ring-button focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500"
              pattern="^[0-9\-]+$"
              maxLength={20}
              autoComplete="off"
            />
            {errors.phone_number && (
              <p className="tw-text-red-500 tw-text-sm">
                {errors.phone_number}
              </p>
            )}
          </div>

          <div className="tw-flex tw-flex-col md:tw-flex-row tw-items-center tw-w-full tw-gap-4">
            {/* Profile Image */}
            {/* <div className="tw-w-16 tw-h-16 tw-rounded-full tw-overflow-hidden tw-bg-gray-200 tw-shadow-md">
              {image ? (
                <img
                  src={image}
                  alt="Profile"
                  className="tw-w-full tw-h-full tw-object-cover"
                />
              ) : (
                <span className="tw-flex tw-items-center tw-justify-center tw-h-full tw-text-gray-500"></span>
              )}
            </div> */}

            {/* Upload Box */}
            {/* <div className="tw-w-full md:tw-w-[90%] tw-bg-white tw-flex tw-items-center tw-justify-center">
              <label className="tw-w-full tw-h-[7.875rem] tw-border tw-border-solid tw-border-gray-400 tw-rounded-full tw-py-10 tw-flex tw-flex-col tw-items-center tw-justify-center tw-cursor-pointer">
                <input
                  type="file"
                  accept=".svg,.png,.jpg,.gif,.webp"
                  className="tw-hidden"
                  onChange={handleImageUpload}
                />
                <img src="/img/upload_cloud_icon.svg" alt="upload icon" />
                <span className="tw-text-gray-500 tw-text-sm">
                  <span className="tw-text-blue-500">{t('form.uploadText')}</span> {t('form.dragText')}
                </span>
                <span className="tw-text-xs tw-text-gray-500 tw-block tw-ml-5 sm:tw-ms-0 sm:tw-inline">
                  SVG, PNG, JPG or GIF ({t('form.maxSize')})
                </span>
              </label>
            </div> */}
          </div>

          {/* Submit Button */}
          <div className="tw-w-full tw-flex tw-justify-center md:tw-justify-start">
            <button
              type="submit"
              className={`tw-px-6 tw-py-2 tw-text-white tw-bg-button tw-rounded-3xl ${
                isLoading ? "tw-opacity-50 tw-cursor-not-allowed" : ""
              }`}
              disabled={isLoading}
            >
              {isLoading ? <Spinner className="tw-mx-7" /> : t("form.saveChanges")}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
