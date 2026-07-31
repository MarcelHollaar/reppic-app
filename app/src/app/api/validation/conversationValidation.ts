import { z } from "zod";

export function getConversationSchema(t: (key: string) => string) {
  return z
    .object({
      title: z.string()
        .optional()
        .refine(val => !val || val.length >= 3, { message: t("errorMessages.conversationAtLeastThree") }),
      customer_name: z.string()
        .optional()
        .refine(val => !val || val.length >= 3, { message: t("errorMessages.customerNameMinLength") }),
      customer_id: z.string().uuid({ message: t("errorMessages.invalidCustomerIdFormat") }).optional(),
      meeting_date: z.string()
        .optional()
        .refine(val => !val || /^\d{4}-\d{2}-\d{2}$/.test(val), { message: t("errorMessages.invalidDateFormat") })
        .transform(val => val ? new Date(val) : undefined),
      meeting_time_start: z.string()
        .optional()
        .refine(val => !val || /^\d{2}:\d{2}$/.test(val), { message: t("errorMessages.invalidTimeFormat") }),
      meeting_time_end: z.string()
        .optional()
        .refine(val => !val || /^\d{2}:\d{2}$/.test(val), { message: t("errorMessages.invalidTimeFormat") }),
      notes: z.string()
        .optional()
        .refine(val => !val || val.length >= 3, { message: t("errorMessages.noteAtLeastThree") }),
      file_duration: z.union([z.string(), z.number()])
        .optional()
        .transform(val => val === undefined ? undefined : parseFloat(val as string))
        .refine(val => val === undefined || (!isNaN(val) && val >= 0), { message: t("errorMessages.invalidFileDuration") }),
      file: z.any()
        .optional()
        .refine(
          (file) =>
            !file ||
            (file.type && ["audio/mpeg", "audio/wav", "audio/webm", "audio/mp4", "audio/wave", "audio/mp3", "video/mp4", "video/quicktime"].includes(file.type)),
          { message: t("errorMessages.invalidFileType") }
        ),
      draft: z.string().optional(),
      deviceId: z.string().optional(),
      deviceType: z.string().optional(),
      conversationId: z.string().uuid({ message: t("errorMessages.invalidConversationIdFormat") }).optional(),
    })
    .refine(
      (data) => !data.customer_id && !data.customer_name ? true : true,
      { message: t("errorMessages.customerIdOrNameRequired") }
    )
    .refine(
      (data) => {
        if (!data.meeting_time_start || !data.meeting_time_end) return true;
        const [startHour, startMinute] = data.meeting_time_start.split(":").map(Number);
        const [endHour, endMinute] = data.meeting_time_end.split(":").map(Number);
        return endHour > startHour || (endHour === startHour && endMinute > startMinute);
      },
      { message: t("errorMessages.meetingEndTimeAfterStart"), path: ["meeting_time_end"] }
    );
}