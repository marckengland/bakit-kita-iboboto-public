/**
 * Bookmarks Content Component
 *
 * Displays bookmarked politicians with quick access to profiles.
 * Handles both authenticated (server) and unauthenticated (local storage) bookmarks.
 *
 * Requirements: 10.2, 10.5
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";

interface BookmarkedPolitician {
  id: string;
  politicianId: string;
  createdAt: string;
  politician?: {
    id: string;
    fullName: string;
    photo: string | null;
    currentPosition?: string;
    currentLevel?: string;
  };
}

const LOCAL_STORAGE_KEY = "bkib_bookmarks";

export function BookmarksContent() {
  const [bookmarks, setBookmarks] = useState<BookmarkedPolitician[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadLocalBookmarks = useCallback(async () => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === "string")) {
        throw new Error("Invalid saved profile list");
      }
      const politicianIds: string[] = [...new Set(parsed)];

      if (politicianIds.length === 0) {
        setBookmarks([]);
        return;
      }

      const politicianPromises = politicianIds.map(
        async (id): Promise<BookmarkedPolitician | null> => {
          const response = await fetch(`/api/politicians/${encodeURIComponent(id)}`, {
            cache: "no-store",
          });
          if (response.ok) {
            const data = await response.json();
            return {
              id: `local-${id}`,
              politicianId: id,
              createdAt: new Date().toISOString(),
              politician: {
                id: data.politician.id as string,
                fullName: data.politician.fullName as string,
                photo: data.politician.photo as string | null,
                currentPosition: data.politician.currentPosition?.title as string | undefined,
                currentLevel: data.politician.currentPosition?.level as string | undefined,
              },
            };
          }
          if (response.status === 404) {
            return {
              id: `local-${id}`,
              politicianId: id,
              createdAt: "",
              politician: { id, fullName: "Profile no longer available", photo: null },
            };
          }
          throw new Error("Saved profiles temporarily unavailable");
        }
      );

      const results = await Promise.all(politicianPromises);
      const filtered = results.filter((b): b is BookmarkedPolitician => b !== null);
      setBookmarks(filtered);
    } catch (error) {
      console.error("Saved profile loading failed:", error);
      setError("Saved profiles are temporarily unavailable. Your saved list has not been removed.");
    }
  }, []);

  const loadBookmarks = useCallback(async () => {
    try {
      const authResponse = await fetch("/api/auth/profile");
      const isAuth = authResponse.ok;
      setIsAuthenticated(isAuth);

      if (isAuth) {
        const bookmarksResponse = await fetch("/api/bookmarks");
        if (bookmarksResponse.ok) {
          const data = await bookmarksResponse.json();
          setBookmarks(data.bookmarks);
        } else {
          setError("Hindi ma-load ang bookmarks");
        }
      } else {
        await loadLocalBookmarks();
      }
    } catch {
      setError("May problema sa connection");
      await loadLocalBookmarks();
    } finally {
      setIsLoading(false);
    }
  }, [loadLocalBookmarks]);

  useEffect(() => {
    loadBookmarks();
  }, [loadBookmarks]);

  const handleRemoveBookmark = async (politicianId: string) => {
    try {
      if (isAuthenticated) {
        const response = await fetch("/api/bookmarks", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ politicianId }),
        });

        if (!response.ok) {
          throw new Error("Failed to remove bookmark");
        }
      } else {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        const politicianIds: string[] = stored ? JSON.parse(stored) : [];
        const updated = politicianIds.filter((id) => id !== politicianId);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
      }

      setBookmarks((prev) => prev.filter((b) => b.politicianId !== politicianId));
    } catch (err) {
      console.error("Remove bookmark error:", err);
      setError("Hindi ma-remove ang bookmark");
    }
  };

  if (isLoading) {
    return <BookmarksSkeleton />;
  }

  if (error && bookmarks.length === 0) {
    return (
      <div className="card text-center">
        <ErrorIcon className="text-error-500 mx-auto h-12 w-12" />
        <p className="text-error-600 dark:text-error-400 mt-4">{error}</p>
        <button
          onClick={() => {
            setError(null);
            setIsLoading(true);
            loadBookmarks();
          }}
          className="btn-primary mt-4"
        >
          Subukan Muli
        </button>
      </div>
    );
  }

  if (bookmarks.length === 0) {
    return <EmptyBookmarks isAuthenticated={isAuthenticated ?? false} />;
  }

  return (
    <div className="space-y-6">
      {error && <p role="alert">{error}</p>}
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {bookmarks.length} na pulitiko ang na-bookmark
        </p>
        {!isAuthenticated && (
          <Link
            href="/auth/login"
            className="text-primary-500 hover:text-primary-600 text-sm hover:underline"
          >
            Mag-login para i-sync ang bookmarks
          </Link>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {bookmarks.map((bookmark) => (
          <BookmarkCard
            key={bookmark.id}
            bookmark={bookmark}
            onRemove={() => handleRemoveBookmark(bookmark.politicianId)}
          />
        ))}
      </div>
    </div>
  );
}

interface BookmarkCardProps {
  bookmark: BookmarkedPolitician;
  onRemove: () => void;
}

function BookmarkCard({ bookmark, onRemove }: BookmarkCardProps) {
  const politician = bookmark.politician;

  if (!politician) {
    return null;
  }

  return (
    <div className="card group hover:border-primary-200 hover:shadow-soft dark:hover:border-primary-800 relative transition-all">
      <button
        onClick={(e) => {
          e.preventDefault();
          onRemove();
        }}
        className="hover:bg-error-100 hover:text-error-600 dark:hover:bg-error-900 dark:hover:text-error-400 absolute top-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
        aria-label={`Remove ${politician.fullName} from bookmarks`}
      >
        <XIcon className="h-4 w-4" />
      </button>

      <Link href={`/politicians/${politician.id}`} className="block">
        <div className="flex items-start gap-4">
          {politician.photo ? (
            <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg">
              <Image
                src={politician.photo}
                alt={politician.fullName}
                fill
                className="object-cover"
                sizes="64px"
              />
            </div>
          ) : (
            <div className="bg-primary-100 dark:bg-primary-900 flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg">
              <span className="text-primary-500 text-xl font-semibold">
                {getInitials(politician.fullName)}
              </span>
            </div>
          )}

          <div className="min-w-0 flex-1 pr-10">
            <h3 className="truncate font-semibold text-neutral-900 dark:text-white">
              {politician.fullName}
            </h3>
            {politician.currentPosition && (
              <p className="mt-1 truncate text-sm text-neutral-600 dark:text-neutral-400">
                {politician.currentPosition}
              </p>
            )}
            {politician.currentLevel && (
              <span className="bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300 mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium">
                {formatLevel(politician.currentLevel)}
              </span>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}

function EmptyBookmarks({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <div className="card py-12 text-center">
      <BookmarkIcon className="mx-auto h-16 w-16 text-neutral-300 dark:text-neutral-700" />
      <h2 className="mt-4 text-xl font-semibold text-neutral-900 dark:text-white">
        Wala ka pang bookmark
      </h2>
      <p className="mx-auto mt-2 max-w-md text-neutral-600 dark:text-neutral-400">
        I-bookmark ang mga pulitiko na gusto mong subaybayan para madali mong ma-access ang kanilang
        profiles.
      </p>
      <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link href="/politicians" className="btn-primary">
          Mag-browse ng Pulitiko
        </Link>
        {!isAuthenticated && (
          <Link href="/auth/login" className="btn-outline">
            Mag-login
          </Link>
        )}
      </div>
      <p className="mt-6 text-sm text-neutral-500">
        💡 Tip: I-click ang bookmark icon sa profile ng pulitiko para i-save sila.
      </p>
    </div>
  );
}

function BookmarksSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="card">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-700" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-3/4 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function getInitials(name: string): string {
  const parts = name.split(" ");
  if (parts.length >= 2) {
    return `${parts[0]?.[0] || ""}${parts[parts.length - 1]?.[0] || ""}`.toUpperCase();
  }
  return (name[0] || "?").toUpperCase();
}

function formatLevel(level: string): string {
  const labels: Record<string, string> = {
    national: "National",
    regional: "Regional",
    provincial: "Provincial",
    city: "City",
    municipal: "Municipal",
    barangay: "Barangay",
  };
  return labels[level] || level;
}

function BookmarkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
      />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
      />
    </svg>
  );
}
