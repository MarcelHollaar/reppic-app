import { AssemblyAI, Transcript } from "assemblyai";
import { Readable } from "stream";

export class AssemblyAIService {
  private static getClient(): AssemblyAI {
    const apiKey = process.env.ASSEMBLYAI_API_KEY;
    if (!apiKey) {
      throw new Error("ASSEMBLYAI_API_KEY not configured");
    }
    return new AssemblyAI({ apiKey });
  }

  static async uploadStream(
    stream: Readable,
    fileSize?: number,
  ): Promise<string> {
    try {
      if (fileSize) {
        const fileSizeMB = fileSize / (1024 * 1024);
        console.log(`[AssemblyAI] File size: ${fileSizeMB.toFixed(2)}MB`);
      }

      const client = this.getClient();
      const uploadUrl = await client.files.upload(stream);

      console.log(`[AssemblyAI] Upload successful`);
      return uploadUrl;
    } catch (error: any) {
      console.error("[AssemblyAI] Upload error:", error.message);
      throw new Error(`AssemblyAI upload failed: ${error.message}`);
    }
  }

  static async submitTranscriptionWithWebhook(
    audioUrl: string,
    conversationId: string,
    userId: string,
    /**
     * Origin AssemblyAI must call back on. Pass the live request origin
     * (`getCallbackBaseUrl(req)`) so the callback is correct on every domain
     * without configuration. Falls back to APP_URL only when omitted.
     */
    callbackBaseUrl?: string | null,
  ): Promise<string> {
    try {
      console.log(
        `[AssemblyAI] Submitting transcription with webhook for conversation: ${conversationId}`,
      );

      const client = this.getClient();
      const appUrl = (callbackBaseUrl || process.env.APP_URL)?.replace(/\/$/, "");

      if (!appUrl) {
        throw new Error(
          "Kan geen callback-URL bepalen: geen request-origin meegegeven en APP_URL niet gezet",
        );
      }

      // Build webhook URL with metadata as query params
      const webhookUrl = `${appUrl}/api/webhooks/assemblyai?conversationId=${encodeURIComponent(conversationId)}&userId=${encodeURIComponent(userId)}`;
      console.log(`[AssemblyAI] Webhook URL: ${webhookUrl}`);

      // Rollback 2026-07-22: de callback-authenticatie (gedeelde secret via een
      // custom header) is verwijderd, samen met de verificatie in de webhook.
      // Er wordt dus geen auth-header meer aan AssemblyAI meegegeven.
      const transcript = await client.transcripts.submit({
        audio: audioUrl,
        language_detection: true,
        speaker_labels: true,
        webhook_url: webhookUrl,
      });

      console.log(`[AssemblyAI] Transcription submitted, ID: ${transcript.id}`);
      return transcript.id;
    } catch (error: any) {
      console.error("[AssemblyAI] Submission error:", error.message);
      throw new Error(`AssemblyAI submission failed: ${error.message}`);
    }
  }

  static async getTranscript(transcriptId: string): Promise<Transcript> {
    try {
      const client = this.getClient();
      const transcript = await client.transcripts.get(transcriptId);

      console.log(
        `[AssemblyAI] Retrieved transcript ${transcriptId}, status: ${transcript.status}`,
      );
      return transcript;
    } catch (error: any) {
      console.error("[AssemblyAI] Get transcript error:", error.message);
      throw new Error(`AssemblyAI get transcript failed: ${error.message}`);
    }
  }

  static async getTranscriptText(transcriptId: string): Promise<string> {
    const transcript = await this.getTranscript(transcriptId);

    if (transcript.status === "error") {
      throw new Error(
        `AssemblyAI transcription failed: ${
          transcript.error || "Unknown error"
        }`,
      );
    }

    if (transcript.status !== "completed") {
      throw new Error(
        `AssemblyAI transcript not ready, status: ${transcript.status}`,
      );
    }

    const { utterances } = transcript;

    if (utterances && utterances.length > 0) {
      const speakerLabeledTranscript = utterances
        .map((utterance) => `Speaker ${utterance.speaker}: ${utterance.text}`)
        .join("\n");

      console.log(
        `[AssemblyAI] Using speaker-labeled transcript (${utterances.length} utterances)`,
      );

      return speakerLabeledTranscript;
    }

    return transcript.text || "";
  }
}
