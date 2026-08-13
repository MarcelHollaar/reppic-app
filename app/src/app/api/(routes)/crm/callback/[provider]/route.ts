import { NextRequest, NextResponse } from "next/server";
import {
  getCrmProvider,
  isCrmProviderId,
} from "@/app/api/services/crm/registry";
import { verifyPayloadSignature } from "@/lib/crypto/secretBox";

export const dynamic = "force-dynamic";

/**
 * OAuth-callback vanaf de CRM-provider (browser-redirect, dus géén Bearer-auth).
 * Beveiliging: HMAC-signed state (provider+companyId+userId+instanceUrl+exp+
 * nonce) én de nonce-cookie uit de connect-stap moeten kloppen, en de provider
 * in het pad moet overeenkomen met die in de state. Daarna wordt de code
 * ingewisseld en de connectie encrypted opgeslagen.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { provider: string } }
) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const settingsUrl = new URL("/settings", url.origin);
  const fail = (reason: string) => {
    console.error(`[CRM] Callback rejected: ${reason}`);
    settingsUrl.searchParams.set("crm", "error");
    return NextResponse.redirect(settingsUrl);
  };

  if (!isCrmProviderId(params.provider)) return fail("unknown provider");
  if (!code || !state) return fail("missing code or state");

  const [payloadB64, signature] = state.split(".");
  if (!payloadB64 || !signature) return fail("malformed state");
  if (!verifyPayloadSignature(payloadB64, signature)) {
    return fail("invalid state signature");
  }

  let payload: {
    provider: string;
    companyId: string;
    userId: string;
    instanceUrl: string | null;
    exp: number;
    nonce: string;
  };
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return fail("unparsable state payload");
  }

  if (!payload.companyId || !payload.nonce || Date.now() > payload.exp) {
    return fail("state expired or incomplete");
  }
  if (payload.provider !== params.provider) {
    return fail("provider mismatch");
  }

  const cookieNonce = req.cookies.get("crm_oauth_nonce")?.value;
  if (!cookieNonce || cookieNonce !== payload.nonce) {
    return fail("nonce mismatch");
  }

  try {
    const provider = getCrmProvider(params.provider);
    const { externalAccountId } = await provider.completeConnection(
      payload.companyId,
      code,
      payload.userId,
      payload.instanceUrl ? { instance_url: payload.instanceUrl } : undefined
    );
    console.log(
      `[CRM:${params.provider}] Connected account ${externalAccountId} for company ${payload.companyId}`
    );
    settingsUrl.searchParams.set("crm", "connected");
    const response = NextResponse.redirect(settingsUrl);
    response.cookies.delete("crm_oauth_nonce");
    return response;
  } catch (error) {
    console.error(
      `[CRM:${params.provider}] Completing connection failed:`,
      error
    );
    settingsUrl.searchParams.set("crm", "error");
    return NextResponse.redirect(settingsUrl);
  }
}
