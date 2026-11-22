/**
 * Internationalization Provider
 *
 * Wraps the application with next-intl provider for client-side translations.
 * Requirements: 27.1, 27.4, 32.7
 */

"use client";

import { NextIntlClientProvider, AbstractIntlMessages } from "next-intl";
import { ReactNode } from "react";

interface IntlProviderProps {
  children: ReactNode;
  locale: string;
  messages: AbstractIntlMessages;
}

export function IntlProvider({ children, locale, messages }: IntlProviderProps) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Manila">
      {children}
    </NextIntlClientProvider>
  );
}

export default IntlProvider;
