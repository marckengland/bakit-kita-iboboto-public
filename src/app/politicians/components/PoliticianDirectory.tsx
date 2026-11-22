/**
 * Politician Directory Component
 *
 * Main component that combines search, filters, politician list, and pagination.
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 11.1, 11.2, 11.3, 11.4, 11.5, 18.8
 */

import Link from "next/link";
import { GovernmentLevel } from "@prisma/client";
import { listPoliticians, PoliticianFilters } from "@/services/politician.service";
import { searchService, SearchResult } from "@/lib/search";
import { createPaginatedResult } from "@/lib/pagination";
import type { PoliticianSummary } from "@/services/politician.service";
import { FilterSidebar } from "./FilterSidebar";
import { PoliticianCard } from "./PoliticianCard";
import { ReviewedMembership } from "./ReviewedMembership";
import { Pagination } from "./Pagination";
import { MobileFilterDrawer } from "./MobileFilterDrawer";
import { SearchBar } from "./SearchBar";
// SearchResults is available for future use when search results need custom rendering
// import { SearchResults } from "./SearchResults";

interface SearchParams {
  page?: string;
  level?: string;
  region?: string;
  province?: string;
  city?: string;
  party?: string;
  position?: string;
  hasRedFlags?: string;
  q?: string; // Search query - Requirement 11.1
  [key: string]: string | undefined;
}

interface PoliticianDirectoryProps {
  searchParams: SearchParams;
}

const PAGE_SIZE = 12;

export async function PoliticianDirectory({ searchParams }: PoliticianDirectoryProps) {
  // Parse search params into filters
  const filters: PoliticianFilters = {};

  if (searchParams.level && isValidLevel(searchParams.level)) {
    filters.level = searchParams.level as GovernmentLevel;
  }
  if (searchParams.region) {
    filters.region = searchParams.region;
  }
  if (searchParams.province) {
    filters.province = searchParams.province;
  }
  if (searchParams.city) {
    filters.city = searchParams.city;
  }
  if (searchParams.party) {
    filters.party = searchParams.party;
  }
  if (searchParams.position) {
    filters.position = searchParams.position;
  }
  if (searchParams.hasRedFlags === "true") {
    filters.hasRedFlags = true;
  } else if (searchParams.hasRedFlags === "false") {
    filters.hasRedFlags = false;
  }

  const page = Math.max(1, parseInt(searchParams.page || "1", 10) || 1);
  const searchQuery = searchParams.q || "";

  // Determine if we're in search mode - Requirement 11.1
  const isSearchMode = searchQuery.length > 0;

  // Fetch data based on mode
  let result = createPaginatedResult<PoliticianSummary>([], 0, { page, pageSize: PAGE_SIZE });
  let searchMode: "full_text" | "name_lookup" | "fallback" = "full_text";
  let unavailable = false;
  let searchResults: SearchResult[] = [];
  let searchSuggestions: string[] = [];

  try {
    if (isSearchMode) {
      // Use search service with filters - Requirements 11.1, 11.2, 11.3
      const searchFilters = {
        level: filters.level,
        region: filters.region,
        province: filters.province,
        city: filters.city,
        party: filters.party,
        position: filters.position,
        hasRedFlags: filters.hasRedFlags,
      };

      const searchResponse = await searchService.search(
        searchQuery,
        searchFilters,
        page,
        PAGE_SIZE
      );

      searchMode = searchResponse.searchMode ?? "full_text";
      searchResults = searchResponse.searchMode ? [] : searchResponse.results;

      // Generate suggestions for no results - Requirement 11.4
      if (searchResponse.results.length === 0) {
        searchSuggestions = generateAlternativeSuggestions(searchQuery);
      }

      result = createPaginatedResult(
        searchResponse.results.map((r) => ({
          id: r.politician.id,
          fullName: r.politician.fullName,
          legalName: r.politician.legalName,
          photo: r.politician.photo,
          currentPosition: r.politician.currentPosition
            ? {
                title: r.politician.currentPosition.title,
                level: r.politician.currentPosition.level as GovernmentLevel,
                jurisdiction: r.politician.currentPosition.jurisdiction,
              }
            : undefined,
          currentParty: r.politician.currentParty
            ? {
                name: r.politician.currentParty.name,
                abbreviation: r.politician.currentParty.abbreviation,
              }
            : undefined,
          hasRedFlags: r.politician.hasRedFlags,
          ...(r.politician.reviewedBatch && { reviewedBatch: r.politician.reviewedBatch }),
        })),
        searchResponse.total,
        { page, pageSize: PAGE_SIZE }
      );
    } else {
      // Use regular listing with filters
      result = await listPoliticians(filters, { page, pageSize: PAGE_SIZE });
    }
  } catch (error) {
    console.error("Directory lookup failed:", error);
    if (isSearchMode) {
      try {
        result = await listPoliticians(
          { ...filters, name: searchQuery },
          { page, pageSize: PAGE_SIZE }
        );
        searchMode = "fallback";
      } catch (fallbackError) {
        console.error("Directory name lookup failed:", fallbackError);
        unavailable = true;
      }
    } else {
      unavailable = true;
    }
  }

  const browseParams = new URLSearchParams(
    Object.entries(searchParams).filter(
      ([key, value]) => key !== "q" && key !== "page" && value !== undefined
    ) as [string, string][]
  );
  const browseHref = `/politicians${browseParams.size ? `?${browseParams}` : ""}`;

  const activeFilterCount = Object.values(filters).filter(
    (v) => v !== undefined && v !== ""
  ).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Search Bar - Requirements 11.1, 11.5 */}
      <SearchBar initialQuery={searchQuery} className="w-full" />

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Mobile Filter Button */}
        <MobileFilterDrawer filters={filters} activeFilterCount={activeFilterCount} />

        {/* Desktop Filter Sidebar */}
        <aside className="hidden w-72 flex-shrink-0 lg:block">
          <FilterSidebar filters={filters} />
        </aside>

        {/* Main Content */}
        <div className="flex-1">
          {/* Results Header */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {unavailable ? (
              <p role="status">
                Profiles are temporarily unavailable. Your search and filters are preserved.
              </p>
            ) : isSearchMode ? (
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {result.totalCount === 0 ? (
                  "No results found"
                ) : (
                  <>
                    Found{" "}
                    <span className="font-medium text-neutral-900 dark:text-white">
                      {result.totalCount}
                    </span>{" "}
                    {result.totalCount === 1 ? "result" : "results"} for &quot;
                    <span className="text-primary-500 font-medium">{searchQuery}</span>
                    &quot;
                    {activeFilterCount > 0 && (
                      <span className="text-neutral-500">
                        {" "}
                        with {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} applied
                      </span>
                    )}
                  </>
                )}
              </p>
            ) : (
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {result.totalCount === 0 ? (
                  "No politicians found"
                ) : (
                  <>
                    Showing{" "}
                    <span className="font-medium text-neutral-900 dark:text-white">
                      {(page - 1) * PAGE_SIZE + 1}
                    </span>{" "}
                    to{" "}
                    <span className="font-medium text-neutral-900 dark:text-white">
                      {Math.min(page * PAGE_SIZE, result.totalCount)}
                    </span>{" "}
                    of{" "}
                    <span className="font-medium text-neutral-900 dark:text-white">
                      {result.totalCount}
                    </span>{" "}
                    politicians
                  </>
                )}
              </p>
            )}

            {(activeFilterCount > 0 || isSearchMode) && (
              <Link
                href="/politicians"
                className="text-primary-500 hover:text-primary-600 text-sm font-medium"
              >
                Clear {isSearchMode ? "search" : ""}
                {isSearchMode && activeFilterCount > 0 ? " & " : ""}
                {activeFilterCount > 0 ? `filters (${activeFilterCount})` : ""}
              </Link>
            )}
          </div>

          {searchMode === "fallback" && (
            <p
              className="mb-4 rounded-lg bg-neutral-100 p-4 text-sm dark:bg-neutral-800"
              role="status"
            >
              Full-text search is temporarily unavailable. Showing name matches only.
            </p>
          )}

          {/* Search Results or Politicians Grid */}
          {unavailable ? (
            <div className="card space-y-4">
              <p>Please try again, or browse profiles with your current filters.</p>
              <Link href={browseHref} className="btn-outline">
                Browse profiles
              </Link>
            </div>
          ) : result.items.length > 0 ? (
            <>
              {isSearchMode && searchMode === "full_text" ? (
                // Search results with relevance info - Requirement 11.2
                <div className="space-y-3">
                  {searchResults.map((searchResult) => (
                    <SearchResultCard key={searchResult.politician.id} result={searchResult} />
                  ))}
                </div>
              ) : (
                // Regular grid view
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {result.items.map((politician) => (
                    <PoliticianCard key={politician.id} politician={politician} />
                  ))}
                </div>
              )}

              {/* Pagination */}
              {result.totalPages > 1 && (
                <div className="mt-8">
                  <Pagination
                    currentPage={result.page}
                    totalPages={result.totalPages}
                    baseUrl="/politicians"
                    searchParams={searchParams}
                  />
                </div>
              )}
            </>
          ) : (
            <EmptyState
              hasFilters={activeFilterCount > 0}
              isSearchMode={isSearchMode}
              searchQuery={searchQuery}
              suggestions={searchSuggestions}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function isValidLevel(level: string): boolean {
  const validLevels: GovernmentLevel[] = [
    "national",
    "regional",
    "provincial",
    "city",
    "municipal",
    "barangay",
  ];
  return validLevels.includes(level as GovernmentLevel);
}

/**
 * Generate alternative search suggestions when no results are found
 * Requirement 11.4
 */
function generateAlternativeSuggestions(query: string): string[] {
  const suggestions: string[] = [];
  const lowerQuery = query.toLowerCase();

  // Common misspellings and alternatives for Philippine political terms
  const alternatives: Record<string, string[]> = {
    marcos: ["Marcos", "Ferdinand Marcos", "Bongbong Marcos"],
    duterte: ["Duterte", "Rodrigo Duterte", "Sara Duterte"],
    aquino: ["Aquino", "Benigno Aquino", "Cory Aquino"],
    estrada: ["Estrada", "Joseph Estrada", "Jinggoy Estrada"],
    revilla: ["Revilla", "Bong Revilla"],
    pacquiao: ["Pacquiao", "Manny Pacquiao"],
    senator: ["Senator", "Senador"],
    congressman: ["Congressman", "Representative", "Kongresista"],
    mayor: ["Mayor", "Alkalde"],
    governor: ["Governor", "Gobernador"],
    president: ["President", "Pangulo"],
    manila: ["Manila", "City of Manila", "NCR"],
    cebu: ["Cebu", "Cebu City", "Cebu Province"],
    davao: ["Davao", "Davao City", "Davao del Sur"],
    quezon: ["Quezon City", "Quezon Province"],
  };

  for (const [key, values] of Object.entries(alternatives)) {
    if (lowerQuery.includes(key) || key.includes(lowerQuery)) {
      suggestions.push(...values.filter((v) => v.toLowerCase() !== lowerQuery));
    }
  }

  if (query.length <= 3) {
    suggestions.push("Senator", "Mayor", "Governor", "Congressman");
  }

  return Array.from(new Set(suggestions)).slice(0, 5);
}

interface EmptyStateProps {
  hasFilters: boolean;
  isSearchMode?: boolean;
  searchQuery?: string;
  suggestions?: string[];
}

function EmptyState({
  hasFilters,
  isSearchMode = false,
  searchQuery = "",
  suggestions = [],
}: EmptyStateProps) {
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
            d={
              isSearchMode
                ? "M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                : "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            }
          />
        </svg>
      </div>
      <h3 className="mb-2 text-lg font-semibold text-neutral-900 dark:text-white">
        {isSearchMode ? "No results found" : "No politicians found"}
      </h3>
      <p className="mb-6 max-w-sm text-neutral-600 dark:text-neutral-400">
        {isSearchMode ? (
          <>
            We couldn&apos;t find any politicians matching &quot;
            <span className="font-medium">{searchQuery}</span>&quot;
          </>
        ) : hasFilters ? (
          "Try adjusting your filters to find more politicians."
        ) : (
          "There are no politicians in the database yet."
        )}
      </p>

      {/* Alternative Suggestions - Requirement 11.4 */}
      {isSearchMode && suggestions.length > 0 && (
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
      {isSearchMode && (
        <div className="mb-6 rounded-lg bg-neutral-50 p-4 text-left dark:bg-neutral-800/50">
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
      )}

      {(hasFilters || isSearchMode) && (
        <Link href="/politicians" className="btn-primary">
          {isSearchMode ? "Browse all politicians" : "Clear all filters"}
        </Link>
      )}
    </div>
  );
}

/**
 * Search Result Card Component
 * Displays a search result with relevance information
 */
import Image from "next/image";
import { RedFlagIndicator } from "./RedFlagIndicator";

function SearchResultCard({ result }: { result: SearchResult }) {
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
            {/* Legal name sublabel */}
            {politician.legalName && politician.legalName !== politician.fullName && (
              <p className="truncate text-xs text-neutral-400 dark:text-neutral-500">
                {politician.legalName}
              </p>
            )}

            {/* Position with highlight */}
            {politician.reviewedBatch ? (
              <ReviewedMembership
                batch={politician.reviewedBatch}
                className="mt-1 text-sm text-neutral-600 dark:text-neutral-400"
              />
            ) : (
              politician.currentPosition && (
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
              )
            )}

            {/* Party with highlight */}
            {!politician.reviewedBatch && politician.currentParty && (
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
            <svg
              className="h-3 w-3"
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
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 3)
    .join(", ");
}
