import { ConversationModel } from "@/app/api/models/conversation";
import { CustomerModel } from "@/app/api/models/customer";
import { UserModel } from "@/app/api/models/user";
import { AssemblyAIService } from "@/app/api/services/assemblyAIService";
import { buildConversationKeyterms } from "@/app/api/services/terminologyService";
import { ProspectAccountService } from "@/app/api/services/prospectAccountService";
import { RecallAIService } from "@/app/api/services/recallAIService";
import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { getCallbackBaseUrl } from "@/app/api/utils/requestOrigin";

export const dynamic = "force-dynamic";

type RecallBotEvent =
  | "bot.joining_call"
  | "bot.in_waiting_room"
  | "bot.in_call_not_recording"
  | "bot.recording_permission_allowed"
  | "bot.recording_permission_denied"
  | "bot.in_call_recording"
  | "bot.call_ended"
  | "bot.done"
  | "bot.fatal"
  | "bot.breakout_room_entered"
  | "bot.breakout_room_left"
  | "bot.breakout_room_opened"
  | "bot.breakout_room_closed";

interface RecallWebhookData {
  code: string;
  sub_code: string | null;
  updated_at: string;
}

interface RecallWebhookBot {
  id: string;
  metadata: Record<string, any>;
}

interface RecallWebhookPayload {
  event: RecallBotEvent;
  data: {
    data: RecallWebhookData;
    bot: RecallWebhookBot;
  };
}

export async function POST(req: NextRequest) {
  const payload = await req.text();

  // Verify the Svix signature (Recall signs all webhooks) before doing any
  // work — fail closed if the secret is missing. Prevents forged/replayed
  // bot events from creating conversations and burning transcription budget.
  const secret = process.env.RECALL_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[Recall Webhook] RECALL_WEBHOOK_SECRET not set — rejecting webhook.");
    return NextResponse.json({ message: "Webhook not configured" }, { status: 503 });
  }
  let webhookPayload: RecallWebhookPayload;
  try {
    webhookPayload = new Webhook(secret).verify(payload, {
      "svix-id": req.headers.get("svix-id") ?? "",
      "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
      "svix-signature": req.headers.get("svix-signature") ?? "",
    }) as RecallWebhookPayload;
  } catch (error) {
    console.error("[Recall Webhook] Signature verification failed:", error);
    return NextResponse.json({ message: "Invalid signature" }, { status: 401 });
  }

  console.log(
    `[Recall Webhook] Event received: ${webhookPayload.event}`,
    JSON.stringify(webhookPayload, null, 2)
  );

  if (webhookPayload.event !== "bot.done") {
    return NextResponse.json(
      { message: "Event not supported" },
      { status: 400 }
    );
  }

  const botId = webhookPayload.data.bot.id;

  console.log(`[RecallAI] Processing bot.done for: ${botId}`);

  const botDetails = await RecallAIService.fetchBotWithRecordings(botId);
  const calendarMeeting = botDetails.calendar_meetings?.[0];

  if (!calendarMeeting) {
    return NextResponse.json(
      { message: "No calendar meeting found" },
      { status: 400 }
    );
  }

  const meetingId = calendarMeeting.id;
  const calendarUserId = calendarMeeting.calendar_user?.external_id;

  if (!meetingId || !calendarUserId) {
    return NextResponse.json(
      { message: "Missing meetingId or calendarUserId" },
      { status: 400 }
    );
  }

  const meetingDetails = await RecallAIService.getCalendarMeetingDetails(
    meetingId,
    calendarUserId
  );
  const {
    organizer_email: organizerEmail,
    title,
    attendee_emails: attendeeEmails,
    attendees,
  } = meetingDetails;
  const recording = botDetails.recordings?.[0];

  if (!recording) {
    return NextResponse.json(
      { message: "No recording found" },
      { status: 400 }
    );
  }

  const meetingDurationInSeconds =
    (new Date(recording.completed_at).getTime() -
      new Date(recording.created_at).getTime()) /
    1000;

  if (!organizerEmail) {
    return NextResponse.json(
      { message: "No organizer email found" },
      { status: 400 }
    );
  }

  console.log(`[RecallAI] Organizer email: ${organizerEmail}`);

  const user = await UserModel.findByEmail(organizerEmail);

  if (!user) {
    return NextResponse.json(
      { message: `User not found for email: ${organizerEmail}` },
      { status: 400 }
    );
  }

  console.log(`[RecallAI] Found user: ${user.id}`);

  const platform = botDetails.meeting_url?.platform;

  let customerName = "Video Meeting";

  if (platform === "google_meet") {
    customerName = "Google Meeting";
  }
  if (platform === "microsoft_teams_live") {
    customerName = "Teams Meeting";
  }

  console.log(`[RecallAI] Platform: ${platform}, Customer: ${customerName}`);

  let customer = await CustomerModel.findCustomerByName(user.id, customerName);

  if (!customer) {
    customer = await CustomerModel.createCustomer(user.id, customerName);
  }

  // Gespreksvoorbereiding: leg de deelnemers vast en koppel het gesprek aan
  // een blijvende eindklant (ProspectAccount) op basis van de externe
  // deelnemer-e-mails. Best-effort — mag de opname-flow nooit breken.
  const allAttendeeEmails = (
    attendeeEmails?.length
      ? attendeeEmails
      : (attendees ?? []).map((a) => a.email)
  ).filter(Boolean);
  let prospectAccountId: string | null = null;
  try {
    const resolved = await ProspectAccountService.resolveAndUpsertProspect(
      user.company_id,
      allAttendeeEmails,
      organizerEmail
    );
    prospectAccountId = resolved?.prospectAccountId ?? null;
    if (resolved) {
      console.log(
        `[RecallAI] Prospect resolved: ${resolved.domain} (${resolved.prospectAccountId})`
      );
    }
  } catch (error) {
    console.error("[RecallAI] Prospect resolution failed (non-fatal):", error);
  }

  const conversation = await ConversationModel.createConversation({
    user_id: user.id,
    customer_id: customer.id,
    title: title || "Untitled Meeting",
    transcript_status: "processing",
    transcription_provider: "assemblyai",
    file_duration: meetingDurationInSeconds,
    attendee_emails: allAttendeeEmails,
    calendar_event_id: meetingId,
    prospect_account_id: prospectAccountId,
  });

  console.log(`[RecallAI] Created conversation: ${conversation.id}`);

  const mp3Url = recording.media_shortcuts?.audio_mixed?.data?.download_url;
  const mp4Url = recording.media_shortcuts?.video_mixed?.data?.download_url;

  const audioUrl = mp3Url || mp4Url;

  if (!audioUrl) {
    return NextResponse.json(
      { message: "No audio download URL found (neither mp3 nor mp4)" },
      { status: 400 }
    );
  }

  console.log(`[RecallAI] Using ${mp3Url ? "MP3" : "MP4"} audio URL`);

  const transcriptId = await AssemblyAIService.submitTranscriptionWithWebhook(
    audioUrl,
    conversation.id,
    user.id,
    getCallbackBaseUrl(req),
    await buildConversationKeyterms(user.id)
  );

  console.log(
    `[RecallAI] Processing complete - User: ${user.email}, Conversation: ${conversation.id}, Transcript: ${transcriptId}`
  );

  return NextResponse.json({ message: "Processing complete" }, { status: 200 });
}
