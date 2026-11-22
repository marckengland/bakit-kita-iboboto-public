/**
 * Language Switcher Component
 *
 * Allows users to switch between three languages:
 * - English (en)
 * - Filipino formal (fil)
 * - Filipino Taglish casual (fil-taglish)
 *
 * Persists language preference in a cookie.
 *
 * Requirements: 27.1, 27.4, 32.7
 */

"use client";

import { useState, useRef, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { locales, localeNames, localeShortCodes, localeMetadata, type Locale } from "@/i18n/config";

interface LanguageSwitcherProps {
  className?: string;
  variant?: "dropdown" | "buttons" | "compact";
  align?: "start" | "end";
}

export function LanguageSwitcher({
  className = "",
  variant = "dropdown",
  align = "end",
}: LanguageSwitcherProps) {
  const locale = useLocale() as Locale;
  const t = useTranslations("language");
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLanguageChange = (newLocale: Locale) => {
    // Set cookie for locale preference
    document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=31536000;SameSite=Lax`;
    // Reload the page to apply the new locale
    window.location.reload();
  };

  // Compact variant - just shows short codes in a row
  if (variant === "compact") {
    return (
      <div
        className={`flex items-center gap-0.5 rounded-lg bg-neutral-100 p-0.5 dark:bg-neutral-800 ${className}`}
        role="group"
        aria-label={t("select")}
      >
        {locales.map((loc) => (
          <button
            key={loc}
            onClick={() => handleLanguageChange(loc)}
            className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              locale === loc
                ? "text-primary-600 dark:text-primary-400 bg-white shadow-sm dark:bg-neutral-700"
                : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200"
            }`}
            aria-pressed={locale === loc}
            aria-label={localeNames[loc]}
            title={localeMetadata[loc].description}
          >
            {localeShortCodes[loc]}
          </button>
        ))}
      </div>
    );
  }

  // Buttons variant - larger buttons with full names
  if (variant === "buttons") {
    return (
      <div className={`flex items-center gap-1 ${className}`} role="group" aria-label={t("select")}>
        {locales.map((loc) => (
          <button
            key={loc}
            onClick={() => handleLanguageChange(loc)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              locale === loc
                ? "bg-primary-500 text-white"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
            }`}
            aria-pressed={locale === loc}
            aria-label={localeNames[loc]}
            title={localeMetadata[loc].description}
          >
            {localeShortCodes[loc]}
          </button>
        ))}
      </div>
    );
  }

  // Default dropdown variant
  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={t("select")}
      >
        <GlobeIcon className="h-4 w-4" />
        <span>{localeNames[locale]}</span>
        <ChevronIcon className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div
          className={`absolute ${align === "start" ? "left-0" : "right-0"} z-50 mt-2 w-48 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-neutral-300 bg-white shadow-lg dark:border-neutral-600 dark:bg-neutral-800`}
          role="listbox"
          aria-label={t("select")}
        >
          {locales.map((loc) => (
            <button
              key={loc}
              onClick={() => {
                handleLanguageChange(loc);
                setIsOpen(false);
              }}
              className={`flex w-full flex-col items-start px-4 py-2.5 text-left transition-colors ${
                locale === loc
                  ? "bg-primary-50 dark:bg-primary-900/30"
                  : "hover:bg-neutral-50 dark:hover:bg-neutral-700"
              }`}
              role="option"
              aria-selected={locale === loc}
            >
              <div className="flex w-full items-center gap-2">
                {locale === loc && (
                  <CheckIcon className="text-primary-600 dark:text-primary-400 h-4 w-4" />
                )}
                <span
                  className={`font-medium ${
                    locale === loc
                      ? "text-primary-700 dark:text-primary-400"
                      : "text-neutral-700 dark:text-neutral-300"
                  } ${locale !== loc ? "ml-6" : ""}`}
                >
                  {localeNames[loc]}
                </span>
              </div>
              <span
                className={`mt-0.5 text-xs ${
                  locale === loc
                    ? "text-primary-600/70 dark:text-primary-400/70"
                    : "text-neutral-500 dark:text-neutral-400"
                } ${locale !== loc ? "ml-6" : "ml-6"}`}
              >
                {localeMetadata[loc].description}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Icons
function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
      />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

export default LanguageSwitcher;
