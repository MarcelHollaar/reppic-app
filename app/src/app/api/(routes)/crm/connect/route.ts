import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "@/app/api/middleware/authMiddleware";
import {
  getCrmProvider,
  isCrmProviderId,
} from "@/app/api/services/crm/registry";
import { CrmProviderNotConfiguredError } from "@/app/api/services/crm/types";
import { signPayload } from "@/lib/crypto/secretBox";
import { USER_ROLE } from "@/configs/constants";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const STATE_TTL_MS = 10 * 60 * 1000;

/**
 * Start de CRM-OAuth-flow voor de eigen tenant. `provider` kiest de CRM
 * (hubspot | salesforce | dynamics); Dynamics vereist daarnaast `instance_url`
 * (de org-URL van de klant). Geeft de authorize-URL terug als JSON — de client
 * redirect zelf, want Bearer-auth kan niet mee in een browser-redirect. Een
 * nonce-cookie beschermt de callback tegen CSRF (double-submit met de
 * HMAC-signed state). 501 wanneer de provider-app nog niet is ingesteld.
 */
export async function GET(req: NextRequest) {
  const authCheck = await authMiddleware(req, USER_ROLE.MANAGER, true);
  if (authCheck) return authCheck;

  const user = (req as any).user;
  if (!user?.company_id) {
    return NextResponse.json({ message: "User has no company" }, { status: 400 });
  }

  const providerParam = req.nextUrl.searchParams.get("provider") ?? "";
  if (!isCrmProviderId(providerParam)) {
    return NextResponse.json(
      { message: "Unsupported CRM provider" },
      { status: 400 }
    );
  }
  const provider = getCrmProvider(providerParam);
  const instanceUrl = req.nextUrl.searchParams.get("instance_url") ?? undefined;

  try {
    const nonce = crypto.randomBytes(16).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        provider: providerParam,
        companyId: user.company_id,
        userId: user.id,
        instanceUrl: instanceUrl ?? null,
        exp: Date.now() + STATE_TTL_MS,
        nonce,
      })
    ).toString("base64url");
    const state = `${payload}.${signPayload(payload)}`;

    const authorizeUrl = provider.buildAuthorizeUrl(
      state,
      instanceUrl ? { instance_url: instanceUrl } : undefined
    );

    const response = NextResponse.json({ success: true, url: authorizeUrl });
    response.cookies.set("crm_oauth_nonce", nonce, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: STATE_TTL_MS / 1000,
      path: "/api/crm",
    });
    return response;
  } catch (error) {
    if (error instanceof CrmProviderNotConfiguredError) {
      // Provider-app nog niet ingesteld: nette 501 zodat de UI "nog niet
      // beschikbaar" kan tonen (zelfde patroon als de agenda-koppeling).
      return NextResponse.json(
        { message: "CRM provider not configured", code: "not_configured" },
        { status: 501 }
      );
    }
    console.error(`[CRM:${providerParam}] Connect failed:`, error);
    return NextResponse.json({ message: "CRM connect failed" }, { status: 500 });
  }
}
