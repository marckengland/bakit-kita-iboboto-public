/**
 * Property-Based Tests for Term Limit Calculation
 *
 * **Validates: Requirements 46.1, 46.2, 46.3, 46.4, 46.5, 46.6**
 *
 * Property 11: Term Limit Calculation
 * For any politician with position history:
 * - Term count must accurately reflect the number of terms served in each position
 * - Term limit status must be calculated based on constitutional limits:
 *   - President: 1 term (6 years)
 *   - Senator: 2 consecutive terms
 *   - Congressman/Governor/Mayor: 3 consecutive terms
 * - isFinalTerm must be true when termNumber equals maxTerms
 * - Consecutive vs non-consecutive terms must be tracked separately
 * - Term-hopping detection must flag politicians who reached limits in other positions
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
import { GovernmentLevel } from "@prisma/client";

// Mock Prisma before importing the service
vi.mock("@/lib/prisma", () => ({
  default: {
    politician: {
      findUnique: vi.fn(),
    },
  },
}));

import {
  getTermLimitRule,
  calculateTotalYearsInOffice,
  countConsecutiveTerms,
  detectTermHopping,
  groupPositionsByTypeAndJurisdiction,
  calculateTermLimitStatus,
  formatYearsRange,
  TERM_LIMIT_RULES,
  type PositionData,
  type TermHistory,
  type TermDetail,
} from "./term-limit.service";

// Minimum iterations for property tests
const NUM_RUNS = 100;

// ============================================
// Arbitraries (Generators) for Test Data
// ============================================

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
 * Generate a valid position title with known term limits
 */
const positionTitleArb = fc.constantFrom(
  "President",
  "Vice President",
  "Senator",
  "Congressman",
  "Congresswoman",
  "Representative",
  "Governor",
  "Vice Governor",
  "Mayor",
  "Vice Mayor",
  "City Mayor",
  "City Vice Mayor",
  "Councilor",
  "Barangay Captain",
  "Punong Barangay"
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
  "District 2",
  "Barangay San Antonio"
);

/**
 * Generate a date within a reasonable political career range
 */
const politicalDateArb = fc.date({
  min: new Date("1990-01-01"),
  max: new Date("2030-12-31"),
});

/**
 * Generate a term number (1-5)
 */
const termNumberArb = fc.integer({ min: 1, max: 5 });

/**
 * Generate a position data object
 */
const positionDataArb = fc
  .record({
    id: fc.uuid(),
    title: positionTitleArb,
    level: governmentLevelArb,
    jurisdiction: jurisdictionArb,
    startDate: politicalDateArb,
    termNumber: termNumberArb,
    isConsecutive: fc.boolean(),
    isCurrent: fc.boolean(),
  })
  .chain((pos) => {
    // Generate end date that's after start date or null for current positions
    const endDateArb = pos.isCurrent
      ? fc.constant(null)
      : fc.date({
          min: new Date(pos.startDate.getTime() + 365 * 24 * 60 * 60 * 1000), // At least 1 year after start
          max: new Date(pos.startDate.getTime() + 6 * 365 * 24 * 60 * 60 * 1000), // Up to 6 years after start
        });

    return endDateArb.map((endDate) => ({
      ...pos,
      endDate,
    }));
  }) as fc.Arbitrary<PositionData>;

/**
 * Generate a list of positions for a politician
 */
const positionsListArb = fc.array(positionDataArb, { minLength: 0, maxLength: 10 });

// ============================================
// Property Tests
// ============================================

describe("Term Limit Calculation - Property 11", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * **Validates: Requirements 46.2, 46.6**
   *
   * Property 11.1: Term Limit Rules Correctness
   * Term limit rules must be correctly defined for each position type
   * according to Philippine constitutional limits.
   */
  describe("Property 11.1: Term Limit Rules Correctness", () => {
    it("President should have 1 term limit with no re-election", () => {
      fc.assert(
        fc.property(fc.constant("President"), (positionType) => {
          const rule = getTermLimitRule(positionType);
          expect(rule).not.toBeNull();
          expect(rule!.maxConsecutiveTerms).toBe(1);
          expect(rule!.termLengthYears).toBe(6);
          expect(rule!.allowsReelection).toBe(false);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("Vice President should have 2 consecutive term limit", () => {
      fc.assert(
        fc.property(fc.constant("Vice President"), (positionType) => {
          const rule = getTermLimitRule(positionType);
          expect(rule).not.toBeNull();
          expect(rule!.maxConsecutiveTerms).toBe(2);
          expect(rule!.termLengthYears).toBe(6);
          expect(rule!.allowsReelection).toBe(true);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("Senator should have 2 consecutive term limit", () => {
      fc.assert(
        fc.property(fc.constant("Senator"), (positionType) => {
          const rule = getTermLimitRule(positionType);
          expect(rule).not.toBeNull();
          expect(rule!.maxConsecutiveTerms).toBe(2);
          expect(rule!.termLengthYears).toBe(6);
          expect(rule!.allowsReelection).toBe(true);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("Congressman/Representative should have 3 consecutive term limit", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("Congressman", "Congresswoman", "Representative"),
          (positionType) => {
            const rule = getTermLimitRule(positionType);
            expect(rule).not.toBeNull();
            expect(rule!.maxConsecutiveTerms).toBe(3);
            expect(rule!.termLengthYears).toBe(3);
            expect(rule!.allowsReelection).toBe(true);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("Governor should have 3 consecutive term limit", () => {
      fc.assert(
        fc.property(fc.constant("Governor"), (positionType) => {
          const rule = getTermLimitRule(positionType);
          expect(rule).not.toBeNull();
          expect(rule!.maxConsecutiveTerms).toBe(3);
          expect(rule!.termLengthYears).toBe(3);
          expect(rule!.allowsReelection).toBe(true);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("Mayor should have 3 consecutive term limit", () => {
      fc.assert(
        fc.property(fc.constantFrom("Mayor", "City Mayor"), (positionType) => {
          const rule = getTermLimitRule(positionType);
          expect(rule).not.toBeNull();
          expect(rule!.maxConsecutiveTerms).toBe(3);
          expect(rule!.termLengthYears).toBe(3);
          expect(rule!.allowsReelection).toBe(true);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("Barangay Captain should have 3 consecutive term limit", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("Barangay Captain", "Punong Barangay", "Barangay Chairman"),
          (positionType) => {
            const rule = getTermLimitRule(positionType);
            expect(rule).not.toBeNull();
            expect(rule!.maxConsecutiveTerms).toBe(3);
            expect(rule!.termLengthYears).toBe(3);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("all defined rules should have positive term limits", () => {
      fc.assert(
        fc.property(fc.constantFrom(...TERM_LIMIT_RULES), (rule) => {
          expect(rule.maxConsecutiveTerms).toBeGreaterThan(0);
          expect(rule.termLengthYears).toBeGreaterThan(0);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("term limit rule lookup should be deterministic", () => {
      fc.assert(
        fc.property(positionTitleArb, (positionType) => {
          const rule1 = getTermLimitRule(positionType);
          const rule2 = getTermLimitRule(positionType);
          const rule3 = getTermLimitRule(positionType);

          expect(rule1).toEqual(rule2);
          expect(rule2).toEqual(rule3);
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 46.4**
   *
   * Property 11.2: Consecutive Term Counting Accuracy
   * Consecutive term counting must accurately track the number of
   * consecutive terms served from the most recent term backwards.
   */
  describe("Property 11.2: Consecutive Term Counting Accuracy", () => {
    it("all consecutive terms should be counted correctly", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 5 }), (numTerms) => {
          // Create all consecutive terms
          const terms = Array.from({ length: numTerms }, (_, i) => ({
            termNumber: i + 1,
            isConsecutive: true,
            isCurrent: i === numTerms - 1,
          }));

          const count = countConsecutiveTerms(terms);
          expect(count).toBe(numTerms);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("non-consecutive term should break the count", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 5 }),
          fc.integer({ min: 1, max: 4 }),
          (totalTerms, breakPoint) => {
            // Ensure breakPoint is valid
            const validBreakPoint = Math.min(breakPoint, totalTerms - 1);

            // Create terms with a break at breakPoint
            const terms = Array.from({ length: totalTerms }, (_, i) => ({
              termNumber: i + 1,
              isConsecutive: i !== validBreakPoint,
              isCurrent: i === totalTerms - 1,
            }));

            const count = countConsecutiveTerms(terms);

            // Count should be terms after the break (from most recent backwards)
            const expectedCount = totalTerms - validBreakPoint - 1;
            expect(count).toBe(expectedCount);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("empty terms array should return 0", () => {
      fc.assert(
        fc.property(fc.constant([]), (terms) => {
          const count = countConsecutiveTerms(terms);
          expect(count).toBe(0);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("first term should always be counted as consecutive", () => {
      fc.assert(
        fc.property(fc.boolean(), (isConsecutive) => {
          const terms = [{ termNumber: 1, isConsecutive, isCurrent: true }];
          const count = countConsecutiveTerms(terms);
          expect(count).toBe(1);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("consecutive term count should be deterministic", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              termNumber: termNumberArb,
              isConsecutive: fc.boolean(),
              isCurrent: fc.boolean(),
            }),
            { minLength: 0, maxLength: 5 }
          ),
          (terms) => {
            const count1 = countConsecutiveTerms(terms);
            const count2 = countConsecutiveTerms(terms);
            const count3 = countConsecutiveTerms(terms);

            expect(count1).toBe(count2);
            expect(count2).toBe(count3);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 46.3**
   *
   * Property 11.3: Final Term Detection Accuracy
   * isFinalTerm must be true when termNumber equals maxTerms for the position.
   */
  describe("Property 11.3: Final Term Detection Accuracy", () => {
    it("politician at max terms should be in final term", () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.constantFrom(
            { title: "President", maxTerms: 1 },
            { title: "Senator", maxTerms: 2 },
            { title: "Congressman", maxTerms: 3 },
            { title: "Governor", maxTerms: 3 },
            { title: "Mayor", maxTerms: 3 }
          ),
          jurisdictionArb,
          (politicianId, positionInfo, jurisdiction) => {
            // Create positions up to max terms
            const positions: PositionData[] = Array.from(
              { length: positionInfo.maxTerms },
              (_, i) => ({
                id: `pos-${i + 1}`,
                title: positionInfo.title,
                level: "national" as GovernmentLevel,
                jurisdiction,
                startDate: new Date(2010 + i * 3, 5, 30),
                endDate: i === positionInfo.maxTerms - 1 ? null : new Date(2013 + i * 3, 5, 29),
                termNumber: i + 1,
                isConsecutive: true,
                isCurrent: i === positionInfo.maxTerms - 1,
              })
            );

            const status = calculateTermLimitStatus(politicianId, positions);

            expect(status.currentPosition).not.toBeNull();
            expect(status.currentPosition!.isFinalTerm).toBe(true);
            expect(status.currentPosition!.termsRemaining).toBe(0);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("politician below max terms should not be in final term", () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.constantFrom(
            { title: "Senator", maxTerms: 2, currentTerm: 1 },
            { title: "Congressman", maxTerms: 3, currentTerm: 1 },
            { title: "Congressman", maxTerms: 3, currentTerm: 2 },
            { title: "Governor", maxTerms: 3, currentTerm: 1 },
            { title: "Mayor", maxTerms: 3, currentTerm: 2 }
          ),
          jurisdictionArb,
          (politicianId, positionInfo, jurisdiction) => {
            // Create positions up to current term (below max)
            const positions: PositionData[] = Array.from(
              { length: positionInfo.currentTerm },
              (_, i) => ({
                id: `pos-${i + 1}`,
                title: positionInfo.title,
                level: "national" as GovernmentLevel,
                jurisdiction,
                startDate: new Date(2016 + i * 3, 5, 30),
                endDate: i === positionInfo.currentTerm - 1 ? null : new Date(2019 + i * 3, 5, 29),
                termNumber: i + 1,
                isConsecutive: true,
                isCurrent: i === positionInfo.currentTerm - 1,
              })
            );

            const status = calculateTermLimitStatus(politicianId, positions);

            expect(status.currentPosition).not.toBeNull();
            expect(status.currentPosition!.isFinalTerm).toBe(false);
            expect(status.currentPosition!.termsRemaining).toBeGreaterThan(0);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("President is always in final term (1 term limit)", () => {
      fc.assert(
        fc.property(fc.uuid(), (politicianId) => {
          const positions: PositionData[] = [
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
          ];

          const status = calculateTermLimitStatus(politicianId, positions);

          expect(status.currentPosition).not.toBeNull();
          expect(status.currentPosition!.isFinalTerm).toBe(true);
          expect(status.currentPosition!.eligibleForReelection).toBe(false);
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 46.3**
   *
   * Property 11.4: Re-election Eligibility Determination
   * Eligibility for re-election must be correctly determined based on
   * term limits and position rules.
   */
  describe("Property 11.4: Re-election Eligibility Determination", () => {
    it("politician not in final term should be eligible for re-election", () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.constantFrom("Senator", "Congressman", "Governor", "Mayor"),
          jurisdictionArb,
          (politicianId, title, jurisdiction) => {
            // First term - should be eligible
            const positions: PositionData[] = [
              {
                id: "pos-1",
                title,
                level: "national" as GovernmentLevel,
                jurisdiction,
                startDate: new Date("2022-06-30"),
                endDate: null,
                termNumber: 1,
                isConsecutive: true,
                isCurrent: true,
              },
            ];

            const status = calculateTermLimitStatus(politicianId, positions);

            expect(status.currentPosition).not.toBeNull();
            expect(status.currentPosition!.eligibleForReelection).toBe(true);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("politician in final term should not be eligible for re-election", () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.constantFrom(
            { title: "Senator", terms: 2 },
            { title: "Congressman", terms: 3 },
            { title: "Governor", terms: 3 },
            { title: "Mayor", terms: 3 }
          ),
          jurisdictionArb,
          (politicianId, positionInfo, jurisdiction) => {
            // Create positions at max terms
            const positions: PositionData[] = Array.from(
              { length: positionInfo.terms },
              (_, i) => ({
                id: `pos-${i + 1}`,
                title: positionInfo.title,
                level: "national" as GovernmentLevel,
                jurisdiction,
                startDate: new Date(2010 + i * 3, 5, 30),
                endDate: i === positionInfo.terms - 1 ? null : new Date(2013 + i * 3, 5, 29),
                termNumber: i + 1,
                isConsecutive: true,
                isCurrent: i === positionInfo.terms - 1,
              })
            );

            const status = calculateTermLimitStatus(politicianId, positions);

            expect(status.currentPosition).not.toBeNull();
            expect(status.currentPosition!.eligibleForReelection).toBe(false);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("President should never be eligible for re-election", () => {
      fc.assert(
        fc.property(fc.uuid(), (politicianId) => {
          const positions: PositionData[] = [
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
          ];

          const status = calculateTermLimitStatus(politicianId, positions);

          expect(status.currentPosition!.eligibleForReelection).toBe(false);
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 46.5**
   *
   * Property 11.5: Term-Hopping Detection Accuracy
   * Term-hopping must be detected when a politician reaches term limits
   * in one position and switches to another position.
   */
  describe("Property 11.5: Term-Hopping Detection Accuracy", () => {
    it("should detect term-hopping when limit reached then switched positions", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            { from: "Mayor", to: "Congressman", maxTerms: 3 },
            { from: "Governor", to: "Senator", maxTerms: 3 },
            { from: "Congressman", to: "Senator", maxTerms: 3 }
          ),
          (scenario) => {
            // Create position history where limit was reached then switched
            const positionHistory: TermHistory[] = [
              {
                position: scenario.from,
                level: "municipal" as GovernmentLevel,
                jurisdiction: "Makati City",
                consecutiveTermsServed: scenario.maxTerms,
                totalTermsServed: scenario.maxTerms,
                maxTerms: scenario.maxTerms,
                termLengthYears: 3,
                reachedLimit: true,
                years: "2010-2019",
                terms: Array.from({ length: scenario.maxTerms }, (_, i) => ({
                  termNumber: i + 1,
                  startDate: new Date(2010 + i * 3, 5, 30),
                  endDate: new Date(2013 + i * 3, 5, 29),
                  isConsecutive: true,
                  isCurrent: false,
                })),
              },
              {
                position: scenario.to,
                level: "national" as GovernmentLevel,
                jurisdiction: "District 1",
                consecutiveTermsServed: 1,
                totalTermsServed: 1,
                maxTerms: scenario.to === "Senator" ? 2 : 3,
                termLengthYears: scenario.to === "Senator" ? 6 : 3,
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
            expect(result.patterns.length).toBeGreaterThan(0);
            expect(result.patterns[0]!.fromPosition).toBe(scenario.from);
            expect(result.patterns[0]!.toPosition).toBe(scenario.to);
            expect(result.patterns[0]!.reachedLimitInPreviousPosition).toBe(true);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should not detect term-hopping when limit not reached", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("Mayor", "Governor", "Congressman"),
          fc.integer({ min: 1, max: 2 }),
          (fromPosition, termsServed) => {
            const positionHistory: TermHistory[] = [
              {
                position: fromPosition,
                level: "municipal" as GovernmentLevel,
                jurisdiction: "Makati City",
                consecutiveTermsServed: termsServed,
                totalTermsServed: termsServed,
                maxTerms: 3,
                termLengthYears: 3,
                reachedLimit: false, // Did not reach limit
                years: "2013-2019",
                terms: Array.from({ length: termsServed }, (_, i) => ({
                  termNumber: i + 1,
                  startDate: new Date(2013 + i * 3, 5, 30),
                  endDate: new Date(2016 + i * 3, 5, 29),
                  isConsecutive: true,
                  isCurrent: false,
                })),
              },
              {
                position: "Senator",
                level: "national" as GovernmentLevel,
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
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should return empty patterns for single position history", () => {
      fc.assert(
        fc.property(
          positionTitleArb,
          jurisdictionArb,
          fc.integer({ min: 1, max: 3 }),
          (title, jurisdiction, termsServed) => {
            const positionHistory: TermHistory[] = [
              {
                position: title,
                level: "national" as GovernmentLevel,
                jurisdiction,
                consecutiveTermsServed: termsServed,
                totalTermsServed: termsServed,
                maxTerms: 3,
                termLengthYears: 3,
                reachedLimit: termsServed >= 3,
                years: "2016-present",
                terms: Array.from({ length: termsServed }, (_, i) => ({
                  termNumber: i + 1,
                  startDate: new Date(2016 + i * 3, 5, 30),
                  endDate: i === termsServed - 1 ? null : new Date(2019 + i * 3, 5, 29),
                  isConsecutive: true,
                  isCurrent: i === termsServed - 1,
                })),
              },
            ];

            const result = detectTermHopping(positionHistory);

            expect(result.detected).toBe(false);
            expect(result.patterns.length).toBe(0);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should handle empty position history", () => {
      fc.assert(
        fc.property(fc.constant([]), (positionHistory: TermHistory[]) => {
          const result = detectTermHopping(positionHistory);

          expect(result.detected).toBe(false);
          expect(result.patterns.length).toBe(0);
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 46.1, 46.6**
   *
   * Property 11.6: Position History Tracking
   * Position history must accurately track all positions held and
   * indicate which positions reached term limits.
   */
  describe("Property 11.6: Position History Tracking", () => {
    it("positions should be grouped by type and jurisdiction", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 3 }),
          positionTitleArb,
          jurisdictionArb,
          (numTerms, title, jurisdiction) => {
            // Create multiple terms in same position
            const positions: PositionData[] = Array.from({ length: numTerms }, (_, i) => ({
              id: `pos-${i + 1}`,
              title,
              level: "municipal" as GovernmentLevel,
              jurisdiction,
              startDate: new Date(2016 + i * 3, 5, 30),
              endDate: i === numTerms - 1 ? null : new Date(2019 + i * 3, 5, 29),
              termNumber: i + 1,
              isConsecutive: true,
              isCurrent: i === numTerms - 1,
            }));

            const grouped = groupPositionsByTypeAndJurisdiction(positions);

            // Should have exactly one group
            expect(grouped.size).toBe(1);

            // Group should contain all positions
            const key = `${title.toLowerCase()}|${jurisdiction.toLowerCase()}`;
            expect(grouped.get(key)?.length).toBe(numTerms);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("different positions should be in separate groups", () => {
      fc.assert(
        fc.property(
          fc.tuple(positionTitleArb, positionTitleArb).filter(([t1, t2]) => t1 !== t2),
          jurisdictionArb,
          ([title1, title2], jurisdiction) => {
            const positions: PositionData[] = [
              {
                id: "pos-1",
                title: title1,
                level: "municipal" as GovernmentLevel,
                jurisdiction,
                startDate: new Date("2016-06-30"),
                endDate: new Date("2019-06-29"),
                termNumber: 1,
                isConsecutive: true,
                isCurrent: false,
              },
              {
                id: "pos-2",
                title: title2,
                level: "municipal" as GovernmentLevel,
                jurisdiction,
                startDate: new Date("2019-06-30"),
                endDate: null,
                termNumber: 1,
                isConsecutive: true,
                isCurrent: true,
              },
            ];

            const grouped = groupPositionsByTypeAndJurisdiction(positions);

            expect(grouped.size).toBe(2);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("reached limit positions should be tracked", () => {
      fc.assert(
        fc.property(fc.uuid(), (politicianId) => {
          // Create 3 terms as Mayor (reaching limit)
          const positions: PositionData[] = [
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
          ];

          const status = calculateTermLimitStatus(politicianId, positions);

          expect(status.positionsWhereReachedLimit.length).toBe(1);
          expect(status.positionsWhereReachedLimit[0]).toContain("Mayor");
          expect(status.positionsWhereReachedLimit[0]).toContain("Makati City");
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("position history should include all unique position-jurisdiction combinations", () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.array(
            fc.record({
              title: positionTitleArb,
              jurisdiction: jurisdictionArb,
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (politicianId, positionConfigs) => {
            // Create one position for each config
            const positions: PositionData[] = positionConfigs.map((config, i) => ({
              id: `pos-${i + 1}`,
              title: config.title,
              level: "municipal" as GovernmentLevel,
              jurisdiction: config.jurisdiction,
              startDate: new Date(2010 + i * 3, 5, 30),
              endDate: i === positionConfigs.length - 1 ? null : new Date(2013 + i * 3, 5, 29),
              termNumber: 1,
              isConsecutive: true,
              isCurrent: i === positionConfigs.length - 1,
            }));

            const status = calculateTermLimitStatus(politicianId, positions);

            // Count unique position-jurisdiction combinations
            const uniqueCombos = new Set(
              positionConfigs.map((c) => `${c.title.toLowerCase()}|${c.jurisdiction.toLowerCase()}`)
            );

            expect(status.positionHistory.length).toBe(uniqueCombos.size);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 46.1**
   *
   * Property 11.7: Total Years in Office Calculation
   * Total years in office must be accurately calculated from all positions.
   */
  describe("Property 11.7: Total Years in Office Calculation", () => {
    it("should calculate years correctly for single position", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 10 }), (years) => {
          const startDate = new Date("2010-06-30");
          const endDate = new Date(startDate);
          endDate.setFullYear(startDate.getFullYear() + years);

          const positions = [{ startDate, endDate }];
          const totalYears = calculateTotalYearsInOffice(positions);

          expect(totalYears).toBe(years);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should sum years across multiple positions", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 1, max: 5 }),
          (years1, years2) => {
            const positions = [
              {
                startDate: new Date("2010-06-30"),
                endDate: new Date(2010 + years1, 5, 30),
              },
              {
                startDate: new Date(2015, 5, 30),
                endDate: new Date(2015 + years2, 5, 30),
              },
            ];

            const totalYears = calculateTotalYearsInOffice(positions);

            expect(totalYears).toBe(years1 + years2);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should return 0 for empty positions", () => {
      fc.assert(
        fc.property(fc.constant([]), (positions) => {
          const totalYears = calculateTotalYearsInOffice(positions);
          expect(totalYears).toBe(0);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should handle current positions (null end date)", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 10 }), (yearsAgo) => {
          const now = new Date();
          const startDate = new Date(now);
          startDate.setFullYear(now.getFullYear() - yearsAgo);

          const positions = [{ startDate, endDate: null }];
          const totalYears = calculateTotalYearsInOffice(positions);

          expect(totalYears).toBe(yearsAgo);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("calculation should be deterministic", () => {
      fc.assert(
        fc.property(
          fc
            .array(
              fc.record({
                startDate: politicalDateArb,
                endDate: fc.option(politicalDateArb, { nil: null }),
              }),
              { minLength: 0, maxLength: 5 }
            )
            .map((positions) =>
              positions.map((p) => ({
                ...p,
                endDate: p.endDate && p.endDate > p.startDate ? p.endDate : null,
              }))
            ),
          (positions) => {
            const years1 = calculateTotalYearsInOffice(positions);
            const years2 = calculateTotalYearsInOffice(positions);
            const years3 = calculateTotalYearsInOffice(positions);

            expect(years1).toBe(years2);
            expect(years2).toBe(years3);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 46.1, 46.2, 46.3, 46.4, 46.5, 46.6**
   *
   * Property 11.8: Complete Term Limit Status Calculation
   * The complete term limit status must be correctly calculated with all fields.
   */
  describe("Property 11.8: Complete Term Limit Status Calculation", () => {
    it("status should include politician ID", () => {
      fc.assert(
        fc.property(fc.uuid(), positionsListArb, (politicianId, positions) => {
          const status = calculateTermLimitStatus(politicianId, positions);
          expect(status.politicianId).toBe(politicianId);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("status should have null current position when no current position exists", () => {
      fc.assert(
        fc.property(fc.uuid(), (politicianId) => {
          // All positions are past (not current)
          const positions: PositionData[] = [
            {
              id: "pos-1",
              title: "Mayor",
              level: "municipal" as GovernmentLevel,
              jurisdiction: "Makati City",
              startDate: new Date("2016-06-30"),
              endDate: new Date("2019-06-29"),
              termNumber: 1,
              isConsecutive: true,
              isCurrent: false,
            },
          ];

          const status = calculateTermLimitStatus(politicianId, positions);

          expect(status.currentPosition).toBeNull();
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("status should have current position when one exists", () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          positionTitleArb,
          jurisdictionArb,
          (politicianId, title, jurisdiction) => {
            const positions: PositionData[] = [
              {
                id: "pos-1",
                title,
                level: "municipal" as GovernmentLevel,
                jurisdiction,
                startDate: new Date("2022-06-30"),
                endDate: null,
                termNumber: 1,
                isConsecutive: true,
                isCurrent: true,
              },
            ];

            const status = calculateTermLimitStatus(politicianId, positions);

            expect(status.currentPosition).not.toBeNull();
            expect(status.currentPosition!.position).toBe(title);
            expect(status.currentPosition!.jurisdiction).toBe(jurisdiction);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("status calculation should be deterministic", () => {
      fc.assert(
        fc.property(fc.uuid(), positionsListArb, (politicianId, positions) => {
          const status1 = calculateTermLimitStatus(politicianId, positions);
          const status2 = calculateTermLimitStatus(politicianId, positions);

          expect(status1.politicianId).toBe(status2.politicianId);
          expect(status1.totalYearsInOffice).toBe(status2.totalYearsInOffice);
          expect(status1.termHoppingDetected).toBe(status2.termHoppingDetected);
          expect(status1.positionHistory.length).toBe(status2.positionHistory.length);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("empty positions should result in empty status", () => {
      fc.assert(
        fc.property(fc.uuid(), (politicianId) => {
          const status = calculateTermLimitStatus(politicianId, []);

          expect(status.currentPosition).toBeNull();
          expect(status.positionHistory.length).toBe(0);
          expect(status.totalYearsInOffice).toBe(0);
          expect(status.termHoppingDetected).toBe(false);
          expect(status.termHoppingPatterns.length).toBe(0);
          expect(status.positionsWhereReachedLimit.length).toBe(0);
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 46.1**
   *
   * Property 11.9: Years Range Formatting
   * Years range formatting must correctly represent term periods.
   */
  describe("Property 11.9: Years Range Formatting", () => {
    it("should format single term correctly", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2010, max: 2025 }),
          fc.integer({ min: 1, max: 6 }),
          (startYear, duration) => {
            const terms: TermDetail[] = [
              {
                termNumber: 1,
                startDate: new Date(startYear, 5, 30),
                endDate: new Date(startYear + duration, 5, 29),
                isConsecutive: true,
                isCurrent: false,
              },
            ];

            const result = formatYearsRange(terms);

            expect(result).toBe(`${startYear}-${startYear + duration}`);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should format current term with 'present'", () => {
      fc.assert(
        fc.property(fc.integer({ min: 2010, max: 2025 }), (startYear) => {
          const terms: TermDetail[] = [
            {
              termNumber: 1,
              startDate: new Date(startYear, 5, 30),
              endDate: null,
              isConsecutive: true,
              isCurrent: true,
            },
          ];

          const result = formatYearsRange(terms);

          expect(result).toBe(`${startYear}-present`);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should return empty string for empty terms", () => {
      fc.assert(
        fc.property(fc.constant([]), (terms: TermDetail[]) => {
          const result = formatYearsRange(terms);
          expect(result).toBe("");
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should format multiple terms with comma separation", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2010, max: 2020 }),
          fc.integer({ min: 2, max: 3 }),
          (startYear, numTerms) => {
            const terms: TermDetail[] = Array.from({ length: numTerms }, (_, i) => ({
              termNumber: i + 1,
              startDate: new Date(startYear + i * 3, 5, 30),
              endDate: new Date(startYear + (i + 1) * 3, 5, 29),
              isConsecutive: true,
              isCurrent: false,
            }));

            const result = formatYearsRange(terms);

            // Should contain comma separators
            expect(result.split(", ").length).toBe(numTerms);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});
