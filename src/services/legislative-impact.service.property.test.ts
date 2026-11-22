/**
 * Property-Based Tests for Legislative Impact Score Calculation
 * **Validates: Requirements 30.1, 30.2, 30.3, 30.4**
 */

import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";

// Mock Prisma before importing the service
vi.mock("@/lib/prisma", () => ({
  default: {
    billAuthor: { findMany: vi.fn() },
    project: { findMany: vi.fn() },
  },
}));

import {
  calculateLawsScore,
  calculatePendingBillsScore,
  calculatePopulationScore,
  calculateBudgetScore,
  calculateTotalScore,
  normalizeScore,
  calculateImpactScore,
  SCORE_WEIGHTS,
} from "./legislative-impact.service";

const NUM_RUNS = 100;

// Arbitraries
const nonNegativeIntArb = fc.integer({ min: 0, max: 1000 });
const nonNegativeFloatArb = fc.float({ min: 0, max: 1000, noNaN: true });
const scoreComponentArb = fc.record({
  name: fc.string(),
  value: nonNegativeFloatArb,
  weight: fc.integer({ min: 1, max: 20 }),
  weightedValue: nonNegativeFloatArb,
  description: fc.string(),
});
const scoreComponentsArb = fc.array(scoreComponentArb, { minLength: 0, maxLength: 10 });

describe("Property 13: Legislative Impact Score Calculation", () => {
  describe("13.1: Score calculation determinism", () => {
    it("should produce deterministic results for the same inputs", () => {
      fc.assert(
        fc.property(
          nonNegativeIntArb,
          nonNegativeIntArb,
          nonNegativeFloatArb,
          nonNegativeFloatArb,
          (laws, pending, population, budget) => {
            const result1 = calculateImpactScore(laws, pending, population, budget);
            const result2 = calculateImpactScore(laws, pending, population, budget);

            expect(result1.totalScore).toBe(result2.totalScore);
            expect(result1.scoreOutOf100).toBe(result2.scoreOutOf100);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe("13.2: Law weight greater than pending weight", () => {
    /**
     * **Validates: Requirement 30.4**
     * Laws must be weighted higher than pending bills
     */
    it("should weight laws higher than pending bills", () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          expect(SCORE_WEIGHTS.lawWeight).toBeGreaterThan(SCORE_WEIGHTS.pendingWeight);
        }),
        { numRuns: 1 }
      );
    });

    it("should give higher score for same count of laws vs pending", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), (count) => {
          const lawsScore = calculateLawsScore(count);
          const pendingScore = calculatePendingBillsScore(count);

          expect(lawsScore.weightedValue).toBeGreaterThan(pendingScore.weightedValue);
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe("13.3: Score breakdown sums to total", () => {
    /**
     * **Validates: Requirement 30.3**
     * Score breakdown must sum to the total score
     */
    it("should have breakdown that sums to total score", () => {
      fc.assert(
        fc.property(
          nonNegativeIntArb,
          nonNegativeIntArb,
          nonNegativeFloatArb,
          nonNegativeFloatArb,
          (laws, pending, population, budget) => {
            const result = calculateImpactScore(laws, pending, population, budget);

            const breakdownSum = result.breakdown.reduce(
              (sum, component) => sum + component.weightedValue,
              0
            );

            expect(breakdownSum).toBeCloseTo(result.totalScore, 10);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe("13.4: Score range validity", () => {
    /**
     * **Validates: Requirement 30.1**
     * Score must be within valid range
     */
    it("should always return score between 0 and 100", () => {
      fc.assert(
        fc.property(
          nonNegativeIntArb,
          nonNegativeIntArb,
          nonNegativeFloatArb,
          nonNegativeFloatArb,
          (laws, pending, population, budget) => {
            const result = calculateImpactScore(laws, pending, population, budget);

            expect(result.scoreOutOf100).toBeGreaterThanOrEqual(0);
            expect(result.scoreOutOf100).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should return 0 score for all zero inputs", () => {
      const result = calculateImpactScore(0, 0, 0, 0);
      expect(result.totalScore).toBe(0);
      expect(result.scoreOutOf100).toBe(0);
    });
  });

  describe("13.5: Component score non-negativity", () => {
    it("should always return non-negative component scores", () => {
      fc.assert(
        fc.property(nonNegativeIntArb, (value) => {
          const lawsScore = calculateLawsScore(value);
          const pendingScore = calculatePendingBillsScore(value);

          expect(lawsScore.weightedValue).toBeGreaterThanOrEqual(0);
          expect(pendingScore.weightedValue).toBeGreaterThanOrEqual(0);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should always return non-negative population and budget scores", () => {
      fc.assert(
        fc.property(nonNegativeFloatArb, (value) => {
          const populationScore = calculatePopulationScore(value);
          const budgetScore = calculateBudgetScore(value);

          expect(populationScore.weightedValue).toBeGreaterThanOrEqual(0);
          expect(budgetScore.weightedValue).toBeGreaterThanOrEqual(0);
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe("13.6: Monotonicity properties", () => {
    /**
     * **Validates: Requirement 30.2**
     * More laws/bills/population/budget should not decrease score
     */
    it("should not decrease score when adding more laws", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 1, max: 50 }),
          (baseLaws, additionalLaws) => {
            const score1 = calculateLawsScore(baseLaws);
            const score2 = calculateLawsScore(baseLaws + additionalLaws);

            expect(score2.weightedValue).toBeGreaterThanOrEqual(score1.weightedValue);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should not decrease total score when adding more laws", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 50 }),
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 0, max: 50 }),
          fc.float({ min: 0, max: 50, noNaN: true }),
          fc.float({ min: 0, max: 50, noNaN: true }),
          (baseLaws, additionalLaws, pending, population, budget) => {
            const result1 = calculateImpactScore(baseLaws, pending, population, budget);
            const result2 = calculateImpactScore(
              baseLaws + additionalLaws,
              pending,
              population,
              budget
            );

            expect(result2.totalScore).toBeGreaterThanOrEqual(result1.totalScore - 0.0001);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe("13.7: Total score calculation", () => {
    it("should correctly sum component weighted values", () => {
      fc.assert(
        fc.property(scoreComponentsArb, (components) => {
          const total = calculateTotalScore(components);
          const expectedSum = components.reduce((sum, c) => sum + c.weightedValue, 0);

          expect(total).toBeCloseTo(expectedSum, 10);
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe("13.8: Normalization correctness", () => {
    it("should normalize scores to 0-100 range", () => {
      fc.assert(
        fc.property(fc.float({ min: 0, max: 10000, noNaN: true }), (rawScore) => {
          const normalized = normalizeScore(rawScore);

          expect(normalized).toBeGreaterThanOrEqual(0);
          expect(normalized).toBeLessThanOrEqual(100);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should return 0 for 0 input", () => {
      expect(normalizeScore(0)).toBe(0);
    });
  });

  describe("13.9: Breakdown completeness", () => {
    /**
     * **Validates: Requirement 30.3**
     * Breakdown must include all components
     */
    it("should always include all four components in breakdown", () => {
      fc.assert(
        fc.property(
          nonNegativeIntArb,
          nonNegativeIntArb,
          nonNegativeFloatArb,
          nonNegativeFloatArb,
          (laws, pending, population, budget) => {
            const result = calculateImpactScore(laws, pending, population, budget);

            expect(result.breakdown).toHaveLength(4);

            const componentNames = result.breakdown.map((c) => c.name);
            expect(componentNames).toContain("Laws Passed");
            expect(componentNames).toContain("Pending Bills");
            expect(componentNames).toContain("Population Affected");
            expect(componentNames).toContain("Budget Allocated");
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});
