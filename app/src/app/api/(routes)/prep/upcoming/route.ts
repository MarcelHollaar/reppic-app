import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "@/app/api/middleware/authMiddleware";
import { RecallAIService } from "@/app/api/services/recallAIService";
import { prisma } from "@/app/api/utils/prisma";
import { extractExternalAttendees } from "@/lib/prospect/resolveProspect";

export const dynamic = "force-dynamic";

const LOOKAHEAD_DAYS = 7;

/**
 * Aankomende agenda-afspraken van de ingelogde verkoper (komende 7 dagen),
 * verrijkt met de prep-status per afspraak. Voedt het scherm
 * "Aankomende afspraken". Zonder gekoppelde agenda: calendarConnected=false
 * (nette empty-state, geen fout).
 */
export async function GET(req: NextRequest) {
  const authCheck = await authMiddleware(req);
  if (authCheck) return authCheck;

  const user = (req as any).user;

  const now = new Date();
  const end = new Date(now.getTime() + LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);

  let meetings;
  try {
    meetings = await RecallAIService.listUpcomingCalendarMeetings(
      user.id,
      now,
      end
    );
  } catch {
    // Geen gekoppelde agenda (of Recall-fout): empty-state, geen 500.
    return NextResponse.json({ calendarConnected: false, meetings: [] });
  }

  const valid = meetings.filter((m) => m?.id && m.start_time);
  const eventIds = valid.map((m) => m.id);
  const preps = eventIds.length
    ? await prisma.conversationPrep.findMany({
        where: { calendar_event_id: { in: eventIds } },
        select: {
          id: true,
          calendar_event_id: true,
          status: true,
          skip_reason: true,
          email_sent_at: true,
          content: true,
        },
      })
    : [];
  const prepByEvent = new Map(preps.map((p) => [p.calendar_event_id, p]));

  const result = valid
    .map((m) => {
      const attendeeEmails = (
        m.attendee_emails?.length
          ? m.attendee_emails
          : (m.attendees ?? []).map((a) => a.email)
      ).filter(Boolean);
      // Anker op de verkoper (agenda-eigenaar), niet de organisator: als de
      // klant de afspraak organiseert, is de organisator juist de prospect.
      const external = extractExternalAttendees(
        attendeeEmails,
        user.email,
        process.env.NOTETAKER_EMAIL ? [process.env.NOTETAKER_EMAIL] : []
      );
      const prep = prepByEvent.get(m.id);
      return {
        calendarEventId: m.id,
        title: m.title ?? null,
        startTime: m.start_time,
        endTime: m.end_time ?? null,
        externalAttendees: external,
        attendeeCount: attendeeEmails.length,
        prep: prep
          ? {
              id: prep.id,
              status: prep.status,
              skipReason: prep.skip_reason,
              emailSentAt: prep.email_sent_at,
              hasContent: prep.content != null,
            }
          : null,
      };
    })
    .sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

  return NextResponse.json({ calendarConnected: true, meetings: result });
}
