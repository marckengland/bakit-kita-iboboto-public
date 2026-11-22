/**
 * Notification Settings Page
 *
 * Allows users to configure their notification preferences.
 * Requirements: 19.5, 19.6
 */

import { Metadata } from "next";
import Link from "next/link";
import { NotificationSettingsContent } from "./components/NotificationSettingsContent";

export const metadata: Metadata = {
  title: "Notification Settings",
  description: "Configure your notification preferences.",
};

export default function NotificationSettingsPage() {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="container-wide py-4">
          <nav className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="bg-primary-500 flex h-10 w-10 items-center justify-center rounded-lg">
                <span className="text-xl font-bold text-white">B</span>
              </div>
              <span className="text-primary-500 text-xl font-bold">Bakit Kita Iboboto?</span>
            </Link>
            <div className="flex items-center gap-4">
              <a href="/notifications" className="btn-outline">
                Back to Notifications
              </a>
            </div>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="container-wide py-8">
        <NotificationSettingsContent />
      </main>
    </div>
  );
}
