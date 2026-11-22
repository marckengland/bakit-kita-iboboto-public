/**
 * SALN Section Component
 *
 * Displays SALN (Statement of Assets, Liabilities, and Net Worth) data
 * with timeline chart and anomaly indicators.
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 15.1, 15.2, 15.3, 15.6
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { SALNRecordData, NetWorthTimelinePoint } from "@/services/saln.service";
import { SALNDetailModal } from "./SALNDetailModal";
import { SourcesAccordion } from "./SourcesAccordion";

interface SALNSectionProps {
  politicianId: string;
  initialRecords?: SALNRecordData[];
  initialTimeline?: NetWorthTimelinePoint[];
}

export function SALNSection({
  politicianId,
  initialRecords = [],
  initialTimeline = [],
}: SALNSectionProps) {
  const [records, setRecords] = useState<SALNRecordData[]>(initialRecords);
  const [timeline, setTimeline] = useState<NetWorthTimelinePoint[]>(initialTimeline);
  const [loading, setLoading] = useState(initialRecords.length === 0);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  const fetchSALNData = useCallback(async () => {
    setLoading(true);
    try {
      const [recordsRes, timelineRes] = await Promise.all([
        fetch(`/api/politicians/${politicianId}/saln`),
        fetch(`/api/politicians/${politicianId}/saln/timeline`),
      ]);

      if (recordsRes.ok) {
        const data = await recordsRes.json();
        setRecords(data);
      }
      if (timelineRes.ok) {
        const data = await timelineRes.json();
        setTimeline(data);
      }
    } catch (error) {
      console.error("Failed to fetch SALN data:", error);
    } finally {
      setLoading(false);
    }
  }, [politicianId]);

  useEffect(() => {
    if (initialRecords.length === 0) {
      fetchSALNData();
    }
  }, [fetchSALNData, initialRecords.length]);

  // Calculate summary stats
  const latestRecord = records[records.length - 1];
  const earliestRecord = records[0];
  const anomalyCount = records.filter((r) => r.anomalyDetected).length;

  // Requirement 6.4 - Handle unavailable SALN data
  if (!loading && records.length === 0) {
    return (
      <div className="card">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
            <svg className="h-5 w-5 text-neutral-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">SALN Records</h2>
            <p className="text-sm text-neutral-500">
              Statement of Assets, Liabilities, and Net Worth
            </p>
          </div>
        </div>
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
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="mt-4 text-neutral-600 dark:text-neutral-400">
            No public SALN records available
          </p>
          <p className="mt-2 text-sm text-neutral-500">
            SALN data will be displayed when official records become available.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary-100 dark:bg-primary-900 flex h-10 w-10 items-center justify-center rounded-full">
            <svg className="text-primary-500 h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">SALN Records</h2>
            <p className="text-sm text-neutral-500">
              {records.length} year{records.length !== 1 ? "s" : ""} of records
              {anomalyCount > 0 && (
                <span className="text-warning-600 dark:text-warning-400 ml-2">
                  • {anomalyCount} anomal{anomalyCount !== 1 ? "ies" : "y"} detected
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <SALNSkeleton />
      ) : (
        <>
          {/* Summary Cards */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {latestRecord && (
              <>
                <SummaryCard
                  label="Latest Net Worth"
                  value={formatCurrency(latestRecord.netWorth)}
                  subValue={`${latestRecord.year}`}
                  variant={latestRecord.anomalyDetected ? "warning" : "default"}
                />
                <SummaryCard
                  label="Total Assets"
                  value={formatCurrency(latestRecord.totalAssets)}
                  subValue={`${latestRecord.year}`}
                />
                <SummaryCard
                  label="Total Liabilities"
                  value={formatCurrency(latestRecord.totalLiabilities)}
                  subValue={`${latestRecord.year}`}
                />
                {earliestRecord && records.length > 1 && (
                  <SummaryCard
                    label="Net Worth Change"
                    value={formatPercentage(
                      ((latestRecord.netWorth - earliestRecord.netWorth) /
                        Math.abs(earliestRecord.netWorth)) *
                        100
                    )}
                    subValue={`${earliestRecord.year} - ${latestRecord.year}`}
                    variant={
                      latestRecord.netWorth > earliestRecord.netWorth ? "success" : "default"
                    }
                  />
                )}
              </>
            )}
          </div>

          {/* Net Worth Chart */}
          <SALNChart
            timeline={timeline}
            onYearClick={(year) => {
              const record = records.find((r) => r.year === year);
              if (record) {
                setSelectedRecordId(record.id);
              }
            }}
          />

          {/* Records Table */}
          <div className="mt-6">
            <SALNTable records={records} onViewDetails={(id) => setSelectedRecordId(id)} />
          </div>

          {/* Source Attribution - Requirement 6.5 */}
          {records.length > 0 &&
            (() => {
              const allSources = records.flatMap((r) => r.sources);
              return allSources.length > 0 ? (
                <div className="mt-6">
                  <SourcesAccordion sources={allSources} label="SALN Sources" />
                </div>
              ) : null;
            })()}
        </>
      )}

      {/* Detail Modal - Requirement 15.6 */}
      {selectedRecordId && (
        <SALNDetailModal recordId={selectedRecordId} onClose={() => setSelectedRecordId(null)} />
      )}
    </div>
  );
}

// ============================================
// Sub-components
// ============================================

interface SummaryCardProps {
  label: string;
  value: string;
  subValue?: string;
  variant?: "default" | "success" | "warning";
}

function SummaryCard({ label, value, subValue, variant = "default" }: SummaryCardProps) {
  const variantStyles = {
    default: "text-neutral-900 dark:text-white",
    success: "text-success-600 dark:text-success-400",
    warning: "text-warning-600 dark:text-warning-400",
  };

  return (
    <div className="rounded-lg bg-neutral-50 p-4 dark:bg-neutral-800">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${variantStyles[variant]}`}>{value}</p>
      {subValue && <p className="text-xs text-neutral-400">{subValue}</p>}
    </div>
  );
}

interface SALNChartProps {
  timeline: NetWorthTimelinePoint[];
  onYearClick: (year: number) => void;
}

/**
 * SALN Timeline Chart
 * Requirement 6.3 - Display timeline/chart showing net worth changes over time
 */
function SALNChart({ timeline, onYearClick }: SALNChartProps) {
  if (timeline.length === 0) {
    return (
      <div className="rounded-lg bg-neutral-50 p-8 text-center dark:bg-neutral-800">
        <p className="text-neutral-500">No timeline data available</p>
      </div>
    );
  }

  const maxNetWorth = Math.max(...timeline.map((t) => t.netWorth));
  const chartMax = maxNetWorth * 1.15; // 15% headroom for value labels
  const CHART_HEIGHT_PX = 260;

  // Grid lines at 0%, 25%, 50%, 75%, 100%
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
    value: chartMax * pct,
    bottom: Math.round(pct * CHART_HEIGHT_PX),
    label: formatCompactCurrency(chartMax * pct),
  }));

  return (
    <div className="space-y-3">
      {/* Chart */}
      <div className="rounded-lg bg-neutral-50 px-4 pt-4 pb-2 dark:bg-neutral-800">
        <div className="flex">
          {/* Y-axis labels */}
          <div className="relative w-16 shrink-0" style={{ height: `${CHART_HEIGHT_PX}px` }}>
            {gridLines.map((line) => (
              <span
                key={line.value}
                className="absolute right-1 -translate-y-1/2 text-[10px] text-neutral-400 dark:text-neutral-500"
                style={{ bottom: `${line.bottom}px` }}
              >
                {line.label}
              </span>
            ))}
          </div>

          {/* Chart area */}
          <div className="flex flex-1 flex-col">
            <div className="relative" style={{ height: `${CHART_HEIGHT_PX}px` }}>
              {/* Grid lines */}
              {gridLines.map((line) => (
                <div
                  key={line.value}
                  className="absolute right-0 left-0 border-t border-dashed border-neutral-200 dark:border-neutral-700"
                  style={{ bottom: `${line.bottom}px` }}
                />
              ))}

              {/* Bars — absolutely positioned from bottom */}
              <div className="absolute inset-0 flex items-end gap-6 px-4">
                {timeline.map((point) => {
                  const barHeightPx = Math.max(
                    Math.round((point.netWorth / chartMax) * CHART_HEIGHT_PX),
                    8
                  );

                  return (
                    <div key={point.year} className="flex flex-1 flex-col items-center">
                      {/* Anomaly indicator */}
                      {point.anomalyDetected && (
                        <div className="text-warning-500 mb-0.5">
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      )}

                      {/* Value label */}
                      <span className="mb-1 text-[11px] font-semibold whitespace-nowrap text-neutral-700 dark:text-neutral-300">
                        {formatCompactCurrency(point.netWorth)}
                      </span>

                      {/* Bar */}
                      <button
                        onClick={() => onYearClick(point.year)}
                        className={`w-full max-w-24 cursor-pointer rounded-t-md shadow-sm transition-all hover:opacity-80 ${
                          point.anomalyDetected ? "bg-warning-500" : "bg-primary-500"
                        }`}
                        style={{ height: `${barHeightPx}px` }}
                        title={`${point.year}: ${formatCurrency(point.netWorth)}`}
                        aria-label={`${point.year} net worth: ${formatCurrency(point.netWorth)}`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* X-axis year labels */}
            <div className="flex gap-6 px-4 pt-1">
              {timeline.map((point) => (
                <div
                  key={point.year}
                  className="flex-1 text-center text-xs font-medium text-neutral-600 dark:text-neutral-400"
                >
                  {point.year}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Year-over-year changes - Requirement 15.1 */}
      <div className="flex flex-wrap gap-2">
        {timeline.map((point, index) => {
          if (
            index === 0 ||
            point.yearOverYearChange === null ||
            point.yearOverYearChange === undefined
          ) {
            return null;
          }

          const yearOverYearChange = point.yearOverYearChange;
          const isPositive = yearOverYearChange > 0;
          const isAnomaly = point.anomalyDetected;

          return (
            <div
              key={point.year}
              className={`rounded-lg px-3 py-2 text-sm ${
                isAnomaly
                  ? "bg-warning-100 text-warning-700 dark:bg-warning-900 dark:text-warning-300"
                  : isPositive
                    ? "bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300"
                    : "bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300"
              }`}
            >
              <span className="font-medium">{point.year}:</span> {isPositive ? "+" : ""}
              {yearOverYearChange.toFixed(1)}%
              {isAnomaly && (
                <span className="ml-1" title="Anomaly detected">
                  ⚠️
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface SALNTableProps {
  records: SALNRecordData[];
  onViewDetails: (id: string) => void;
}

/**
 * SALN Records Table
 * Requirements 6.1, 6.2
 */
function SALNTable({ records, onViewDetails }: SALNTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-neutral-200 dark:border-neutral-700">
            <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500">Year</th>
            <th className="px-4 py-3 text-right text-sm font-medium text-neutral-500">
              Total Assets
            </th>
            <th className="px-4 py-3 text-right text-sm font-medium text-neutral-500">
              Total Liabilities
            </th>
            <th className="px-4 py-3 text-right text-sm font-medium text-neutral-500">Net Worth</th>
            <th className="px-4 py-3 text-center text-sm font-medium text-neutral-500">Status</th>
            <th className="px-4 py-3 text-right text-sm font-medium text-neutral-500">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
          {records.map((record) => (
            <tr key={record.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800">
              <td className="px-4 py-3">
                <span className="font-medium text-neutral-900 dark:text-white">{record.year}</span>
              </td>
              <td className="px-4 py-3 text-right text-neutral-600 dark:text-neutral-400">
                {formatCurrency(record.totalAssets)}
              </td>
              <td className="px-4 py-3 text-right text-neutral-600 dark:text-neutral-400">
                {formatCurrency(record.totalLiabilities)}
              </td>
              <td className="px-4 py-3 text-right font-medium text-neutral-900 dark:text-white">
                {formatCurrency(record.netWorth)}
              </td>
              <td className="px-4 py-3 text-center">
                {record.anomalyDetected ? (
                  <span className="badge bg-warning-100 text-warning-700 dark:bg-warning-900 dark:text-warning-300">
                    Anomaly
                  </span>
                ) : (
                  <span className="badge bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300">
                    Normal
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => onViewDetails(record.id)}
                  className="text-primary-500 hover:text-primary-600 text-sm"
                >
                  View Details
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SALNSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800"
          />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" />
    </div>
  );
}

// ============================================
// Utility Functions
// ============================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactCurrency(value: number): string {
  if (value >= 1_000_000_000) {
    return `₱${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `₱${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `₱${(value / 1_000).toFixed(0)}K`;
  }
  return `₱${value.toFixed(0)}`;
}

function formatPercentage(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}
