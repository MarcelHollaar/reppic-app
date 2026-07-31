import { NextResponse } from "next/server";
import { createSession } from "@/lib/salescoach/sessionStore";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { language, model, phase, customerProfile } = body || {};
  if (!language || !phase) {
    return NextResponse.json({ error: "language and phase are required" }, { status: 400 });
  }

  const session = createSession(String(language), model ? String(model) : null, String(phase), customerProfile ? String(customerProfile) : null);
  return NextResponse.json({ sessionId: session.id, ...session });
}

