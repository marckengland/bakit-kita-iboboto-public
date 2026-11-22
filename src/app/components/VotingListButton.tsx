/**
 * Voting List Button Component
 *
 * A button for adding/removing politicians from the user's voting list.
 * Only available for authenticated users.
 *
 * Requirements: 17.1, 17.3
 */

"use client";

import { useState, useEffect, useCallback } from "react";

interface VotingListButtonProps {
  politicianId: string;
  politicianName?: string;
  position: string;
  electionYear?: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
  onListChange?: (isInList: boolean) => void;
}

export function VotingListButton({
  politicianId,
  politicianName,
  position,
  electionYear = new Date().getFullYear() + (new Date().getMonth() >= 6 ? 1 : 0),
  size = "md",
  showLabel = false,
  className = "",
  onListChange,
}: VotingListButtonProps) {
  const [isInList, setIsInList] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuthAndListStatus = async () => {
      try {
        const authResponse = await fetch("/api/auth/profile");
        const isAuth = authResponse.ok;
        setIsAuthenticated(isAuth);

        if (isAuth) {
          const listResponse = await fetch(
            `/api/voting-list/check?politicianId=${politicianId}&electionYear=${electionYear}`
          );
          if (listResponse.ok) {
            const data = await listResponse.json();
            setIsInList(data.isInList);
          }
        }
      } catch {
        setIsAuthenticated(false);
      }
    };

    checkAuthAndListStatus();
  }, [politicianId, electionYear]);

  const handleToggleList = useCallback(async () => {
    if (isLoading || !isAuthenticated) {
      return;
    }

    setIsLoading(true);
    const newListState = !isInList;

    try {
      const response = await fetch("/api/voting-list", {
        method: newListState ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          politicianId,
          position,
          electionYear,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update voting list");
      }

      // Requirement 17.3: Immediately update list
      setIsInList(newListState);
      onListChange?.(newListState);
    } catch (error) {
      console.error("Voting list error:", error);
      setIsInList(!newListState);
    } finally {
      setIsLoading(false);
    }
  }, [isInList, isLoading, isAuthenticated, politicianId, position, electionYear, onListChange]);

  // Don't render if not authenticated
  if (isAuthenticated === false) {
    return null;
  }

  // Show loading state while checking auth
  if (isAuthenticated === null) {
    return (
      <div
        className={`animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-700 ${
          showLabel ? "h-10 w-32" : "h-10 w-10"
        }`}
      />
    );
  }

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
        onClick={handleToggleList}
        disabled={isLoading}
        className={`btn ${
          isInList
            ? "bg-success-500 hover:bg-success-600 text-white"
            : "btn-outline border-success-500 text-success-600 hover:bg-success-500 hover:text-white"
        } flex items-center gap-2 ${className}`}
        aria-label={
          isInList
            ? `Remove ${politicianName || "politician"} from voting list`
            : `Add ${politicianName || "politician"} to voting list`
        }
        aria-pressed={isInList}
      >
        {isLoading ? (
          <LoadingSpinner className={iconSizes[size]} />
        ) : (
          <ChecklistIcon className={iconSizes[size]} filled={isInList} />
        )}
        {isInList ? "Sa Voting List" : "Idagdag sa List"}
      </button>
    );
  }

  return (
    <button
      onClick={handleToggleList}
      disabled={isLoading}
      className={`flex items-center justify-center rounded-full transition-all ${
        isInList
          ? "bg-success-500 hover:bg-success-600 text-white"
          : "hover:bg-success-100 hover:text-success-600 dark:hover:bg-success-900 dark:hover:text-success-400 bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
      } ${sizeClasses[size]} ${className}`}
      aria-label={
        isInList
          ? `Remove ${politicianName || "politician"} from voting list`
          : `Add ${politicianName || "politician"} to voting list`
      }
      aria-pressed={isInList}
      title={isInList ? "Nasa voting list na" : "Idagdag sa voting list"}
    >
      {isLoading ? (
        <LoadingSpinner className={iconSizes[size]} />
      ) : (
        <ChecklistIcon className={iconSizes[size]} filled={isInList} />
      )}
    </button>
  );
}

function ChecklistIcon({ className, filled }: { className?: string; filled?: boolean }) {
  if (filled) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M7.502 6h7.128A3.375 3.375 0 0118 9.375v9.375a3 3 0 003-3V6.108c0-1.505-1.125-2.811-2.664-2.94a48.972 48.972 0 00-.673-.05A3 3 0 0015 1.5h-1.5a3 3 0 00-2.663 1.618c-.225.015-.45.032-.673.05C8.662 3.295 7.554 4.542 7.502 6zM13.5 3A1.5 1.5 0 0012 4.5h4.5A1.5 1.5 0 0015 3h-1.5z"
          clipRule="evenodd"
        />
        <path
          fillRule="evenodd"
          d="M3 9.375C3 8.339 3.84 7.5 4.875 7.5h9.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-9.75A1.875 1.875 0 013 20.625V9.375zm9.586 4.594a.75.75 0 00-1.172-.938l-2.476 3.096-.908-.907a.75.75 0 00-1.06 1.06l1.5 1.5a.75.75 0 001.116-.062l3-3.75z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
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
        d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
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

export default VotingListButton;
