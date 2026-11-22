/**
 * Accessibility Settings Component
 *
 * A panel/modal that allows users to adjust accessibility settings:
 * - Text size (small, medium, large, extra-large)
 * - High contrast mode toggle
 * - Reduced motion toggle
 *
 * Requirements: 27.5, 27.6, 27.8
 */

"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useAccessibility, TextSize } from "@/app/providers/AccessibilityProvider";

interface AccessibilitySettingsProps {
  className?: string;
  placement?: "anchor" | "viewport";
}

export function AccessibilitySettings({
  className = "",
  placement = "anchor",
}: AccessibilitySettingsProps) {
  const t = useTranslations("accessibility");
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const { settings, setTextSize, toggleHighContrast, toggleReducedMotion, resetSettings } =
    useAccessibility();

  // Close panel when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
    return undefined;
  }, [isOpen]);

  // Close panel on Escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  const textSizeOptions: { value: TextSize; label: string }[] = [
    { value: "small", label: t("textSize.small") },
    { value: "medium", label: t("textSize.medium") },
    { value: "large", label: t("textSize.large") },
    { value: "extra-large", label: t("textSize.extraLarge") },
  ];

  return (
    <div className={`relative ${className}`}>
      {/* Accessibility Settings Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="focus-visible:ring-primary-500 flex items-center justify-center rounded-lg p-2 text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
        aria-label={t("title")}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        {/* Accessibility Icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <circle cx="12" cy="4" r="2" />
          <path d="M12 6v6" />
          <path d="M8 10l4 2 4-2" />
          <path d="M8 22l4-10 4 10" />
        </svg>
      </button>

      {/* Settings Panel */}
      {isOpen && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={t("title")}
          aria-modal="true"
          className={`${placement === "viewport" ? "fixed inset-x-4 top-24 mx-auto max-h-[calc(100dvh-7rem)] max-w-80 overflow-y-auto" : "absolute top-full right-0 mt-2 w-80"} z-50 rounded-xl border border-neutral-300 bg-white p-4 shadow-lg dark:border-neutral-600 dark:bg-neutral-900`}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              {t("title")}
            </h2>
            <button
              onClick={() => setIsOpen(false)}
              className="focus-visible:ring-primary-500 rounded-lg p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 focus-visible:ring-2 focus-visible:outline-none dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
              aria-label={t("close")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M18 6L6 18" />
                <path d="M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-5">
            {/* Text Size */}
            <div>
              <label
                id="text-size-label"
                className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
              >
                {t("textSize.label")}
              </label>
              <div role="radiogroup" aria-labelledby="text-size-label" className="flex gap-2">
                {textSizeOptions.map((option) => (
                  <button
                    key={option.value}
                    role="radio"
                    aria-checked={settings.textSize === option.value}
                    onClick={() => setTextSize(option.value)}
                    className={`focus-visible:ring-primary-500 flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${
                      settings.textSize === option.value
                        ? "bg-primary-500 text-white"
                        : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* High Contrast Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <span className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  {t("highContrast.label")}
                </span>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  {t("highContrast.description")}
                </span>
              </div>
              <button
                role="switch"
                aria-checked={settings.highContrast}
                onClick={toggleHighContrast}
                className={`focus-visible:ring-primary-500 relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${
                  settings.highContrast ? "bg-primary-500" : "bg-neutral-200 dark:bg-neutral-700"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform ${
                    settings.highContrast ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Reduced Motion Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <span className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  {t("reducedMotion.label")}
                </span>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  {t("reducedMotion.description")}
                </span>
              </div>
              <button
                role="switch"
                aria-checked={settings.reducedMotion}
                onClick={toggleReducedMotion}
                className={`focus-visible:ring-primary-500 relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${
                  settings.reducedMotion ? "bg-primary-500" : "bg-neutral-200 dark:bg-neutral-700"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform ${
                    settings.reducedMotion ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Reset Button */}
            <button
              onClick={resetSettings}
              className="focus-visible:ring-primary-500 w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              {t("reset")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AccessibilitySettings;
