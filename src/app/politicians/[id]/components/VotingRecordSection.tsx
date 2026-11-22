/**
 * Voting Record Section Component
 *
 * Displays a politician's voting record on bills and resolutions.
 * Requirements: 5.1, 5.2
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { VoteType } from "@prisma/client";
import { VotingRecordEntry } from "@/services/legislative.service";
import { SourcesAccordion } from "./SourcesAccordion";

interface VotingRecordSectionProps {
  politicianId: string;
  initialRecords?: VotingRecordEntry[];
  totalCount?: number;
}

export function VotingRecordSection({
  politicianId,
  initialRecords = [],
  totalCount = 0,
}: VotingRecordSectionProps) {
  const [records, setRecords] = useState<VotingRecordEntry[]>(initialRecords);
  const [total, setTotal] = useState(totalCount);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const pageSize = 10;

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });

      const response = await fetch(`/api/politicians/${politicianId}/voting-records?${params}`);
      if (response.ok) {
        const data = await response.json();
        setRecords(data.items);
        setTotal(data.totalCount);
      }
    } catch (error) {
      console.error("Failed to fetch voting records:", error);
    } finally {
      setLoading(false);
    }
  }, [politicianId, page]);

  useEffect(() => {
    if (initialRecords.length === 0) {
      fetchRecords();
    }
  }, [fetchRecords, initialRecords.length]);

  // Calculate vote statistics
  const voteStats = calculateVoteStats(records);
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="card">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">Voting Record</h2>
        <p className="text-sm text-neutral-500">
          {total} recorded vote{total !== 1 ? "s" : ""} on bills and resolutions
        </p>
      </div>

      {/* Vote Statistics Summary */}
      {records.length > 0 && (
        <div className="mb-6 grid grid-cols-3 gap-4">
          <VoteStatCard
            label="Yes Votes"
            count={voteStats.yes}
            total={records.length}
            color="success"
          />
          <VoteStatCard
            label="No Votes"
            count={voteStats.no}
            total={records.length}
            color="error"
          />
          <VoteStatCard
            label="Abstained"
            count={voteStats.abstain}
            total={records.length}
            color="warning"
          />
        </div>
      )}

      {/* Voting Records Table - Requirements 5.1, 5.2 */}
      {loading ? (
        <VotingRecordSkeleton />
      ) : records.length === 0 ? (
        <div className="rounded-lg bg-neutral-50 p-8 text-center dark:bg-neutral-800">
          <svg
            className="mx-auto h-12 w-12 text-neutral-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
          <p className="mt-4 text-neutral-500">No voting records available</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-700">
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">
                    Bill/Resolution
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Vote</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Date</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-neutral-500">
                    Source
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                {records.map((record) => (
                  <VotingRecordRow
                    key={record.id}
                    record={record}
                    isExpanded={expandedId === record.id}
                    onToggle={() => setExpandedId(expandedId === record.id ? null : record.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between border-t border-neutral-200 pt-4 dark:border-neutral-700">
              <p className="text-sm text-neutral-500">
                Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total}{" "}
                records
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-lg border border-neutral-200 px-3 py-1 text-sm disabled:opacity-50 dark:border-neutral-700"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="rounded-lg border border-neutral-200 px-3 py-1 text-sm disabled:opacity-50 dark:border-neutral-700"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface VoteStatCardProps {
  label: string;
  count: number;
  total: number;
  color: "success" | "error" | "warning";
}

function VoteStatCard({ label, count, total, color }: VoteStatCardProps) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  const colorClasses = {
    success: {
      bg: "bg-success-50 dark:bg-success-900/20",
      text: "text-success-600 dark:text-success-400",
      bar: "bg-success-500",
    },
    error: {
      bg: "bg-error-50 dark:bg-error-900/20",
      text: "text-error-600 dark:text-error-400",
      bar: "bg-error-500",
    },
    warning: {
      bg: "bg-warning-50 dark:bg-warning-900/20",
      text: "text-warning-600 dark:text-warning-400",
      bar: "bg-warning-500",
    },
  };

  const classes = colorClasses[color];

  return (
    <div className={`rounded-lg p-4 ${classes.bg}`}>
      <p className="text-sm text-neutral-500">{label}</p>
      <p className={`text-2xl font-bold ${classes.text}`}>{count}</p>
      <div className="mt-2 h-1.5 w-full rounded-full bg-neutral-200 dark:bg-neutral-700">
        <div className={`h-1.5 rounded-full ${classes.bar}`} style={{ width: `${percentage}%` }} />
      </div>
      <p className="mt-1 text-xs text-neutral-500">{percentage}% of votes</p>
    </div>
  );
}

interface VotingRecordRowProps {
  record: VotingRecordEntry;
  isExpanded: boolean;
  onToggle: () => void;
}

function VotingRecordRow({ record, isExpanded, onToggle }: VotingRecordRowProps) {
  const voteConfig = getVoteConfig(record.vote);

  return (
    <>
      <tr className="hover:bg-neutral-50 dark:hover:bg-neutral-800">
        <td className="px-4 py-3">
          <div>
            <span className="font-mono text-sm text-neutral-600 dark:text-neutral-400">
              {record.billNumber}
            </span>
            <p className="mt-1 text-sm text-neutral-900 dark:text-white">{record.billTitle}</p>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={`badge ${voteConfig.badgeClass}`}>
            {voteConfig.icon}
            {voteConfig.label}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-neutral-500">{formatDate(record.voteDate)}</td>
        <td className="px-4 py-3 text-right">
          {record.sources.length > 0 && (
            <button onClick={onToggle} className="text-primary-500 hover:text-primary-600 text-sm">
              {isExpanded ? "Hide" : "View"} Source
            </button>
          )}
        </td>
      </tr>
      {isExpanded && record.sources.length > 0 && (
        <tr>
          <td colSpan={4} className="px-4 py-3">
            <SourcesAccordion sources={record.sources} />
          </td>
        </tr>
      )}
    </>
  );
}

function VotingRecordSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" />
      ))}
    </div>
  );
}

function calculateVoteStats(records: VotingRecordEntry[]) {
  return records.reduce(
    (acc, record) => {
      acc[record.vote]++;
      return acc;
    },
    { yes: 0, no: 0, abstain: 0 } as Record<VoteType, number>
  );
}

function getVoteConfig(vote: VoteType) {
  const configs: Record<VoteType, { label: string; badgeClass: string; icon: React.ReactNode }> = {
    [VoteType.yes]: {
      label: "Yes",
      badgeClass: "bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300",
      icon: (
        <svg className="mr-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    [VoteType.no]: {
      label: "No",
      badgeClass: "bg-error-100 text-error-700 dark:bg-error-900 dark:text-error-300",
      icon: (
        <svg className="mr-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    [VoteType.abstain]: {
      label: "Abstain",
      badgeClass: "bg-warning-100 text-warning-700 dark:bg-warning-900 dark:text-warning-300",
      icon: (
        <svg className="mr-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
  };

  return configs[vote];
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
