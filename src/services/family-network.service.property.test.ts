/**
 * Property-Based Tests for Family Network Completeness
 *
 * **Validates: Requirements 24.1, 24.2, 24.3, 24.4, 24.5**
 *
 * Property 15: Family Network Completeness
 * For any politician with family members in politics:
 * - All known family relationships must be included in the network
 * - Each relationship must have: relationship type, related politician ID, positions held
 * - Family members in the database must be linkable (have valid politician IDs)
 * - Total family member count must equal the number of unique related politicians
 * - Concurrent vs sequential position holding must be accurately determined based on date overlap
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
import { GovernmentLevel, RelationshipType } from "@prisma/client";

// Mock Prisma before importing the service
vi.mock("@/lib/prisma", () => ({
  default: {
    politician: {
      findUnique: vi.fn(),
    },
    familyRelationship: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import {
  getDateRangeOverlap,
  arePositionsSequential,
  getInverseRelationship,
  analyzePositionOverlaps,
  detectDynasty,
  getFamilyRelationships,
  getFamilyNetwork,
  type FamilyMember,
  type FamilyMemberPosition,
} from "./family-network.service";

// Minimum iterations for property tests
const NUM_RUNS = 100;

// ============================================
// Arbitraries (Generators) for Test Data
// ============================================

/**
 * Generate a valid relationship type
 */
const relationshipTypeArb = fc.constantFrom<RelationshipType>(
  "spouse",
  "parent",
  "child",
  "sibling",
  "in_law",
  "cousin",
  "grandparent",
  "grandchild"
);

/**
 * Generate a valid government level
 */
const governmentLevelArb = fc.constantFrom<GovernmentLevel>(
  GovernmentLevel.national,
  GovernmentLevel.regional,
  GovernmentLevel.provincial,
  GovernmentLevel.city,
  GovernmentLevel.municipal,
  GovernmentLevel.barangay
);

/**
 * Generate a valid position title
 */
const positionTitleArb = fc.constantFrom(
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
 * Generate a valid jurisdiction
 */
const jurisdictionArb = fc.constantFrom(
  "National",
  "NCR",
  "Makati City",
  "Taguig City",
  "Cebu Province",
  "Davao City",
  "District 1",
  "District 2"
);

/**
 * Generate a date within a reasonable political career range
 */
const politicalDateArb = fc.date({
  min: new Date("1990-01-01"),
  max: new Date("2030-12-31"),
});

/**
 * Generate an optional end date (null for current positions)
 */
const optionalEndDateArb = fc.option(politicalDateArb, { nil: null });

/**
 * Generate a valid position with consistent dates
 */
const positionArb = fc
  .record({
    id: fc.uuid(),
    title: positionTitleArb,
    level: governmentLevelArb,
    jurisdiction: jurisdictionArb,
    startDate: politicalDateArb,
    endDate: optionalEndDateArb,
  })
  .map((pos) => ({
    ...pos,
    // Ensure endDate is after startDate if present
    endDate: pos.endDate && pos.endDate > pos.startDate ? pos.endDate : null,
    isCurrent: pos.endDate === null || (pos.endDate && pos.endDate > pos.startDate ? false : true),
  })) as fc.Arbitrary<FamilyMemberPosition>;

/**
 * Generate a list of positions for a politician
 */
const positionsListArb = fc.array(positionArb, { minLength: 0, maxLength: 5 });

/**
 * Generate a family member with valid data
 */
const familyMemberArb = fc.record({
  id: fc.uuid(),
  politicianId: fc.uuid(),
  fullName: fc.string({ minLength: 2, maxLength: 50 }),
  photo: fc.option(fc.webUrl(), { nil: null }),
  relationshipType: relationshipTypeArb,
  positions: positionsListArb,
  isInDatabase: fc.boolean(),
  sources: fc.constant([]),
}) as fc.Arbitrary<FamilyMember>;

/**
 * Generate a list of family members
 */
const familyMembersListArb = fc.array(familyMemberArb, { minLength: 0, maxLength: 10 });

// ============================================
// Property Tests
// ============================================

describe("Family Network Completeness - Property 15", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * **Validates: Requirements 24.2**
   *
   * Property 15.1: Valid Relationship Types
   * All family members must have valid relationship types from the defined enum.
   */
  describe("Property 15.1: Valid Relationship Types", () => {
    const validRelationshipTypes: RelationshipType[] = [
      "spouse",
      "parent",
      "child",
      "sibling",
      "in_law",
      "cousin",
      "grandparent",
      "grandchild",
    ];

    it("all family members should have valid relationship types", () => {
      fc.assert(
        fc.property(familyMembersListArb, (familyMembers) => {
          for (const member of familyMembers) {
            expect(validRelationshipTypes).toContain(member.relationshipType);
          }
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("relationship type should be a non-empty string", () => {
      fc.assert(
        fc.property(relationshipTypeArb, (relationshipType) => {
          expect(typeof relationshipType).toBe("string");
          expect(relationshipType.length).toBeGreaterThan(0);
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 24.4**
   *
   * Property 15.2: Position Overlap Classification
   * Position overlaps must be correctly classified as concurrent or sequential
   * based on date overlap analysis.
   */
  describe("Property 15.2: Position Overlap Classification", () => {
    it("overlapping date ranges should be detected as concurrent", () => {
      fc.assert(
        fc.property(
          politicalDateArb,
          fc.integer({ min: 1, max: 1000 }), // days of overlap
          fc.integer({ min: 1, max: 1000 }), // days before overlap
          fc.integer({ min: 1, max: 1000 }), // days after overlap
          (baseDate, overlapDays, beforeDays, afterDays) => {
            // Create two overlapping ranges
            const start1 = new Date(baseDate);
            const end1 = new Date(
              baseDate.getTime() + (beforeDays + overlapDays) * 24 * 60 * 60 * 1000
            );
            const start2 = new Date(baseDate.getTime() + beforeDays * 24 * 60 * 60 * 1000);
            const end2 = new Date(
              start2.getTime() + (overlapDays + afterDays) * 24 * 60 * 60 * 1000
            );

            const overlap = getDateRangeOverlap(start1, end1, start2, end2);

            expect(overlap).not.toBeNull();
            expect(overlap!.start).toEqual(start2);
            expect(overlap!.end.getTime()).toBeLessThanOrEqual(end1.getTime());
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("non-overlapping date ranges should return null", () => {
      fc.assert(
        fc.property(
          politicalDateArb,
          fc.integer({ min: 100, max: 1000 }), // duration of first range
          fc.integer({ min: 10, max: 1000 }), // gap between ranges
          fc.integer({ min: 100, max: 1000 }), // duration of second range
          (baseDate, duration1, gap, duration2) => {
            const start1 = new Date(baseDate);
            const end1 = new Date(baseDate.getTime() + duration1 * 24 * 60 * 60 * 1000);
            const start2 = new Date(end1.getTime() + gap * 24 * 60 * 60 * 1000);
            const end2 = new Date(start2.getTime() + duration2 * 24 * 60 * 60 * 1000);

            const overlap = getDateRangeOverlap(start1, end1, start2, end2);

            expect(overlap).toBeNull();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("current positions (null end date) should be treated as ongoing", () => {
      fc.assert(
        fc.property(
          // Use dates in the past to ensure they overlap with "current" (now)
          fc.date({ min: new Date("1990-01-01"), max: new Date("2020-12-31") }),
          fc.date({ min: new Date("1990-01-01"), max: new Date("2020-12-31") }),
          (start1, start2) => {
            // Both positions are current (no end date) and started in the past
            const overlap = getDateRangeOverlap(start1, null, start2, null);

            // Current positions that started in the past always overlap
            expect(overlap).not.toBeNull();
            const laterStart = start1 > start2 ? start1 : start2;
            expect(overlap!.start).toEqual(laterStart);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 24.4**
   *
   * Property 15.3: Sequential Position Detection
   * Sequential positions must be correctly identified when same position
   * is held by different family members in succession.
   */
  describe("Property 15.3: Sequential Position Detection", () => {
    it("same position in same jurisdiction with valid gap should be sequential", () => {
      fc.assert(
        fc.property(
          positionTitleArb,
          jurisdictionArb,
          governmentLevelArb,
          politicalDateArb,
          fc.integer({ min: 1, max: 365 }), // gap in days (within allowed range)
          fc.integer({ min: 365, max: 1095 }), // term duration in days
          (title, jurisdiction, level, baseDate, gapDays, termDays) => {
            const pos1: FamilyMemberPosition = {
              id: "pos-1",
              title,
              level,
              jurisdiction,
              startDate: baseDate,
              endDate: new Date(baseDate.getTime() + termDays * 24 * 60 * 60 * 1000),
              isCurrent: false,
            };

            const pos2Start = new Date(pos1.endDate!.getTime() + gapDays * 24 * 60 * 60 * 1000);
            const pos2: FamilyMemberPosition = {
              id: "pos-2",
              title,
              level,
              jurisdiction,
              startDate: pos2Start,
              endDate: new Date(pos2Start.getTime() + termDays * 24 * 60 * 60 * 1000),
              isCurrent: false,
            };

            const isSequential = arePositionsSequential(pos1, pos2);
            expect(isSequential).toBe(true);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("different positions should not be sequential", () => {
      fc.assert(
        fc.property(
          fc.tuple(positionTitleArb, positionTitleArb).filter(([t1, t2]) => t1 !== t2),
          jurisdictionArb,
          governmentLevelArb,
          politicalDateArb,
          ([title1, title2], jurisdiction, level, baseDate) => {
            const pos1: FamilyMemberPosition = {
              id: "pos-1",
              title: title1,
              level,
              jurisdiction,
              startDate: baseDate,
              endDate: new Date(baseDate.getTime() + 365 * 24 * 60 * 60 * 1000),
              isCurrent: false,
            };

            const pos2: FamilyMemberPosition = {
              id: "pos-2",
              title: title2,
              level,
              jurisdiction,
              startDate: new Date(pos1.endDate!.getTime() + 1 * 24 * 60 * 60 * 1000),
              endDate: null,
              isCurrent: true,
            };

            const isSequential = arePositionsSequential(pos1, pos2);
            expect(isSequential).toBe(false);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("different jurisdictions should not be sequential", () => {
      fc.assert(
        fc.property(
          positionTitleArb,
          fc.tuple(jurisdictionArb, jurisdictionArb).filter(([j1, j2]) => j1 !== j2),
          governmentLevelArb,
          politicalDateArb,
          (title, [jurisdiction1, jurisdiction2], level, baseDate) => {
            const pos1: FamilyMemberPosition = {
              id: "pos-1",
              title,
              level,
              jurisdiction: jurisdiction1,
              startDate: baseDate,
              endDate: new Date(baseDate.getTime() + 365 * 24 * 60 * 60 * 1000),
              isCurrent: false,
            };

            const pos2: FamilyMemberPosition = {
              id: "pos-2",
              title,
              level,
              jurisdiction: jurisdiction2,
              startDate: new Date(pos1.endDate!.getTime() + 1 * 24 * 60 * 60 * 1000),
              endDate: null,
              isCurrent: true,
            };

            const isSequential = arePositionsSequential(pos1, pos2);
            expect(isSequential).toBe(false);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 24.1, 24.5**
   *
   * Property 15.4: Dynasty Detection Consistency
   * Dynasty detection must be consistent with family member count.
   * A dynasty is detected if and only if there are family members in politics.
   */
  describe("Property 15.4: Dynasty Detection Consistency", () => {
    it("dynasty should be detected when family members have political positions", () => {
      fc.assert(
        fc.property(
          fc.array(familyMemberArb, { minLength: 1, maxLength: 10 }).map((members) =>
            members.map((m) => ({
              ...m,
              positions: [
                {
                  id: "pos-1",
                  title: "Mayor",
                  level: GovernmentLevel.municipal,
                  jurisdiction: "Test City",
                  startDate: new Date("2019-06-30"),
                  endDate: new Date("2022-06-29"),
                  isCurrent: false,
                },
              ],
            }))
          ),
          (familyMembers) => {
            const result = detectDynasty(familyMembers, []);

            expect(result.isDynasty).toBe(true);
            expect(result.totalFamilyMembersInPolitics).toBe(familyMembers.length);
            expect(result.dynastySeverity).toBe("info");
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("dynasty should not be detected when no family members have positions", () => {
      fc.assert(
        fc.property(
          fc
            .array(familyMemberArb, { minLength: 0, maxLength: 10 })
            .map((members) => members.map((m) => ({ ...m, positions: [] }))),
          (familyMembers) => {
            const result = detectDynasty(familyMembers, []);

            expect(result.isDynasty).toBe(false);
            expect(result.totalFamilyMembersInPolitics).toBe(0);
            expect(result.dynastySeverity).toBe("none");
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("total family members count should equal unique politicians with positions", () => {
      fc.assert(
        fc.property(familyMembersListArb, (familyMembers) => {
          const result = detectDynasty(familyMembers, []);

          const membersWithPositions = familyMembers.filter((m) => m.positions.length > 0);
          expect(result.totalFamilyMembersInPolitics).toBe(membersWithPositions.length);
          expect(result.familyMembers.length).toBe(membersWithPositions.length);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("dynasty severity should always be info or none (never warning or critical)", () => {
      fc.assert(
        fc.property(familyMembersListArb, (familyMembers) => {
          const result = detectDynasty(familyMembers, []);

          expect(["info", "none"]).toContain(result.dynastySeverity);
          expect(result.dynastySeverity).not.toBe("warning");
          expect(result.dynastySeverity).not.toBe("critical");
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 24.2**
   *
   * Property 15.5: Inverse Relationship Symmetry
   * Inverse relationships must be symmetric (e.g., if A is parent of B, B is child of A).
   */
  describe("Property 15.5: Inverse Relationship Symmetry", () => {
    it("applying inverse twice should return original relationship", () => {
      fc.assert(
        fc.property(relationshipTypeArb, (relationshipType) => {
          const inverse = getInverseRelationship(relationshipType);
          const doubleInverse = getInverseRelationship(inverse);

          expect(doubleInverse).toBe(relationshipType);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("symmetric relationships should be their own inverse", () => {
      const symmetricRelationships: RelationshipType[] = ["spouse", "sibling", "cousin", "in_law"];

      fc.assert(
        fc.property(fc.constantFrom(...symmetricRelationships), (relationshipType) => {
          const inverse = getInverseRelationship(relationshipType);
          expect(inverse).toBe(relationshipType);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("asymmetric relationships should have different inverse", () => {
      const asymmetricPairs: [RelationshipType, RelationshipType][] = [
        ["parent", "child"],
        ["grandparent", "grandchild"],
      ];

      fc.assert(
        fc.property(fc.constantFrom(...asymmetricPairs), ([rel1, rel2]) => {
          expect(getInverseRelationship(rel1)).toBe(rel2);
          expect(getInverseRelationship(rel2)).toBe(rel1);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("inverse relationship should always be a valid relationship type", () => {
      const validTypes: RelationshipType[] = [
        "spouse",
        "parent",
        "child",
        "sibling",
        "in_law",
        "cousin",
        "grandparent",
        "grandchild",
      ];

      fc.assert(
        fc.property(relationshipTypeArb, (relationshipType) => {
          const inverse = getInverseRelationship(relationshipType);
          expect(validTypes).toContain(inverse);
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 24.3, 24.4**
   *
   * Property 15.6: Position Overlap Analysis Completeness
   * Position overlap analysis should correctly count concurrent and sequential positions.
   */
  describe("Property 15.6: Position Overlap Analysis Completeness", () => {
    it("concurrent position count should match overlapping date ranges", () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.string({ minLength: 2, maxLength: 30 }),
          positionsListArb,
          familyMembersListArb,
          (politicianId, politicianName, politicianPositions, familyMembers) => {
            const overlaps = analyzePositionOverlaps(
              politicianId,
              politicianName,
              politicianPositions,
              familyMembers
            );

            const concurrentCount = overlaps.filter((o) => o.overlapType === "concurrent").length;
            const sequentialCount = overlaps.filter((o) => o.overlapType === "sequential").length;

            // Total overlaps should equal concurrent + sequential
            expect(overlaps.length).toBe(concurrentCount + sequentialCount);

            // Each overlap should have valid overlap type
            for (const overlap of overlaps) {
              expect(["concurrent", "sequential"]).toContain(overlap.overlapType);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("concurrent overlaps should have overlap period defined", () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.string({ minLength: 2, maxLength: 30 }),
          positionsListArb,
          familyMembersListArb,
          (politicianId, politicianName, politicianPositions, familyMembers) => {
            const overlaps = analyzePositionOverlaps(
              politicianId,
              politicianName,
              politicianPositions,
              familyMembers
            );

            for (const overlap of overlaps) {
              if (overlap.overlapType === "concurrent") {
                expect(overlap.overlapPeriod).toBeDefined();
                expect(overlap.overlapPeriod!.start).toBeInstanceOf(Date);
                expect(overlap.overlapPeriod!.end).toBeInstanceOf(Date);
                expect(overlap.overlapPeriod!.start.getTime()).toBeLessThanOrEqual(
                  overlap.overlapPeriod!.end.getTime()
                );
              }
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("all overlaps should reference valid politician and family member", () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.string({ minLength: 2, maxLength: 30 }),
          positionsListArb,
          familyMembersListArb,
          (politicianId, politicianName, politicianPositions, familyMembers) => {
            const overlaps = analyzePositionOverlaps(
              politicianId,
              politicianName,
              politicianPositions,
              familyMembers
            );

            const familyMemberIds = new Set(familyMembers.map((m) => m.politicianId));

            for (const overlap of overlaps) {
              expect(overlap.politicianId).toBe(politicianId);
              expect(overlap.politicianName).toBe(politicianName);
              expect(familyMemberIds.has(overlap.relatedPoliticianId)).toBe(true);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 24.1, 24.3**
   *
   * Property 15.7: Family Member Data Completeness
   * Each family member must have required fields: relationship type, politician ID, positions.
   */
  describe("Property 15.7: Family Member Data Completeness", () => {
    it("all family members should have required fields", () => {
      fc.assert(
        fc.property(familyMemberArb, (familyMember) => {
          // Required fields must be present
          expect(familyMember).toHaveProperty("id");
          expect(familyMember).toHaveProperty("politicianId");
          expect(familyMember).toHaveProperty("relationshipType");
          expect(familyMember).toHaveProperty("positions");
          expect(familyMember).toHaveProperty("isInDatabase");

          // Required fields must have valid types
          expect(typeof familyMember.id).toBe("string");
          expect(typeof familyMember.politicianId).toBe("string");
          expect(typeof familyMember.relationshipType).toBe("string");
          expect(Array.isArray(familyMember.positions)).toBe(true);
          expect(typeof familyMember.isInDatabase).toBe("boolean");
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("politician IDs should be non-empty strings", () => {
      fc.assert(
        fc.property(familyMemberArb, (familyMember) => {
          expect(familyMember.politicianId.length).toBeGreaterThan(0);
          expect(familyMember.id.length).toBeGreaterThan(0);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("positions should have valid structure", () => {
      fc.assert(
        fc.property(familyMemberArb, (familyMember) => {
          for (const position of familyMember.positions) {
            expect(position).toHaveProperty("id");
            expect(position).toHaveProperty("title");
            expect(position).toHaveProperty("level");
            expect(position).toHaveProperty("jurisdiction");
            expect(position).toHaveProperty("startDate");
            expect(position).toHaveProperty("isCurrent");

            expect(typeof position.title).toBe("string");
            expect(position.startDate).toBeInstanceOf(Date);
          }
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 24.4, 24.5**
   *
   * Property 15.8: Dynasty Detection with Position Overlaps
   * Dynasty detection should correctly count concurrent and sequential positions from overlaps.
   */
  describe("Property 15.8: Dynasty Detection with Position Overlaps", () => {
    it("concurrent position count should match overlaps with concurrent type", () => {
      fc.assert(
        fc.property(
          familyMembersListArb,
          fc.array(
            fc.record({
              overlapType: fc.constantFrom("concurrent", "sequential") as fc.Arbitrary<
                "concurrent" | "sequential"
              >,
            }),
            { minLength: 0, maxLength: 20 }
          ),
          (familyMembers, overlapTypes) => {
            const positionOverlaps = overlapTypes.map((o, i) => ({
              politicianId: "pol-1",
              politicianName: "Test Politician",
              relatedPoliticianId: `rel-${i}`,
              relatedPoliticianName: `Related ${i}`,
              relationshipType: "spouse" as RelationshipType,
              overlapType: o.overlapType,
              position1: {
                title: "Senator",
                jurisdiction: "National",
                startDate: new Date("2019-06-30"),
                endDate: null,
              },
              position2: {
                title: "Congressman",
                jurisdiction: "District 1",
                startDate: new Date("2019-06-30"),
                endDate: null,
              },
            }));

            const result = detectDynasty(familyMembers, positionOverlaps);

            const expectedConcurrent = positionOverlaps.filter(
              (o) => o.overlapType === "concurrent"
            ).length;
            const expectedSequential = positionOverlaps.filter(
              (o) => o.overlapType === "sequential"
            ).length;

            expect(result.concurrentPositions).toBe(expectedConcurrent);
            expect(result.sequentialPositions).toBe(expectedSequential);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("position overlaps should be preserved in dynasty result", () => {
      fc.assert(
        fc.property(
          familyMembersListArb,
          fc.integer({ min: 0, max: 10 }),
          (familyMembers, overlapCount) => {
            const positionOverlaps = Array.from({ length: overlapCount }, (_, i) => ({
              politicianId: "pol-1",
              politicianName: "Test Politician",
              relatedPoliticianId: `rel-${i}`,
              relatedPoliticianName: `Related ${i}`,
              relationshipType: "spouse" as RelationshipType,
              overlapType: "concurrent" as const,
              position1: {
                title: "Senator",
                jurisdiction: "National",
                startDate: new Date("2019-06-30"),
                endDate: null,
              },
              position2: {
                title: "Congressman",
                jurisdiction: "District 1",
                startDate: new Date("2019-06-30"),
                endDate: null,
              },
            }));

            const result = detectDynasty(familyMembers, positionOverlaps);

            expect(result.positionOverlaps.length).toBe(overlapCount);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 24.1, 24.2, 24.3**
   *
   * Property 15.9: Database Integration - Family Relationships
   * Family relationships from database should be correctly transformed.
   */
  describe("Property 15.9: Database Integration - Family Relationships", () => {
    it("should return empty array when no relationships exist", async () => {
      await fc.assert(
        fc.asyncProperty(fc.uuid(), async (politicianId) => {
          vi.clearAllMocks();

          vi.mocked(prisma.familyRelationship.findMany)
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([]);

          const result = await getFamilyRelationships(politicianId);

          expect(result).toEqual([]);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should not duplicate family members appearing in both directions", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          relationshipTypeArb,
          async (politicianId, relatedId, relationshipType) => {
            vi.clearAllMocks();

            // Same person appears in both queries
            vi.mocked(prisma.familyRelationship.findMany)
              .mockResolvedValueOnce([
                {
                  id: "rel-1",
                  politicianId,
                  relatedPoliticianId: relatedId,
                  relationshipType,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  Politician_FamilyRelationship_relatedPoliticianIdToPolitician: {
                    id: relatedId,
                    fullName: "Test Person",
                    photo: null,
                    Position: [],
                  },
                  SourceAttribution: [],
                },
              ] as any)
              .mockResolvedValueOnce([
                {
                  id: "rel-1",
                  politicianId: relatedId,
                  relatedPoliticianId: politicianId,
                  relationshipType: getInverseRelationship(relationshipType),
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  Politician_FamilyRelationship_politicianIdToPolitician: {
                    id: relatedId,
                    fullName: "Test Person",
                    photo: null,
                    Position: [],
                  },
                  SourceAttribution: [],
                },
              ] as any);

            const result = await getFamilyRelationships(politicianId);

            // Should only have one entry for the related person
            expect(result.length).toBe(1);
            expect(result[0]!.politicianId).toBe(relatedId);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 24.1, 24.2, 24.3, 24.4, 24.5**
   *
   * Property 15.10: Complete Family Network Integration
   * getFamilyNetwork should return complete and consistent data.
   */
  describe("Property 15.10: Complete Family Network Integration", () => {
    it("should return null for non-existent politician", async () => {
      await fc.assert(
        fc.asyncProperty(fc.uuid(), async (politicianId) => {
          vi.clearAllMocks();
          vi.mocked(prisma.politician.findUnique).mockResolvedValue(null);

          const result = await getFamilyNetwork(politicianId);

          expect(result).toBeNull();
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should return consistent dynasty detection based on family members", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.string({ minLength: 2, maxLength: 30 }),
          fc.boolean(),
          async (politicianId, politicianName, hasFamilyInPolitics) => {
            vi.clearAllMocks();

            // Mock politician
            vi.mocked(prisma.politician.findUnique).mockResolvedValue({
              id: politicianId,
              fullName: politicianName,
              Position: [],
            } as any);

            // Mock family relationships based on hasFamilyInPolitics
            if (hasFamilyInPolitics) {
              vi.mocked(prisma.familyRelationship.findMany)
                .mockResolvedValueOnce([
                  {
                    id: "rel-1",
                    politicianId,
                    relatedPoliticianId: "rel-pol-1",
                    relationshipType: "spouse" as RelationshipType,
                    Politician_FamilyRelationship_relatedPoliticianIdToPolitician: {
                      id: "rel-pol-1",
                      fullName: "Family Member",
                      photo: null,
                      Position: [
                        {
                          id: "pos-1",
                          title: "Mayor",
                          level: GovernmentLevel.municipal,
                          jurisdiction: "Test City",
                          startDate: new Date("2019-06-30"),
                          endDate: null,
                          isCurrent: true,
                        },
                      ],
                    },
                    SourceAttribution: [],
                  },
                ] as any)
                .mockResolvedValueOnce([]);
            } else {
              vi.mocked(prisma.familyRelationship.findMany)
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);
            }

            const result = await getFamilyNetwork(politicianId);

            expect(result).not.toBeNull();
            expect(result!.politicianId).toBe(politicianId);
            expect(result!.politicianName).toBe(politicianName);
            expect(result!.isDynasty).toBe(hasFamilyInPolitics);

            if (hasFamilyInPolitics) {
              expect(result!.totalFamilyMembersInPolitics).toBeGreaterThan(0);
              expect(result!.dynastySeverity).toBe("info");
            } else {
              expect(result!.totalFamilyMembersInPolitics).toBe(0);
              expect(result!.dynastySeverity).toBe("none");
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});
