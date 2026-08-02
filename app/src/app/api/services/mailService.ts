import { UserConversation } from "@prisma/client";
import nodemailer, { Transporter } from "nodemailer";
import i18next from "i18next";
import Backend from "i18next-fs-backend";
import path from "path";
import {
  buildOtpEmailBody,
  capitalizeSubject,
  formatTwinAIEmailBody,
  wrapBrandedEmailHtml,
  wrapEmailHtml,
  wrapTwinAIEmailHtml,
} from "../utils/urlHelper";
import { wrapConversationSummaryEmailHtml } from "../utils/conversationSummaryEmailHtml";
import {
  buildPrepEmailHtml,
  buildPrepEmailText,
  type PrepEmailParams,
} from "../utils/prepEmailHtml";
import {
  buildConversationReportMailParts,
  type ConversationReportMailPayload,
} from "./conversationReportMail";
// Initialize i18next for backend
i18next.use(Backend).init({
  lng: "en",
  fallbackLng: "en",
  backend: {
    loadPath: path.join(process.cwd(), "public/locales/{{lng}}/common.json"),
  },
  ns: ["common"],
  defaultNS: "common",
  interpolation: { escapeValue: false },
  initImmediate: false,
});

class MailService {
  private transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendVerificationEmail(email: string, otp: string, lang: string = "en") {
    await i18next.changeLanguage(lang);
    const subjectRaw = i18next.t("emails.verificationSubject", {
      appName: process.env.APP_NAME,
    });
    const subject = capitalizeSubject(subjectRaw);
    const htmlRaw = i18next.t("emails.verificationHtml", { otp });
    const html = wrapEmailHtml(htmlRaw, process.env.APP_URL!);

    const mailOptions = {
      from: `"${process.env.APP_NAME}" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject,
      text: i18next.t("emails.verificationText", { otp }),
      html,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Verification email sent to ${email}`);
    } catch (error) {
      console.error("Error sending email:", error);
      throw new Error("Failed to send verification email.");
    }
  }

  async sendLoginOtpEmail(email: string, otp: string, lang: string = "en") {
    await i18next.changeLanguage(lang);

    const appUrl = process.env.APP_URL!;
    const subject = i18next.t("emails.loginOtpSubject");
    const htmlRaw = buildOtpEmailBody({
      title: i18next.t("emails.loginOtpEmailTitle"),
      intro: i18next.t("emails.loginOtpEmailIntro"),
      otp,
      expiry: i18next.t("emails.loginOtpEmailExpiry"),
      securityNote: i18next.t("emails.loginOtpEmailSecurityNote"),
    });
    const html = wrapBrandedEmailHtml(
      htmlRaw,
      appUrl,
      i18next.t("emails.emailFooterAutomated", { appUrl })
    );

    const mailOptions = {
      from: `"Reppic" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject,
      text: i18next.t("emails.loginOtpText", { otp }),
      html,
    };

    try {
      await this.transporter.sendMail(mailOptions);

      console.log(`Login OTP email sent to ${email}`);
    } catch (error) {
      console.error("Error sending login OTP email:", error);

      throw new Error("Failed to send login OTP email.");
    }
  }

  async sendResetPasswordEmail(
    email: string,
    otp: string,
    lang: string = "en",
  ) {
    await i18next.changeLanguage(lang);
    const subjectRaw = i18next.t("emails.resetPasswordSubject", {
      appName: process.env.APP_NAME,
    });
    const subject = capitalizeSubject(subjectRaw);
    const htmlRaw = i18next.t("emails.verificationHtml", { otp });
    const html = wrapEmailHtml(htmlRaw, process.env.APP_URL!);

    const mailOptions = {
      from: `"${process.env.APP_NAME}" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject,
      text: i18next.t("emails.resetPasswordText", { otp }),
      html,
    };

    await this.transporter.sendMail(mailOptions);
  }

  async sendInvitationEmail(
    email: string,
    inviteUrl: string,
    username: string,
    managerName: string,
    isAdminInvite = false,
    lang: string = "en",
  ) {
    await i18next.changeLanguage(lang);
    const appName = process.env.APP_NAME || "Reppic";

    const subjectRaw = isAdminInvite
      ? i18next.t("emails.invitationAdminSubject", { appName })
      : i18next.t("emails.invitationSubject", { appName });
    const subject = capitalizeSubject(subjectRaw);

    const htmlRaw = isAdminInvite
      ? i18next.t("emails.invitationAdminHtml", {
          username,
          managerName,
          appName,
          inviteUrl,
        })
      : i18next.t("emails.invitationHtml", {
          username,
          managerName,
          appName,
          inviteUrl,
        });
    const html = wrapEmailHtml(htmlRaw, process.env.APP_URL!);

    const textContent = isAdminInvite
      ? i18next.t("emails.invitationAdminText", {
          username,
          managerName,
          appName,
          inviteUrl,
        })
      : i18next.t("emails.invitationText", {
          username,
          managerName,
          appName,
          inviteUrl,
        });

    const mailOptions = {
      from: `"${appName}" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject,
      text: textContent,
      html,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Invitation email sent to ${email}`);
    } catch (error) {
      console.error("Error sending invitation email:", error);
      throw new Error("Failed to send invitation email.");
    }
  }

  async sendEvaluationEmailToUser({
    lang,
    conversationLink,
    appName,
    customerName,
    userName,
    emailFrom,
    userEmail,
    appUrl,
  }: {
    lang: string;
    conversationLink: string;
    appName: string;
    customerName: string;
    userName: string;
    emailFrom: string;
    userEmail: string;
    appUrl: string;
  }) {
    await i18next.changeLanguage(lang);
    const subjectRaw = i18next.t("emails.evaluationUserSubject");
    const subject = capitalizeSubject(subjectRaw);

    const htmlRaw = i18next.t("emails.evaluationUserHtml", {
      userName: userName,
      customerName: customerName,
      conversationLink,
      appName: appName,
    });
    const html = wrapEmailHtml(htmlRaw, appUrl);

    const mailOptions = {
      from: `"${appName}" <${emailFrom}>`,
      to: userEmail,
      subject,
      text: i18next.t("emails.evaluationUserText", {
        userName: userName,
        customerName: customerName,
        conversationLink,
        appName: appName,
      }),
      html,
    };
    await this.transporter.sendMail(mailOptions);
  }

  async sendFollowUpEmailForCustomerToUser({
    lang,
    appName,
    emailFrom,
    userEmail,
    appUrl,
    subject,
    emailBody,
  }: {
    lang: string;
    appName: string;
    emailFrom: string;
    userEmail: string;
    appUrl: string;
    subject: string;
    emailBody: string;
  }) {
    await i18next.changeLanguage(lang);

    const mailOptions = {
      from: `"${appName}" <${emailFrom}>`,
      to: userEmail,
      subject,
      text: emailBody,
      html: wrapTwinAIEmailHtml(formatTwinAIEmailBody(emailBody), appUrl),
    };

    await this.transporter.sendMail(mailOptions);
  }

  /**
   * Gespreksvoorbereiding: mailt de verkoper de prep-briefing vóór een
   * vervolgafspraak. HTML + tekst worden opgebouwd in prepEmailHtml.ts;
   * hier alleen i18n-labels, wrapper en verzending.
   */
  async sendMeetingPrepEmailToUser(params: {
    lang: string;
    appName: string;
    emailFrom: string;
    userEmail: string;
    appUrl: string;
    prep: PrepEmailParams;
  }) {
    await i18next.changeLanguage(params.lang);

    const labels = {
      intro: i18next.t("emails.prepIntro", {
        userName: params.prep.userName,
        appName: params.appName,
      }),
      meetingAt: i18next.t("emails.prepMeetingAt"),
      goalTitle: i18next.t("emails.prepGoalTitle"),
      missedTitle: i18next.t("emails.prepMissedTitle"),
      resistancesTitle: i18next.t("emails.prepResistancesTitle"),
      questionsTitle: i18next.t("emails.prepQuestionsTitle"),
      dealTitle: i18next.t("emails.prepDealTitle"),
      attentionTitle: i18next.t("emails.prepAttentionTitle"),
      previousConversation: i18next.t("emails.prepPreviousConversation"),
    };

    const subject = i18next.t("emails.prepSubject", {
      meetingTitle: params.prep.meetingTitle,
    });

    await this.transporter.sendMail({
      from: `"${params.appName}" <${params.emailFrom}>`,
      to: params.userEmail,
      subject,
      text: buildPrepEmailText(params.prep, labels),
      html: wrapEmailHtml(buildPrepEmailHtml(params.prep, labels), params.appUrl),
    });
  }

  async sendConversationReportEmailToUser(
    params: ConversationReportMailPayload & {
      appName: string;
      emailFrom: string;
      userEmail: string;
    },
  ) {
    await i18next.changeLanguage(params.lang);

    const parts = buildConversationReportMailParts(params);
    const subject = i18next.t("emails.conversationReportSubject", {
      customerName: params.customerName || "",
    });
    const html = wrapConversationSummaryEmailHtml(parts, params.appUrl);
    const text = i18next.t("emails.conversationReportText", parts);

    await this.transporter.sendMail({
      from: `"${params.appName}" <${params.emailFrom}>`,
      to: params.userEmail,
      subject,
      text,
      html,
    });
  }

  async sendEvaluationEmailToManager(
    conversation: UserConversation & { user: any; customer: any },
    lang: string = "en",
  ) {
    await i18next.changeLanguage(lang);
    const user = conversation.user;
    const customer = conversation.customer;
    const manager = user.manager;
    const conversationId = conversation.id;
    const conversationLink = `${process.env.APP_URL}/conversations/${conversationId}`;

    if (!user?.email) {
      console.error("❌ User email is missing.");
      return;
    }

    const subjectRaw = i18next.t("emails.evaluationManagerSubject");
    const subject = capitalizeSubject(subjectRaw);

    const htmlRaw = i18next.t("emails.evaluationManagerHtml", {
      managerName: manager.name,
      userName: user.name,
      customerName: customer.name,
      conversationLink,
      appName: process.env.APP_NAME,
    });
    const html = wrapEmailHtml(htmlRaw, process.env.APP_URL!);

    const mailOptions = {
      from: `"${process.env.APP_NAME}" <${process.env.EMAIL_FROM}>`,
      to: manager.email,
      subject,
      text: i18next.t("emails.evaluationManagerText", {
        managerName: manager.name,
        userName: user.name,
        customerName: customer.name,
        conversationLink,
        appName: process.env.APP_NAME,
      }),
      html,
    };

    await this.transporter.sendMail(mailOptions);
  }

  async sendOnboardingNotification(
    managerEmail: string,
    managerName: string,
    teamMemberName: string,
    lang: string = "en",
  ) {
    await i18next.changeLanguage(lang);

    const subjectRaw = i18next.t("emails.onboardingSubject");
    const subject = capitalizeSubject(subjectRaw);

    const htmlRaw = i18next.t("emails.onboardingHtml", {
      managerName,
      teamMemberName,
      appName: process.env.APP_NAME,
    });
    const html = wrapEmailHtml(htmlRaw, process.env.APP_URL!);

    const mailOptions = {
      from: `"${process.env.APP_NAME}" <${process.env.EMAIL_FROM}>`,
      to: managerEmail,
      subject,
      text: i18next.t("emails.onboardingText", {
        managerName,
        teamMemberName,
        appName: process.env.APP_NAME,
      }),
      html,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Onboarding notification sent to manager ${managerEmail}`);
    } catch (error) {
      console.error("Error sending onboarding email:", error);
      throw new Error("Failed to send onboarding notification.");
    }
  }

  async sendConversationFailureNotification(
    userEmail: string,
    userName: string,
    deviceType?: string,
    title?: string,
    lang: string = "en",
  ) {
    await i18next.changeLanguage(lang);
    const parts = (deviceType ?? "").trim().split(/\s+/);
    const browser = parts.pop() || "";
    const os = parts.join(" ");
    const subjectRaw = i18next.t("emails.conversationFailureSubject", {
      conversationTitle: title || "N/A",
    });
    const subject = capitalizeSubject(subjectRaw);
    const htmlRaw = i18next.t("emails.conversationFailureHtml", {
      userName,
      appName: process.env.APP_NAME,
      deviceType: deviceType || i18next.t("common.previousLoggedInDevice"),
      conversationTitle: title || "N/A",
      os: capitalizeSubject(os),
      browser: capitalizeSubject(browser),
    });
    const html = wrapEmailHtml(htmlRaw, process.env.APP_URL!);
    const mailOptions = {
      from: `"${process.env.APP_NAME}" <${process.env.EMAIL_FROM}>`,
      to: userEmail,
      subject,
      text: i18next.t("emails.conversationFailureText", {
        userName,
        appName: process.env.APP_NAME,
        deviceType: deviceType || i18next.t("common.previousLoggedInDevice"),
        conversationTitle: title || "N/A",
        os: capitalizeSubject(os),
        browser: capitalizeSubject(browser),
      }),
      html,
    };
    await this.transporter.sendMail(mailOptions);
  }

  /**
   * Sends an error notification email to support when TwinAI operations fail after all retries
   */
  async sendTwinAIErrorNotification(errorDetails: {
    error: Error;
    operation: string;
    conversationId?: string;
    userId?: string;
    userName?: string;
    filePath?: string;
    attempts?: number;
    errorStack?: string;
    httpStatus?: number;
    errorResponse?: string;
  }) {
    const {
      error,
      operation,
      conversationId,
      userId,
      userName,
      filePath,
      attempts,
      errorStack,
      httpStatus,
      errorResponse,
    } = errorDetails;

    const appName = process.env.APP_NAME || "Reppic";
    const appUrl = process.env.APP_URL || "N/A";
    const supportEmail = "support@mytechpartner.nl";

    // Build error details section
    const errorDetailsHtml = `
            <div style="margin: 20px 0; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #dc3545; border-radius: 4px;">
                <h3 style="margin-top: 0; color: #dc3545;">Error Details</h3>
                <p><strong>Operation:</strong> ${operation}</p>
                <p><strong>Error Message:</strong> ${
                  error.message || "Unknown error"
                }</p>
                ${
                  httpStatus
                    ? `<p><strong>HTTP Status:</strong> ${httpStatus}</p>`
                    : ""
                }
                ${
                  attempts
                    ? `<p><strong>Retry Attempts:</strong> ${attempts}</p>`
                    : ""
                }
                ${
                  conversationId
                    ? `<p><strong>Conversation ID:</strong> <a href="${appUrl}/conversations/${conversationId}">${conversationId}</a></p>`
                    : ""
                }
                ${userId ? `<p><strong>User ID:</strong> ${userId}</p>` : ""}
                ${
                  userName
                    ? `<p><strong>User Name:</strong> ${userName}</p>`
                    : ""
                }
                ${
                  filePath
                    ? `<p><strong>Recording File:</strong> <a href="${filePath}" target="_blank">${filePath}</a></p>`
                    : ""
                }
                ${
                  errorResponse
                    ? `<p><strong>Error Response:</strong><br><pre style="background: #fff; padding: 10px; border-radius: 4px; overflow-x: auto;">${errorResponse}</pre></p>`
                    : ""
                }
                ${
                  errorStack
                    ? `<p><strong>Stack Trace:</strong><br><pre style="background: #fff; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 11px;">${errorStack}</pre></p>`
                    : ""
                }
            </div>
        `;

    const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #dc3545; color: white; padding: 20px; border-radius: 4px 4px 0 0; }
                    .content { background-color: #ffffff; padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 4px 4px; }
                    pre { white-space: pre-wrap; word-wrap: break-word; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2 style="margin: 0;">⚠️ TwinAI Operation Failed</h2>
                    </div>
                    <div class="content">
                        <p>A TwinAI operation has failed after all retry attempts.</p>
                        ${errorDetailsHtml}
                        <p style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
                            This is an automated error notification from ${appName}. Please investigate the issue.
                        </p>
                    </div>
                </div>
            </body>
            </html>
        `;

    const text = `
TwinAI Operation Failed

Operation: ${operation}
Error Message: ${error.message || "Unknown error"}
${httpStatus ? `HTTP Status: ${httpStatus}` : ""}
${attempts ? `Retry Attempts: ${attempts}` : ""}
${conversationId ? `Conversation ID: ${conversationId}` : ""}
${userId ? `User ID: ${userId}` : ""}
${userName ? `User Name: ${userName}` : ""}
${filePath ? `Recording File: ${filePath}` : ""}
${errorResponse ? `Error Response: ${errorResponse}` : ""}
${errorStack ? `Stack Trace: ${errorStack}` : ""}

This is an automated error notification from ${appName}.
        `;

    const mailOptions = {
      from: `"${appName} Error Notifications" <${process.env.EMAIL_FROM}>`,
      to: supportEmail,
      subject: `[${appName}] TwinAI Error: ${operation} - ${
        error.message?.substring(0, 50) || "Unknown error"
      }`,
      text,
      html,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(
        `[MailService] TwinAI error notification sent to ${supportEmail}`,
      );
    } catch (emailError) {
      console.error(
        "[MailService] Failed to send error notification email:",
        emailError,
      );
      // Don't throw - we don't want email failures to break the error flow
    }
  }
}

export const mailService = new MailService();
