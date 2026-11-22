/**
 * My Reports Section Component
 *
 * Displays user's submitted reports with verification status.
 * Requirements: 28.4, 28.5
 */

"use client";

import { useState, useEffect } from "react";

interface ReportSummary {
  id: string;
  politicianId: string;
  politicianName: string;
  reportType: "new_info" | "correction" | "controversy";
  content: string;
  status: "pending" | "verified" | "rejected";
  evidenceCount: number;
  createdAt: string;
  verificationStatus?: string;
  verificationConfidence?: number;
}

interface ReportStats {
  total: number;
  pending: number;
  verified: number;
  rejected: number;
}

export function MyReportsSection() {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "verified" | "rejected">("all");

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/reports");

      if (response.status === 401) {
        setError("Please log in to view your reports");
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch reports");
      }

      const data = await response.json();
      setReports(data.reports || []);
      setStats(data.stats || null);
    } catch (err) {
      console.error("Fetch error:", err);
      setError("Failed to load reports. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredReports = filter === "all" ? reports : reports.filter((r) => r.status === filter);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
            <CheckIcon className="h-3 w-3" />
            Verified
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900 dark:text-red-200">
            <XIcon className="h-3 w-3" />
            Rejected
          </span>
        );
      case "pending":
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
            <ClockIcon className="h-3 w-3" />
            Pending Review
          </span>
        );
    }
  };

  const getReportTypeLabel = (type: string) => {
    switch (type) {
      case "new_info":
        return "New Information";
      case "correction":
        return "Correction";
      case "controversy":
        return "Controversy";
      default:
        return type;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {/* Stats Skeleton */}
        <div className="grid gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800"
            />
          ))}
        </div>
        {/* Reports Skeleton */}
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
          <UserIcon className="h-6 w-6 text-neutral-400" />
        </div>
        <h3 className="mb-2 text-lg font-medium text-neutral-900 dark:text-white">{error}</h3>
        <p className="mb-4 text-sm text-neutral-500">
          Log in to track your submitted reports and their verification status.
        </p>
        <a
          href="/auth/login"
          className="bg-primary-500 hover:bg-primary-600 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white"
        >
          Log In
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="card">
            <p className="text-sm text-neutral-500">Total Reports</p>
            <p className="text-2xl font-bold text-neutral-900 dark:text-white">{stats.total}</p>
          </div>
          <div className="card">
            <p className="text-sm text-neutral-500">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          </div>
          <div className="card">
            <p className="text-sm text-neutral-500">Verified</p>
            <p className="text-2xl font-bold text-green-600">{stats.verified}</p>
          </div>
          <div className="card">
            <p className="text-sm text-neutral-500">Rejected</p>
            <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2">
        {(["all", "pending", "verified", "rejected"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === f
                ? "bg-primary-500 text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Reports List */}
      {filteredReports.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
            <DocumentIcon className="h-6 w-6 text-neutral-400" />
          </div>
          <h3 className="mb-2 text-lg font-medium text-neutral-900 dark:text-white">
            {filter === "all" ? "No reports yet" : `No ${filter} reports`}
          </h3>
          <p className="text-sm text-neutral-500">
            {filter === "all"
              ? "Submit your first report to help improve transparency."
              : "You don't have any reports with this status."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredReports.map((report) => (
            <div
              key={report.id}
              className="card hover:border-neutral-300 dark:hover:border-neutral-600"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {getStatusBadge(report.status)}
                    <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                      {getReportTypeLabel(report.reportType)}
                    </span>
                  </div>
                  <h4 className="font-medium text-neutral-900 dark:text-white">
                    {report.politicianName}
                  </h4>
                  <p className="mt-1 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-400">
                    {report.content}
                  </p>
                  <div className="mt-3 flex items-center gap-4 text-xs text-neutral-500">
                    <span className="flex items-center gap-1">
                      <DocumentIcon className="h-3.5 w-3.5" />
                      {report.evidenceCount} evidence
                    </span>
                    <span>
                      {new Date(report.createdAt).toLocaleDateString("en-PH", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>
                <a
                  href={`/report/${report.id}`}
                  className="flex-shrink-0 rounded-lg bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                >
                  View
                </a>
              </div>

              {/* Verification Result */}
              {report.status === "verified" && report.verificationConfidence && (
                <div className="mt-3 rounded-lg bg-green-50 p-3 dark:bg-green-950">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    <span className="font-medium">Verified</span> with{" "}
                    {Math.round(report.verificationConfidence * 100)}% confidence
                  </p>
                </div>
              )}

              {report.status === "rejected" && (
                <div className="mt-3 rounded-lg bg-red-50 p-3 dark:bg-red-950">
                  <p className="text-sm text-red-800 dark:text-red-200">
                    This report could not be verified against official sources.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Icon Components
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
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

function ClockIcon({ className }: { className?: string }) {
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
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
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
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
      />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
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
        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
      />
    </svg>
  );
}
