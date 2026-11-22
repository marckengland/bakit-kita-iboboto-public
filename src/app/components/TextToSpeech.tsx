/**
 * Text-to-Speech Component
 *
 * Provides TTS controls for content sections with play/pause/stop buttons,
 * voice selection, and speech rate controls.
 * Implements screen reader compatibility with proper ARIA labels.
 *
 * Requirements: 27.2, 27.3, 27.7
 */

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useTTS } from "@/hooks/useTTS";
import { useTranslations } from "next-intl";

interface TextToSpeechProps {
  /** Text content to be read aloud */
  text: string;
  /** Optional label for the content being read */
  contentLabel?: string;
  /** Variant style: inline (compact), floating (fixed position), or full (with all controls) */
  variant?: "inline" | "floating" | "full";
  /** Additional CSS classes */
  className?: string;
  /** Whether to prefer Filipino voices */
  preferFilipino?: boolean;
  /** Callback when speech starts */
  onStart?: () => void;
  /** Callback when speech ends */
  onEnd?: () => void;
  /** Callback on error */
  onError?: (error: string) => void;
}

export function TextToSpeech({
  text,
  contentLabel,
  variant = "inline",
  className = "",
  preferFilipino = true,
  onStart,
  onEnd,
  onError,
}: TextToSpeechProps) {
  const t = useTranslations("tts");
  const {
    isSupported,
    isPlaying,
    isPaused,
    rate,
    volume,
    selectedVoice,
    availableVoices,
    error,
    speak,
    pause,
    resume,
    stop,
    setRate,
    setVolume,
    setVoice,
  } = useTTS(preferFilipino);

  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Handle callbacks
  useEffect(() => {
    if (isPlaying && !isPaused && onStart) {
      onStart();
    }
  }, [isPlaying, isPaused, onStart]);

  useEffect(() => {
    if (!isPlaying && !isPaused && onEnd) {
      onEnd();
    }
  }, [isPlaying, isPaused, onEnd]);

  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  // Close settings when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handlePlayPause = useCallback(() => {
    if (isPlaying && !isPaused) {
      pause();
    } else if (isPaused) {
      resume();
    } else {
      speak(text);
    }
  }, [isPlaying, isPaused, pause, resume, speak, text]);

  const handleStop = useCallback(() => {
    stop();
  }, [stop]);

  // Don't render if TTS is not supported
  if (!isSupported) {
    return null;
  }

  // Group Filipino voices first
  const sortedVoices = [...availableVoices].sort((a, b) => {
    if (a.isFilipino && !b.isFilipino) {
      return -1;
    }
    if (!a.isFilipino && b.isFilipino) {
      return 1;
    }
    return a.name.localeCompare(b.name);
  });

  const playPauseLabel = isPlaying && !isPaused ? t("pause") : isPaused ? t("resume") : t("play");

  const ariaLabel = contentLabel ? `${playPauseLabel} ${contentLabel}` : playPauseLabel;

  // Inline variant - compact play button only
  if (variant === "inline") {
    return (
      <div
        className={`inline-flex items-center gap-1 ${className}`}
        role="group"
        aria-label={t("controls")}
      >
        <button
          onClick={handlePlayPause}
          className="hover:text-primary-600 focus:ring-primary-500 dark:hover:text-primary-400 rounded-full p-1.5 text-neutral-600 transition-colors hover:bg-neutral-100 focus:ring-2 focus:ring-offset-2 focus:outline-none dark:text-neutral-400 dark:hover:bg-neutral-800"
          aria-label={ariaLabel}
          aria-pressed={isPlaying}
          title={ariaLabel}
        >
          {isPlaying && !isPaused ? (
            <PauseIcon className="h-4 w-4" />
          ) : (
            <PlayIcon className="h-4 w-4" />
          )}
        </button>
        {isPlaying && (
          <button
            onClick={handleStop}
            className="focus:ring-primary-500 rounded-full p-1.5 text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-red-600 focus:ring-2 focus:ring-offset-2 focus:outline-none dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-red-400"
            aria-label={t("stop")}
            title={t("stop")}
          >
            <StopIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  // Floating variant - fixed position button
  if (variant === "floating") {
    return (
      <div
        className={`fixed right-4 bottom-4 z-50 ${className}`}
        role="region"
        aria-label={t("controls")}
      >
        <div className="flex items-center gap-2 rounded-full bg-white p-2 shadow-lg dark:bg-neutral-800">
          <button
            onClick={handlePlayPause}
            className="bg-primary-500 hover:bg-primary-600 focus:ring-primary-500 rounded-full p-3 text-white transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none"
            aria-label={ariaLabel}
            aria-pressed={isPlaying}
          >
            {isPlaying && !isPaused ? (
              <PauseIcon className="h-5 w-5" />
            ) : (
              <PlayIcon className="h-5 w-5" />
            )}
          </button>
          {isPlaying && (
            <button
              onClick={handleStop}
              className="focus:ring-primary-500 rounded-full bg-neutral-200 p-3 text-neutral-700 transition-colors hover:bg-neutral-300 focus:ring-2 focus:ring-offset-2 focus:outline-none dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600"
              aria-label={t("stop")}
            >
              <StopIcon className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Full variant - all controls including settings
  return (
    <div
      className={`rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800 ${className}`}
      role="region"
      aria-label={t("controls")}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SpeakerIcon className="text-primary-500 h-5 w-5" />
          <span className="font-medium text-neutral-700 dark:text-neutral-300">{t("title")}</span>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="focus:ring-primary-500 rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus:ring-2 focus:outline-none dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
          aria-label={t("settings")}
          aria-expanded={showSettings}
        >
          <SettingsIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Main Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={handlePlayPause}
          className="bg-primary-500 hover:bg-primary-600 focus:ring-primary-500 flex items-center gap-2 rounded-lg px-4 py-2 text-white transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none"
          aria-label={ariaLabel}
          aria-pressed={isPlaying}
        >
          {isPlaying && !isPaused ? (
            <>
              <PauseIcon className="h-5 w-5" />
              <span>{t("pause")}</span>
            </>
          ) : isPaused ? (
            <>
              <PlayIcon className="h-5 w-5" />
              <span>{t("resume")}</span>
            </>
          ) : (
            <>
              <PlayIcon className="h-5 w-5" />
              <span>{t("play")}</span>
            </>
          )}
        </button>

        {(isPlaying || isPaused) && (
          <button
            onClick={handleStop}
            className="focus:ring-primary-500 flex items-center gap-2 rounded-lg bg-neutral-200 px-4 py-2 text-neutral-700 transition-colors hover:bg-neutral-300 focus:ring-2 focus:ring-offset-2 focus:outline-none dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600"
            aria-label={t("stop")}
          >
            <StopIcon className="h-5 w-5" />
            <span>{t("stop")}</span>
          </button>
        )}

        {/* Status indicator */}
        {isPlaying && (
          <div
            className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400"
            aria-live="polite"
          >
            <span className="relative flex h-2 w-2">
              <span className="bg-primary-400 absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"></span>
              <span className="bg-primary-500 relative inline-flex h-2 w-2 rounded-full"></span>
            </span>
            <span>{isPaused ? t("paused") : t("playing")}</span>
          </div>
        )}
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div
          ref={settingsRef}
          className="mt-4 space-y-4 border-t border-neutral-200 pt-4 dark:border-neutral-700"
          role="group"
          aria-label={t("settings")}
        >
          {/* Voice Selection */}
          <div>
            <label
              htmlFor="tts-voice"
              className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
            >
              {t("voice")}
            </label>
            <select
              id="tts-voice"
              value={selectedVoice?.name || ""}
              onChange={(e) => {
                const voice = sortedVoices.find((v) => v.name === e.target.value);
                if (voice) {
                  setVoice(voice);
                }
              }}
              className="focus:border-primary-500 focus:ring-primary-500 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 focus:ring-1 focus:outline-none dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-300"
              aria-describedby="voice-description"
            >
              {sortedVoices.map((voice) => (
                <option key={voice.name} value={voice.name}>
                  {voice.name} ({voice.lang}){voice.isFilipino ? " ★" : ""}
                </option>
              ))}
            </select>
            <p
              id="voice-description"
              className="mt-1 text-xs text-neutral-500 dark:text-neutral-400"
            >
              {t("voiceHint")}
            </p>
          </div>

          {/* Speech Rate */}
          <div>
            <label
              htmlFor="tts-rate"
              className="mb-1 flex items-center justify-between text-sm font-medium text-neutral-700 dark:text-neutral-300"
            >
              <span>{t("rate")}</span>
              <span className="text-neutral-500">{rate.toFixed(1)}x</span>
            </label>
            <input
              id="tts-rate"
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={rate}
              onChange={(e) => setRate(parseFloat(e.target.value))}
              className="accent-primary-500 w-full"
              aria-valuemin={0.5}
              aria-valuemax={2}
              aria-valuenow={rate}
              aria-valuetext={`${rate.toFixed(1)}x speed`}
            />
            <div className="flex justify-between text-xs text-neutral-500">
              <span>{t("slower")}</span>
              <span>{t("faster")}</span>
            </div>
          </div>

          {/* Volume */}
          <div>
            <label
              htmlFor="tts-volume"
              className="mb-1 flex items-center justify-between text-sm font-medium text-neutral-700 dark:text-neutral-300"
            >
              <span>{t("volume")}</span>
              <span className="text-neutral-500">{Math.round(volume * 100)}%</span>
            </label>
            <input
              id="tts-volume"
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="accent-primary-500 w-full"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(volume * 100)}
              aria-valuetext={`${Math.round(volume * 100)}% volume`}
            />
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div
          className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Screen reader only: content preview */}
      <div className="sr-only" aria-live="polite">
        {contentLabel && <span>{t("readingContent", { content: contentLabel })}</span>}
      </div>
    </div>
  );
}

// Icons
function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6h12v12H6z" />
    </svg>
  );
}

function SpeakerIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
      />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

export default TextToSpeech;
