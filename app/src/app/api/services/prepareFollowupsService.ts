import { prisma } from "../utils/prisma";
import { RecallAIService } from "./recallAIService";
import { prepAnalysisService } from "./prepAnalysisService";

// Cron-orkestratie van de gespreksvoorbereiding: voor elke tenant met de
// feature-vlag aan worden de aankomende agenda-afspraken van alle actieve
// gebruikers opgehaald (Recall v1, iterate-and-try) en wordt per afspraak
// in het venster een prep gegenereerd + gemaild. Idempotent: dedupe per
// calendar_event_id zit in prepAnalysisService.

// Venster: afspraken die over ~20-28 uur beginnen. De cron draait uurlijks,
// dus elke afspraak valt precies één keer "vers" in het venster; de
// dedupe-rij vangt de overlap tussen runs af.
const WINDOW_START_HOURS = 20;
const WINDOW_END_HOURS = 28;
// Kleine pauze tussen Recall-calls per gebruiker (rate-limit-hygiëne).
const RECALL_CALL_DELAY_MS = 200;

export interface PrepareFollowupsReport {
  companies: number;
  usersChecked: number;
  usersWithoutCalendar: number;
  meetingsInWindow: number;
  generated: number;
  sent: number;
  skipped: number;
  deduped: number;
  failed: number;
  dryRunCandidates?: Array<{
    userEmail: string;
    meetingTitle: string | null;
    meetingStart: string;
    externalAttendeeCount: number;
  }>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runPrepareFollowups(options: {
  dryRun?: boolean;
}): Promise<PrepareFollowupsReport> {
  const dryRun = options.dryRun ?? false;
  const windowStart = new Date(Date.now() + WINDOW_START_HOURS * 60 * 60 * 1000);
  const windowEnd = new Date(Date.now() + WINDOW_END_HOURS * 60 * 60 * 1000);

  const report: PrepareFollowupsReport = {
    companies: 0,
    usersChecked: 0,
    usersWithoutCalendar: 0,
    meetingsInWindow: 0,
    generated: 0,
    sent: 0,
    skipped: 0,
    deduped: 0,
    failed: 0,
    ...(dryRun ? { dryRunCandidates: [] } : {}),
  };

  const companies = await prisma.company.findMany({
    where: { meeting_prep_enabled: true },
    select: { id: true, title: true },
  });
  report.companies = companies.length;

  for (const company of companies) {
    const users = await prisma.user.findMany({
      where: { company_id: company.id, status: "active" },
      select: { id: true, email: true },
    });

    for (const user of users) {
      report.usersChecked += 1;

      let meetings;
      try {
        meetings = await RecallAIService.listUpcomingCalendarMeetings(
          user.id,
          windowStart,
          windowEnd
        );
      } catch (error) {
        // Geen gekoppelde agenda (of Recall-fout) — stil overslaan (A2).
        report.usersWithoutCalendar += 1;
        continue;
      } finally {
        await sleep(RECALL_CALL_DELAY_MS);
      }

      for (const meeting of meetings) {
        if (!meeting?.id || !meeting.start_time) continue;
        report.meetingsInWindow += 1;

        const attendeeEmails = (
          meeting.attendee_emails?.length
            ? meeting.attendee_emails
            : (meeting.attendees ?? []).map((a) => a.email)
        ).filter(Boolean);

        if (dryRun) {
          report.dryRunCandidates?.push({
            userEmail: user.email,
            meetingTitle: meeting.title ?? null,
            meetingStart: meeting.start_time,
            externalAttendeeCount: attendeeEmails.length,
          });
          continue;
        }

        const result = await prepAnalysisService.generatePrepForMeeting({
          userId: user.id,
          meeting: {
            calendarEventId: meeting.id,
            title: meeting.title ?? null,
            startTime: new Date(meeting.start_time),
            attendeeEmails,
            organizerEmail: meeting.organizer_email || user.email,
          },
        });

        switch (result.status) {
          case "sent":
            report.sent += 1;
            report.generated += 1;
            break;
          case "generated":
            report.generated += 1;
            break;
          case "skipped":
            report.skipped += 1;
            break;
          case "deduped":
            report.deduped += 1;
            break;
          case "failed":
            report.failed += 1;
            break;
        }
      }
    }
  }

  console.log(
    `[PrepareFollowups] ${dryRun ? "(dry-run) " : ""}companies=${report.companies} users=${report.usersChecked} noCalendar=${report.usersWithoutCalendar} meetings=${report.meetingsInWindow} sent=${report.sent} skipped=${report.skipped} deduped=${report.deduped} failed=${report.failed}`
  );
  return report;
}
