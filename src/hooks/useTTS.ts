/**
 * Text-to-Speech Hook
 *
 * Provides Web Speech API integration for text-to-speech functionality.
 * Supports Filipino language voices when available.
 *
 * Requirements: 27.2, 27.3, 27.7
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface TTSVoice {
  voice: SpeechSynthesisVoice;
  name: string;
  lang: string;
  isFilipino: boolean;
  isDefault: boolean;
}

export interface TTSState {
  isSupported: boolean;
  isPlaying: boolean;
  isPaused: boolean;
  isStopped: boolean;
  currentText: string;
  rate: number;
  pitch: number;
  volume: number;
  selectedVoice: TTSVoice | null;
  availableVoices: TTSVoice[];
  error: string | null;
}

export interface TTSControls {
  speak: (text: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  setRate: (rate: number) => void;
  setPitch: (pitch: number) => void;
  setVolume: (volume: number) => void;
  setVoice: (voice: TTSVoice) => void;
}

export interface UseTTSReturn extends TTSState, TTSControls {}

// Filipino language codes to match
const FILIPINO_LANG_CODES = ["fil", "tl", "fil-PH", "tl-PH", "fil-taglish"];

/**
 * Check if a voice is Filipino/Tagalog
 */
function isFilipino(voice: SpeechSynthesisVoice): boolean {
  const lang = voice.lang.toLowerCase();
  return FILIPINO_LANG_CODES.some(
    (code) =>
      lang.startsWith(code.toLowerCase()) || lang.includes("tagalog") || lang.includes("filipino")
  );
}

/**
 * Convert SpeechSynthesisVoice to TTSVoice
 */
function toTTSVoice(voice: SpeechSynthesisVoice): TTSVoice {
  return {
    voice,
    name: voice.name,
    lang: voice.lang,
    isFilipino: isFilipino(voice),
    isDefault: voice.default,
  };
}

/**
 * Custom hook for Text-to-Speech functionality using Web Speech API
 */
export function useTTS(preferFilipino: boolean = true): UseTTSReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentText, setCurrentText] = useState("");
  const [rate, setRateState] = useState(1);
  const [pitch, setPitchState] = useState(1);
  const [volume, setVolumeState] = useState(1);
  const [selectedVoice, setSelectedVoice] = useState<TTSVoice | null>(null);
  const [availableVoices, setAvailableVoices] = useState<TTSVoice[]>([]);
  const [error, setError] = useState<string | null>(null);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  // Initialize speech synthesis
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const synth = window.speechSynthesis;
    if (!synth) {
      setIsSupported(false);
      setError("Text-to-speech is not supported in this browser");
      return;
    }

    synthRef.current = synth;
    setIsSupported(true);

    // Load voices
    const loadVoices = () => {
      const voices = synth.getVoices();
      if (voices.length === 0) {
        return;
      }

      const ttsVoices = voices.map(toTTSVoice);
      setAvailableVoices(ttsVoices);

      // Select default voice (prefer Filipino if available and requested)
      if (!selectedVoice) {
        let defaultVoice: TTSVoice | undefined;

        if (preferFilipino) {
          defaultVoice = ttsVoices.find((v) => v.isFilipino);
        }

        if (!defaultVoice) {
          defaultVoice = ttsVoices.find((v) => v.isDefault) || ttsVoices[0];
        }

        if (defaultVoice) {
          setSelectedVoice(defaultVoice);
        }
      }
    };

    // Load voices immediately if available
    loadVoices();

    // Chrome loads voices asynchronously
    synth.addEventListener("voiceschanged", loadVoices);

    return () => {
      synth.removeEventListener("voiceschanged", loadVoices);
      synth.cancel();
    };
  }, [preferFilipino, selectedVoice]);

  /**
   * Speak the given text
   */
  const speak = useCallback(
    (text: string) => {
      if (!synthRef.current || !isSupported) {
        setError("Text-to-speech is not available");
        return;
      }

      // Cancel any ongoing speech
      synthRef.current.cancel();

      if (!text.trim()) {
        setError("No text to speak");
        return;
      }

      setError(null);
      setCurrentText(text);

      const utterance = new SpeechSynthesisUtterance(text);
      utteranceRef.current = utterance;

      // Set voice
      if (selectedVoice) {
        utterance.voice = selectedVoice.voice;
        utterance.lang = selectedVoice.lang;
      }

      // Set speech parameters
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = volume;

      // Event handlers
      utterance.onstart = () => {
        setIsPlaying(true);
        setIsPaused(false);
      };

      utterance.onend = () => {
        setIsPlaying(false);
        setIsPaused(false);
        setCurrentText("");
      };

      utterance.onerror = (event) => {
        setIsPlaying(false);
        setIsPaused(false);
        if (event.error !== "canceled") {
          setError(`Speech error: ${event.error}`);
        }
      };

      utterance.onpause = () => {
        setIsPaused(true);
      };

      utterance.onresume = () => {
        setIsPaused(false);
      };

      synthRef.current.speak(utterance);
    },
    [isSupported, selectedVoice, rate, pitch, volume]
  );

  /**
   * Pause speech
   */
  const pause = useCallback(() => {
    if (synthRef.current && isPlaying && !isPaused) {
      synthRef.current.pause();
      setIsPaused(true);
    }
  }, [isPlaying, isPaused]);

  /**
   * Resume speech
   */
  const resume = useCallback(() => {
    if (synthRef.current && isPaused) {
      synthRef.current.resume();
      setIsPaused(false);
    }
  }, [isPaused]);

  /**
   * Stop speech
   */
  const stop = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentText("");
    }
  }, []);

  /**
   * Set speech rate (0.1 to 10)
   */
  const setRate = useCallback((newRate: number) => {
    const clampedRate = Math.max(0.1, Math.min(10, newRate));
    setRateState(clampedRate);
  }, []);

  /**
   * Set speech pitch (0 to 2)
   */
  const setPitch = useCallback((newPitch: number) => {
    const clampedPitch = Math.max(0, Math.min(2, newPitch));
    setPitchState(clampedPitch);
  }, []);

  /**
   * Set speech volume (0 to 1)
   */
  const setVolume = useCallback((newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolumeState(clampedVolume);
  }, []);

  /**
   * Set voice
   */
  const setVoice = useCallback((voice: TTSVoice) => {
    setSelectedVoice(voice);
  }, []);

  return {
    // State
    isSupported,
    isPlaying,
    isPaused,
    isStopped: !isPlaying && !isPaused,
    currentText,
    rate,
    pitch,
    volume,
    selectedVoice,
    availableVoices,
    error,
    // Controls
    speak,
    pause,
    resume,
    stop,
    setRate,
    setPitch,
    setVolume,
    setVoice,
  };
}

export default useTTS;
