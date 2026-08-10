import { ConversationModel } from "@/app/api/models/conversation";
import { CustomerModel } from "@/app/api/models/customer";
import { AssemblyAIService } from "@/app/api/services/assemblyAIService";
import { buildConversationKeyterms } from "@/app/api/services/terminologyService";
import { RecallAIService } from "@/app/api/services/recallAIService";
import { prisma } from "@/app/api/utils/prisma";
import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { getCallbackBaseUrl } from "@/app/api/utils/requestOrigin";

export const dynamic = "force-dynamic";

/**
 * Recall.ai Desktop Recording SDK webhook.
 *
 * Receives sdk_upload.complete when a desktop recording finished uploading,
 * then feeds the recording into the existing pipeline: attribute the recording
 * to the user who requested the upload token (desktop_sdk_uploads mapping),
 * create a Conversation and submit the audio to AssemblyAI — identical to the
 * tail of the bot webhook (webhooks/recall). Everything downstream (transcript
 * webhook -> analysis -> dashboards) is unchanged.
 *
 * Unlike the legacy bot webhook, this endpoint VERIFIES the Svix signature
 * (Recall signs all webhooks via Svix). Every Svix endpoint has its OWN signing
 * secret, so this desktop-SDK endpoint (distinct from the meeting-bot endpoint)
 * uses its own RECALL_SDK_WEBHOOK_SECRET (whsec_...). For backward compatibility
 * it falls back to RECALL_WEBHOOK_SECRET, and verifies against every configured
 * secret so a shared-secret setup keeps working during the transition.
 */

interface RecallSdkWebhookPayload {
  event: string;
  data: {
    sdk_upload?: { id?: string; metadata?: Record<string, any> };
    upload?: { id?: string };
    recording?: { id?: string };
    recording_id?: string;
    data?: { code?: string; sub_code?: string | null };
  };
}

function verifySignature(
  payload: string,
  req: NextRequest
): RecallSdkWebhookPayload | null {
  // Each Svix webhook endpoint has its own signing secret. Prefer this
  // endpoint's dedicated RECALL_SDK_WEBHOOK_SECRET, fall back to the shared
  // RECALL_WEBHOOK_SECRET, and accept the webhook if it verifies against any
  // configured secret (robust while the prod env is being rolled out).
  const secrets = [
    process.env.RECALL_SDK_WEBHOOK_SECRET,
    process.env.RECALL_WEBHOOK_SECRET,
  ].filter((s): s is string => !!s);

  if (secrets.length === 0) {
    // Fail closed: without a secret we cannot trust the caller.
    console.error(
      "[Recall SDK Webhook] Neither RECALL_SDK_WEBHOOK_SECRET nor RECALL_WEBHOOK_SECRET is set — rejecting webhook."
    );
    return null;
  }

  const headers = {
    "svix-id": req.headers.get("svix-id") ?? "",
    "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
    "svix-signature": req.headers.get("svix-signature") ?? "",
  };

  for (const secret of secrets) {
    try {
      return new Webhook(secret).verify(
        payload,
        headers
      ) as RecallSdkWebhookPayload;
    } catch {
      // Try the next configured secret.
    }
  }

  console.error(
    "[Recall SDK Webhook] Signature verification failed for all configured secrets."
  );
  return null;
}

export async function POST(req: NextRequest) {
  const payload = await req.text();

  const webhookPayload = verifySignature(payload, req);
  if (!webhookPayload) {
    return NextResponse.json({ message: "Invalid signature" }, { status: 401 });
  }

  console.log(
    `[Recall SDK Webhook] Event received: ${webhookPayload.event}`,
    JSON.stringify(webhookPayload, null, 2)
  );

  // Payload nesting differs slightly between Recall webhook versions; check the
  // known locations for both ids.
  const sdkUploadId =
    webhookPayload.data?.sdk_upload?.id ?? webhookPayload.data?.upload?.id;
  const recordingId =
    webhookPayload.data?.recording?.id ?? webhookPayload.data?.recording_id;

  if (webhookPayload.event === "sdk_upload.failed") {
    if (sdkUploadId) {
      await prisma.desktopSdkUpload.updateMany({
        where: { upload_id: sdkUploadId },
        data: { status: "failed" },
      });
    }
    // Acknowledge so Svix stops retrying — the failure is on the recording side.
    return NextResponse.json({ message: "Upload failure noted" });
  }

  if (webhookPayload.event !== "sdk_upload.complete") {
    return NextResponse.json(
      { message: "Event not supported" },
      { status: 400 }
    );
  }

  if (!sdkUploadId || !recordingId) {
    console.error(
      "[Recall SDK Webhook] Missing sdk_upload id or recording id in payload."
    );
    return NextResponse.json(
      { message: "Missing sdk_upload or recording id" },
      { status: 400 }
    );
  }

  // Attribute the recording to the user who requested the upload token.
  const mapping = await prisma.desktopSdkUpload.findUnique({
    where: { upload_id: sdkUploadId },
  });

  const userId =
    mapping?.user_id ??
    (webhookPayload.data?.sdk_upload?.metadata?.reppic_user_id as
      | string
      | undefined);

  if (!userId) {
    console.error(
      `[Recall SDK Webhook] No user mapping for upload: ${sdkUploadId}`
    );
    return NextResponse.json({ message: "Unknown upload" }, { status: 400 });
  }

  // Idempotency: Svix retries deliveries; never create a second conversation.
  if (mapping?.status === "processed") {
    return NextResponse.json({ message: "Already processed" });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json(
      { message: "User not found for upload" },
      { status: 400 }
    );
  }

  const recording = await RecallAIService.fetchRecording(recordingId);

  const mp3Url = recording.media_shortcuts?.audio_mixed?.data?.download_url;
  const mp4Url = recording.media_shortcuts?.video_mixed?.data?.download_url;
  const audioUrl = mp3Url || mp4Url;

  if (!audioUrl) {
    return NextResponse.json(
      { message: "No audio download URL found (neither mp3 nor mp4)" },
      { status: 400 }
    );
  }

  const startedAt = recording.started_at || recording.created_at;
  const meetingDurationInSeconds =
    (new Date(recording.completed_at).getTime() -
      new Date(startedAt).getTime()) /
    1000;

  const title =
    recording.media_shortcuts?.meeting_metadata?.data?.title ||
    "Desktop opname";

  // Same customer convention as the bot webhook (one bucket per source).
  const customerName = "Desktop opname";
  let customer = await CustomerModel.findCustomerByName(user.id, customerName);
  if (!customer) {
    customer = await CustomerModel.createCustomer(user.id, customerName);
  }

  const conversation = await ConversationModel.createConversation({
    user_id: user.id,
    customer_id: customer.id,
    title,
    transcript_status: "processing",
    transcription_provider: "assemblyai",
    file_duration: meetingDurationInSeconds,
  });

  console.log(`[Recall SDK Webhook] Created conversation: ${conversation.id}`);

  const transcriptId = await AssemblyAIService.submitTranscriptionWithWebhook(
    audioUrl,
    conversation.id,
    user.id,
    getCallbackBaseUrl(req),
    await buildConversationKeyterms(user.id)
  );

  await prisma.desktopSdkUpload.updateMany({
    where: { upload_id: sdkUploadId },
    data: { status: "processed" },
  });

  console.log(
    `[Recall SDK Webhook] Processing complete - User: ${user.email}, Conversation: ${conversation.id}, Transcript: ${transcriptId}`
  );

  return NextResponse.json({ message: "Processing complete" }, { status: 200 });
}
