/**
 * Position History Timeline Component
 *
 * Displays all positions held by a politician in chronological order.
 * Requirements: 2.2, 2.3
 */

"use client";

import { useState } from "react";
import { PositionWithSources } from "@/services/politician.service";
import { SourceTooltip } from "./SourceTooltip";

interface PositionHistoryTimelineProps {
  positions: PositionWithSources[];
}

export function PositionHistoryTimeline({ positions }: PositionHistoryTimelineProps) {
  if (positions.length === 0) {
    return (
      <div className="card">
        <h2 className="mb-4 text-xl font-semibold text-neutral-900 dark:text-white">
          Position History
        </h2>
        <p className="text-neutral-500 italic">No position history available</p>
      </div>
    );
  }

  // Sort positions by start date descending (most recent first) - Requirement 2.3
  const sortedPositions = [...positions].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );

  return (
    <div className="card">
      <h2 className="mb-6 text-xl font-semibold text-neutral-900 dark:text-white">
        Position History
      </h2>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute top-0 left-4 h-full w-0.5 bg-neutral-200 sm:left-6 dark:bg-neutral-700" />

        {/* Timeline items */}
        <div className="space-y-6">
          {sortedPositions.map((position) => (
            <PositionTimelineItem key={position.id} position={position} />
          ))}
        </div>
      </div>
    </div>
  );
}

interface PositionTimelineItemProps {
  position: PositionWithSources;
}

function PositionTimelineItem({ position }: PositionTimelineItemProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const levelColors: Record<string, string> = {
    national: "bg-primary-500",
    regional: "bg-purple-500",
    provincial: "bg-success-500",
    city: "bg-accent-500",
    municipal: "bg-warning-500",
    barangay: "bg-secondary-500",
  };

  const dotColor = levelColors[position.level] || "bg-neutral-400";

  return (
    <div className="relative flex gap-4 sm:gap-6">
      {/* Timeline dot */}
      <div className="relative z-10 flex-shrink-0">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full sm:h-12 sm:w-12 ${
            position.isCurrent
              ? `${dotColor} ring-opacity-30 ring-4 ${dotColor.replace("bg-", "ring-")}`
              : "bg-white dark:bg-neutral-800"
          } border-2 ${position.isCurrent ? "border-white dark:border-neutral-900" : "border-neutral-200 dark:border-neutral-700"}`}
        >
          {position.isCurrent ? (
            <svg
              className="h-4 w-4 text-white sm:h-5 sm:w-5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <div className={`h-3 w-3 rounded-full sm:h-4 sm:w-4 ${dotColor}`} />
          )}
        </div>
      </div>

      {/* Content */}
      <div
        className={`relative flex-1 rounded-lg border p-4 ${
          position.isCurrent
            ? "border-primary-200 bg-primary-50 dark:border-primary-800 dark:bg-primary-900/20"
            : "border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800"
        }`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {/* Current badge */}
        {position.isCurrent && (
          <span className="badge-primary absolute -top-2 right-4 text-xs">Current Position</span>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {/* Position Title */}
            <h3 className="font-semibold text-neutral-900 dark:text-white">{position.title}</h3>

            {/* Jurisdiction */}
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {position.jurisdiction}
            </p>

            {/* Term Info */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="badge bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                {formatLevel(position.level)}
              </span>
              <span className="badge bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                Term {position.termNumber}
              </span>
              {position.isConsecutive && position.termNumber > 1 && (
                <span className="badge bg-warning-100 text-warning-700 dark:bg-warning-900 dark:text-warning-300">
                  Consecutive
                </span>
              )}
            </div>
          </div>

          {/* Date Range - Requirement 2.3 */}
          <div className="text-right">
            <p className="text-sm font-medium text-neutral-900 dark:text-white">
              {formatDate(position.startDate)}
            </p>
            <p className="text-sm text-neutral-500">
              to {position.endDate ? formatDate(position.endDate) : "Present"}
            </p>
            <p className="mt-1 text-xs text-neutral-400">
              {calculateDuration(position.startDate, position.endDate)}
            </p>
          </div>
        </div>

        {/* Source indicator */}
        {position.sources.length > 0 && (
          <div className="mt-3 flex items-center gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-700">
            <svg className="h-4 w-4 text-neutral-400" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-xs text-neutral-500">
              Source: {position.sources[0]?.sourceName || "Official Records"}
            </span>
          </div>
        )}

        {/* Source Tooltip */}
        {showTooltip && position.sources.length > 0 && (
          <div className="absolute top-full left-0 z-10 mt-2">
            <SourceTooltip sources={position.sources} />
          </div>
        )}
      </div>
    </div>
  );
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

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
  });
}

function calculateDuration(startDate: Date, endDate?: Date | null): string {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();

  const years = end.getFullYear() - start.getFullYear();
  const months = end.getMonth() - start.getMonth();

  let totalMonths = years * 12 + months;
  if (totalMonths < 0) {
    totalMonths = 0;
  }

  const displayYears = Math.floor(totalMonths / 12);
  const displayMonths = totalMonths % 12;

  if (displayYears === 0) {
    return `${displayMonths} month${displayMonths !== 1 ? "s" : ""}`;
  } else if (displayMonths === 0) {
    return `${displayYears} year${displayYears !== 1 ? "s" : ""}`;
  } else {
    return `${displayYears} year${displayYears !== 1 ? "s" : ""}, ${displayMonths} month${displayMonths !== 1 ? "s" : ""}`;
  }
}
