"use client";
import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAvatarSession } from "@/components/salescoach/useAvatarSession";
import { useTranslation } from "react-i18next";
import SessionControls from "@/components/salescoach/SessionControls";
import FeedbackView from "@/components/salescoach/FeedbackView";
import { Video, VideoOff } from "lucide-react";

const FEEDBACK_SUPPORTED_PHASES = new Set([
  "opening",
  "needs_analysis",
  "offer",
  "agreement",
]);

export default function SalesCoachTrainerPage() {
  const { t } = useTranslation("common");

  return (
    <Suspense
      fallback={
        <div className="tw-text-center tw-mt-10">
          {t("loadingMessages.loading")}
        </div>
      }
    >
      <SalesCoachTrainerInner />
    </Suspense>
  );
}

function SalesCoachTrainerInner() {
  const params = useSearchParams();
  const { t, i18n } = useTranslation("common");
  const phase = (params.get("phase") || "opening").toLowerCase();
  const profile = params.get("profile") || undefined;

  const {
    connectionStatus,
    isSpeaking,
    videoRef,
    createSession,
    interrupt,
    endSession,
    sessionId,
  } = useAvatarSession();
  const [isMuted, setIsMuted] = useState(false);
  const [viewMode, setViewMode] = useState<"session" | "feedback">("session");
  const [completedSessionId, setCompletedSessionId] = useState<string | null>(
    null
  );
  const [feedbackEligible, setFeedbackEligible] = useState(false);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted, videoRef]);

  useEffect(() => {
    if (sessionId) {
      setViewMode("session");
    }
  }, [sessionId]);

  useEffect(() => {
    if (connectionStatus === "connected") {
      setViewMode("session");
    }
  }, [connectionStatus]);

  const isSessionActive = useMemo(
    () => connectionStatus === "connected",
    [connectionStatus]
  );

  const handleConnect = () => {
    setCompletedSessionId(null);
    setFeedbackEligible(false);
    setViewMode("session");
    createSession({
      language: (i18n?.language || "en").slice(0, 2),
      phase,
      customerProfile: profile,
    }).catch((e) => console.error("Failed to start SalesCoach session:", e));
  };

  const handleStop = async () => {
    const activeId = sessionId;
    try {
      const result = await endSession();
      const hasTranscript = Boolean(result?.hasTranscript);
      if (activeId && hasTranscript) {
        setCompletedSessionId(activeId);
        setFeedbackEligible(true);
      } else {
        setCompletedSessionId(null);
        setFeedbackEligible(false);
      }
    } catch (error) {
      console.error("Failed to stop SalesCoach session:", error);
      setCompletedSessionId(null);
      setFeedbackEligible(false);
    }
  };

  const canShowFeedbackButton =
    connectionStatus === "disconnected" &&
    !!completedSessionId &&
    feedbackEligible &&
    FEEDBACK_SUPPORTED_PHASES.has(phase as any);

  const handleViewFeedback = () => {
    if (canShowFeedbackButton) {
      setViewMode("feedback");
    }
  };

  const handleBackFromFeedback = () => setViewMode("session");

  return (
    <div className="tw-mt-4">
      <div className="tw-flex tw-justify-between tw-items-center tw-mb-4">
        <h2 className="tw-text-3xl tw-font-medium">
          {t("salescoach.trainerTitle")}
        </h2>
      </div>

      {viewMode === "feedback" && completedSessionId ? (
        <div className="tw-w-full tw-max-w-5xl tw-mx-auto">
          <FeedbackView
            sessionId={completedSessionId}
            onBack={handleBackFromFeedback}
          />
        </div>
      ) : (
        <>
          <div className="tw-w-full tw-max-w-4xl tw-mx-auto">
            <div
              className="tw-relative tw-w-full tw-bg-black tw-overflow-hidden tw-border-2 tw-rounded-xl"
              style={{ aspectRatio: "16 / 9", minHeight: 500 }}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="tw-w-full tw-h-full tw-object-contain"
              />

              {connectionStatus !== "connected" && (
                <div className="tw-absolute tw-inset-0 tw-flex tw-flex-col tw-items-center tw-justify-center tw-gap-4 tw-bg-black/80">
                  {connectionStatus === "connecting" ? (
                    <>
                      <Video className="tw-h-16 tw-w-16 tw-text-blue-500 tw-animate-pulse" />
                      <p className="tw-text-white tw-text-lg tw-font-medium">
                        {t("salescoach.connectingToAvatar")}
                      </p>
                    </>
                  ) : (
                    <>
                      <VideoOff className="tw-h-16 tw-w-16 tw-text-blue-gray-300" />
                      <p className="tw-text-blue-gray-300 tw-text-lg">
                        {t("salescoach.noActiveSession")}
                      </p>
                    </>
                  )}
                </div>
              )}

              <div className="tw-absolute tw-bottom-0 tw-left-0 tw-right-0 tw-bg-gradient-to-t tw-from-black/80 tw-to-transparent tw-p-3">
                <div className="tw-flex tw-items-center tw-gap-2">
                  <span
                    className={`tw-inline-block tw-h-2.5 tw-w-2.5 tw-rounded-full ${
                      connectionStatus === "connected"
                        ? "tw-bg-green-500"
                        : connectionStatus === "connecting"
                        ? "tw-bg-yellow-400"
                        : "tw-bg-red-500"
                    }`}
                  />
                  <span className="tw-text-sm tw-text-white tw-font-medium tw-capitalize">
                    {connectionStatus}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="tw-mt-4 tw-flex tw-items-center tw-justify-center tw-max-w-4xl tw-mx-auto">
            <SessionControls
              isSessionActive={isSessionActive}
              isSpeaking={isSpeaking}
              isMuted={isMuted}
              onConnect={handleConnect}
              onStop={handleStop}
              onInterrupt={interrupt}
              onToggleMute={() => setIsMuted((v) => !v)}
              disabled={connectionStatus === "connecting"}
            />
          </div>

          {isSessionActive && (
            <div className="tw-mt-3 tw-text-center tw-text-sm tw-text-blue-gray-500 tw-max-w-4xl tw-mx-auto">
              <p>{t("salescoach.session.instructions")}</p>
              <p className="tw-mt-1">
                {t("salescoach.session.avatarResponse")}
              </p>
            </div>
          )}

          {canShowFeedbackButton && (
            <div className="tw-mt-6 tw-flex tw-justify-center">
              <button
                type="button"
                onClick={handleViewFeedback}
                className="tw-inline-flex tw-items-center tw-gap-2 tw-rounded-full tw-bg-blue-600 hover:tw-bg-blue-700 tw-text-white tw-font-medium tw-px-6 tw-py-3"
              >
                {t("salescoach.viewFeedbackButton")}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
