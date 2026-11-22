/**
 * Family Network Service Tests
 *
 * Unit tests for family relationship queries, family tree traversal,
 * dynasty detection, and concurrent/sequential position analysis.
 *
 * Requirements: 24.1, 24.2, 24.3, 24.4, 24.5, 24.7
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { GovernmentLevel, RelationshipType, SourceType, Prisma } from "@prisma/client";

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
  isPoliticalDynasty,
  FamilyMember,
  FamilyMemberPosition,
} from "./family-network.service";

// ============================================
// Helper Function Tests
// ============================================

describe("getDateRangeOverlap", () => {
  it("should detect overlapping date ranges", () => {
    const start1 = new Date("2020-01-01");
    const end1 = new Date("2023-12-31");
    const start2 = new Date("2022-01-01");
    const end2 = new Date("2025-12-31");

    const overlap = getDateRangeOverlap(start1, end1, start2, end2);

    expect(overlap).not.toBeNull();
    expect(overlap!.start).toEqual(new Date("2022-01-01"));
    expect(overlap!.end).toEqual(new Date("2023-12-31"));
  });

  it("should return null for non-overlapping date ranges", () => {
    const start1 = new Date("2020-01-01");
    const end1 = new Date("2021-12-31");
    const start2 = new Date("2023-01-01");
    const end2 = new Date("2025-12-31");

    const overlap = getDateRangeOverlap(start1, end1, start2, end2);

    expect(overlap).toBeNull();
  });

  it("should handle null end dates (current positions)", () => {
    const start1 = new Date("2020-01-01");
    const end1 = null; // Current position
    const start2 = new Date("2022-01-01");
    const end2 = null; // Current position

    const overlap = getDateRangeOverlap(start1, end1, start2, end2);

    expect(overlap).not.toBeNull();
    expect(overlap!.start).toEqual(new Date("2022-01-01"));
  });

  it("should detect exact boundary overlap", () => {
    const start1 = new Date("2020-01-01");
    const end1 = new Date("2022-06-30");
    const start2 = new Date("2022-06-30");
    const end2 = new Date("2025-12-31");

    const overlap = getDateRangeOverlap(start1, end1, start2, end2);

    expect(overlap).not.toBeNull();
    expect(overlap!.start).toEqual(new Date("2022-06-30"));
    expect(overlap!.end).toEqual(new Date("2022-06-30"));
  });

  it("should handle one range completely inside another", () => {
    const start1 = new Date("2020-01-01");
    const end1 = new Date("2025-12-31");
    const start2 = new Date("2022-01-01");
    const end2 = new Date("2023-12-31");

    const overlap = getDateRangeOverlap(start1, end1, start2, end2);

    expect(overlap).not.toBeNull();
    expect(overlap!.start).toEqual(new Date("2022-01-01"));
    expect(overlap!.end).toEqual(new Date("2023-12-31"));
  });
});

describe("arePositionsSequential", () => {
  const createPosition = (
    title: string,
    jurisdiction: string,
    startDate: string,
    endDate: string | null
  ): FamilyMemberPosition => ({
    id: "test-id",
    title,
    level: "municipal" as GovernmentLevel,
    jurisdiction,
    startDate: new Date(startDate),
    endDate: endDate ? new Date(endDate) : null,
    isCurrent: endDate === null,
  });

  it("should detect sequential positions with same title and jurisdiction", () => {
    const pos1 = createPosition("Mayor", "Makati City", "2016-06-30", "2019-06-29");
    const pos2 = createPosition("Mayor", "Makati City", "2019-06-30", "2022-06-29");

    expect(arePositionsSequential(pos1, pos2)).toBe(true);
  });

  it("should not detect sequential positions with different titles", () => {
    const pos1 = createPosition("Mayor", "Makati City", "2016-06-30", "2019-06-29");
    const pos2 = createPosition("Vice Mayor", "Makati City", "2019-06-30", "2022-06-29");

    expect(arePositionsSequential(pos1, pos2)).toBe(false);
  });

  it("should not detect sequential positions with different jurisdictions", () => {
    const pos1 = createPosition("Mayor", "Makati City", "2016-06-30", "2019-06-29");
    const pos2 = createPosition("Mayor", "Taguig City", "2019-06-30", "2022-06-29");

    expect(arePositionsSequential(pos1, pos2)).toBe(false);
  });

  it("should not detect sequential positions if earlier position has no end date", () => {
    const pos1 = createPosition("Mayor", "Makati City", "2016-06-30", null);
    const pos2 = createPosition("Mayor", "Makati City", "2019-06-30", "2022-06-29");

    expect(arePositionsSequential(pos1, pos2)).toBe(false);
  });

  it("should detect sequential positions with gap within allowed range", () => {
    const pos1 = createPosition("Mayor", "Makati City", "2016-06-30", "2019-06-29");
    const pos2 = createPosition("Mayor", "Makati City", "2019-07-15", "2022-06-29"); // 16 day gap

    expect(arePositionsSequential(pos1, pos2)).toBe(true);
  });

  it("should not detect sequential positions with gap exceeding allowed range", () => {
    const pos1 = createPosition("Mayor", "Makati City", "2016-06-30", "2019-06-29");
    const pos2 = createPosition("Mayor", "Makati City", "2021-06-30", "2024-06-29"); // 2 year gap

    expect(arePositionsSequential(pos1, pos2)).toBe(false);
  });

  it("should handle case-insensitive title comparison", () => {
    const pos1 = createPosition("MAYOR", "Makati City", "2016-06-30", "2019-06-29");
    const pos2 = createPosition("mayor", "Makati City", "2019-06-30", "2022-06-29");

    expect(arePositionsSequential(pos1, pos2)).toBe(true);
  });
});

describe("getInverseRelationship", () => {
  it("should return child for parent", () => {
    expect(getInverseRelationship("parent")).toBe("child");
  });

  it("should return parent for child", () => {
    expect(getInverseRelationship("child")).toBe("parent");
  });

  it("should return grandchild for grandparent", () => {
    expect(getInverseRelationship("grandparent")).toBe("grandchild");
  });

  it("should return grandparent for grandchild", () => {
    expect(getInverseRelationship("grandchild")).toBe("grandparent");
  });

  it("should return spouse for spouse (symmetric)", () => {
    expect(getInverseRelationship("spouse")).toBe("spouse");
  });

  it("should return sibling for sibling (symmetric)", () => {
    expect(getInverseRelationship("sibling")).toBe("sibling");
  });

  it("should return cousin for cousin (symmetric)", () => {
    expect(getInverseRelationship("cousin")).toBe("cousin");
  });

  it("should return in_law for in_law (symmetric)", () => {
    expect(getInverseRelationship("in_law")).toBe("in_law");
  });
});

// ============================================
// Position Overlap Analysis Tests
// ============================================

describe("analyzePositionOverlaps", () => {
  const createFamilyMember = (
    id: string,
    name: string,
    relationshipType: RelationshipType,
    positions: FamilyMemberPosition[]
  ): FamilyMember => ({
    id: `rel-${id}`,
    politicianId: id,
    fullName: name,
    photo: null,
    relationshipType,
    positions,
    isInDatabase: true,
    sources: [],
  });

  const createPosition = (
    id: string,
    title: string,
    jurisdiction: string,
    startDate: string,
    endDate: string | null
  ): FamilyMemberPosition => ({
    id,
    title,
    level: "municipal" as GovernmentLevel,
    jurisdiction,
    startDate: new Date(startDate),
    endDate: endDate ? new Date(endDate) : null,
    isCurrent: endDate === null,
  });

  it("should detect concurrent positions", () => {
    const politicianPositions = [
      createPosition("p1", "Senator", "National", "2019-06-30", "2025-06-29"),
    ];

    const familyMembers = [
      createFamilyMember("fm1", "Family Member 1", "spouse", [
        createPosition("fm1-p1", "Congresswoman", "District 1", "2019-06-30", "2022-06-29"),
      ]),
    ];

    const overlaps = analyzePositionOverlaps(
      "politician-1",
      "Test Politician",
      politicianPositions,
      familyMembers
    );

    expect(overlaps.length).toBe(1);
    expect(overlaps[0]!.overlapType).toBe("concurrent");
    expect(overlaps[0]!.relationshipType).toBe("spouse");
  });

  it("should detect sequential positions", () => {
    const politicianPositions = [
      createPosition("p1", "Mayor", "Makati City", "2016-06-30", "2019-06-29"),
    ];

    const familyMembers = [
      createFamilyMember("fm1", "Family Member 1", "child", [
        createPosition("fm1-p1", "Mayor", "Makati City", "2019-06-30", "2022-06-29"),
      ]),
    ];

    const overlaps = analyzePositionOverlaps(
      "politician-1",
      "Test Politician",
      politicianPositions,
      familyMembers
    );

    expect(overlaps.length).toBe(1);
    expect(overlaps[0]!.overlapType).toBe("sequential");
    expect(overlaps[0]!.relationshipType).toBe("child");
  });

  it("should detect both concurrent and sequential positions", () => {
    const politicianPositions = [
      createPosition("p1", "Mayor", "Makati City", "2016-06-30", "2019-06-29"),
      createPosition("p2", "Senator", "National", "2019-06-30", "2025-06-29"),
    ];

    const familyMembers = [
      createFamilyMember("fm1", "Family Member 1", "spouse", [
        createPosition("fm1-p1", "Mayor", "Makati City", "2019-06-30", "2022-06-29"),
        createPosition("fm1-p2", "Congresswoman", "District 1", "2022-06-30", null),
      ]),
    ];

    const overlaps = analyzePositionOverlaps(
      "politician-1",
      "Test Politician",
      politicianPositions,
      familyMembers
    );

    const concurrent = overlaps.filter((o) => o.overlapType === "concurrent");
    const sequential = overlaps.filter((o) => o.overlapType === "sequential");

    expect(concurrent.length).toBeGreaterThan(0);
    expect(sequential.length).toBe(1);
  });

  it("should return empty array when no overlaps exist", () => {
    const politicianPositions = [
      createPosition("p1", "Mayor", "Makati City", "2010-06-30", "2013-06-29"),
    ];

    const familyMembers = [
      createFamilyMember("fm1", "Family Member 1", "sibling", [
        createPosition("fm1-p1", "Governor", "Cebu Province", "2020-06-30", "2023-06-29"),
      ]),
    ];

    const overlaps = analyzePositionOverlaps(
      "politician-1",
      "Test Politician",
      politicianPositions,
      familyMembers
    );

    expect(overlaps.length).toBe(0);
  });

  it("should handle multiple family members with overlapping positions", () => {
    const politicianPositions = [createPosition("p1", "Senator", "National", "2019-06-30", null)];

    const familyMembers = [
      createFamilyMember("fm1", "Spouse", "spouse", [
        createPosition("fm1-p1", "Congresswoman", "District 1", "2019-06-30", null),
      ]),
      createFamilyMember("fm2", "Child", "child", [
        createPosition("fm2-p1", "Mayor", "Makati City", "2022-06-30", null),
      ]),
    ];

    const overlaps = analyzePositionOverlaps(
      "politician-1",
      "Test Politician",
      politicianPositions,
      familyMembers
    );

    expect(overlaps.length).toBe(2);
    expect(overlaps.every((o) => o.overlapType === "concurrent")).toBe(true);
  });
});

// ============================================
// Dynasty Detection Tests
// ============================================

describe("detectDynasty", () => {
  const createFamilyMember = (
    id: string,
    name: string,
    relationshipType: RelationshipType,
    hasPositions: boolean
  ): FamilyMember => ({
    id: `rel-${id}`,
    politicianId: id,
    fullName: name,
    photo: null,
    relationshipType,
    positions: hasPositions
      ? [
          {
            id: `pos-${id}`,
            title: "Mayor",
            level: "municipal" as GovernmentLevel,
            jurisdiction: "Test City",
            startDate: new Date("2019-06-30"),
            endDate: new Date("2022-06-29"),
            isCurrent: false,
          },
        ]
      : [],
    isInDatabase: true,
    sources: [],
  });

  it("should detect dynasty when family members have political positions", () => {
    const familyMembers = [
      createFamilyMember("fm1", "Family Member 1", "spouse", true),
      createFamilyMember("fm2", "Family Member 2", "child", true),
    ];

    const result = detectDynasty(familyMembers, []);

    expect(result.isDynasty).toBe(true);
    expect(result.totalFamilyMembersInPolitics).toBe(2);
    expect(result.dynastySeverity).toBe("info");
  });

  it("should not detect dynasty when no family members have political positions", () => {
    const familyMembers = [
      createFamilyMember("fm1", "Family Member 1", "spouse", false),
      createFamilyMember("fm2", "Family Member 2", "child", false),
    ];

    const result = detectDynasty(familyMembers, []);

    expect(result.isDynasty).toBe(false);
    expect(result.totalFamilyMembersInPolitics).toBe(0);
    expect(result.dynastySeverity).toBe("none");
  });

  it("should count concurrent and sequential positions correctly", () => {
    const familyMembers = [createFamilyMember("fm1", "Family Member 1", "spouse", true)];

    const positionOverlaps = [
      {
        politicianId: "p1",
        politicianName: "Politician",
        relatedPoliticianId: "fm1",
        relatedPoliticianName: "Family Member 1",
        relationshipType: "spouse" as RelationshipType,
        overlapType: "concurrent" as const,
        position1: {
          title: "Senator",
          jurisdiction: "National",
          startDate: new Date("2019-06-30"),
          endDate: null,
        },
        position2: {
          title: "Congresswoman",
          jurisdiction: "District 1",
          startDate: new Date("2019-06-30"),
          endDate: null,
        },
      },
      {
        politicianId: "p1",
        politicianName: "Politician",
        relatedPoliticianId: "fm1",
        relatedPoliticianName: "Family Member 1",
        relationshipType: "spouse" as RelationshipType,
        overlapType: "sequential" as const,
        position1: {
          title: "Mayor",
          jurisdiction: "Makati City",
          startDate: new Date("2016-06-30"),
          endDate: new Date("2019-06-29"),
        },
        position2: {
          title: "Mayor",
          jurisdiction: "Makati City",
          startDate: new Date("2019-06-30"),
          endDate: new Date("2022-06-29"),
        },
      },
    ];

    const result = detectDynasty(familyMembers, positionOverlaps);

    expect(result.concurrentPositions).toBe(1);
    expect(result.sequentialPositions).toBe(1);
  });

  it("should always set dynasty severity to info (not warning or critical)", () => {
    // Per Requirement 18.7: Dynasty indicators without corruption/legal issues
    // must have severity 'info' (not 'warning' or 'critical')
    const familyMembers = [
      createFamilyMember("fm1", "Family Member 1", "spouse", true),
      createFamilyMember("fm2", "Family Member 2", "child", true),
      createFamilyMember("fm3", "Family Member 3", "sibling", true),
      createFamilyMember("fm4", "Family Member 4", "parent", true),
    ];

    const result = detectDynasty(familyMembers, []);

    expect(result.isDynasty).toBe(true);
    expect(result.dynastySeverity).toBe("info");
    expect(result.dynastySeverity).not.toBe("warning");
    expect(result.dynastySeverity).not.toBe("critical");
  });

  it("should only count family members with positions in totalFamilyMembersInPolitics", () => {
    const familyMembers = [
      createFamilyMember("fm1", "Family Member 1", "spouse", true),
      createFamilyMember("fm2", "Family Member 2", "child", false),
      createFamilyMember("fm3", "Family Member 3", "sibling", true),
    ];

    const result = detectDynasty(familyMembers, []);

    expect(result.totalFamilyMembersInPolitics).toBe(2);
    expect(result.familyMembers.length).toBe(2);
  });

  it("should handle empty family members array", () => {
    const result = detectDynasty([], []);

    expect(result.isDynasty).toBe(false);
    expect(result.totalFamilyMembersInPolitics).toBe(0);
    expect(result.dynastySeverity).toBe("none");
  });
});

// ============================================
// Database-Dependent Function Tests
// ============================================

describe("getFamilyRelationships", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper to create mock source attribution
  function createMockSourceAttribution(overrides = {}) {
    return {
      id: "source-1",
      sourceType: SourceType.official_government,
      sourceName: "COMELEC",
      sourceUrl: "https://comelec.gov.ph",
      documentDate: new Date("2022-01-01"),
      retrievedAt: new Date("2024-01-01"),
      confidence: new Prisma.Decimal("0.95"),
      isAIProcessed: false,
      originalDocumentId: null,
      fieldName: "relationship",
      createdAt: new Date(),
      ...overrides,
    };
  }

  it("should return family members from both relationship directions", async () => {
    // Mock relationships where politician is the source
    vi.mocked(prisma.familyRelationship.findMany)
      .mockResolvedValueOnce([
        {
          id: "rel-1",
          politicianId: "pol-1",
          relatedPoliticianId: "pol-2",
          relationshipType: "spouse" as RelationshipType,
          createdAt: new Date(),
          updatedAt: new Date(),
          Politician_FamilyRelationship_relatedPoliticianIdToPolitician: {
            id: "pol-2",
            fullName: "Maria Santos",
            photo: null,
            Position: [
              {
                id: "pos-1",
                title: "Congresswoman",
                level: "national" as GovernmentLevel,
                jurisdiction: "District 1",
                startDate: new Date("2019-06-30"),
                endDate: null,
                isCurrent: true,
              },
            ],
          },
          SourceAttribution: [createMockSourceAttribution()],
        },
      ] as any)
      // Mock relationships where politician is the target
      .mockResolvedValueOnce([
        {
          id: "rel-2",
          politicianId: "pol-3",
          relatedPoliticianId: "pol-1",
          relationshipType: "parent" as RelationshipType,
          createdAt: new Date(),
          updatedAt: new Date(),
          Politician_FamilyRelationship_politicianIdToPolitician: {
            id: "pol-3",
            fullName: "Jose Santos Sr.",
            photo: null,
            Position: [
              {
                id: "pos-2",
                title: "Governor",
                level: "provincial" as GovernmentLevel,
                jurisdiction: "Cebu Province",
                startDate: new Date("2010-06-30"),
                endDate: new Date("2019-06-29"),
                isCurrent: false,
              },
            ],
          },
          SourceAttribution: [createMockSourceAttribution()],
        },
      ] as any);

    const result = await getFamilyRelationships("pol-1");

    expect(result).toHaveLength(2);
    expect(result[0]!.fullName).toBe("Maria Santos");
    expect(result[0]!.relationshipType).toBe("spouse");
    expect(result[1]!.fullName).toBe("Jose Santos Sr.");
    // Parent relationship should be inverted to child
    expect(result[1]!.relationshipType).toBe("child");
  });

  it("should return empty array when no family relationships exist", async () => {
    vi.mocked(prisma.familyRelationship.findMany)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await getFamilyRelationships("pol-1");

    expect(result).toHaveLength(0);
  });

  it("should not duplicate family members that appear in both directions", async () => {
    // Same person appears in both queries
    vi.mocked(prisma.familyRelationship.findMany)
      .mockResolvedValueOnce([
        {
          id: "rel-1",
          politicianId: "pol-1",
          relatedPoliticianId: "pol-2",
          relationshipType: "spouse" as RelationshipType,
          createdAt: new Date(),
          updatedAt: new Date(),
          Politician_FamilyRelationship_relatedPoliticianIdToPolitician: {
            id: "pol-2",
            fullName: "Maria Santos",
            photo: null,
            Position: [],
          },
          SourceAttribution: [],
        },
      ] as any)
      .mockResolvedValueOnce([
        {
          id: "rel-1",
          politicianId: "pol-2",
          relatedPoliticianId: "pol-1",
          relationshipType: "spouse" as RelationshipType,
          createdAt: new Date(),
          updatedAt: new Date(),
          Politician_FamilyRelationship_politicianIdToPolitician: {
            id: "pol-2",
            fullName: "Maria Santos",
            photo: null,
            Position: [],
          },
          SourceAttribution: [],
        },
      ] as any);

    const result = await getFamilyRelationships("pol-1");

    // Should only have one entry for pol-2
    expect(result).toHaveLength(1);
    expect(result[0]!.politicianId).toBe("pol-2");
  });
});

describe("getFamilyNetwork", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return null for non-existent politician", async () => {
    vi.mocked(prisma.politician.findUnique).mockResolvedValue(null);

    const result = await getFamilyNetwork("non-existent");

    expect(result).toBeNull();
  });

  it("should return complete family network with dynasty detection", async () => {
    // Mock politician
    vi.mocked(prisma.politician.findUnique).mockResolvedValue({
      id: "pol-1",
      fullName: "Juan Santos",
      Position: [
        {
          id: "pos-1",
          title: "Senator",
          level: "national" as GovernmentLevel,
          jurisdiction: "National",
          startDate: new Date("2019-06-30"),
          endDate: null,
          isCurrent: true,
        },
      ],
    } as any);

    // Mock family relationships
    vi.mocked(prisma.familyRelationship.findMany)
      .mockResolvedValueOnce([
        {
          id: "rel-1",
          politicianId: "pol-1",
          relatedPoliticianId: "pol-2",
          relationshipType: "spouse" as RelationshipType,
          Politician_FamilyRelationship_relatedPoliticianIdToPolitician: {
            id: "pol-2",
            fullName: "Maria Santos",
            photo: null,
            Position: [
              {
                id: "pos-2",
                title: "Congresswoman",
                level: "national" as GovernmentLevel,
                jurisdiction: "District 1",
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

    const result = await getFamilyNetwork("pol-1");

    expect(result).not.toBeNull();
    expect(result!.politicianId).toBe("pol-1");
    expect(result!.politicianName).toBe("Juan Santos");
    expect(result!.familyMembers).toHaveLength(1);
    expect(result!.isDynasty).toBe(true);
    expect(result!.dynastySeverity).toBe("info");
    expect(result!.totalFamilyMembersInPolitics).toBe(1);
    expect(result!.concurrentPositions).toBeGreaterThan(0);
  });

  it("should indicate no dynasty when politician has no family in politics", async () => {
    vi.mocked(prisma.politician.findUnique).mockResolvedValue({
      id: "pol-1",
      fullName: "Juan Santos",
      Position: [],
    } as any);

    vi.mocked(prisma.familyRelationship.findMany)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await getFamilyNetwork("pol-1");

    expect(result).not.toBeNull();
    expect(result!.isDynasty).toBe(false);
    expect(result!.dynastySeverity).toBe("none");
    expect(result!.totalFamilyMembersInPolitics).toBe(0);
  });
});

describe("isPoliticalDynasty", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return true when politician has family members with positions", async () => {
    vi.mocked(prisma.familyRelationship.count).mockResolvedValue(2);

    const result = await isPoliticalDynasty("pol-1");

    expect(result).toBe(true);
  });

  it("should return false when politician has no family members with positions", async () => {
    vi.mocked(prisma.familyRelationship.count).mockResolvedValue(0);

    const result = await isPoliticalDynasty("pol-1");

    expect(result).toBe(false);
  });
});
