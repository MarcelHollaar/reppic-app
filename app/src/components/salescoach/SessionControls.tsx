"use client";
import React from "react";
import { Play, PauseCircle, Mic, MicOff, Square } from "lucide-react";

export default function SessionControls({
  isSessionActive,
  isSpeaking,
  isMuted,
  onConnect,
  onStop,
  onInterrupt,
  onToggleMute,
  disabled,
}: {
  isSessionActive: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  onConnect: () => void;
  onStop: () => void;
  onInterrupt: () => void;
  onToggleMute: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="tw-flex tw-flex-wrap tw-gap-3 tw-items-center">
      {!isSessionActive ? (
        <button
          type="button"
          onClick={onConnect}
          disabled={disabled}
          className={`tw-inline-flex tw-items-center tw-gap-2 tw-px-5 tw-py-2.5 tw-rounded-lg tw-text-white tw-font-medium ${
            disabled ? "tw-bg-blue-300 tw-cursor-not-allowed" : "tw-bg-blue-600 hover:tw-bg-blue-700"
          }`}
        >
          <Play className="tw-h-4 tw-w-4" />
          <span>Start Training session</span>
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={onStop}
            className="tw-inline-flex tw-items-center tw-gap-2 tw-px-5 tw-py-2.5 tw-rounded-lg tw-font-medium tw-bg-red-600 hover:tw-bg-red-700 tw-text-white"
          >
            <Square className="tw-h-4 tw-w-4" />
            <span>Stop Session</span>
          </button>

          <button
            type="button"
            onClick={onInterrupt}
            disabled={!isSpeaking}
            className={`tw-inline-flex tw-items-center tw-gap-2 tw-px-5 tw-py-2.5 tw-rounded-lg tw-font-medium ${
              isSpeaking
                ? "tw-bg-blue-gray-100 hover:tw-bg-blue-gray-200 tw-text-blue-gray-900"
                : "tw-bg-blue-gray-100 tw-text-blue-gray-400 tw-cursor-not-allowed"
            }`}
          >
            <PauseCircle className="tw-h-4 tw-w-4" />
            <span>Interrupt</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            className={`tw-inline-flex tw-items-center tw-gap-2 tw-px-5 tw-py-2.5 tw-rounded-lg tw-font-medium ${
              isMuted ? "tw-bg-blue-gray-100 tw-text-blue-gray-900" : "tw-bg-blue-gray-100 tw-text-blue-gray-900"
            }`}
          >
            {isMuted ? <MicOff className="tw-h-4 tw-w-4" /> : <Mic className="tw-h-4 tw-w-4" />}
            <span>{isMuted ? "Unmute" : "Mute"}</span>
          </button>
        </>
      )}
    </div>
  );
}
