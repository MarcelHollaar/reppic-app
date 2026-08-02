import { NextRequest, NextResponse } from "next/server";
import { HubspotService } from "@/app/api/services/hubspotService";
import { verifyPayloadSignature } from "@/lib/crypto/secretBox";

export const dynamic = "force-dynamic";

/**
 * OAuth-callback vanaf HubSpot (browser-redirect, dus géén Bearer-auth).
 * Beveiliging: HMAC-signed state (companyId+userId+exp+nonce) én de
 * nonce-cookie uit de connect-stap moeten kloppen. Daarna wordt de code
 * ingewisseld en de connectie encrypted opgeslagen.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const settingsUrl = new URL("/settings", url.origin);
  const fail = (reason: string) => {
    console.error(`[HubSpot] Callback rejected: ${reason}`);
    settingsUrl.searchParams.set("hubspot", "error");
    return NextResponse.redirect(settingsUrl);
  };

  if (!code || !state) return fail("missing code or state");

  const [payloadB64, signature] = state.split(".");
  if (!payloadB64 || !signature) return fail("malformed state");
  if (!verifyPayloadSignature(payloadB64, signature)) {
    return fail("invalid state signature");
  }

  let payload: { companyId: string; userId: string; exp: number; nonce: string };
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return fail("unparsable state payload");
  }

  if (!payload.companyId || !payload.nonce || Date.now() > payload.exp) {
    return fail("state expired or incomplete");
  }

  const cookieNonce = req.cookies.get("hubspot_oauth_nonce")?.value;
  if (!cookieNonce || cookieNonce !== payload.nonce) {
    return fail("nonce mismatch");
  }

  try {
    const { portalId } = await HubspotService.completeConnection(
      payload.companyId,
      code,
      payload.userId
    );
    console.log(
      `[HubSpot] Connected portal ${portalId} for company ${payload.companyId}`
    );
    settingsUrl.searchParams.set("hubspot", "connected");
    const response = NextResponse.redirect(settingsUrl);
    response.cookies.delete("hubspot_oauth_nonce");
    return response;
  } catch (error) {
    console.error("[HubSpot] Completing connection failed:", error);
    settingsUrl.searchParams.set("hubspot", "error");
    return NextResponse.redirect(settingsUrl);
  }
}
