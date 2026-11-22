/**
 * Property-Based Tests for Autocomplete Service
 *
 * **Property 22: Autocomplete Prefix Matching**
 * *For any* autocomplete query with prefix P:
 * - All returned suggestions must start with prefix P (case-insensitive)
 * - Suggestions must be limited to the specified maximum count
 * - Suggestions must be ranked by relevance/popularity
 *
 * **Validates: Requirements 11.5**
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import fc from "fast-check";

// Mock Elasticsearch
vi.mock("@/lib/elasticsearch", () => ({
  default: {
    search: vi.fn(),
  },
  INDICES: {
    POLITICIANS: "politicians",
  },
}));

// Mock Redis cache
vi.mock("@/lib/redis", () => ({
  cache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
  },
  CACHE_KEYS: {
    AUTOCOMPLETE: "autocomplete:",
  },
  CACHE_TTL: {
    SHORT: 300,
  },
}));

import elasticsearch from "@/lib/elasticsearch";
import { getAutocompleteSuggestions } from "./search.service";

const NUM_RUNS = 100;

// ============================================
// Helper Functions for Testing
// ============================================

/**
 * Check if text starts with prefix (case-insensitive)
 */
function startsWithCaseInsensitive(text: string, prefix: string): boolean {
  return text.toLowerCase().startsWith(prefix.toLowerCase());
}

/**
 * Generate mock Elasticsearch response for autocomplete
 */
function generateMockAutocompleteResponse(
  prefix: string,
  count: number
): {
  hits: {
    hits: Array<{ _source: Partial<{ id: string; fullName: string; popularityScore: number }> }>;
  };
} {
  const hits = [];
  for (let i = 0; i < count; i++) {
    hits.push({
      _source: {
        id: `pol-${i}`,
        fullName: `${prefix}${i} Test Name`,
        currentPosition: {
          title: "Senator",
          jurisdiction: "Philippines",
        },
        popularityScore: 100 - i * 10,
      },
    });
  }
  return { hits: { hits } };
}

// ============================================
// Property Tests
// ============================================

describe("Autocomplete Prefix Matching - Property 22", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * **Validates: Requirement 11.5**
   * All suggestions must start with the prefix (case-insensitive)
   */
  describe("Property 22.1: Prefix Matching", () => {
    it("should return suggestions that start with the prefix", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-zA-Z]/.test(s)),
          fc.integer({ min: 1, max: 10 }),
          async (prefix, limit) => {
            const mockResponse = generateMockAutocompleteResponse(prefix, limit);
            vi.mocked(elasticsearch.search).mockResolvedValue(mockResponse as never);

            const suggestions = await getAutocompleteSuggestions(prefix, limit);

            // All suggestions should start with the prefix
            for (const suggestion of suggestions) {
              expect(startsWithCaseInsensitive(suggestion.text, prefix)).toBe(true);
            }

            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should handle case-insensitive prefix matching", async () => {
      await fc.assert(
        fc.asyncProperty(fc.constantFrom("Juan", "JUAN", "juan", "JuAn"), async (prefix) => {
          const mockResponse = generateMockAutocompleteResponse("Juan", 5);
          vi.mocked(elasticsearch.search).mockResolvedValue(mockResponse as never);

          const suggestions = await getAutocompleteSuggestions(prefix, 5);

          // All suggestions should match regardless of case
          for (const suggestion of suggestions) {
            expect(suggestion.text.toLowerCase().startsWith(prefix.toLowerCase())).toBe(true);
          }

          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirement 11.5**
   * Suggestions must be limited to specified count
   */
  describe("Property 22.2: Result Limit", () => {
    it("should limit results to specified count", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-zA-Z]/.test(s)),
          fc.integer({ min: 1, max: 50 }),
          async (prefix, limit) => {
            // Mock returns exactly the limit (as ES would with size parameter)
            const mockResponse = generateMockAutocompleteResponse(prefix, limit);
            vi.mocked(elasticsearch.search).mockResolvedValue(mockResponse as never);

            const suggestions = await getAutocompleteSuggestions(prefix, limit);

            // Should not exceed the limit
            expect(suggestions.length).toBeLessThanOrEqual(limit);

            // Verify ES was called with correct size
            expect(elasticsearch.search).toHaveBeenCalledWith(
              expect.objectContaining({
                size: limit,
              })
            );

            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should enforce maximum limit of 50", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-zA-Z]/.test(s)),
          fc.integer({ min: 51, max: 200 }),
          async (prefix, requestedLimit) => {
            const mockResponse = generateMockAutocompleteResponse(prefix, 50);
            vi.mocked(elasticsearch.search).mockResolvedValue(mockResponse as never);

            const suggestions = await getAutocompleteSuggestions(prefix, requestedLimit);

            // Should cap at 50
            expect(suggestions.length).toBeLessThanOrEqual(50);

            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirement 11.5**
   * Suggestions must be ranked by popularity
   */
  describe("Property 22.3: Popularity Ranking", () => {
    it("should rank suggestions by popularity score", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-zA-Z]/.test(s)),
          async (prefix) => {
            const mockResponse = generateMockAutocompleteResponse(prefix, 10);
            vi.mocked(elasticsearch.search).mockResolvedValue(mockResponse as never);

            const suggestions = await getAutocompleteSuggestions(prefix, 10);

            // Verify popularity scores are in descending order
            for (let i = 1; i < suggestions.length; i++) {
              expect(suggestions[i - 1]!.popularityScore).toBeGreaterThanOrEqual(
                suggestions[i]!.popularityScore
              );
            }

            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should include popularity score in each suggestion", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-zA-Z]/.test(s)),
          async (prefix) => {
            const mockResponse = generateMockAutocompleteResponse(prefix, 5);
            vi.mocked(elasticsearch.search).mockResolvedValue(mockResponse as never);

            const suggestions = await getAutocompleteSuggestions(prefix, 5);

            for (const suggestion of suggestions) {
              expect(typeof suggestion.popularityScore).toBe("number");
              expect(suggestion.popularityScore).toBeGreaterThanOrEqual(0);
            }

            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * Additional property tests for autocomplete behavior
   */
  describe("Property 22.4: Empty and Invalid Input Handling", () => {
    it("should return empty array for empty prefix", async () => {
      const suggestions = await getAutocompleteSuggestions("", 10);
      expect(suggestions).toEqual([]);
      expect(elasticsearch.search).not.toHaveBeenCalled();
    });

    it("should handle single character prefix", async () => {
      await fc.assert(
        fc.asyncProperty(fc.constantFrom("a", "b", "c", "J", "M"), async (prefix) => {
          const mockResponse = generateMockAutocompleteResponse(prefix, 5);
          vi.mocked(elasticsearch.search).mockResolvedValue(mockResponse as never);

          const suggestions = await getAutocompleteSuggestions(prefix, 5);

          // Should return results for single character
          expect(Array.isArray(suggestions)).toBe(true);

          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe("Property 22.5: Suggestion Structure Completeness", () => {
    it("should include all required fields in suggestions", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-zA-Z]/.test(s)),
          async (prefix) => {
            const mockResponse = generateMockAutocompleteResponse(prefix, 5);
            vi.mocked(elasticsearch.search).mockResolvedValue(mockResponse as never);

            const suggestions = await getAutocompleteSuggestions(prefix, 5);

            for (const suggestion of suggestions) {
              expect(suggestion.id).toBeDefined();
              expect(typeof suggestion.id).toBe("string");
              expect(suggestion.text).toBeDefined();
              expect(typeof suggestion.text).toBe("string");
              expect(suggestion.type).toBe("politician");
              expect(typeof suggestion.popularityScore).toBe("number");
            }

            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});
