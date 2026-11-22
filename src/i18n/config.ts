/**
 * Internationalization Configuration
 *
 * Defines supported locales and default locale for the application.
 * Supports three languages:
 * - English (en)
 * - Filipino Tagalog - formal Filipino (fil)
 * - Filipino Taglish - casual mixed Filipino-English (fil-taglish)
 *
 * Requirements: 27.1, 27.4, 32.7
 */

export const locales = ["en", "fil", "fil-taglish"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "fil";

export const localeNames: Record<Locale, string> = {
  en: "English",
  fil: "Filipino",
  "fil-taglish": "Taglish",
};

// Short codes for compact display (e.g., in buttons)
export const localeShortCodes: Record<Locale, string> = {
  en: "EN",
  fil: "FIL",
  "fil-taglish": "TGL",
};

// Language metadata for SEO and display
export const localeMetadata: Record<
  Locale,
  { name: string; nativeName: string; description: string; direction: "ltr" | "rtl" }
> = {
  en: {
    name: "English",
    nativeName: "English",
    description: "Full English interface",
    direction: "ltr",
  },
  fil: {
    name: "Filipino",
    nativeName: "Filipino (Tagalog)",
    description: "Pormal na Filipino",
    direction: "ltr",
  },
  "fil-taglish": {
    name: "Taglish",
    nativeName: "Taglish",
    description: "Casual Filipino-English mix",
    direction: "ltr",
  },
};
