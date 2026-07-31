import { t } from "i18next";
import { useEffect, useState } from "react";
import moment from "moment";
import { toast } from "react-toastify";
import AudioPlayer from "./AudioPlayer";
import { useAudioRecorderContext } from "@/context/AudioRecorderContext";
import { useWakeLock } from "react-screen-wake-lock";

interface AudioRecorderProps {
  onStopRecording: () => Promise<void> | undefined;
  onPlayRecording: () => Promise<void> | undefined;
  onDeleteRecording: () => Promise<void> | undefined;
  onSendChunk: (chunk: Blob) => Promise<void> | undefined;
  onAudioDataAvailable: (chunk: Blob, mediaRecorder: MediaRecorder) => void;
  onChunkTriggerTime: number;
  sourceFileUrl?: string | null;
  isAudioLoading?: boolean;
  hasInitialRecording?: boolean;
  hasInitialDuration?: number;
  isDraftSubmitting?: boolean;
  hideDeleteRecordingButton?: boolean;
}

const AudioRecorder = ({
  onAudioDataAvailable,
  onChunkTriggerTime,
  hasInitialRecording = false,
  hasInitialDuration = 0,
  onStopRecording,
  onPlayRecording,
  onDeleteRecording,
  onSendChunk,
  sourceFileUrl,
  isAudioLoading = false,
  isDraftSubmitting = false,
  hideDeleteRecordingButton = false,
}: AudioRecorderProps) => {
  const { isRecording, setIsRecording } = useAudioRecorderContext();
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(hasInitialDuration);
  const [hasRecording, setHasRecording] = useState(hasInitialRecording);
  const [chunks, setChunks] = useState<Blob[]>([]);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(
    null
  );
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(
    null
  );

  const { request: requestWakeLock, release: releaseWakeLock } = useWakeLock();

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [timerInterval]);

  useEffect(() => {
    if (hasInitialDuration) {
      setRecordingTime(hasInitialDuration);
    }
  }, [hasInitialDuration]);

  useEffect(() => {
    if (hasInitialRecording) {
      setHasRecording(hasInitialRecording);
    }
  }, [hasInitialRecording]);

  // Format time as HH:MM:SS
  const formatTime = (seconds: number): string => {
    return moment.utc(seconds * 1000).format("HH:mm:ss");
  };

  // Start timer
  const startTimer = () => {
    const interval = setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);
    setTimerInterval(interval);
  };

  // Stop timer
  const stopTimer = () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
  };

  const startRecording = async () => {
    // Browser can't do audio capture at all (insecure context / unsupported).
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error(t("audioRecorder.micUnsupported"));
      return;
    }

    // Acquire the microphone FIRST. Only flip into the "recording" state once we
    // actually have a stream, and surface a clear error (instead of silently
    // failing and only complaining "no recording available" on submit).
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err: any) {
      console.error("Error accessing audio devices:", err);
      setIsRecording(false);
      const name = err?.name;
      if (name === "NotAllowedError" || name === "SecurityError") {
        toast.error(t("audioRecorder.micDenied"));
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        toast.error(t("audioRecorder.micNotFound"));
      } else {
        toast.error(t("audioRecorder.micError"));
      }
      return;
    }

    try {
      setIsRecording(true);
      const recorder = new MediaRecorder(stream);

      // Inline handler with closure over current state
      recorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          const chunk = event.data;

          setChunks((prevChunks) => [...prevChunks, chunk]);
          onAudioDataAvailable(chunk, recorder);

          await onChunk(chunk);
        }
      };

      recorder.onstop = () => {
        // Stop all tracks to release microphone
        stream.getTracks().forEach((track) => track.stop());
      };

      setMediaRecorder(recorder);

      recorder.start(onChunkTriggerTime);

      setIsPaused(false);
      setRecordingTime(0);
      startTimer();
      requestWakeLock();
    } catch (err) {
      console.error("Error starting recorder:", err);
      setIsRecording(false);
      stream.getTracks().forEach((track) => track.stop());
      toast.error(t("audioRecorder.micError"));
    }
  };

  const pauseRecording = () => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.pause();
      setIsPaused(true);
      stopTimer();
    }
  };

  const resumeRecording = () => {
    if (mediaRecorder && mediaRecorder.state === "paused") {
      mediaRecorder.resume();
      setIsPaused(false);
      startTimer();
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
    }

    setIsRecording(false);
    setIsPaused(false);
    setHasRecording(chunks.length > 0);
    stopTimer();
    onStopRecording();
    releaseWakeLock();
  };

  const onChunk = async (chunk: Blob) => {
    await onSendChunk(chunk);
  };

  const handleDeleteRecording = async () => {
    const result = await confirm(
      "Are you sure you want to delete this recording?"
    );

    if (!result) {
      return;
    }

    await onDeleteRecording();

    setHasRecording(false);
    setChunks([]);
    setRecordingTime(0);
  };

  return (
    <div className="tw-p-0">
      <div className="tw-bg-gradient-to-br tw-from-gray-50 tw-to-gray-100 tw-rounded-3xl tw-px-6 tw-py-8 tw-shadow-sm tw-border tw-border-gray-200/50 tw-w-full md:tw-my-2 md:tw-mb-5">
        {/* Main Layout */}

        <div
          className={`tw-flex ${
            hasRecording && !isRecording && !isPaused
              ? "tw-flex-row tw-items-start tw-gap-0"
              : "tw-flex-col tw-gap-5"
          } md:tw-flex-row tw-justify-between`}
        >
          {/* Left Side: Title, Status, Timer */}
          <div
            className={`tw-flex tw-flex-col tw-gap-2 ${
              hasRecording && !isRecording && !isPaused
                ? "tw-text-start"
                : "tw-text-center"
            } md:tw-text-left`}
          >
            <h2 className="tw-font-semibold tw-text-xl tw-text-gray-900">
              Audio Recording
            </h2>

            <p
              className={`tw-font-normal ${
                hasRecording && !isRecording && !isPaused
                  ? "tw-text-green-900"
                  : "tw-text-gray-900"
              } tw-text-md lg:tw-text-lg`}
            >
              {isRecording &&
                !isPaused &&
                t("audioRecorder.clickPauseRecording")}
              {isPaused && t("audioRecorder.clickResumeRecording")}
              {!isRecording &&
                hasRecording &&
                t("audioRecorder.recordingCompleted")}
              {!isRecording &&
                !hasRecording &&
                t("audioRecorder.clickStartRecording")}
            </p>

            <div
              className={`tw-text-5xl tw-font-bold tw-font-mono tw-tracking-wider tw-tabular-nums tw-transition-colors tw-duration-300 ${
                isRecording && !isPaused
                  ? "tw-text-red-600"
                  : isPaused
                  ? "tw-text-orange-500"
                  : "tw-text-gray-800"
              }`}
            >
              {formatTime(recordingTime)}
            </div>
          </div>

          {/* Right Side: Buttons */}
          <div className="tw-flex tw-justify-center md:tw-items-start">
            {/* Start Recording Button */}
            {!isRecording &&
              !hasRecording &&
              !isAudioLoading &&
              !isDraftSubmitting && (
                <button
                  onClick={startRecording}
                  className="tw-rounded-full tw-flex tw-items-center tw-gap-2.5 tw-px-6 tw-py-3 tw-bg-blue-600 hover:tw-bg-blue-700 active:tw-bg-blue-800 tw-text-white tw-shadow-lg hover:tw-shadow-xl tw-transition-all tw-duration-200 tw-font-medium"
                >
                  <svg
                    className="tw-h-5 tw-w-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Start Recording
                </button>
              )}

            {/* Recording: Pause and Stop */}
            {isRecording && !isPaused && (
              <div className="tw-flex tw-gap-3 tw-flex-col md:tw-flex-row">
                <button
                  onClick={pauseRecording}
                  className="tw-bg-amber-400 hover:tw-bg-amber-500 active:tw-bg-amber-600 tw-flex tw-items-center tw-justify-center tw-gap-2 tw-px-6 tw-py-3 tw-text-amber-900 tw-rounded-full tw-shadow-md hover:tw-shadow-lg tw-transition-all tw-duration-200 tw-font-medium"
                >
                  <svg
                    className="tw-h-4 tw-w-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Pause
                </button>
                <button
                  onClick={stopRecording}
                  className="tw-bg-red-500 hover:tw-bg-red-600 active:tw-bg-red-700 tw-flex tw-items-center tw-justify-center tw-gap-2 tw-px-6 tw-py-3 tw-text-white tw-rounded-full tw-shadow-md hover:tw-shadow-lg tw-transition-all tw-duration-200 tw-font-medium"
                >
                  <svg
                    className="tw-h-4 tw-w-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Stop
                </button>
              </div>
            )}

            {/* Paused: Resume and Stop */}
            {isPaused && (
              <div className="tw-flex tw-gap-3 tw-flex-col md:tw-flex-row">
                <button
                  onClick={resumeRecording}
                  className="tw-bg-green-500 hover:tw-bg-green-600 active:tw-bg-green-700 tw-text-white tw-flex tw-items-center tw-justify-center tw-gap-2 tw-rounded-full tw-px-6 tw-py-3 tw-shadow-md hover:tw-shadow-lg tw-transition-all tw-duration-200 tw-font-medium tw-animate-pulse"
                >
                  <svg
                    className="tw-h-4 tw-w-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Resume
                </button>
                <button
                  onClick={stopRecording}
                  className="tw-bg-red-500 hover:tw-bg-red-600 active:tw-bg-red-700 tw-flex tw-items-center tw-justify-center tw-gap-2 tw-px-6 tw-py-3 tw-text-white tw-rounded-full tw-shadow-md hover:tw-shadow-lg tw-transition-all tw-duration-200 tw-font-medium"
                >
                  <svg
                    className="tw-h-4 tw-w-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Stop
                </button>
              </div>
            )}

            {/* Completed: Delete Button */}
            {hasRecording &&
              !isRecording &&
              !isPaused &&
              !hideDeleteRecordingButton && (
                <div className="tw-flex tw-items-center tw-gap-2">
                  <button
                    className="tw-bg-red-100 tw-p-3 tw-rounded-full hover:tw-bg-red-500 tw-group tw-transition-all tw-duration-200 tw-shadow-sm hover:tw-shadow-md"
                    onClick={handleDeleteRecording}
                  >
                    <svg
                      className="tw-h-5 tw-w-5 tw-text-red-500 group-hover:tw-text-white tw-transition-colors tw-duration-200"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              )}
          </div>
        </div>

        {/* Status Indicators */}
        {isRecording && !isPaused && (
          <div className="tw-mt-6 tw-flex tw-items-center tw-justify-center tw-gap-3 tw-bg-red-50 tw-py-3 tw-px-5 tw-rounded-full tw-mx-auto tw-w-fit">
            <div className="tw-relative tw-flex tw-h-3 tw-w-3">
              <span className="tw-animate-ping tw-absolute tw-inline-flex tw-h-full tw-w-full tw-rounded-full tw-bg-red-400 tw-opacity-75"></span>
              <span className="tw-relative tw-inline-flex tw-rounded-full tw-h-3 tw-w-3 tw-bg-red-500"></span>
            </div>
            <span className="tw-text-sm tw-font-semibold tw-text-red-600">
              Recording in progress...
            </span>
          </div>
        )}

        {isPaused && (
          <div className="tw-mt-6 tw-flex tw-items-center tw-justify-center tw-gap-3 tw-bg-orange-50 tw-py-3 tw-px-5 tw-rounded-full tw-mx-auto tw-w-fit">
            <div className="tw-w-3 tw-h-3 tw-bg-orange-500 tw-rounded-full tw-animate-pulse"></div>
            <span className="tw-text-sm tw-font-semibold tw-text-orange-600">
              Recording paused
            </span>
          </div>
        )}

        {isAudioLoading && (
          <div className="tw-mt-6 tw-flex tw-flex-col tw-items-center tw-justify-center tw-gap-3">
            <div className="tw-relative tw-w-10 tw-h-10">
              <div className="tw-absolute tw-inset-0 tw-rounded-full tw-border-2 tw-border-blue-200"></div>
              <div className="tw-absolute tw-inset-0 tw-rounded-full tw-border-2 tw-border-blue-600 tw-border-t-transparent tw-animate-spin"></div>
            </div>
            <span className="tw-text-sm tw-font-medium tw-text-gray-600">
              Processing audio...
            </span>
          </div>
        )}

        {/* Audio Player for completed recording */}
        {!isAudioLoading && hasRecording && !isRecording && !isPaused && (
          <AudioPlayer
            sourceFileUrl={sourceFileUrl || null}
            recordingTime={recordingTime}
            isAudioLoading={isAudioLoading}
            onPlayRecording={onPlayRecording}
            fullRecordingTime={formatTime(recordingTime)}
          />
        )}
      </div>
    </div>
  );
};

export default AudioRecorder;
