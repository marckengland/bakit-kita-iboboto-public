/**
 * Custom hook for offline functionality
 * Requirements: 33.1, 33.2, 33.3, 33.4, 33.5, 33.6
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  saveProfileOffline,
  getAllOfflineProfiles,
  removeOfflineProfile,
  isProfileOffline,
  getOfflineStorageUsage,
  getSyncQueue,
  removeFromSyncQueue,
  toOfflineProfileView,
  type OfflineProfileView,
  type SyncQueueItem,
} from "@/lib/offline-storage";
import { logger } from "../lib/logger";

export interface UseOfflineReturn {
  isOnline: boolean;
  isServiceWorkerReady: boolean;
  offlineProfiles: OfflineProfileView[];
  storageUsage: { totalBytes: number; profileCount: number; formattedSize: string };
  downloadProfile: (politicianId: string) => Promise<void>;
  removeProfile: (politicianId: string) => Promise<void>;
  isProfileDownloaded: (politicianId: string) => Promise<boolean>;
  syncProfiles: () => Promise<void>;
  isSyncing: boolean;
  syncQueue: SyncQueueItem[];
}

export function useOffline(): UseOfflineReturn {
  const [isOnline, setIsOnline] = useState(true);
  const [isServiceWorkerReady, setIsServiceWorkerReady] = useState(false);
  const [offlineProfiles, setOfflineProfiles] = useState<OfflineProfileView[]>([]);
  const [storageUsage, setStorageUsage] = useState({
    totalBytes: 0,
    profileCount: 0,
    formattedSize: "0 Bytes",
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>([]);

  // Initialize online status
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      // Trigger sync when back online
      syncProfiles();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Register service worker
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const registerSW = async () => {
      try {
        // In development, clear all SW caches on load to prevent stale bundles
        if (process.env.NODE_ENV === "development") {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map((name) => caches.delete(name)));
          logger.info("[useOffline] Dev mode: cleared all SW caches");
        }

        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        logger.info("[useOffline] Service Worker registered:", registration.scope);
        setIsServiceWorkerReady(true);

        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener("message", (event) => {
          if (event.data.type === "SYNC_COMPLETE") {
            loadOfflineProfiles();
            setIsSyncing(false);
          }
        });

        // Check for updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                // New version available
                logger.info("[useOffline] New service worker available");
              }
            });
          }
        });
      } catch (error) {
        console.error("[useOffline] Service Worker registration failed:", error);
      }
    };

    registerSW();
  }, []);

  // Load offline profiles on mount
  useEffect(() => {
    loadOfflineProfiles();
    loadSyncQueue();
  }, []);

  const loadOfflineProfiles = async () => {
    try {
      const profiles = await getAllOfflineProfiles();
      setOfflineProfiles(profiles.map(toOfflineProfileView));

      const usage = await getOfflineStorageUsage();
      setStorageUsage(usage);
    } catch (error) {
      console.error("[useOffline] Failed to load offline profiles:", error);
    }
  };

  const loadSyncQueue = async () => {
    try {
      const queue = await getSyncQueue();
      setSyncQueue(queue);
    } catch (error) {
      console.error("[useOffline] Failed to load sync queue:", error);
    }
  };

  /**
   * Download a politician profile for offline access
   * Requirement 33.1: Download politician profile for offline access
   */
  const downloadProfile = useCallback(async (politicianId: string) => {
    try {
      // Fetch the full profile data
      const response = await fetch(`/api/politicians/${politicianId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch profile");
      }

      const profileData = await response.json();

      // Save to IndexedDB
      await saveProfileOffline(
        politicianId,
        toOfflineProfileView({
          id: politicianId,
          data: profileData,
          downloadedAt: new Date().toISOString(),
          lastSyncedAt: null,
          sizeBytes: 0,
        }).data
      );

      // Also cache in service worker
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "CACHE_POLITICIAN_PROFILE",
          payload: { politicianId, data: profileData },
        });
      }

      // Reload profiles list
      await loadOfflineProfiles();

      logger.info("[useOffline] Profile downloaded:", politicianId);
    } catch (error) {
      console.error("[useOffline] Failed to download profile:", error);
      throw error;
    }
  }, []);

  /**
   * Remove a politician profile from offline storage
   */
  const removeProfile = useCallback(async (politicianId: string) => {
    try {
      await removeOfflineProfile(politicianId);

      // Also remove from service worker cache
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "REMOVE_CACHED_PROFILE",
          payload: { politicianId },
        });
      }

      await loadOfflineProfiles();
      logger.info("[useOffline] Profile removed:", politicianId);
    } catch (error) {
      console.error("[useOffline] Failed to remove profile:", error);
      throw error;
    }
  }, []);

  /**
   * Check if a profile is downloaded
   */
  const isProfileDownloaded = useCallback(async (politicianId: string): Promise<boolean> => {
    return isProfileOffline(politicianId);
  }, []);

  /**
   * Sync all offline profiles with the server
   * Requirement 33.4: Sync on reconnect
   */
  const syncProfiles = useCallback(async () => {
    if (!isOnline || isSyncing) {
      return;
    }

    setIsSyncing(true);

    try {
      // Process sync queue first
      const queue = await getSyncQueue();
      for (const item of queue) {
        try {
          await processSyncItem(item);
          await removeFromSyncQueue(item.id);
        } catch (error) {
          console.error("[useOffline] Failed to sync item:", item.id, error);
        }
      }

      // Sync profiles via service worker
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "SYNC_PROFILES",
        });
      } else {
        // Fallback: sync manually
        const profiles = await getAllOfflineProfiles();
        for (const profile of profiles) {
          try {
            const response = await fetch(`/api/politicians/${profile.id}`);
            if (response.ok) {
              const freshData = await response.json();
              await saveProfileOffline(
                profile.id,
                toOfflineProfileView({ ...profile, data: freshData }).data
              );
            }
          } catch {
            console.error("[useOffline] Failed to sync profile:", profile.id);
          }
        }
        setIsSyncing(false);
      }

      await loadOfflineProfiles();
      await loadSyncQueue();
    } catch (error) {
      console.error("[useOffline] Sync failed:", error);
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing]);

  return {
    isOnline,
    isServiceWorkerReady,
    offlineProfiles,
    storageUsage,
    downloadProfile,
    removeProfile,
    isProfileDownloaded,
    syncProfiles,
    isSyncing,
    syncQueue,
  };
}

/**
 * Process a sync queue item
 */
async function processSyncItem(item: SyncQueueItem): Promise<void> {
  switch (item.action) {
    case "bookmark":
      await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.payload),
      });
      break;
    case "voting-list-add":
      await fetch("/api/voting-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.payload),
      });
      break;
    case "voting-list-remove":
      const payload = item.payload as { politicianId: string };
      await fetch(`/api/voting-list/${payload.politicianId}`, {
        method: "DELETE",
      });
      break;
  }
}
