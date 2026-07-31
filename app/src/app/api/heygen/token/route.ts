import { NextResponse, NextRequest } from "next/server";
import { authMiddleware } from "@/app/api/middleware/authMiddleware";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Require authentication: minting a LiveAvatar session token costs money, so it
  // must not be callable anonymously.
  const authCheck = await authMiddleware(req);
  if (authCheck) return authCheck;

  const apiKey = process.env.LIVEAVATAR_API_KEY;
  if (!apiKey) {
    console.error("/api/heygen/token: Missing LIVEAVATAR_API_KEY env var");
    return NextResponse.json(
      { error: "LIVEAVATAR_API_KEY not configured" },
      { status: 500 },
    );
  }

  const avatarId = process.env.LIVEAVATAR_AVATAR_ID;
  const voiceId = process.env.LIVEAVATAR_VOICE_ID;

  if (!avatarId) {
    console.error("/api/heygen/token: Missing LIVEAVATAR_AVATAR_ID env var");
    return NextResponse.json(
      { error: "LIVEAVATAR_AVATAR_ID not configured" },
      { status: 500 },
    );
  }

  let body: { language?: string } = {};

  try {
    body = await req.json();
  } catch {}

  const language = body.language?.slice(0, 2) || "en";

  try {
    const payload: Record<string, unknown> = {
      mode: "FULL",
      avatar_id: avatarId,
      avatar_persona: {
        language,
        ...(voiceId ? { voice_id: voiceId } : {}),
      },
    };

    const resp = await fetch("https://api.liveavatar.com/v1/sessions/token", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await resp.text();
    let data: any;

    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!resp.ok) {
      console.error(
        "/api/heygen/token: LiveAvatar error",
        resp.status,
        resp.statusText,
        data,
      );
      return NextResponse.json(
        {
          error:
            data?.detail ||
            data?.error?.message ||
            resp.statusText ||
            "Failed to create session token",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(data);
  } catch (e: any) {
    console.error("/api/heygen/token: Request failed", e);
    return NextResponse.json(
      { error: e?.message || "Failed to create session token" },
      { status: 500 },
    );
  }
}
