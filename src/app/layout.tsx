import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { getLocale, getMessages } from "next-intl/server";
import { cookies } from "next/headers";
import { locales } from "@/i18n/config";
import "./globals.css";
import { AIChatbot } from "./components/AIChatbot";
import { LanguageWelcome } from "./components/LanguageWelcome";
import { IntlProvider } from "./providers/IntlProvider";
import { AccessibilityProvider } from "./providers/AccessibilityProvider";
import { ThemeProvider } from "./providers/ThemeProvider";
import { SkipToContent } from "./components/SkipToContent";
import { OfflineIndicator } from "./components/OfflineIndicator";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: {
    default: "Bakit Kita Iboboto? | Political Transparency for Filipino Voters",
    template: "%s | Bakit Kita Iboboto?",
  },
  description:
    "Explore Philippine politician profiles and public records. Compare information, check sources and coverage, and make your own voting decisions.",
  keywords: [
    "Philippine politics",
    "Filipino voters",
    "politician profiles",
    "election information",
    "SALN",
    "legislative records",
    "political transparency",
    "bakit kita iboboto",
  ],
  authors: [{ name: "Bakit Kita Iboboto Team" }],
  creator: "Bakit Kita Iboboto",
  publisher: "Bakit Kita Iboboto",
  robots: {
    index: true,
    follow: true,
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Bakit Kita Iboboto?",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_PH",
    alternateLocale: "fil_PH",
    siteName: "Bakit Kita Iboboto?",
    title: "Bakit Kita Iboboto? | Political Transparency for Filipino Voters",
    description:
      "Explore Philippine politician profiles, compare records, and check their sources and coverage.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bakit Kita Iboboto?",
    description:
      "Explore Philippine politician profiles, compare records, and check their sources and coverage.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0038a8" },
    { media: "(prefers-color-scheme: dark)", color: "#001744" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  const savedLocale = (await cookies()).get("NEXT_LOCALE")?.value;
  const shouldPrompt = !locales.some((value) => value === savedLocale);

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="144x144" href="/icons/icon-144x144.png" />
        <link rel="icon" type="image/png" sizes="96x96" href="/icons/icon-96x96.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider>
          <IntlProvider locale={locale} messages={messages}>
            <AccessibilityProvider>
              <SkipToContent />
              <div id="main-content" tabIndex={-1}>
                {children}
              </div>
              <AIChatbot />
              <LanguageWelcome shouldPrompt={shouldPrompt} />
              <OfflineIndicator />
            </AccessibilityProvider>
          </IntlProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
