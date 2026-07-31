/**
 * LMS Sync Service
 *
 * Synchronizes users and companies from the main app to LMS Reppic.
 * Uses webhook-based communication with API key authentication.
 */

import nodemailer from "nodemailer";

/**
 * Get email recipients for sync failure notifications from env variable.
 * Expected format: comma-separated email addresses
 * Example: LMS_SYNC_FAILURE_EMAILS=amisi@mytechpartner.nl,marcel@thesalesstudios.com
 */
function getSyncFailureRecipients(): string[] {
  const envRecipients = process.env.LMS_SYNC_FAILURE_EMAILS;
  if (!envRecipients) {
    return [];
  }
  return envRecipients.split(",").map((email) => email.trim()).filter(Boolean);
}

/**
 * Send email notification when LMS sync fails
 */
async function sendSyncFailureEmail(
  userEmail: string,
  errorMessage: string
): Promise<void> {
  const recipients = getSyncFailureRecipients();
  
  if (recipients.length === 0) {
    console.log("[LMS-SYNC] No failure notification recipients configured (LMS_SYNC_FAILURE_EMAILS)");
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const appName = process.env.APP_NAME || "Reppic";
    const timestamp = new Date().toISOString();

    const mailOptions = {
      from: `"${appName}" <${process.env.FROM_MAIL}>`,
      to: recipients.join(", "),
      subject: `[${appName}] LMS Sync Failed - ${userEmail}`,
      text: `LMS User Sync Failed\n\nUser: ${userEmail}\nTime: ${timestamp}\nError: ${errorMessage}`,
      html: `
        <h2>LMS User Sync Failed</h2>
        <p><strong>User:</strong> ${userEmail}</p>
        <p><strong>Time:</strong> ${timestamp}</p>
        <p><strong>Error:</strong></p>
        <pre style="background: #f4f4f4; padding: 10px; border-radius: 4px;">${errorMessage}</pre>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log("[LMS-SYNC] Failure notification email sent to:", recipients.join(", "));
  } catch (emailError) {
    console.error("[LMS-SYNC] Failed to send failure notification email:", emailError);
  }
}

interface LMSUserSyncPayload {
  user: {
    id: string;
    name: string;
    email: string;
    password: string;
    phone?: string;
    language?: string;
  };
  company?: {
    id: string;
    name: string;
    email: string;
  };
}

interface LMSSyncResult {
  success: boolean;
  userId?: string;
  message?: string;
  error?: string;
}

/**
 * Sync a user (and optionally their company) to the LMS
 *
 * @param user - User data to sync
 * @param company - Optional company data to sync
 * @returns Result of the sync operation
 */
export async function syncUserToLMS(
  user: {
    id: string;
    name: string;
    email: string;
    password: string | null;
    phone_number?: string | null;
    lang_code?: string | null;
  },
  company?: {
    id: string;
    name: string;
    email: string;
  } | null,
): Promise<LMSSyncResult> {
  const lmsApiUrl = process.env.LMS_API_URL;
  const lmsWebhookSecret = process.env.LMS_WEBHOOK_SECRET;

  // Check if LMS sync is configured
  if (!lmsApiUrl || !lmsWebhookSecret) {
    console.log("[LMS-SYNC] LMS sync not configured, skipping");
    return { success: true, message: "LMS sync not configured" };
  }

  // Skip if user has no password (cannot login anyway)
  if (!user.password) {
    console.log(
      "[LMS-SYNC] User has no password, skipping sync for:",
      user.email,
    );
    return { success: true, message: "User has no password, skipped" };
  }

  const payload: LMSUserSyncPayload = {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      password: user.password,
      phone: user.phone_number || undefined,
      language: user.lang_code || undefined,
    },
  };

  // Add company if provided
  if (company?.id && company?.name) {
    payload.company = {
      id: company.id,
      name: company.name,
      email: company.email,
    };
  }

  try {
    console.log("[LMS-SYNC] Syncing user to LMS:", user.email);

    const response = await fetch(`${lmsApiUrl}/api/webhook/user-sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Secret": lmsWebhookSecret,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const errorMessage = `HTTP ${response.status}: ${errorText}`;
      console.error("[LMS-SYNC] Failed to sync user:", response.status, errorText);
      
      // Send failure notification email
      await sendSyncFailureEmail(user.email, errorMessage);
      
      return {
        success: false,
        error: errorMessage,
      };
    }

    const result = (await response.json()) as LMSSyncResult;
    console.log("[LMS-SYNC] Successfully synced user:", user.email);

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[LMS-SYNC] Error syncing user to LMS:", error);
    
    // Send failure notification email
    await sendSyncFailureEmail(user.email, errorMessage);
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Fire-and-forget version of syncUserToLMS
 * Does not block the main flow if sync fails
 */
export function syncUserToLMSAsync(
  user: {
    id: string;
    name: string;
    email: string;
    password: string | null;
    phone_number?: string | null;
    lang_code?: string | null;
  },
  company?: {
    id: string;
    name: string;
    email: string;
  } | null,
): void {
  // Fire and forget - don't await
  syncUserToLMS(user, company).catch((error) => {
    console.error("[LMS-SYNC] Async sync failed:", error);
  });
}

/**
 * Delete a user from the LMS
 *
 * @param userId - The user ID to delete
 * @param userEmail - The user email (for lookup fallback and logging)
 * @returns Result of the delete operation
 */
export async function deleteUserFromLMS(
  userId: string,
  userEmail: string,
): Promise<LMSSyncResult> {
  const lmsApiUrl = process.env.LMS_API_URL;
  const lmsWebhookSecret = process.env.LMS_WEBHOOK_SECRET;

  // Check if LMS sync is configured
  if (!lmsApiUrl || !lmsWebhookSecret) {
    console.log("[LMS-DELETE] LMS sync not configured, skipping");
    return { success: true, message: "LMS sync not configured" };
  }

  try {
    console.log("[LMS-DELETE] Deleting user from LMS:", userEmail);

    const response = await fetch(`${lmsApiUrl}/api/webhook/user-delete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Secret": lmsWebhookSecret,
      },
      body: JSON.stringify({
        userId,
        email: userEmail,
      }),
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      const errorMessage = `HTTP ${response.status}: ${responseText}`;
      console.error("[LMS-DELETE] Failed to delete user:", response.status, responseText);
      
      return {
        success: false,
        error: errorMessage,
      };
    }

    // Try to parse JSON response, handle HTML error pages gracefully
    try {
      const result = JSON.parse(responseText) as LMSSyncResult;
      console.log("[LMS-DELETE] Successfully deleted user from LMS:", userEmail);
      return result;
    } catch {
      // Response is not JSON (likely HTML error page)
      console.error("[LMS-DELETE] Invalid JSON response:", responseText.substring(0, 200));
      return {
        success: false,
        error: "LMS returned invalid response (endpoint may not be deployed)",
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[LMS-DELETE] Error deleting user from LMS:", error);
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Fire-and-forget version of deleteUserFromLMS
 * Does not block the main flow if delete fails
 */
export function deleteUserFromLMSAsync(
  userId: string,
  userEmail: string,
): void {
  // Fire and forget - don't await
  deleteUserFromLMS(userId, userEmail).catch((error) => {
    console.error("[LMS-DELETE] Async delete failed:", error);
  });
}

/**
 * Invalidate a user's LMS sessions (logout from LMS)
 *
 * @param userId - The user ID to logout
 * @param userEmail - The user email (for lookup fallback and logging)
 * @returns Result of the logout operation
 */
export async function logoutUserFromLMS(
  userId: string,
  userEmail: string,
): Promise<LMSSyncResult> {
  const lmsApiUrl = process.env.LMS_API_URL;
  const lmsWebhookSecret = process.env.LMS_WEBHOOK_SECRET;

  if (!lmsApiUrl || !lmsWebhookSecret) {
    console.log("[LMS-LOGOUT] LMS sync not configured, skipping");
    return { success: true, message: "LMS sync not configured" };
  }

  try {
    console.log("[LMS-LOGOUT] Logging out user from LMS:", userEmail);

    const response = await fetch(`${lmsApiUrl}/api/webhook/user-logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Secret": lmsWebhookSecret,
      },
      body: JSON.stringify({ userId, email: userEmail }),
    });

    const responseText = await response.text();

    if (!response.ok) {
      const errorMessage = `HTTP ${response.status}: ${responseText}`;
      console.error("[LMS-LOGOUT] Failed to logout user:", response.status, responseText);
      return { success: false, error: errorMessage };
    }

    try {
      const result = JSON.parse(responseText) as LMSSyncResult;
      console.log("[LMS-LOGOUT] Successfully logged out user from LMS:", userEmail);
      return result;
    } catch {
      console.error("[LMS-LOGOUT] Invalid JSON response:", responseText.substring(0, 200));
      return {
        success: false,
        error: "LMS returned invalid response (endpoint may not be deployed)",
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[LMS-LOGOUT] Error logging out user from LMS:", error);
    return { success: false, error: errorMessage };
  }
}
