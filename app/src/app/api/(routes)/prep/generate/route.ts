import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "@/app/api/middleware/authMiddleware";
import { prepAnalysisService } from "@/app/api/services/prepAnalysisService";
import { RecallAIService } from "@/app/api/services/recallAIService";
import { prisma } from "@/app/api/utils/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const LOOKAHEAD_DAYS = 7;

/**
 * Handmatige "bereid voor"-knop van de verkoper. Twee vormen:
 *  - { calendarEventId }  → echte agenda-afspraak; wordt server-side
 *    gehervalideerd tegen de Recall-lijst (client-data nooit vertrouwen).
 *  - { conversationId }   → "bereid volgend gesprek voor" vanaf de
 *    gesprek-detailpagina; synthetische meeting op basis van de deelnemers
 *    van dat gesprek. Gedateerd event-id → max 1 prep per dag per gesprek.
 * userId is áltijd de ingelogde gebruiker. `?send=false` genereert zonder
 * mail. Bij `deduped` wordt de bestaande content teruggegeven zodat de knop
 * altijd iets toont.
 */
export async function POST(req: NextRequest) {
  const authCheck = await authMiddleware(req);
  if (authCheck) return authCheck;

  const user = (req as any).user;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const sendEmail = new URL(req.url).searchParams.get("send") !== "false";

  let meeting: {
    calendarEventId: string;
    title: string | null;
    startTime: Date;
    attendeeEmails: string[];
  } | null = null;

  if (typeof body?.calendarEventId === "string" && body.calendarEventId) {
    // Vorm 1: echte agenda-afspraak — hervalideer tegen Recall.
    let meetings;
    try {
      const now = new Date();
      meetings = await RecallAIService.listUpcomingCalendarMeetings(
        user.id,
        now,
        new Date(now.getTime() + LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000)
      );
    } catch {
      return NextResponse.json(
        { message: "Calendar not connected" },
        { status: 409 }
      );
    }
    const found = meetings.find((m) => m.id === body.calendarEventId);
    if (!found || !found.start_time) {
      return NextResponse.json(
        { message: "Meeting not found in your calendar" },
        { status: 404 }
      );
    }
    const attendeeEmails = (
      found.attendee_emails?.length
        ? found.attendee_emails
        : (found.attendees ?? []).map((a) => a.email)
    ).filter(Boolean);
    meeting = {
      calendarEventId: found.id,
      title: found.title ?? null,
      startTime: new Date(found.start_time),
      attendeeEmails,
    };
  } else if (typeof body?.conversationId === "string" && body.conversationId) {
    // Vorm 2: vanaf de gesprek-detailpagina.
    const conversation = await prisma.userConversation.findUnique({
      where: { id: body.conversationId },
      include: { prospect_account: true, user: { select: { company_id: true } } },
    });
    if (
      !conversation ||
      conversation.user.company_id !== user.company_id
    ) {
      return NextResponse.json(
        { message: "Conversation not found" },
        { status: 404 }
      );
    }
    const attendees = Array.isArray(conversation.attendee_emails)
      ? (conversation.attendee_emails as unknown[]).map(String)
      : [];
    if (attendees.length === 0) {
      return NextResponse.json(
        { message: "No attendees known for this conversation" },
        { status: 422 }
      );
    }
    const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    meeting = {
      calendarEventId: `manual-${user.id}-${conversation.id}-${day}`,
      title: conversation.prospect_account?.name
        ? `Vervolggesprek — ${conversation.prospect_account.name}`
        : "Vervolggesprek",
      startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      attendeeEmails: [user.email, ...attendees],
    };
  } else {
    return NextResponse.json(
      { message: "calendarEventId or conversationId is required" },
      { status: 400 }
    );
  }

  try {
    const result = await prepAnalysisService.generatePrepForMeeting({
      userId: user.id,
      meeting,
      sendEmail,
    });

    // Bij dedupe: bestaande content ophalen zodat de knop altijd iets toont.
    let content = result.content ?? null;
    if (result.status === "deduped" && result.prepId) {
      const existing = await prisma.conversationPrep.findUnique({
        where: { id: result.prepId },
        select: { content: true },
      });
      content = (existing?.content as any) ?? null;
    }

    return NextResponse.json({ success: true, result, content });
  } catch (error) {
    console.error("[Prep] Manual generate failed:", error);
    return NextResponse.json({ message: "Generate failed" }, { status: 500 });
  }
}
