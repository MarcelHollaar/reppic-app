import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "@/app/api/middleware/authMiddleware";
import { HubspotService } from "@/app/api/services/hubspotService";
import { signPayload } from "@/lib/crypto/secretBox";
import { USER_ROLE } from "@/configs/constants";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const STATE_TTL_MS = 10 * 60 * 1000;

/**
 * Start de HubSpot-OAuth-flow voor de eigen tenant. Geeft de authorize-URL
 * terug als JSON (de client redirect zelf; Bearer-auth kan niet mee in een
 * browser-redirect) en zet een nonce-cookie als CSRF-bescherming voor de
 * callback (double-submit met de HMAC-signed state).
 */
export async function GET(req: NextRequest) {
  const authCheck = await authMiddleware(req, USER_ROLE.MANAGER, true);
  if (authCheck) return authCheck;

  const user = (req as any).user;
  if (!user?.company_id) {
    return NextResponse.json(
      { message: "User has no company" },
      { status: 400 }
    );
  }

  try {
    const nonce = crypto.randomBytes(16).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        companyId: user.company_id,
        userId: user.id,
        exp: Date.now() + STATE_TTL_MS,
        nonce,
      })
    ).toString("base64url");
    const state = `${payload}.${signPayload(payload)}`;

    const authorizeUrl = HubspotService.buildAuthorizeUrl(state);

    const response = NextResponse.json({ success: true, url: authorizeUrl });
    response.cookies.set("hubspot_oauth_nonce", nonce, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: STATE_TTL_MS / 1000,
      path: "/api/hubspot",
    });
    return response;
  } catch (error) {
    console.error("[HubSpot] Connect failed:", error);
    return NextResponse.json(
      { message: "HubSpot connect failed" },
      { status: 500 }
    );
  }
}
