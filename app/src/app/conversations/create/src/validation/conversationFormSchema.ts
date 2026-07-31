import * as yup from "yup";

const baseSchema = {
  title: yup
    .string()
    .trim()
    .required("Title is required")
    .min(1, "Title cannot be empty"),
  customer_name: yup
    .string()
    .trim()
    .required("Customer name is required")
    .min(1, "Customer name cannot be empty"),
  notes: yup.string().trim().optional(),
};

export const ConversationDraftSchema = yup.object({
  ...baseSchema,
});

export const ConversationSendSchema = yup.object({
  ...baseSchema,
  hasRecording: yup
    .boolean()
    .required()
    .oneOf([true], "Er is geen opname beschikbaar"),
});

export type ConversationFormSchemaType = {
  title: string;
  customer_name: string;
  notes?: string;
  hasRecording?: boolean;
};
