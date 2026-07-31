"use client";
import { Switch } from "@headlessui/react";
import { useState, useEffect } from "react";
import { toast, ToastContainer } from "react-toastify";
import { Spinner } from "@/components/MaterialTailwind";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import { useTranslation } from "react-i18next";

const NotificationSettings = () => {
  const { t } = useTranslation('common');
  const defaultSettings = {
    // comments: {
    //   push: false,
    //   email: false,
    //   sms: false,
    //   content:
    //     "These are notifications for comments on your posts and replies to your comments.",
    // },
    // tags: {
    //   push: false,
    //   email: false,
    //   sms: false,
    //   content:
    //     "These are notifications for when someone tags you in a comment, post, or story.",
    // },
    reminders: {
      // push: false,
      email: false,
      // sms: false,
      content:
        t('notificationSettings.updatesInform'),
    },
    // more_activity_about_you: {
    //   push: false,
    //   email: false,
    //   sms: false,
    //   content:
    //     "These are notifications for posts on your profile, likes, and other reactions to your posts and more.",
    // },
  };

  const [settings, setSettings] = useState(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingData, setIsSavingData] = useState(false);

  useEffect(() => {
    fetchUserSettings();
  }, []);

  const fetchUserSettings = async () => {
    try {
      const headers = getAuthHeaders();

      const response = await fetch("/api/user", {
        method: "GET",
        headers,
      });

      const result = await response.json();
      if (!response.ok) {
        toast.error(result.message || t("errorMessages.failedToFetchSettings"));
        return;
      }

      const userSettings =
        result.data?.user_settings?.[0]?.notification_setting || {};

      // Merge BE data with default structure
      const mergedSettings = { ...defaultSettings };
      Object.keys(userSettings).forEach((category) => {
        if (mergedSettings[category]) {
          mergedSettings[category] = {
            ...mergedSettings[category],
            ...userSettings[category],
          };
        }
      });

      setSettings(mergedSettings);
    } catch (error) {
      toast.error(t("errorMessages.errorFetchingNotifications"));
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSetting = (category: string, type: string) => {
    setSettings((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [type]: !prev[category][type],
      },
    }));
  };

  const saveSettings = async () => {
    try {
      setIsSavingData(true);
      const headers = getAuthHeaders();

      const cleanedSettings = Object.fromEntries(
        Object.entries(settings).map(([category, values]) => [
          category,
          Object.fromEntries(
            Object.entries(values).filter(([key]) => key !== "content")
          ),
        ])
      );

      const payload = {
        type: "UPDATE_USER_PREFERENCES",
        data: { notification_preferences: cleanedSettings },
      };

      const response = await fetch("/api/user/settings", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) {
        toast.error(result.message || t("errorMessages.failedToUpdateSettings"));
        return;
      }

      toast.success(t("successMessages.notificationPreferenceUpdated"));
    } catch (error) {
      toast.error(t("errorMessages.errorUpdatingNotificationPreference"));
      console.error(error);
    }
    setIsSavingData(false);
  };

  if (isLoading)
    return (
      <div className="tw-flex tw-justify-center tw-items-center tw-h-screen">
        <div className="tw-animate-spin tw-rounded-full tw-h-10 tw-w-10 tw-border-t-2 tw-border-b-2 tw-border-blue-500"></div>
      </div>
    );

  return (
    <>
      <ToastContainer />
      <div className="tw-bg-white tw-rounded-3xl tw-shadow-md tw-py-6 tw-px-8">
        <h2 className="tw-text-lg tw-font-medium tw-mb-0 tw-font-[system-ui]">
          {t('notificationSettings.notificationsText')}
        </h2>
        <p className="tw-text-sm tw-text-[#667085] tw-font-normal tw-mb-4 tw-font-[system-ui]">
          {t('notificationSettings.notificationInform')}
        </p>
        <hr />
        <div className="tw-divide-y tw-divide-gray-200">
          {Object.entries(settings).map(([key, value]: any) => (
            <div
              key={key}
              className="tw-py-4 tw-flex tw-flex-col sm:tw-flex-row sm:tw-items-center tw-justify-between tw-gap-4"
            >
              {/* Title & Description */}
              <div>
                <h3 className="tw-font-medium tw-text-sm tw-text-[#000000] tw-capitalize tw-font-[system-ui]">
                  {t(`notificationSettings.${key}`)} {/* Apply translation for the key */}
                </h3>
                <p className="tw-text-sm !tw-font-normal tw-text-[#667085] tw-font-[system-ui]">
                  {value.content}
                </p>
              </div>

              {/* Switch & Label */}
              <div className="tw-flex tw-items-center tw-gap-2">
                {["email"].map((type) => (
                  <div key={type} className="tw-flex tw-items-center tw-gap-2">
                    <Switch
                      checked={value[type]}
                      onChange={() => toggleSetting(key, type)}
                      className={`${
                        value[type] ? "tw-bg-button" : "tw-bg-gray-300"
                      } tw-relative tw-inline-flex tw-h-6 tw-w-11 tw-items-center tw-rounded-full tw-transition`}
                    >
                      <span className="tw-sr-only">{t('common.enable')} {t(`form.${type.toLowerCase}`, type)}</span>
                      <span
                        className={`${
                          value[type] ? "tw-translate-x-6" : "tw-translate-x-1"
                        } tw-inline-block tw-h-4 tw-w-4 tw-transform tw-rounded-full tw-bg-white tw-transition`}
                      />
                    </Switch>
                    <span className="tw-text-sm tw-text-[#344054] tw-font-medium tw-capitalize tw-font-[system-ui]">
                      {t(`form.${type.toLowerCase()}`, type)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <hr className="tw-my-4" />
        <div className="tw-w-full tw-flex tw-justify-center md:tw-justify-start">
        <button
          type="submit"
          onClick={saveSettings}
          className={`tw-px-4 tw-py-2 !tw-text-sm tw-text-white tw-bg-button tw-rounded-3xl ${
            isSavingData ? "tw-opacity-50 tw-cursor-not-allowed" : ""
          }`}
          disabled={isSavingData}
        >
          {isSavingData ? <Spinner className="tw-mx-7" /> : t('notificationSettings.savePreferences')}
        </button>
        </div>

      </div>
    </>
  );
};

export default NotificationSettings;
