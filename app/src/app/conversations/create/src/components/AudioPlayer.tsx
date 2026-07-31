import React, { useState, useRef, useEffect } from "react";

interface AudioPlayerProps {
  sourceFileUrl: string | null;
  recordingTime?: number;
  isAudioLoading?: boolean;
  onPlayRecording: () => Promise<void> | undefined;
  fullRecordingTime?: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  sourceFileUrl,
  recordingTime = 0,
  isAudioLoading = false,
  onPlayRecording,
  fullRecordingTime = "00:00:00",
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(recordingTime);
  const [isLoading, setIsLoading] = useState(isAudioLoading);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [playAudioOnceAvailable, setPlayAudioOnceAvailable] = useState(false);

  useEffect(() => {
    if (recordingTime) {
      setDuration(recordingTime);
    }
  }, [recordingTime]);

  useEffect(() => {
    setIsLoading(isAudioLoading);
  }, [isAudioLoading]);

  useEffect(() => {
    if (sourceFileUrl && playAudioOnceAvailable && audioRef.current) {
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          setIsLoading(false);
          setPlayAudioOnceAvailable(false);
        })
        .catch((error) => {
          console.error("Error playing audio:", error);
          setIsLoading(false);
          setPlayAudioOnceAvailable(false);
        });
    }
  }, [sourceFileUrl, playAudioOnceAvailable]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const audioDuration = audioRef.current.duration;
      if (isFinite(audioDuration) && audioDuration > 0) {
        setDuration(audioDuration);
      }
    }
    setIsLoading(false);
  };

  const togglePlayPause = async () => {
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }

    if (sourceFileUrl && audioRef.current) {
      setIsLoading(true);
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          setIsLoading(false);
        })
        .catch((error) => {
          console.error("Error playing audio:", error);
          setIsLoading(false);
        });
    } else {
      setIsLoading(true);
      setPlayAudioOnceAvailable(true);
      isAudioLoading = true;
      await onPlayRecording();
    }
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !progressBarRef.current) return;

    if (!duration || !isFinite(duration) || duration <= 0) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = percentage * duration;

    if (isFinite(newTime)) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const progress =
    duration > 0 && isFinite(duration) ? (currentTime / duration) * 100 : 0;

  const canSeek = duration > 0 && isFinite(duration);

  return (
    <div className="tw-mt-6 tw-bg-white tw-rounded-2xl tw-p-4 tw-shadow-sm tw-border tw-border-gray-100">
      <div className="tw-flex tw-items-center tw-gap-4">
        {sourceFileUrl && (
          <audio
            ref={audioRef}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            preload="metadata"
          >
            <source
              src={`${sourceFileUrl}?t=${Date.now()}`}
              type="audio/webm"
            />
            <source
              src={`${sourceFileUrl}?t=${Date.now()}`}
              type="audio/mpeg"
            />
            Your browser does not support the audio element.
          </audio>
        )}

        {/* Play/Pause Button */}
        <button
          onClick={togglePlayPause}
          disabled={isLoading}
          className="tw-bg-blue-600 tw-text-white tw-rounded-full tw-w-12 tw-h-12 tw-flex tw-items-center tw-justify-center hover:tw-bg-blue-700 active:tw-bg-blue-800 tw-transition-all tw-duration-200 tw-shadow-md hover:tw-shadow-lg disabled:tw-opacity-50 disabled:tw-cursor-not-allowed tw-flex-shrink-0"
        >
          {isLoading && (
            <div className="tw-relative tw-w-6 tw-h-6">
              <div className="tw-absolute tw-inset-0 tw-rounded-full tw-border-2 tw-border-white/30"></div>
              <div className="tw-absolute tw-inset-0 tw-rounded-full tw-border-2 tw-border-white tw-border-t-transparent tw-animate-spin"></div>
            </div>
          )}
          {isPlaying && !isLoading && (
            <svg
              className="tw-h-5 tw-w-5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M5 4a1 1 0 011 1v10a1 1 0 11-2 0V5a1 1 0 011-1zm9 0a1 1 0 011 1v10a1 1 0 11-2 0V5a1 1 0 011-1z"
                clipRule="evenodd"
              />
            </svg>
          )}
          {!isPlaying && !isLoading && (
            <svg
              className="tw-h-5 tw-w-5 tw-ml-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
            </svg>
          )}
        </button>

        {/* Progress Bar and Time */}
        <div className="tw-flex-1 tw-flex tw-items-center tw-gap-3">
          <span className="tw-text-gray-600 tw-font-mono tw-text-sm tw-tabular-nums tw-min-w-[3rem]">
            {formatTime(currentTime)}
          </span>

          <div
            ref={progressBarRef}
            onClick={handleProgressBarClick}
            className={`tw-flex-1 tw-h-2 tw-bg-gray-200 tw-rounded-full tw-relative tw-group tw-transition-all tw-duration-200 ${
              canSeek
                ? "tw-cursor-pointer hover:tw-h-3"
                : "tw-cursor-not-allowed tw-opacity-50"
            }`}
          >
            {/* Progress Fill */}
            <div
              className="tw-h-full tw-bg-gradient-to-r tw-from-blue-500 tw-to-blue-600 tw-rounded-full tw-transition-all tw-duration-100"
              style={{ width: `${progress}%` }}
            />

            {/* Scrubber Dot */}
            {canSeek && (
              <div
                className="tw-absolute tw-top-1/2 tw-w-4 tw-h-4 tw-bg-blue-600 tw-border-2 tw-border-white tw-rounded-full tw-shadow-md tw-transition-all tw-duration-100 tw-opacity-0 group-hover:tw-opacity-100 group-hover:tw-scale-110"
                style={{
                  left: `${progress}%`,
                  transform: "translate(-50%, -50%)",
                }}
              />
            )}
          </div>

          <span className="tw-text-gray-600 tw-font-mono tw-text-sm tw-tabular-nums tw-min-w-[3rem] tw-text-right">
            {fullRecordingTime}
          </span>
        </div>
      </div>
    </div>
  );
};

export default AudioPlayer;
