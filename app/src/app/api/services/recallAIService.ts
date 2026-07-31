const RECALL_BASE_URL = "https://us-west-2.recall.ai";

// Types for Recall.ai Bot API response
interface RecallBotStatusChange {
  code: string;
  message: string | null;
  created_at: string;
  sub_code: string | null;
}

interface RecallMediaStatus {
  code: string;
  sub_code: string | null;
  updated_at: string;
}

interface RecallVideoMixed {
  id: string;
  created_at: string;
  status: RecallMediaStatus;
  metadata: Record<string, any>;
  data: {
    download_url: string;
  };
  format: string;
}

interface RecallParticipantEvents {
  id: string;
  created_at: string;
  status: RecallMediaStatus;
  metadata: Record<string, any>;
  data: {
    participant_events_download_url: string;
    speaker_timeline_download_url: string;
    participants_download_url: string;
  };
}

interface RecallMeetingMetadata {
  id: string;
  created_at: string;
  status: RecallMediaStatus;
  metadata: Record<string, any>;
  data: {
    title: string | null;
    zoom: any | null;
  };
}

interface RecallMediaShortcuts {
  video_mixed: RecallVideoMixed | null;
  transcript: any | null;
  participant_events: RecallParticipantEvents | null;
  meeting_metadata: RecallMeetingMetadata | null;
  audio_mixed: any | null;
}

export interface RecallRecording {
  id: string;
  created_at: string;
  started_at: string;
  completed_at: string;
  expires_at: string;
  status: RecallMediaStatus;
  media_shortcuts: RecallMediaShortcuts;
  metadata: Record<string, any>;
}

interface RecallCalendarUser {
  id: string;
  external_id: string;
}

interface RecallCalendarMeeting {
  id: string;
  start_time: string;
  end_time: string;
  calendar_user: RecallCalendarUser;
}

interface RecallMeetingUrl {
  meeting_id: string;
  platform: string;
}

export interface RecallBotDetails {
  id: string;
  meeting_url: RecallMeetingUrl;
  bot_name: string;
  join_at: string;
  recording_config: Record<string, any>;
  status_changes: RecallBotStatusChange[];
  recordings: RecallRecording[];
  automatic_leave: Record<string, any>;
  calendar_meetings: RecallCalendarMeeting[];
  metadata: Record<string, any>;
}

// Types for Calendar Meeting Details API response
interface RecallMeetInvite {
  meeting_id: string;
}

interface RecallAttendee {
  name: string | null;
  email: string;
  is_organizer: boolean;
  status: string;
}

export interface RecallCalendarDetails {
  id: string;
  override_should_record: boolean | null;
  title: string;
  description: string;
  will_record: boolean;
  will_record_reason: string;
  start_time: string;
  end_time: string;
  platform: string;
  platform_id: string;
  meeting_platform: string;
  calendar_platform: string;
  zoom_invite: any | null;
  teams_invite: any | null;
  meet_invite: RecallMeetInvite | null;
  webex_invite: any | null;
  goto_meeting_invite: any | null;
  bot_id: string;
  is_external: boolean;
  is_hosted_by_me: boolean;
  is_recurring: boolean;
  organizer_email: string;
  attendee_emails: string[];
  attendees: RecallAttendee[];
  ical_uid: string;
  visibility: string | null;
}

export interface RecallDesktopSdkUpload {
  id: string;
  upload_token: string;
}

export class RecallAIService {
  private static getApiKey(): string {
    const apiKey = process.env.RECALL_API_KEY;
    if (!apiKey) {
      throw new Error("RECALL_API_KEY not configured");
    }
    return apiKey;
  }

  static async getCalendarAuthToken(userId: string): Promise<string> {
    console.log(
      `[RecallAI] Generating calendar auth token for user: ${userId}`
    );

    const apiKey = this.getApiKey();
    const response = await fetch(
      `${RECALL_BASE_URL}/api/v1/calendar/authenticate/`,
      {
        method: "POST",
        headers: {
          Authorization: `Token ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user_id: userId }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(`Calendar auth failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    return data.token;
  }

  static async fetchBotWithRecordings(
    botId: string
  ): Promise<RecallBotDetails> {
    console.log(`[RecallAI] Fetching bot details for: ${botId}`);

    const apiKey = this.getApiKey();

    const response = await fetch(`${RECALL_BASE_URL}/api/v1/bot/${botId}/`, {
      method: "GET",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Get bot failed: ${response.status} ${errorText}`);
    }

    const data: RecallBotDetails = await response.json();
    console.log("[RecallAI] Bot details:", JSON.stringify(data, null, 2));
    return data;
  }

  static async getCalendarMeetingDetails(
    meetingId: string,
    calendarUserId: string
  ): Promise<RecallCalendarDetails> {
    console.log(`[RecallAI] Fetching calendar meeting: ${meetingId}`);

    const userToken = await this.getCalendarAuthToken(calendarUserId);
    const response = await fetch(
      `${RECALL_BASE_URL}/api/v1/calendar/meetings/${meetingId}/`,
      {
        method: "GET",
        headers: {
          "x-recallcalendarauthtoken": userToken,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(
        `Get calendar meeting failed: ${response.status} ${errorText}`
      );
    }

    const data: RecallCalendarDetails = await response.json();

    console.log("[RecallAI] Meeting data:", JSON.stringify(data, null, 2));

    return data;
  }

  /**
   * Creates a Desktop Recording SDK upload. The returned upload_token is handed
   * to the desktop app, which passes it to RecallAiSdk.startRecording(). The
   * Reppic user id travels along as metadata so the sdk_upload.complete webhook
   * can attribute the recording even without our local mapping row.
   *
   * No transcript provider is configured on purpose: transcription stays with
   * our existing AssemblyAI flow (same as the bot webhook).
   */
  static async createDesktopSdkUpload(
    userId: string
  ): Promise<RecallDesktopSdkUpload> {
    console.log(`[RecallAI] Creating desktop SDK upload for user: ${userId}`);

    const apiKey = this.getApiKey();
    const response = await fetch(`${RECALL_BASE_URL}/api/v1/sdk_upload/`, {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recording_config: {},
        metadata: { reppic_user_id: userId },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Create SDK upload failed: ${response.status} ${errorText}`
      );
    }

    const data = await response.json();

    if (!data?.id || !data?.upload_token) {
      throw new Error("Create SDK upload returned no id/upload_token");
    }

    return { id: data.id, upload_token: data.upload_token };
  }

  /**
   * Fetches a single recording (used by the Desktop SDK webhook, which only
   * receives a recording id — unlike the bot flow where recordings are nested
   * in the bot payload).
   */
  static async fetchRecording(recordingId: string): Promise<RecallRecording> {
    console.log(`[RecallAI] Fetching recording: ${recordingId}`);

    const apiKey = this.getApiKey();
    const response = await fetch(
      `${RECALL_BASE_URL}/api/v1/recording/${recordingId}/`,
      {
        method: "GET",
        headers: {
          Authorization: `Token ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Get recording failed: ${response.status} ${errorText}`
      );
    }

    const data: RecallRecording = await response.json();
    console.log("[RecallAI] Recording:", JSON.stringify(data, null, 2));
    return data;
  }
}
