"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast, ToastContainer } from "react-toastify";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import StatusDropdown from "@/components/StatusDropdown";
import LanguageDropdown from "@/components/LanguageDropdown";
import { Typography } from "@material-tailwind/react";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { Spinner } from "@/components/MaterialTailwind";
import { useBreadcrumb } from "@/context/BreadcrumbContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useTranslation } from "react-i18next";
import { supportedLanguages } from "@/configs/constants";
interface EntityAddEditProps {
  entityId?: string;
  entityType: "categories" | "tags";
}

const EntityAddEdit: React.FC<EntityAddEditProps> = ({
  entityId,
  entityType,
}) => {
  const { t } = useTranslation("common");
  const { i18n } = useTranslation();
  const { setBreadcrumbs } = useBreadcrumb();
  const userRole = useUserRole();
  const [titleActiveTab, setTitleActiveTab] = useState<string>(i18n.language);
  // Determine entity properties based on type
  const entityConfig = {
    categories: {
      singularName: t("categoriesListing.category"),
      pluralName: t("developments.categories"),
      apiEndpoint: "/api/categories",
      apiType: "GET_CATEGORY",
      routeBase: "/developments/categories",
    },
    tags: {
      singularName: t("categoriesListing.tag"),
      pluralName: t("common.tags"),
      apiEndpoint: "/api/tags",
      apiType: "GET_TAG",
      routeBase: "/developments/tags",
    },
  }[entityType];

  const { singularName, pluralName, apiEndpoint, apiType, routeBase } =
    entityConfig;

  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    titles: {
      en: "",
      fr: "",
      es: "",
      nl: "",
      de: "",
      it: "",
    },
    status: "",
  });
  const [showOtherLangs, setShowOtherLangs] = useState(false);

  // set custom breadcrumbs for the page
  useEffect(() => {
    if (userRole) {
      setBreadcrumbs([
        {
          label: "Developments",
          href: "/developments/library",
        },
        {
          label: entityType === "categories" ? "Categories" : "Tags",
          href: "#",
        },
      ]);
    }
  }, [userRole]);
  const headers = getAuthHeaders() || { "Content-Type": "application/json" };

  useEffect(() => {
    if (entityId) {
      fetchEntityById(entityId);
    }
  }, [entityId]);

  const fetchEntityById = async (id: string) => {
    try {
      const response = await fetch(`${apiEndpoint}?id=${id}&type=${apiType}`, {
        method: "GET",
        headers,
      });

      if (response.ok) {
        const result = await response.json();
        const entity = result.data;
        // Collect all title translations
        const titles: Record<string, string> = {};
        if (entity.titles && Array.isArray(entity.titles)) {
          entity.titles.forEach((t: any) => {
            titles[t.lang_code] = t.value;
          });
        }
        // fallback to main name if no translations
        if (entity.name) titles.en = entity.name;

        setFormData({
          titles: { ...formData.titles, ...titles },
          status: entity.status || "",
        });
      } else {
        console.error(`Failed to fetch ${singularName.toLowerCase()} details.`);
      }
    } catch (error) {
      console.error(
        `Error fetching ${singularName.toLowerCase()} details:`,
        error
      );
    }
  };

  const handleTitleChange = (lang: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      titles: { ...prev.titles, [lang]: value },
    }));
  };

  const handleStatusChange = (value: string) => {
    setFormData((prev) => ({ ...prev, status: value }));
  };

  const isFormValid =
    Object.values(formData.titles).some((title) => title.trim() !== "") &&
    formData.status.trim() !== "";
  
  const handleSubmit = async (e: any) => {
    e.preventDefault();

    if (!isFormValid) {
      toast.error(t("errorMessages.fillAllRequiredFields"));
      return;
    }

    setLoading(true);

    // Prepare titles array for backend
    const titlesArr = Object.entries(formData.titles)
      .filter(([_, value]) => value && value.trim())
      .map(([lang_code, value]) => ({ lang_code, value }));

    const payload = {
      name: formData.titles.en || formData.titles[`${i18n.language}`], // Use English as the main name
      titles: titlesArr,
      status: formData.status,
    };

    let url = apiEndpoint;
    let method = "POST";

    if (entityId) {
      url = `${apiEndpoint}/${entityId}`; // Update mode
      method = "PUT";
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success(
          entityId
            ? `${t('successMessages.elementUpdated', {element: singularName})}`
            : `${t('successMessages.elementAdded', {element: singularName})}`
        );
        router.push(routeBase);
      } else {
        toast.error(
          entityId
            ? `${t('errorMessages.failedToUpdateElement', {element: singularName.toLowerCase()})}`
            : `${t('errorMessages.failedToAddElement', {element: singularName.toLowerCase()})}`
        );
      }
    } catch (error) {
      console.error(`Error saving ${singularName.toLowerCase()}:`, error);
      toast.error(
        `${t('errorMessages.errorOccurredElement', {element: singularName.toLowerCase()})}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBackBtnClick = () => {
    router.push(routeBase);
  };

  const handleTitleTabChange = (lang: string) => {
    setTitleActiveTab(lang);
  }

  return (
    <div className="tw-pt-1 tw-min-h-screen">
      <ToastContainer />
      <div className="tw-mb-6 tw-mt-4">
        <div className="tw-flex tw-justify-center md:tw-justify-start tw-mb-4">
          <button
            onClick={handleBackBtnClick}
            className="tw-flex tw-items-center tw-gap-2 tw-text-[#1D49A7] tw-bg-blue-100 tw-rounded-full tw-h-10 tw-px-5 tw-font-medium tw-text-[0.875rem] hover:tw-bg-blue-200"
          >
            <ArrowLeftIcon className="tw-w-5 tw-h-5" />
            {t('common.back')}
          </button>
        </div>
      </div>
      <div className="tw-mb-4 tw-text-center md:tw-text-left">
        <Typography
          variant="h3"
          className="!tw-font-medium tw-text-blue-gray-900"
        >
          {entityId ? `${t('form.editElement', {element: singularName})}` : `${t('form.addElement', {element: singularName})}`}
        </Typography>
      </div>
      <div className="tw-bg-white tw-rounded-2xl tw-shadow-md tw-p-8">
        <form className="tw-grid tw-grid-cols-1 lg:tw-grid-cols-2 tw-gap-6">
          <div className="tw-space-y-4">
            <div>
              <Typography
                variant="h6"
                className="!tw-font-semibold !tw-text-black tw-mb-2 tw-font-[system-ui]"
              >
                {t('common.name')} <span className="tw-text-red-500">*</span>
              </Typography>
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
              <div>
                {/* Current language input always visible */}
                <div className="tw-flex tw-flex-col tw-items-start">
                  <input
                    type="text"
                    name={`name_${titleActiveTab}`}
                    placeholder={`${t('common.enterElementName', {element: singularName})}`}
                    value={formData.titles[`${titleActiveTab}`] || ""}
                    onChange={(e) => handleTitleChange(`${titleActiveTab}`, e.target.value)}
                    className="tw-w-full tw-px-4 tw-py-2 tw-border tw-border-gray-300 tw-rounded-lg focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 radius-100 tw-text-black tw-placeholder-gray-500"
                  />
                </div>
                 {/* <button
                  type="button"
                  className="tw-mt-2 tw-text-xs tw-text-blue-600 hover:tw-underline tw-font-medium"
                  onClick={() => setShowOtherLangs(!showOtherLangs)}
                >
                  { showOtherLangs ? t('common.hideOtherLanguageFields') : t("common.showOtherLanguageFields") }
                </button> */}
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
                            name={`name_${lang.code}`}
                            placeholder={`${t('common.enterElementName', {element: singularName})}`}
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
              <Typography
                variant="h6"
                className="!tw-font-semibold !tw-text-black tw-mb-2 tw-font-[system-ui]"
              >
                {t('categoriesListing.status')} <span className="tw-text-red-500">*</span>
              </Typography>
              <StatusDropdown
                value={formData.status}
                onChange={handleStatusChange}
              />
            </div>
          </div>
        </form>
      </div>
      <div className="tw-w-full tw-my-9 tw-flex tw-justify-center md:tw-justify-end">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className={`tw-py-2 tw-h-10 tw-px-5 tw-font-medium tw-text-[0.875rem] hover:tw-bg-blue-700 tw-text-white tw-bg-button tw-rounded-3xl ${
            loading ? "tw-opacity-50 tw-cursor-not-allowed" : ""
          }`}
        >
          {loading ? <Spinner className="tw-mx-14" /> : `${t('loadingMessages.saveElement', {element: singularName})}`}
        </button>
      </div>
    </div>
  );
};

export default EntityAddEdit;
