import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "@/app/api/middleware/authMiddleware";
import { prepAnalysisService } from "@/app/api/services/prepAnalysisService";
import { prisma } from "@/app/api/utils/prisma";
import { USER_ROLE } from "@/configs/constants";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Superadmin/debug: genereer on-demand een gespreksvoorbereiding voor een
 * (synthetisch) agenda-event, zonder te wachten op de cron. Standaard wordt
 * er NIET gemaild (?send=true om echt te versturen).
 *
 * Body:
 *   {
 *     userId: string,              // de verkoper
 *     prospectEmail: string,       // extern klant-adres (bron voor matching)
 *     meetingTitle?: string,
 *     meetingStart?: string,       // ISO; default: morgen
 *     calendarEventId?: string     // default: synthetisch uniek id
 *   }
 */
export async function POST(req: NextRequest) {
  const authCheck = await authMiddleware(req, USER_ROLE.SUPER_ADMIN);
  if (authCheck) return authCheck;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const { userId, prospectEmail } = body ?? {};
  if (!userId || !prospectEmail) {
    return NextResponse.json(
      { message: "userId and prospectEmail are required" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });
  if (!user) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  const sendEmail = new URL(req.url).searchParams.get("send") === "true";
  const meetingStart = body.meetingStart
    ? new Date(body.meetingStart)
    : new Date(Date.now() + 24 * 60 * 60 * 1000);
  if (Number.isNaN(meetingStart.getTime())) {
    return NextResponse.json(
      { message: "Invalid meetingStart" },
      { status: 400 }
    );
  }

  const calendarEventId =
    body.calendarEventId || `preview-${userId}-${Date.now()}`;

  // Optioneel: extra deelnemers meesturen (test van MAX_ATTENDEES e.d.).
  const extraAttendees: string[] = Array.isArray(body.attendeeEmails)
    ? body.attendeeEmails.map((e: unknown) => String(e))
    : [];

  try {
    const result = await prepAnalysisService.generatePrepForMeeting({
      userId,
      meeting: {
        calendarEventId,
        title: body.meetingTitle || "Preview-meeting",
        startTime: meetingStart,
        attendeeEmails: [user.email, prospectEmail, ...extraAttendees],
        organizerEmail: user.email,
      },
      sendEmail,
    });

    return NextResponse.json({ success: true, calendarEventId, result });
  } catch (error) {
    console.error("[Prep] Preview failed:", error);
    return NextResponse.json({ message: "Preview failed" }, { status: 500 });
  }
}
