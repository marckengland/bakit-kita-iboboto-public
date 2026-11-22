/**
 * Server-side i18n request configuration
 *
 * Provides locale detection and message loading for server components.
 * Supports: English (en), Filipino formal (fil), Filipino Taglish (fil-taglish)
 *
 * Requirements: 27.1, 27.4, 32.7
 */

import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { defaultLocale, locales, type Locale } from "./config";

export default getRequestConfig(async () => {
  // Try to get locale from cookie first
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("NEXT_LOCALE")?.value;

  // Then try Accept-Language header
  const headersList = await headers();
  const acceptLanguage = headersList.get("accept-language");

  let locale: Locale = defaultLocale;

  // Check cookie first (includes fil-taglish)
  if (localeCookie && locales.includes(localeCookie as Locale)) {
    locale = localeCookie as Locale;
  }
  // Then check Accept-Language header
  else if (acceptLanguage) {
    const preferredLocale = acceptLanguage
      .split(",")
      .map((lang) => {
        const parts = lang.split(";");
        return parts[0]?.trim().toLowerCase() ?? "";
      })
      .find((lang) => {
        // Check for exact match or language prefix
        if (locales.includes(lang as Locale)) {
          return true;
        }
        if (lang.startsWith("fil") || lang.startsWith("tl")) {
          return true;
        }
        if (lang.startsWith("en")) {
          return true;
        }
        return false;
      });

    if (preferredLocale) {
      if (preferredLocale.startsWith("fil") || preferredLocale.startsWith("tl")) {
        // Default to formal Filipino for browser detection
        // Users can switch to Taglish manually
        locale = "fil";
      } else if (preferredLocale.startsWith("en")) {
        locale = "en";
      }
    }
  }

  // Load messages - handle fil-taglish filename
  const messageFile = locale === "fil-taglish" ? "fil-taglish" : locale;

  return {
    locale,
    messages: (await import(`./messages/${messageFile}.json`)).default,
  };
});
