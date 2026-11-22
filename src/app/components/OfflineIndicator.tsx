/**
 * Offline Indicator Component
 * Displays when the user is offline and shows sync status
 * Requirements: 33.3, 33.4, 33.5
 */

"use client";

import { useEffect, useState } from "react";
import { useOffline } from "@/hooks/useOffline";
import { useTranslations } from "next-intl";

export function OfflineIndicator() {
  const t = useTranslations("offline");
  const { isOnline, isSyncing, syncProfiles, offlineProfiles, storageUsage } = useOffline();
  const [showBanner, setShowBanner] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const [showSyncNotification, setShowSyncNotification] = useState(false);

  // Show banner when offline
  useEffect(() => {
    if (!isOnline) {
      setShowBanner(true);
      setWasOffline(true);
    } else if (wasOffline) {
      // Just came back online
      setShowSyncNotification(true);
      setShowBanner(false);

      // Auto-hide sync notification after 5 seconds
      const timer = setTimeout(() => {
        setShowSyncNotification(false);
        setWasOffline(false);
      }, 5000);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isOnline, wasOffline]);

  // Handle sync button click
  const handleSync = async () => {
    await syncProfiles();
    setShowSyncNotification(false);
    setWasOffline(false);
  };

  // Don't render anything if online and no notifications
  if (isOnline && !showSyncNotification) {
    return null;
  }

  return (
    <>
      {/* Offline Banner - Requirement 33.3 */}
      {showBanner && !isOnline && (
        <div
          className="bg-warning-500 fixed right-0 bottom-0 left-0 z-50 px-4 py-3 text-white shadow-lg"
          role="alert"
          aria-live="polite"
        >
          <div className="container-wide flex flex-col items-center justify-between gap-2 sm:flex-row">
            <div className="flex items-center gap-3">
              {/* Offline Icon */}
              <svg
                className="h-6 w-6 flex-shrink-0"
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
              <div>
                <p className="font-medium">{t("youAreOffline")}</p>
                <p className="text-sm opacity-90">
                  {offlineProfiles.length > 0
                    ? t("viewingCachedData", { count: offlineProfiles.length })
                    : t("limitedFunctionality")}
                </p>
              </div>
            </div>

            {offlineProfiles.length > 0 && (
              <div className="text-sm">
                <span className="opacity-90">{t("downloadedProfiles")}: </span>
                <span className="font-medium">{offlineProfiles.length}</span>
                <span className="mx-2 opacity-50">|</span>
                <span className="opacity-90">{t("storageUsed")}: </span>
                <span className="font-medium">{storageUsage.formattedSize}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sync Notification - Requirement 33.4 */}
      {showSyncNotification && isOnline && (
        <div
          className="bg-success-500 fixed right-0 bottom-0 left-0 z-50 px-4 py-3 text-white shadow-lg"
          role="alert"
          aria-live="polite"
        >
          <div className="container-wide flex flex-col items-center justify-between gap-2 sm:flex-row">
            <div className="flex items-center gap-3">
              {/* Online Icon */}
              <svg
                className="h-6 w-6 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
                />
              </svg>
              <div>
                <p className="font-medium">{t("backOnline")}</p>
                <p className="text-sm opacity-90">{t("syncAvailable")}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="rounded-lg bg-white/20 px-4 py-2 text-sm font-medium transition-colors hover:bg-white/30 disabled:opacity-50"
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
                    {t("syncing")}
                  </span>
                ) : (
                  t("syncNow")
                )}
              </button>

              <button
                onClick={() => {
                  setShowSyncNotification(false);
                  setWasOffline(false);
                }}
                className="rounded-lg p-2 transition-colors hover:bg-white/20"
                aria-label={t("dismiss")}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Small offline badge for use in headers/navigation
 */
export function OfflineBadge() {
  const t = useTranslations("offline");
  const { isOnline } = useOffline();

  if (isOnline) {
    return null;
  }

  return (
    <span
      className="bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium"
      role="status"
      aria-label={t("offlineMode")}
    >
      <svg
        className="h-3 w-3"
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
      {t("offline")}
    </span>
  );
}
