import moment from "moment-timezone";

// Per-verkoper timing van de gespreksvoorbereiding. Pure functies zodat de
// vensterlogica unit-testbaar is los van de cron.
//
// Modes:
// - "24h"     (default): prep ~24 uur vóór de afspraak → venster [now+23u, now+25u]
// - "custom"  X uur vóór de afspraak (1-72)            → venster [now+X-1u, now+X+1u]
// - "morning" 's ochtends alle afspraken van de dag: alleen in de cron-run
//   waarin de lokale tijd van de verkoper in [06:00, 07:00) valt → venster
//   [now, einde lokale dag]; in alle andere runs wordt de verkoper
//   overgeslagen (null). Dedupe op calendar_event_id vangt overlap tussen
//   runs af.

export const DEFAULT_TIMEZONE = "Europe/Amsterdam";
export const MORNING_LOCAL_HOUR = 6;
const MIN_HOURS_BEFORE = 1;
const MAX_HOURS_BEFORE = 72;

export type PrepTimingMode = "24h" | "morning" | "custom";

export interface MeetingPrepSetting {
  mode: PrepTimingMode;
  hoursBefore: number;
  timezone: string;
}

/** Normaliseert de (mogelijk ontbrekende/corrupte) JSON-voorkeur. */
export function parseMeetingPrepSetting(raw: unknown): MeetingPrepSetting {
  const data = (raw ?? {}) as Record<string, unknown>;
  const mode: PrepTimingMode =
    data.mode === "morning" || data.mode === "custom" ? data.mode : "24h";

  let hoursBefore = Number(data.hoursBefore);
  if (!Number.isFinite(hoursBefore)) hoursBefore = 24;
  hoursBefore = Math.min(
    MAX_HOURS_BEFORE,
    Math.max(MIN_HOURS_BEFORE, Math.round(hoursBefore))
  );

  const tzRaw = typeof data.timezone === "string" ? data.timezone : "";
  const timezone = moment.tz.zone(tzRaw) ? tzRaw : DEFAULT_TIMEZONE;

  return { mode, hoursBefore, timezone };
}

export interface PrepWindow {
  start: Date;
  end: Date;
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * Berekent het zoekvenster voor aankomende afspraken voor deze verkoper in
 * déze cron-run. `null` = verkoper in deze run overslaan (morning-mode
 * buiten het ochtenduur).
 */
export function computePrepWindow(
  setting: MeetingPrepSetting,
  now: Date
): PrepWindow | null {
  switch (setting.mode) {
    case "morning": {
      const local = moment.tz(now, setting.timezone);
      if (local.hour() !== MORNING_LOCAL_HOUR) return null;
      return { start: now, end: local.clone().endOf("day").toDate() };
    }
    case "custom": {
      const h = setting.hoursBefore;
      return {
        start: new Date(now.getTime() + (h - 1) * HOUR_MS),
        end: new Date(now.getTime() + (h + 1) * HOUR_MS),
      };
    }
    case "24h":
    default:
      return {
        start: new Date(now.getTime() + 23 * HOUR_MS),
        end: new Date(now.getTime() + 25 * HOUR_MS),
      };
  }
}
