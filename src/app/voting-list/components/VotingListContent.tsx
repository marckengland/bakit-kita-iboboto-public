/**
 * Voting List Content Component
 *
 * Displays voting list organized by position level with export and sharing functionality.
 * Requirements: 17.2, 17.3, 17.5, 42.3, 42.6
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { SocialShareButtons } from "@/app/components/SocialShareButtons";

interface VotingListItem {
  id: string;
  politicianId: string;
  position: string;
  addedAt: string;
  politician?: {
    id: string;
    fullName: string;
    photo: string | null;
  };
}

interface VotingListByLevel {
  national: VotingListItem[];
  regional: VotingListItem[];
  provincial: VotingListItem[];
  city: VotingListItem[];
  municipal: VotingListItem[];
  barangay: VotingListItem[];
}

const LEVEL_ORDER = [
  "national",
  "regional",
  "provincial",
  "city",
  "municipal",
  "barangay",
] as const;
const LEVEL_LABELS: Record<string, string> = {
  national: "National",
  regional: "Regional",
  provincial: "Provincial",
  city: "City/Municipal",
  municipal: "Municipal",
  barangay: "Barangay",
};

export function VotingListContent() {
  const [byLevel, setByLevel] = useState<VotingListByLevel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [electionYear, setElectionYear] = useState(getDefaultElectionYear());
  const [isExporting, setIsExporting] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);

  const checkAuthAndLoadList = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const authResponse = await fetch("/api/auth/profile");

      // Handle non-authenticated state gracefully
      if (authResponse.status === 401) {
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      // Handle server errors
      if (!authResponse.ok) {
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      setIsAuthenticated(true);

      const listResponse = await fetch(`/api/voting-list?electionYear=${electionYear}`);
      if (listResponse.ok) {
        const data = await listResponse.json();
        setByLevel(data.byLevel);
      } else if (listResponse.status === 401) {
        setIsAuthenticated(false);
      } else {
        setError("Hindi ma-load ang voting list");
      }
    } catch {
      // Network error or server down - show login screen
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, [electionYear]);

  useEffect(() => {
    checkAuthAndLoadList();
  }, [checkAuthAndLoadList]);

  const handleRemoveFromList = async (politicianId: string) => {
    try {
      const response = await fetch("/api/voting-list", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ politicianId, electionYear }),
      });

      if (!response.ok) {
        throw new Error("Failed to remove from list");
      }

      // Update UI immediately - Requirement 17.3
      setByLevel((prev) => {
        if (!prev) {
          return prev;
        }
        const updated = { ...prev };
        for (const level of LEVEL_ORDER) {
          updated[level] = updated[level].filter((item) => item.politicianId !== politicianId);
        }
        return updated;
      });
    } catch (error) {
      console.error("Remove from list error:", error);
      setError("Hindi ma-remove sa list");
    }
  };

  // Requirement 17.5: Export functionality
  const handleExport = async (format: "text" | "csv" | "json" | "html") => {
    setIsExporting(true);
    try {
      const response = await fetch(
        `/api/voting-list/export?electionYear=${electionYear}&format=${format}`
      );

      if (!response.ok) {
        throw new Error("Export failed");
      }

      if (format === "json") {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        downloadBlob(blob, `voting-list-${electionYear}.json`);
      } else {
        const blob = await response.blob();
        const ext = format === "csv" ? "csv" : format === "html" ? "html" : "txt";
        downloadBlob(blob, `voting-list-${electionYear}.${ext}`);
      }
    } catch (error) {
      console.error("Export error:", error);
      setError("Hindi ma-export ang list");
    } finally {
      setIsExporting(false);
      setShowShareMenu(false);
    }
  };

  if (isLoading) {
    return <VotingListSkeleton />;
  }

  // Not authenticated
  if (isAuthenticated === false) {
    return <LoginRequired />;
  }

  if (error && !byLevel) {
    return (
      <div className="card text-center">
        <ErrorIcon className="text-error-500 mx-auto h-12 w-12" />
        <p className="text-error-600 dark:text-error-400 mt-4">{error}</p>
        <button onClick={checkAuthAndLoadList} className="btn-primary mt-4">
          Subukan Muli
        </button>
      </div>
    );
  }

  const totalCount = byLevel
    ? Object.values(byLevel).reduce((sum, items) => sum + items.length, 0)
    : 0;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Year Selector */}
        <div className="flex items-center gap-3">
          <label
            htmlFor="electionYear"
            className="text-sm font-medium text-neutral-700 dark:text-neutral-300"
          >
            Eleksyon:
          </label>
          <select
            id="electionYear"
            value={electionYear}
            onChange={(e) => setElectionYear(parseInt(e.target.value, 10))}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800"
          >
            {getElectionYearOptions().map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        {/* Export/Share - Requirements 17.5, 42.3, 42.6 */}
        {totalCount > 0 && (
          <div className="flex items-center gap-3">
            {/* Export Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowShareMenu(!showShareMenu)}
                className="btn-outline flex items-center gap-2"
                disabled={isExporting}
              >
                {isExporting ? (
                  <LoadingSpinner className="h-4 w-4" />
                ) : (
                  <DownloadIcon className="h-4 w-4" />
                )}
                Export
              </button>

              {showShareMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowShareMenu(false)} />
                  <div className="absolute top-full right-0 z-20 mt-2 w-56 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-800">
                    <div className="px-4 py-2 text-xs font-semibold text-neutral-500 uppercase">
                      Export Format
                    </div>
                    <button
                      onClick={() => handleExport("html")}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700"
                    >
                      <PrintIcon className="h-4 w-4" />
                      Printable (HTML/PDF)
                    </button>
                    <button
                      onClick={() => handleExport("text")}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700"
                    >
                      <DocumentIcon className="h-4 w-4" />
                      Plain Text
                    </button>
                    <button
                      onClick={() => handleExport("csv")}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700"
                    >
                      <TableIcon className="h-4 w-4" />
                      CSV Spreadsheet
                    </button>
                    <button
                      onClick={() => handleExport("json")}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700"
                    >
                      <CodeIcon className="h-4 w-4" />
                      JSON Data
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Social Share Buttons - Requirement 42.6 */}
            <SocialShareButtons
              type="voting-list"
              url={typeof window !== "undefined" ? window.location.href : ""}
              data={{ electionYear, count: totalCount }}
              variant="dropdown"
            />
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4">
        <p className="text-primary-700 dark:text-primary-300 text-sm">
          <strong>{totalCount}</strong> kandidato sa iyong voting list para sa{" "}
          <strong>{electionYear}</strong> elections
        </p>
      </div>

      {/* Empty State */}
      {totalCount === 0 && <EmptyVotingList />}

      {/* Voting List by Level - Requirement 17.2 */}
      {byLevel && totalCount > 0 && (
        <div className="space-y-6">
          {LEVEL_ORDER.map((level) => {
            const items = byLevel[level];
            if (items.length === 0) {
              return null;
            }

            return (
              <div key={level} className="card">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-neutral-900 dark:text-white">
                  <LevelIcon level={level} className="text-primary-500 h-5 w-5" />
                  {LEVEL_LABELS[level]}
                  <span className="bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300 ml-auto rounded-full px-2 py-0.5 text-sm font-medium">
                    {items.length}
                  </span>
                </h2>

                <div className="space-y-3">
                  {items.map((item) => (
                    <VotingListItemCard
                      key={item.id}
                      item={item}
                      onRemove={() => handleRemoveFromList(item.politicianId)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface VotingListItemCardProps {
  item: VotingListItem;
  onRemove: () => void;
}

function VotingListItemCard({ item, onRemove }: VotingListItemCardProps) {
  const politician = item.politician;

  return (
    <div className="group hover:border-primary-200 dark:hover:border-primary-800 flex items-center gap-4 rounded-lg border border-neutral-200 p-3 transition-all dark:border-neutral-700">
      {/* Photo */}
      {politician?.photo ? (
        <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg">
          <Image
            src={politician.photo}
            alt={politician.fullName}
            fill
            className="object-cover"
            sizes="48px"
          />
        </div>
      ) : (
        <div className="bg-primary-100 dark:bg-primary-900 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg">
          <span className="text-primary-500 text-lg font-semibold">
            {politician ? getInitials(politician.fullName) : "?"}
          </span>
        </div>
      )}

      {/* Info */}
      <div className="min-w-0 flex-1">
        <Link
          href={`/politicians/${item.politicianId}`}
          className="hover:text-primary-500 font-medium text-neutral-900 dark:text-white"
        >
          {politician?.fullName || "Unknown"}
        </Link>
        <p className="text-sm text-neutral-500">{item.position}</p>
      </div>

      {/* Remove Button */}
      <button
        onClick={onRemove}
        className="hover:bg-error-100 hover:text-error-600 dark:hover:bg-error-900 dark:hover:text-error-400 flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 opacity-0 transition-all group-hover:opacity-100"
        aria-label={`Remove ${politician?.fullName || "politician"} from voting list`}
      >
        <XIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

function EmptyVotingList() {
  return (
    <div className="card py-12 text-center">
      <ChecklistIcon className="mx-auto h-16 w-16 text-neutral-300 dark:text-neutral-700" />
      <h2 className="mt-4 text-xl font-semibold text-neutral-900 dark:text-white">
        Walang laman ang voting list mo
      </h2>
      <p className="mx-auto mt-2 max-w-md text-neutral-600 dark:text-neutral-400">
        Magdagdag ng mga kandidato sa iyong voting list para madali mong ma-organize ang iyong mga
        pipiliin sa eleksyon.
      </p>
      <Link href="/politicians" className="btn-primary mt-6">
        Mag-browse ng Kandidato
      </Link>
      <p className="mt-6 text-sm text-neutral-500">
        💡 Tip: I-click ang checklist icon sa profile ng pulitiko para idagdag sila sa iyong list.
      </p>
    </div>
  );
}

function LoginRequired() {
  return (
    <div className="card py-12 text-center">
      <LockIcon className="mx-auto h-16 w-16 text-neutral-300 dark:text-neutral-700" />
      <h2 className="mt-4 text-xl font-semibold text-neutral-900 dark:text-white">
        Kailangan mag-login
      </h2>
      <p className="mx-auto mt-2 max-w-md text-neutral-600 dark:text-neutral-400">
        Ang voting list feature ay para sa mga verified users lamang. Mag-login gamit ang iyong
        National ID o Passport para ma-access ang feature na ito.
      </p>
      <Link href="/auth/login" className="btn-primary mt-6">
        Mag-login
      </Link>
    </div>
  );
}

function VotingListSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-10 w-48 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-700" />
      <div className="h-16 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-700" />
      {[1, 2].map((i) => (
        <div key={i} className="card">
          <div className="mb-4 h-6 w-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
          <div className="space-y-3">
            {[1, 2, 3].map((j) => (
              <div
                key={j}
                className="flex items-center gap-4 rounded-lg border border-neutral-200 p-3 dark:border-neutral-700"
              >
                <div className="h-12 w-12 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Helper functions
function getDefaultElectionYear(): number {
  const now = new Date();
  const year = now.getFullYear();
  // If past June, default to next year's election
  return now.getMonth() >= 6 ? year + 1 : year;
}

function getElectionYearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = currentYear - 2; y <= currentYear + 3; y++) {
    years.push(y);
  }
  return years;
}

function getInitials(name: string): string {
  const parts = name.split(" ");
  if (parts.length >= 2) {
    return `${parts[0]?.[0] || ""}${parts[parts.length - 1]?.[0] || ""}`.toUpperCase();
  }
  return (name[0] || "?").toUpperCase();
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Icon Components
function LevelIcon({ level, className }: { level: string; className?: string }) {
  const icons: Record<string, React.ReactNode> = {
    national: (
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
          d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z"
        />
      </svg>
    ),
    regional: (
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
          d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z"
        />
      </svg>
    ),
    provincial: (
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
          d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z"
        />
      </svg>
    ),
  };
  return icons[level] || icons.provincial;
}

function ChecklistIcon({ className }: { className?: string }) {
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
        d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
      />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
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
        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
      />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
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
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  );
}

function PrintIcon({ className }: { className?: string }) {
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
        d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z"
      />
    </svg>
  );
}

function DocumentIcon({ className }: { className?: string }) {
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
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
      />
    </svg>
  );
}

function TableIcon({ className }: { className?: string }) {
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
        d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5"
      />
    </svg>
  );
}

function CodeIcon({ className }: { className?: string }) {
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
        d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"
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
