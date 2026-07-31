"use client";
import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast, ToastContainer } from "react-toastify";
import CategoryDropdown from "@/components/CategoryDropdown";
import TypeDropdown from "@/components/TypeDropdown";
import TagDropdown from "@/components/TagDropdown";
import PhaseDropdown from "@/components/PhaseDropdown";
import LanguageDropdown from "@/components/LanguageDropdown";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import { loggedInUser } from "@/hooks/useUserRole";
import { ArrowLeftIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { Card, Typography } from "@material-tailwind/react";
import { STATUS } from "@/configs/constants";
import { useUserRole } from "@/hooks/useUserRole";
import { useBreadcrumb } from "@/context/BreadcrumbContext";
import { useTranslation } from "react-i18next";
import { supportedLanguages } from "@/configs/constants";

const VideoForm: React.FC<{}> = () => {
  const router = useRouter();
  const [videoId, setVideoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const userRole = useUserRole();
  const { setBreadcrumbs } = useBreadcrumb();
  const { t, i18n } = useTranslation('common');
  const [showOtherLangs, setShowOtherLangs] = useState(false);
  const [showOtherEmbeddedCode, setShowOtherEmbeddedCode] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(i18n.language);
  const [titleActiveTab, setTitleActiveTab] = useState<string>(i18n.language);
  // set custom breadcrumbs for the page
  useEffect(() => {
    if (userRole) {
      setBreadcrumbs([
        {
          label: "Developments",
          href: "/developments/library",
        },
        {
          label: "Videos",
          href: "#",
        },
      ]);
    }
  }, [userRole]);

  const [formData, setFormData] = useState({
    titles: {
      en: "",
      fr: "",
      es: "",
      nl: "",
      de: "",
      it: "",
    },
    phase: 1,
    number: "",
    embedded_codes: {
      en: "",
      fr: "",
      es: "",
      nl: "",
      de: "",
      it: "",
    },
    category: "",
    tags: [],
    type: "",
    thumbnail_url: "",
  });

  const headers = getAuthHeaders() || { "Content-Type": "application/json" };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setVideoId(params.get("id")); // Get the id from the URL
  }, []);

  useEffect(() => {
    if (videoId) {
      fetchVideoById(videoId);
    }
  }, [videoId]);

  const fetchVideoById = async (id: string) => {
    try {
      const response = await fetch(`/api/videos?id=${id}&type=GET_VIDEO`, {
        method: "GET",
        headers,
      });

      if (response.ok) {
        const result = await response.json();
        const video = result.data;
        // Collect all title translations
        const titles: Record<string, string> = {};
        const embedded_codes: Record<string, string> = {};
        if (video.titles && Array.isArray(video.titles)) {
          video.titles.forEach((t: any) => {
            titles[t.lang_code] = t.value;
            embedded_codes[t.lang_code] = t.embedded_code;
          });
        }
        // fallback to main title if no translations
        if (video.title) titles.en = video.title;

        // fallback to main embedded_code if no translations
        if (video.embedded_code) embedded_codes.en = video.embedded_code;

        setFormData({
          titles: { ...formData.titles, ...titles },
          phase: video.phase || "",
          number: video.number?.toString() || "",
          embedded_codes: { ...formData.embedded_codes, ...embedded_codes },
          category: video.category?.id || "",
          tags: video.tags.map((tag: any) => tag.tag.id) || [],
          type: video.type || "",
          thumbnail_url: video.thumbnail_path || "",
        });

        // Set thumbnail preview if exists
        if (video.thumbnail_path) {
          setThumbnailPreview(video.thumbnail_path);
        }
      } else {
        console.error("Failed to fetch video details.");
      }
    } catch (error) {
      console.error("Error fetching video details:", error);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCategoryChange = (value: string) => {
    setFormData((prev) => ({ ...prev, category: value }));
  };

  const handleTypeChange = (value: string) => {
    setFormData((prev) => ({ ...prev, type: value }));
  };

  const handleTagChange = (value: string[]) => {
    setFormData((prev) => ({ ...prev, tags: value }));
  };

  const handlePhaseChange = (value: number) => {
    setFormData((prev) => ({ ...prev, phase: value }));
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setThumbnail(file);

      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setThumbnailPreview(previewUrl);
    }
  };

  const handleRemoveThumbnail = () => {
    setThumbnail(null);
    setThumbnailPreview("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setFormData((prev) => ({ ...prev, thumbnail_url: "" }));
  };

  const handleTitleChange = (lang: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      titles: { ...prev.titles, [lang]: value },
    }));
  };

  const handleEmbeddedCodeChange = (lang: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      embedded_codes: { ...prev.embedded_codes, [lang]: value },
    }));
  };

  const handleTabChange = (lang: string) => {
    setActiveTab(lang);
  };

  const handleTitleTabChange = (lang: string) => {
    setTitleActiveTab(lang);
  }

  const isFormValid =
    Object.values(formData.titles).some((title) => title.trim()) && // At least one valid title
    Object.values(formData.embedded_codes).some((embedded_code) => embedded_code.trim()) && // At least one valid embedded code
    formData.phase > 0 &&
    formData.number.trim() !== "" &&
    formData.category.trim() !== "" &&
    formData.tags.length > 0 &&
    formData.type.trim() !== "";
  const handleSubmit = async (e: any) => {
    e.preventDefault();
    // Fill empty titles from embedded codes
    const updatedTitles = { ...formData.titles };
    Object.entries(formData.embedded_codes).forEach(([lang, embeddedCode]) => {
      if (!updatedTitles[lang]?.trim() && embeddedCode.trim()) {
        const extracted = extractTitleFromEmbeddedCode(embeddedCode);
        if (extracted && extracted.lang === lang) {
          updatedTitles[lang] = extracted.title;
        }
      }
    });

    setFormData((prev) => ({ ...prev, titles: updatedTitles }));

    if (!isFormValid) {
      toast.error(t("errorMessages.fillAllRequiredFields"));
      return;
    }
    setLoading(true);
    const userData = loggedInUser() || {};

    const formDataToSend = new FormData();

    // Prepare titles array for backend
    const titlesArr = Object.entries(updatedTitles)
      .map(([lang_code, value]) => ({
        lang_code,
        value,
        embedded_code: formData.embedded_codes[lang_code] || "", // Add embedded_code for the same lang_code
      }));

    const videoData = {
      title: updatedTitles["en"] || updatedTitles[`${i18n.language}`],
      titles: titlesArr,
      phase: formData.phase,
      number: formData.number,
      embedded_code: formData.embedded_codes["en"] || formData.embedded_codes[`${i18n.language}`],
      category_id: formData.category,
      tags: formData.tags,
      type: formData.type,
      uploaded_by: userData?.id ? userData.id : null,
      status: STATUS.ACTIVE,
    };

    formDataToSend.append("type", videoId ? "UPDATE_VIDEO" : "CREATE_VIDEO");
    formDataToSend.append("videoData", JSON.stringify(videoData));
    if (thumbnail) {
      formDataToSend.append("thumbnail", thumbnail);
    }

    let url = "/api/videos";
    if (videoId) {
      url += `/${videoId}`;
    }

    try {
      const uploadHeaders = { ...headers };
      delete uploadHeaders["Content-Type"];

      const response = await fetch(url, {
        method: videoId ? "PUT" : "POST",
        headers: uploadHeaders,
        body: formDataToSend,
      });

      if (response.ok) {
        toast.success(
          videoId ? t("successMessages.videoUpdated") : t("successMessages.videoAdded")
        );
        router.push("/developments/library");
      } else {
        toast.error(
          videoId ? `${t("errorMessages.failedToUpdateVideo")}` : `${t("errorMessages.failedToAddVideo")}`
        );
      }
    } catch (error) {
      console.error("Error saving video:", error);
      toast.error(`${t("errorMessages.errorOccurredVideo")}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBackBtnClick = () => {
    router.push("/developments/library");
  };

  const extractTitleFromEmbeddedCode = (embeddedCode: string): { lang: string; title: string } | null => {
    const iframeRegex = /<iframe[^>]*src="[^"]*\/embeds\/[a-zA-Z0-9-]+-([a-z]{2})(?:_[a-zA-Z-]+)?"[^>]*title="([^"]+)"[^>]*>/;
    const match = embeddedCode.match(iframeRegex);
    if (match) {
      const lang = match[1];
      const title = match[2];
      return { lang, title };
    }
    return null;
  };

  return (
    <div className="tw-px-0 tw-py-3 tw-min-h-screen">
      <ToastContainer />
      <div className="tw-mb-0 tw-mt-0">
        <div className="tw-flex tw-flex-col md:tw-flex-row md:tw-items-center md:tw-justify-between tw-mb-4">
          <div className="tw-flex tw-justify-center md:tw-justify-start">
            <button
              onClick={handleBackBtnClick}
              className="tw-flex tw-items-center tw-gap-2 tw-bg-blue-100 tw-text-blue-800 tw-rounded-full tw-h-10 tw-px-5 tw-font-medium tw-text-[0.875rem] hover:tw-bg-blue-200"
            >
              <ArrowLeftIcon className="tw-w-5 tw-h-5" />
              {t('common.back')}
            </button>
          </div>
        </div>
      </div>

      <div className="tw-text-center md:tw-text-left tw-mb-4">
        <Typography
          variant="h3"
          className="!tw-font-medium tw-text-blue-gray-900"
        >
          {videoId ? `${t('form.edit')} ` : `${t('form.add')} `} {t('addVideo.video')}
        </Typography>
      </div>
      <Card className="tw-border tw-border-blue-gray-100 tw-shadow-sm tw-font-inter tw-bg-indigo-50 tw-p-8">
        <form className="tw-grid tw-grid-cols-1 lg:tw-grid-cols-2 tw-gap-6">
          <div className="tw-space-y-4">
            <div className="">
              <label className="tw-block tw-text-sm tw-font-medium tw-text-gray-700 form-label">
                {t('addVideo.videoTitle')} <span className="tw-text-red-500">*</span>
              </label>
              <div className="tw-flex tw-border-b tw-border-gray-300 tw-mb-4">
                {supportedLanguages.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => handleTitleTabChange(lang.code)}
                    className={`tw-px-4 tw-py-2 tw-text-sm tw-font-medium ${
                      titleActiveTab === lang.code ? "tw-text-blue-gray-900 tw-border-b-2 tw-border-blue-500" : "tw-text-gray-500"
                    }`}
                  >
                    {t(`languageLabels.${lang.label.toLowerCase()}`)}
                  </button>
                ))}
              </div>
              {/* Language Title Inputs */}
              <div>
                {/* Current language input always visible */}
                <div className="tw-flex tw-flex-col tw-items-start">
                  <input
                    type="text"
                    name={`video_title_${titleActiveTab}`}
                    placeholder={t("addVideo.enterVideoTitle")}
                    value={formData.titles[`${titleActiveTab}`] || ""}
                    onChange={(e) => handleTitleChange(`${titleActiveTab}`, e.target.value)}
                    className="tw-w-full tw-px-4 tw-py-2 tw-border tw-border-gray-300 tw-rounded-lg focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 radius-100 tw-text-black tw-placeholder-gray-500"
                  />
                </div>
                {/* Show other language fields link */}
                {/* {showOtherLangs && (
                  <div className="tw-mt-4 tw-space-y-4">
                    {supportedLanguages
                      .filter((lang) => lang.code !== `${i18n.language}`)
                      .map((lang) => (
                        <div key={lang.code} className="tw-flex tw-flex-col tw-items-start">
                          <span className="tw-text-xs tw-font-medium tw-mb-1">{t(`languageLabels.${lang.label.toLowerCase()}`)}</span>
                          <input
                            type="text"
                            name={`video_title_${lang.code}`}
                            placeholder={t("addVideo.enterVideoTitle")}
                            value={formData.titles[lang.code] || ""}
                            onChange={(e) => handleTitleChange(lang.code, e.target.value)}
                            className="tw-w-full tw-px-4 tw-py-2 tw-border tw-border-gray-300 tw-rounded-lg focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 radius-100 tw-text-black tw-placeholder-gray-500"
                          />
                        </div>
                    ))}
                  </div>
                )} */}
              </div>
            </div>
            <div>
              <label className="tw-block tw-text-sm tw-font-medium tw-text-gray-700 form-label">
                {t('addVideo.phase')} <span className="tw-text-red-500">*</span>
              </label>
              <PhaseDropdown
                value={formData.phase}
                onChange={handlePhaseChange}
              />
            </div>
            <div>
              <label className="tw-block tw-text-sm tw-font-medium tw-text-gray-700 form-label">
                {t('addVideo.number')} <span className="tw-text-red-500">*</span>
              </label>
              <input
                name="number"
                placeholder={t("addVideo.addNumber")}
                value={formData.number}
                onChange={handleInputChange}
                className="tw-w-full tw-px-4 tw-py-2 tw-border tw-border-gray-300 tw-rounded-lg focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 radius-100 tw-text-black tw-placeholder-gray-500"
              />
            </div>
            <div>
              <label className="tw-block tw-text-sm tw-font-medium tw-text-gray-700 form-label">
                {t('addVideo.embeddedCode')} <span className="tw-text-red-500">*</span>
              </label>
              <div className="tw-flex tw-border-b tw-border-gray-300 tw-mb-4">
                {supportedLanguages.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => handleTabChange(lang.code)}
                    className={`tw-px-4 tw-py-2 tw-text-sm tw-font-medium ${
                      activeTab === lang.code ? "tw-text-blue-gray-900 tw-border-b-2 tw-border-blue-500" : "tw-text-gray-500"
                    }`}
                  >
                    {t(`languageLabels.${lang.label.toLowerCase()}`)}
                  </button>
                ))}
              </div>
              <div className="tw-flex tw-flex-col tw-items-start">
                <textarea
                  name={`embedded_code_${activeTab}`}
                  placeholder={t("addVideo.enterEmbeddedCode")}
                  value={formData.embedded_codes[activeTab] || ""}
                  onChange={(e) => handleEmbeddedCodeChange(activeTab, e.target.value)}
                  className="tw-w-full tw-px-4 tw-py-2 tw-rounded-lg tw-bg-white tw-border tw-border-gray-400 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 tw-font-normal tw-text-black tw-placeholder-gray-500"
                  rows={4}
                ></textarea>
              </div>
            </div>
            <div className="tw-w-full tw-mb-4">
              <Typography
                variant="h6"
                className="!tw-font-semibold !tw-text-black tw-mb-2 tw-font-[system-ui]"
              >
                {t('addVideo.thumbnail')}
              </Typography>
              <div className="tw-w-full tw-bg-white">
                {thumbnailPreview ? (
                  <div className="tw-mt-2">
                    <div className="tw-relative tw-inline-block">
                      <img
                        src={thumbnailPreview}
                        alt="Thumbnail Preview"
                        className="tw-h-32 tw-object-cover tw-rounded-md tw-border tw-border-gray-300"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveThumbnail}
                        className="tw-absolute tw-top-1 tw-right-1 tw-bg-red-500 tw-text-white tw-rounded-full tw-w-6 tw-h-6 tw-flex tw-items-center tw-justify-center hover:tw-bg-red-600"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="tw-w-full tw-h-32 tw-border tw-border-solid tw-border-gray-400 tw-rounded-full tw-flex tw-flex-col tw-items-center tw-justify-center tw-cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="tw-hidden"
                      onChange={handleThumbnailChange}
                    />
                    <img
                      src="/img/upload_cloud_icon.svg"
                      alt="upload icon"
                      className="tw-mb-2"
                    />
                    <span className="tw-text-blue-500">{t('form.uploadText')}</span>
                    <span className="tw-text-gray-500 tw-text-sm">
                      {t('form.dragText')}
                    </span>
                  </label>
                )}
              </div>
            </div>

            <div>
              <label className="tw-block tw-text-sm tw-font-medium tw-text-gray-700 form-label">
                {t('addVideo.categoryName')} <span className="tw-text-red-500">*</span>
              </label>
              <CategoryDropdown
                value={formData.category}
                onChange={handleCategoryChange}
                isDropdown={true}
              />
            </div>
            <div>
              <label className="tw-block tw-text-sm tw-font-medium tw-text-gray-700 form-label">
                {t('addVideo.selectMultipleTags')} <span className="tw-text-red-500">*</span>
              </label>
              <TagDropdown
                value={formData.tags}
                onChange={handleTagChange}
                forLibrary={false}
                isDropdown={true}
              />
            </div>
            <div>
              <label className="tw-block tw-text-sm tw-font-medium tw-text-gray-700 form-label">
                {t('typeDropdown.type')} <span className="tw-text-red-500">*</span>
              </label>
              <TypeDropdown value={formData.type} onChange={handleTypeChange} />
            </div>
          </div>
        </form>
      </Card>
      <div className="tw-flex tw-justify-end tw-mt-6">
        <button
          type="submit"
          disabled={!isFormValid}
          className={`save-button ${
            loading || !isFormValid
              ? "tw-opacity-50 tw-cursor-not-allowed"
              : "tw-cursor-pointer"
          }`}
          onClick={handleSubmit}
        >
          {loading ? `${t('loadingMessages.saving')}...` : t("addVideo.saveVideo")}
        </button>
      </div>
    </div>
  );
};

export default VideoForm;
