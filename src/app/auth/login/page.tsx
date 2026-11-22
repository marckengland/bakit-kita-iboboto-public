/**
 * Login Page
 *
 * Provides authentication options using Philippine National ID or Passport.
 * Requirements: 16.1, 16.2, 16.6
 */

import { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "../components/LoginForm";
import { ThemeToggle } from "../../components/ThemeToggle";
import { AccessibilitySettings } from "../../components/AccessibilitySettings";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";

export const metadata: Metadata = {
  title: "Mag-login",
  description:
    "Mag-login gamit ang iyong Philippine National ID o Passport para ma-access ang personalized features.",
};

export default function LoginPage() {
  return (
    <div className="from-primary-50 min-h-screen bg-gradient-to-b to-white dark:from-neutral-900 dark:to-neutral-950">
      {/* Header */}
      <header className="border-b border-neutral-200 bg-white/80 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/80">
        <div className="container-wide py-4">
          <nav className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="bg-primary-500 flex h-10 w-10 items-center justify-center rounded-lg">
                <span className="text-xl font-bold text-white">B</span>
              </div>
              <span className="text-primary-500 text-xl font-bold">Bakit Kita Iboboto?</span>
            </Link>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <AccessibilitySettings />
              <LanguageSwitcher className="hidden sm:block" />
            </div>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="container-narrow flex min-h-[calc(100vh-180px)] items-center justify-center py-12">
        <div className="w-full max-w-md">
          {/* Login Card */}
          <div className="card">
            <div className="mb-8 text-center">
              <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Mag-login</h1>
              <p className="mt-2 text-neutral-600 dark:text-neutral-400">
                Gamitin ang iyong Philippine National ID o Passport para ma-verify ang iyong
                identity
              </p>
            </div>

            <LoginForm />

            {/* Info Section */}
            <div className="bg-info-50 dark:bg-info-900/20 mt-8 rounded-lg p-4">
              <div className="flex gap-3">
                <InfoIcon className="text-info-500 h-5 w-5 flex-shrink-0" />
                <div className="text-info-700 dark:text-info-300 text-sm">
                  <p className="font-medium">Bakit kailangan mag-verify?</p>
                  <p className="mt-1">
                    Ang verification ay nagbibigay-daan sa mga personalized features tulad ng
                    bookmarks, voting list, at notifications. Hindi namin iniimbak ang iyong ID
                    number pagkatapos ng verification.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Back Link */}
          <div className="mt-6 text-center">
            <Link
              href="/"
              className="hover:text-primary-500 text-sm text-neutral-500 dark:text-neutral-400"
            >
              ← Bumalik sa homepage
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200 bg-white py-6 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="container-wide">
          <p className="text-center text-sm text-neutral-500">
            Ang iyong data ay protektado at hindi ibabahagi sa third parties.
          </p>
        </div>
      </footer>
    </div>
  );
}

function InfoIcon({ className }: { className?: string }) {
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
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
