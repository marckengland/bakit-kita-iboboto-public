/**
 * Attendance Section Component
 *
 * Displays session attendance statistics and records.
 * Requirements: 5.3, 5.4, 5.5
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { AttendanceStatus, Chamber } from "@prisma/client";
import { AttendanceStats, AttendanceEntry } from "@/services/legislative.service";
import { SourcesAccordion } from "./SourcesAccordion";
import { useTranslations } from "next-intl";

interface AttendanceSectionProps {
  politicianId: string;
  initialStats?: AttendanceStats | null;
  initialRecords?: AttendanceEntry[];
  totalCount?: number;
}

export function AttendanceSection({
  politicianId,
  initialStats = null,
  initialRecords = [],
  totalCount = 0,
}: AttendanceSectionProps) {
  const t = useTranslations("dataStates");
  const [statsUnavailable, setStatsUnavailable] = useState(false);
  const [stats, setStats] = useState<AttendanceStats | null>(initialStats);
  const [records, setRecords] = useState<AttendanceEntry[]>(initialRecords);
  const [total, setTotal] = useState(totalCount);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [showRecords, setShowRecords] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const pageSize = 10;

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`/api/politicians/${politicianId}/attendance/stats`);
      if (!response.ok) {
        throw new Error("Attendance lookup failed");
      }
      const data = await response.json();
      setStats(data);
      setStatsUnavailable(false);
    } catch (error) {
      console.error("Failed to fetch attendance stats:", error);
      setStatsUnavailable(true);
    }
  }, [politicianId]);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });

      const response = await fetch(`/api/politicians/${politicianId}/attendance/records?${params}`);
      if (response.ok) {
        const data = await response.json();
        setRecords(data.items);
        setTotal(data.totalCount);
      }
    } catch (error) {
      console.error("Failed to fetch attendance records:", error);
    } finally {
      setLoading(false);
    }
  }, [politicianId, page]);

  useEffect(() => {
    if (!initialStats) {
      fetchStats();
    }
  }, [fetchStats, initialStats]);

  useEffect(() => {
    if (showRecords && initialRecords.length === 0) {
      fetchRecords();
    }
  }, [fetchRecords, showRecords, initialRecords.length]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="card">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
          Session Attendance
        </h2>
        <p className="text-sm text-neutral-500">Legislative session attendance record</p>
      </div>

      {/* Attendance Statistics - Requirements 5.3, 5.4 */}
      {statsUnavailable ? (
        <p role="status">{t("unavailable")}</p>
      ) : stats && stats.totalSessions === 0 ? (
        <div className="rounded-lg bg-neutral-50 p-6 dark:bg-neutral-800">
          <p className="font-medium">{t("attendanceEmpty")}</p>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            {t("attendanceHint")}
          </p>
        </div>
      ) : stats ? (
        <div className="space-y-6">
          {/* Overall Attendance */}
          <div className="rounded-lg bg-neutral-50 p-6 dark:bg-neutral-800">
            <div className="flex flex-col items-center justify-center sm:flex-row sm:justify-between">
              <div className="text-center sm:text-left">
                <p className="text-sm text-neutral-500">Overall Attendance Rate</p>
                <p className="text-4xl font-bold text-neutral-900 dark:text-white">
                  {stats.attendancePercentage.toFixed(1)}%
                </p>
              </div>
              <AttendanceGauge percentage={stats.attendancePercentage} />
            </div>

            {/* Session Breakdown - Requirement 5.4 */}
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatItem label="Total Sessions" value={stats.totalSessions} color="neutral" />
              <StatItem label="Attended" value={stats.sessionsAttended} color="success" />
              <StatItem
                label="Excused Absences"
                value={stats.sessionsAbsentExcused}
                color="warning"
              />
              {/* Requirement 5.5 - Show excused vs unexcused */}
              <StatItem
                label="Unexcused Absences"
                value={stats.sessionsAbsentUnexcused}
                color="error"
              />
            </div>
          </div>

          {/* Attendance by Chamber */}
          {stats.byChember.length > 0 && (
            <div>
              <h3 className="mb-4 text-sm font-semibold text-neutral-500 uppercase">
                Attendance by Chamber
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {stats.byChember.map((chamber) => (
                  <ChamberAttendanceCard
                    key={chamber.chamber}
                    chamber={chamber.chamber}
                    totalSessions={chamber.totalSessions}
                    sessionsAttended={chamber.sessionsAttended}
                    attendancePercentage={chamber.attendancePercentage}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Toggle Records View */}
          <div className="border-t border-neutral-200 pt-4 dark:border-neutral-700">
            <button
              onClick={() => setShowRecords(!showRecords)}
              className="text-primary-500 hover:text-primary-600 flex items-center gap-2 text-sm"
            >
              <svg
                className={`h-4 w-4 transition-transform ${showRecords ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
              {showRecords ? "Hide" : "View"} Detailed Records
            </button>
          </div>

          {/* Attendance Records Table */}
          {showRecords && (
            <div className="mt-4">
              {loading ? (
                <AttendanceRecordsSkeleton />
              ) : records.length === 0 ? (
                <p className="text-center text-neutral-500">No detailed records available</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-neutral-200 dark:border-neutral-700">
                          <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">
                            Date
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">
                            Chamber
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">
                            Status
                          </th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-neutral-500">
                            Source
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                        {records.map((record) => (
                          <AttendanceRecordRow
                            key={record.id}
                            record={record}
                            isExpanded={expandedId === record.id}
                            onToggle={() =>
                              setExpandedId(expandedId === record.id ? null : record.id)
                            }
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="mt-4 flex items-center justify-between border-t border-neutral-200 pt-4 dark:border-neutral-700">
                      <p className="text-sm text-neutral-500">
                        Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of{" "}
                        {total} records
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
          )}
        </div>
      ) : (
        <AttendanceStatsSkeleton />
      )}
    </div>
  );
}

interface AttendanceGaugeProps {
  percentage: number;
}

function AttendanceGauge({ percentage }: AttendanceGaugeProps) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const getColor = (pct: number) => {
    if (pct >= 80) {
      return "text-success-500";
    }
    if (pct >= 60) {
      return "text-warning-500";
    }
    return "text-error-500";
  };

  return (
    <div className="relative h-24 w-24">
      <svg className="h-24 w-24 -rotate-90 transform">
        <circle
          cx="48"
          cy="48"
          r={radius}
          stroke="currentColor"
          strokeWidth="8"
          fill="none"
          className="text-neutral-200 dark:text-neutral-700"
        />
        <circle
          cx="48"
          cy="48"
          r={radius}
          stroke="currentColor"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={getColor(percentage)}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-lg font-bold ${getColor(percentage)}`}>
          {percentage.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

interface StatItemProps {
  label: string;
  value: number;
  color: "neutral" | "success" | "warning" | "error";
}

function StatItem({ label, value, color }: StatItemProps) {
  const colorClasses = {
    neutral: "text-neutral-900 dark:text-white",
    success: "text-success-600 dark:text-success-400",
    warning: "text-warning-600 dark:text-warning-400",
    error: "text-error-600 dark:text-error-400",
  };

  return (
    <div className="text-center">
      <p className={`text-2xl font-bold ${colorClasses[color]}`}>{value}</p>
      <p className="text-xs text-neutral-500">{label}</p>
    </div>
  );
}

interface ChamberAttendanceCardProps {
  chamber: Chamber;
  totalSessions: number;
  sessionsAttended: number;
  attendancePercentage: number;
}

function ChamberAttendanceCard({
  chamber,
  totalSessions,
  sessionsAttended,
  attendancePercentage,
}: ChamberAttendanceCardProps) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-neutral-900 dark:text-white">
            {chamber === Chamber.senate ? "Senate" : "House of Representatives"}
          </p>
          <p className="text-sm text-neutral-500">
            {sessionsAttended} of {totalSessions} sessions
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-neutral-900 dark:text-white">
            {attendancePercentage.toFixed(1)}%
          </p>
        </div>
      </div>
      <div className="mt-3 h-2 w-full rounded-full bg-neutral-200 dark:bg-neutral-700">
        <div
          className={`h-2 rounded-full ${
            attendancePercentage >= 80
              ? "bg-success-500"
              : attendancePercentage >= 60
                ? "bg-warning-500"
                : "bg-error-500"
          }`}
          style={{ width: `${attendancePercentage}%` }}
        />
      </div>
    </div>
  );
}

interface AttendanceRecordRowProps {
  record: AttendanceEntry;
  isExpanded: boolean;
  onToggle: () => void;
}

function AttendanceRecordRow({ record, isExpanded, onToggle }: AttendanceRecordRowProps) {
  const statusConfig = getStatusConfig(record.status);

  return (
    <>
      <tr className="hover:bg-neutral-50 dark:hover:bg-neutral-800">
        <td className="px-4 py-3 text-sm text-neutral-900 dark:text-white">
          {formatDate(record.sessionDate)}
        </td>
        <td className="px-4 py-3 text-sm text-neutral-500">
          {record.chamber === Chamber.senate ? "Senate" : "House"}
        </td>
        <td className="px-4 py-3">
          <span className={`badge ${statusConfig.badgeClass}`}>
            {statusConfig.icon}
            {statusConfig.label}
          </span>
        </td>
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

function AttendanceStatsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-32 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800"
          />
        ))}
      </div>
    </div>
  );
}

function AttendanceRecordsSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" />
      ))}
    </div>
  );
}

function getStatusConfig(status: AttendanceStatus) {
  const configs: Record<
    AttendanceStatus,
    { label: string; badgeClass: string; icon: React.ReactNode }
  > = {
    [AttendanceStatus.present]: {
      label: "Present",
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
    [AttendanceStatus.absent_excused]: {
      label: "Excused",
      badgeClass: "bg-warning-100 text-warning-700 dark:bg-warning-900 dark:text-warning-300",
      icon: (
        <svg className="mr-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    [AttendanceStatus.absent_unexcused]: {
      label: "Unexcused",
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
  };

  return configs[status];
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
