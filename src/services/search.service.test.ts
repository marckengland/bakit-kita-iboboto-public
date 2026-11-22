/**
 * Unit Tests for Search Service
 *
 * Tests for full-text search functionality with Elasticsearch.
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Elasticsearch
vi.mock("@/lib/elasticsearch", () => ({
  default: {
    search: vi.fn(),
    index: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    bulk: vi.fn(),
  },
  INDICES: {
    POLITICIANS: "politicians",
    BILLS: "bills",
  },
}));

// Mock Redis cache
vi.mock("@/lib/redis", () => ({
  cache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    invalidateSearch: vi.fn().mockResolvedValue(undefined),
  },
  CACHE_KEYS: {
    SEARCH: "search:",
    AUTOCOMPLETE: "autocomplete:",
  },
  CACHE_TTL: {
    SHORT: 300,
  },
}));

import elasticsearch from "@/lib/elasticsearch";
import {
  searchPoliticians,
  getAutocompleteSuggestions,
  indexPolitician,
  removePoliticianFromIndex,
  incrementPopularity,
  getAlternativeSuggestions,
  buildFilterClauses,
  buildSearchQuery,
  getSearchFieldsWithBoost,
  normalizeRelevanceScore,
  extractMatchedFields,
  validateSearchResult,
  PoliticianSearchDocument,
  PoliticianSearchFilters,
  SearchResult,
} from "./search.service";

describe("Search Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // Helper Functions Tests
  // ============================================

  describe("getSearchFieldsWithBoost", () => {
    it("should return fields with boost values", () => {
      const fields = getSearchFieldsWithBoost();

      expect(fields).toContain("fullName^3");
      expect(fields).toContain("firstName^2");
      expect(fields).toContain("lastName^2");
      expect(fields).toContain("currentPosition.title^1.5");
    });
  });

  describe("buildFilterClauses", () => {
    it("should build filter for government level", () => {
      const filters: PoliticianSearchFilters = { level: "national" };
      const clauses = buildFilterClauses(filters);

      expect(clauses).toHaveLength(1);
      expect(clauses[0]).toEqual({
        term: { "currentPosition.level": "national" },
      });
    });

    it("should build filter for region", () => {
      const filters: PoliticianSearchFilters = { region: "NCR" };
      const clauses = buildFilterClauses(filters);

      expect(clauses).toHaveLength(1);
      expect(clauses[0]).toEqual({ match: { "region.keyword": "NCR" } });
    });

    it("should build filter for party", () => {
      const filters: PoliticianSearchFilters = { party: "Liberal Party" };
      const clauses = buildFilterClauses(filters);

      expect(clauses).toHaveLength(1);
      expect(clauses[0]).toEqual({
        match: { "currentParty.name.keyword": "Liberal Party" },
      });
    });

    it("should build filter for hasRedFlags", () => {
      const filters: PoliticianSearchFilters = { hasRedFlags: true };
      const clauses = buildFilterClauses(filters);

      expect(clauses).toHaveLength(1);
      expect(clauses[0]).toEqual({ term: { hasRedFlags: true } });
    });

    it("should combine multiple filters", () => {
      const filters: PoliticianSearchFilters = {
        level: "national",
        region: "NCR",
        party: "Liberal Party",
        hasRedFlags: false,
      };
      const clauses = buildFilterClauses(filters);

      expect(clauses).toHaveLength(4);
    });

    it("should return empty array for no filters", () => {
      const clauses = buildFilterClauses({});
      expect(clauses).toHaveLength(0);
    });
  });

  describe("buildSearchQuery", () => {
    it("should build query with search term", () => {
      const result = buildSearchQuery("Juan", {})!;

      expect(result.bool!.must).toHaveLength(1);
      expect(result.bool!.filter).toHaveLength(0);
    });

    it("should build match_all query when no search term", () => {
      const result = buildSearchQuery("", {})!;

      expect(result.bool!.must).toHaveLength(1);
      expect((result.bool!.must as unknown[])?.[0]).toEqual({ match_all: {} });
    });

    it("should include filters in query", () => {
      const result = buildSearchQuery("Juan", { level: "national" })!;

      expect(result.bool!.filter).toHaveLength(1);
    });
  });

  describe("normalizeRelevanceScore", () => {
    it("should normalize score to percentage", () => {
      expect(normalizeRelevanceScore(50, 100)).toBe(50);
      expect(normalizeRelevanceScore(75, 100)).toBe(75);
      expect(normalizeRelevanceScore(100, 100)).toBe(100);
    });

    it("should return 0 for undefined scores", () => {
      expect(normalizeRelevanceScore(undefined, 100)).toBe(0);
      expect(normalizeRelevanceScore(50, undefined)).toBe(0);
      expect(normalizeRelevanceScore(50, 0)).toBe(0);
    });
  });

  describe("extractMatchedFields", () => {
    it("should extract field names from highlights", () => {
      const highlights = {
        fullName: ["<mark>Juan</mark> Dela Cruz"],
        "currentPosition.title": ["<mark>Senator</mark>"],
      };

      const fields = extractMatchedFields(highlights);

      expect(fields).toContain("fullName");
      expect(fields).toContain("currentPosition.title");
    });

    it("should return empty array for undefined highlights", () => {
      expect(extractMatchedFields(undefined)).toEqual([]);
    });
  });

  // ============================================
  // Search Function Tests
  // ============================================

  describe("searchPoliticians", () => {
    const mockSearchResponse = {
      hits: {
        total: { value: 2 },
        max_score: 10,
        hits: [
          {
            _source: {
              id: "pol-1",
              fullName: "Juan Dela Cruz",
              firstName: "Juan",
              lastName: "Dela Cruz",
              currentPosition: {
                title: "Senator",
                level: "national",
                jurisdiction: "Philippines",
              },
              currentParty: { name: "Liberal Party", abbreviation: "LP" },
              isActive: true,
              hasRedFlags: false,
              popularityScore: 100,
            },
            _score: 10,
            highlight: { fullName: ["<mark>Juan</mark> Dela Cruz"] },
          },
          {
            _source: {
              id: "pol-2",
              fullName: "Maria Santos",
              firstName: "Maria",
              lastName: "Santos",
              currentPosition: {
                title: "Congressman",
                level: "national",
                jurisdiction: "Manila",
              },
              isActive: true,
              hasRedFlags: true,
              popularityScore: 50,
            },
            _score: 5,
            highlight: {},
          },
        ],
      },
    };

    it("should return search results with relevance scores", async () => {
      vi.mocked(elasticsearch.search).mockResolvedValue(mockSearchResponse as never);

      const response = await searchPoliticians("Juan");

      expect(response.results).toHaveLength(2);
      expect(response.results[0]!.relevanceScore).toBe(10);
      expect(response.results[0]!.politician.fullName).toBe("Juan Dela Cruz");
    });

    it("should include matched fields in results", async () => {
      vi.mocked(elasticsearch.search).mockResolvedValue(mockSearchResponse as never);

      const response = await searchPoliticians("Juan");

      expect(response.results[0]!.matchedFields).toContain("fullName");
    });

    it("should return total count and pagination info", async () => {
      vi.mocked(elasticsearch.search).mockResolvedValue(mockSearchResponse as never);

      const response = await searchPoliticians("Juan", {}, 1, 20);

      expect(response.total).toBe(2);
      expect(response.page).toBe(1);
      expect(response.pageSize).toBe(20);
      expect(response.totalPages).toBe(1);
    });

    it("should apply filters to search", async () => {
      vi.mocked(elasticsearch.search).mockResolvedValue(mockSearchResponse as never);

      await searchPoliticians("Juan", { level: "national", hasRedFlags: false });

      expect(elasticsearch.search).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            bool: expect.objectContaining({
              filter: expect.arrayContaining([
                { term: { "currentPosition.level": "national" } },
                { term: { hasRedFlags: false } },
              ]),
            }),
          }),
        })
      );
    });

    it("should sort results by relevance score descending", async () => {
      vi.mocked(elasticsearch.search).mockResolvedValue(mockSearchResponse as never);

      await searchPoliticians("Juan");

      expect(elasticsearch.search).toHaveBeenCalledWith(
        expect.objectContaining({
          sort: [{ _score: { order: "desc" } }, { popularityScore: { order: "desc" } }],
        })
      );
    });

    it("should handle empty results", async () => {
      vi.mocked(elasticsearch.search).mockResolvedValue({
        hits: { total: { value: 0 }, hits: [] },
      } as never);

      const response = await searchPoliticians("NonExistent");

      expect(response.results).toHaveLength(0);
      expect(response.total).toBe(0);
    });

    it("should validate pagination parameters", async () => {
      vi.mocked(elasticsearch.search).mockResolvedValue(mockSearchResponse as never);

      const response = await searchPoliticians("Juan", {}, -1, 200);

      expect(response.page).toBe(1);
      expect(response.pageSize).toBe(100);
    });
  });

  // ============================================
  // Autocomplete Tests
  // ============================================

  describe("getAutocompleteSuggestions", () => {
    const mockAutocompleteResponse = {
      hits: {
        hits: [
          {
            _source: {
              id: "pol-1",
              fullName: "Juan Dela Cruz",
              currentPosition: {
                title: "Senator",
                jurisdiction: "Philippines",
              },
              currentParty: { name: "Liberal Party" },
              popularityScore: 100,
            },
          },
          {
            _source: {
              id: "pol-2",
              fullName: "Juan Santos",
              currentPosition: {
                title: "Mayor",
                jurisdiction: "Manila",
              },
              popularityScore: 50,
            },
          },
        ],
      },
    };

    it("should return autocomplete suggestions", async () => {
      vi.mocked(elasticsearch.search).mockResolvedValue(mockAutocompleteResponse as never);

      const suggestions = await getAutocompleteSuggestions("Jua");

      expect(suggestions).toHaveLength(2);
      expect(suggestions[0]!.text).toBe("Juan Dela Cruz");
      expect(suggestions[0]!.type).toBe("politician");
    });

    it("should include subtext with position and party", async () => {
      vi.mocked(elasticsearch.search).mockResolvedValue(mockAutocompleteResponse as never);

      const suggestions = await getAutocompleteSuggestions("Jua");

      expect(suggestions[0]!.subtext).toBe("Senator, Philippines (Liberal Party)");
    });

    it("should limit results to specified count", async () => {
      vi.mocked(elasticsearch.search).mockResolvedValue(mockAutocompleteResponse as never);

      await getAutocompleteSuggestions("Jua", 5);

      expect(elasticsearch.search).toHaveBeenCalledWith(expect.objectContaining({ size: 5 }));
    });

    it("should return empty array for empty prefix", async () => {
      const suggestions = await getAutocompleteSuggestions("");

      expect(suggestions).toHaveLength(0);
      expect(elasticsearch.search).not.toHaveBeenCalled();
    });

    it("should rank by popularity score", async () => {
      vi.mocked(elasticsearch.search).mockResolvedValue(mockAutocompleteResponse as never);

      await getAutocompleteSuggestions("Jua");

      expect(elasticsearch.search).toHaveBeenCalledWith(
        expect.objectContaining({
          sort: [{ _score: { order: "desc" } }, { popularityScore: { order: "desc" } }],
        })
      );
    });
  });

  // ============================================
  // Index Management Tests
  // ============================================

  describe("indexPolitician", () => {
    it("should index politician document", async () => {
      vi.mocked(elasticsearch.index).mockResolvedValue({} as never);

      const politician: PoliticianSearchDocument = {
        id: "pol-1",
        fullName: "Juan Dela Cruz",
        firstName: "Juan",
        lastName: "Dela Cruz",
        isActive: true,
        hasRedFlags: false,
        popularityScore: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await indexPolitician(politician);

      expect(elasticsearch.index).toHaveBeenCalledWith({
        index: "politicians",
        id: "pol-1",
        document: politician,
        refresh: true,
      });
    });
  });

  describe("removePoliticianFromIndex", () => {
    it("should remove politician from index", async () => {
      vi.mocked(elasticsearch.delete).mockResolvedValue({} as never);

      await removePoliticianFromIndex("pol-1");

      expect(elasticsearch.delete).toHaveBeenCalledWith({
        index: "politicians",
        id: "pol-1",
        refresh: true,
      });
    });
  });

  describe("incrementPopularity", () => {
    it("should increment popularity score", async () => {
      vi.mocked(elasticsearch.update).mockResolvedValue({} as never);

      await incrementPopularity("pol-1");

      expect(elasticsearch.update).toHaveBeenCalledWith({
        index: "politicians",
        id: "pol-1",
        script: {
          source: "ctx._source.popularityScore += params.increment",
          params: { increment: 1 },
        },
      });
    });

    it("should not throw on error", async () => {
      vi.mocked(elasticsearch.update).mockRejectedValue(new Error("Test error"));

      await expect(incrementPopularity("pol-1")).resolves.not.toThrow();
    });
  });

  // ============================================
  // Alternative Suggestions Tests
  // ============================================

  describe("getAlternativeSuggestions", () => {
    it("should return alternative suggestions for no results", async () => {
      vi.mocked(elasticsearch.search).mockResolvedValue({
        hits: {
          hits: [
            { _source: { fullName: "Juan Dela Cruz" } },
            { _source: { fullName: "Juan Santos" } },
          ],
        },
      } as never);

      const suggestions = await getAlternativeSuggestions("Jua");

      expect(suggestions).toContain("Juan Dela Cruz");
      expect(suggestions).toContain("Juan Santos");
    });

    it("should return empty array for short query", async () => {
      const suggestions = await getAlternativeSuggestions("J");

      expect(suggestions).toHaveLength(0);
    });

    it("should deduplicate suggestions", async () => {
      vi.mocked(elasticsearch.search).mockResolvedValue({
        hits: {
          hits: [
            { _source: { fullName: "Juan Dela Cruz" } },
            { _source: { fullName: "Juan Dela Cruz" } },
          ],
        },
      } as never);

      const suggestions = await getAlternativeSuggestions("Juan");

      expect(suggestions).toHaveLength(1);
    });
  });

  // ============================================
  // Validation Tests
  // ============================================

  describe("validateSearchResult", () => {
    const mockPolitician: PoliticianSearchDocument = {
      id: "pol-1",
      fullName: "Juan Dela Cruz",
      firstName: "Juan",
      lastName: "Dela Cruz",
      currentPosition: {
        title: "Senator",
        level: "national",
        jurisdiction: "Philippines",
      },
      currentParty: { name: "Liberal Party", abbreviation: "LP" },
      region: "NCR",
      isActive: true,
      hasRedFlags: false,
      popularityScore: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockResult: SearchResult = {
      politician: mockPolitician,
      relevanceScore: 10,
      matchedFields: ["fullName"],
      highlights: {},
    };

    it("should validate result matches query", () => {
      expect(validateSearchResult(mockResult, "Juan", {})).toBe(true);
      expect(validateSearchResult(mockResult, "Senator", {})).toBe(true);
      expect(validateSearchResult(mockResult, "Liberal", {})).toBe(true);
    });

    it("should validate result matches filters", () => {
      expect(validateSearchResult(mockResult, "", { level: "national" })).toBe(true);
      expect(validateSearchResult(mockResult, "", { region: "NCR" })).toBe(true);
      expect(validateSearchResult(mockResult, "", { party: "Liberal Party" })).toBe(true);
    });

    it("should return false for non-matching query", () => {
      expect(validateSearchResult(mockResult, "Maria", {})).toBe(false);
    });

    it("should return false for non-matching filter", () => {
      expect(validateSearchResult(mockResult, "", { level: "barangay" })).toBe(false);
    });
  });
});
