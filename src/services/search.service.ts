/**
 * Search Service
 *
 * Full-text search service for politicians with Elasticsearch integration.
 * Implements requirements: 11.1, 11.2, 11.3, 11.4
 */

import { estypes } from "@elastic/elasticsearch";
type QueryDslQueryContainer = estypes.QueryDslQueryContainer;
import elasticsearch, { INDICES } from "@/lib/elasticsearch";
import { cache, CACHE_KEYS, CACHE_TTL } from "@/lib/redis";

// ============================================
// Types and Interfaces
// ============================================

/**
 * Government level enum
 */
export type GovernmentLevel =
  | "national"
  | "regional"
  | "provincial"
  | "city"
  | "municipal"
  | "barangay";

/**
 * Politician search document structure for Elasticsearch
 */
export interface PoliticianSearchDocument {
  id: string;
  fullName: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string;
  currentPosition?: {
    title: string;
    level: GovernmentLevel;
    jurisdiction: string;
  };
  currentParty?: {
    name: string;
    abbreviation: string;
  };
  region?: string;
  province?: string;
  city?: string;
  isActive: boolean;
  hasRedFlags: boolean;
  photo?: string;
  popularityScore: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Search filters for politician queries
 */
export interface PoliticianSearchFilters {
  level?: GovernmentLevel;
  region?: string;
  province?: string;
  city?: string;
  party?: string;
  position?: string;
  hasRedFlags?: boolean;
  isActive?: boolean;
}

/**
 * Search result with relevance score
 * Validates: Requirement 11.2
 */
export interface SearchResult {
  politician: PoliticianSearchDocument;
  relevanceScore: number;
  matchedFields: string[];
  highlights: Record<string, string[]>;
}

/**
 * Paginated search response
 */
export interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  query: string;
  filters: PoliticianSearchFilters;
}

/**
 * Autocomplete suggestion
 * Validates: Requirement 11.5
 */
export interface AutocompleteSuggestion {
  id: string;
  text: string;
  type: "politician" | "position" | "location" | "party";
  subtext?: string;
  popularityScore: number;
}

// ============================================
// Search Field Configuration
// ============================================

/**
 * Searchable fields with their boost weights
 */
export const SEARCH_FIELDS = {
  fullName: 3,
  firstName: 2,
  lastName: 2,
  "currentPosition.title": 1.5,
  "currentPosition.jurisdiction": 1,
  "currentParty.name": 1,
  region: 1,
  province: 1,
  city: 1,
} as const;

/**
 * Get search fields with boost values as array
 */
export function getSearchFieldsWithBoost(): string[] {
  return Object.entries(SEARCH_FIELDS).map(([field, boost]) => `${field}^${boost}`);
}

// ============================================
// Filter Building Functions
// ============================================

/**
 * Build Elasticsearch filter clauses from search filters
 */
export function buildFilterClauses(filters: PoliticianSearchFilters): QueryDslQueryContainer[] {
  const clauses: QueryDslQueryContainer[] = [];

  if (filters.level) {
    clauses.push({ term: { "currentPosition.level": filters.level } });
  }
  if (filters.region) {
    clauses.push({ match: { "region.keyword": filters.region } });
  }
  if (filters.province) {
    clauses.push({ match: { "province.keyword": filters.province } });
  }
  if (filters.city) {
    clauses.push({ match: { "city.keyword": filters.city } });
  }
  if (filters.party) {
    clauses.push({ match: { "currentParty.name.keyword": filters.party } });
  }
  if (filters.position) {
    clauses.push({
      match: { "currentPosition.title.keyword": filters.position },
    });
  }
  if (filters.hasRedFlags !== undefined) {
    clauses.push({ term: { hasRedFlags: filters.hasRedFlags } });
  }
  if (filters.isActive !== undefined) {
    clauses.push({ term: { isActive: filters.isActive } });
  }

  return clauses;
}

/**
 * Build the main search query
 * Validates: Requirement 11.1, 11.3
 */
export function buildSearchQuery(
  query: string,
  filters: PoliticianSearchFilters
): QueryDslQueryContainer {
  const filterClauses = buildFilterClauses(filters);

  return {
    bool: {
      must: query
        ? [
            {
              multi_match: {
                query,
                fields: getSearchFieldsWithBoost(),
                type: "best_fields",
                fuzziness: "AUTO",
              },
            },
          ]
        : [{ match_all: {} }],
      filter: filterClauses,
    },
  };
}

// ============================================
// Relevance Scoring Functions
// ============================================

/**
 * Calculate relevance score from Elasticsearch score
 * Normalizes score to 0-100 range
 */
export function normalizeRelevanceScore(
  esScore: number | undefined,
  maxScore: number | undefined
): number {
  if (!esScore || !maxScore || maxScore === 0) {
    return 0;
  }
  return Math.round((esScore / maxScore) * 100);
}

/**
 * Extract matched fields from highlights
 */
export function extractMatchedFields(highlights: Record<string, string[]> | undefined): string[] {
  if (!highlights) {
    return [];
  }
  return Object.keys(highlights);
}

// ============================================
// Search Service Implementation
// ============================================

/**
 * Search politicians by query with filters
 * Results are ranked by relevance score in descending order
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4
 */
export async function searchPoliticians(
  query: string,
  filters: PoliticianSearchFilters = {},
  page: number = 1,
  pageSize: number = 20
): Promise<SearchResponse> {
  // Validate pagination
  const validPage = Math.max(1, page);
  const validPageSize = Math.min(Math.max(1, pageSize), 100);

  // Generate cache key
  const cacheKey = `${CACHE_KEYS.SEARCH}${JSON.stringify({
    query,
    filters,
    page: validPage,
    pageSize: validPageSize,
  })}`;

  // Check cache first
  const cached = await cache.get<SearchResponse>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const searchQuery = buildSearchQuery(query, filters);

    const response = await elasticsearch.search<PoliticianSearchDocument>({
      index: INDICES.POLITICIANS,
      query: searchQuery,
      from: (validPage - 1) * validPageSize,
      size: validPageSize,
      highlight: {
        fields: {
          fullName: {},
          "currentPosition.title": {},
          "currentPosition.jurisdiction": {},
          "currentParty.name": {},
          region: {},
          province: {},
          city: {},
        },
        pre_tags: ["<mark>"],
        post_tags: ["</mark>"],
      },
      sort: [{ _score: { order: "desc" } }, { popularityScore: { order: "desc" } }],
    });

    // maxScore available for normalization if needed
    void response.hits.max_score;

    const results: SearchResult[] = response.hits.hits.map((hit) => {
      const source = hit._source as PoliticianSearchDocument;
      const highlights = (hit.highlight || {}) as Record<string, string[]>;

      return {
        politician: source,
        relevanceScore: hit._score || 0,
        matchedFields: extractMatchedFields(highlights),
        highlights,
      };
    });

    const total =
      typeof response.hits.total === "number"
        ? response.hits.total
        : response.hits.total?.value || 0;

    const searchResponse: SearchResponse = {
      results,
      total,
      page: validPage,
      pageSize: validPageSize,
      totalPages: Math.ceil(total / validPageSize),
      query,
      filters,
    };

    // Cache the results
    await cache.set(cacheKey, searchResponse, CACHE_TTL.SHORT);

    return searchResponse;
  } catch (error) {
    console.error("Error searching politicians:", error);
    throw error;
  }
}

/**
 * Get autocomplete suggestions as user types
 * Suggestions are ranked by popularity
 * Validates: Requirement 11.5
 */
export async function getAutocompleteSuggestions(
  prefix: string,
  limit: number = 10
): Promise<AutocompleteSuggestion[]> {
  if (!prefix || prefix.length < 1) {
    return [];
  }

  const validLimit = Math.min(Math.max(1, limit), 50);

  // Generate cache key
  const cacheKey = `${CACHE_KEYS.AUTOCOMPLETE}${prefix.toLowerCase()}:${validLimit}`;

  // Check cache first
  const cached = await cache.get<AutocompleteSuggestion[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const response = await elasticsearch.search<PoliticianSearchDocument>({
      index: INDICES.POLITICIANS,
      query: {
        bool: {
          should: [
            {
              multi_match: {
                query: prefix,
                fields: [
                  "fullName.autocomplete^3",
                  "firstName.autocomplete^2",
                  "lastName.autocomplete^2",
                  "currentPosition.title.autocomplete",
                  "currentPosition.jurisdiction.autocomplete",
                  "currentParty.name.autocomplete",
                ],
                type: "best_fields",
              },
            },
          ],
          minimum_should_match: 1,
        },
      },
      size: validLimit,
      sort: [{ _score: { order: "desc" } }, { popularityScore: { order: "desc" } }],
      _source: [
        "id",
        "fullName",
        "currentPosition.title",
        "currentPosition.jurisdiction",
        "currentParty.name",
        "popularityScore",
      ],
    });

    const suggestions: AutocompleteSuggestion[] = response.hits.hits.map((hit) => {
      const source = hit._source as PoliticianSearchDocument;
      const position = source.currentPosition;
      const party = source.currentParty;

      return {
        id: source.id,
        text: source.fullName,
        type: "politician" as const,
        subtext: position
          ? `${position.title}, ${position.jurisdiction}${party ? ` (${party.name})` : ""}`
          : party?.name,
        popularityScore: source.popularityScore || 0,
      };
    });

    // Cache the suggestions
    await cache.set(cacheKey, suggestions, CACHE_TTL.SHORT);

    return suggestions;
  } catch (error) {
    console.error("Error getting autocomplete suggestions:", error);
    throw error;
  }
}

/**
 * Index a politician document for search
 */
export async function indexPolitician(politician: PoliticianSearchDocument): Promise<void> {
  try {
    await elasticsearch.index({
      index: INDICES.POLITICIANS,
      id: politician.id,
      document: politician,
      refresh: true,
    });

    // Invalidate search caches
    await cache.invalidateSearch();
  } catch (error) {
    console.error(`Error indexing politician ${politician.id}:`, error);
    throw error;
  }
}

/**
 * Bulk index multiple politicians
 */
export async function bulkIndexPoliticians(politicians: PoliticianSearchDocument[]): Promise<void> {
  if (politicians.length === 0) {
    return;
  }

  try {
    const operations = politicians.flatMap((doc) => [
      { index: { _index: INDICES.POLITICIANS, _id: doc.id } },
      doc,
    ]);

    await elasticsearch.bulk({
      refresh: true,
      operations,
    });

    // Invalidate search caches
    await cache.invalidateSearch();
  } catch (error) {
    console.error("Error bulk indexing politicians:", error);
    throw error;
  }
}

/**
 * Remove a politician from the search index
 */
export async function removePoliticianFromIndex(politicianId: string): Promise<void> {
  try {
    await elasticsearch.delete({
      index: INDICES.POLITICIANS,
      id: politicianId,
      refresh: true,
    });

    // Invalidate search caches
    await cache.invalidateSearch();
  } catch (error) {
    console.error(`Error removing politician ${politicianId}:`, error);
    throw error;
  }
}

/**
 * Update politician popularity score (for ranking autocomplete)
 * Called when a politician profile is viewed
 */
export async function incrementPopularity(politicianId: string): Promise<void> {
  try {
    await elasticsearch.update({
      index: INDICES.POLITICIANS,
      id: politicianId,
      script: {
        source: "ctx._source.popularityScore += params.increment",
        params: { increment: 1 },
      },
    });
  } catch (error) {
    // Don't throw - popularity update is not critical
    console.error(`Error updating popularity for ${politicianId}:`, error);
  }
}

/**
 * Get search suggestions when no results are found
 * Validates: Requirement 11.4
 */
export async function getAlternativeSuggestions(
  query: string,
  limit: number = 5
): Promise<string[]> {
  if (!query || query.length < 2) {
    return [];
  }

  try {
    // Use fuzzy matching to find similar terms
    const response = await elasticsearch.search<PoliticianSearchDocument>({
      index: INDICES.POLITICIANS,
      query: {
        multi_match: {
          query,
          fields: [
            "fullName",
            "nickname",
            "firstName",
            "lastName",
            "currentPosition.title",
            "currentParty.name",
          ],
          fuzziness: "2",
        },
      },
      size: limit,
      _source: ["fullName"],
    });

    return response.hits.hits
      .map((hit) => (hit._source as PoliticianSearchDocument).fullName)
      .filter((name, index, self) => self.indexOf(name) === index);
  } catch (error) {
    console.error("Error getting alternative suggestions:", error);
    return [];
  }
}

/**
 * Validate search results match query and filters
 * Used for testing search correctness
 */
export function validateSearchResult(
  result: SearchResult,
  query: string,
  filters: PoliticianSearchFilters
): boolean {
  const politician = result.politician;

  // Check query match (if query provided)
  if (query) {
    const queryLower = query.toLowerCase();
    const matchesQuery =
      politician.fullName.toLowerCase().includes(queryLower) ||
      politician.firstName.toLowerCase().includes(queryLower) ||
      politician.lastName.toLowerCase().includes(queryLower) ||
      politician.currentPosition?.title.toLowerCase().includes(queryLower) ||
      politician.currentPosition?.jurisdiction.toLowerCase().includes(queryLower) ||
      politician.currentParty?.name.toLowerCase().includes(queryLower) ||
      politician.region?.toLowerCase().includes(queryLower) ||
      politician.province?.toLowerCase().includes(queryLower) ||
      politician.city?.toLowerCase().includes(queryLower);

    if (!matchesQuery) {
      return false;
    }
  }

  // Check filter matches
  if (filters.level && politician.currentPosition?.level !== filters.level) {
    return false;
  }
  if (filters.region && politician.region !== filters.region) {
    return false;
  }
  if (filters.party && politician.currentParty?.name !== filters.party) {
    return false;
  }
  if (filters.hasRedFlags !== undefined && politician.hasRedFlags !== filters.hasRedFlags) {
    return false;
  }

  return true;
}
