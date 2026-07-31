"use client";
import authMiddleware from "@/middleware/authMiddleware";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { toast, ToastContainer } from "react-toastify";
import { USER_ROLE } from "@/configs/constants";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import { useTranslation } from "react-i18next";

function AddMemberForm() {
  const [client, setClient] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [phone, setPhone] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const headers = getAuthHeaders()
  const { t } = useTranslation("common");

  useEffect(() => {
    setClient(true);
  }, []);

  if (!client) {
    return null;
  }

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImage(file);
      setPreviewImage(URL.createObjectURL(file));
    }
  };

  const validateForm = () => {
    let newErrors: { [key: string]: string } = {};

    if (!firstName.trim()) newErrors.firstName = t("errorMessages.firstNameRequired");
    if (!lastName.trim()) newErrors.lastName = t("errorMessages.lastNameRequired");
    if (!email.match(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)) {
      newErrors.email = t("errorMessages.invalidEmailFormat");
    }
    if (!phone.match(/^\+?[0-9]{7,15}$/)) {
      newErrors.phone = t("errorMessages.invalidPhoneNumberFormat");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateForm()) return;
    setLoading(true);

    const formData = new FormData();
    formData.append("name", `${firstName} ${lastName}`);
    formData.append("email", email);
    formData.append("organization", organization);
    formData.append("phone_number", phone);
    if (image) {
      formData.append("file", image);
    }

    try {
      const response = await fetch("/api/user", {
        method: "POST",
        body: formData,
        headers
      });

      if (!response.ok) {
        const result = await response.json();
        setErrors({ general: result.message || t("errorMessages.failedToAddUser") });
        return;
      }
      toast.success(t("successMessages.userAdded"));
      localStorage.setItem("memberAdded", "true");
      router.push("/my-team");
    } catch (err) {
      toast.error(t("errorMessages.failedToAddUser"));
    }
    setLoading(false);
  };

  return (
    <>
      <ToastContainer />
      <div className="tw-mb-4 tw-mt-4">
        <div className="tw-flex tw-items-center tw-justify-between tw-mb-4">
          <button
            onClick={() => router.push(`/my-team`)}
            className="tw-flex tw-items-center tw-gap-2 tw-bg-blue-100 tw-text- tw-rounded-full tw-h-10 tw-px-5 tw-font-medium tw-text-[0.875rem] hover:tw-bg-blue-200"
          >
            <ArrowLeftIcon className="tw-w-5 tw-h-5" />
            {t('addMember.myTeam')}
          </button>
        </div>
      </div>
      <div className="tw-mx-auto tw-bg-white tw-p-6 tw-mt-4 tw-rounded-lg tw-shadow-md">
        <form className="tw-space-y-4" onSubmit={handleSubmit}>
          {/* First & Last Name */}
          <div className="tw-flex tw-gap-4">
            <div className="tw-w-1/2">
              <label className="tw-block tw-text-sm tw-font-medium tw-text-gray-900 tw-mb-2">
                {t('form.firstName')}
              </label>
              <input
                type="text"
                className="tw-w-full tw-px-4 tw-border-gray-400 tw-py-2 tw-border tw-rounded-3xl"
                value={firstName} onChange={(e) => setFirstName(e.target.value)}
              />
              {errors.firstName && <p className="tw-text-red-500 tw-text-sm">{errors.firstName}</p>}
            </div>
            <div className="tw-w-1/2">
              <label className="tw-block tw-text-sm tw-font-medium tw-text-gray-900 tw-mb-2">
                {t('form.lastName')}
              </label>
              <input
                type="text"
                className="tw-w-full tw-px-4 tw-border-gray-400 tw-py-2 tw-border tw-rounded-3xl"
                value={lastName} onChange={(e) => setLastName(e.target.value)}
              />
              {errors.lastName && <p className="tw-text-red-500 tw-text-sm">{errors.lastName}</p>}
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="tw-block tw-text-sm tw-font-medium tw-text-gray-900 tw-mb-2">
              {t('form.email')}
            </label>
            <input
              type="email"
              className="tw-w-full tw-px-4 tw-border-gray-400 tw-py-2 tw-border tw-rounded-3xl"
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
            {errors.email && <p className="tw-text-red-500 tw-text-sm">{errors.email}</p>}
          </div>

          {/* Organization */}
          <div>
            <label className="tw-block tw-text-sm tw-font-medium tw-text-gray-900 tw-mb-2">
              {t('addMember.organization')}
            </label>
            <input
              type="text"
              className="tw-w-full tw-px-4 tw-border-gray-400 tw-py-2 tw-border tw-rounded-3xl"
              value={organization} onChange={(e) => setOrganization(e.target.value)}
            />
          </div>

          {/* Phone Number */}
          <div>
            <label className="tw-block tw-text-sm tw-font-medium tw-text-gray-900 tw-mb-2">
              {t('form.phoneNo')}
            </label>
            <input
              type="tel"
              className="tw-w-full tw-px-4 tw-border-gray-400 tw-py-2 tw-border tw-rounded-3xl"
              value={phone} onChange={(e) => setPhone(e.target.value)}
            />
            {errors.phone && <p className="tw-text-red-500 tw-text-sm">{errors.phone}</p>}
          </div>
          <div className="tw-flex tw-items-center tw-w-full tw-gap-4">
            {/* Profile Image (25%) */}
            <div className="tw-w-[10%] tw-flex tw-items-center">
              <div className="tw-w-16 tw-h-16 tw-rounded-full tw-overflow-hidden tw-bg-gray-200 tw-shadow-md">
                {previewImage ? (
                  <img
                    src={previewImage}
                    alt="Profile"
                    className="tw-w-full tw-h-full tw-object-cover"
                  />
                ) : (
                  <span className="tw-flex tw-items-center tw-justify-center tw-h-full tw-text-gray-500"></span>
                )}
              </div>
            </div>

            {/* Upload Box (75%) */}
            <div className="tw-w-[90%] tw-bg-white tw-flex tw-items-center tw-justify-center">
              <label className="tw-w-full tw-h-[7.875rem] tw-border tw-border-solid tw-border-gray-400 tw-rounded-full tw-py-10 tw-flex tw-flex-col tw-items-center tw-justify-center tw-cursor-pointer">
                <input
                  type="file"
                  accept=".svg,.png,.jpg,.gif"
                  className="tw-hidden"
                  onChange={handleImageUpload}
                />
                <img src="/img/upload_cloud_icon.svg" alt="upload icon" />
                <span className="tw-text-gray-500">
                  <span className="tw-text-blue-500">{t('form.uploadText')}</span> {t('form.dragText')}
                </span>
                <span className="tw-text-xs tw-text-gray-500">
                  SVG, PNG, JPG or GIF (max. 800×400px)
                </span>
              </label>
            </div>
          </div>
          {/* Horizontal Divider */}
          <hr className="tw-border-t tw-my-4 tw-border-gray-300" />

          {/* Submit Button */}
          <button 
              type="submit" 
              className={`tw-px-6 tw-py-2 tw-text-white tw-bg-button tw-rounded-3xl ${
                loading ? "tw-opacity-50 tw-cursor-not-allowed" : ""
              }`} 
              disabled={loading}
            >
              {loading ? <svg className="tw-animate-spin tw-h-4 tw-w-4 tw-mx-7 tw-text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="tw-opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="tw-opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : t("addMember.addMember")}
            </button>

        </form>
      </div>
    </>
  );
}

export default authMiddleware(AddMemberForm, USER_ROLE.MANAGER)