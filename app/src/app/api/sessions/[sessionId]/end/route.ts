import { NextResponse } from "next/server";
import { endSession, getHistory } from "@/lib/salescoach/sessionStore";

export async function POST(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }
  const historyLength = getHistory(sessionId).length;
  endSession(sessionId);
  return NextResponse.json({ success: true, hasTranscript: historyLength > 0 });
}
