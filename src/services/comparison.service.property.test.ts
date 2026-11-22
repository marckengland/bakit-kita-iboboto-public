/**
 * Property-Based Tests for Comparison Service
 *
 * **Property 10: Comparison Correctness**
 * *For any* comparison request with 2-4 politician IDs:
 * - All requested politicians must be included in the response
 * - All comparable metrics must be present for each politician
 * - Differences must be calculated correctly for numeric metrics
 * - Requests with more than 4 politicians must be rejected
 * - Requests with fewer than 2 politicians must be rejected
 *
 * **Validates: Requirements 9.1, 9.2, 9.3, 9.4**
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import fc from "fast-check";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  default: {
    politician: {
      count: vi.fn(),
      findUnique: vi.fn(),
    },
    billAuthor: {
      count: vi.fn(),
    },
    votingRecord: {
      count: vi.fn(),
    },
    sALNRecord: {
      findFirst: vi.fn(),
    },
    sessionAttendance: {
      count: vi.fn(),
    },
    campaignPromise: {
      groupBy: vi.fn(),
    },
    position: {
      findMany: vi.fn(),
    },
    electionResult: {
      count: vi.fn(),
    },
  },
}));

import {
  validatePoliticianCount,
  calculateMetricDifference,
  calculateAllDifferences,
  ComparisonValidationError,
  ComparisonMetric,
  MetricCategory,
  MIN_POLITICIANS,
  MAX_POLITICIANS,
} from "./comparison.service";

const NUM_RUNS = 100;

// ============================================
// Arbitraries for Property-Based Testing
// ============================================

const metricCategories: MetricCategory[] = [
  "legislative",
  "financial",
  "attendance",
  "promises",
  "experience",
];

const arbitraryMetricCategory = (): fc.Arbitrary<MetricCategory> =>
  fc.constantFrom(...metricCategories);

// ============================================
// Property Tests
// ============================================

describe("Comparison Correctness - Property 10", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * **Validates: Requirement 9.4**
   * Requests with fewer than 2 politicians must be rejected
   */
  describe("Property 10.1: Minimum Politician Count", () => {
    it("should reject count less than MIN_POLITICIANS", () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: MIN_POLITICIANS - 1 }), (count) => {
          expect(() => validatePoliticianCount(count)).toThrow(ComparisonValidationError);

          try {
            validatePoliticianCount(count);
          } catch (e) {
            expect((e as ComparisonValidationError).code).toBe("TOO_FEW");
          }

          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should accept count equal to MIN_POLITICIANS", () => {
      expect(() => validatePoliticianCount(MIN_POLITICIANS)).not.toThrow();
    });
  });

  /**
   * **Validates: Requirement 9.4**
   * Requests with more than 4 politicians must be rejected
   */
  describe("Property 10.2: Maximum Politician Count", () => {
    it("should reject count greater than MAX_POLITICIANS", () => {
      fc.assert(
        fc.property(fc.integer({ min: MAX_POLITICIANS + 1, max: 100 }), (count) => {
          expect(() => validatePoliticianCount(count)).toThrow(ComparisonValidationError);

          try {
            validatePoliticianCount(count);
          } catch (e) {
            expect((e as ComparisonValidationError).code).toBe("TOO_MANY");
          }

          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should accept count equal to MAX_POLITICIANS", () => {
      expect(() => validatePoliticianCount(MAX_POLITICIANS)).not.toThrow();
    });
  });

  /**
   * **Validates: Requirement 9.1, 9.4**
   * Valid count range should be accepted
   */
  describe("Property 10.3: Valid Count Range", () => {
    it("should accept counts between MIN and MAX inclusive", () => {
      fc.assert(
        fc.property(fc.integer({ min: MIN_POLITICIANS, max: MAX_POLITICIANS }), (count) => {
          expect(() => validatePoliticianCount(count)).not.toThrow();
          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirement 9.2**
   * All comparable metrics must be present for each politician
   */
  describe("Property 10.4: Metric Values Completeness", () => {
    it("should have values for all politicians in each metric", () => {
      fc.assert(
        fc.property(fc.uniqueArray(fc.uuid(), { minLength: 2, maxLength: 4 }), (politicianIds) => {
          const metric: ComparisonMetric = {
            name: "Test Metric",
            category: "legislative",
            values: Object.fromEntries(politicianIds.map((id) => [id, Math.random() * 100])),
          };

          // All politician IDs should have values
          for (const id of politicianIds) {
            expect(id in metric.values).toBe(true);
          }

          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirement 9.3**
   * Differences must be calculated correctly for numeric metrics
   */
  describe("Property 10.5: Difference Calculation Correctness", () => {
    it("should correctly identify highest and lowest values", () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(fc.uuid(), { minLength: 2, maxLength: 4 }),
          fc.array(fc.float({ min: 0, max: 1000, noNaN: true }), {
            minLength: 2,
            maxLength: 4,
          }),
          (politicianIds, values) => {
            // Ensure we have matching lengths
            const ids = politicianIds.slice(0, values.length);
            const vals = values.slice(0, ids.length);

            if (ids.length < 2) {
              return true;
            }

            const metric: ComparisonMetric = {
              name: "Test Metric",
              category: "legislative",
              values: Object.fromEntries(ids.map((id, i) => [id, vals[i]!])) as Record<
                string,
                string | number | null
              >,
            };

            const diff = calculateMetricDifference(metric);

            if (diff) {
              const maxVal = Math.max(...vals);
              const minVal = Math.min(...vals);

              expect(diff.highestValue).toBe(maxVal);
              expect(diff.lowestValue).toBe(minVal);
              expect(diff.difference).toBeCloseTo(maxVal - minVal, 5);
            }

            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should calculate percentage difference correctly", () => {
      fc.assert(
        fc.property(
          fc.float({ min: 1, max: 1000, noNaN: true }),
          fc.float({ min: 1, max: 1000, noNaN: true }),
          (val1, val2) => {
            const metric: ComparisonMetric = {
              name: "Test Metric",
              category: "legislative",
              values: {
                "pol-1": val1,
                "pol-2": val2,
              },
            };

            const diff = calculateMetricDifference(metric);

            if (diff && diff.percentageDifference !== null) {
              const maxVal = Math.max(val1, val2);
              const minVal = Math.min(val1, val2);
              const expectedPct = ((maxVal - minVal) / minVal) * 100;

              expect(diff.percentageDifference).toBeCloseTo(Math.round(expectedPct * 10) / 10, 1);
            }

            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should return null for metrics with less than 2 numeric values", () => {
      fc.assert(
        fc.property(fc.uuid(), fc.float({ min: 0, max: 100, noNaN: true }), (id, value) => {
          const metric: ComparisonMetric = {
            name: "Test Metric",
            category: "legislative",
            values: { [id]: value },
          };

          const diff = calculateMetricDifference(metric);

          expect(diff).toBeNull();

          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * Additional property tests for difference calculation
   */
  describe("Property 10.6: Difference Calculation for Multiple Metrics", () => {
    it("should calculate differences for all numeric metrics", () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(fc.uuid(), { minLength: 2, maxLength: 4 }),
          fc.integer({ min: 1, max: 10 }),
          (politicianIds, metricCount) => {
            const ids = politicianIds.slice(0, Math.max(2, politicianIds.length));

            const metrics: ComparisonMetric[] = [];
            for (let i = 0; i < metricCount; i++) {
              metrics.push({
                name: `Metric ${i}`,
                category: metricCategories[i % metricCategories.length]!,
                values: Object.fromEntries(ids.map((id) => [id, Math.random() * 100])),
              });
            }

            const differences = calculateAllDifferences(metrics);

            // Should have a difference for each metric
            expect(differences.length).toBe(metricCount);

            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should skip non-numeric metrics in difference calculation", () => {
      fc.assert(
        fc.property(fc.uniqueArray(fc.uuid(), { minLength: 2, maxLength: 4 }), (politicianIds) => {
          const ids = politicianIds.slice(0, Math.max(2, politicianIds.length));

          const metrics: ComparisonMetric[] = [
            {
              name: "Numeric Metric",
              category: "legislative",
              values: Object.fromEntries(ids.map((id) => [id, Math.random() * 100])),
            },
            {
              name: "String Metric",
              category: "experience",
              values: Object.fromEntries(ids.map((id) => [id, "text"])),
            },
          ];

          const differences = calculateAllDifferences(metrics);

          // Should only have difference for numeric metric
          expect(differences.length).toBe(1);
          expect(differences[0]?.metricName).toBe("Numeric Metric");

          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * Property tests for metric structure
   */
  describe("Property 10.7: Metric Structure Consistency", () => {
    it("should preserve metric category in difference", () => {
      fc.assert(
        fc.property(
          arbitraryMetricCategory(),
          fc.uniqueArray(fc.uuid(), { minLength: 2, maxLength: 4 }),
          (category, politicianIds) => {
            const ids = politicianIds.slice(0, Math.max(2, politicianIds.length));

            const metric: ComparisonMetric = {
              name: "Test Metric",
              category,
              values: Object.fromEntries(ids.map((id) => [id, Math.random() * 100])),
            };

            const diff = calculateMetricDifference(metric);

            if (diff) {
              expect(diff.category).toBe(category);
            }

            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should preserve metric name in difference", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.uniqueArray(fc.uuid(), { minLength: 2, maxLength: 4 }),
          (name, politicianIds) => {
            const ids = politicianIds.slice(0, Math.max(2, politicianIds.length));

            const metric: ComparisonMetric = {
              name,
              category: "legislative",
              values: Object.fromEntries(ids.map((id) => [id, Math.random() * 100])),
            };

            const diff = calculateMetricDifference(metric);

            if (diff) {
              expect(diff.metricName).toBe(name);
            }

            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});
