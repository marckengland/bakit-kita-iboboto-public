/**
 * Property-Based Tests for SALN Anomaly Detection
 *
 * **Validates: Requirements 15.1, 15.2, 15.3**
 *
 * Property 9: SALN Anomaly Detection
 * For any politician with multiple years of SALN data:
 * - Year-over-year change must be calculated as: (current_net_worth - previous_net_worth) / previous_net_worth * 100
 * - If the change exceeds the expected range (based on declared salary), anomalyDetected must be true
 * - Anomaly details must include: yearOverYearChange, expectedMaxChange, anomalyRatio
 * - The calculation must be deterministic and reproducible
 */

import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";

// Mock Prisma before importing the service
vi.mock("@/lib/prisma", () => ({
  default: {
    sALNRecord: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import {
  calculateYearOverYearChange,
  calculateExpectedMaxChange,
  detectAnomaly,
  calculateAnomalies,
  type AnomalyDetectionConfig,
} from "./saln.service";

// Minimum iterations for property tests
const NUM_RUNS = 100;

// Default configuration for testing
const DEFAULT_CONFIG: AnomalyDetectionConfig = {
  salaryMultiplier: 2.0,
  defaultExpectedGrowthRate: 20,
  anomalyThreshold: 1.5,
};

// ============================================
// Arbitraries (Generators) for Test Data
// ============================================

/**
 * Generate a valid UUID-like string
 */
const idArb = fc.uuid();

/**
 * Generate a positive net worth value (realistic range for Philippine politicians)
 * Using positive values to avoid division by zero edge cases in basic tests
 */
const positiveNetWorthArb = fc.float({
  min: Math.fround(100_000), // 100K PHP minimum
  max: Math.fround(1_000_000_000), // 1B PHP maximum (32-bit float limit)
  noNaN: true,
});

/**
 * Generate any net worth value including negative (for debt scenarios)
 */
const anyNetWorthArb = fc.float({
  min: Math.fround(-100_000_000), // -100M PHP (debt)
  max: Math.fround(1_000_000_000), // 1B PHP
  noNaN: true,
});

/**
 * Generate a non-zero net worth for division operations
 */
const nonZeroNetWorthArb = fc.oneof(
  fc.float({ min: Math.fround(100_000), max: Math.fround(1_000_000_000), noNaN: true }),
  fc.float({ min: Math.fround(-1_000_000_000), max: Math.fround(-100_000), noNaN: true })
);

/**
 * Generate a declared salary (annual, in PHP)
 */
const salaryArb = fc.float({
  min: Math.fround(200_000), // ~200K PHP minimum government salary
  max: Math.fround(5_000_000), // ~5M PHP maximum
  noNaN: true,
});

/**
 * Generate an optional declared salary
 */
const optionalSalaryArb = fc.option(salaryArb, { nil: null });

/**
 * Generate a valid anomaly detection configuration
 */
const configArb = fc.record({
  salaryMultiplier: fc.float({ min: Math.fround(1.0), max: Math.fround(5.0), noNaN: true }),
  defaultExpectedGrowthRate: fc.float({ min: Math.fround(5), max: Math.fround(50), noNaN: true }),
  anomalyThreshold: fc.float({ min: Math.fround(1.1), max: Math.fround(3.0), noNaN: true }),
});

/**
 * Generate a sequence of SALN records for the same politician with consecutive years
 */
const salnRecordSequenceArb = (minLength: number, maxLength: number) =>
  fc
    .tuple(
      idArb, // politicianId
      fc.integer({ min: 2000, max: 2025 }), // startYear
      fc.integer({ min: minLength, max: maxLength }) // length
    )
    .chain(([politicianId, startYear, length]) =>
      fc
        .array(
          fc.record({
            id: idArb,
            politicianId: fc.constant(politicianId),
            year: fc.constant(0), // Will be set below
            totalAssets: positiveNetWorthArb,
            totalLiabilities: fc.float({
              min: Math.fround(0),
              max: Math.fround(100_000_000),
              noNaN: true,
            }),
            netWorth: positiveNetWorthArb,
            declaredSalary: optionalSalaryArb,
            anomalyDetected: fc.constant(false),
            anomalyDetails: fc.constant(null),
            realProperties: fc.constant([]),
            personalProperties: fc.constant([]),
            investments: fc.constant([]),
            sources: fc.constant([]),
          }),
          { minLength: length, maxLength: length }
        )
        .map((records) =>
          records.map((record, index) => ({
            ...record,
            year: startYear + index,
          }))
        )
    );

// ============================================
// Property Tests
// ============================================

describe("SALN Anomaly Detection - Property 9", () => {
  /**
   * **Validates: Requirements 15.1**
   *
   * Property 9.1: Year-over-Year Change Calculation
   * Year-over-year change must be calculated as:
   * (current_net_worth - previous_net_worth) / previous_net_worth * 100
   */
  describe("Property 9.1: Year-over-Year Change Calculation", () => {
    it("should calculate year-over-year change using the correct formula", () => {
      fc.assert(
        fc.property(nonZeroNetWorthArb, anyNetWorthArb, (previousNetWorth, currentNetWorth) => {
          const result = calculateYearOverYearChange(currentNetWorth, previousNetWorth);

          // Expected formula: (current - previous) / |previous| * 100
          const expected =
            ((currentNetWorth - previousNetWorth) / Math.abs(previousNetWorth)) * 100;

          expect(result).not.toBeNull();
          expect(result).toBeCloseTo(expected, 5);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should return null when previous net worth is zero", () => {
      fc.assert(
        fc.property(anyNetWorthArb, (currentNetWorth) => {
          const result = calculateYearOverYearChange(currentNetWorth, 0);
          expect(result).toBeNull();
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should return positive percentage for wealth increase", () => {
      fc.assert(
        fc.property(
          positiveNetWorthArb,
          fc.float({ min: Math.fround(1.01), max: Math.fround(10), noNaN: true }), // multiplier > 1
          (previousNetWorth, multiplier) => {
            const currentNetWorth = previousNetWorth * multiplier;
            const result = calculateYearOverYearChange(currentNetWorth, previousNetWorth);

            expect(result).not.toBeNull();
            expect(result!).toBeGreaterThan(0);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should return negative percentage for wealth decrease", () => {
      fc.assert(
        fc.property(
          positiveNetWorthArb,
          fc.float({ min: Math.fround(0.01), max: Math.fround(0.99), noNaN: true }), // multiplier < 1
          (previousNetWorth, multiplier) => {
            const currentNetWorth = previousNetWorth * multiplier;
            const result = calculateYearOverYearChange(currentNetWorth, previousNetWorth);

            expect(result).not.toBeNull();
            expect(result!).toBeLessThan(0);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should return zero when net worth is unchanged", () => {
      fc.assert(
        fc.property(nonZeroNetWorthArb, (netWorth) => {
          const result = calculateYearOverYearChange(netWorth, netWorth);

          expect(result).not.toBeNull();
          expect(result).toBeCloseTo(0, 5);
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 15.2, 15.3**
   *
   * Property 9.2: Anomaly Detection Based on Expected Range
   * If the change exceeds the expected range (based on declared salary),
   * anomalyDetected must be true.
   */
  describe("Property 9.2: Anomaly Detection Based on Expected Range", () => {
    it("should detect anomaly when year-over-year change exceeds threshold", () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(100), max: Math.fround(1000), noNaN: true }), // yearOverYearChange
          fc.float({ min: Math.fround(10), max: Math.fround(50), noNaN: true }), // expectedMaxChange
          configArb,
          (yearOverYearChange, expectedMaxChange, config) => {
            // Ensure the change exceeds the threshold
            const anomalyRatio = yearOverYearChange / expectedMaxChange;

            if (anomalyRatio >= config.anomalyThreshold && yearOverYearChange > 0) {
              const result = detectAnomaly(yearOverYearChange, expectedMaxChange, config);

              expect(result).not.toBeNull();
              expect(result!.yearOverYearChange).toBe(yearOverYearChange);
              expect(result!.expectedMaxChange).toBe(expectedMaxChange);
              expect(result!.anomalyRatio).toBeCloseTo(anomalyRatio, 5);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should not detect anomaly when change is within expected range", () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(1), max: Math.fround(20), noNaN: true }), // small yearOverYearChange
          fc.float({ min: Math.fround(50), max: Math.fround(100), noNaN: true }), // large expectedMaxChange
          (yearOverYearChange, expectedMaxChange) => {
            // Ensure the ratio is below threshold
            const anomalyRatio = yearOverYearChange / expectedMaxChange;

            if (anomalyRatio < DEFAULT_CONFIG.anomalyThreshold) {
              const result = detectAnomaly(yearOverYearChange, expectedMaxChange, DEFAULT_CONFIG);
              expect(result).toBeNull();
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should not detect anomaly for negative changes (wealth decrease)", () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(-1000), max: Math.fround(-1), noNaN: true }), // negative change
          fc.float({ min: Math.fround(10), max: Math.fround(100), noNaN: true }), // expectedMaxChange
          (yearOverYearChange, expectedMaxChange) => {
            const result = detectAnomaly(yearOverYearChange, expectedMaxChange, DEFAULT_CONFIG);
            expect(result).toBeNull();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should not detect anomaly when year-over-year change is null", () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(10), max: Math.fround(100), noNaN: true }),
          (expectedMaxChange) => {
            const result = detectAnomaly(null, expectedMaxChange, DEFAULT_CONFIG);
            expect(result).toBeNull();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 15.3**
   *
   * Property 9.3: Expected Max Change Calculation
   * Expected max change should be calculated based on declared salary
   * and previous net worth.
   */
  describe("Property 9.3: Expected Max Change Calculation", () => {
    it("should calculate expected max change based on salary when declared", () => {
      fc.assert(
        fc.property(
          salaryArb,
          positiveNetWorthArb,
          configArb,
          (declaredSalary, previousNetWorth, config) => {
            const result = calculateExpectedMaxChange(declaredSalary, previousNetWorth, config);

            // Expected: (salary * multiplier) / previousNetWorth * 100
            const expectedMaxAbsolute = declaredSalary * config.salaryMultiplier;
            const expected = (expectedMaxAbsolute / Math.abs(previousNetWorth)) * 100;

            expect(result).toBeCloseTo(expected, 5);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should use default growth rate when no salary is declared", () => {
      fc.assert(
        fc.property(positiveNetWorthArb, configArb, (previousNetWorth, config) => {
          const result = calculateExpectedMaxChange(null, previousNetWorth, config);
          expect(result).toBe(config.defaultExpectedGrowthRate);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should use default growth rate when previous net worth is zero", () => {
      fc.assert(
        fc.property(optionalSalaryArb, configArb, (declaredSalary, config) => {
          const result = calculateExpectedMaxChange(declaredSalary, 0, config);
          expect(result).toBe(config.defaultExpectedGrowthRate);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should return positive expected max change for valid inputs", () => {
      fc.assert(
        fc.property(
          optionalSalaryArb,
          positiveNetWorthArb,
          configArb,
          (declaredSalary, previousNetWorth, config) => {
            const result = calculateExpectedMaxChange(declaredSalary, previousNetWorth, config);
            expect(result).toBeGreaterThan(0);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 15.1, 15.2, 15.3**
   *
   * Property 9.4: Anomaly Details Completeness
   * Anomaly details must include: yearOverYearChange, expectedMaxChange, anomalyRatio
   */
  describe("Property 9.4: Anomaly Details Completeness", () => {
    it("should include all required fields when anomaly is detected", () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(200), max: Math.fround(1000), noNaN: true }), // high yearOverYearChange
          fc.float({ min: Math.fround(10), max: Math.fround(50), noNaN: true }), // low expectedMaxChange
          (yearOverYearChange, expectedMaxChange) => {
            // Ensure anomaly will be detected
            const anomalyRatio = yearOverYearChange / expectedMaxChange;

            if (anomalyRatio >= DEFAULT_CONFIG.anomalyThreshold) {
              const result = detectAnomaly(yearOverYearChange, expectedMaxChange, DEFAULT_CONFIG);

              expect(result).not.toBeNull();

              // Verify all required fields are present
              expect(result).toHaveProperty("yearOverYearChange");
              expect(result).toHaveProperty("expectedMaxChange");
              expect(result).toHaveProperty("anomalyRatio");
              expect(result).toHaveProperty("explanation");

              // Verify field types
              expect(typeof result!.yearOverYearChange).toBe("number");
              expect(typeof result!.expectedMaxChange).toBe("number");
              expect(typeof result!.anomalyRatio).toBe("number");
              expect(typeof result!.explanation).toBe("string");

              // Verify field values
              expect(result!.yearOverYearChange).toBe(yearOverYearChange);
              expect(result!.expectedMaxChange).toBe(expectedMaxChange);
              expect(result!.anomalyRatio).toBeCloseTo(anomalyRatio, 5);
              expect(result!.explanation.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("anomaly ratio should equal yearOverYearChange / expectedMaxChange", () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(200), max: Math.fround(1000), noNaN: true }),
          fc.float({ min: Math.fround(10), max: Math.fround(50), noNaN: true }),
          (yearOverYearChange, expectedMaxChange) => {
            const result = detectAnomaly(yearOverYearChange, expectedMaxChange, DEFAULT_CONFIG);

            if (result !== null) {
              const expectedRatio = yearOverYearChange / expectedMaxChange;
              expect(result.anomalyRatio).toBeCloseTo(expectedRatio, 5);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 15.1, 15.2, 15.3**
   *
   * Property 9.5: Calculation Determinism
   * The calculation must be deterministic and reproducible.
   */
  describe("Property 9.5: Calculation Determinism", () => {
    it("year-over-year change calculation should be deterministic", () => {
      fc.assert(
        fc.property(nonZeroNetWorthArb, anyNetWorthArb, (previousNetWorth, currentNetWorth) => {
          const result1 = calculateYearOverYearChange(currentNetWorth, previousNetWorth);
          const result2 = calculateYearOverYearChange(currentNetWorth, previousNetWorth);
          const result3 = calculateYearOverYearChange(currentNetWorth, previousNetWorth);

          expect(result1).toEqual(result2);
          expect(result2).toEqual(result3);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("expected max change calculation should be deterministic", () => {
      fc.assert(
        fc.property(
          optionalSalaryArb,
          positiveNetWorthArb,
          configArb,
          (declaredSalary, previousNetWorth, config) => {
            const result1 = calculateExpectedMaxChange(declaredSalary, previousNetWorth, config);
            const result2 = calculateExpectedMaxChange(declaredSalary, previousNetWorth, config);
            const result3 = calculateExpectedMaxChange(declaredSalary, previousNetWorth, config);

            expect(result1).toEqual(result2);
            expect(result2).toEqual(result3);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("anomaly detection should be deterministic", () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true }),
          fc.float({ min: Math.fround(1), max: Math.fround(100), noNaN: true }),
          configArb,
          (yearOverYearChange, expectedMaxChange, config) => {
            const result1 = detectAnomaly(yearOverYearChange, expectedMaxChange, config);
            const result2 = detectAnomaly(yearOverYearChange, expectedMaxChange, config);
            const result3 = detectAnomaly(yearOverYearChange, expectedMaxChange, config);

            // Results should be identical
            if (result1 === null) {
              expect(result2).toBeNull();
              expect(result3).toBeNull();
            } else {
              expect(result2).not.toBeNull();
              expect(result3).not.toBeNull();
              expect(result1.yearOverYearChange).toEqual(result2!.yearOverYearChange);
              expect(result1.expectedMaxChange).toEqual(result2!.expectedMaxChange);
              expect(result1.anomalyRatio).toEqual(result2!.anomalyRatio);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("calculateAnomalies should produce identical results for same input", () => {
      fc.assert(
        fc.property(salnRecordSequenceArb(2, 5), configArb, (records, config) => {
          const result1 = calculateAnomalies(records, config);
          const result2 = calculateAnomalies(records, config);

          expect(result1.length).toEqual(result2.length);

          for (let i = 0; i < result1.length; i++) {
            expect(result1[i]!.anomalyDetected).toEqual(result2[i]!.anomalyDetected);

            if (result1[i]!.anomalyDetails !== null) {
              expect(result2[i]!.anomalyDetails).not.toBeNull();
              expect(result1[i]!.anomalyDetails!.yearOverYearChange).toEqual(
                result2[i]!.anomalyDetails!.yearOverYearChange
              );
              expect(result1[i]!.anomalyDetails!.expectedMaxChange).toEqual(
                result2[i]!.anomalyDetails!.expectedMaxChange
              );
              expect(result1[i]!.anomalyDetails!.anomalyRatio).toEqual(
                result2[i]!.anomalyDetails!.anomalyRatio
              );
            } else {
              expect(result2[i]!.anomalyDetails).toBeNull();
            }
          }
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 15.1, 15.2, 15.3**
   *
   * Property 9.6: Multi-Year SALN Anomaly Detection
   * For sequences of SALN records, anomalies should be correctly detected
   * for each year based on the previous year's data.
   */
  describe("Property 9.6: Multi-Year SALN Anomaly Detection", () => {
    it("first year record should never have anomaly detected", () => {
      fc.assert(
        fc.property(salnRecordSequenceArb(1, 10), configArb, (records, config) => {
          const result = calculateAnomalies(records, config);

          // First record (sorted by year) should not have anomaly
          const sortedResult = [...result].sort((a, b) => a.year - b.year);
          expect(sortedResult[0]!.anomalyDetected).toBe(false);
          expect(sortedResult[0]!.anomalyDetails).toBeNull();
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should maintain year ordering in output", () => {
      fc.assert(
        fc.property(salnRecordSequenceArb(2, 10), configArb, (records, config) => {
          const result = calculateAnomalies(records, config);

          // Verify records are sorted by year
          for (let i = 1; i < result.length; i++) {
            expect(result[i]!.year).toBeGreaterThan(result[i - 1]!.year);
          }
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should preserve all original record data except anomaly fields", () => {
      fc.assert(
        fc.property(salnRecordSequenceArb(2, 5), configArb, (records, config) => {
          const result = calculateAnomalies(records, config);

          // Sort both by year for comparison
          const sortedInput = [...records].sort((a, b) => a.year - b.year);
          const sortedResult = [...result].sort((a, b) => a.year - b.year);

          expect(sortedResult.length).toEqual(sortedInput.length);

          for (let i = 0; i < sortedResult.length; i++) {
            expect(sortedResult[i]!.id).toEqual(sortedInput[i]!.id);
            expect(sortedResult[i]!.politicianId).toEqual(sortedInput[i]!.politicianId);
            expect(sortedResult[i]!.year).toEqual(sortedInput[i]!.year);
            expect(sortedResult[i]!.totalAssets).toEqual(sortedInput[i]!.totalAssets);
            expect(sortedResult[i]!.totalLiabilities).toEqual(sortedInput[i]!.totalLiabilities);
            expect(sortedResult[i]!.netWorth).toEqual(sortedInput[i]!.netWorth);
            expect(sortedResult[i]!.declaredSalary).toEqual(sortedInput[i]!.declaredSalary);
          }
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("anomaly detection should use correct previous year for comparison", () => {
      fc.assert(
        fc.property(salnRecordSequenceArb(3, 5), (records) => {
          const result = calculateAnomalies(records, DEFAULT_CONFIG);
          const sortedResult = [...result].sort((a, b) => a.year - b.year);

          // For each record after the first, verify the calculation uses the correct previous year
          for (let i = 1; i < sortedResult.length; i++) {
            const current = sortedResult[i]!;
            const previous = sortedResult[i - 1]!;

            if (previous.netWorth !== 0) {
              const expectedYoYChange = calculateYearOverYearChange(
                current.netWorth,
                previous.netWorth
              );

              const anomalyDetails = current.anomalyDetails;
              if (
                anomalyDetails !== null &&
                anomalyDetails !== undefined &&
                expectedYoYChange !== null
              ) {
                expect(anomalyDetails.yearOverYearChange).toBeCloseTo(expectedYoYChange, 5);
              }
            }
          }
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirements 15.2**
   *
   * Property 9.7: Anomaly Threshold Behavior
   * Anomaly should be detected if and only if the ratio exceeds the threshold.
   */
  describe("Property 9.7: Anomaly Threshold Behavior", () => {
    it("should detect anomaly exactly when ratio >= threshold", () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(1), max: Math.fround(500), noNaN: true }), // yearOverYearChange
          fc.float({ min: Math.fround(1), max: Math.fround(100), noNaN: true }), // expectedMaxChange
          configArb,
          (yearOverYearChange, expectedMaxChange, config) => {
            const result = detectAnomaly(yearOverYearChange, expectedMaxChange, config);
            const ratio = yearOverYearChange / expectedMaxChange;

            if (yearOverYearChange > 0 && ratio >= config.anomalyThreshold) {
              expect(result).not.toBeNull();
            } else if (yearOverYearChange <= 0 || ratio < config.anomalyThreshold) {
              expect(result).toBeNull();
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("boundary case: ratio exactly at threshold should trigger anomaly", () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(10), max: Math.fround(100), noNaN: true }), // expectedMaxChange
          configArb,
          (expectedMaxChange, config) => {
            // Set yearOverYearChange to exactly threshold * expectedMaxChange
            const yearOverYearChange = config.anomalyThreshold * expectedMaxChange;

            const result = detectAnomaly(yearOverYearChange, expectedMaxChange, config);

            // At exactly the threshold, anomaly should be detected
            expect(result).not.toBeNull();
            expect(result!.anomalyRatio).toBeCloseTo(config.anomalyThreshold, 5);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("boundary case: ratio just below threshold should not trigger anomaly", () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(10), max: Math.fround(100), noNaN: true }), // expectedMaxChange
          configArb,
          (expectedMaxChange, config) => {
            // Set yearOverYearChange to just below threshold * expectedMaxChange
            const yearOverYearChange = (config.anomalyThreshold - 0.01) * expectedMaxChange;

            const result = detectAnomaly(yearOverYearChange, expectedMaxChange, config);

            // Just below threshold, anomaly should not be detected
            expect(result).toBeNull();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});
