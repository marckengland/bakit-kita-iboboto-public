/**
 * Accessibility Provider
 *
 * Manages accessibility settings app-wide including:
 * - Text size adjustments (small, medium, large, extra-large)
 * - High contrast mode
 * - Reduced motion (for users sensitive to animations)
 *
 * Settings are persisted in localStorage.
 *
 * Requirements: 27.5, 27.6, 27.8
 */

"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

import {
  applyAccessibilitySettings,
  defaultSettings,
  loadAccessibilitySettings,
  saveAccessibilitySettings,
  updateAccessibilitySettings,
  type AccessibilitySettings,
  type TextSize,
} from "./accessibility-settings";

export type { AccessibilitySettings, TextSize } from "./accessibility-settings";

interface AccessibilityContextType {
  settings: AccessibilitySettings;
  setTextSize: (size: TextSize) => void;
  toggleHighContrast: () => void;
  toggleReducedMotion: () => void;
  resetSettings: () => void;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

interface AccessibilityProviderProps {
  children: ReactNode;
}

export function AccessibilityProvider({ children }: AccessibilityProviderProps) {
  const [settings, setSettings] = useState<AccessibilitySettings>(defaultSettings);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    const stored = loadAccessibilitySettings();
    if (stored !== undefined) {
      setSettings((prev) => updateAccessibilitySettings(prev, { type: "load", settings: stored }));
    }
    setIsHydrated(true);
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    if (isHydrated) {
      saveAccessibilitySettings(settings);
    }
  }, [settings, isHydrated]);

  // Apply CSS custom properties and classes to document
  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    applyAccessibilitySettings(document.documentElement, settings);
  }, [settings, isHydrated]);

  const setTextSize = useCallback((size: TextSize) => {
    setSettings((prev) => updateAccessibilitySettings(prev, { type: "text-size", size }));
  }, []);

  const toggleHighContrast = useCallback(() => {
    setSettings((prev) => updateAccessibilitySettings(prev, { type: "high-contrast" }));
  }, []);

  const toggleReducedMotion = useCallback(() => {
    setSettings((prev) => updateAccessibilitySettings(prev, { type: "reduced-motion" }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings((prev) => updateAccessibilitySettings(prev, { type: "reset" }));
  }, []);

  return (
    <AccessibilityContext.Provider
      value={{
        settings,
        setTextSize,
        toggleHighContrast,
        toggleReducedMotion,
        resetSettings,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility(): AccessibilityContextType {
  const context = useContext(AccessibilityContext);
  if (context === undefined) {
    throw new Error("useAccessibility must be used within an AccessibilityProvider");
  }
  return context;
}

export default AccessibilityProvider;
