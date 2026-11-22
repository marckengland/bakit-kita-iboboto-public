/**
 * Sources Accordion Component
 *
 * Reusable expand/collapse panel showing source attributions for any data section.
 * Displays source name, type, confidence, date, and clickable URL.
 */

"use client";

import { useState } from "react";

export interface SourceInfo {
  sourceType: string;
  sourceName: string;
  sourceUrl?: string | null;
  documentDate?: Date | null;
  retrievedAt?: Date | null;
  confidence?: number | null;
  isAIProcessed?: boolean;
}

interface SourcesAccordionProps {
  sources: SourceInfo[];
  label?: string;
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  official_government: "Official Government",
  court_document: "Court Document",
  comelec_filing: "COMELEC Filing",
  legislative_record: "Legislative Record",
  coa_report: "COA Report",
  third_party_verified: "Third-Party Verified",
  ai_extracted: "AI Extracted",
};

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function SourcesAccordion({ sources, label = "Sources" }: SourcesAccordionProps) {
  const [open, setOpen] = useState(false);

  if (sources.length === 0) {
    return null;
  }

  // Deduplicate by sourceName + sourceUrl
  const unique = sources.filter(
    (s, i, arr) =>
      arr.findIndex((x) => x.sourceName === s.sourceName && x.sourceUrl === s.sourceUrl) === i
  );

  return (
    <div className="mt-3 rounded-lg border border-neutral-200 dark:border-neutral-700">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800"
        aria-expanded={open}
      >
        <span className="flex items-center gap-1.5">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
          {label} ({unique.length})
        </span>
        <svg
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-neutral-200 px-3 py-2 dark:border-neutral-700">
          <div className="space-y-2">
            {unique.map((source, i) => (
              <div
                key={i}
                className="flex items-start justify-between gap-2 rounded-md bg-neutral-50 p-2 dark:bg-neutral-800"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-neutral-900 dark:text-white">
                      {source.sourceName}
                    </span>
                    {source.confidence !== undefined &&
                      source.confidence !== null &&
                      source.confidence > 0 && (
                        <span className="text-[10px] text-neutral-400">
                          {Math.round(source.confidence * 100)}%
                        </span>
                      )}
                  </div>
                  <span className="text-[10px] text-neutral-400">
                    {SOURCE_TYPE_LABELS[source.sourceType] || source.sourceType}
                    {source.documentDate && ` · ${formatDate(source.documentDate)}`}
                  </span>
                </div>
                {source.sourceUrl && (
                  <a
                    href={source.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-500 hover:text-primary-600 flex-shrink-0"
                    aria-label={`View source: ${source.sourceName}`}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            ))}
          </div>
          {unique.some((s) => s.isAIProcessed) && (
            <p className="mt-2 text-[10px] text-purple-500">
              Some data was AI-processed from original documents
            </p>
          )}
        </div>
      )}
    </div>
  );
}
