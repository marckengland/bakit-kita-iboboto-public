/**
 * Term Limit Service Tests
 *
 * Unit tests for term limit tracking, consecutive/non-consecutive term counting,
 * term-hopping detection, and term limit status calculation.
 *
 * Requirements: 46.1, 46.2, 46.3, 46.4, 46.5, 46.6
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { GovernmentLevel } from "@prisma/client";

// Mock Prisma before importing the service
vi.mock("@/lib/prisma", () => ({
  default: {
    politician: {
      findUnique: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import {
  getTermLimitRule,
  calculateTotalYearsInOffice,
  formatYearsRange,
  countConsecutiveTerms,
  detectTermHopping,
  groupPositionsByTypeAndJurisdiction,
  calculateTermLimitStatus,
  getTermLimitStatus,
  isEligibleForReelection,
  isInFinalTerm,
  getPositionsWhereReachedLimit,
  hasTermHopping,
  getTermLimitRules,
  TERM_LIMIT_RULES,
  TermDetail,
  TermHistory,
} from "./term-limit.service";

// ============================================
// Helper Functions
// ============================================

function createPosition(
  id: string,
  title: string,
  level: GovernmentLevel,
  jurisdiction: string,
  startDate: string,
  endDate: string | null,
  termNumber: number,
  isConsecutive: boolean,
  isCurrent: boolean
) {
  return {
    id,
    title,
    level,
    jurisdiction,
    startDate: new Date(startDate),
    endDate: endDate ? new Date(endDate) : null,
    termNumber,
    isConsecutive,
    isCurrent,
  };
}

// ============================================
// Term Limit Rules Tests
// ============================================

describe("getTermLimitRule", () => {
  it("should return correct rule for President", () => {
    const rule = getTermLimitRule("President");
    expect(rule).not.toBeNull();
    expect(rule!.maxConsecutiveTerms).toBe(1);
    expect(rule!.termLengthYears).toBe(6);
    expect(rule!.allowsReelection).toBe(false);
  });

  it("should return correct rule for Vice President", () => {
    const rule = getTermLimitRule("Vice President");
    expect(rule).not.toBeNull();
    expect(rule!.maxConsecutiveTerms).toBe(2);
    expect(rule!.termLengthYears).toBe(6);
    expect(rule!.allowsReelection).toBe(true);
  });

  it("should return correct rule for Senator", () => {
    const rule = getTermLimitRule("Senator");
    expect(rule).not.toBeNull();
    expect(rule!.maxConsecutiveTerms).toBe(2);
    expect(rule!.termLengthYears).toBe(6);
    expect(rule!.allowsReelection).toBe(true);
  });

  it("should return correct rule for Congressman", () => {
    const rule = getTermLimitRule("Congressman");
    expect(rule).not.toBeNull();
    expect(rule!.maxConsecutiveTerms).toBe(3);
    expect(rule!.termLengthYears).toBe(3);
    expect(rule!.allowsReelection).toBe(true);
  });

  it("should return correct rule for Governor", () => {
    const rule = getTermLimitRule("Governor");
    expect(rule).not.toBeNull();
    expect(rule!.maxConsecutiveTerms).toBe(3);
    expect(rule!.termLengthYears).toBe(3);
  });

  it("should return correct rule for Mayor", () => {
    const rule = getTermLimitRule("Mayor");
    expect(rule).not.toBeNull();
    expect(rule!.maxConsecutiveTerms).toBe(3);
    expect(rule!.termLengthYears).toBe(3);
  });

  it("should return correct rule for Barangay Captain", () => {
    const rule = getTermLimitRule("Barangay Captain");
    expect(rule).not.toBeNull();
    expect(rule!.maxConsecutiveTerms).toBe(3);
    expect(rule!.termLengthYears).toBe(3);
  });

  it("should handle case-insensitive matching", () => {
    const rule = getTermLimitRule("SENATOR");
    expect(rule).not.toBeNull();
    expect(rule!.positionType).toBe("Senator");
  });

  it("should handle variations like Congresswoman", () => {
    const rule = getTermLimitRule("Congresswoman");
    expect(rule).not.toBeNull();
    expect(rule!.maxConsecutiveTerms).toBe(3);
  });

  it("should handle variations like City Mayor", () => {
    const rule = getTermLimitRule("City Mayor");
    expect(rule).not.toBeNull();
    expect(rule!.maxConsecutiveTerms).toBe(3);
  });

  it("should handle Punong Barangay as Barangay Captain", () => {
    const rule = getTermLimitRule("Punong Barangay");
    expect(rule).not.toBeNull();
    expect(rule!.maxConsecutiveTerms).toBe(3);
  });

  it("should return null for unknown position", () => {
    const rule = getTermLimitRule("Unknown Position");
    expect(rule).toBeNull();
  });
});

// ============================================
// Calculation Helper Tests
// ============================================

describe("calculateTotalYearsInOffice", () => {
  it("should calculate total years from multiple positions", () => {
    const positions = [
      { startDate: new Date("2010-06-30"), endDate: new Date("2013-06-29") }, // ~3 years
      { startDate: new Date("2013-06-30"), endDate: new Date("2016-06-29") }, // ~3 years
    ];

    const years = calculateTotalYearsInOffice(positions);
    expect(years).toBe(6);
  });

  it("should handle current positions (null end date)", () => {
    const now = new Date();
    const threeYearsAgo = new Date(now);
    threeYearsAgo.setFullYear(now.getFullYear() - 3);

    const positions = [{ startDate: threeYearsAgo, endDate: null }];

    const years = calculateTotalYearsInOffice(positions);
    expect(years).toBe(3);
  });

  it("should return 0 for empty positions array", () => {
    const years = calculateTotalYearsInOffice([]);
    expect(years).toBe(0);
  });

  it("should handle single short term", () => {
    const positions = [{ startDate: new Date("2022-06-30"), endDate: new Date("2023-06-29") }];

    const years = calculateTotalYearsInOffice(positions);
    expect(years).toBe(1);
  });
});

describe("formatYearsRange", () => {
  it("should format single term", () => {
    const terms: TermDetail[] = [
      {
        termNumber: 1,
        startDate: new Date("2019-06-30"),
        endDate: new Date("2022-06-29"),
        isConsecutive: true,
        isCurrent: false,
      },
    ];

    const result = formatYearsRange(terms);
    expect(result).toBe("2019-2022");
  });

  it("should format multiple terms", () => {
    const terms: TermDetail[] = [
      {
        termNumber: 1,
        startDate: new Date("2016-06-30"),
        endDate: new Date("2019-06-29"),
        isConsecutive: true,
        isCurrent: false,
      },
      {
        termNumber: 2,
        startDate: new Date("2019-06-30"),
        endDate: new Date("2022-06-29"),
        isConsecutive: true,
        isCurrent: false,
      },
    ];

    const result = formatYearsRange(terms);
    expect(result).toBe("2016-2019, 2019-2022");
  });

  it("should handle current term (null end date)", () => {
    const terms: TermDetail[] = [
      {
        termNumber: 1,
        startDate: new Date("2022-06-30"),
        endDate: null,
        isConsecutive: true,
        isCurrent: true,
      },
    ];

    const result = formatYearsRange(terms);
    expect(result).toBe("2022-present");
  });

  it("should return empty string for empty array", () => {
    const result = formatYearsRange([]);
    expect(result).toBe("");
  });
});

describe("countConsecutiveTerms", () => {
  it("should count consecutive terms correctly", () => {
    const terms = [
      { termNumber: 1, isConsecutive: true, isCurrent: false },
      { termNumber: 2, isConsecutive: true, isCurrent: false },
      { termNumber: 3, isConsecutive: true, isCurrent: true },
    ];

    const count = countConsecutiveTerms(terms);
    expect(count).toBe(3);
  });

  it("should stop counting at non-consecutive term", () => {
    const terms = [
      { termNumber: 1, isConsecutive: true, isCurrent: false },
      { termNumber: 2, isConsecutive: false, isCurrent: false }, // Gap
      { termNumber: 3, isConsecutive: true, isCurrent: true },
    ];

    const count = countConsecutiveTerms(terms);
    // Should count from most recent backwards: term 3 is consecutive, term 2 breaks the chain
    expect(count).toBe(1);
  });

  it("should return 0 for empty array", () => {
    const count = countConsecutiveTerms([]);
    expect(count).toBe(0);
  });

  it("should count first term as consecutive", () => {
    const terms = [{ termNumber: 1, isConsecutive: false, isCurrent: true }];

    const count = countConsecutiveTerms(terms);
    expect(count).toBe(1);
  });
});

// ============================================
// Term-Hopping Detection Tests
// ============================================

describe("detectTermHopping", () => {
  it("should detect term-hopping when politician reached limit then switched", () => {
    const positionHistory: TermHistory[] = [
      {
        position: "Mayor",
        level: "municipal",
        jurisdiction: "Makati City",
        consecutiveTermsServed: 3,
        totalTermsServed: 3,
        maxTerms: 3,
        termLengthYears: 3,
        reachedLimit: true,
        years: "2010-2019",
        terms: [
          {
            termNumber: 1,
            startDate: new Date("2010-06-30"),
            endDate: new Date("2013-06-29"),
            isConsecutive: true,
            isCurrent: false,
          },
          {
            termNumber: 2,
            startDate: new Date("2013-06-30"),
            endDate: new Date("2016-06-29"),
            isConsecutive: true,
            isCurrent: false,
          },
          {
            termNumber: 3,
            startDate: new Date("2016-06-30"),
            endDate: new Date("2019-06-29"),
            isConsecutive: true,
            isCurrent: false,
          },
        ],
      },
      {
        position: "Congressman",
        level: "national",
        jurisdiction: "District 1",
        consecutiveTermsServed: 1,
        totalTermsServed: 1,
        maxTerms: 3,
        termLengthYears: 3,
        reachedLimit: false,
        years: "2019-present",
        terms: [
          {
            termNumber: 1,
            startDate: new Date("2019-06-30"),
            endDate: null,
            isConsecutive: true,
            isCurrent: true,
          },
        ],
      },
    ];

    const result = detectTermHopping(positionHistory);

    expect(result.detected).toBe(true);
    expect(result.patterns.length).toBe(1);
    expect(result.patterns[0]!.fromPosition).toBe("Mayor");
    expect(result.patterns[0]!.toPosition).toBe("Congressman");
    expect(result.patterns[0]!.reachedLimitInPreviousPosition).toBe(true);
  });

  it("should not detect term-hopping when limit not reached", () => {
    const positionHistory: TermHistory[] = [
      {
        position: "Mayor",
        level: "municipal",
        jurisdiction: "Makati City",
        consecutiveTermsServed: 2,
        totalTermsServed: 2,
        maxTerms: 3,
        termLengthYears: 3,
        reachedLimit: false,
        years: "2013-2019",
        terms: [
          {
            termNumber: 1,
            startDate: new Date("2013-06-30"),
            endDate: new Date("2016-06-29"),
            isConsecutive: true,
            isCurrent: false,
          },
          {
            termNumber: 2,
            startDate: new Date("2016-06-30"),
            endDate: new Date("2019-06-29"),
            isConsecutive: true,
            isCurrent: false,
          },
        ],
      },
      {
        position: "Congressman",
        level: "national",
        jurisdiction: "District 1",
        consecutiveTermsServed: 1,
        totalTermsServed: 1,
        maxTerms: 3,
        termLengthYears: 3,
        reachedLimit: false,
        years: "2019-present",
        terms: [
          {
            termNumber: 1,
            startDate: new Date("2019-06-30"),
            endDate: null,
            isConsecutive: true,
            isCurrent: true,
          },
        ],
      },
    ];

    const result = detectTermHopping(positionHistory);

    expect(result.detected).toBe(false);
    expect(result.patterns.length).toBe(0);
  });

  it("should return empty patterns for single position", () => {
    const positionHistory: TermHistory[] = [
      {
        position: "Senator",
        level: "national",
        jurisdiction: "National",
        consecutiveTermsServed: 1,
        totalTermsServed: 1,
        maxTerms: 2,
        termLengthYears: 6,
        reachedLimit: false,
        years: "2019-present",
        terms: [
          {
            termNumber: 1,
            startDate: new Date("2019-06-30"),
            endDate: null,
            isConsecutive: true,
            isCurrent: true,
          },
        ],
      },
    ];

    const result = detectTermHopping(positionHistory);

    expect(result.detected).toBe(false);
    expect(result.patterns.length).toBe(0);
  });

  it("should handle empty position history", () => {
    const result = detectTermHopping([]);

    expect(result.detected).toBe(false);
    expect(result.patterns.length).toBe(0);
  });
});

// ============================================
// Position Grouping Tests
// ============================================

describe("groupPositionsByTypeAndJurisdiction", () => {
  it("should group positions by title and jurisdiction", () => {
    const positions = [
      createPosition(
        "1",
        "Mayor",
        "municipal",
        "Makati City",
        "2016-06-30",
        "2019-06-29",
        1,
        true,
        false
      ),
      createPosition(
        "2",
        "Mayor",
        "municipal",
        "Makati City",
        "2019-06-30",
        "2022-06-29",
        2,
        true,
        false
      ),
      createPosition(
        "3",
        "Congressman",
        "national",
        "District 1",
        "2022-06-30",
        null,
        1,
        true,
        true
      ),
    ];

    const grouped = groupPositionsByTypeAndJurisdiction(positions);

    expect(grouped.size).toBe(2);
    expect(grouped.get("mayor|makati city")?.length).toBe(2);
    expect(grouped.get("congressman|district 1")?.length).toBe(1);
  });

  it("should handle case-insensitive grouping", () => {
    const positions = [
      createPosition(
        "1",
        "MAYOR",
        "municipal",
        "Makati City",
        "2016-06-30",
        "2019-06-29",
        1,
        true,
        false
      ),
      createPosition(
        "2",
        "mayor",
        "municipal",
        "MAKATI CITY",
        "2019-06-30",
        "2022-06-29",
        2,
        true,
        false
      ),
    ];

    const grouped = groupPositionsByTypeAndJurisdiction(positions);

    expect(grouped.size).toBe(1);
    expect(grouped.get("mayor|makati city")?.length).toBe(2);
  });

  it("should return empty map for empty positions", () => {
    const grouped = groupPositionsByTypeAndJurisdiction([]);
    expect(grouped.size).toBe(0);
  });
});

// ============================================
// Term Limit Status Calculation Tests
// ============================================

describe("calculateTermLimitStatus", () => {
  it("should calculate status for politician with single current position", () => {
    const positions = [
      createPosition("1", "Senator", "national", "National", "2019-06-30", null, 1, true, true),
    ];

    const status = calculateTermLimitStatus("pol-1", positions);

    expect(status.politicianId).toBe("pol-1");
    expect(status.currentPosition).not.toBeNull();
    expect(status.currentPosition!.position).toBe("Senator");
    expect(status.currentPosition!.termNumber).toBe(1);
    expect(status.currentPosition!.maxTerms).toBe(2);
    expect(status.currentPosition!.termsRemaining).toBe(1);
    expect(status.currentPosition!.isFinalTerm).toBe(false);
    expect(status.currentPosition!.eligibleForReelection).toBe(true);
  });

  it("should indicate final term when at max terms", () => {
    const positions = [
      createPosition(
        "1",
        "Senator",
        "national",
        "National",
        "2013-06-30",
        "2019-06-29",
        1,
        true,
        false
      ),
      createPosition("2", "Senator", "national", "National", "2019-06-30", null, 2, true, true),
    ];

    const status = calculateTermLimitStatus("pol-1", positions);

    expect(status.currentPosition!.termNumber).toBe(2);
    expect(status.currentPosition!.maxTerms).toBe(2);
    expect(status.currentPosition!.termsRemaining).toBe(0);
    expect(status.currentPosition!.isFinalTerm).toBe(true);
    expect(status.currentPosition!.eligibleForReelection).toBe(false);
  });

  it("should handle President with no re-election allowed", () => {
    const positions = [
      createPosition("1", "President", "national", "National", "2022-06-30", null, 1, true, true),
    ];

    const status = calculateTermLimitStatus("pol-1", positions);

    expect(status.currentPosition!.position).toBe("President");
    expect(status.currentPosition!.maxTerms).toBe(1);
    expect(status.currentPosition!.isFinalTerm).toBe(true);
    expect(status.currentPosition!.eligibleForReelection).toBe(false);
  });

  it("should track positions where limit was reached", () => {
    const positions = [
      createPosition(
        "1",
        "Mayor",
        "municipal",
        "Makati City",
        "2010-06-30",
        "2013-06-29",
        1,
        true,
        false
      ),
      createPosition(
        "2",
        "Mayor",
        "municipal",
        "Makati City",
        "2013-06-30",
        "2016-06-29",
        2,
        true,
        false
      ),
      createPosition(
        "3",
        "Mayor",
        "municipal",
        "Makati City",
        "2016-06-30",
        "2019-06-29",
        3,
        true,
        false
      ),
      createPosition(
        "4",
        "Congressman",
        "national",
        "District 1",
        "2019-06-30",
        null,
        1,
        true,
        true
      ),
    ];

    const status = calculateTermLimitStatus("pol-1", positions);

    expect(status.positionsWhereReachedLimit.length).toBe(1);
    expect(status.positionsWhereReachedLimit[0]).toContain("Mayor");
    expect(status.positionsWhereReachedLimit[0]).toContain("Makati City");
  });

  it("should detect term-hopping patterns", () => {
    const positions = [
      createPosition(
        "1",
        "Mayor",
        "municipal",
        "Makati City",
        "2010-06-30",
        "2013-06-29",
        1,
        true,
        false
      ),
      createPosition(
        "2",
        "Mayor",
        "municipal",
        "Makati City",
        "2013-06-30",
        "2016-06-29",
        2,
        true,
        false
      ),
      createPosition(
        "3",
        "Mayor",
        "municipal",
        "Makati City",
        "2016-06-30",
        "2019-06-29",
        3,
        true,
        false
      ),
      createPosition(
        "4",
        "Congressman",
        "national",
        "District 1",
        "2019-06-30",
        null,
        1,
        true,
        true
      ),
    ];

    const status = calculateTermLimitStatus("pol-1", positions);

    expect(status.termHoppingDetected).toBe(true);
    expect(status.termHoppingPatterns.length).toBe(1);
  });

  it("should calculate total years in office", () => {
    const positions = [
      createPosition(
        "1",
        "Mayor",
        "municipal",
        "Makati City",
        "2016-06-30",
        "2019-06-29",
        1,
        true,
        false
      ),
      createPosition(
        "2",
        "Mayor",
        "municipal",
        "Makati City",
        "2019-06-30",
        "2022-06-29",
        2,
        true,
        false
      ),
    ];

    const status = calculateTermLimitStatus("pol-1", positions);

    expect(status.totalYearsInOffice).toBe(6);
  });

  it("should handle politician with no current position", () => {
    const positions = [
      createPosition(
        "1",
        "Mayor",
        "municipal",
        "Makati City",
        "2016-06-30",
        "2019-06-29",
        1,
        true,
        false
      ),
    ];

    const status = calculateTermLimitStatus("pol-1", positions);

    expect(status.currentPosition).toBeNull();
    expect(status.positionHistory.length).toBe(1);
  });

  it("should handle empty positions array", () => {
    const status = calculateTermLimitStatus("pol-1", []);

    expect(status.currentPosition).toBeNull();
    expect(status.positionHistory.length).toBe(0);
    expect(status.totalYearsInOffice).toBe(0);
    expect(status.termHoppingDetected).toBe(false);
  });
});

// ============================================
// Database-Dependent Function Tests
// ============================================

describe("getTermLimitStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return null for non-existent politician", async () => {
    vi.mocked(prisma.politician.findUnique).mockResolvedValue(null);

    const result = await getTermLimitStatus("non-existent");

    expect(result).toBeNull();
  });

  it("should return complete term limit status for politician", async () => {
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
          termNumber: 1,
          isConsecutive: true,
          isCurrent: true,
        },
      ],
    } as any);

    const result = await getTermLimitStatus("pol-1");

    expect(result).not.toBeNull();
    expect(result!.politicianId).toBe("pol-1");
    expect(result!.currentPosition).not.toBeNull();
    expect(result!.currentPosition!.position).toBe("Senator");
  });
});

describe("isEligibleForReelection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return true when politician is eligible", async () => {
    vi.mocked(prisma.politician.findUnique).mockResolvedValue({
      id: "pol-1",
      Position: [
        {
          id: "pos-1",
          title: "Senator",
          level: "national" as GovernmentLevel,
          jurisdiction: "National",
          startDate: new Date("2019-06-30"),
          endDate: null,
          termNumber: 1,
          isConsecutive: true,
          isCurrent: true,
        },
      ],
    } as any);

    const result = await isEligibleForReelection("pol-1");

    expect(result).toBe(true);
  });

  it("should return false when politician is in final term", async () => {
    vi.mocked(prisma.politician.findUnique).mockResolvedValue({
      id: "pol-1",
      Position: [
        {
          id: "pos-1",
          title: "Senator",
          level: "national" as GovernmentLevel,
          jurisdiction: "National",
          startDate: new Date("2013-06-30"),
          endDate: new Date("2019-06-29"),
          termNumber: 1,
          isConsecutive: true,
          isCurrent: false,
        },
        {
          id: "pos-2",
          title: "Senator",
          level: "national" as GovernmentLevel,
          jurisdiction: "National",
          startDate: new Date("2019-06-30"),
          endDate: null,
          termNumber: 2,
          isConsecutive: true,
          isCurrent: true,
        },
      ],
    } as any);

    const result = await isEligibleForReelection("pol-1");

    expect(result).toBe(false);
  });

  it("should return false for non-existent politician", async () => {
    vi.mocked(prisma.politician.findUnique).mockResolvedValue(null);

    const result = await isEligibleForReelection("non-existent");

    expect(result).toBe(false);
  });
});

describe("isInFinalTerm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return true when politician is in final term", async () => {
    vi.mocked(prisma.politician.findUnique).mockResolvedValue({
      id: "pol-1",
      Position: [
        {
          id: "pos-1",
          title: "President",
          level: "national" as GovernmentLevel,
          jurisdiction: "National",
          startDate: new Date("2022-06-30"),
          endDate: null,
          termNumber: 1,
          isConsecutive: true,
          isCurrent: true,
        },
      ],
    } as any);

    const result = await isInFinalTerm("pol-1");

    expect(result).toBe(true);
  });

  it("should return false when politician is not in final term", async () => {
    vi.mocked(prisma.politician.findUnique).mockResolvedValue({
      id: "pol-1",
      Position: [
        {
          id: "pos-1",
          title: "Mayor",
          level: "municipal" as GovernmentLevel,
          jurisdiction: "Makati City",
          startDate: new Date("2022-06-30"),
          endDate: null,
          termNumber: 1,
          isConsecutive: true,
          isCurrent: true,
        },
      ],
    } as any);

    const result = await isInFinalTerm("pol-1");

    expect(result).toBe(false);
  });
});

describe("getPositionsWhereReachedLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return positions where limit was reached", async () => {
    vi.mocked(prisma.politician.findUnique).mockResolvedValue({
      id: "pol-1",
      Position: [
        {
          id: "pos-1",
          title: "Mayor",
          level: "municipal" as GovernmentLevel,
          jurisdiction: "Makati City",
          startDate: new Date("2010-06-30"),
          endDate: new Date("2013-06-29"),
          termNumber: 1,
          isConsecutive: true,
          isCurrent: false,
        },
        {
          id: "pos-2",
          title: "Mayor",
          level: "municipal" as GovernmentLevel,
          jurisdiction: "Makati City",
          startDate: new Date("2013-06-30"),
          endDate: new Date("2016-06-29"),
          termNumber: 2,
          isConsecutive: true,
          isCurrent: false,
        },
        {
          id: "pos-3",
          title: "Mayor",
          level: "municipal" as GovernmentLevel,
          jurisdiction: "Makati City",
          startDate: new Date("2016-06-30"),
          endDate: new Date("2019-06-29"),
          termNumber: 3,
          isConsecutive: true,
          isCurrent: false,
        },
      ],
    } as any);

    const result = await getPositionsWhereReachedLimit("pol-1");

    expect(result.length).toBe(1);
    expect(result[0]).toContain("Mayor");
  });

  it("should return empty array when no limits reached", async () => {
    vi.mocked(prisma.politician.findUnique).mockResolvedValue({
      id: "pol-1",
      Position: [
        {
          id: "pos-1",
          title: "Senator",
          level: "national" as GovernmentLevel,
          jurisdiction: "National",
          startDate: new Date("2019-06-30"),
          endDate: null,
          termNumber: 1,
          isConsecutive: true,
          isCurrent: true,
        },
      ],
    } as any);

    const result = await getPositionsWhereReachedLimit("pol-1");

    expect(result.length).toBe(0);
  });
});

describe("hasTermHopping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return true when term-hopping is detected", async () => {
    vi.mocked(prisma.politician.findUnique).mockResolvedValue({
      id: "pol-1",
      Position: [
        {
          id: "pos-1",
          title: "Mayor",
          level: "municipal" as GovernmentLevel,
          jurisdiction: "Makati City",
          startDate: new Date("2010-06-30"),
          endDate: new Date("2013-06-29"),
          termNumber: 1,
          isConsecutive: true,
          isCurrent: false,
        },
        {
          id: "pos-2",
          title: "Mayor",
          level: "municipal" as GovernmentLevel,
          jurisdiction: "Makati City",
          startDate: new Date("2013-06-30"),
          endDate: new Date("2016-06-29"),
          termNumber: 2,
          isConsecutive: true,
          isCurrent: false,
        },
        {
          id: "pos-3",
          title: "Mayor",
          level: "municipal" as GovernmentLevel,
          jurisdiction: "Makati City",
          startDate: new Date("2016-06-30"),
          endDate: new Date("2019-06-29"),
          termNumber: 3,
          isConsecutive: true,
          isCurrent: false,
        },
        {
          id: "pos-4",
          title: "Congressman",
          level: "national" as GovernmentLevel,
          jurisdiction: "District 1",
          startDate: new Date("2019-06-30"),
          endDate: null,
          termNumber: 1,
          isConsecutive: true,
          isCurrent: true,
        },
      ],
    } as any);

    const result = await hasTermHopping("pol-1");

    expect(result).toBe(true);
  });

  it("should return false when no term-hopping", async () => {
    vi.mocked(prisma.politician.findUnique).mockResolvedValue({
      id: "pol-1",
      Position: [
        {
          id: "pos-1",
          title: "Senator",
          level: "national" as GovernmentLevel,
          jurisdiction: "National",
          startDate: new Date("2019-06-30"),
          endDate: null,
          termNumber: 1,
          isConsecutive: true,
          isCurrent: true,
        },
      ],
    } as any);

    const result = await hasTermHopping("pol-1");

    expect(result).toBe(false);
  });
});

describe("getTermLimitRules", () => {
  it("should return all term limit rules", () => {
    const rules = getTermLimitRules();

    expect(rules.length).toBeGreaterThan(0);
    expect(rules).toEqual(TERM_LIMIT_RULES);
  });

  it("should return a copy of the rules array", () => {
    const rules = getTermLimitRules();

    // Modifying the returned array should not affect the original
    rules.push({
      positionType: "Test",
      maxConsecutiveTerms: 1,
      termLengthYears: 1,
      allowsReelection: false,
      level: "national",
    });

    expect(TERM_LIMIT_RULES.find((r) => r.positionType === "Test")).toBeUndefined();
  });
});
