"use client";
import { useState, useRef, useCallback } from "react";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import {
  LiveAvatarSession,
  SessionEvent,
  SessionState,
  AgentEventsEnum,
} from "@heygen/liveavatar-web-sdk";

type ConnectionStatus = "disconnected" | "connecting" | "connected";

const LOG_PREFIX = "[SalesCoach LiveAvatar]";

/** If repeat() runs but the avatar never starts speaking, we log (SDK repeat no-ops when not CONNECTED). */
const WELCOME_SPEAK_DIAGNOSTIC_MS = 2500;

/** SDK repeat() no-ops until session.state === CONNECTED; STREAM_READY can fire slightly earlier. */
const CONNECTED_WAIT_MS = 5000;
const CONNECTED_POLL_MS = 50;

async function waitForSessionConnected(
  sess: LiveAvatarSession,
  label: string
): Promise<boolean> {
  const start = Date.now();
  let loggedWaiting = false;

  while (Date.now() - start < CONNECTED_WAIT_MS) {
    if (sess.state === SessionState.CONNECTED) {
      const waited = Date.now() - start;
      if (waited >= CONNECTED_POLL_MS) {
        console.log(`${LOG_PREFIX} CONNECTED after ${waited}ms (${label})`);
      }
      return true;
    }

    if (
      sess.state === SessionState.DISCONNECTED ||
      sess.state === SessionState.INACTIVE
    ) {
      console.warn(
        `${LOG_PREFIX} session not usable while waiting for CONNECTED (${label}):`,
        sess.state
      );
      return false;
    }

    if (!loggedWaiting) {
      loggedWaiting = true;
      console.log(`${LOG_PREFIX} waiting for CONNECTED (${label})`, {
        currentState: sess.state,
      });
    }

    await new Promise((r) => setTimeout(r, CONNECTED_POLL_MS));
  }

  console.warn(
    `${LOG_PREFIX} timed out waiting for CONNECTED (${CONNECTED_WAIT_MS}ms, ${label})`,
    { sessionState: sess.state }
  );
  return sess.state === SessionState.CONNECTED;
}

export interface AvatarSessionConfig {
  language: string;
  model?: string;
  phase: string;
  customerProfile?: string;
}

export function useAvatarSession() {
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const sessionRef = useRef<LiveAvatarSession | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isProcessingRef = useRef(false);

  const createSession = useCallback(async (config: AvatarSessionConfig) => {
    setConnectionStatus("connecting");

    const tokenResp = await fetch("/api/heygen/token", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders({}, true) },
      body: JSON.stringify({ language: config.language }),
    });

    if (!tokenResp.ok) {
      setConnectionStatus("disconnected");
      throw new Error("Failed to get LiveAvatar session token");
    }

    const tokenData = await tokenResp.json();
    const sessionToken = tokenData?.data?.session_token;

    if (!sessionToken) {
      setConnectionStatus("disconnected");
      throw new Error("Invalid LiveAvatar token response");
    }

    const backendSession = await fetch("/api/sessions/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: config.language,
        model: config.model || "gpt-4o-mini",
        phase: config.phase,
        customerProfile: config.customerProfile,
      }),
    });

    if (!backendSession.ok) {
      setConnectionStatus("disconnected");
      throw new Error("Failed to start backend session");
    }

    const backendData = await backendSession.json();
    const currentSessionId = backendData.sessionId as string;
    setSessionId(currentSessionId);

    const session = new LiveAvatarSession(sessionToken, { voiceChat: true });
    sessionRef.current = session;

    let welcomeSpeakWatchTimer: ReturnType<typeof setTimeout> | null = null;
    const clearWelcomeSpeakWatch = () => {
      if (welcomeSpeakWatchTimer) {
        clearTimeout(welcomeSpeakWatchTimer);
        welcomeSpeakWatchTimer = null;
      }
    };

    session.on(SessionEvent.SESSION_STREAM_READY, async () => {
      clearWelcomeSpeakWatch();

      console.log(`${LOG_PREFIX} SESSION_STREAM_READY`, {
        sessionState: session.state,
        hasVideoRef: Boolean(videoRef.current),
      });

      if (videoRef.current) {
        session.attach(videoRef.current);
      } else {
        console.warn(
          `${LOG_PREFIX} videoRef is null at STREAM_READY; attach skipped (audio may still work)`
        );
      }

      setConnectionStatus("connected");

      try {
        const resp = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "__WELCOME__",
            language: config.language,
            sessionId: currentSessionId,
          }),
        });

        console.log(`${LOG_PREFIX} welcome /api/chat`, {
          ok: resp.ok,
          status: resp.status,
        });

        if (!resp.ok) {
          const errText = await resp.text().catch(() => "");
          console.error(
            `${LOG_PREFIX} welcome /api/chat error body:`,
            errText || "(empty)"
          );
          return;
        }

        const data = await resp.json();
        if (!data?.reply?.trim()) {
          console.warn(`${LOG_PREFIX} welcome response missing reply:`, data);
          return;
        }

        const connected = await waitForSessionConnected(session, "welcome");
        if (!connected) {
          console.error(
            `${LOG_PREFIX} skip repeat(welcome): session never reached CONNECTED`
          );
          return;
        }

        console.log(`${LOG_PREFIX} before repeat(welcome)`, {
          sessionState: session.state,
          replyLength: data.reply.length,
        });

        try {
          session.repeat(data.reply);
        } catch (repeatErr) {
          console.error(`${LOG_PREFIX} repeat() threw (welcome)`, repeatErr);
          return;
        }

        welcomeSpeakWatchTimer = setTimeout(() => {
          welcomeSpeakWatchTimer = null;
          console.warn(
            `${LOG_PREFIX} welcome: repeat() was called but AVATAR_SPEAK_STARTED did not fire within ${WELCOME_SPEAK_DIAGNOSTIC_MS}ms (check session.state, mic permission, or HeyGen/LiveAvatar side).`,
            { sessionState: session.state }
          );
        }, WELCOME_SPEAK_DIAGNOSTIC_MS);
      } catch (e) {
        console.error(`${LOG_PREFIX} welcome flow failed`, e);
      }
    });

    session.on(
      AgentEventsEnum.USER_TRANSCRIPTION,
      async (event: { text: string }) => {
        const transcript = event.text?.trim();
        
        if (!transcript || isProcessingRef.current) return;

        isProcessingRef.current = true;

        try {
          const resp = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: transcript,
              language: config.language,
              sessionId: currentSessionId,
            }),
          });

          if (!resp.ok) {
            console.error(
              `${LOG_PREFIX} chat (STT) failed`,
              resp.status,
              await resp.text().catch(() => "")
            );
            return;
          }

          const data = await resp.json();
          const live = sessionRef.current;
          if (!data?.reply?.trim()) {
            console.warn(`${LOG_PREFIX} chat (STT) missing reply:`, data);
            return;
          }
          if (!live) {
            console.warn(`${LOG_PREFIX} chat (STT) sessionRef is null`);
            return;
          }

          const connected = await waitForSessionConnected(live, "STT");
          if (!connected) {
            console.error(
              `${LOG_PREFIX} skip repeat(STT): session never reached CONNECTED`
            );
            return;
          }

          console.log(`${LOG_PREFIX} before repeat(STT)`, {
            sessionState: live.state,
            replyLength: data.reply.length,
          });

          try {
            live.repeat(data.reply);
          } catch (repeatErr) {
            console.error(`${LOG_PREFIX} repeat() threw (STT)`, repeatErr);
          }
        } catch (e) {
          console.error(`${LOG_PREFIX} USER_TRANSCRIPTION handler`, e);
        } finally {
          isProcessingRef.current = false;
        }
      },
    );

    session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, () => {
      clearWelcomeSpeakWatch();
      setIsSpeaking(true);
    });

    session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => {
      setIsSpeaking(false);
    });

    session.on(SessionEvent.SESSION_DISCONNECTED, () => {
      clearWelcomeSpeakWatch();
      setConnectionStatus("disconnected");
    });

    session.on(SessionEvent.SESSION_STATE_CHANGED, (state: SessionState) => {
      console.log(`${LOG_PREFIX} SESSION_STATE_CHANGED`, state);
      if (state === SessionState.DISCONNECTED) {
        clearWelcomeSpeakWatch();
        setConnectionStatus("disconnected");
      }
    });

    await session.start();
  }, []);

  const interrupt = useCallback(() => {
    if (!sessionRef.current) return;
    try {
      sessionRef.current.interrupt();
      setIsSpeaking(false);
    } catch {}
  }, []);

  const endSession = useCallback(async (): Promise<{
    hasTranscript: boolean;
  }> => {
    let hasTranscript = false;
    try {
      if (sessionRef.current) {
        await sessionRef.current.stop();
        sessionRef.current = null;
      }
      if (sessionId) {
        const response = await fetch(`/api/sessions/${sessionId}/end`, {
          method: "POST",
        });
        if (!response.ok) {
          throw new Error("Failed to end backend session");
        }
        const data = await response.json().catch(() => null);
        hasTranscript = Boolean(data?.hasTranscript);
        setSessionId(null);
      }
    } finally {
      setConnectionStatus("disconnected");
      setIsSpeaking(false);
    }
    return { hasTranscript };
  }, [sessionId]);

  return {
    connectionStatus,
    isSpeaking,
    sessionId,
    videoRef,
    createSession,
    interrupt,
    endSession,
  } as const;
}
