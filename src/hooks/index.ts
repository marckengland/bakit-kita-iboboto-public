/**
 * Hooks Index
 *
 * Re-exports all custom hooks for easier imports.
 */

export {
  useTTS,
  type TTSVoice,
  type TTSState,
  type TTSControls,
  type UseTTSReturn,
} from "./useTTS";

// Re-export accessibility hook from provider
export {
  useAccessibility,
  type TextSize,
  type AccessibilitySettings,
} from "@/app/providers/AccessibilityProvider";
