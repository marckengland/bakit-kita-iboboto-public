/**
 * Comparison Tool Component
 *
 * Main component for politician comparison with selection, display, export, and sharing.
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 42.2, 42.6
 */

"use client";

import { ReviewedRecordComparison } from "./ReviewedRecordComparison";
import { useTranslations } from "next-intl";
import { useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PoliticianSelector } from "./PoliticianSelector";
import { ComparisonView } from "./ComparisonView";
import { MobileComparisonView } from "./MobileComparisonView";
import { SocialShareButtons } from "@/app/components/SocialShareButtons";
import type { ComparisonResult, PoliticianSummary } from "@/services/comparison.service";
import { loadComparisonSelection, parseComparisonIds } from "@/lib/comparison-selection";

interface ComparisonToolProps {
  initialSelectedIds: string[];
}

const MIN_POLITICIANS = 2;
const MAX_POLITICIANS = 4;

export function ComparisonTool({ initialSelectedIds }: ComparisonToolProps) {
  const t = useTranslations("reviewedComparison");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedPoliticians, setSelectedPoliticians] = useState<PoliticianSummary[]>([]);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [isLoading, setIsLoading] = useState(initialSelectedIds.length > 0);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // URL state also drives reloads and browser back/forward navigation.
  const selectionKey = searchParams.get("ids") ?? "";
  useEffect(() => {
    const controller = new AbortController();
    const ids = parseComparisonIds(selectionKey);
    setIsLoading(ids.length > 0);
    setError(null);
    async function load() {
      try {
        const selection = await loadComparisonSelection(ids, controller.signal);
        if (!controller.signal.aborted) {
          setSelectedPoliticians(selection.politicians);
          setComparisonResult(selection.comparison);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Selected profiles are unavailable");
          setComparisonResult(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }
    void load();
    return () => controller.abort();
  }, [selectionKey]);

  // Update URL with selected IDs
  const updateUrl = useCallback(
    (ids: string[]) => {
      const params = new URLSearchParams(searchParams.toString());
      if (ids.length > 0) {
        params.set("ids", ids.join(","));
      } else {
        params.delete("ids");
      }
      router.push(`/compare?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  // Handle politician selection
  const handleSelectPolitician = useCallback(
    (politician: PoliticianSummary) => {
      if (selectedPoliticians.length >= MAX_POLITICIANS) {
        setError(`You can compare up to ${MAX_POLITICIANS} politicians`);
        return;
      }

      if (selectedPoliticians.some((p) => p.id === politician.id)) {
        setError("This politician is already selected");
        return;
      }

      const newSelected = [...selectedPoliticians, politician];
      setSelectedPoliticians(newSelected);
      setError(null);

      // Update URL and fetch comparison
      const ids = newSelected.map((p) => p.id);
      updateUrl(ids);
    },
    [selectedPoliticians, updateUrl]
  );

  // Handle politician removal
  const handleRemovePolitician = useCallback(
    (politicianId: string) => {
      const newSelected = selectedPoliticians.filter((p) => p.id !== politicianId);
      setSelectedPoliticians(newSelected);
      setError(null);

      // Update URL
      const ids = newSelected.map((p) => p.id);
      updateUrl(ids);

      if (ids.length < MIN_POLITICIANS) {
        setComparisonResult(null);
      }
    },
    [selectedPoliticians, updateUrl]
  );

  // Clear all selections
  const handleClearAll = useCallback(() => {
    setSelectedPoliticians([]);
    setComparisonResult(null);
    setError(null);
    updateUrl([]);
  }, [updateUrl]);

  // Requirement 42.2: Export comparison as PDF
  const handleExport = async () => {
    if (selectedPoliticians.length < MIN_POLITICIANS) {
      return;
    }

    setIsExporting(true);
    try {
      const ids = selectedPoliticians.map((p) => p.id).join(",");
      const response = await fetch(`/api/compare/export?ids=${ids}`);
      if (!response.ok) {
        throw new Error("Export failed");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const names = selectedPoliticians.map((p) => p.fullName.split(" ")[0]).join("-vs-");
      a.download = `comparison-${names.toLowerCase()}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to export comparison");
    } finally {
      setIsExporting(false);
    }
  };

  // Get current URL for sharing
  const currentUrl = typeof window !== "undefined" ? window.location.href : "";

  return (
    <div className="space-y-6">
      {/* Selection Panel */}
      <div className="card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
              Select Politicians
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {selectedPoliticians.length} of {MAX_POLITICIANS} selected
              {selectedPoliticians.length < MIN_POLITICIANS && (
                <span className="text-warning-600 dark:text-warning-400 ml-2">
                  (Select at least {MIN_POLITICIANS} to compare)
                </span>
              )}
            </p>
          </div>

          {selectedPoliticians.length > 0 && (
            <button onClick={handleClearAll} className="btn-outline text-sm">
              Clear All
            </button>
          )}
        </div>

        {/* Selected Politicians */}
        {selectedPoliticians.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {selectedPoliticians.map((politician) => (
              <SelectedPoliticianChip
                key={politician.id}
                politician={politician}
                onRemove={() => handleRemovePolitician(politician.id)}
              />
            ))}
          </div>
        )}

        {/* Politician Search/Selector */}
        <div className="mt-4">
          <PoliticianSelector
            onSelect={handleSelectPolitician}
            excludeIds={selectedPoliticians.map((p) => p.id)}
            disabled={selectedPoliticians.length >= MAX_POLITICIANS}
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-error-50 text-error-700 dark:bg-error-900/20 dark:text-error-400 mt-4 rounded-lg p-3 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Comparison Results */}
      {isLoading ? (
        <ComparisonLoadingState />
      ) : comparisonResult ? (
        <>
          {/* Export and Share Actions - Requirements 42.2, 42.6 */}
          <div className="card">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold text-neutral-900 dark:text-white">
                  Comparison Results
                </h3>
                <p className="text-sm text-neutral-500">
                  Comparing {selectedPoliticians.length} politicians
                </p>
              </div>
              <div className="flex items-center gap-3">
                {/* Export Button - Requirement 42.2 */}
                <button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="btn-outline flex items-center gap-2"
                  aria-label={
                    comparisonResult.politicians.some((politician) => politician.reviewedBatch)
                      ? "Export comparison as HTML"
                      : "Export comparison as PDF"
                  }
                >
                  {isExporting ? (
                    <LoadingSpinner className="h-4 w-4" />
                  ) : (
                    <DownloadIcon className="h-4 w-4" />
                  )}
                  Export
                </button>

                {/* Share Button - Requirement 42.6 */}
                <SocialShareButtons
                  type="comparison"
                  url={currentUrl}
                  data={{ politicianNames: selectedPoliticians.map((p) => p.fullName) }}
                  variant="dropdown"
                />
              </div>
            </div>
          </div>

          {comparisonResult.reviewedFilings && (
            <ReviewedRecordComparison result={comparisonResult} />
          )}
          {comparisonResult.reviewedFilings ? (
            <details className="rounded-xl border border-neutral-300 p-4 dark:border-neutral-700">
              <summary className="cursor-pointer font-medium">{t("otherFields")}</summary>
              <p className="my-3 text-sm text-neutral-600 dark:text-neutral-400">{t("missing")}</p>
              {isMobile ? (
                <MobileComparisonView result={comparisonResult} />
              ) : (
                <ComparisonView result={comparisonResult} />
              )}
            </details>
          ) : isMobile ? (
            <MobileComparisonView result={comparisonResult} />
          ) : (
            <ComparisonView result={comparisonResult} />
          )}
        </>
      ) : selectedPoliticians.length > 0 && selectedPoliticians.length < MIN_POLITICIANS ? (
        <EmptyComparisonState needed={MIN_POLITICIANS - selectedPoliticians.length} />
      ) : null}
    </div>
  );
}

// Selected politician chip component
function SelectedPoliticianChip({
  politician,
  onRemove,
}: {
  politician: PoliticianSummary;
  onRemove: () => void;
}) {
  return (
    <div className="bg-primary-100 dark:bg-primary-900/30 flex items-center gap-2 rounded-full py-1 pr-1 pl-3">
      <span className="text-primary-700 dark:text-primary-300 text-sm font-medium">
        {politician.fullName}
      </span>
      <button
        onClick={onRemove}
        className="bg-primary-200 text-primary-600 hover:bg-primary-300 dark:bg-primary-800 dark:text-primary-400 dark:hover:bg-primary-700 flex h-6 w-6 items-center justify-center rounded-full transition-colors"
        aria-label={`Remove ${politician.fullName}`}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}

// Loading state component
function ComparisonLoadingState() {
  return (
    <div className="card">
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-4">
          <div className="border-primary-200 border-t-primary-500 h-10 w-10 animate-spin rounded-full border-4" />
          <p className="text-neutral-600 dark:text-neutral-400">Loading comparison...</p>
        </div>
      </div>
    </div>
  );
}

// Empty state when more politicians needed
function EmptyComparisonState({ needed }: { needed: number }) {
  return (
    <div className="card">
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
          <svg
            className="h-8 w-8 text-neutral-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
          Select {needed} more politician{needed > 1 ? "s" : ""}
        </h3>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          Use the search above to find and add politicians to compare
        </p>
      </div>
    </div>
  );
}

// Icon components for export and share functionality
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
