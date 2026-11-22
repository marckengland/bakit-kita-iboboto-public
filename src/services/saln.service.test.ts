/**
 * SALN Service Unit Tests
 *
 * Tests for SALN data model and anomaly detection functionality.
 * Validates: Requirements 6.1, 6.2, 6.3, 15.1, 15.2, 15.3, 15.6
 */

import { describe, it, expect, vi } from "vitest";

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
  SALNRecordData,
  AnomalyDetectionConfig,
} from "./saln.service";

// ============================================
// Unit Tests for calculateYearOverYearChange
// ============================================

describe("calculateYearOverYearChange", () => {
  /**
   * Validates: Property 9 - Year-over-year change = (current_net_worth - previous_net_worth) / previous_net_worth * 100
   */
  it("should calculate positive percentage change correctly", () => {
    // 100 to 150 = 50% increase
    const result = calculateYearOverYearChange(150, 100);
    expect(result).toBe(50);
  });

  it("should calculate negative percentage change correctly", () => {
    // 100 to 80 = -20% decrease
    const result = calculateYearOverYearChange(80, 100);
    expect(result).toBe(-20);
  });

  it("should return null when previous net worth is zero", () => {
    const result = calculateYearOverYearChange(100, 0);
    expect(result).toBeNull();
  });

  it("should handle large percentage increases", () => {
    // 100 to 500 = 400% increase
    const result = calculateYearOverYearChange(500, 100);
    expect(result).toBe(400);
  });

  it("should handle negative previous net worth", () => {
    // -100 to 50 = 150% change (using absolute value of previous)
    const result = calculateYearOverYearChange(50, -100);
    expect(result).toBe(150);
  });

  it("should handle zero current net worth", () => {
    // 100 to 0 = -100% decrease
    const result = calculateYearOverYearChange(0, 100);
    expect(result).toBe(-100);
  });

  it("should handle same net worth (no change)", () => {
    const result = calculateYearOverYearChange(100, 100);
    expect(result).toBe(0);
  });
});

// ============================================
// Unit Tests for calculateExpectedMaxChange
// ============================================

describe("calculateExpectedMaxChange", () => {
  const defaultConfig: AnomalyDetectionConfig = {
    salaryMultiplier: 2.0,
    defaultExpectedGrowthRate: 20,
    anomalyThreshold: 1.5,
  };

  /**
   * Validates: Requirement 15.3 - Show expected income range based on declared salary
   */
  it("should calculate expected max change based on declared salary", () => {
    // Salary: 1,000,000, Previous net worth: 5,000,000
    // Expected max: (1,000,000 * 2) / 5,000,000 * 100 = 40%
    const result = calculateExpectedMaxChange(1_000_000, 5_000_000, defaultConfig);
    expect(result).toBe(40);
  });

  it("should return default growth rate when no salary is declared", () => {
    const result = calculateExpectedMaxChange(null, 5_000_000, defaultConfig);
    expect(result).toBe(20);
  });

  it("should return default growth rate when salary is zero", () => {
    const result = calculateExpectedMaxChange(0, 5_000_000, defaultConfig);
    expect(result).toBe(20);
  });

  it("should return default growth rate when previous net worth is zero", () => {
    const result = calculateExpectedMaxChange(1_000_000, 0, defaultConfig);
    expect(result).toBe(20);
  });

  it("should use custom salary multiplier", () => {
    const customConfig: AnomalyDetectionConfig = {
      ...defaultConfig,
      salaryMultiplier: 3.0,
    };
    // Salary: 1,000,000, Previous net worth: 5,000,000
    // Expected max: (1,000,000 * 3) / 5,000,000 * 100 = 60%
    const result = calculateExpectedMaxChange(1_000_000, 5_000_000, customConfig);
    expect(result).toBe(60);
  });

  it("should handle undefined salary", () => {
    const result = calculateExpectedMaxChange(undefined, 5_000_000, defaultConfig);
    expect(result).toBe(20);
  });
});

// ============================================
// Unit Tests for detectAnomaly
// ============================================

describe("detectAnomaly", () => {
  const defaultConfig: AnomalyDetectionConfig = {
    salaryMultiplier: 2.0,
    defaultExpectedGrowthRate: 20,
    anomalyThreshold: 1.5,
  };

  /**
   * Validates: Property 9 - If change exceeds expected range, anomalyDetected = true
   */
  it("should detect anomaly when change exceeds threshold", () => {
    // 50% change with 20% expected = 2.5x ratio (exceeds 1.5 threshold)
    const result = detectAnomaly(50, 20, defaultConfig);
    expect(result).not.toBeNull();
    expect(result?.yearOverYearChange).toBe(50);
    expect(result?.expectedMaxChange).toBe(20);
    expect(result?.anomalyRatio).toBe(2.5);
  });

  it("should not detect anomaly when change is within threshold", () => {
    // 25% change with 20% expected = 1.25x ratio (below 1.5 threshold)
    const result = detectAnomaly(25, 20, defaultConfig);
    expect(result).toBeNull();
  });

  it("should not detect anomaly for negative changes", () => {
    // Wealth decrease is not flagged as anomaly
    const result = detectAnomaly(-50, 20, defaultConfig);
    expect(result).toBeNull();
  });

  it("should not detect anomaly when year-over-year change is null", () => {
    const result = detectAnomaly(null, 20, defaultConfig);
    expect(result).toBeNull();
  });

  it("should not detect anomaly when change is zero", () => {
    const result = detectAnomaly(0, 20, defaultConfig);
    expect(result).toBeNull();
  });

  it("should detect anomaly at exact threshold", () => {
    // 30% change with 20% expected = 1.5x ratio (exactly at threshold)
    const result = detectAnomaly(30, 20, defaultConfig);
    expect(result).not.toBeNull();
    expect(result?.anomalyRatio).toBe(1.5);
  });

  /**
   * Validates: Property 9 - Anomaly details must include yearOverYearChange, expectedMaxChange, anomalyRatio
   */
  it("should include all required fields in anomaly details", () => {
    const result = detectAnomaly(100, 20, defaultConfig);
    expect(result).not.toBeNull();
    expect(result).toHaveProperty("yearOverYearChange");
    expect(result).toHaveProperty("expectedMaxChange");
    expect(result).toHaveProperty("anomalyRatio");
    expect(result).toHaveProperty("explanation");
  });

  it("should generate meaningful explanation", () => {
    const result = detectAnomaly(100, 20, defaultConfig);
    expect(result?.explanation).toContain("100.00%");
    expect(result?.explanation).toContain("5.00x");
    expect(result?.explanation).toContain("20.00%");
  });
});

// ============================================
// Unit Tests for calculateAnomalies
// ============================================

describe("calculateAnomalies", () => {
  const defaultConfig: AnomalyDetectionConfig = {
    salaryMultiplier: 2.0,
    defaultExpectedGrowthRate: 20,
    anomalyThreshold: 1.5,
  };

  const createMockRecord = (
    year: number,
    netWorth: number,
    declaredSalary: number | null = null
  ): SALNRecordData => ({
    id: `saln-${year}`,
    politicianId: "politician-1",
    year,
    totalAssets: netWorth + 100000,
    totalLiabilities: 100000,
    netWorth,
    declaredSalary,
    anomalyDetected: false,
    anomalyDetails: null,
    realProperties: [],
    personalProperties: [],
    investments: [],
    sources: [],
  });

  /**
   * Validates: Property 9 - The calculation must be deterministic and reproducible
   */
  it("should not flag first record as anomaly", () => {
    const records = [createMockRecord(2020, 1_000_000)];
    const result = calculateAnomalies(records, defaultConfig);
    expect(result[0]?.anomalyDetected).toBe(false);
    expect(result[0]?.anomalyDetails).toBeNull();
  });

  it("should detect anomaly in subsequent records", () => {
    const records = [
      createMockRecord(2020, 1_000_000, 500_000),
      createMockRecord(2021, 5_000_000, 500_000), // 400% increase
    ];
    const result = calculateAnomalies(records, defaultConfig);
    expect(result[0]?.anomalyDetected).toBe(false);
    expect(result[1]?.anomalyDetected).toBe(true);
  });

  it("should not flag normal growth as anomaly", () => {
    const records = [
      createMockRecord(2020, 1_000_000, 500_000),
      createMockRecord(2021, 1_100_000, 500_000), // 10% increase
    ];
    const result = calculateAnomalies(records, defaultConfig);
    expect(result[1]?.anomalyDetected).toBe(false);
  });

  it("should handle multiple years with mixed anomalies", () => {
    const records = [
      createMockRecord(2020, 1_000_000, 500_000),
      createMockRecord(2021, 1_100_000, 500_000), // Normal growth
      createMockRecord(2022, 5_000_000, 500_000), // Anomaly
      createMockRecord(2023, 5_200_000, 500_000), // Normal growth
    ];
    const result = calculateAnomalies(records, defaultConfig);
    expect(result[0]?.anomalyDetected).toBe(false);
    expect(result[1]?.anomalyDetected).toBe(false);
    expect(result[2]?.anomalyDetected).toBe(true);
    expect(result[3]?.anomalyDetected).toBe(false);
  });

  it("should sort records by year before calculating", () => {
    const records = [
      createMockRecord(2022, 5_000_000, 500_000),
      createMockRecord(2020, 1_000_000, 500_000),
      createMockRecord(2021, 1_100_000, 500_000),
    ];
    const result = calculateAnomalies(records, defaultConfig);
    // Should be sorted: 2020, 2021, 2022
    expect(result[0]?.year).toBe(2020);
    expect(result[1]?.year).toBe(2021);
    expect(result[2]?.year).toBe(2022);
    // 2022 should be flagged (jump from 1.1M to 5M)
    expect(result[2]?.anomalyDetected).toBe(true);
  });

  it("should handle empty records array", () => {
    const result = calculateAnomalies([], defaultConfig);
    expect(result).toEqual([]);
  });

  it("should handle single record", () => {
    const records = [createMockRecord(2020, 1_000_000)];
    const result = calculateAnomalies(records, defaultConfig);
    expect(result).toHaveLength(1);
    expect(result[0]?.anomalyDetected).toBe(false);
  });

  it("should use declared salary for expected max change calculation", () => {
    // With high salary, larger increases are expected
    const records = [
      createMockRecord(2020, 1_000_000, 2_000_000), // High salary
      createMockRecord(2021, 5_000_000, 2_000_000), // 400% increase
    ];
    const result = calculateAnomalies(records, defaultConfig);
    // Expected max: (2M * 2) / 1M * 100 = 400%
    // Actual: 400%, ratio = 1.0 (below 1.5 threshold)
    expect(result[1]?.anomalyDetected).toBe(false);
  });

  it("should not flag wealth decrease as anomaly", () => {
    const records = [
      createMockRecord(2020, 5_000_000, 500_000),
      createMockRecord(2021, 1_000_000, 500_000), // 80% decrease
    ];
    const result = calculateAnomalies(records, defaultConfig);
    expect(result[1]?.anomalyDetected).toBe(false);
  });

  /**
   * Validates: Property 9 - Deterministic calculation
   */
  it("should produce same results for same input", () => {
    const records = [
      createMockRecord(2020, 1_000_000, 500_000),
      createMockRecord(2021, 5_000_000, 500_000),
    ];
    const result1 = calculateAnomalies(records, defaultConfig);
    const result2 = calculateAnomalies(records, defaultConfig);
    expect(result1).toEqual(result2);
  });
});
