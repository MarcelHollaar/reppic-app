"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { getAuthHeaders } from "@/utils/getAuthHeaders";

/**
 * Chip-teksten in de taal van de gebruiker. De losstaande /desktop-chip.html is
 * statisch en kent i18next niet, dus de bridge (die wél binnen de
 * I18nextProvider draait) vertaalt de labels en stuurt ze mee over de
 * BroadcastChannel. We lezen de i18next-singleton rechtstreeks i.p.v. een
 * useTranslation-closure, zodat een taalwissel ná mount ook meteen doorwerkt.
 */
type ChipLabels = {
  title: string;
  subtitle: string;
  record: string;
  notNow: string;
  recording: string;
  stop: string;
};

const chipLabels = (): ChipLabels => ({
  title: i18n.t("desktopRecording.detectedTitle"),
  subtitle: i18n.t("desktopRecording.detectedSubtitle"),
  record: i18n.t("desktopRecording.record"),
  notNow: i18n.t("desktopRecording.notNow"),
  recording: i18n.t("desktopRecording.recording"),
  stop: i18n.t("desktopRecording.stop"),
});

/**
 * Desktop Recording SDK bridge (Recall.ai via ToDesktop).
 *
 * Mounted globally, but only becomes active when the app runs inside the
 * Reppic desktop shell (ToDesktop injects window.todesktop.recallDesktop).
 * In a normal browser this component renders nothing and does nothing.
 *
 * Flow: SDK detects a meeting -> (first time: consent prompt) -> fetch an
 * upload token from /api/recall/desktop-upload-token -> startRecording. When
 * the meeting ends the recording uploads to Recall, which calls our
 * /api/webhooks/recall-sdk webhook; from there the existing transcript ->
 * analysis -> dashboard pipeline takes over.
 */

/**
 * Legacy sleutel. Een eerdere versie onthield "ja" één keer en nam daarna élk
 * gedetecteerd gesprek automatisch op — verkeerd gedrag voor een opname-app, en
 * bovendien bleef die vlag na testen hangen waardoor de vraag oversloeg. De
 * vlag wordt nu bij het opstarten opgeruimd; toestemming wordt per gesprek
 * gevraagd.
 */
const LEGACY_CONSENT_STORAGE_KEY = "reppic_desktop_recording_consent";

type SdkClient = typeof import("@todesktop/client-recall").recallDesktop;
type TDCore = typeof import("@todesktop/client-core");
type TDRef = Awaited<ReturnType<TDCore["nativeWindow"]["create"]>>;

interface DetectedMeeting {
  id: string;
  platform?: string;
}

export default function DesktopRecordingBridge(): React.JSX.Element | null {
  const { t } = useTranslation();
  const sdkRef = useRef<SdkClient | null>(null);
  const [detectedMeeting, setDetectedMeeting] =
    useState<DetectedMeeting | null>(null);
  const [recordingWindowId, setRecordingWindowId] = useState<string | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const startRecordingFor = useCallback(async (windowId: string) => {
    const sdk = sdkRef.current;
    if (!sdk) return;

    setError(null);

    const headers = getAuthHeaders();
    if (!headers) {
      setError("Log eerst in om gesprekken op te nemen.");
      return;
    }

    try {
      const response = await fetch("/api/recall/desktop-upload-token", {
        method: "POST",
        headers,
      });

      if (!response.ok) {
        throw new Error(`Token request failed: ${response.status}`);
      }

      const { uploadToken } = await response.json();
      const result = await sdk.startRecording(windowId, uploadToken);

      if (!result.success) {
        throw new Error(result.message || "startRecording failed");
      }

      setDetectedMeeting(null);
    } catch (err) {
      console.error("[DesktopRecording] Failed to start recording:", err);
      setError("Opname starten is niet gelukt. Probeer het opnieuw.");
    }
  }, []);

  useEffect(() => {
    // Dit component hangt in de globale layout en is dus óók gemount in het
    // chip-venster (/desktop-chip.html). Dat is nu statische HTML zonder React,
    // dus dit is een vangnet: mocht de chip ooit een app-route worden, dan moet
    // de bridge daar slapend blijven,
    // anders initialiseert de SDK dubbel en opent het chip-venster zichzelf.
    if (window.location.pathname.startsWith("/desktop-chip")) return;

    // Ruim de oude "onthoud toestemming"-vlag op: die liet gesprekken zonder
    // vraag opnemen.
    try {
      localStorage.removeItem(LEGACY_CONSENT_STORAGE_KEY);
    } catch {
      /* localStorage kan geblokkeerd zijn; niet kritiek */
    }

    let unsubscribers: Array<() => void> = [];
    let cancelled = false;

    // ── Zwevende opname-chip ─────────────────────────────────────────────────
    // De verkoper zit tijdens een gesprek in het Meet/Teams/Zoom-venster, niet
    // in Reppic. De opnamevraag moet dus BOVEN de meeting verschijnen. Daarvoor
    // opent het hoofdvenster via ToDesktop's nativeWindow.create() (officieel
    // gedocumenteerd: accepteert Electron BrowserWindowConstructorOptions) een
    // klein venster met type:"panel" — per Electron-documentatie: "enables the
    // window to float on top of full-screened apps … will appear on all
    // spaces". Inhoud = onze /desktop-chip-pagina; communicatie via
    // BroadcastChannel (zelfde origin).
    let core: TDCore | null = null;
    let chipWin: TDRef | null = null;
    let chipCreating: Promise<void> | null = null;
    let channel: BroadcastChannel | null = null;
    // Bewust géén meeting-/platformnaam: één eenduidig venster voor alle
    // online meetings. (De SDK levert `title` bovendien vaak als null.)
    let chipState: {
      state: "prompt" | "recording" | "hidden";
    } = { state: "hidden" };
    let currentMeetingId: string | null = null;
    let currentRecordingId: string | null = null;

    const broadcast = () => {
      // Labels bij élke broadcast opnieuw uitlezen: dan volgt de chip de
      // actuele taal, ook als die na het laden van de bridge is gewijzigd.
      channel?.postMessage({ type: "state", ...chipState, labels: chipLabels() });
    };

    const ensureChipWindow = async () => {
      if (!core || chipWin || cancelled) return;
      if (!chipCreating) {
        const activeCore = core;
        chipCreating = (async () => {
          const isMac = navigator.userAgent.includes("Mac");
          const width = 360;
          const height = 200;
          const screenInfo = window.screen as unknown as {
            availLeft?: number;
            availTop?: number;
            availWidth: number;
          };
          const x = (screenInfo.availLeft ?? 0) + screenInfo.availWidth - width - 16;
          const y = (screenInfo.availTop ?? 0) + 16;

          const options = {
            width,
            height,
            x,
            y,
            frame: false,
            transparent: true,
            resizable: false,
            // Wél verplaatsbaar (standaard true, expliciet gemaakt): de chip is
            // via app-region:drag sleepbaar zodat de gebruiker hem kan wegslepen
            // als hij knoppen in de meeting overlapt.
            movable: true,
            hasShadow: false,
            skipTaskbar: true,
            fullscreenable: false,
            alwaysOnTop: true,
            show: false,
            // macOS: "panel" zweeft boven fullscreen-apps en verschijnt op alle
            // Spaces (Electron-documentatie). Op Windows volstaat alwaysOnTop;
            // focusable:false voorkomt daar focus-diefstal van de meeting.
            ...(isMac ? { type: "panel" } : { focusable: false }),
          };

          const ref = await activeCore.nativeWindow.create(
            options as Parameters<typeof activeCore.nativeWindow.create>[0],
          );
          const wcRef = await activeCore.nativeWindow.getWebContents({ ref });
          await activeCore.webContents.loadURL(
            { ref: wcRef },
            // Losstaand HTML-bestand uit /public: een Next-route zou de hele
            // app-schil (navigatie, providers) meekrijgen en er dan uitzien als
            // een samengeperste homepage.
            `${window.location.origin}/desktop-chip.html`,
          );
          // Hoogste vensterlaag (gedocumenteerde methode) zodat de chip ook
          // boven een gemaximaliseerde meeting blijft.
          try {
            await activeCore.nativeWindow.setAlwaysOnTop(
              { ref },
              true,
              "screen-saver",
            );
          } catch {
            /* alwaysOnTop uit de constructor blijft dan gelden */
          }
          chipWin = ref;
        })();
      }
      await chipCreating;
    };

    const showChip = async (state: "prompt" | "recording") => {
      chipState = { state };
      broadcast();
      try {
        await ensureChipWindow();
        if (!core || !chipWin || cancelled) return;
        // showInactive: tonen ZONDER focus van de meeting af te pakken
        // (gedocumenteerde methode, zelfde aanpak als de test-shell).
        await core.nativeWindow.showInactive({ ref: chipWin });
        broadcast();
      } catch (err) {
        console.error("[DesktopRecording] Chip-venster tonen mislukt:", err);
      }
    };

    const hideChip = async () => {
      chipState = { state: "hidden" };
      broadcast();
      try {
        if (core && chipWin) {
          await core.nativeWindow.hide({ ref: chipWin });
        }
      } catch {
        /* verbergen is best-effort */
      }
    };

    (async () => {
      // Dynamic import: the SDK client touches `window` at module scope, so it
      // must never be imported during SSR.
      const { recallDesktop } = await import("@todesktop/client-recall");

      // Normal browser (no ToDesktop shell): stay dormant.
      //
      // Do NOT call isAvailable() unguarded. The client injected by
      // @todesktop/plugin-recall (v1.3.x) does not expose that method, so the
      // call threw a TypeError that killed this whole initialiser silently:
      // no initSdk, no meeting-detected listener, no logs — meetings were
      // simply never detected. Probe the injected ToDesktop bridge instead and
      // only use isAvailable() when a client version actually provides it.
      const maybeIsAvailable = (
        recallDesktop as unknown as { isAvailable?: () => boolean }
      ).isAvailable;
      const available =
        typeof maybeIsAvailable === "function"
          ? maybeIsAvailable.call(recallDesktop)
          : Boolean(
              (window as unknown as { todesktop?: { recallDesktop?: unknown } })
                ?.todesktop?.recallDesktop,
            );

      if (cancelled || !available) return;

      sdkRef.current = recallDesktop;

      // client-core levert nativeWindow/webContents voor het chip-venster.
      try {
        core = await import("@todesktop/client-core");
      } catch (err) {
        console.warn(
          "[DesktopRecording] @todesktop/client-core niet beschikbaar — opnamevraag valt terug op het app-venster:",
          err,
        );
      }

      // Luister naar de knoppen in het chip-venster.
      channel = new BroadcastChannel("reppic-desktop-recording");
      channel.onmessage = (event) => {
        const msg = event.data as
          | { type: "chip-ready" }
          | { type: "action"; action: "record" | "dismiss" | "stop" }
          | undefined;
        if (!msg) return;

        if (msg.type === "chip-ready") {
          broadcast();
          return;
        }
        if (msg.type !== "action") return;

        if (msg.action === "record" && currentMeetingId) {
          setDetectedMeeting(null);
          void startRecordingFor(currentMeetingId);
        } else if (msg.action === "dismiss") {
          setDetectedMeeting(null);
          void hideChip();
        } else if (msg.action === "stop" && currentRecordingId) {
          void sdkRef.current
            ?.stopRecording(currentRecordingId)
            .catch((err: unknown) =>
              console.error("[DesktopRecording] Stop mislukt:", err),
            );
        }
      };

      try {
        await recallDesktop.initSdk();
        console.log(
          "[DesktopRecording] SDK geïnitialiseerd — wacht op meeting-detectie.",
        );
      } catch (err) {
        console.error("[DesktopRecording] SDK init failed:", err);
        return;
      }

      // Chip-venster alvast verborgen klaarzetten, zodat hij bij een meeting
      // direct kan verschijnen (aanmaken kost anders ~1s op het moment zelf).
      void ensureChipWindow().catch((err) =>
        console.error("[DesktopRecording] Chip-venster aanmaken mislukt:", err),
      );

      unsubscribers.push(
        recallDesktop.addEventListener("meeting-detected", ({ window }) => {
          console.log("[DesktopRecording] meeting-detected:", window);
          currentMeetingId = window.id;

          // ELK gesprek vraagt opnieuw om toestemming. Bewust géén
          // "onthoud mijn keuze": niet elk gedetecteerd gesprek is een
          // salesgesprek (intern overleg, privé), en bij een opname-app moet de
          // gebruiker per gesprek kunnen zien dát er opgenomen wordt en kunnen
          // weigeren. Automatisch starten is hier het verkeerde gedrag.
          setDetectedMeeting({
            id: window.id,
            platform: window.platform,
          });
          // De opnamevraag BOVEN de meeting — daar zit de verkoper.
          void showChip("prompt");
        }),

        recallDesktop.addEventListener("recording-started", ({ window }) => {
          currentRecordingId = window.id;
          setRecordingWindowId(window.id);
          void showChip("recording");
        }),

        recallDesktop.addEventListener("recording-ended", () => {
          currentRecordingId = null;
          setRecordingWindowId(null);
          void hideChip();
        }),

        recallDesktop.addEventListener("meeting-closed", () => {
          currentMeetingId = null;
          setDetectedMeeting(null);
          void hideChip();
        })
      );
    })().catch((err) => {
      // Never let this initialiser die silently again — that is exactly how the
      // isAvailable() TypeError stayed invisible.
      console.error("[DesktopRecording] Initialisatie mislukt:", err);
    });

    return () => {
      cancelled = true;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      unsubscribers = [];
      channel?.close();
      channel = null;
      if (core && chipWin) {
        void core.nativeWindow.destroy({ ref: chipWin }).catch(() => {
          /* opruimen is best-effort */
        });
        chipWin = null;
      }
    };
  }, [startRecordingFor]);

  const handleConsentAndRecord = () => {
    if (!detectedMeeting) return;
    void startRecordingFor(detectedMeeting.id);
  };

  const handleDismiss = () => {
    setDetectedMeeting(null);
    setError(null);
  };

  const handleStop = async () => {
    const sdk = sdkRef.current;
    if (!sdk || !recordingWindowId) return;
    try {
      await sdk.stopRecording(recordingWindowId);
    } catch (err) {
      console.error("[DesktopRecording] Failed to stop recording:", err);
    }
  };

  // Nothing to show: dormant (browser), or desktop shell without activity.
  if (!detectedMeeting && !recordingWindowId && !error) return null;

  // NB: deze app draait Tailwind met prefix "tw-" (tailwind.config regel 24).
  // De oorspronkelijke, kale klassen (fixed/bottom-6/…) werden dus nooit
  // gegenereerd, waardoor dit paneel ongestyled en feitelijk onzichtbaar
  // rendere — de opnamevraag leek "niet te verschijnen" terwijl
  // meeting-detected wél vuurde.
  return (
    <div className="tw-fixed tw-bottom-6 tw-left-6 tw-z-[9998] tw-max-w-sm">
      {recordingWindowId ? (
        <div className="tw-flex tw-items-center tw-gap-3 tw-rounded-lg tw-bg-gray-900 tw-px-4 tw-py-3 tw-text-white tw-shadow-lg">
          <span className="tw-relative tw-flex tw-h-3 tw-w-3">
            <span className="tw-absolute tw-inline-flex tw-h-full tw-w-full tw-animate-ping tw-rounded-full tw-bg-red-400 tw-opacity-75" />
            <span className="tw-relative tw-inline-flex tw-h-3 tw-w-3 tw-rounded-full tw-bg-red-500" />
          </span>
          <span className="tw-text-sm tw-font-medium">{t("desktopRecording.recording")}</span>
          <button
            onClick={handleStop}
            className="tw-ml-2 tw-rounded tw-bg-white/10 tw-px-3 tw-py-1 tw-text-xs tw-font-semibold hover:tw-bg-white/20"
          >
            {t("desktopRecording.stop")}
          </button>
        </div>
      ) : detectedMeeting ? (
        <div className="tw-rounded-lg tw-bg-white tw-p-4 tw-shadow-xl tw-ring-1 tw-ring-black/10">
          <p className="tw-text-sm tw-font-semibold tw-text-gray-900">
            {t("desktopRecording.detectedTitle")}
          </p>
          <p className="tw-mt-1 tw-text-xs tw-text-gray-600">
            {t("desktopRecording.detectedSubtitle")}
          </p>
          <div className="tw-mt-3 tw-flex tw-gap-2">
            <button
              onClick={handleConsentAndRecord}
              className="tw-rounded tw-bg-gray-900 tw-px-3 tw-py-1.5 tw-text-xs tw-font-semibold tw-text-white hover:tw-bg-gray-700"
            >
              {t("desktopRecording.record")}
            </button>
            <button
              onClick={handleDismiss}
              className="tw-rounded tw-bg-gray-100 tw-px-3 tw-py-1.5 tw-text-xs tw-font-semibold tw-text-gray-700 hover:tw-bg-gray-200"
            >
              {t("desktopRecording.notNow")}
            </button>
          </div>
        </div>
      ) : null}

      {error && (
        <div className="tw-mt-2 tw-rounded-lg tw-bg-red-50 tw-px-4 tw-py-2 tw-text-xs tw-text-red-700 tw-shadow tw-ring-1 tw-ring-red-200">
          {error}
          <button onClick={handleDismiss} className="tw-ml-2 tw-font-semibold tw-underline">
            Sluiten
          </button>
        </div>
      )}
    </div>
  );
}
