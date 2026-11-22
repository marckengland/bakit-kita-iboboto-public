/**
 * Downloaded Profiles Page
 * Manages offline-available politician profiles
 * Requirements: 33.1, 33.2, 33.5, 33.6
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useOffline } from "@/hooks/useOffline";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { toOfflineProfileView, type OfflineProfileView } from "@/lib/offline-storage";

export default function DownloadsPage() {
  const t = useTranslations("offline.downloadedProfilesPage");
  const { offlineProfiles, storageUsage, removeProfile, isOnline, syncProfiles, isSyncing } =
    useOffline();
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleRemove = async (profileId: string) => {
    setRemovingId(profileId);
    try {
      await removeProfile(profileId);
    } finally {
      setRemovingId(null);
    }
  };

  const handleClearAll = async () => {
    if (!confirm("Are you sure you want to remove all downloaded profiles?")) {
      return;
    }
    for (const profile of offlineProfiles) {
      await removeProfile(profile.id);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <Header backLink={{ href: "/", label: "Back" }} />

      {/* Main Content */}
      <main className="container-wide py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">{t("title")}</h1>
          <p className="text-sm text-neutral-500">Case details require an online review check.</p>
          <p className="mt-1 text-neutral-600 dark:text-neutral-400">{t("description")}</p>
        </div>

        {/* Storage Usage Card */}
        <div className="mb-6 rounded-lg bg-white p-4 shadow-sm dark:bg-neutral-800">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-medium text-neutral-900 dark:text-white">{t("storageUsage")}</h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {storageUsage.profileCount} profiles • {storageUsage.formattedSize}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isOnline && offlineProfiles.length > 0 && (
                <button
                  onClick={() => syncProfiles()}
                  disabled={isSyncing}
                  className="btn-outline text-sm"
                >
                  {isSyncing ? (
                    <span className="flex items-center gap-2">
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Syncing...
                    </span>
                  ) : (
                    "Sync All"
                  )}
                </button>
              )}
              {offlineProfiles.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-danger-600 hover:text-danger-700 dark:text-danger-400 text-sm"
                >
                  {t("clearAll")}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Profiles List */}
        {offlineProfiles.length > 0 ? (
          <div className="space-y-3">
            {offlineProfiles.map((profile) => (
              <DownloadedProfileCard
                key={profile.id}
                profile={profile}
                onRemove={handleRemove}
                isRemoving={removingId === profile.id}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg bg-white p-8 text-center shadow-sm dark:bg-neutral-800">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-700">
              <svg
                className="h-8 w-8 text-neutral-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
            </div>
            <h3 className="mb-2 font-medium text-neutral-900 dark:text-white">{t("empty")}</h3>
            <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">{t("emptyHint")}</p>
            <Link href="/politicians" className="btn-primary">
              Browse Politicians
            </Link>
          </div>
        )}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}

interface DownloadedProfileCardProps {
  profile: OfflineProfileView;
  onRemove: (id: string) => void;
  isRemoving: boolean;
}

function DownloadedProfileCard({ profile, onRemove, isRemoving }: DownloadedProfileCardProps) {
  const profileData = toOfflineProfileView(profile).data;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("fil-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) {
      return "0 Bytes";
    }
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <div className="flex items-center justify-between rounded-lg bg-white p-4 shadow-sm dark:bg-neutral-800">
      <Link href={`/politicians/${profile.id}`} className="flex-1 hover:opacity-80">
        <div className="flex items-center gap-4">
          {/* Avatar placeholder */}
          <div className="bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400 flex h-12 w-12 items-center justify-center rounded-full">
            <span className="text-lg font-bold">
              {((profileData.fullName || "U")[0] || "U").toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-medium text-neutral-900 dark:text-white">
              {profileData.fullName || "Unknown"}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
              {profileData.currentPosition?.title && (
                <span>{profileData.currentPosition.title}</span>
              )}
              {profileData.currentParty?.name && (
                <>
                  <span>•</span>
                  <span>{profileData.currentParty.name}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </Link>

      <div className="flex items-center gap-4">
        <div className="text-right text-sm">
          <p className="text-neutral-500 dark:text-neutral-400">
            {formatDate(profile.downloadedAt)}
          </p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500">
            {formatBytes(profile.sizeBytes)}
          </p>
        </div>
        <button
          onClick={() => onRemove(profile.id)}
          disabled={isRemoving}
          className="hover:text-danger-600 dark:hover:text-danger-400 rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-100 disabled:opacity-50 dark:hover:bg-neutral-700"
          aria-label="Remove download"
        >
          {isRemoving ? (
            <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
