// Resend integration — transactional email for password reset
import { Resend } from "resend";

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? "depl " + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) throw new Error("X-Replit-Token not found");

  connectionSettings = await fetch(
    "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=resend",
    {
      headers: {
        Accept: "application/json",
        "X-Replit-Token": xReplitToken,
      },
    }
  )
    .then((res) => res.json())
    .then((data) => data.items?.[0]);

  if (!connectionSettings?.settings?.api_key) throw new Error("Resend not connected");

  return {
    apiKey: connectionSettings.settings.api_key as string,
    fromEmail: (connectionSettings.settings.from_email as string) || "noreply@reppic.ai",
  };
}

// WARNING: Never cache this client. Tokens expire.
async function getUncachableResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return { client: new Resend(apiKey), fromEmail };
}

export async function sendPasswordResetEmail(
  toEmail: string,
  username: string,
  code: string
): Promise<void> {
  const { client, fromEmail } = await getUncachableResendClient();

  await client.emails.send({
    from: fromEmail,
    to: toEmail,
    subject: "Wachtwoord herstellen — Sales Dashboard",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #111;">
        <h2 style="margin-bottom: 8px;">Wachtwoord herstellen</h2>
        <p>Hallo <strong>${username}</strong>,</p>
        <p>Je hebt een wachtwoordherstel aangevraagd voor het Sales Dashboard. Gebruik de onderstaande code om een nieuw wachtwoord in te stellen:</p>
        <div style="background: #f4f4f5; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
          <span style="font-size: 36px; font-weight: bold; letter-spacing: 10px; font-family: monospace;">${code}</span>
        </div>
        <p style="color: #71717a; font-size: 14px;">
          Deze code is <strong>15 minuten</strong> geldig en kan slechts <strong>één keer</strong> worden gebruikt.
        </p>
        <p style="color: #71717a; font-size: 14px;">
          Als je dit niet hebt aangevraagd, kun je deze e-mail veilig negeren.
        </p>
        <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
        <p style="color: #a1a1aa; font-size: 12px;">Sales Dashboard — Reppic</p>
      </div>
    `,
  });
}
