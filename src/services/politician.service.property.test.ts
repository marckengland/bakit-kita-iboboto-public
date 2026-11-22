/**
 * Property-Based Tests for Filter Correctness
 *
 * **Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.6**
 *
 * Property 1: Filter Correctness
 * For any filter criteria (government level, region, party, position) applied to the
 * politician directory, all returned politicians must satisfy that filter criteria.
 * When multiple filters are combined, all returned politicians must satisfy ALL
 * active filters simultaneously.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
import { GovernmentLevel } from "@prisma/client";

// Public eligibility is a separate service boundary; these unit fixtures retain the existing public values.
vi.mock("./public-research.service", async (importOriginal) => {
  const original = await importOriginal<typeof import("./public-research.service")>();
  return {
    ...original,
    getPublicRedFlagsBatch: vi.fn(async (ids: readonly string[]) => {
      const last = vi.mocked(prisma.politician.findMany).mock.results.at(-1);
      const rows = last?.type === "return" ? ((await last.value) ?? []) : [];
      return new Map(
        ids.map((id) => [
          id,
          (rows.find((p) => p.id === id) as unknown as { RedFlag: { id: string }[] })?.RedFlag ??
            [],
        ])
      );
    }),
  };
});
// Mock Prisma before importing the service
vi.mock("@/lib/prisma", () => ({
  default: {
    politician: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    sourceAttribution: {
      findMany: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import { listPoliticians, type PoliticianFilters } from "./politician.service";

// Minimum iterations for property tests
const NUM_RUNS = 100;

// ============================================
// Arbitraries (Generators) for Test Data
// ============================================

/**
 * Generate a valid government level
 */
const governmentLevelArb = fc.constantFrom(
  GovernmentLevel.national,
  GovernmentLevel.regional,
  GovernmentLevel.provincial,
  GovernmentLevel.city,
  GovernmentLevel.municipal,
  GovernmentLevel.barangay
);

/**
 * Generate a region name from Philippine regions
 */
const regionArb = fc.constantFrom(
  "NCR",
  "CAR",
  "Region I",
  "Region II",
  "Region III",
  "Region IV-A",
  "Region IV-B",
  "Region V",
  "Region VI",
  "Region VII",
  "Region VIII",
  "Region IX",
  "Region X",
  "Region XI",
  "Region XII",
  "Region XIII",
  "BARMM"
);

/**
 * Generate a political party name
 */
const partyArb = fc.constantFrom(
  "Liberal Party",
  "Nacionalista Party",
  "PDP-Laban",
  "Lakas-CMD",
  "NPC",
  "Aksyon Demokratiko",
  "Partido Federal ng Pilipinas"
);

/**
 * Generate a position title
 */
const positionArb = fc.constantFrom(
  "Senator",
  "Congressman",
  "Governor",
  "Vice Governor",
  "Mayor",
  "Vice Mayor",
  "Councilor",
  "Barangay Captain"
);

/**
 * Generate a list of mock politicians with matching properties
 */
function generateMockPoliticians(count: number, matchingFilter: PoliticianFilters): any[] {
  const politicians: any[] = [];

  for (let i = 0; i < count; i++) {
    politicians.push({
      id: `pol-match-${i}`,
      fullName: `Matching Politician ${i}`,
      photo: null,
      Position: [
        {
          id: `pos-${i}`,
          title: matchingFilter.position || "Senator",
          level: matchingFilter.level || GovernmentLevel.national,
          jurisdiction: matchingFilter.region
            ? `${matchingFilter.region}, Philippines`
            : "Philippines",
          isCurrent: true,
          startDate: new Date(),
        },
      ],
      PartyAffiliation: matchingFilter.party
        ? [
            {
              id: `aff-${i}`,
              isCurrent: true,
              PoliticalParty: {
                id: `party-${i}`,
                name: matchingFilter.party,
                abbreviation: matchingFilter.party.substring(0, 3).toUpperCase(),
              },
            },
          ]
        : [],
      RedFlag: matchingFilter.hasRedFlags ? [{ id: `rf-${i}` }] : [],
    });
  }

  return politicians;
}

// ============================================
// Property Tests
// ============================================

describe("Filter Correctness - Property 1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * **Validates: Requirements 1.2**
   *
   * Property 1.1: Government Level Filter Correctness
   * When filtering by government level, all returned politicians must have
   * positions at that level.
   */
  describe("Property 1.1: Government Level Filter", () => {
    it("all returned politicians should have positions at the filtered government level", async () => {
      await fc.assert(
        fc.asyncProperty(
          governmentLevelArb,
          fc.integer({ min: 0, max: 20 }),
          async (level, matchCount) => {
            vi.clearAllMocks();

            // Setup mock data
            const mockPoliticians = generateMockPoliticians(matchCount, { level });

            vi.mocked(prisma.politician.count).mockResolvedValue(matchCount);
            vi.mocked(prisma.politician.findMany).mockResolvedValue(mockPoliticians);

            // Execute filter
            const result = await listPoliticians({ level });

            // Property: All returned politicians have positions at the specified level
            for (const politician of result.items) {
              if (politician.currentPosition) {
                expect(politician.currentPosition.level).toBe(level);
              }
            }

            // Verify the filter was applied correctly in the query
            expect(prisma.politician.findMany).toHaveBeenCalledWith(
              expect.objectContaining({
                where: expect.objectContaining({
                  AND: expect.arrayContaining([
                    expect.objectContaining({
                      Position: {
                        some: {
                          isCurrent: true,
                          level: level,
                        },
                      },
                    }),
                  ]),
                }),
              })
            );
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 1.3**
   *
   * Property 1.2: Region Filter Correctness
   * When filtering by region, all returned politicians must have positions
   * in that region.
   */
  describe("Property 1.2: Region Filter", () => {
    it("all returned politicians should have positions in the filtered region", async () => {
      await fc.assert(
        fc.asyncProperty(regionArb, fc.integer({ min: 0, max: 20 }), async (region, matchCount) => {
          vi.clearAllMocks();

          // Setup mock data
          const mockPoliticians = generateMockPoliticians(matchCount, { region });

          vi.mocked(prisma.politician.count).mockResolvedValue(matchCount);
          vi.mocked(prisma.politician.findMany).mockResolvedValue(mockPoliticians);

          // Execute filter
          const result = await listPoliticians({ region });

          // Property: All returned politicians have positions in the specified region
          for (const politician of result.items) {
            if (politician.currentPosition) {
              expect(politician.currentPosition.jurisdiction.toLowerCase()).toContain(
                region.toLowerCase()
              );
            }
          }

          // Verify the filter was applied correctly in the query
          expect(prisma.politician.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
              where: expect.objectContaining({
                AND: expect.arrayContaining([
                  expect.objectContaining({
                    Position: {
                      some: {
                        isCurrent: true,
                        jurisdiction: {
                          contains: region,
                          mode: "insensitive",
                        },
                      },
                    },
                  }),
                ]),
              }),
            })
          );
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 1.4**
   *
   * Property 1.3: Party Filter Correctness
   * When filtering by party, all returned politicians must be affiliated
   * with that party.
   */
  describe("Property 1.3: Party Filter", () => {
    it("all returned politicians should be affiliated with the filtered party", async () => {
      await fc.assert(
        fc.asyncProperty(partyArb, fc.integer({ min: 0, max: 20 }), async (party, matchCount) => {
          vi.clearAllMocks();

          // Setup mock data
          const mockPoliticians = generateMockPoliticians(matchCount, { party });

          vi.mocked(prisma.politician.count).mockResolvedValue(matchCount);
          vi.mocked(prisma.politician.findMany).mockResolvedValue(mockPoliticians);

          // Execute filter
          const result = await listPoliticians({ party });

          // Property: All returned politicians are affiliated with the specified party
          for (const politician of result.items) {
            if (politician.currentParty) {
              const partyMatches =
                politician.currentParty.name.toLowerCase().includes(party.toLowerCase()) ||
                (politician.currentParty.abbreviation &&
                  politician.currentParty.abbreviation.toLowerCase().includes(party.toLowerCase()));
              expect(partyMatches).toBe(true);
            }
          }

          // Verify the filter was applied correctly in the query
          expect(prisma.politician.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
              where: expect.objectContaining({
                AND: expect.arrayContaining([
                  expect.objectContaining({
                    PartyAffiliation: {
                      some: {
                        isCurrent: true,
                        PoliticalParty: {
                          OR: [
                            { name: { contains: party, mode: "insensitive" } },
                            { abbreviation: { contains: party, mode: "insensitive" } },
                          ],
                        },
                      },
                    },
                  }),
                ]),
              }),
            })
          );
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 1.5**
   *
   * Property 1.4: Position Filter Correctness
   * When filtering by position, all returned politicians must hold that position.
   */
  describe("Property 1.4: Position Filter", () => {
    it("all returned politicians should hold the filtered position", async () => {
      await fc.assert(
        fc.asyncProperty(
          positionArb,
          fc.integer({ min: 0, max: 20 }),
          async (position, matchCount) => {
            vi.clearAllMocks();

            // Setup mock data
            const mockPoliticians = generateMockPoliticians(matchCount, { position });

            vi.mocked(prisma.politician.count).mockResolvedValue(matchCount);
            vi.mocked(prisma.politician.findMany).mockResolvedValue(mockPoliticians);

            // Execute filter
            const result = await listPoliticians({ position });

            // Property: All returned politicians hold the specified position
            for (const politician of result.items) {
              if (politician.currentPosition) {
                expect(politician.currentPosition.title.toLowerCase()).toBe(position.toLowerCase());
              }
            }

            // Verify the filter was applied correctly in the query
            expect(prisma.politician.findMany).toHaveBeenCalledWith(
              expect.objectContaining({
                where: expect.objectContaining({
                  AND: expect.arrayContaining([
                    expect.objectContaining({
                      Position: {
                        some: {
                          isCurrent: true,
                          title: {
                            equals: position,
                            mode: "insensitive",
                          },
                        },
                      },
                    }),
                  ]),
                }),
              })
            );
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 1.6**
   *
   * Property 1.5: Combined Filters Correctness
   * When multiple filters are combined, all returned politicians must satisfy
   * ALL active filters simultaneously.
   */
  describe("Property 1.5: Combined Filters", () => {
    it("all returned politicians should satisfy ALL combined filters simultaneously", async () => {
      await fc.assert(
        fc.asyncProperty(
          governmentLevelArb,
          regionArb,
          partyArb,
          positionArb,
          fc.integer({ min: 0, max: 10 }),
          async (level, region, party, position, matchCount) => {
            vi.clearAllMocks();

            // Setup mock data with all filters matching
            const mockPoliticians = generateMockPoliticians(matchCount, {
              level,
              region,
              party,
              position,
            });

            vi.mocked(prisma.politician.count).mockResolvedValue(matchCount);
            vi.mocked(prisma.politician.findMany).mockResolvedValue(mockPoliticians);

            // Execute with combined filters
            const result = await listPoliticians({ level, region, party, position });

            // Property: All returned politicians satisfy ALL filters
            for (const politician of result.items) {
              // Check level
              if (politician.currentPosition) {
                expect(politician.currentPosition.level).toBe(level);
              }

              // Check region
              if (politician.currentPosition) {
                expect(politician.currentPosition.jurisdiction.toLowerCase()).toContain(
                  region.toLowerCase()
                );
              }

              // Check party
              if (politician.currentParty) {
                const partyMatches =
                  politician.currentParty.name.toLowerCase().includes(party.toLowerCase()) ||
                  (politician.currentParty.abbreviation &&
                    politician.currentParty.abbreviation
                      .toLowerCase()
                      .includes(party.toLowerCase()));
                expect(partyMatches).toBe(true);
              }

              // Check position
              if (politician.currentPosition) {
                expect(politician.currentPosition.title.toLowerCase()).toBe(position.toLowerCase());
              }
            }

            // Verify all filters were applied with AND logic
            const callArgs = vi.mocked(prisma.politician.findMany).mock.calls[0]![0];
            expect(callArgs?.where?.AND).toHaveLength(4);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should apply filters with AND logic (not OR)", async () => {
      await fc.assert(
        fc.asyncProperty(governmentLevelArb, partyArb, async (level, party) => {
          vi.clearAllMocks();

          vi.mocked(prisma.politician.count).mockResolvedValue(0);
          vi.mocked(prisma.politician.findMany).mockResolvedValue([]);

          // Execute with two filters
          await listPoliticians({ level, party });

          // Verify AND logic is used
          const callArgs = vi.mocked(prisma.politician.findMany).mock.calls[0]![0];
          expect(callArgs?.where?.AND).toBeDefined();
          expect(Array.isArray(callArgs?.where?.AND)).toBe(true);
          expect(callArgs?.where?.AND).toHaveLength(2);
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.6**
   *
   * Property 1.6: Empty Filter Returns All
   * When no filters are applied, the query should not have filter conditions.
   */
  describe("Property 1.6: Empty Filter Behavior", () => {
    it("should not apply filter conditions when no filters are specified", async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 0, max: 50 }), async (totalCount) => {
          vi.clearAllMocks();

          vi.mocked(prisma.politician.count).mockResolvedValue(totalCount);
          vi.mocked(prisma.politician.findMany).mockResolvedValue([]);

          // Execute without filters
          await listPoliticians({});

          // Verify no AND conditions are applied
          const callArgs = vi.mocked(prisma.politician.findMany).mock.calls[0]![0];
          expect(callArgs?.where?.AND).toBeUndefined();
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 1.6**
   *
   * Property 1.7: Partial Filter Combinations
   * Any subset of filters should work correctly together.
   */
  describe("Property 1.7: Partial Filter Combinations", () => {
    it("should correctly apply any subset of filters", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.option(governmentLevelArb, { nil: undefined }),
          fc.option(regionArb, { nil: undefined }),
          fc.option(partyArb, { nil: undefined }),
          fc.option(positionArb, { nil: undefined }),
          async (level, region, party, position) => {
            vi.clearAllMocks();

            const filters: PoliticianFilters = {};
            let expectedFilterCount = 0;

            if (level !== undefined) {
              filters.level = level;
              expectedFilterCount++;
            }
            if (region !== undefined) {
              filters.region = region;
              expectedFilterCount++;
            }
            if (party !== undefined) {
              filters.party = party;
              expectedFilterCount++;
            }
            if (position !== undefined) {
              filters.position = position;
              expectedFilterCount++;
            }

            vi.mocked(prisma.politician.count).mockResolvedValue(0);
            vi.mocked(prisma.politician.findMany).mockResolvedValue([]);

            // Execute with partial filters
            await listPoliticians(filters);

            // Verify correct number of filter conditions
            const callArgs = vi.mocked(prisma.politician.findMany).mock.calls[0]![0];
            if (expectedFilterCount > 0) {
              expect(callArgs?.where?.AND).toHaveLength(expectedFilterCount);
            } else {
              expect(callArgs?.where?.AND).toBeUndefined();
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 1.6**
   *
   * Property 1.8: Red Flags Filter Correctness
   * When filtering by hasRedFlags, all returned politicians must match the flag status.
   */
  describe("Property 1.8: Red Flags Filter", () => {
    it("should correctly filter politicians by red flag status", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.boolean(),
          fc.integer({ min: 0, max: 20 }),
          async (hasRedFlags, matchCount) => {
            vi.clearAllMocks();

            // Setup mock data
            const mockPoliticians = generateMockPoliticians(matchCount, { hasRedFlags });

            vi.mocked(prisma.politician.count).mockResolvedValue(matchCount);
            vi.mocked(prisma.politician.findMany).mockResolvedValue(mockPoliticians);

            // Execute filter
            const result = await listPoliticians({ hasRedFlags });

            // Property: All returned politicians match the red flag status
            for (const politician of result.items) {
              expect(politician.hasRedFlags).toBe(hasRedFlags);
            }

            expect(result.totalCount).toBe(matchCount);
            const calls = vi.mocked(prisma.politician.findMany).mock.calls;
            const eligibleIds = hasRedFlags ? mockPoliticians.map((p) => p.id) : [];
            if (hasRedFlags && !matchCount) {
              expect(result.items).toEqual([]);
            } else {
              expect(calls.at(-1)?.[0]?.where?.id).toEqual(
                hasRedFlags ? { in: eligibleIds } : { notIn: eligibleIds }
              );
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});
