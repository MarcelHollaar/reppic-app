"use client";

import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast, ToastContainer } from "react-toastify";
import authMiddleware from "@/middleware/authMiddleware";
import { getAuthHeaders } from "@/utils/getAuthHeaders";
import { Spinner } from "@/components/MaterialTailwind";
import PrepContentView, {
  type PrepContentShape,
} from "@/components/prep/PrepContentView";

// "Aankomende afspraken": agenda-afspraken van de ingelogde verkoper met de
// prep-status per afspraak + handmatige "Bereid nu voor"-knop. Zonder
// gekoppelde agenda een nette empty-state.

interface UpcomingMeeting {
  calendarEventId: string;
  title: string | null;
  startTime: string;
  endTime: string | null;
  externalAttendees: string[];
  attendeeCount: number;
  prep: {
    id: string;
    status: string;
    skipReason: string | null;
    emailSentAt: string | null;
    hasContent: boolean;
  } | null;
}

function statusBadge(
  meeting: UpcomingMeeting,
  t: (key: string, fallback?: string) => string
): { label: string; className: string } {
  const base =
    "tw-text-xs tw-font-medium tw-px-2.5 tw-py-1 tw-rounded-full tw-inline-block";
  if (!meeting.prep) {
    return {
      label: t("meetings.statusNone"),
      className: `${base} tw-bg-gray-100 tw-text-gray-600`,
    };
  }
  switch (meeting.prep.status) {
    case "sent":
      return {
        label: t("meetings.statusSent"),
        className: `${base} tw-bg-green-100 tw-text-green-700`,
      };
    case "generated":
      return {
        label: t("meetings.statusGenerated"),
        className: `${base} tw-bg-blue-100 tw-text-blue-700`,
      };
    case "skipped":
      return {
        label: t(
          `meetings.skip_${meeting.prep.skipReason ?? "unknown"}`,
          t("meetings.statusSkipped")
        ),
        className: `${base} tw-bg-amber-100 tw-text-amber-700`,
      };
    case "failed":
      return {
        label: t("meetings.statusFailed"),
        className: `${base} tw-bg-red-100 tw-text-red-700`,
      };
    default:
      return {
        label: t("meetings.statusPending"),
        className: `${base} tw-bg-gray-100 tw-text-gray-600`,
      };
  }
}

function MeetingsPage() {
  const { t, i18n } = useTranslation("common");
  const [isLoading, setIsLoading] = useState(true);
  const [calendarConnected, setCalendarConnected] = useState(true);
  const [meetings, setMeetings] = useState<UpcomingMeeting[]>([]);
  const [busyEventId, setBusyEventId] = useState<string | null>(null);
  const [openContent, setOpenContent] = useState<
    Record<string, PrepContentShape>
  >({});

  const load = async () => {
    try {
      const headers = getAuthHeaders();
      if (!headers) return;
      const res = await fetch("/api/prep/upcoming", { headers });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || t("meetings.loadFailed"));
        return;
      }
      setCalendarConnected(data.calendarConnected);
      setMeetings(data.meetings ?? []);
    } catch {
      toast.error(t("meetings.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generate = async (calendarEventId: string) => {
    setBusyEventId(calendarEventId);
    try {
      const headers = getAuthHeaders();
      if (!headers) return;
      const res = await fetch("/api/prep/generate", {
        method: "POST",
        headers,
        body: JSON.stringify({ calendarEventId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || t("meetings.generateFailed"));
        return;
      }
      const status = data.result?.status;
      if (data.content) {
        setOpenContent((prev) => ({
          ...prev,
          [calendarEventId]: data.content,
        }));
        toast.success(
          status === "deduped"
            ? t("meetings.existingShown")
            : t("meetings.generated")
        );
      } else if (status === "skipped") {
        toast.info(
          t(
            `meetings.skip_${data.result?.skipReason ?? "unknown"}`,
            t("meetings.statusSkipped")
          )
        );
      } else {
        toast.error(t("meetings.generateFailed"));
      }
      await load();
    } catch {
      toast.error(t("meetings.generateFailed"));
    } finally {
      setBusyEventId(null);
    }
  };

  // Groepeer per dag (lokale weergave).
  const byDay = meetings.reduce<Record<string, UpcomingMeeting[]>>(
    (acc, m) => {
      const day = new Date(m.startTime).toLocaleDateString(i18n.language, {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      (acc[day] ??= []).push(m);
      return acc;
    },
    {}
  );

  return (
    <div className="tw-ml-0 tw-mt-4">
      <ToastContainer />
      <h1 className="tw-text-3xl tw-font-semibold tw-mb-4 tw-text-center sm:tw-text-left">
        {t("meetings.title")}
      </h1>

      {isLoading ? (
        <div className="tw-flex tw-justify-center tw-items-center tw-h-48">
          <Spinner className="tw-h-8 tw-w-8" />
        </div>
      ) : !calendarConnected ? (
        <div className="tw-bg-white tw-rounded-2xl tw-p-8 tw-text-center tw-shadow-sm">
          <p className="tw-text-gray-700 tw-font-medium tw-mb-1">
            {t("meetings.noCalendarTitle")}
          </p>
          <p className="tw-text-sm tw-text-gray-500 tw-mb-4">
            {t("meetings.noCalendarHint")}
          </p>
          <a
            href="/settings?tab=calendar"
            className="tw-inline-block tw-bg-button tw-text-white tw-py-2 tw-px-5 tw-rounded-lg tw-text-sm"
          >
            {t("meetings.connectCalendarCta")}
          </a>
        </div>
      ) : meetings.length === 0 ? (
        <div className="tw-bg-white tw-rounded-2xl tw-p-8 tw-text-center tw-shadow-sm">
          <p className="tw-text-gray-700">{t("meetings.empty")}</p>
        </div>
      ) : (
        <div className="tw-space-y-6">
          {Object.entries(byDay).map(([day, dayMeetings]) => (
            <div key={day}>
              <h2 className="tw-text-sm tw-font-semibold tw-text-gray-500 tw-uppercase tw-mb-2">
                {day}
              </h2>
              <div className="tw-space-y-3">
                {dayMeetings.map((m) => {
                  const badge = statusBadge(m, t as any);
                  const time = new Date(m.startTime).toLocaleTimeString(
                    i18n.language,
                    { hour: "2-digit", minute: "2-digit" }
                  );
                  const content = openContent[m.calendarEventId];
                  const canGenerate = m.externalAttendees.length > 0;
                  return (
                    <div
                      key={m.calendarEventId}
                      className="tw-bg-white tw-rounded-2xl tw-p-5 tw-shadow-sm"
                    >
                      <div className="tw-flex tw-flex-col sm:tw-flex-row sm:tw-items-center tw-justify-between tw-gap-3">
                        <div>
                          <div className="tw-flex tw-items-center tw-gap-2">
                            <span className="tw-text-sm tw-font-semibold tw-text-gray-900">
                              {time}
                            </span>
                            <span className="tw-text-sm tw-text-gray-900">
                              {m.title || t("meetings.untitled")}
                            </span>
                          </div>
                          <p className="tw-text-xs tw-text-gray-500 tw-mt-0.5">
                            {m.externalAttendees.length > 0
                              ? m.externalAttendees.join(", ")
                              : t("meetings.internalOnly")}
                          </p>
                        </div>
                        <div className="tw-flex tw-items-center tw-gap-3">
                          <span className={badge.className}>{badge.label}</span>
                          {canGenerate && (
                            <button
                              onClick={() => generate(m.calendarEventId)}
                              disabled={busyEventId === m.calendarEventId}
                              className="tw-bg-[#5971F6] tw-text-white tw-rounded-xl tw-px-4 tw-py-2 tw-text-sm tw-font-semibold hover:tw-opacity-90 tw-transition-opacity disabled:tw-opacity-50"
                            >
                              {busyEventId === m.calendarEventId
                                ? t("meetings.generating")
                                : m.prep?.hasContent
                                  ? t("meetings.view")
                                  : t("meetings.prepareNow")}
                            </button>
                          )}
                        </div>
                      </div>
                      {content && (
                        <div className="tw-mt-4 tw-border-t tw-border-gray-100 tw-pt-4">
                          <PrepContentView content={content} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default authMiddleware(MeetingsPage);
