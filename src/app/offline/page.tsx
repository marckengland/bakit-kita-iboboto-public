/**
 * Offline Fallback Page
 * Displayed when the user is offline and the requested page is not cached
 * Requirements: 33.3
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useOffline } from "@/hooks/useOffline";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { toOfflineProfileView, type OfflineProfileView } from "@/lib/offline-storage";

export default function OfflinePage() {
  const t = useTranslations("offline.offlinePage");
  const { offlineProfiles, isOnline } = useOffline();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect to home if back online
  useEffect(() => {
    if (isOnline && mounted) {
      window.location.href = "/";
    }
  }, [isOnline, mounted]);

  if (!mounted) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <Header showLogin={false} showGetStarted={false} />

      {/* Main Content */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg text-center">
          {/* Offline Icon */}
          <div className="bg-warning-100 dark:bg-warning-900/30 mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full">
            <svg
              className="text-warning-600 dark:text-warning-400 h-12 w-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
              />
            </svg>
          </div>

          <h1 className="mb-2 text-2xl font-bold text-neutral-900 dark:text-white">{t("title")}</h1>
          <p className="text-sm text-neutral-500">Case details require an online review check.</p>
          <p className="mb-8 text-neutral-600 dark:text-neutral-400">{t("description")}</p>

          {/* Downloaded Profiles Section */}
          {offlineProfiles.length > 0 ? (
            <div className="mb-8">
              <h2 className="mb-4 text-lg font-semibold text-neutral-900 dark:text-white">
                {t("downloadedProfiles")}
              </h2>
              <div className="space-y-2">
                {offlineProfiles.map((profile) => (
                  <OfflineProfileCard key={profile.id} profile={profile} />
                ))}
              </div>
            </div>
          ) : (
            <div className="mb-8 rounded-lg bg-neutral-100 p-6 dark:bg-neutral-800">
              <p className="text-neutral-600 dark:text-neutral-400">{t("noDownloads")}</p>
              <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-500">
                {t("noDownloadsHint")}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button onClick={() => window.location.reload()} className="btn-primary">
              {t("tryAgain")}
            </button>
            <Link href="/" className="btn-outline">
              {t("goHome")}
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}

interface OfflineProfileCardProps {
  profile: OfflineProfileView;
}

function OfflineProfileCard({ profile }: OfflineProfileCardProps) {
  const profileData = toOfflineProfileView(profile).data;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("fil-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <Link
      href={`/politicians/${profile.id}`}
      className="flex items-center justify-between rounded-lg bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:bg-neutral-800"
    >
      <div className="text-left">
        <p className="font-medium text-neutral-900 dark:text-white">
          {profileData.fullName || "Unknown"}
        </p>
        {profileData.currentPosition?.title && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {profileData.currentPosition.title}
          </p>
        )}
      </div>
      <div className="text-right">
        <span className="bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Available
        </span>
        <p className="mt-1 text-xs text-neutral-500">{formatDate(profile.downloadedAt)}</p>
      </div>
    </Link>
  );
}
