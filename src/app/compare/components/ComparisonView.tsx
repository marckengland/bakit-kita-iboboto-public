/**
 * Comparison View Component
 *
 * Side-by-side comparison display for desktop.
 * Requirements: 9.1, 9.2, 9.4
 */

"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ReviewedComparisonCoverage } from "./ReviewedComparisonCoverage";
import type {
  ComparisonResult,
  ComparisonMetric,
  MetricCategory,
  MetricDifference,
} from "@/services/comparison.service";

interface ComparisonViewProps {
  result: ComparisonResult;
}

const CATEGORY_LABELS: Record<MetricCategory, string> = {
  legislative: "Legislative Record",
  financial: "Financial",
  attendance: "Attendance",
  promises: "Campaign Promises",
  experience: "Experience",
};

const CATEGORY_ICONS: Record<MetricCategory, React.ReactNode> = {
  legislative: <LegislativeIcon />,
  financial: <FinancialIcon />,
  attendance: <AttendanceIcon />,
  promises: <PromisesIcon />,
  experience: <ExperienceIcon />,
};

export function ComparisonView({ result }: ComparisonViewProps) {
  const [activeCategory, setActiveCategory] = useState<MetricCategory | "all">("all");

  const categories = Object.keys(CATEGORY_LABELS) as MetricCategory[];
  const filteredMetrics =
    activeCategory === "all"
      ? result.metrics
      : result.metrics.filter((m) => m.category === activeCategory);

  // Group metrics by category
  const metricsByCategory = categories.reduce(
    (acc, category) => {
      acc[category] = result.metrics.filter((m) => m.category === category);
      return acc;
    },
    {} as Record<MetricCategory, ComparisonMetric[]>
  );

  return (
    <div className="space-y-6">
      {/* Politician Headers - Requirement 9.1 */}
      <div className="card overflow-hidden p-0">
        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${result.politicians.length}, minmax(0, 1fr))` }}
        >
          {/* Politician headers */}
          {result.politicians.map((politician) => (
            <div
              key={politician.id}
              className="min-w-0 border-r border-neutral-200 bg-neutral-50 p-4 last:border-r-0 dark:border-neutral-700 dark:bg-neutral-800/50"
            >
              <Link
                href={`/politicians/${politician.id}`}
                className="group flex flex-col items-center text-center"
              >
                {/* Photo */}
                {politician.photo ? (
                  <div className="relative mb-3 h-16 w-16 overflow-hidden rounded-full ring-2 ring-white dark:ring-neutral-800">
                    <Image
                      src={politician.photo}
                      alt={politician.fullName}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </div>
                ) : (
                  <div className="bg-primary-100 dark:bg-primary-900 mb-3 flex h-16 w-16 items-center justify-center rounded-full ring-2 ring-white dark:ring-neutral-800">
                    <span className="text-primary-500 text-xl font-semibold">
                      {getInitials(politician.fullName)}
                    </span>
                  </div>
                )}

                {/* Name */}
                <h3 className="group-hover:text-primary-500 font-semibold text-neutral-900 dark:text-white">
                  {politician.fullName}
                </h3>

                {/* Position */}
                {politician.reviewedBatch ? (
                  <ReviewedComparisonCoverage batch={politician.reviewedBatch} />
                ) : (
                  politician.currentPosition && (
                    <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                      {politician.currentPosition.title}
                    </p>
                  )
                )}

                {/* Party */}
                {!politician.reviewedBatch && politician.currentParty && (
                  <span className="badge-primary mt-2">
                    {politician.currentParty.abbreviation || politician.currentParty.name}
                  </span>
                )}
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory("all")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeCategory === "all"
              ? "bg-primary-500 text-white"
              : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
          }`}
        >
          All Metrics
        </button>
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeCategory === category
                ? "bg-primary-500 text-white"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
            }`}
          >
            {CATEGORY_ICONS[category]}
            {CATEGORY_LABELS[category]}
          </button>
        ))}
      </div>

      {/* Metrics Table - Requirements 9.2, 9.4 */}
      {activeCategory === "all" ? (
        // Show all categories grouped
        categories.map((category) => {
          const categoryMetrics = metricsByCategory[category];
          if (categoryMetrics.length === 0) {
            return null;
          }

          return (
            <MetricCategorySection
              key={category}
              category={category}
              metrics={categoryMetrics}
              politicians={result.politicians}
              differences={result.differences}
            />
          );
        })
      ) : (
        // Show single category
        <MetricCategorySection
          category={activeCategory}
          metrics={filteredMetrics}
          politicians={result.politicians}
          differences={result.differences}
        />
      )}
    </div>
  );
}

// Metric category section component
function MetricCategorySection({
  category,
  metrics,
  politicians,
  differences,
}: {
  category: MetricCategory;
  metrics: ComparisonMetric[];
  politicians: ComparisonResult["politicians"];
  differences: MetricDifference[];
}) {
  return (
    <div className="card overflow-hidden p-0">
      {/* Category Header */}
      <div className="flex items-center gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-800/50">
        <span className="text-primary-500">{CATEGORY_ICONS[category]}</span>
        <h3 className="font-semibold text-neutral-900 dark:text-white">
          {CATEGORY_LABELS[category]}
        </h3>
      </div>

      {/* Metrics Grid */}
      <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
        {metrics.map((metric) => {
          const diff = differences.find((d) => d.metricName === metric.name);

          return (
            <div
              key={metric.name}
              className="grid"
              style={{ gridTemplateColumns: `repeat(${politicians.length}, minmax(0, 1fr))` }}
            >
              {/* Metric Name */}
              <div
                className="flex items-center border-b border-neutral-200 bg-neutral-50/50 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-800/30"
                style={{ gridColumn: "1 / -1" }}
              >
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  {metric.name}
                </span>
              </div>

              {/* Values */}
              {politicians.map((politician) => {
                const value = metric.values[politician.id];
                const isTie = diff?.isTie === true;
                const isHighest = !isTie && diff?.highestPoliticianId === politician.id;
                const isLowest = !isTie && diff?.lowestPoliticianId === politician.id;

                return (
                  <div
                    key={politician.id}
                    aria-label={`${politician.fullName}: ${metric.name}`}
                    className={`flex min-w-0 flex-wrap items-center justify-center border-r border-neutral-200 px-4 py-3 last:border-r-0 dark:border-neutral-700 ${
                      isHighest && metric.higherIsBetter
                        ? "bg-success-50 dark:bg-success-900/20"
                        : isLowest && metric.higherIsBetter
                          ? "bg-error-50 dark:bg-error-900/20"
                          : ""
                    }`}
                  >
                    <MetricValue
                      value={value}
                      unit={metric.unit}
                      isHighest={isHighest}
                      isLowest={isLowest}
                      isTie={isTie}
                      higherIsBetter={metric.higherIsBetter}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Metric value display component - Requirement 9.4
function MetricValue({
  value,
  unit,
  isHighest,
  isLowest,
  isTie,
  higherIsBetter,
}: {
  value: number | string | null | undefined;
  unit?: string;
  isHighest: boolean;
  isLowest: boolean;
  isTie: boolean;
  higherIsBetter?: boolean;
}) {
  if (value === null || value === undefined) {
    return <span className="text-sm text-neutral-400 dark:text-neutral-500">N/A</span>;
  }

  const formattedValue = formatValue(value, unit);
  const showHighlight = higherIsBetter !== undefined;

  return (
    <div className="flex items-center gap-2">
      <span
        className={`text-sm font-medium ${
          showHighlight && isHighest
            ? "text-success-700 dark:text-success-400"
            : showHighlight && isLowest
              ? "text-error-700 dark:text-error-400"
              : "text-neutral-900 dark:text-white"
        }`}
      >
        {formattedValue}
      </span>
      {showHighlight && isTie && (
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
          Tie
        </span>
      )}
      {showHighlight && !isTie && isHighest && (
        <span className="badge-success text-xs">Highest</span>
      )}
      {showHighlight && !isTie && isLowest && <span className="badge-error text-xs">Lowest</span>}
    </div>
  );
}

// Format value with unit
function formatValue(value: number | string, unit?: string): string {
  if (typeof value === "string") {
    return value;
  }

  if (unit === "PHP") {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 0,
    }).format(value);
  }

  if (unit === "%") {
    return `${value.toFixed(1)}%`;
  }

  if (unit === "years") {
    return `${value} ${value === 1 ? "year" : "years"}`;
  }

  return value.toLocaleString();
}

function getInitials(name: string): string {
  const parts = name.split(" ");
  if (parts.length >= 2) {
    return `${parts[0]?.[0] || ""}${parts[parts.length - 1]?.[0] || ""}`.toUpperCase();
  }
  return (name[0] || "?").toUpperCase();
}

// Category Icons
function LegislativeIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
      />
    </svg>
  );
}

function FinancialIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function AttendanceIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z"
      />
    </svg>
  );
}

function PromisesIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function ExperienceIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z"
      />
    </svg>
  );
}
