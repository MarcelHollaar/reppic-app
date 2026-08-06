import { prisma } from "../utils/prisma";
import { RecallAIService } from "./recallAIService";
import { prepAnalysisService } from "./prepAnalysisService";
import {
  computePrepWindow,
  parseMeetingPrepSetting,
} from "@/lib/prep-analysis/prepWindow";

// Cron-orkestratie van de gespreksvoorbereiding: voor elke tenant met de
// feature-vlag aan worden de aankomende agenda-afspraken van alle actieve
// gebruikers opgehaald (Recall v1, iterate-and-try) en wordt per afspraak
// in het venster een prep gegenereerd + gemaild. Idempotent: dedupe per
// calendar_event_id zit in prepAnalysisService.
//
// Het venster is PER VERKOPER instelbaar (UserSetting.notification_setting
// .meetingPrep): 24u vooraf (default), 's ochtends voor de hele dag, of
// X uur vooraf. Zie src/lib/prep-analysis/prepWindow.ts.

// Kleine pauze tussen Recall-calls per gebruiker (rate-limit-hygiëne).
const RECALL_CALL_DELAY_MS = 200;

export interface PrepareFollowupsReport {
  companies: number;
  usersChecked: number;
  usersWithoutCalendar: number;
  // Morning-mode-gebruikers buiten hun ochtend-uur (deze run overgeslagen).
  usersOutsideWindow: number;
  meetingsInWindow: number;
  generated: number;
  sent: number;
  skipped: number;
  deduped: number;
  failed: number;
  dryRunCandidates?: Array<{
    userEmail: string;
    mode: string;
    windowStart: string;
    windowEnd: string;
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
  const now = new Date();

  const report: PrepareFollowupsReport = {
    companies: 0,
    usersChecked: 0,
    usersWithoutCalendar: 0,
    usersOutsideWindow: 0,
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
      select: {
        id: true,
        email: true,
        user_settings: { select: { notification_setting: true }, take: 1 },
      },
    });

    for (const user of users) {
      report.usersChecked += 1;

      // Per-verkoper timing-voorkeur → zoekvenster voor deze run.
      const rawSetting = (
        user.user_settings[0]?.notification_setting as
          | Record<string, unknown>
          | null
          | undefined
      )?.meetingPrep;
      const setting = parseMeetingPrepSetting(rawSetting);
      const window = computePrepWindow(setting, now);
      if (!window) {
        // Morning-mode buiten het ochtend-uur: deze run overslaan.
        report.usersOutsideWindow += 1;
        continue;
      }

      let meetings;
      try {
        meetings = await RecallAIService.listUpcomingCalendarMeetings(
          user.id,
          window.start,
          window.end
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
            mode: setting.mode,
            windowStart: window.start.toISOString(),
            windowEnd: window.end.toISOString(),
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
    `[PrepareFollowups] ${dryRun ? "(dry-run) " : ""}companies=${report.companies} users=${report.usersChecked} noCalendar=${report.usersWithoutCalendar} outsideWindow=${report.usersOutsideWindow} meetings=${report.meetingsInWindow} sent=${report.sent} skipped=${report.skipped} deduped=${report.deduped} failed=${report.failed}`
  );
  return report;
}
