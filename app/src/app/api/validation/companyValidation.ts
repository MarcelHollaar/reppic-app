import { z } from "zod";

export const emailSchema = z
  .string()
  .email({ message: "Invalid email format." });

export const titleSchema = z
  .string()
  .min(1, { message: "Title cannot be empty." })
  .max(100, { message: "Title cannot exceed 100 characters." });

export const phoneSchema = z
  .string()
  .min(10, { message: "Phone number must be at least 10 digits long." })
  .max(15, { message: "Phone number cannot exceed 15 digits." })
  .regex(/^\+?[1-9]\d{9,14}$/, { message: "Invalid phone number format." });

export function getEmailSchema(t: (key: string) => string) {
  return z.string().email({ message: t("errorMessages.invalidEmailFormat") });
}

export function getTitleSchema(t: (key: string) => string) {
  return z
    .string()
    .min(1, { message: t("errorMessages.companyTitleAtLeast2Chars") })
    .max(100, { message: t("errorMessages.companyTitleTooLong") });
}

export function getPhoneSchema(t: (key: string) => string) {
  return z
    .string()
    .min(10, { message: t("errorMessages.phoneNumberMinLength") })
    .max(15, { message: t("errorMessages.phoneNumberMaxLength") })
    .regex(/^\+?[1-9]\d{9,14}$/, { message: t("errorMessages.invalidPhoneNumberFormat") });
}

export function getCompanyValidationSchema(t: (key: string) => string) {
  return z.object({
    email: getEmailSchema(t),
    title: getTitleSchema(t),
    phone: getPhoneSchema(t),
    // Add other fields as needed
  });
}
