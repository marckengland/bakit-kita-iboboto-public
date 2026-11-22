/**
 * Search Results Component
 *
 * Displays search results with relevance ranking and alternative suggestions.
 * Requirements: 11.1, 11.2, 11.3, 11.4
 */

"use client";

import Image from "next/image";
import Link from "next/link";
import type { SearchResult } from "@/lib/search";
import { RedFlagIndicator } from "./RedFlagIndicator";

interface SearchResultsProps {
  results: SearchResult[];
  query: string;
  totalCount: number;
  suggestions?: string[];
}

export function SearchResults({
  results,
  query,
  totalCount,
  suggestions = [],
}: SearchResultsProps) {
  if (results.length === 0) {
    return <NoResultsState query={query} suggestions={suggestions} />;
  }

  return (
    <div className="space-y-4">
      {/* Results Header - Requirement 11.2 */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Found <span className="font-medium text-neutral-900 dark:text-white">{totalCount}</span>{" "}
          {totalCount === 1 ? "result" : "results"} for &quot;
          <span className="text-primary-500 font-medium">{query}</span>&quot;
        </p>
        <p className="text-xs text-neutral-500">Sorted by relevance</p>
      </div>

      {/* Results List */}
      <div className="space-y-3">
        {results.map((result) => (
          <SearchResultCard key={result.politician.id} result={result} />
        ))}
      </div>
    </div>
  );
}

interface SearchResultCardProps {
  result: SearchResult;
}

function SearchResultCard({ result }: SearchResultCardProps) {
  const { politician, relevanceScore, matchedFields, highlights } = result;

  return (
    <Link
      href={`/politicians/${politician.id}`}
      className="group hover:border-primary-200 hover:shadow-soft dark:hover:border-primary-800 flex gap-4 rounded-xl border border-neutral-200 bg-white p-4 transition-all dark:border-neutral-800 dark:bg-neutral-900"
    >
      {/* Photo */}
      <div className="flex-shrink-0">
        {politician.photo ? (
          <div className="relative h-16 w-16 overflow-hidden rounded-full">
            <Image
              src={politician.photo}
              alt={politician.fullName}
              fill
              className="object-cover"
              sizes="64px"
            />
          </div>
        ) : (
          <div className="bg-primary-100 dark:bg-primary-900 flex h-16 w-16 items-center justify-center rounded-full">
            <span className="text-primary-500 text-xl font-semibold">
              {getInitials(politician.fullName)}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {/* Name with highlight */}
            <h3 className="group-hover:text-primary-500 truncate text-base font-semibold text-neutral-900 dark:text-white">
              {highlights.fullName && highlights.fullName[0] ? (
                <span
                  dangerouslySetInnerHTML={{
                    __html: highlights.fullName[0],
                  }}
                />
              ) : (
                politician.fullName
              )}
            </h3>

            {/* Position with highlight */}
            {politician.currentPosition && (
              <p className="mt-0.5 truncate text-sm text-neutral-600 dark:text-neutral-400">
                {highlights["currentPosition.title"] && highlights["currentPosition.title"][0] ? (
                  <span
                    dangerouslySetInnerHTML={{
                      __html: highlights["currentPosition.title"][0],
                    }}
                  />
                ) : (
                  politician.currentPosition.title
                )}
                {politician.currentPosition.jurisdiction && (
                  <>
                    {" • "}
                    {highlights["currentPosition.jurisdiction"] &&
                    highlights["currentPosition.jurisdiction"][0] ? (
                      <span
                        dangerouslySetInnerHTML={{
                          __html: highlights["currentPosition.jurisdiction"][0],
                        }}
                      />
                    ) : (
                      politician.currentPosition.jurisdiction
                    )}
                  </>
                )}
              </p>
            )}

            {/* Party with highlight */}
            {politician.currentParty && (
              <p className="mt-0.5 truncate text-sm text-neutral-500 dark:text-neutral-500">
                {highlights["currentParty.name"] && highlights["currentParty.name"][0] ? (
                  <span
                    dangerouslySetInnerHTML={{
                      __html: highlights["currentParty.name"][0],
                    }}
                  />
                ) : (
                  politician.currentParty.name
                )}
              </p>
            )}
          </div>

          {/* Red Flag Indicator */}
          {politician.hasRedFlags && (
            <div className="flex-shrink-0">
              <RedFlagIndicator />
            </div>
          )}
        </div>

        {/* Matched Fields & Relevance */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {/* Relevance Score Badge */}
          <span className="bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium">
            <RelevanceIcon className="h-3 w-3" />
            {Math.round(relevanceScore * 10) / 10}
          </span>

          {/* Matched Fields */}
          {matchedFields.length > 0 && (
            <span className="text-xs text-neutral-500">
              Matched: {formatMatchedFields(matchedFields)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

interface NoResultsStateProps {
  query: string;
  suggestions: string[];
}

function NoResultsState({ query, suggestions }: NoResultsStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-neutral-200 bg-white py-16 text-center dark:border-neutral-800 dark:bg-neutral-900">
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
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
      </div>
      <h3 className="mb-2 text-lg font-semibold text-neutral-900 dark:text-white">
        No results found
      </h3>
      <p className="mb-6 max-w-sm text-neutral-600 dark:text-neutral-400">
        We couldn&apos;t find any politicians matching &quot;
        <span className="font-medium">{query}</span>&quot;
      </p>

      {/* Alternative Suggestions - Requirement 11.4 */}
      {suggestions.length > 0 && (
        <div className="mb-6">
          <p className="mb-3 text-sm text-neutral-500">Did you mean:</p>
          <div className="flex flex-wrap justify-center gap-2">
            {suggestions.map((suggestion) => (
              <Link
                key={suggestion}
                href={`/politicians?q=${encodeURIComponent(suggestion)}`}
                className="border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100 dark:border-primary-800 dark:bg-primary-900/30 dark:text-primary-400 dark:hover:bg-primary-900/50 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors"
              >
                {suggestion}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Search Tips */}
      <div className="rounded-lg bg-neutral-50 p-4 text-left dark:bg-neutral-800/50">
        <p className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Search tips:
        </p>
        <ul className="space-y-1 text-sm text-neutral-600 dark:text-neutral-400">
          <li>• Try using different keywords</li>
          <li>• Check the spelling of names</li>
          <li>• Search by position (e.g., &quot;Senator&quot;, &quot;Mayor&quot;)</li>
          <li>• Search by location (e.g., &quot;Cebu&quot;, &quot;NCR&quot;)</li>
        </ul>
      </div>

      <Link href="/politicians" className="btn-primary mt-6">
        Browse all politicians
      </Link>
    </div>
  );
}

// Helper functions
function getInitials(name: string): string {
  const parts = name.split(" ");
  if (parts.length >= 2) {
    const firstInitial = parts[0]?.[0] || "";
    const lastInitial = parts[parts.length - 1]?.[0] || "";
    return `${firstInitial}${lastInitial}`.toUpperCase();
  }
  const initial = name[0] || "?";
  return initial.toUpperCase();
}

function formatMatchedFields(fields: string[]): string {
  const fieldLabels: Record<string, string> = {
    fullName: "name",
    "currentPosition.title": "position",
    "currentPosition.jurisdiction": "location",
    "currentParty.name": "party",
  };

  return fields
    .map((field) => fieldLabels[field] || field)
    .filter((v, i, a) => a.indexOf(v) === i) // unique
    .slice(0, 3)
    .join(", ");
}

function RelevanceIcon({ className }: { className?: string }) {
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
        d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
      />
    </svg>
  );
}
