import CustomerDropdown from "@/components/CustomerDropdown";
import i18n from "@/lib/i18n";
import { t } from "i18next";
import { useForm, Controller } from "react-hook-form";
import * as yup from "yup";
import {
  ConversationDraftSchema,
  ConversationSendSchema,
  ConversationFormSchemaType,
} from "../validation/conversationFormSchema";
import { MouseEvent, useEffect } from "react";

type ConversationFormProps = {
  onSaveDraft: (formData: ConversationFormSchemaType) => void;
  onSendConversation: (formData: ConversationFormSchemaType) => void;
  isEditingConversationForm?: boolean;
  isSubmittingDraft?: boolean;
  isSendingConversation?: boolean;
  customers: any[];
  initialFormValues?: ConversationFormSchemaType;
  isSaveDraftSubmitionDisabled?: boolean;
  isSendConversationSubmitionDisabled?: boolean;
};

const ConversationForm = ({
  onSaveDraft,
  onSendConversation,
  isEditingConversationForm,
  isSubmittingDraft = false,
  isSendingConversation = false,
  customers = [],
  initialFormValues = {
    title: "",
    customer_name: "",
    notes: "",
    hasRecording: false,
  },
  isSaveDraftSubmitionDisabled = false,
  isSendConversationSubmitionDisabled = false,
}: ConversationFormProps) => {
  const {
    register,
    control,
    formState: { errors },
    getValues,
    setError,
    clearErrors,
    setValue,
  } = useForm<ConversationFormSchemaType>({
    mode: "onBlur",
    defaultValues: {
      title: initialFormValues.title,
      customer_name: initialFormValues.customer_name,
      notes: initialFormValues.notes,
      hasRecording: initialFormValues.hasRecording,
    },
  });

  useEffect(() => {
    setValue("hasRecording", initialFormValues.hasRecording);
  }, [initialFormValues.hasRecording]);

  const handleSaveDraft = async () => {
    clearErrors();
    const data = getValues();
    try {
      await ConversationDraftSchema.validate(data, { abortEarly: false });
      onSaveDraft(data);
    } catch (err) {
      if (err instanceof yup.ValidationError) {
        err.inner.forEach((e) => {
          if (e.path) {
            setError(e.path as keyof ConversationFormSchemaType, {
              message: e.message,
            });
          }
        });
      }
    }
  };

  const handleSendConversation = async () => {
    clearErrors();
    const data = getValues();
    try {
      await ConversationSendSchema.validate(data, { abortEarly: false });
      onSendConversation(data);
    } catch (err) {
      if (err instanceof yup.ValidationError) {
        err.inner.forEach((e) => {
          if (e.path) {
            setError(e.path as keyof ConversationFormSchemaType, {
              message: e.message,
            });
          }
        });
      }
    }
  };

  const onDraftClick = (event: MouseEvent) => {
    event.preventDefault();
    handleSaveDraft();
  };

  const onSendClick = (event: MouseEvent) => {
    event.preventDefault();
    handleSendConversation();
  };

  return (
    <>
      <div className="tw-flex tw-flex-col lg:tw-flex-row tw-gap-8 tw-pt-5 md:tw-pt-0 tw-px-2 md:tw-px-0">
        <div className="tw-w-full lg:tw-w-1/2">
          <form className="tw-w-full lg:tw-w-[25rem] tw-flex tw-flex-col tw-items-center">
            {/* Conversation Title */}
            <div className="tw-w-full tw-mb-2">
              <label className="tw-block tw-text-sm tw-font-semibold tw-text-gray-900 tw-mb-2">
                {t("createConversation.conversationsTitle")}
                <span className="tw-text-red-500">*</span>
              </label>
              <input
                type="text"
                className={`tw-w-full tw-px-4 tw-py-2 tw-rounded-3xl tw-bg-white tw-border ${
                  errors.title ? "tw-border-red-500" : "tw-border-gray-400"
                } focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 tw-font-normal tw-text-black tw-placeholder-gray-500`}
                placeholder={t("createConversation.enterConversationsTitle")}
                {...register("title")}
              />
              {errors.title && (
                <p className="tw-text-red-500 tw-text-sm tw-mt-1">
                  {errors.title.message}
                </p>
              )}
            </div>

            {/* Customer Name Dropdown */}
            <Controller
              name="customer_name"
              control={control}
              render={({ field }) => (
                <CustomerDropdown
                  customers={customers}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            {errors.customer_name && (
              <p className="tw-text-red-500 tw-text-sm tw-mt-1 tw-w-full">
                {errors.customer_name.message}
              </p>
            )}

            {errors.hasRecording && (
              <p className="tw-text-red-500 tw-text-sm tw-mt-1 tw-w-full">
                {errors.hasRecording.message}
              </p>
            )}

            <div className="tw-w-full tw-block lg:tw-hidden tw-mb-4">
              <label className="tw-block tw-text-sm tw-font-medium tw-text-gray-700 form-label">
                {t("common.note")}
              </label>
              <textarea
                placeholder={t("createConversation.enterConversationsNote")}
                {...register("notes")}
                className={`tw-w-full tw-px-4 tw-py-2 tw-rounded-lg tw-bg-white tw-border ${
                  errors.notes ? "tw-border-red-500" : "tw-border-gray-400"
                } focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 tw-font-normal tw-text-black tw-placeholder-gray-500`}
                rows={4}
              ></textarea>
              {errors.notes && (
                <p className="tw-text-red-500 tw-text-sm tw-mt-1">
                  {errors.notes.message}
                </p>
              )}
            </div>
          </form>
        </div>

        <div className="tw-w-full lg:tw-w-1/2 tw-bg-white tw-p-6 !tw-pt-0 tw-flex-col tw-items-start tw-justify-start tw-hidden lg:tw-flex">
          <label className="tw-block tw-text-sm tw-font-medium tw-text-gray-700 form-label">
            {t("common.note")}
          </label>
          <textarea
            placeholder={t("createConversation.enterConversationsNote")}
            {...register("notes")}
            className={`tw-w-full tw-px-4 tw-py-2 !tw-rounded-[20px] tw-bg-white tw-border ${
              errors.notes ? "tw-border-red-500" : "tw-border-gray-400"
            } focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 tw-font-normal tw-text-black tw-placeholder-gray-500`}
            rows={4}
          ></textarea>
          {errors.notes && (
            <p className="tw-text-red-500 tw-text-sm tw-mt-1">
              {errors.notes.message}
            </p>
          )}
        </div>
      </div>

      <div
        className={`tw-w-full tw-mb-4 tw-mt-2 tw-flex tw-flex-col tw-gap-4 ${
          i18n.language === "en"
            ? "md:tw-gap-[90px]"
            : i18n.language === "nl"
            ? "md:tw-gap-[50px]"
            : ""
        } md:tw-flex-row tw-justify-center md:tw-justify-normal`}
      >
        <button
          type="button"
          className={`tw-px-6 tw-py-2 btn-bg-blue tw-text-white tw-rounded-full tw-h-10 tw-px-5 tw-font-medium tw-text-[0.875rem] hover:tw-bg-blue-700 tw-text-white tw-bg-button tw-rounded-3xl tw-flex tw-items-center tw-justify-center tw-gap-2 disabled:tw-opacity-50 disabled:tw-cursor-not-allowed`}
          onClick={onDraftClick}
          disabled={
            isSaveDraftSubmitionDisabled ||
            isSubmittingDraft ||
            isSendingConversation
          }
        >
          {isSubmittingDraft && (
            <svg
              className="tw-animate-spin tw-h-4 tw-w-4 tw-text-white"
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
              ></circle>
              <path
                className="tw-opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          )}
          {isEditingConversationForm
            ? t("createConversation.saveAsDraft")
            : t("createConversation.updateDraft")}
        </button>
        <button
          type="button"
          className={`tw-px-6 tw-py-2 tw-text-white tw-rounded-full tw-h-10 tw-px-5 tw-font-medium tw-text-[0.875rem] tw-bg-green-600 hover:tw-bg-green-700 tw-rounded-3xl tw-flex tw-items-center tw-justify-center tw-gap-2 disabled:tw-opacity-50 disabled:tw-cursor-not-allowed`}
          onClick={onSendClick}
          disabled={
            isSendConversationSubmitionDisabled ||
            isSubmittingDraft ||
            isSendingConversation
          }
        >
          {isSendingConversation && (
            <svg
              className="tw-animate-spin tw-h-4 tw-w-4 tw-text-white"
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
              ></circle>
              <path
                className="tw-opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          )}
          {t("createConversation.saveConversation")}
        </button>
      </div>
    </>
  );
};

export default ConversationForm;
