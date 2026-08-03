import { prisma } from "../utils/prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { mailService } from "./mailService";
import omit from "lodash/omit";
import { getFullUrl } from "../utils/urlHelper";
import {
  LOGIN_OTP_TTL_MS,
  TRUSTED_DEVICE_TTL_MS,
  USER_ROLE,
} from "@/configs/constants";
import { initializeI18n } from "../helpers/userHelper";
import { UserModel } from "../models/user";
const JWT_SECRET = process.env.JWT_SECRET;

type UserWithRole = Awaited<ReturnType<typeof prisma.user.findUnique>> & {
  role: { name: string };
  company: { email: string; max_users: number } | null;
};

function hashTrustedDeviceToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function loginOtpErrorResponse(
  message: string,
  errorCode: string,
  status: number,
) {
  return new Response(JSON.stringify({ message, errorCode }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function buildLoginSuccessResponse(
  existingUser: UserWithRole,
  remember_me: boolean,
  i18n: Awaited<ReturnType<typeof initializeI18n>>,
) {
  const tokenExpirationTime = remember_me ? "30d" : "6h";
  const accessToken = jwt.sign(
    {
      email: existingUser.email,
      id: existingUser.id,
      role: existingUser.role.name,
      // Required by the dashboard-backend to scope analytics per company.
      // Without it, non-superadmin users fall back to NO_COMPANY (empty dashboards).
      company_id: existingUser.company_id,
    },
    JWT_SECRET,
    { expiresIn: tokenExpirationTime },
  );

  const userWithoutPassword = omit(existingUser, ["password"]);

  if (userWithoutPassword.avatar) {
    userWithoutPassword.avatar = getFullUrl(userWithoutPassword.avatar);
  }

  const isCompanyContactManager =
    existingUser.role.name === USER_ROLE.MANAGER &&
    existingUser.email === existingUser.company?.email;

  return new Response(
    JSON.stringify({
      message: i18n.t("successMessages.loginSuccessful"),
      data: {
        user: {
          ...userWithoutPassword,
          is_company_contact_manager: isCompanyContactManager,
        },
        accessToken,
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

async function createAndSendLoginOtp(
  userId: string,
  email: string,
  langCode: string | undefined,
  userLang: string | undefined,
) {
  const otp = crypto.randomInt(100000, 1000000).toString();

  // Atomic upsert keyed by the unique user_id: exactly one live code per user.
  // This replaces the previous read-then-write (findFirst + update/create),
  // which under a race or double login-submit could leave two rows — the
  // earliest-emailed code then silently died ("first code rejected, second
  // works"). Every new code deliberately supersedes the previous one.
  await prisma.loginOtp.upsert({
    where: { user_id: userId },
    update: {
      otp,
      expires_at: new Date(Date.now() + LOGIN_OTP_TTL_MS),
    },
    create: {
      user_id: userId,
      otp,
      expires_at: new Date(Date.now() + LOGIN_OTP_TTL_MS),
    },
  });

  // In local development without SMTP configured, the OTP email can't be sent.
  // Log the code instead of throwing so the 2FA flow still works for testing.
  // Production always has SMTP_HOST set, so this branch never runs there.
  if (process.env.SMTP_HOST) {
    await mailService.sendLoginOtpEmail(email, otp, langCode || userLang || "en");
  } else if (process.env.NODE_ENV !== "production") {
    // Never print OTPs in production, even if SMTP is (mis)configured to empty.
    console.warn(`[dev] SMTP not configured — login OTP for ${email}: ${otp}`);
  }
}

export const AuthService = {
  async login(
    userData: {
      email: string;
      password: string;
      remember_me: boolean;
      trusted_device_token?: string;
    },
    langCode?: string,
  ) {
    const i18n = await initializeI18n();
    if (langCode) {
      await i18n.changeLanguage(langCode || "en");
    }
    try {
      const { email, password, remember_me } = userData;

      const existingUser = await prisma.user.findUnique({
        where: { email },
        include: {
          role: true,
          company: { select: { email: true, max_users: true, lms_enabled: true, has_knowledge_access: true } },
        },
      });

      if (!existingUser) {
        return new Response(
          JSON.stringify({ message: i18n.t("errorMessages.userNotExist") }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
      if (langCode) {
        await UserModel.updateUserLangPreference(existingUser.id, langCode);
      } else {
        await i18n.changeLanguage(existingUser?.lang_code || "en");
      }

      if (!existingUser.is_verified) {
        return new Response(
          JSON.stringify({
            message: i18n.t("errorMessages.accountNotVerified"),
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // Defensive: Ensure password is a string before comparing
      if (typeof existingUser.password !== "string") {
        return new Response(
          JSON.stringify({ message: i18n.t("errorMessages.emailIncorrect") }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const isValidPassword = await bcrypt.compare(
        password,
        existingUser.password,
      );
      if (!isValidPassword) {
        return new Response(
          JSON.stringify({ message: i18n.t("errorMessages.emailIncorrect") }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      if (userData.trusted_device_token) {
        const tokenHash = hashTrustedDeviceToken(userData.trusted_device_token);
        const trustedDevice = await prisma.trustedDevice.findFirst({
          where: {
            user_id: existingUser.id,
            token_hash: tokenHash,
            expires_at: { gt: new Date() },
          },
        });

        if (trustedDevice) {
          await prisma.trustedDevice.update({
            where: { id: trustedDevice.id },
            data: {
              expires_at: new Date(Date.now() + TRUSTED_DEVICE_TTL_MS),
            },
          });
          return buildLoginSuccessResponse(existingUser, remember_me, i18n);
        }
      }

      await createAndSendLoginOtp(
        existingUser.id,
        existingUser.email,
        langCode,
        existingUser.lang_code ?? undefined,
      );

      const pendingToken = jwt.sign(
        {
          email: existingUser.email,
          userId: existingUser.id,
          purpose: "login_2fa",
          remember_me,
        },
        JWT_SECRET,
        { expiresIn: "10m" },
      );

      return new Response(
        JSON.stringify({
          message: i18n.t("successMessages.loginOtpSent"),
          data: {
            requiresOtp: true,
            pendingToken,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    } catch (error: any) {
      console.log("error during login:");
      // Fix: Always throw a string as error message, never an object
      let message = i18n.t("errorMessages.unableToLogin");
      if (typeof error === "string") {
        message = error;
      } else if (error && typeof error.message === "string") {
        message = error.message;
      }
      throw new Error(message);
    }
  },

  async verifyLoginOtp(
    userData: {
      email: string;
      otp: string;
      pendingToken: string;
      trust_device?: boolean;
    },
    langCode?: string,
  ) {
    const i18n = await initializeI18n();
    const t = i18n.t;

    if (langCode) {
      await i18n.changeLanguage(langCode || "en");
    }

    try {
      const { email, otp, pendingToken, trust_device } = userData;

      let decodedToken: {
        email: string;
        userId: string;
        purpose: string;
        remember_me?: boolean;
      };

      try {
        decodedToken = jwt.verify(pendingToken, JWT_SECRET, { algorithms: ["HS256"] }) as typeof decodedToken;
      } catch {
        return loginOtpErrorResponse(
          t("errorMessages.loginSessionExpired"),
          "LOGIN_SESSION_EXPIRED",
          400,
        );
      }

      if (
        decodedToken.purpose !== "login_2fa" ||
        decodedToken.email !== email
      ) {
        return loginOtpErrorResponse(
          t("errorMessages.loginSessionExpired"),
          "LOGIN_SESSION_EXPIRED",
          400,
        );
      }

      const existingUser = await prisma.user.findUnique({
        where: { email },
        include: {
          role: true,
          company: { select: { email: true, max_users: true, lms_enabled: true, has_knowledge_access: true } },
        },
      });

      if (!existingUser || existingUser.id !== decodedToken.userId) {
        return new Response(
          JSON.stringify({ message: t("errorMessages.userNotFound") }),
          { status: 404, headers: { "Content-Type": "application/json" } },
        );
      }

      if (langCode) {
        await UserModel.updateUserLangPreference(existingUser.id, langCode);
      } else {
        await i18n.changeLanguage(existingUser?.lang_code || "en");
      }

      // App-store reviewer-uitzondering (STRIKT afgebakend).
      // Google/Apple-reviewers kunnen niet bij de OTP-mail. Voor uitsluitend het
      // adres in REVIEW_ACCOUNT_EMAIL wordt de vaste code "000000" geaccepteerd,
      // NÁÁST de normaal gemailde code (elke andere code loopt gewoon door de
      // DB-check hieronder). Staat REVIEW_ACCOUNT_EMAIL niet gezet, dan is deze
      // uitzondering volledig uit. Zie LEES-DIT-EERST-developer.md.
      // Let op: "000000" is publiek raadbaar — dit account hoort een sterk
      // wachtwoord te hebben, géén superadmin te zijn en geen echte klantdata te
      // kunnen zien.
      const reviewEmail = process.env.REVIEW_ACCOUNT_EMAIL?.trim().toLowerCase();
      const isReviewFixedCode =
        !!reviewEmail &&
        email.trim().toLowerCase() === reviewEmail &&
        otp === "000000";

      if (!isReviewFixedCode) {
        const loginOtp = await prisma.loginOtp.findFirst({
          where: { user_id: existingUser.id, otp },
        });

        if (!loginOtp) {
          return loginOtpErrorResponse(
            t("errorMessages.loginOtpInvalid"),
            "LOGIN_OTP_INVALID",
            400,
          );
        }

        if (loginOtp.expires_at < new Date()) {
          return loginOtpErrorResponse(
            t("errorMessages.loginOtpExpired"),
            "LOGIN_OTP_EXPIRED",
            400,
          );
        }

        await prisma.loginOtp.delete({ where: { id: loginOtp.id } });
      }

      let trustedDeviceToken: string | undefined;

      if (trust_device) {
        trustedDeviceToken = crypto.randomUUID();
        const tokenHash = hashTrustedDeviceToken(trustedDeviceToken);

        await prisma.trustedDevice.create({
          data: {
            user_id: existingUser.id,
            token_hash: tokenHash,
            expires_at: new Date(Date.now() + TRUSTED_DEVICE_TTL_MS),
          },
        });
      }

      const successResponse = await buildLoginSuccessResponse(
        existingUser,
        decodedToken.remember_me ?? false,
        i18n,
      );
      const successBody = await successResponse.json();

      return new Response(
        JSON.stringify({
          ...successBody,
          data: {
            ...successBody.data,
            ...(trustedDeviceToken ? { trustedDeviceToken } : {}),
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    } catch (error: any) {
      return new Response(
        JSON.stringify({
          message: t("errorMessages.errorVerifyingOtp"),
          error: error?.message,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
  },

  async resendLoginOtp(
    userData: { email: string; pendingToken: string },
    langCode?: string,
  ) {
    const i18n = await initializeI18n();
    const t = i18n.t;

    if (langCode) {
      await i18n.changeLanguage(langCode || "en");
    }

    try {
      const { email, pendingToken } = userData;

      let decodedToken: {
        email: string;
        userId: string;
        purpose: string;
      };

      try {
        decodedToken = jwt.verify(pendingToken, JWT_SECRET, { algorithms: ["HS256"] }) as typeof decodedToken;
      } catch {
        return loginOtpErrorResponse(
          t("errorMessages.loginSessionExpired"),
          "LOGIN_SESSION_EXPIRED",
          400,
        );
      }

      if (
        decodedToken.purpose !== "login_2fa" ||
        decodedToken.email !== email
      ) {
        return loginOtpErrorResponse(
          t("errorMessages.loginSessionExpired"),
          "LOGIN_SESSION_EXPIRED",
          400,
        );
      }

      const user = await prisma.user.findUnique({ where: { email } });

      if (!user || user.id !== decodedToken.userId) {
        return new Response(
          JSON.stringify({ message: t("errorMessages.userNotFound") }),
          { status: 404, headers: { "Content-Type": "application/json" } },
        );
      }

      await createAndSendLoginOtp(
        user.id,
        user.email,
        langCode,
        user.lang_code ?? undefined,
      );

      return new Response(
        JSON.stringify({ message: t("successMessages.loginOtpResent") }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    } catch (error: any) {
      throw new Error(error?.message || t("errorMessages.errorVerifyingOtp"));
    }
  },

  async register(userData: {
    name: string;
    email: string;
    password: string;
    phone_number: string;
  }) {
    const i18n = await initializeI18n();
    const t = i18n.t;
    try {
      const { name, email, password, phone_number } = userData;

      const existingUser = await prisma.user.findUnique({ where: { email } });
      await i18n.changeLanguage(existingUser?.lang_code || "en");
      if (existingUser) {
        return new Response(
          JSON.stringify({
            message: t("errorMessages.emailAlreadyRegistered"),
          }),
          {
            status: 409,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const defaultRole = await prisma.role.findFirst({
        where: { name: "user" },
      });
      if (!defaultRole) {
        return new Response(
          JSON.stringify({ message: t("errorMessages.defaultRoleNotFound") }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          phone_number,
          role_id: defaultRole.id,
          status: "active",
          is_verified: false,
        },
      });

      const otp = crypto.randomInt(100000, 1000000).toString();

      // Store OTP in email_verifications table
      await prisma.emailVerification.create({
        data: {
          user_id: newUser.id,
          otp,
          expires_at: new Date(Date.now() + 10 * 60 * 1000), // Expires in 10 minutes
        },
      });

      // Send OTP via email
      await mailService.sendVerificationEmail(
        email,
        otp,
        newUser?.lang_code || "en",
      );

      return new Response(
        JSON.stringify({
          message: t("successMessages.registerSuccessful"),
          data: newUser,
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      );
    } catch (error: any) {
      throw new Error(
        error?.message || "Unable to register user, please try later.",
      );
    }
  },

  async verifyEmail(
    userData: { email: string; otp: string },
    langCode?: string,
  ) {
    const i18n = await initializeI18n();
    const t = i18n.t;
    if (langCode) {
      await i18n.changeLanguage(langCode || "en");
    }
    try {
      const { email, otp } = userData;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return new Response(
          JSON.stringify({ message: t("errorMessages.userNotFound") }),
          { status: 404 },
        );
      }
      if (langCode) {
        await UserModel.updateUserLangPreference(user.id, langCode);
      } else {
        await i18n.changeLanguage(user?.lang_code || "en");
      }
      const verification = await prisma.emailVerification.findFirst({
        where: { user_id: user.id, otp },
      });

      if (!verification) {
        return new Response(
          JSON.stringify({ message: t("errorMessages.invalidOtp") }),
          { status: 400 },
        );
      }

      if (verification.expires_at < new Date()) {
        return new Response(
          JSON.stringify({ message: t("errorMessages.otpExpired") }),
          { status: 400 },
        );
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { is_verified: true },
      });

      await prisma.emailVerification.delete({ where: { id: verification.id } });

      return new Response(
        JSON.stringify({ message: t("successMessages.emailVerified") }),
        { status: 200 },
      );
    } catch (error: any) {
      return new Response(
        JSON.stringify({
          message: t("errorMessages.errorVerifyingEmail"),
          error,
        }),
        { status: 500 },
      );
    }
  },

  async forgotPassword(userData: { email: string }, langCode?: string) {
    const i18n = await initializeI18n();
    const t = i18n.t;
    if (langCode) {
      await i18n.changeLanguage(langCode || "en");
    }
    try {
      const { email } = userData;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return new Response(
          JSON.stringify({ message: t("errorMessages.userNotFound") }),
          { status: 404 },
        );
      }

      const otp = crypto.randomInt(100000, 1000000).toString();

      // Store OTP in password_resets table
      await prisma.passwordReset.create({
        data: {
          user_id: user.id,
          otp,
          expires_at: new Date(Date.now() + 10 * 60 * 1000),
        },
      });

      // Send OTP via email
      await mailService.sendResetPasswordEmail(
        email,
        otp,
        langCode || user?.lang_code || "en",
      );
      if (langCode) {
        await UserModel.updateUserLangPreference(user.id, langCode);
      } else {
        await i18n.changeLanguage(user?.lang_code || "en");
      }
      return new Response(
        JSON.stringify({ message: t("successMessages.otpSent") }),
        { status: 200 },
      );
    } catch (error: any) {
      console.log("error during forgot password:", error);
      throw new Error(t("errorMessages.unableToProcessForgotPassword"));
    }
  },

  async verifyOtp(userData: { email: string; otp: string }, langCode?: string) {
    const i18n = await initializeI18n();
    const t = i18n.t;
    if (langCode) {
      await i18n.changeLanguage(langCode || "en");
    }
    try {
      const { email, otp } = userData;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return new Response(
          JSON.stringify({ message: t("errorMessages.userNotFound") }),
          { status: 404 },
        );
      }
      if (langCode) {
        await UserModel.updateUserLangPreference(user.id, langCode);
      } else {
        await i18n.changeLanguage(user?.lang_code || "en");
      }
      const resetRequest = await prisma.passwordReset.findFirst({
        where: { user_id: user.id, otp },
      });

      if (!resetRequest) {
        return new Response(
          JSON.stringify({ message: t("errorMessages.invalidOtp") }),
          { status: 400 },
        );
      }

      if (resetRequest.expires_at < new Date()) {
        return new Response(
          JSON.stringify({ message: t("errorMessages.otpExpired") }),
          { status: 400 },
        );
      }

      const tempToken = jwt.sign({ email, userId: user.id }, JWT_SECRET, {
        expiresIn: "10m",
      });

      return new Response(
        JSON.stringify({
          message: t("successMessages.otpVerified"),
          token: tempToken,
        }),
        { status: 200 },
      );
    } catch (error: any) {
      return new Response(
        JSON.stringify({
          message: t("errorMessages.errorVerifyingOtp"),
          error,
        }),
        { status: 500 },
      );
    }
  },

  async resetPassword(
    userData: { email: string; token: string; newPassword: string },
    langCode?: string,
  ) {
    const i18n = await initializeI18n();
    const t = i18n.t;
    if (langCode) {
      await i18n.changeLanguage(langCode || "en");
    }
    try {
      const { email, token, newPassword } = userData;

      let decodedToken;
      try {
        decodedToken = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] }) as {
          email: string;
          userId: string;
        };
      } catch (error) {
        return new Response(
          JSON.stringify({ message: t("errorMessages.invalidOrExpiredToken") }),
          { status: 400 },
        );
      }

      if (decodedToken.email !== email) {
        return new Response(
          JSON.stringify({ message: t("errorMessages.tokenDoesNotMatch") }),
          { status: 400 },
        );
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id: decodedToken.userId },
        data: { password: hashedPassword },
      });

      await prisma.passwordReset.deleteMany({
        where: { user_id: decodedToken.userId },
      });

      return new Response(
        JSON.stringify({
          message: t("successMessages.passwordResetSuccessful"),
        }),
        { status: 200 },
      );
    } catch (error: any) {
      return new Response(
        JSON.stringify({
          message: t("errorMessages.errorResettingPassword"),
          error,
        }),
        { status: 500 },
      );
    }
  },

  async createPassword(
    userData: { email: string; token: string; newPassword: string },
    langCode?: string,
  ) {
    const i18n = await initializeI18n();
    const t = i18n.t;
    if (langCode) {
      await i18n.changeLanguage(langCode || "en");
    }
    try {
      const { email, token, newPassword } = userData;

      // Find user by email and token
      const user = await prisma.user.findFirst({
        where: { email, password_token: token },
        include: {
          manager: {
            include: {
              user_settings: true,
            },
          },
        },
      });

      if (!user?.password_token) {
        return new Response(
          JSON.stringify({ message: t("errorMessages.invitationUsed") }),
          { status: 400 },
        );
      }

      if (!user) {
        return new Response(
          JSON.stringify({ message: t("errorMessages.invalidOrExpiredToken") }),
          { status: 400 },
        );
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update user's password and remove the password_token
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          password_token: null,
        },
        include: {
          company: true,
        },
      });

      // Send email to manager
      if (user.manager) {
        const manager = user.manager;
        const notificationSettings =
          manager.user_settings[0]?.notification_setting;
        const canSendReminders = notificationSettings?.reminders?.email ?? true;
        if (canSendReminders) {
          await mailService.sendOnboardingNotification(
            user.manager.email,
            user.manager.name,
            user.name,
            manager?.lang_code || user?.lang_code || "en",
          );
        }
      }
      if (langCode) {
        await UserModel.updateUserLangPreference(user.id, langCode);
      } else {
        await i18n.changeLanguage(user?.lang_code || "en");
      }
      return new Response(
        JSON.stringify({
          message: t("successMessages.passwordResetSuccessful"),
        }),
        { status: 200 },
      );
    } catch (error: any) {
      return new Response(
        JSON.stringify({
          message: t("errorMessages.errorResettingPassword"),
          error: error.message,
        }),
        {
          status: 500,
        },
      );
    }
  },

  async resendPasswordVerificationCode(
    userData: { email: string },
    langCode?: string,
  ) {
    const i18n = await initializeI18n();
    const t = i18n.t;
    if (langCode) {
      await i18n.changeLanguage(langCode || "en");
    }
    try {
      const { email } = userData;

      // Find the user by email
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return new Response(
          JSON.stringify({ message: t("errorMessages.userNotFound") }),
          { status: 404 },
        );
      }

      const otp = crypto.randomInt(100000, 1000000).toString();

      // Check if a password reset entry exists for this user
      const passwordResetEntry = await prisma.passwordReset.findFirst({
        where: { user_id: user.id }, // Ensure `user_id` is unique in your Prisma schema
      });

      if (passwordResetEntry) {
        // If an entry exists, update it
        await prisma.passwordReset.update({
          where: { id: passwordResetEntry.id }, // Use the unique `id` of passwordReset
          data: {
            otp,
            expires_at: new Date(Date.now() + 10 * 60 * 1000),
          },
        });
      } else {
        // If no entry exists, create a new one
        await prisma.passwordReset.create({
          data: {
            user_id: user.id,
            otp,
            expires_at: new Date(Date.now() + 10 * 60 * 1000),
          },
        });
      }

      // Send OTP via email
      await mailService.sendResetPasswordEmail(
        email,
        otp,
        langCode || user?.lang_code || "en",
      );
      if (langCode) {
        await UserModel.updateUserLangPreference(user.id, langCode);
      } else {
        await i18n.changeLanguage(user?.lang_code || "en");
      }
      return new Response(
        JSON.stringify({ message: t("successMessages.otpSent") }),
        { status: 200 },
      );
    } catch (error: any) {
      throw new Error(
        error?.message || t("errorMessages.unableToProcessForgotPassword"),
      );
    }
  },

  async resendEmailVerificationCode(
    userData: { email: string },
    langCode?: string,
  ) {
    const i18n = await initializeI18n();
    const t = i18n.t;
    if (langCode) {
      await i18n.changeLanguage(langCode || "en");
    }
    try {
      const { email } = userData;

      // Find the user by email
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return new Response(
          JSON.stringify({ message: t("errorMessages.userNotFound") }),
          { status: 404 },
        );
      }

      const isAlreadyVerified = await prisma.user.findUnique({
        where: { id: user.id, is_verified: true },
      });
      if (isAlreadyVerified) {
        return new Response(
          JSON.stringify({ message: t("errorMessages.userAlreadyVerified") }),
          { status: 400 },
        );
      }

      const otp = crypto.randomInt(100000, 1000000).toString();

      // Check if a password reset entry exists for this user
      const emailResetEntry = await prisma.emailVerification.findFirst({
        where: { user_id: user.id }, // Ensure `user_id` is unique in your Prisma schema
      });

      if (emailResetEntry) {
        // If an entry exists, update it
        await prisma.emailVerification.update({
          where: { id: emailResetEntry.id }, // Use the unique `id` of emailReset
          data: {
            otp,
            expires_at: new Date(Date.now() + 10 * 60 * 1000),
          },
        });
      } else {
        // If no entry exists, create a new one
        await prisma.emailVerification.create({
          data: {
            user_id: user.id,
            otp,
            expires_at: new Date(Date.now() + 10 * 60 * 1000),
          },
        });
      }

      // Send OTP via email
      await mailService.sendVerificationEmail(
        email,
        otp,
        langCode || user?.lang_code || "en",
      );
      if (langCode) {
        await UserModel.updateUserLangPreference(user.id, langCode);
      } else {
        await i18n.changeLanguage(user?.lang_code || "en");
      }
      return new Response(
        JSON.stringify({ message: t("successMessages.otpSent") }),
        { status: 200 },
      );
    } catch (error: any) {
      throw new Error(
        error?.message || t("errorMessages.unableToProcessForgotPassword"),
      );
    }
  },
};
