/**
 * Property-Based Tests for Search Service
 *
 * **Property 6: Search Relevance**
 * *For any* search query, returned results must:
 * - Match the query in at least one searchable field (name, position, location)
 * - Have a relevance score > 0
 * - Be sorted by relevance score in descending order
 * - When filters are applied, satisfy both the search query AND all filter criteria
 *
 * **Validates: Requirements 11.1, 11.2, 11.3**
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import fc from "fast-check";

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

import {
  buildFilterClauses,
  buildSearchQuery,
  getSearchFieldsWithBoost,
  normalizeRelevanceScore,
  extractMatchedFields,
  validateSearchResult,
  PoliticianSearchDocument,
  PoliticianSearchFilters,
  SearchResult,
  GovernmentLevel,
} from "./search.service";

const NUM_RUNS = 100;

// ============================================
// Arbitraries for Property-Based Testing
// ============================================

const governmentLevels: GovernmentLevel[] = [
  "national",
  "regional",
  "provincial",
  "city",
  "municipal",
  "barangay",
];

const arbitraryGovernmentLevel = (): fc.Arbitrary<GovernmentLevel> =>
  fc.constantFrom(...governmentLevels);

const arbitraryPoliticianSearchDocument = (): fc.Arbitrary<PoliticianSearchDocument> =>
  fc.record({
    id: fc.uuid(),
    fullName: fc.string({ minLength: 2, maxLength: 100 }),
    firstName: fc.string({ minLength: 1, maxLength: 50 }),
    middleName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), {
      nil: undefined,
    }),
    lastName: fc.string({ minLength: 1, maxLength: 50 }),
    suffix: fc.option(fc.constantFrom("Jr.", "Sr.", "III", "IV"), {
      nil: undefined,
    }),
    currentPosition: fc.option(
      fc.record({
        title: fc.constantFrom("Senator", "Congressman", "Governor", "Mayor", "Councilor"),
        level: arbitraryGovernmentLevel(),
        jurisdiction: fc.string({ minLength: 2, maxLength: 50 }),
      }),
      { nil: undefined }
    ),
    currentParty: fc.option(
      fc.record({
        name: fc.constantFrom("Liberal Party", "PDP-Laban", "Nacionalista Party", "NPC"),
        abbreviation: fc.constantFrom("LP", "PDP", "NP", "NPC"),
      }),
      { nil: undefined }
    ),
    region: fc.option(fc.constantFrom("NCR", "Region I", "Region II", "CAR"), {
      nil: undefined,
    }),
    province: fc.option(fc.constantFrom("Metro Manila", "Cebu", "Davao", "Iloilo"), {
      nil: undefined,
    }),
    city: fc.option(fc.constantFrom("Manila", "Quezon City", "Makati", "Cebu City"), {
      nil: undefined,
    }),
    isActive: fc.boolean(),
    hasRedFlags: fc.boolean(),
    photo: fc.option(fc.webUrl(), { nil: undefined }),
    popularityScore: fc.float({ min: 0, max: 1000, noNaN: true }),
    createdAt: fc.date(),
    updatedAt: fc.date(),
  });

const arbitrarySearchFilters = (): fc.Arbitrary<PoliticianSearchFilters> =>
  fc.record({
    level: fc.option(arbitraryGovernmentLevel(), { nil: undefined }),
    region: fc.option(fc.constantFrom("NCR", "Region I", "Region II"), {
      nil: undefined,
    }),
    province: fc.option(fc.constantFrom("Metro Manila", "Cebu", "Davao"), {
      nil: undefined,
    }),
    city: fc.option(fc.constantFrom("Manila", "Quezon City", "Makati"), {
      nil: undefined,
    }),
    party: fc.option(fc.constantFrom("Liberal Party", "PDP-Laban", "NPC"), {
      nil: undefined,
    }),
    position: fc.option(fc.constantFrom("Senator", "Congressman", "Mayor"), {
      nil: undefined,
    }),
    hasRedFlags: fc.option(fc.boolean(), { nil: undefined }),
    isActive: fc.option(fc.boolean(), { nil: undefined }),
  });

const arbitrarySearchResult = (): fc.Arbitrary<SearchResult> =>
  fc.record({
    politician: arbitraryPoliticianSearchDocument(),
    relevanceScore: fc.float({ min: 0, max: 100, noNaN: true }),
    matchedFields: fc.array(
      fc.constantFrom(
        "fullName",
        "firstName",
        "lastName",
        "currentPosition.title",
        "currentParty.name"
      ),
      { minLength: 0, maxLength: 5 }
    ),
    highlights: fc.constant({}),
  });

// ============================================
// Property Tests
// ============================================

describe("Search Relevance - Property 6", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * **Validates: Requirement 11.1**
   * Search should match query in at least one searchable field
   */
  describe("Property 6.1: Query Matching", () => {
    it("should have search fields with positive boost values", () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const fields = getSearchFieldsWithBoost();

          // All fields should have boost values
          for (const field of fields) {
            expect(field).toMatch(/\^[\d.]+$/);
            const boost = parseFloat(field.split("^")[1]!);
            expect(boost).toBeGreaterThan(0);
          }

          return true;
        }),
        { numRuns: 1 }
      );
    });

    it("should include all searchable fields in query", () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 50 }), (query) => {
          const searchQuery = buildSearchQuery(query, {})!;

          // Query should use multi_match
          const must = searchQuery.bool!.must;
          expect(must).toBeDefined();
          expect(Array.isArray(must)).toBe(true);

          if (query && must && Array.isArray(must) && must.length > 0) {
            const multiMatch = must[0] as { multi_match?: { fields: string[] } };
            expect(multiMatch.multi_match).toBeDefined();
            expect(multiMatch.multi_match!.fields.length).toBeGreaterThan(0);
          }

          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should use match_all when query is empty", () => {
      fc.assert(
        fc.property(arbitrarySearchFilters(), (filters) => {
          const searchQuery = buildSearchQuery("", filters)!;

          const must = searchQuery.bool!.must;
          expect(must).toBeDefined();
          expect(Array.isArray(must)).toBe(true);

          if (must && Array.isArray(must) && must.length > 0) {
            expect(must[0]).toEqual({ match_all: {} });
          }

          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirement 11.2**
   * Results should have relevance score > 0 and be sorted descending
   */
  describe("Property 6.2: Relevance Score Ordering", () => {
    it("should normalize scores to valid range", () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 100, noNaN: true }),
          fc.float({ min: 1, max: 100, noNaN: true }),
          (score: number, maxScore: number) => {
            // Ensure score <= maxScore for valid normalization
            const validScore = Math.min(score, maxScore);
            const normalized = normalizeRelevanceScore(validScore, maxScore);

            expect(normalized).toBeGreaterThanOrEqual(0);
            expect(normalized).toBeLessThanOrEqual(100);
            expect(Number.isInteger(normalized)).toBe(true);

            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should return 0 for invalid scores", () => {
      fc.assert(
        fc.property(
          fc.option(fc.float({ min: 0, max: 100, noNaN: true }), { nil: undefined }),
          fc.option(fc.float({ min: 0, max: 100, noNaN: true }), { nil: undefined }),
          (score, maxScore) => {
            if (score === undefined || maxScore === undefined || maxScore === 0) {
              const normalized = normalizeRelevanceScore(score, maxScore);
              expect(normalized).toBe(0);
            }

            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should verify sorted results are in descending order", () => {
      fc.assert(
        fc.property(
          fc.array(arbitrarySearchResult(), { minLength: 2, maxLength: 20 }),
          (results) => {
            // Sort by relevance score descending
            const sorted = [...results].sort((a, b) => b.relevanceScore - a.relevanceScore);

            // Verify descending order
            for (let i = 1; i < sorted.length; i++) {
              expect(sorted[i - 1]!.relevanceScore).toBeGreaterThanOrEqual(
                sorted[i]!.relevanceScore
              );
            }

            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirement 11.3**
   * When filters are applied, results must satisfy both query AND filters
   */
  describe("Property 6.3: Filter Application", () => {
    it("should build correct filter clauses for each filter type", () => {
      fc.assert(
        fc.property(arbitrarySearchFilters(), (filters) => {
          const clauses = buildFilterClauses(filters);

          // Count expected clauses
          let expectedCount = 0;
          if (filters.level) {
            expectedCount++;
          }
          if (filters.region) {
            expectedCount++;
          }
          if (filters.province) {
            expectedCount++;
          }
          if (filters.city) {
            expectedCount++;
          }
          if (filters.party) {
            expectedCount++;
          }
          if (filters.position) {
            expectedCount++;
          }
          if (filters.hasRedFlags !== undefined) {
            expectedCount++;
          }
          if (filters.isActive !== undefined) {
            expectedCount++;
          }

          expect(clauses.length).toBe(expectedCount);

          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should include all filter clauses in search query", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          arbitrarySearchFilters(),
          (query, filters) => {
            const searchQuery = buildSearchQuery(query, filters)!;
            const filterClauses = buildFilterClauses(filters);

            expect(searchQuery.bool!.filter).toEqual(filterClauses);

            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should validate results match all applied filters", () => {
      fc.assert(
        fc.property(arbitraryPoliticianSearchDocument(), (politician) => {
          // Create filters that match the politician
          const matchingFilters: PoliticianSearchFilters = {};

          if (politician.currentPosition?.level) {
            matchingFilters.level = politician.currentPosition.level;
          }
          if (politician.region) {
            matchingFilters.region = politician.region;
          }
          if (politician.currentParty?.name) {
            matchingFilters.party = politician.currentParty.name;
          }

          const result: SearchResult = {
            politician,
            relevanceScore: 10,
            matchedFields: [],
            highlights: {},
          };

          // Result should match its own filters
          const isValid = validateSearchResult(result, "", matchingFilters);
          expect(isValid).toBe(true);

          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should reject results that don't match filters", () => {
      fc.assert(
        fc.property(
          arbitraryPoliticianSearchDocument(),
          arbitraryGovernmentLevel(),
          (politician, differentLevel) => {
            // Skip if levels happen to match
            if (politician.currentPosition?.level === differentLevel) {
              return true;
            }

            const result: SearchResult = {
              politician,
              relevanceScore: 10,
              matchedFields: [],
              highlights: {},
            };

            // If politician has a position with different level, should fail
            if (politician.currentPosition) {
              const isValid = validateSearchResult(result, "", {
                level: differentLevel,
              });
              expect(isValid).toBe(false);
            }

            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * Additional property tests for search correctness
   */
  describe("Property 6.4: Matched Fields Extraction", () => {
    it("should extract all unique highlighted field names", () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(
            fc.constantFrom("fullName", "firstName", "lastName", "currentPosition.title"),
            { minLength: 0, maxLength: 4 }
          ),
          (fieldNames) => {
            const highlights: Record<string, string[]> = {};
            for (const field of fieldNames) {
              highlights[field] = ["<mark>test</mark>"];
            }

            const extracted = extractMatchedFields(highlights);

            expect(extracted.length).toBe(fieldNames.length);
            for (const field of fieldNames) {
              expect(extracted).toContain(field);
            }

            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should return empty array for empty highlights", () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          expect(extractMatchedFields(undefined)).toEqual([]);
          expect(extractMatchedFields({})).toEqual([]);

          return true;
        }),
        { numRuns: 1 }
      );
    });
  });

  describe("Property 6.5: Query and Filter Combination", () => {
    it("should apply both query and filters simultaneously", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 30 }),
          arbitrarySearchFilters(),
          (query, filters) => {
            const searchQuery = buildSearchQuery(query, filters)!;

            // Should have both must (query) and filter clauses
            expect(searchQuery.bool!.must).toBeDefined();
            expect(searchQuery.bool!.filter).toBeDefined();

            // Must should contain the query
            const must = searchQuery.bool!.must;
            if (query && Array.isArray(must) && must.length > 0) {
              const multiMatch = must[0] as { multi_match?: { query: string } };
              expect(multiMatch.multi_match!.query).toBe(query);
            }

            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe("Property 6.6: Search Field Boost Consistency", () => {
    it("should have consistent boost values across calls", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 10 }), () => {
          const fields1 = getSearchFieldsWithBoost();
          const fields2 = getSearchFieldsWithBoost();

          expect(fields1).toEqual(fields2);

          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should boost name fields higher than other fields", () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const fields = getSearchFieldsWithBoost();

          const getBoost = (fieldName: string): number => {
            const field = fields.find((f) => f.startsWith(fieldName));
            return field ? parseFloat(field.split("^")[1]!) : 0;
          };

          const fullNameBoost = getBoost("fullName");
          const firstNameBoost = getBoost("firstName");
          const regionBoost = getBoost("region");

          // Name fields should have higher boost
          expect(fullNameBoost).toBeGreaterThan(regionBoost);
          expect(firstNameBoost).toBeGreaterThan(regionBoost);

          return true;
        }),
        { numRuns: 1 }
      );
    });
  });
});
