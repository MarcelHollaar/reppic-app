import { initializeI18n } from "../helpers/userHelper";
import { AuthService } from "../services/authServices";
import {
  getPhoneSchema,
  getEmailSchema,
  getPasswordSchema,
  getOtpSchema,
  getTokenSchema,
  getNameSchema,
} from "../validation/user";

export async function login(
  userData: {
    email: string;
    password: string;
    remember_me: boolean;
    trusted_device_token?: string;
  },
  langCode?: string,
) {
  try {
    const i18n = await initializeI18n();
    if (langCode) {
      await i18n.changeLanguage(langCode);
    }
    const t = i18n.t;
    // Validation
    userData.email = userData.email.toLowerCase();
    const emailSchema = getEmailSchema(t);
    emailSchema.parse(userData.email);
    const passwordSchema = getPasswordSchema(t);
    passwordSchema.parse(userData.password);

    return await AuthService.login(userData, langCode);
  } catch (error) {
    console.error("Login Error:", error);
    return new Response(
      JSON.stringify({ message: "Error during login", error }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

export async function register(
  userData: {
    name: string;
    email: string;
    password: string;
    phone_number: string;
  },
  langCode?: string,
) {
  try {
    // Validation
    const i18n = await initializeI18n();
    if (langCode) {
      await i18n.changeLanguage(langCode);
    } else {
      await i18n.changeLanguage("en");
    }
    const t = i18n.t;
    // Validation
    userData.email = userData.email.toLowerCase();
    const emailSchema = getEmailSchema(t);
    emailSchema.parse(userData.email);
    const passwordSchema = getPasswordSchema(t);
    const phoneSchema = getPhoneSchema(t);
    const nameSchema = getNameSchema(t);
    passwordSchema.parse(userData.password);
    phoneSchema.parse(userData.phone_number);
    nameSchema.parse(userData.name);

    return await AuthService.register(userData);
  } catch (error) {
    console.error("Register Error:", error);
    return new Response(
      JSON.stringify({ message: "Error during registration", error }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

export async function verifyEmail(
  userData: { email: string; otp: string },
  langCode?: string,
) {
  try {
    // Validation
    const i18n = await initializeI18n();
    if (langCode) {
      await i18n.changeLanguage(langCode);
    }
    const t = i18n.t;
    // Validation
    userData.email = userData.email.toLowerCase();
    const emailSchema = getEmailSchema(t);
    emailSchema.parse(userData.email);
    const otpSchema = getOtpSchema(t);
    otpSchema.parse(userData.otp);

    return await AuthService.verifyEmail(userData, langCode);
  } catch (error) {
    return new Response(
      JSON.stringify({ message: "Error verifying email", error }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

export async function forgotPassword(
  userData: { email: string },
  langCode?: string,
) {
  try {
    // Validation
    const i18n = await initializeI18n();
    if (langCode) {
      await i18n.changeLanguage(langCode);
    }
    const t = i18n.t;
    // Validation
    userData.email = userData.email.toLowerCase();
    const emailSchema = getEmailSchema(t);
    emailSchema.parse(userData.email);
    return await AuthService.forgotPassword(userData, langCode);
  } catch (error) {
    console.error("Forgot Password Error:", error);
    return new Response(
      JSON.stringify({ message: "Error during password reset", error }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

export async function verifyOtp(
  userData: { email: string; otp: string },
  langCode?: string,
) {
  try {
    // Validation
    const i18n = await initializeI18n();
    if (langCode) {
      await i18n.changeLanguage(langCode);
    }
    const t = i18n.t;
    // Validation
    userData.email = userData.email.toLowerCase();
    const emailSchema = getEmailSchema(t);
    const otpSchema = getOtpSchema(t);
    emailSchema.parse(userData.email);
    otpSchema.parse(userData.otp);
    return await AuthService.verifyOtp(userData, langCode);
  } catch (error) {
    return new Response(
      JSON.stringify({ message: "Error verifying OTP", error }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

export async function resetPassword(
  userData: { email: string; token: string; newPassword: string },
  langCode?: string,
) {
  // Validation
  const i18n = await initializeI18n();
  if (langCode) {
    await i18n.changeLanguage(langCode);
  }
  const t = i18n.t;
  try {
    // Validation
    userData.email = userData.email.toLowerCase();
    const emailSchema = getEmailSchema(t);
    const tokenSchema = getTokenSchema(t);
    const passwordSchema = getPasswordSchema(t);
    emailSchema.parse(userData.email);
    tokenSchema.parse(userData.token);
    passwordSchema.parse(userData.newPassword);

    return await AuthService.resetPassword(userData, langCode);
  } catch (error) {
    return new Response(
      JSON.stringify({
        message: t("errorMessages.errorResettingPassword"),
        error,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

export async function createPassword(
  userData: { email: string; token: string; newPassword: string },
  langCode?: string,
) {
  // Validation
  const i18n = await initializeI18n();
  if (langCode) {
    await i18n.changeLanguage(langCode);
  }
  const t = i18n.t;
  try {
    // Validation
    userData.email = userData.email.toLowerCase();
    const emailSchema = getEmailSchema(t);
    const tokenSchema = getTokenSchema(t);
    const passwordSchema = getPasswordSchema(t);
    emailSchema.parse(userData.email);
    tokenSchema.parse(userData.token);
    passwordSchema.parse(userData.newPassword);

    return await AuthService.createPassword(userData, langCode);
  } catch (error) {
    return new Response(
      JSON.stringify({
        message: t("errorMessages.errorResettingPassword"),
        error,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

export async function resendPasswordOtp(
  userData: { email: string },
  langCode?: string,
) {
  // Validation
  const i18n = await initializeI18n();
  if (langCode) {
    await i18n.changeLanguage(langCode);
  }
  const t = i18n.t;
  try {
    // Validation
    userData.email = userData.email.toLowerCase();

    const emailSchema = getEmailSchema(t);
    emailSchema.parse(userData.email);

    return await AuthService.resendPasswordVerificationCode(userData, langCode);
  } catch (error) {
    return new Response(
      JSON.stringify({
        message: t("errorMessages.errorResettingPassword"),
        error,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

export async function verifyLoginOtp(
  userData: {
    email: string;
    otp: string;
    pendingToken: string;
    trust_device?: boolean;
  },
  langCode?: string,
) {
  try {
    const i18n = await initializeI18n();

    if (langCode) {
      await i18n.changeLanguage(langCode);
    }

    const t = i18n.t;

    userData.email = userData.email.toLowerCase();

    const emailSchema = getEmailSchema(t);
    const otpSchema = getOtpSchema(t);
    const tokenSchema = getTokenSchema(t);

    emailSchema.parse(userData.email);
    otpSchema.parse(userData.otp);
    tokenSchema.parse(userData.pendingToken);

    return await AuthService.verifyLoginOtp(userData, langCode);
  } catch (error) {
    return new Response(
      JSON.stringify({ message: "Error verifying login OTP", error }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

export async function resendLoginOtp(
  userData: { email: string; pendingToken: string },
  langCode?: string,
) {
  try {
    const i18n = await initializeI18n();

    if (langCode) {
      await i18n.changeLanguage(langCode);
    }

    const t = i18n.t;

    userData.email = userData.email.toLowerCase();

    const emailSchema = getEmailSchema(t);
    const tokenSchema = getTokenSchema(t);

    emailSchema.parse(userData.email);
    tokenSchema.parse(userData.pendingToken);

    return await AuthService.resendLoginOtp(userData, langCode);
  } catch (error) {
    return new Response(
      JSON.stringify({ message: "Error resending login OTP", error }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

export async function resendEmailVerificationOtp(
  userData: { email: string },
  langCode?: string,
) {
  // Validation
  const i18n = await initializeI18n();
  if (langCode) {
    await i18n.changeLanguage(langCode);
  }
  const t = i18n.t;
  try {
    // Validation
    userData.email = userData.email.toLowerCase();

    const emailSchema = getEmailSchema(t);
    emailSchema.parse(userData.email);

    return await AuthService.resendEmailVerificationCode(userData, langCode);
  } catch (error) {
    return new Response(
      JSON.stringify({
        message: t("errorMessages.errorResettingPassword"),
        error,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
