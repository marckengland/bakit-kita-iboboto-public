/**
 * Download for Offline Button Component
 * Allows users to download politician profiles for offline viewing
 * Requirements: 33.1, 33.2, 33.5, 33.6
 */

"use client";

import { useState, useEffect } from "react";
import { useOffline } from "@/hooks/useOffline";
import { useTranslations } from "next-intl";

interface DownloadForOfflineProps {
  politicianId: string;
  politicianName: string;
  variant?: "button" | "icon" | "compact";
  className?: string;
}

export function DownloadForOffline({
  politicianId,
  politicianName,
  variant = "button",
  className = "",
}: DownloadForOfflineProps) {
  const t = useTranslations("offline");
  const { downloadProfile, removeProfile, isProfileDownloaded, isOnline, offlineProfiles } =
    useOffline();
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [downloadDate, setDownloadDate] = useState<string | null>(null);

  // Check if profile is already downloaded
  useEffect(() => {
    const checkDownloadStatus = async () => {
      const downloaded = await isProfileDownloaded(politicianId);
      setIsDownloaded(downloaded);

      if (downloaded) {
        const profile = offlineProfiles.find((p) => p.id === politicianId);
        if (profile) {
          setDownloadDate(profile.downloadedAt);
        }
      }
    };

    checkDownloadStatus();
  }, [politicianId, isProfileDownloaded, offlineProfiles]);

  const handleDownload = async () => {
    if (!isOnline) {
      return;
    }

    setIsLoading(true);
    try {
      await downloadProfile(politicianId);
      setIsDownloaded(true);
      setDownloadDate(new Date().toISOString());
    } catch (error) {
      console.error("Failed to download profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async () => {
    setIsLoading(true);
    try {
      await removeProfile(politicianId);
      setIsDownloaded(false);
      setDownloadDate(null);
    } catch (error) {
      console.error("Failed to remove profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Format download date - Requirement 33.5
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("fil-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Icon-only variant
  if (variant === "icon") {
    return (
      <button
        onClick={isDownloaded ? handleRemove : handleDownload}
        disabled={isLoading || (!isOnline && !isDownloaded)}
        className={`rounded-full p-2 transition-colors ${
          isDownloaded
            ? "bg-success-100 text-success-600 hover:bg-success-200 dark:bg-success-900/30 dark:text-success-400"
            : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400"
        } disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        aria-label={
          isDownloaded
            ? t("removeFromOffline", { name: politicianName })
            : t("downloadForOffline", { name: politicianName })
        }
        title={
          isDownloaded
            ? `${t("downloadedOn")}: ${downloadDate ? formatDate(downloadDate) : ""}`
            : t("downloadForOffline", { name: politicianName })
        }
      >
        {isLoading ? (
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
        ) : isDownloaded ? (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
        )}
      </button>
    );
  }

  // Compact variant
  if (variant === "compact") {
    return (
      <button
        onClick={isDownloaded ? handleRemove : handleDownload}
        disabled={isLoading || (!isOnline && !isDownloaded)}
        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
          isDownloaded
            ? "bg-success-100 text-success-700 hover:bg-success-200 dark:bg-success-900/30 dark:text-success-400"
            : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300"
        } disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      >
        {isLoading ? (
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
        ) : isDownloaded ? (
          <>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            {t("downloaded")}
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            {t("download")}
          </>
        )}
      </button>
    );
  }

  // Full button variant (default)
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <button
        onClick={isDownloaded ? handleRemove : handleDownload}
        disabled={isLoading || (!isOnline && !isDownloaded)}
        className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-medium transition-colors ${
          isDownloaded
            ? "bg-success-100 text-success-700 hover:bg-success-200 dark:bg-success-900/30 dark:text-success-400"
            : "bg-primary-500 hover:bg-primary-600 dark:bg-primary-600 dark:hover:bg-primary-700 text-white"
        } disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {isLoading ? (
          <>
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
            {isDownloaded ? t("removing") : t("downloading")}
          </>
        ) : isDownloaded ? (
          <>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            {t("removeDownload")}
          </>
        ) : (
          <>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            {t("downloadForOfflineViewing")}
          </>
        )}
      </button>

      {/* Download date indicator - Requirement 33.5 */}
      {isDownloaded && downloadDate && (
        <p className="text-center text-xs text-neutral-500 dark:text-neutral-400">
          {t("downloadedOn")}: {formatDate(downloadDate)}
        </p>
      )}

      {/* Offline notice */}
      {!isOnline && !isDownloaded && (
        <p className="text-warning-600 dark:text-warning-400 text-center text-xs">
          {t("connectToDownload")}
        </p>
      )}
    </div>
  );
}

/**
 * Offline Data Indicator
 * Shows when viewing cached/offline data - Requirement 33.3
 */
interface OfflineDataIndicatorProps {
  downloadedAt: string;
  className?: string;
}

export function OfflineDataIndicator({ downloadedAt, className = "" }: OfflineDataIndicatorProps) {
  const t = useTranslations("offline");

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("fil-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div
      className={`bg-warning-50 text-warning-700 dark:bg-warning-900/20 dark:text-warning-400 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${className}`}
      role="status"
    >
      <svg
        className="h-4 w-4 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <span>
        {t("viewingOfflineData")} • {t("lastUpdated")}: {formatDate(downloadedAt)}
      </span>
    </div>
  );
}
