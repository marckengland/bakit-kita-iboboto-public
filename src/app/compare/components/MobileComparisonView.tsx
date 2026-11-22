/**
 * Mobile Comparison View Component
 *
 * Swipeable comparison interface for mobile devices.
 * Requirements: 9.5, 13.3
 */

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ReviewedComparisonCoverage } from "./ReviewedComparisonCoverage";
import type {
  ComparisonResult,
  ComparisonMetric,
  MetricCategory,
  MetricDifference,
  PoliticianSummary,
} from "@/services/comparison.service";

interface MobileComparisonViewProps {
  result: ComparisonResult;
}

const CATEGORY_LABELS: Record<MetricCategory, string> = {
  legislative: "Legislative",
  financial: "Financial",
  attendance: "Attendance",
  promises: "Promises",
  experience: "Experience",
};

export function MobileComparisonView({ result }: MobileComparisonViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const minSwipeDistance = 50;

  // Handle touch events for swipe - Requirement 9.5
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchEnd(null);
    const touch = e.targetTouches[0];
    if (touch) {
      setTouchStart(touch.clientX);
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.targetTouches[0];
    if (touch) {
      setTouchEnd(touch.clientX);
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    if (touchStart === null || touchEnd === null) {
      return;
    }

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && currentIndex < result.politicians.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
    if (isRightSwipe && currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  }, [touchStart, touchEnd, currentIndex, result.politicians.length]);

  // Navigate to specific politician
  const goToIndex = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && currentIndex > 0) {
        setCurrentIndex((prev) => prev - 1);
      }
      if (e.key === "ArrowRight" && currentIndex < result.politicians.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, result.politicians.length]);

  const currentPolitician = result.politicians[currentIndex];
  void currentPolitician; // Used for future enhancements

  return (
    <div className="space-y-4">
      {/* Navigation Dots */}
      <div className="flex items-center justify-center gap-2">
        {result.politicians.map((politician, index) => (
          <button
            key={politician.id}
            onClick={() => goToIndex(index)}
            className={`h-2.5 rounded-full transition-all ${
              index === currentIndex
                ? "bg-primary-500 w-8"
                : "w-2.5 bg-neutral-300 dark:bg-neutral-600"
            }`}
            aria-label={`View ${politician.fullName}`}
          />
        ))}
      </div>

      {/* Swipe Instructions */}
      <p className="text-center text-sm text-neutral-500 dark:text-neutral-400">
        Swipe left or right to compare
      </p>

      {/* Swipeable Container */}
      <div
        ref={containerRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="relative overflow-hidden"
      >
        {/* Navigation Arrows */}
        {currentIndex > 0 && (
          <button
            onClick={() => setCurrentIndex((prev) => prev - 1)}
            className="absolute top-1/2 left-2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow-lg dark:bg-neutral-800/90"
            aria-label="Previous politician"
          >
            <ChevronLeftIcon className="h-5 w-5 text-neutral-700 dark:text-neutral-300" />
          </button>
        )}
        {currentIndex < result.politicians.length - 1 && (
          <button
            onClick={() => setCurrentIndex((prev) => prev + 1)}
            className="absolute top-1/2 right-2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow-lg dark:bg-neutral-800/90"
            aria-label="Next politician"
          >
            <ChevronRightIcon className="h-5 w-5 text-neutral-700 dark:text-neutral-300" />
          </button>
        )}

        {/* Politician Card */}
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {result.politicians.map((politician) => (
            <div key={politician.id} className="w-full flex-shrink-0 px-2">
              <PoliticianMobileCard
                politician={politician}
                metrics={result.metrics}
                differences={result.differences}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Quick Compare Summary */}
      <QuickCompareSummary
        politicians={result.politicians}
        metrics={result.metrics}
        differences={result.differences}
        currentIndex={currentIndex}
      />
    </div>
  );
}

// Individual politician card for mobile
function PoliticianMobileCard({
  politician,
  metrics,
  differences,
}: {
  politician: PoliticianSummary;
  metrics: ComparisonMetric[];
  differences: MetricDifference[];
}) {
  const [expandedCategory, setExpandedCategory] = useState<MetricCategory | null>(null);

  const categories = Object.keys(CATEGORY_LABELS) as MetricCategory[];

  return (
    <div className="card">
      {/* Header */}
      <Link
        href={`/politicians/${politician.id}`}
        className="group flex flex-col items-center text-center"
      >
        {politician.photo ? (
          <div className="ring-primary-100 dark:ring-primary-900 relative mb-3 h-20 w-20 overflow-hidden rounded-full ring-4">
            <Image
              src={politician.photo}
              alt={politician.fullName}
              fill
              className="object-cover"
              sizes="80px"
            />
          </div>
        ) : (
          <div className="bg-primary-100 ring-primary-50 dark:bg-primary-900 dark:ring-primary-950 mb-3 flex h-20 w-20 items-center justify-center rounded-full ring-4">
            <span className="text-primary-500 text-2xl font-semibold">
              {getInitials(politician.fullName)}
            </span>
          </div>
        )}

        <h3 className="group-hover:text-primary-500 text-lg font-semibold text-neutral-900 dark:text-white">
          {politician.fullName}
        </h3>

        {politician.reviewedBatch ? (
          <ReviewedComparisonCoverage batch={politician.reviewedBatch} />
        ) : (
          politician.currentPosition && (
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              {politician.currentPosition.title}
            </p>
          )
        )}

        {!politician.reviewedBatch && politician.currentParty && (
          <span className="badge-primary mt-2">
            {politician.currentParty.abbreviation || politician.currentParty.name}
          </span>
        )}
      </Link>

      {/* Metrics by Category */}
      <div className="mt-6 space-y-2">
        {categories.map((category) => {
          const categoryMetrics = metrics.filter((m) => m.category === category);
          if (categoryMetrics.length === 0) {
            return null;
          }

          const isExpanded = expandedCategory === category;

          return (
            <div
              key={category}
              className="rounded-lg border border-neutral-200 dark:border-neutral-700"
            >
              <button
                onClick={() => setExpandedCategory(isExpanded ? null : category)}
                className="flex w-full items-center justify-between px-4 py-3"
              >
                <span className="font-medium text-neutral-900 dark:text-white">
                  {CATEGORY_LABELS[category]}
                </span>
                <ChevronDownIcon
                  className={`h-5 w-5 text-neutral-500 transition-transform ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isExpanded && (
                <div className="border-t border-neutral-200 px-4 py-3 dark:border-neutral-700">
                  <div className="space-y-3">
                    {categoryMetrics.map((metric) => {
                      const value = metric.values[politician.id];
                      const diff = differences.find((d) => d.metricName === metric.name);
                      const isTie = diff?.isTie === true;
                      const isHighest = !isTie && diff?.highestPoliticianId === politician.id;
                      const isLowest = !isTie && diff?.lowestPoliticianId === politician.id;

                      return (
                        <div key={metric.name} className="flex items-center justify-between">
                          <span className="text-sm text-neutral-600 dark:text-neutral-400">
                            {metric.name}
                          </span>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-sm font-medium ${
                                metric.higherIsBetter && isHighest
                                  ? "text-success-600 dark:text-success-400"
                                  : metric.higherIsBetter && isLowest
                                    ? "text-error-600 dark:text-error-400"
                                    : "text-neutral-900 dark:text-white"
                              }`}
                            >
                              {formatValue(value, metric.unit)}
                            </span>
                            {metric.higherIsBetter && isTie && (
                              <span className="text-xs text-neutral-500">—</span>
                            )}
                            {metric.higherIsBetter && !isTie && isHighest && (
                              <span className="text-success-600 text-xs">▲</span>
                            )}
                            {metric.higherIsBetter && !isTie && isLowest && (
                              <span className="text-error-600 text-xs">▼</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Quick compare summary at bottom
function QuickCompareSummary({
  politicians,
  metrics,
  differences,
  currentIndex,
}: {
  politicians: PoliticianSummary[];
  metrics: ComparisonMetric[];
  differences: MetricDifference[];
  currentIndex: number;
}) {
  // Get key metrics for quick comparison
  const keyMetrics = ["Bills Passed", "Attendance Rate", "Net Worth"];
  const summaryMetrics = metrics.filter((m) => keyMetrics.includes(m.name));

  return (
    <div className="card">
      <h4 className="mb-4 font-semibold text-neutral-900 dark:text-white">Quick Comparison</h4>

      <div className="space-y-4">
        {summaryMetrics.map((metric) => {
          const diff = differences.find((d) => d.metricName === metric.name);

          return (
            <div key={metric.name}>
              <p className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                {metric.name}
              </p>
              <div className="flex gap-2">
                {politicians.map((politician, index) => {
                  const value = metric.values[politician.id];
                  const isHighest = diff?.highestPoliticianId === politician.id;
                  const isCurrent = index === currentIndex;

                  return (
                    <div
                      key={politician.id}
                      className={`flex-1 rounded-lg p-2 text-center transition-all ${
                        isCurrent
                          ? "bg-primary-100 ring-primary-500 dark:bg-primary-900/30 ring-2"
                          : "bg-neutral-100 dark:bg-neutral-800"
                      }`}
                    >
                      <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                        {politician.fullName.split(" ")[0]}
                      </p>
                      <p
                        className={`text-sm font-semibold ${
                          isHighest && metric.higherIsBetter
                            ? "text-success-600 dark:text-success-400"
                            : "text-neutral-900 dark:text-white"
                        }`}
                      >
                        {formatValueShort(value, metric.unit)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Utility functions
function getInitials(name: string): string {
  const parts = name.split(" ");
  if (parts.length >= 2) {
    return `${parts[0]?.[0] || ""}${parts[parts.length - 1]?.[0] || ""}`.toUpperCase();
  }
  return (name[0] || "?").toUpperCase();
}

function formatValue(value: number | string | null | undefined, unit?: string): string {
  if (value === null || value === undefined) {
    return "N/A";
  }
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
    return `${value} yrs`;
  }

  return value.toLocaleString();
}

function formatValueShort(value: number | string | null | undefined, unit?: string): string {
  if (value === null || value === undefined) {
    return "N/A";
  }
  if (typeof value === "string") {
    return value;
  }

  if (unit === "PHP") {
    if (value >= 1000000000) {
      return `₱${(value / 1000000000).toFixed(1)}B`;
    }
    if (value >= 1000000) {
      return `₱${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `₱${(value / 1000).toFixed(0)}K`;
    }
    return `₱${value}`;
  }

  if (unit === "%") {
    return `${value.toFixed(0)}%`;
  }
  if (unit === "years") {
    return `${value}`;
  }

  return value.toLocaleString();
}

// Icons
function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}
