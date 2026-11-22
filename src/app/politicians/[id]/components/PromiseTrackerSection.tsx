/**
 * Promise Tracker Section Component
 *
 * Displays campaign promises with fulfillment status and rate.
 * Requirements: 23.1, 23.2, 23.3, 23.4, 23.5
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  PromiseStatus,
  PromiseEvidenceType,
  PromiseSignificance,
  PromiseAttribution,
} from "@prisma/client";
import {
  CampaignPromiseRecord,
  FulfillmentRate,
  PromiseCategorySummary,
} from "@/services/promise-tracker.service";
import { SourcesAccordion } from "./SourcesAccordion";

interface PromiseTrackerSectionProps {
  politicianId: string;
  initialPromises?: CampaignPromiseRecord[];
  initialFulfillmentRate?: FulfillmentRate | null;
  initialCategorySummary?: PromiseCategorySummary[];
}

export function PromiseTrackerSection({
  politicianId,
  initialPromises = [],
  initialFulfillmentRate = null,
  initialCategorySummary = [],
}: PromiseTrackerSectionProps) {
  const [promises, setPromises] = useState<CampaignPromiseRecord[]>(initialPromises);
  const [fulfillmentRate, setFulfillmentRate] = useState<FulfillmentRate | null>(
    initialFulfillmentRate
  );
  const [categorySummary, setCategorySummary] =
    useState<PromiseCategorySummary[]>(initialCategorySummary);
  const [loading, setLoading] = useState(initialPromises.length === 0);
  const [expandedPromiseId, setExpandedPromiseId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<PromiseStatus | "">("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [promisesRes, rateRes, categoryRes] = await Promise.all([
        fetch(`/api/politicians/${politicianId}/promises`),
        fetch(`/api/politicians/${politicianId}/promises/fulfillment-rate`),
        fetch(`/api/politicians/${politicianId}/promises/by-category`),
      ]);

      if (promisesRes.ok) {
        const data = await promisesRes.json();
        setPromises(data.items || data);
      }
      if (rateRes.ok) {
        const data = await rateRes.json();
        setFulfillmentRate(data);
      }
      if (categoryRes.ok) {
        const data = await categoryRes.json();
        setCategorySummary(data);
      }
    } catch (error) {
      console.error("Failed to fetch promises:", error);
    } finally {
      setLoading(false);
    }
  }, [politicianId]);

  useEffect(() => {
    if (initialPromises.length === 0) {
      fetchData();
    }
  }, [fetchData, initialPromises.length]);

  // Get unique categories for filter
  const uniqueCategories = Array.from(new Set(promises.map((p) => p.category)));

  // Filter promises
  const filteredPromises = promises.filter((promise) => {
    if (statusFilter && promise.status !== statusFilter) {
      return false;
    }
    if (categoryFilter && promise.category !== categoryFilter) {
      return false;
    }
    return true;
  });

  // Group promises by election year
  const promisesByYear = filteredPromises.reduce(
    (acc, promise) => {
      const year = promise.electionYear;
      if (!acc[year]) {
        acc[year] = [];
      }
      acc[year].push(promise);
      return acc;
    },
    {} as Record<number, CampaignPromiseRecord[]>
  );

  // Sort years descending
  const sortedYears = Object.keys(promisesByYear)
    .map(Number)
    .sort((a, b) => b - a);

  // Handle no promises
  if (!loading && promises.length === 0) {
    return (
      <div className="card">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
            <svg className="h-5 w-5 text-neutral-500" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
              Promise Tracker
            </h2>
            <p className="text-sm text-neutral-500">Campaign promise fulfillment</p>
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
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="mt-4 text-neutral-600 dark:text-neutral-400">
            No campaign promises recorded
          </p>
          <p className="mt-2 text-sm text-neutral-500">
            Promise data will be displayed when campaign materials are processed.
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
          <div className="bg-accent-100 dark:bg-accent-900 flex h-10 w-10 items-center justify-center rounded-full">
            <svg
              className="text-accent-600 dark:text-accent-400 h-5 w-5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
              Promise Tracker
            </h2>
            <p className="text-sm text-neutral-500">
              {promises.length} campaign promise{promises.length !== 1 ? "s" : ""} tracked
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as PromiseStatus | "")}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
          >
            <option value="">All Status</option>
            <option value="kept">Kept</option>
            <option value="partially_kept">Partially Kept</option>
            <option value="in_progress">In Progress</option>
            <option value="broken">Broken</option>
            <option value="not_yet_due">Not Yet Due</option>
          </select>

          {uniqueCategories.length > 1 && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
            >
              <option value="">All Categories</option>
              {uniqueCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {formatCategory(cat)}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {loading ? (
        <PromisesSkeleton />
      ) : (
        <>
          {/* Fulfillment Rate Summary - Requirement 23.3 */}
          {fulfillmentRate && <FulfillmentRateSummary rate={fulfillmentRate} />}

          {/* Category Summary - Requirement 23.4 */}
          {categorySummary.length > 0 && <CategorySummarySection categories={categorySummary} />}

          {/* Promises by Year - Requirement 23.1 */}
          <div className="mt-6 space-y-6">
            {sortedYears.map((year) => (
              <YearPromiseGroup
                key={year}
                year={year}
                promises={promisesByYear[year] || []}
                expandedPromiseId={expandedPromiseId}
                onToggleExpand={(id) => setExpandedPromiseId(expandedPromiseId === id ? null : id)}
              />
            ))}
          </div>

          {/* Source Attribution - Requirement 23.5 */}
          {promises.length > 0 &&
            (() => {
              const allSources = promises.flatMap((p) => p.sources);
              return allSources.length > 0 ? (
                <div className="mt-6">
                  <SourcesAccordion sources={allSources} label="Promise Sources" />
                </div>
              ) : (
                <div className="mt-6 rounded-lg bg-neutral-50 p-4 dark:bg-neutral-800">
                  <p className="text-xs text-neutral-500">
                    Sources: Campaign materials, official debates, interviews, and public statements
                  </p>
                </div>
              );
            })()}
        </>
      )}
    </div>
  );
}

// ============================================
// Sub-components
// ============================================

interface FulfillmentRateSummaryProps {
  rate: FulfillmentRate;
}

/**
 * Fulfillment Rate Summary
 * Requirement 23.3 - Calculate and display fulfillment rate
 */
function FulfillmentRateSummary({ rate }: FulfillmentRateSummaryProps) {
  const rateColor =
    rate.fulfillmentRate >= 70
      ? "text-success-600 dark:text-success-400"
      : rate.fulfillmentRate >= 40
        ? "text-warning-600 dark:text-warning-400"
        : "text-error-600 dark:text-error-400";

  const progressColor =
    rate.fulfillmentRate >= 70
      ? "bg-success-500"
      : rate.fulfillmentRate >= 40
        ? "bg-warning-500"
        : "bg-error-500";

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Fulfillment Rate */}
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20">
            <svg className="h-20 w-20 -rotate-90 transform" viewBox="0 0 36 36">
              <path
                className="text-neutral-200 dark:text-neutral-700"
                stroke="currentColor"
                strokeWidth="3"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className={progressColor.replace("bg-", "text-")}
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${rate.fulfillmentRate}, 100`}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-lg font-bold ${rateColor}`}>{rate.fulfillmentPercentage}</span>
            </div>
          </div>
          <div>
            <p className="text-lg font-semibold text-neutral-900 dark:text-white">
              Fulfillment Rate
            </p>
            <p className="text-sm text-neutral-500">
              Based on {rate.totalPromises} tracked promise{rate.totalPromises !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Status Breakdown */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatusCount label="Kept" count={rate.keptCount} variant="success" />
          <StatusCount label="Partial" count={rate.partiallyKeptCount} variant="warning" />
          <StatusCount label="In Progress" count={rate.inProgressCount} variant="primary" />
          <StatusCount label="Broken" count={rate.brokenCount} variant="error" />
          <StatusCount label="Not Due" count={rate.notYetDueCount} variant="neutral" />
        </div>
      </div>
    </div>
  );
}

interface StatusCountProps {
  label: string;
  count: number;
  variant: "success" | "warning" | "primary" | "error" | "neutral";
}

function StatusCount({ label, count, variant }: StatusCountProps) {
  const variantStyles = {
    success: "text-success-600 dark:text-success-400",
    warning: "text-warning-600 dark:text-warning-400",
    primary: "text-primary-600 dark:text-primary-400",
    error: "text-error-600 dark:text-error-400",
    neutral: "text-neutral-600 dark:text-neutral-400",
  };

  return (
    <div className="text-center">
      <p className={`text-xl font-bold ${variantStyles[variant]}`}>{count}</p>
      <p className="text-xs text-neutral-500">{label}</p>
    </div>
  );
}

interface CategorySummarySectionProps {
  categories: PromiseCategorySummary[];
}

function CategorySummarySection({ categories }: CategorySummarySectionProps) {
  const [showAll, setShowAll] = useState(false);
  const displayCategories = showAll ? categories : categories.slice(0, 4);

  return (
    <div className="mt-4">
      <h3 className="mb-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
        By Category
      </h3>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {displayCategories.map((cat) => (
          <CategoryCard key={cat.category} category={cat} />
        ))}
      </div>
      {categories.length > 4 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-primary-500 hover:text-primary-600 mt-2 text-sm"
        >
          {showAll ? "Show less" : `Show ${categories.length - 4} more categories`}
        </button>
      )}
    </div>
  );
}

interface CategoryCardProps {
  category: PromiseCategorySummary;
}

function CategoryCard({ category }: CategoryCardProps) {
  const rateColor =
    category.fulfillmentRate >= 70
      ? "text-success-600 dark:text-success-400"
      : category.fulfillmentRate >= 40
        ? "text-warning-600 dark:text-warning-400"
        : "text-error-600 dark:text-error-400";

  return (
    <div className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-900">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-neutral-900 dark:text-white">
          {formatCategory(category.category)}
        </p>
        <span className={`text-sm font-bold ${rateColor}`}>
          {category.fulfillmentRate.toFixed(0)}%
        </span>
      </div>
      <div className="mt-2 flex items-center gap-1 text-xs text-neutral-500">
        <span>{category.keptCount} kept</span>
        <span>•</span>
        <span>{category.totalCount} total</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-700">
        <div
          className={`h-1.5 rounded-full ${
            category.fulfillmentRate >= 70
              ? "bg-success-500"
              : category.fulfillmentRate >= 40
                ? "bg-warning-500"
                : "bg-error-500"
          }`}
          style={{ width: `${category.fulfillmentRate}%` }}
        />
      </div>
    </div>
  );
}

interface YearPromiseGroupProps {
  year: number;
  promises: CampaignPromiseRecord[];
  expandedPromiseId: string | null;
  onToggleExpand: (id: string) => void;
}

function YearPromiseGroup({
  year,
  promises,
  expandedPromiseId,
  onToggleExpand,
}: YearPromiseGroupProps) {
  const keptCount = promises.filter(
    (p) => p.status === "kept" || p.status === "partially_kept"
  ).length;

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-700">
      {/* Year Header */}
      <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-800">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="font-semibold text-neutral-900 dark:text-white">
            {year} Election Promises
          </h3>
          <div className="flex items-center gap-3 text-sm text-neutral-500">
            <span>
              {promises.length} promise{promises.length !== 1 ? "s" : ""}
            </span>
            <span>•</span>
            <span>{keptCount} fulfilled</span>
          </div>
        </div>
      </div>

      {/* Promises List */}
      <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
        {promises.map((promise) => (
          <PromiseCard
            key={promise.id}
            promise={promise}
            isExpanded={expandedPromiseId === promise.id}
            onToggle={() => onToggleExpand(promise.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface PromiseCardProps {
  promise: CampaignPromiseRecord;
  isExpanded: boolean;
  onToggle: () => void;
}

/**
 * Promise Card
 * Requirements: 23.1, 23.2, 23.4, 23.5
 */
function PromiseCard({ promise, isExpanded, onToggle }: PromiseCardProps) {
  const statusConfig = getPromiseStatusConfig(promise.status);
  const attributionConfig = getAttributionConfig(promise.attribution);
  const significanceConfig = getSignificanceConfig(promise.significance);
  const hasEvidence = promise.evidence.length > 0;

  return (
    <div className="relative p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          {/* Promise Text - Requirement 23.1 */}
          <p className="text-sm text-neutral-900 dark:text-white">{promise.promiseText}</p>

          {/* Badges */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {/* Status Badge - Requirement 23.2 */}
            <span className={`badge ${statusConfig.badgeClass}`}>
              {statusConfig.icon}
              {statusConfig.label}
            </span>

            {/* Category Badge */}
            <span className="badge bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
              {formatCategory(promise.category)}
            </span>

            {/* Attribution Badge */}
            {attributionConfig && (
              <span className={`badge ${attributionConfig.badgeClass}`}>
                <span className="mr-1">{attributionConfig.icon}</span>
                {attributionConfig.label}
              </span>
            )}

            {/* Significance Badge */}
            {significanceConfig && (
              <span className={`badge ${significanceConfig.badgeClass}`}>
                {significanceConfig.label}
              </span>
            )}

            {/* Evidence indicator */}
            {hasEvidence && (
              <span className="badge bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300">
                {promise.evidence.length} evidence
              </span>
            )}
          </div>

          {/* Inherited From + Analysis Notes */}
          {(promise.inheritedFrom || promise.analysisNotes) && (
            <div className="mt-2 rounded-md bg-neutral-50 p-2 dark:bg-neutral-800">
              {promise.inheritedFrom && (
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  <span className="font-medium">Inherited from:</span> {promise.inheritedFrom}
                </p>
              )}
              {promise.analysisNotes && (
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  {promise.analysisNotes}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Status Icon */}
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full ${statusConfig.iconBgClass}`}
        >
          {statusConfig.statusIcon}
        </div>
      </div>

      {/* Expand/Collapse Button for Evidence */}
      {hasEvidence && (
        <button
          onClick={onToggle}
          className="text-primary-500 hover:text-primary-600 mt-3 flex items-center gap-1 text-sm"
        >
          {isExpanded ? "Hide" : "Show"} evidence
          <svg
            className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      )}

      {/* Evidence Section - Requirement 23.4 */}
      {isExpanded && hasEvidence && (
        <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-700">
          <h5 className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Evidence of Fulfillment
          </h5>
          <div className="space-y-2">
            {promise.evidence.map((evidence) => (
              <EvidenceCard key={evidence.id} evidence={evidence} />
            ))}
          </div>
        </div>
      )}

      {/* Sources Accordion */}
      {promise.sources.length > 0 && (
        <div className="mt-3">
          <SourcesAccordion sources={promise.sources} />
        </div>
      )}
    </div>
  );
}

interface EvidenceCardProps {
  evidence: {
    id: string;
    type: PromiseEvidenceType;
    description: string;
    url?: string | null;
    date: Date;
  };
}

/**
 * Evidence Card
 * Requirement 23.4 - Show evidence for fulfilled promises
 */
function EvidenceCard({ evidence }: EvidenceCardProps) {
  const typeConfig = getEvidenceTypeConfig(evidence.type);

  return (
    <div className="bg-success-50 dark:bg-success-900/20 flex items-start gap-3 rounded-lg p-3">
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-full ${typeConfig.iconBgClass}`}
      >
        {typeConfig.icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className={`badge text-xs ${typeConfig.badgeClass}`}>{typeConfig.label}</span>
          <span className="text-xs text-neutral-500">{formatDate(evidence.date)}</span>
        </div>
        <p className="mt-1 text-sm text-neutral-900 dark:text-white">{evidence.description}</p>
        {evidence.url && (
          <a
            href={evidence.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-500 hover:text-primary-600 mt-2 inline-flex items-center gap-1 text-xs"
          >
            View Source
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}

function PromisesSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-28 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800"
          />
        ))}
      </div>
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800"
          />
        ))}
      </div>
    </div>
  );
}

// ============================================
// Utility Functions
// ============================================

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatCategory(category: string): string {
  const labels: Record<string, string> = {
    economy: "Economy",
    health: "Health",
    education: "Education",
    infrastructure: "Infrastructure",
    agriculture: "Agriculture",
    environment: "Environment",
    security: "Security",
    governance: "Governance",
    social_welfare: "Social Welfare",
    foreign_policy: "Foreign Policy",
    labor: "Labor",
    housing: "Housing",
    transportation: "Transportation",
    technology: "Technology",
    other: "Other",
  };
  return (
    labels[category] || category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, " ")
  );
}

function getPromiseStatusConfig(status: PromiseStatus) {
  const configs: Record<
    PromiseStatus,
    {
      label: string;
      badgeClass: string;
      iconBgClass: string;
      icon: React.ReactNode;
      statusIcon: React.ReactNode;
    }
  > = {
    kept: {
      label: "Kept",
      badgeClass: "bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300",
      iconBgClass: "bg-success-100 dark:bg-success-900",
      icon: (
        <svg className="mr-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      ),
      statusIcon: (
        <svg
          className="text-success-600 dark:text-success-400 h-5 w-5"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    partially_kept: {
      label: "Partially Kept",
      badgeClass: "bg-warning-100 text-warning-700 dark:bg-warning-900 dark:text-warning-300",
      iconBgClass: "bg-warning-100 dark:bg-warning-900",
      icon: (
        <svg className="mr-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
            clipRule="evenodd"
          />
        </svg>
      ),
      statusIcon: (
        <svg
          className="text-warning-600 dark:text-warning-400 h-5 w-5"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    broken: {
      label: "Broken",
      badgeClass: "bg-error-100 text-error-700 dark:bg-error-900 dark:text-error-300",
      iconBgClass: "bg-error-100 dark:bg-error-900",
      icon: (
        <svg className="mr-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      ),
      statusIcon: (
        <svg
          className="text-error-600 dark:text-error-400 h-5 w-5"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    in_progress: {
      label: "In Progress",
      badgeClass: "bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300",
      iconBgClass: "bg-primary-100 dark:bg-primary-900",
      icon: (
        <svg className="mr-1 h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ),
      statusIcon: (
        <svg
          className="text-primary-600 dark:text-primary-400 h-5 w-5"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    not_yet_due: {
      label: "Not Yet Due",
      badgeClass: "bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300",
      iconBgClass: "bg-neutral-100 dark:bg-neutral-800",
      icon: (
        <svg className="mr-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
            clipRule="evenodd"
          />
        </svg>
      ),
      statusIcon: (
        <svg className="h-5 w-5 text-neutral-500" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
  };
  return configs[status];
}

function getAttributionConfig(attribution: PromiseAttribution | null): {
  label: string;
  badgeClass: string;
  icon: string;
} | null {
  if (!attribution) {
    return null;
  }
  const configs: Record<PromiseAttribution, { label: string; badgeClass: string; icon: string }> = {
    direct_action: {
      label: "Direct Action",
      badgeClass:
        "bg-success-50 text-success-700 dark:bg-success-950 dark:text-success-300 border border-success-200 dark:border-success-800",
      icon: "🎯",
    },
    partial_contribution: {
      label: "Partial Contribution",
      badgeClass:
        "bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300 border border-primary-200 dark:border-primary-800",
      icon: "🤝",
    },
    inherited_program: {
      label: "Inherited Program",
      badgeClass:
        "bg-warning-50 text-warning-700 dark:bg-warning-950 dark:text-warning-300 border border-warning-200 dark:border-warning-800",
      icon: "📋",
    },
    inevitable_trend: {
      label: "Inevitable Trend",
      badgeClass:
        "bg-neutral-50 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700",
      icon: "📈",
    },
    unverified: {
      label: "Unverified",
      badgeClass:
        "bg-neutral-50 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700",
      icon: "❓",
    },
  };
  return configs[attribution];
}

function getSignificanceConfig(significance: PromiseSignificance | null): {
  label: string;
  badgeClass: string;
} | null {
  if (!significance) {
    return null;
  }
  const configs: Record<PromiseSignificance, { label: string; badgeClass: string }> = {
    high: {
      label: "High Impact",
      badgeClass: "bg-success-50 text-success-700 dark:bg-success-950 dark:text-success-300",
    },
    medium: {
      label: "Medium Impact",
      badgeClass: "bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300",
    },
    low: {
      label: "Low Impact",
      badgeClass: "bg-warning-50 text-warning-700 dark:bg-warning-950 dark:text-warning-300",
    },
    trivial: {
      label: "Trivial",
      badgeClass: "bg-neutral-50 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
    },
  };
  return configs[significance];
}

function getEvidenceTypeConfig(type: PromiseEvidenceType) {
  const configs: Record<
    PromiseEvidenceType,
    {
      label: string;
      badgeClass: string;
      iconBgClass: string;
      icon: React.ReactNode;
    }
  > = {
    legislation: {
      label: "Legislation",
      badgeClass: "bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300",
      iconBgClass: "bg-primary-100 dark:bg-primary-900",
      icon: (
        <svg
          className="text-primary-600 dark:text-primary-400 h-4 w-4"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm3 1h6v4H7V5zm6 6H7v2h6v-2z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    project: {
      label: "Project",
      badgeClass: "bg-accent-100 text-accent-700 dark:bg-accent-900 dark:text-accent-300",
      iconBgClass: "bg-accent-100 dark:bg-accent-900",
      icon: (
        <svg
          className="text-accent-600 dark:text-accent-400 h-4 w-4"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z"
            clipRule="evenodd"
          />
          <path d="M2 13.692V16a2 2 0 002 2h12a2 2 0 002-2v-2.308A24.974 24.974 0 0110 15c-2.796 0-5.487-.46-8-1.308z" />
        </svg>
      ),
    },
    policy: {
      label: "Policy",
      badgeClass:
        "bg-secondary-100 text-secondary-700 dark:bg-secondary-900 dark:text-secondary-300",
      iconBgClass: "bg-secondary-100 dark:bg-secondary-900",
      icon: (
        <svg
          className="text-secondary-600 dark:text-secondary-400 h-4 w-4"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M10 2a1 1 0 00-1 1v1a1 1 0 002 0V3a1 1 0 00-1-1zM4 4h3a3 3 0 006 0h3a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm2.5 7a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm2.45 4a2.5 2.5 0 10-4.9 0h4.9zM12 9a1 1 0 100 2h3a1 1 0 100-2h-3zm-1 4a1 1 0 011-1h2a1 1 0 110 2h-2a1 1 0 01-1-1z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    statement: {
      label: "Statement",
      badgeClass: "bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300",
      iconBgClass: "bg-neutral-100 dark:bg-neutral-800",
      icon: (
        <svg
          className="h-4 w-4 text-neutral-600 dark:text-neutral-400"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
  };
  return configs[type];
}
