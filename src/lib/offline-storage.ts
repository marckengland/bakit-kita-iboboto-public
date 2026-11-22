/**
 * IndexedDB-based offline storage for politician profiles
 * Requirements: 33.1, 33.2, 33.5, 33.6
 */

import { logger } from "./logger";

const DB_NAME = "bkib-offline";
const DB_VERSION = 1;
const PROFILES_STORE = "profiles";
const SYNC_QUEUE_STORE = "sync-queue";

export interface OfflineProfile {
  id: string;
  data: unknown;
  downloadedAt: string;
  lastSyncedAt: string | null;
  sizeBytes: number;
}

export interface SyncQueueItem {
  id: string;
  action: "bookmark" | "voting-list-add" | "voting-list-remove";
  payload: unknown;
  createdAt: string;
  retryCount: number;
}

let dbInstance: IDBDatabase | null = null;

/**
 * Initialize IndexedDB database
 */
export async function initOfflineDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("[OfflineDB] Failed to open database:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create profiles store
      if (!db.objectStoreNames.contains(PROFILES_STORE)) {
        const profilesStore = db.createObjectStore(PROFILES_STORE, { keyPath: "id" });
        profilesStore.createIndex("downloadedAt", "downloadedAt", { unique: false });
      }

      // Create sync queue store
      if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
        const syncStore = db.createObjectStore(SYNC_QUEUE_STORE, { keyPath: "id" });
        syncStore.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
  });
}

/**
 * Save a politician profile for offline access
 * Requirement 33.1: Download politician profile for offline access
 */
export async function saveProfileOffline(
  politicianId: string,
  profileData: unknown
): Promise<void> {
  const db = await initOfflineDB();
  const dataString = JSON.stringify(profileData);
  const sizeBytes = new Blob([dataString]).size;

  const profile: OfflineProfile = {
    id: politicianId,
    data: profileData,
    downloadedAt: new Date().toISOString(),
    lastSyncedAt: null,
    sizeBytes,
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PROFILES_STORE], "readwrite");
    const store = transaction.objectStore(PROFILES_STORE);
    const request = store.put(profile);

    request.onerror = () => {
      console.error("[OfflineDB] Failed to save profile:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      logger.info("[OfflineDB] Profile saved:", politicianId);
      resolve();
    };
  });
}

/**
 * Get a politician profile from offline storage
 * Requirement 33.3: Display downloaded profiles with indicator
 */
export async function getOfflineProfile(politicianId: string): Promise<OfflineProfile | null> {
  const db = await initOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PROFILES_STORE], "readonly");
    const store = transaction.objectStore(PROFILES_STORE);
    const request = store.get(politicianId);

    request.onerror = () => {
      console.error("[OfflineDB] Failed to get profile:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result || null);
    };
  });
}

/**
 * Get all offline profiles
 * Requirement 33.2: Allow downloading multiple profiles
 */
export async function getAllOfflineProfiles(): Promise<OfflineProfile[]> {
  const db = await initOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PROFILES_STORE], "readonly");
    const store = transaction.objectStore(PROFILES_STORE);
    const request = store.getAll();

    request.onerror = () => {
      console.error("[OfflineDB] Failed to get all profiles:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result || []);
    };
  });
}

/**
 * Remove a politician profile from offline storage
 */
export async function removeOfflineProfile(politicianId: string): Promise<void> {
  const db = await initOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PROFILES_STORE], "readwrite");
    const store = transaction.objectStore(PROFILES_STORE);
    const request = store.delete(politicianId);

    request.onerror = () => {
      console.error("[OfflineDB] Failed to remove profile:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      logger.info("[OfflineDB] Profile removed:", politicianId);
      resolve();
    };
  });
}

/**
 * Check if a profile is available offline
 */
export async function isProfileOffline(politicianId: string): Promise<boolean> {
  const profile = await getOfflineProfile(politicianId);
  return profile !== null;
}

/**
 * Get total storage used by offline profiles
 * Requirement 33.6: Optimize downloaded data size
 */
export async function getOfflineStorageUsage(): Promise<{
  totalBytes: number;
  profileCount: number;
  formattedSize: string;
}> {
  const profiles = await getAllOfflineProfiles();
  const totalBytes = profiles.reduce((sum, p) => sum + p.sizeBytes, 0);

  return {
    totalBytes,
    profileCount: profiles.length,
    formattedSize: formatBytes(totalBytes),
  };
}

/**
 * Update the last synced timestamp for a profile
 * Requirement 33.4: Sync on reconnect
 */
export async function updateProfileSyncTime(politicianId: string): Promise<void> {
  const db = await initOfflineDB();
  const profile = await getOfflineProfile(politicianId);

  if (!profile) {
    return;
  }

  profile.lastSyncedAt = new Date().toISOString();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PROFILES_STORE], "readwrite");
    const store = transaction.objectStore(PROFILES_STORE);
    const request = store.put(profile);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Add an action to the sync queue for when back online
 */
export async function addToSyncQueue(
  action: SyncQueueItem["action"],
  payload: unknown
): Promise<void> {
  const db = await initOfflineDB();

  const item: SyncQueueItem = {
    id: `${action}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    action,
    payload,
    createdAt: new Date().toISOString(),
    retryCount: 0,
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SYNC_QUEUE_STORE], "readwrite");
    const store = transaction.objectStore(SYNC_QUEUE_STORE);
    const request = store.add(item);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Get all items in the sync queue
 */
export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await initOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SYNC_QUEUE_STORE], "readonly");
    const store = transaction.objectStore(SYNC_QUEUE_STORE);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

/**
 * Remove an item from the sync queue
 */
export async function removeFromSyncQueue(itemId: string): Promise<void> {
  const db = await initOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SYNC_QUEUE_STORE], "readwrite");
    const store = transaction.objectStore(SYNC_QUEUE_STORE);
    const request = store.delete(itemId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Clear all items from the sync queue
 */
export async function clearSyncQueue(): Promise<void> {
  const db = await initOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SYNC_QUEUE_STORE], "readwrite");
    const store = transaction.objectStore(SYNC_QUEUE_STORE);
    const request = store.clear();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return "0 Bytes";
  }

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/** Display-only copy. Raw saved records remain in IndexedDB for their owner. */
export function toOfflineProfileView(profile: OfflineProfile) {
  const raw =
    profile.data && typeof profile.data === "object"
      ? (profile.data as Record<string, unknown>)
      : {};
  const text = (value: unknown): string | undefined =>
    typeof value === "string" ? value : undefined;
  const position =
    raw.currentPosition && typeof raw.currentPosition === "object"
      ? (raw.currentPosition as Record<string, unknown>)
      : {};
  const party =
    raw.currentParty && typeof raw.currentParty === "object"
      ? (raw.currentParty as Record<string, unknown>)
      : {};
  return {
    id: profile.id,
    downloadedAt: profile.downloadedAt,
    lastSyncedAt: profile.lastSyncedAt,
    sizeBytes: profile.sizeBytes,
    data: {
      fullName: text(raw.fullName),
      photo: text(raw.photo),
      currentPosition: { title: text(position.title), jurisdiction: text(position.jurisdiction) },
      currentParty: { name: text(party.name) },
    },
    caseReviewAvailability: "offline" as const,
    caseCount: null,
    redFlagCount: null,
    hasRedFlags: null,
  };
}
export type OfflineProfileView = ReturnType<typeof toOfflineProfileView>;
