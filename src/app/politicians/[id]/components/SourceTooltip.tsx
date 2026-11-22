/**
 * Source Tooltip Component
 *
 * Displays source attribution details when hovering over or tapping a data field.
 * Requirements: 12.6, 12.7, 12.8
 */

import type { DataSourceAttribution } from "@/services/politician.service";

interface SourceTooltipProps {
  sources: DataSourceAttribution[];
}

export function SourceTooltip({ sources }: SourceTooltipProps) {
  if (sources.length === 0) {
    return null;
  }

  return (
    <div className="absolute top-full left-0 z-20 mt-2 w-80 rounded-lg border border-neutral-200 bg-white p-4 shadow-lg dark:border-neutral-700 dark:bg-neutral-800">
      <h4 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-white">
        Source Attribution
      </h4>
      <div className="space-y-3">
        {sources.map((source, index) => (
          <SourceItem key={index} source={source} />
        ))}
      </div>
    </div>
  );
}

interface SourceItemProps {
  source: DataSourceAttribution;
}

function SourceItem({ source }: SourceItemProps) {
  const sourceTypeLabels: Record<string, string> = {
    official_government: "Official Government Record",
    court_document: "Court Document",
    comelec_filing: "COMELEC Filing",
    legislative_record: "Legislative Record",
    coa_report: "COA Report",
    third_party_verified: "Third-Party Verified",
    ai_extracted: "AI Extracted",
  };

  const sourceTypeColors: Record<string, string> = {
    official_government: "text-primary-600 dark:text-primary-400",
    court_document: "text-secondary-600 dark:text-secondary-400",
    comelec_filing: "text-accent-700 dark:text-accent-400",
    legislative_record: "text-success-600 dark:text-success-400",
    coa_report: "text-warning-600 dark:text-warning-400",
    third_party_verified: "text-neutral-600 dark:text-neutral-400",
    ai_extracted: "text-purple-600 dark:text-purple-400",
  };

  const reliabilityLabel = getReliabilityLabel(source.sourceType);
  const reliabilityColor = getReliabilityColor(source.sourceType);

  return (
    <div className="rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
      {/* Source Type Badge */}
      <div className="mb-2 flex items-center justify-between">
        <span
          className={`text-xs font-medium ${sourceTypeColors[source.sourceType] || "text-neutral-600"}`}
        >
          {sourceTypeLabels[source.sourceType] || source.sourceType}
        </span>
        <span className={`text-xs ${reliabilityColor}`}>{reliabilityLabel}</span>
      </div>

      {/* Source Name */}
      <p className="text-sm font-medium text-neutral-900 dark:text-white">{source.sourceName}</p>

      {/* Document Date */}
      {source.documentDate && (
        <p className="mt-1 text-xs text-neutral-500">
          Document Date: {formatDate(source.documentDate)}
        </p>
      )}

      {/* Retrieved Date */}
      <p className="text-xs text-neutral-500">Retrieved: {formatDate(source.retrievedAt)}</p>

      {typeof source.confidence === "number" && (
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-neutral-200 dark:bg-neutral-700">
            <div
              className="bg-primary-500 h-1.5 rounded-full"
              style={{ width: `${source.confidence * 100}%` }}
            />
          </div>
          <span className="text-xs text-neutral-500">
            {Math.round(source.confidence * 100)}% confidence
          </span>
        </div>
      )}

      {/* AI Processing Indicator - Requirement 12.12 */}
      {source.isAIProcessed && (
        <p className="mt-2 flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400">
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 14a6 6 0 110-12 6 6 0 010 12z" />
            <path d="M10 5a1 1 0 011 1v3.586l2.707 2.707a1 1 0 01-1.414 1.414l-3-3A1 1 0 019 10V6a1 1 0 011-1z" />
          </svg>
          AI-processed from original document
        </p>
      )}

      {/* Source URL Link */}
      {source.sourceUrl && (
        <a
          href={source.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-500 hover:text-primary-600 mt-2 inline-flex items-center gap-1 text-xs"
        >
          View Original Source
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
  );
}

/**
 * Get reliability label based on source type
 * Requirement 12.11 - Source reliability indicator
 */
function getReliabilityLabel(sourceType: string): string {
  const labels: Record<string, string> = {
    official_government: "Primary Official",
    court_document: "Primary Official",
    comelec_filing: "Primary Official",
    legislative_record: "Primary Official",
    coa_report: "Secondary Official",
    third_party_verified: "Verified Third-Party",
    ai_extracted: "AI Processed",
  };
  return labels[sourceType] || "Unknown";
}

function getReliabilityColor(sourceType: string): string {
  const colors: Record<string, string> = {
    official_government: "text-success-600 dark:text-success-400",
    court_document: "text-success-600 dark:text-success-400",
    comelec_filing: "text-success-600 dark:text-success-400",
    legislative_record: "text-success-600 dark:text-success-400",
    coa_report: "text-primary-600 dark:text-primary-400",
    third_party_verified: "text-neutral-600 dark:text-neutral-400",
    ai_extracted: "text-purple-600 dark:text-purple-400",
  };
  return colors[sourceType] || "text-neutral-500";
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
