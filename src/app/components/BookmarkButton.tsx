/**
 * Bookmark Button Component
 *
 * A reusable button for bookmarking politicians.
 * Handles both authenticated (server-side) and unauthenticated (local storage) bookmarks.
 *
 * Requirements: 10.1, 10.3
 */

"use client";

import { useState, useEffect, useCallback } from "react";

interface BookmarkButtonProps {
  politicianId: string;
  politicianName?: string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
  onBookmarkChange?: (isBookmarked: boolean) => void;
}

const LOCAL_STORAGE_KEY = "bkib_bookmarks";

export function BookmarkButton({
  politicianId,
  politicianName,
  size = "md",
  showLabel = false,
  className = "",
  onBookmarkChange,
}: BookmarkButtonProps) {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Check authentication status and bookmark state
  useEffect(() => {
    const checkAuthAndBookmarkStatus = async () => {
      try {
        // Check if user is authenticated
        const authResponse = await fetch("/api/auth/profile");
        const isAuth = authResponse.ok;
        setIsAuthenticated(isAuth);

        if (isAuth) {
          // Check server-side bookmark status
          const bookmarkResponse = await fetch(`/api/bookmarks/check?politicianId=${politicianId}`);
          if (bookmarkResponse.ok) {
            const data = await bookmarkResponse.json();
            setIsBookmarked(data.isBookmarked);
          }
        } else {
          // Check local storage
          const localBookmarks = getLocalBookmarks();
          setIsBookmarked(localBookmarks.includes(politicianId));
        }
      } catch {
        // Fallback to local storage on error
        setIsAuthenticated(false);
        const localBookmarks = getLocalBookmarks();
        setIsBookmarked(localBookmarks.includes(politicianId));
      }
    };

    checkAuthAndBookmarkStatus();
  }, [politicianId]);

  const getLocalBookmarks = (): string[] => {
    if (typeof window === "undefined") {
      return [];
    }
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  const setLocalBookmarks = (bookmarks: string[]) => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(bookmarks));
    } catch {
      // Ignore storage errors
    }
  };

  const handleToggleBookmark = useCallback(async () => {
    if (isLoading) {
      return;
    }

    setIsLoading(true);
    const newBookmarkState = !isBookmarked;

    try {
      if (isAuthenticated) {
        // Server-side bookmark
        const response = await fetch("/api/bookmarks", {
          method: newBookmarkState ? "POST" : "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ politicianId }),
        });

        if (!response.ok) {
          throw new Error("Failed to update bookmark");
        }
      } else {
        // Local storage bookmark - Requirement 10.1
        const localBookmarks = getLocalBookmarks();
        if (newBookmarkState) {
          if (!localBookmarks.includes(politicianId)) {
            localBookmarks.push(politicianId);
          }
        } else {
          // Requirement 10.3: Immediately remove from saved list
          const index = localBookmarks.indexOf(politicianId);
          if (index > -1) {
            localBookmarks.splice(index, 1);
          }
        }
        setLocalBookmarks(localBookmarks);
      }

      setIsBookmarked(newBookmarkState);
      onBookmarkChange?.(newBookmarkState);
    } catch (error) {
      console.error("Bookmark error:", error);
      // Revert on error
      setIsBookmarked(!newBookmarkState);
    } finally {
      setIsLoading(false);
    }
  }, [isBookmarked, isLoading, isAuthenticated, politicianId, onBookmarkChange]);

  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  };

  const iconSizes = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  if (showLabel) {
    return (
      <button
        onClick={handleToggleBookmark}
        disabled={isLoading}
        className={`btn ${
          isBookmarked ? "bg-primary-500 hover:bg-primary-600 text-white" : "btn-outline"
        } flex items-center gap-2 ${className}`}
        aria-label={
          isBookmarked
            ? `Remove ${politicianName || "politician"} from bookmarks`
            : `Add ${politicianName || "politician"} to bookmarks`
        }
        aria-pressed={isBookmarked}
      >
        {isLoading ? (
          <LoadingSpinner className={iconSizes[size]} />
        ) : (
          <BookmarkIcon className={iconSizes[size]} filled={isBookmarked} />
        )}
        {isBookmarked ? "Bookmarked" : "Bookmark"}
      </button>
    );
  }

  return (
    <button
      onClick={handleToggleBookmark}
      disabled={isLoading}
      className={`flex items-center justify-center rounded-full transition-all ${
        isBookmarked
          ? "bg-primary-500 hover:bg-primary-600 text-white"
          : "hover:bg-primary-100 hover:text-primary-600 dark:hover:bg-primary-900 dark:hover:text-primary-400 bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
      } ${sizeClasses[size]} ${className}`}
      aria-label={
        isBookmarked
          ? `Remove ${politicianName || "politician"} from bookmarks`
          : `Add ${politicianName || "politician"} to bookmarks`
      }
      aria-pressed={isBookmarked}
    >
      {isLoading ? (
        <LoadingSpinner className={iconSizes[size]} />
      ) : (
        <BookmarkIcon className={iconSizes[size]} filled={isBookmarked} />
      )}
    </button>
  );
}

// Icon Components
function BookmarkIcon({ className, filled }: { className?: string; filled?: boolean }) {
  if (filled) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
      </svg>
    );
  }
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
        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
      />
    </svg>
  );
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

export default BookmarkButton;
