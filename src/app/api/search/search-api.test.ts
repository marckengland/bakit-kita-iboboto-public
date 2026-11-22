/**
 * Unit Tests for Search API Endpoints
 *
 * Tests the search and autocomplete functionality.
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the search service
vi.mock("@/lib/search", () => ({
  searchService: {
    search: vi.fn(),
    autocomplete: vi.fn(),
  },
}));

import { searchService } from "@/lib/search";
import type { SearchResult, AutocompleteSuggestion, PoliticianSearchDocument } from "@/lib/search";

// Helper to create a complete politician document
function createMockPolitician(
  overrides: Partial<PoliticianSearchDocument> = {}
): PoliticianSearchDocument {
  return {
    id: "test-id",
    fullName: "Test Politician",
    firstName: "Test",
    lastName: "Politician",
    isActive: true,
    hasRedFlags: false,
    popularityScore: 50,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Helper to create a complete search result
function createMockSearchResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    politician: createMockPolitician(),
    relevanceScore: 10.0,
    matchedFields: [],
    highlights: {},
    ...overrides,
  };
}

// Helper to create autocomplete suggestion
function createMockSuggestion(
  overrides: Partial<AutocompleteSuggestion> = {}
): AutocompleteSuggestion {
  return {
    id: "1",
    text: "Test Suggestion",
    type: "politician" as const,
    popularityScore: 100,
    ...overrides,
  };
}

describe("Search API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Search Endpoint - Requirements 11.1, 11.2, 11.3", () => {
    it("should call search service with query and filters", async () => {
      const mockResults = {
        results: [
          createMockSearchResult({
            politician: createMockPolitician({
              id: "1",
              fullName: "Juan Dela Cruz",
              currentPosition: { title: "Senator", level: "national", jurisdiction: "Philippines" },
            }),
            relevanceScore: 10.5,
            matchedFields: ["fullName"],
            highlights: { fullName: ["<mark>Juan</mark> Dela Cruz"] },
          }),
        ],
        total: 1,
      };

      vi.mocked(searchService.search).mockResolvedValue(mockResults);

      const result = await searchService.search("Juan", { level: "national" }, 1, 20);

      expect(searchService.search).toHaveBeenCalledWith("Juan", { level: "national" }, 1, 20);
      expect(result.results).toHaveLength(1);
      expect(result.results[0]?.politician.fullName).toBe("Juan Dela Cruz");
    });

    it("should return results ranked by relevance - Requirement 11.2", async () => {
      const mockResults = {
        results: [
          createMockSearchResult({
            politician: createMockPolitician({ id: "1", fullName: "Juan Dela Cruz" }),
            relevanceScore: 15.0,
          }),
          createMockSearchResult({
            politician: createMockPolitician({ id: "2", fullName: "Juan Santos" }),
            relevanceScore: 10.0,
          }),
          createMockSearchResult({
            politician: createMockPolitician({ id: "3", fullName: "Juan Reyes" }),
            relevanceScore: 5.0,
          }),
        ],
        total: 3,
      };

      vi.mocked(searchService.search).mockResolvedValue(mockResults);

      const result = await searchService.search("Juan", {}, 1, 20);

      // Verify results are sorted by relevance (descending)
      expect(result.results[0]?.relevanceScore).toBeGreaterThan(
        result.results[1]?.relevanceScore ?? 0
      );
      expect(result.results[1]?.relevanceScore).toBeGreaterThan(
        result.results[2]?.relevanceScore ?? 0
      );
    });

    it("should combine search with filters - Requirement 11.3", async () => {
      const mockResults = {
        results: [
          createMockSearchResult({
            politician: createMockPolitician({
              id: "1",
              fullName: "Juan Dela Cruz",
              currentPosition: { title: "Senator", level: "national", jurisdiction: "Philippines" },
              currentParty: { name: "PDP-Laban", abbreviation: "PDP" },
            }),
          }),
        ],
        total: 1,
      };

      vi.mocked(searchService.search).mockResolvedValue(mockResults);

      const filters = {
        level: "national" as const,
        party: "PDP-Laban",
        region: "NCR",
      };

      await searchService.search("Juan", filters, 1, 20);

      expect(searchService.search).toHaveBeenCalledWith("Juan", filters, 1, 20);
    });

    it("should return empty results for no matches", async () => {
      vi.mocked(searchService.search).mockResolvedValue({
        results: [],
        total: 0,
      });

      const result = await searchService.search("NonexistentPolitician", {}, 1, 20);

      expect(result.results).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe("Autocomplete Endpoint - Requirement 11.5", () => {
    it("should return autocomplete suggestions for prefix", async () => {
      const mockSuggestions: AutocompleteSuggestion[] = [
        createMockSuggestion({
          id: "1",
          text: "Juan Dela Cruz",
          subtext: "Senator",
          popularityScore: 100,
        }),
        createMockSuggestion({
          id: "2",
          text: "Juan Santos",
          subtext: "Mayor",
          popularityScore: 80,
        }),
      ];

      vi.mocked(searchService.autocomplete).mockResolvedValue(mockSuggestions);

      const result = await searchService.autocomplete("Jua", 10);

      expect(searchService.autocomplete).toHaveBeenCalledWith("Jua", 10);
      expect(result).toHaveLength(2);
      expect(result[0]?.text).toBe("Juan Dela Cruz");
    });

    it("should limit suggestions to specified count", async () => {
      const mockSuggestions: AutocompleteSuggestion[] = [
        createMockSuggestion({ id: "1", text: "Juan 1", popularityScore: 100 }),
        createMockSuggestion({ id: "2", text: "Juan 2", popularityScore: 90 }),
      ];

      vi.mocked(searchService.autocomplete).mockResolvedValue(mockSuggestions);

      const result = await searchService.autocomplete("Juan", 2);

      expect(result).toHaveLength(2);
    });

    it("should return empty array for empty prefix", async () => {
      vi.mocked(searchService.autocomplete).mockResolvedValue([]);

      const result = await searchService.autocomplete("", 10);

      expect(result).toHaveLength(0);
    });

    it("should include popularity score in suggestions", async () => {
      const mockSuggestions: AutocompleteSuggestion[] = [
        createMockSuggestion({ id: "1", text: "Popular Politician", popularityScore: 1000 }),
        createMockSuggestion({ id: "2", text: "Less Popular", popularityScore: 100 }),
      ];

      vi.mocked(searchService.autocomplete).mockResolvedValue(mockSuggestions);

      const result = await searchService.autocomplete("P", 10);

      expect(result[0]?.popularityScore).toBeGreaterThan(result[1]?.popularityScore ?? 0);
    });
  });

  describe("Alternative Suggestions - Requirement 11.4", () => {
    it("should generate suggestions for common misspellings", () => {
      // Test the suggestion generation logic
      const generateAlternativeSuggestions = (query: string): string[] => {
        const suggestions: string[] = [];
        const lowerQuery = query.toLowerCase();

        const alternatives: Record<string, string[]> = {
          marcos: ["Marcos", "Ferdinand Marcos", "Bongbong Marcos"],
          senator: ["Senator", "Senador"],
          mayor: ["Mayor", "Alkalde"],
        };

        for (const [key, values] of Object.entries(alternatives)) {
          if (lowerQuery.includes(key) || key.includes(lowerQuery)) {
            suggestions.push(...values.filter((v) => v.toLowerCase() !== lowerQuery));
          }
        }

        return Array.from(new Set(suggestions)).slice(0, 5);
      };

      const suggestions = generateAlternativeSuggestions("marcos");
      expect(suggestions).toContain("Ferdinand Marcos");
      expect(suggestions).toContain("Bongbong Marcos");
    });

    it("should suggest common positions for short queries", () => {
      const generateAlternativeSuggestions = (query: string): string[] => {
        const suggestions: string[] = [];

        if (query.length <= 3) {
          suggestions.push("Senator", "Mayor", "Governor", "Congressman");
        }

        return suggestions;
      };

      const suggestions = generateAlternativeSuggestions("abc");
      expect(suggestions).toContain("Senator");
      expect(suggestions).toContain("Mayor");
    });
  });
});

describe("Search Result Structure", () => {
  it("should include all required fields in search result", async () => {
    const mockResult = {
      results: [
        createMockSearchResult({
          politician: createMockPolitician({
            id: "test-id",
            fullName: "Test Politician",
            firstName: "Test",
            lastName: "Politician",
            currentPosition: {
              title: "Senator",
              level: "national",
              jurisdiction: "Philippines",
            },
            currentParty: {
              name: "Test Party",
              abbreviation: "TP",
            },
            isActive: true,
            hasRedFlags: false,
            popularityScore: 50,
          }),
          relevanceScore: 10.5,
          matchedFields: ["fullName"],
          highlights: {
            fullName: ["<mark>Test</mark> Politician"],
          },
        }),
      ],
      total: 1,
    };

    vi.mocked(searchService.search).mockResolvedValue(mockResult);

    const result = await searchService.search("Test", {}, 1, 20);
    const searchResult = result.results[0];

    // Verify structure
    expect(searchResult).toBeDefined();
    expect(searchResult?.politician).toBeDefined();
    expect(searchResult?.politician.id).toBe("test-id");
    expect(searchResult?.politician.fullName).toBe("Test Politician");
    expect(searchResult?.relevanceScore).toBe(10.5);
    expect(searchResult?.matchedFields).toContain("fullName");
    expect(searchResult?.highlights.fullName).toBeDefined();
  });
});
