import { z } from "zod";
import { PASSWORD_SPECIAL_CHAR_REGEX } from "@/utils/passwordRules";

export function getEmailSchema(t: (key: string) => string) {
  return z.string().email({ message: t("errorMessages.invalidEmailFormat") });
}

export function getPasswordSchema(t: (key: string) => string) {
  return z
    .string()
    .min(8, { message: t("errorMessages.passwordMustBeLength") })
    .regex(/[A-Z]/, { message: t("errorMessages.passwordUppercase") })
    .regex(/[a-z]/, { message: t("errorMessages.passwordLowercase") })
    .regex(/[0-9]/, { message: t("errorMessages.passwordNumber") })
    .regex(PASSWORD_SPECIAL_CHAR_REGEX, { message: t("errorMessages.passwordSpecialChar") });
}

export function getOtpSchema(t: (key: string) => string) {
  return z.string().length(6, { message: t("errorMessages.otpLength") });
}

export function getNameSchema(t: (key: string) => string) {
  return z
    .string()
    .min(1, { message: t("errorMessages.nameRequired") })
    .max(100, { message: t("errorMessages.nameTooLong") });
}

export function getPhoneSchema(t: (key: string) => string) {
  return z
    .string()
    .min(10, { message: t("errorMessages.phoneNumberMinLength") })
    .max(15, { message: t("errorMessages.phoneNumberMaxLength") })
    .regex(/^\+?[1-9]\d{9,14}$/, { message: t("errorMessages.invalidPhoneNumberFormat") });
}

export function getTokenSchema(t: (key: string) => string) {
  return z.string().min(1, { message: t("errorMessages.tokenRequired") });
}

export function getFileSchema(t: (key: string) => string) {
  return z
    .any()
    .optional()
    .refine(
      (file) =>
        !file || ["image/png", "image/jpeg", "image/gif", "image/webp"].includes(file.type),
      { message: t("errorMessages.invalidFileFormat") }
    );
}

export function getOrganizationSchema(t: (key: string) => string) {
  return z
    .string()
    .min(1, { message: t("errorMessages.organizationRequired") })
    .max(100, { message: t("errorMessages.organizationTooLong") });
}
