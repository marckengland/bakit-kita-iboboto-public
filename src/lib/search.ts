import prisma from "./prisma";
import { getReleasedProfile, releaseData, type ReleasedProfileContext } from "./release-data";
import { listPoliticians, type PoliticianSummary } from "@/services/politician.service";
import { getPublicRedFlagsBatch } from "@/services/public-research.service";
import { estypes } from "@elastic/elasticsearch";
type QueryDslQueryContainer = estypes.QueryDslQueryContainer;
import elasticsearch, { INDICES } from "./elasticsearch";
import { cache, CACHE_KEYS, CACHE_TTL } from "./redis";

/**
 * Politician search document structure for Elasticsearch
 */
export interface PoliticianSearchDocument {
  id: string;
  fullName: string;
  legalName?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string;
  nickname?: string;
  currentPosition?: {
    title: string;
    level: string;
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
  level?: "national" | "regional" | "provincial" | "city" | "municipal" | "barangay";
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
 */
export interface SearchResult {
  politician: Omit<PoliticianSearchDocument, "hasRedFlags"> & {
    hasRedFlags: boolean | null;
    reviewedBatch?: ReleasedProfileContext;
  };
  relevanceScore: number;
  matchedFields: string[];
  highlights: Record<string, string[]>;
}

type NameSearchResponse = {
  results: (Omit<SearchResult, "politician"> & { politician: PoliticianSummary })[];
  total: number;
  searchMode: "name_lookup";
};

type SearchLookup =
  | { results: SearchResult[]; total: number; searchMode?: undefined }
  | NameSearchResponse;

export async function hasImportedReleasedProfile(query: string): Promise<boolean> {
  const name = query.trim().toLowerCase();
  const ids = releaseData.profiles
    .filter(({ displayName }) => !name || displayName.toLowerCase().includes(name))
    .map(({ id }) => id);
  return ids.length > 0 && (await prisma.politician.count({ where: { id: { in: ids } } })) > 0;
}

export async function searchByName(
  query: string,
  filters: PoliticianSearchFilters,
  page: number,
  pageSize: number
): Promise<NameSearchResponse> {
  const result = await listPoliticians({ ...filters, name: query }, { page, pageSize });
  return {
    results: result.items.map((politician) => ({
      politician,
      relevanceScore: 0,
      matchedFields: [],
      highlights: {},
    })),
    total: result.totalCount,
    searchMode: "name_lookup",
  };
}

/**
 * Autocomplete suggestion
 */
export interface AutocompleteSuggestion {
  id: string;
  text: string;
  type: "politician" | "position" | "location" | "party";
  subtext?: string;
  popularityScore: number;
}

/**
 * Search service for politician search and autocomplete
 */
export const searchService = {
  /**
   * Index a politician document for search
   */
  async indexPolitician(politician: PoliticianSearchDocument): Promise<void> {
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
  },

  /**
   * Bulk index multiple politicians
   */
  async bulkIndexPoliticians(politicians: PoliticianSearchDocument[]): Promise<void> {
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
  },

  /**
   * Remove a politician from the search index
   */
  async removePolitician(politicianId: string): Promise<void> {
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
  },

  /**
   * Search politicians by query with filters
   * Results are ranked by relevance
   */
  async search(
    query: string,
    filters: PoliticianSearchFilters = {},
    page: number = 1,
    pageSize: number = 20
  ): Promise<SearchLookup> {
    if (await hasImportedReleasedProfile(query)) {
      return searchByName(query, filters, page, pageSize);
    }

    // Search responses carry case-derived indicators; never reuse a stored eligibility decision.
    try {
      // Build filter clauses
      const filterClauses: object[] = [];

      if (filters.level) {
        filterClauses.push({ term: { "currentPosition.level": filters.level } });
      }
      if (filters.region) {
        filterClauses.push({ match: { "region.keyword": filters.region } });
      }
      if (filters.province) {
        filterClauses.push({ match: { "province.keyword": filters.province } });
      }
      if (filters.city) {
        filterClauses.push({ match: { "city.keyword": filters.city } });
      }
      if (filters.party) {
        filterClauses.push({ match: { "currentParty.name.keyword": filters.party } });
      }
      if (filters.position) {
        filterClauses.push({ match: { "currentPosition.title.keyword": filters.position } });
      }
      if (filters.hasRedFlags !== undefined) {
        const people = await prisma.politician.findMany({ select: { id: true } });
        const eligible = [...(await getPublicRedFlagsBatch(people.map((p) => p.id)))]
          .filter(([, flags]) => flags.length > 0)
          .map(([id]) => id);
        if (filters.hasRedFlags && !eligible.length) {
          return { results: [], total: 0 };
        }
        const unknown = people.filter(({ id }) => getReleasedProfile(id)).map(({ id }) => id);
        filterClauses.push(
          filters.hasRedFlags
            ? { terms: { id: eligible } }
            : { bool: { must_not: [{ terms: { id: [...new Set([...eligible, ...unknown])] } }] } }
        );
      }
      if (filters.isActive !== undefined) {
        filterClauses.push({ term: { isActive: filters.isActive } });
      }

      // Build search query
      const searchQuery: QueryDslQueryContainer = {
        bool: {
          must: query
            ? [
                {
                  multi_match: {
                    query,
                    fields: [
                      "fullName^3",
                      "nickname^3",
                      "firstName^2",
                      "lastName^2",
                      "currentPosition.title^1.5",
                      "currentPosition.jurisdiction",
                      "currentParty.name",
                      "region",
                      "province",
                      "city",
                    ],
                    type: "best_fields",
                    fuzziness: "AUTO",
                  },
                },
              ]
            : [{ match_all: {} }],
          filter: filterClauses as QueryDslQueryContainer[],
        },
      };

      const response = await elasticsearch.search<PoliticianSearchDocument>({
        index: INDICES.POLITICIANS,
        query: searchQuery,
        from: (page - 1) * pageSize,
        size: pageSize,
        highlight: {
          fields: {
            fullName: {},
            "currentPosition.title": {},
            "currentPosition.jurisdiction": {},
            "currentParty.name": {},
          },
          pre_tags: ["<mark>"],
          post_tags: ["</mark>"],
        },
        sort: [{ _score: { order: "desc" } }, { popularityScore: { order: "desc" } }],
      });

      const publicFlags = await getPublicRedFlagsBatch(
        response.hits.hits.flatMap((hit) => (hit._source?.id ? [hit._source.id] : []))
      );
      const results: SearchResult[] = response.hits.hits.map((hit) => {
        const source = hit._source as PoliticianSearchDocument;
        const highlights = hit.highlight || {};
        const matchedFields = Object.keys(highlights);
        const reviewedBatch = getReleasedProfile(source.id, null);
        const hasPublishedFlags = (publicFlags.get(source.id)?.length ?? 0) > 0;

        return {
          politician: {
            ...source,
            hasRedFlags: reviewedBatch && !hasPublishedFlags ? null : hasPublishedFlags,
            ...(reviewedBatch && { reviewedBatch }),
          },
          relevanceScore: hit._score || 0,
          matchedFields,
          highlights: highlights as Record<string, string[]>,
        };
      });

      const total =
        typeof response.hits.total === "number"
          ? response.hits.total
          : response.hits.total?.value || 0;

      const result = { results, total };

      return result;
    } catch (error) {
      console.error("Error searching politicians:", error);
      throw error;
    }
  },

  /**
   * Get autocomplete suggestions as user types
   * Suggestions are ranked by popularity
   */
  async autocomplete(prefix: string, limit: number = 10): Promise<AutocompleteSuggestion[]> {
    if (!prefix || prefix.length < 1) {
      return [];
    }

    // Generate cache key
    const cacheKey = `${CACHE_KEYS.AUTOCOMPLETE}${prefix.toLowerCase()}:${limit}`;

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
                    "nickname.autocomplete^3",
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
        size: limit,
        sort: [{ _score: { order: "desc" } }, { popularityScore: { order: "desc" } }],
        _source: [
          "id",
          "fullName",
          "nickname",
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
  },

  /**
   * Update politician popularity score (for ranking autocomplete)
   * Called when a politician profile is viewed
   */
  async incrementPopularity(politicianId: string): Promise<void> {
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
  },
};

export default searchService;
