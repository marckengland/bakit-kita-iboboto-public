/**
 * Unit Tests for Comparison Service
 *
 * Tests for side-by-side politician comparison.
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

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
    electionResultRecord: {
      count: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import {
  comparePoliticians,
  validatePoliticianCount,
  calculateMetricDifference,
  calculateAllDifferences,
  ComparisonValidationError,
  ComparisonMetric,
  MIN_POLITICIANS,
  MAX_POLITICIANS,
} from "./comparison.service";

describe("Comparison Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // Validation Tests
  // ============================================

  describe("validatePoliticianCount", () => {
    it("should accept valid count of 2 politicians", () => {
      expect(() => validatePoliticianCount(2)).not.toThrow();
    });

    it("should accept valid count of 3 politicians", () => {
      expect(() => validatePoliticianCount(3)).not.toThrow();
    });

    it("should accept valid count of 4 politicians", () => {
      expect(() => validatePoliticianCount(4)).not.toThrow();
    });

    it("should reject count less than 2", () => {
      expect(() => validatePoliticianCount(1)).toThrow(ComparisonValidationError);
      expect(() => validatePoliticianCount(1)).toThrow("at least 2");
    });

    it("should reject count of 0", () => {
      expect(() => validatePoliticianCount(0)).toThrow(ComparisonValidationError);
    });

    it("should reject count greater than 4", () => {
      expect(() => validatePoliticianCount(5)).toThrow(ComparisonValidationError);
      expect(() => validatePoliticianCount(5)).toThrow("at most 4");
    });

    it("should have correct error codes", () => {
      try {
        validatePoliticianCount(1);
      } catch (e) {
        expect((e as ComparisonValidationError).code).toBe("TOO_FEW");
      }

      try {
        validatePoliticianCount(5);
      } catch (e) {
        expect((e as ComparisonValidationError).code).toBe("TOO_MANY");
      }
    });
  });

  // ============================================
  // Metric Difference Tests
  // ============================================

  describe("calculateMetricDifference", () => {
    it("should calculate difference for numeric metrics", () => {
      const metric: ComparisonMetric = {
        name: "Bills Authored",
        category: "legislative",
        values: {
          "pol-1": 50,
          "pol-2": 30,
          "pol-3": 40,
        },
      };

      const diff = calculateMetricDifference(metric);

      expect(diff).not.toBeNull();
      expect(diff?.highestValue).toBe(50);
      expect(diff?.highestPoliticianId).toBe("pol-1");
      expect(diff?.lowestValue).toBe(30);
      expect(diff?.lowestPoliticianId).toBe("pol-2");
      expect(diff?.difference).toBe(20);
    });

    it("should calculate percentage difference", () => {
      const metric: ComparisonMetric = {
        name: "Attendance Rate",
        category: "attendance",
        values: {
          "pol-1": 100,
          "pol-2": 50,
        },
      };

      const diff = calculateMetricDifference(metric);

      expect(diff?.percentageDifference).toBe(100);
    });

    it("should return null for non-numeric metrics", () => {
      const metric: ComparisonMetric = {
        name: "Party",
        category: "experience",
        values: {
          "pol-1": "Liberal Party",
          "pol-2": "PDP-Laban",
        },
      };

      const diff = calculateMetricDifference(metric);

      expect(diff).toBeNull();
    });

    it("should return null for single value", () => {
      const metric: ComparisonMetric = {
        name: "Bills",
        category: "legislative",
        values: {
          "pol-1": 50,
        },
      };

      const diff = calculateMetricDifference(metric);

      expect(diff).toBeNull();
    });

    it("should handle null values", () => {
      const metric: ComparisonMetric = {
        name: "Net Worth",
        category: "financial",
        values: {
          "pol-1": 1000000,
          "pol-2": null,
          "pol-3": 500000,
        },
      };

      const diff = calculateMetricDifference(metric);

      expect(diff).not.toBeNull();
      expect(diff?.highestValue).toBe(1000000);
      expect(diff?.lowestValue).toBe(500000);
    });
  });

  describe("calculateAllDifferences", () => {
    it("should calculate differences for all numeric metrics", () => {
      const metrics: ComparisonMetric[] = [
        {
          name: "Bills Authored",
          category: "legislative",
          values: { "pol-1": 50, "pol-2": 30 },
        },
        {
          name: "Attendance Rate",
          category: "attendance",
          values: { "pol-1": 90, "pol-2": 80 },
        },
        {
          name: "Party",
          category: "experience",
          values: { "pol-1": "LP", "pol-2": "PDP" },
        },
      ];

      const differences = calculateAllDifferences(metrics);

      expect(differences).toHaveLength(2);
      expect(differences.map((d) => d.metricName)).toContain("Bills Authored");
      expect(differences.map((d) => d.metricName)).toContain("Attendance Rate");
    });

    it("should return empty array for no numeric metrics", () => {
      const metrics: ComparisonMetric[] = [
        {
          name: "Party",
          category: "experience",
          values: { "pol-1": "LP", "pol-2": "PDP" },
        },
      ];

      const differences = calculateAllDifferences(metrics);

      expect(differences).toHaveLength(0);
    });
  });

  // ============================================
  // Full Comparison Tests
  // ============================================

  describe("comparePoliticians", () => {
    const mockPolitician = (id: string, name: string) => ({
      id,
      fullName: name,
      firstName: name.split(" ")[0],
      lastName: name.split(" ")[1] || "",
      photo: null,
      Position: [
        {
          title: "Senator",
          level: "national",
          jurisdiction: "Philippines",
          isCurrent: true,
        },
      ],
      PartyAffiliation: [
        {
          PoliticalParty: { name: "Liberal Party", abbreviation: "LP" },
          isCurrent: true,
        },
      ],
    });

    beforeEach(() => {
      // Mock politician count
      vi.mocked(prisma.politician.count).mockResolvedValue(2);

      // Mock politician lookup
      vi.mocked(prisma.politician.findUnique)
        .mockResolvedValueOnce(mockPolitician("pol-1", "Juan Cruz") as never)
        .mockResolvedValueOnce(mockPolitician("pol-2", "Maria Santos") as never);

      // Mock metrics
      vi.mocked(prisma.billAuthor.count).mockResolvedValue(10);
      vi.mocked(prisma.votingRecord.count).mockResolvedValue(50);
      vi.mocked(prisma.sALNRecord.findFirst).mockResolvedValue({
        netWorth: { toNumber: () => 1000000 },
        totalAssets: { toNumber: () => 1500000 },
        totalLiabilities: { toNumber: () => 500000 },
        year: 2023,
      } as never);
      vi.mocked(prisma.sessionAttendance.count).mockResolvedValue(100);
      vi.mocked(prisma.campaignPromise.groupBy).mockResolvedValue([
        { status: "kept", _count: 5 },
        { status: "broken", _count: 2 },
      ] as never);
      vi.mocked(prisma.position.findMany).mockResolvedValue([
        { startDate: new Date("2019-01-01"), endDate: new Date("2022-01-01") },
      ] as never);
      vi.mocked(prisma.electionResultRecord.count).mockResolvedValue(3);
    });

    it("should return comparison result with all politicians", async () => {
      const result = await comparePoliticians(["pol-1", "pol-2"]);

      expect(result.politicians).toHaveLength(2);
      expect(result.politicians[0]!.fullName).toBe("Juan Cruz");
      expect(result.politicians[1]!.fullName).toBe("Maria Santos");
    });

    it("should include all metric categories", async () => {
      const result = await comparePoliticians(["pol-1", "pol-2"]);

      const categories = new Set(result.metrics.map((m) => m.category));

      expect(categories.has("legislative")).toBe(true);
      expect(categories.has("financial")).toBe(true);
      expect(categories.has("attendance")).toBe(true);
      expect(categories.has("promises")).toBe(true);
      expect(categories.has("experience")).toBe(true);
    });

    it("should calculate differences for metrics", async () => {
      const result = await comparePoliticians(["pol-1", "pol-2"]);

      expect(result.differences.length).toBeGreaterThan(0);
    });

    it("should include comparison timestamp", async () => {
      const before = new Date();
      const result = await comparePoliticians(["pol-1", "pol-2"]);
      const after = new Date();

      expect(result.comparedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.comparedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it("should reject comparison with less than 2 politicians", async () => {
      await expect(comparePoliticians(["pol-1"])).rejects.toThrow(ComparisonValidationError);
    });

    it("should reject comparison with more than 4 politicians", async () => {
      await expect(
        comparePoliticians(["pol-1", "pol-2", "pol-3", "pol-4", "pol-5"])
      ).rejects.toThrow(ComparisonValidationError);
    });

    it("should handle duplicate politician IDs", async () => {
      vi.mocked(prisma.politician.count).mockResolvedValue(1);

      await expect(comparePoliticians(["pol-1", "pol-1"])).rejects.toThrow(
        ComparisonValidationError
      );
    });

    it("should reject if politician not found", async () => {
      vi.mocked(prisma.politician.count).mockResolvedValue(1);

      await expect(comparePoliticians(["pol-1", "pol-2"])).rejects.toThrow("not found");
    });
  });

  // ============================================
  // Constants Tests
  // ============================================

  describe("Constants", () => {
    it("should have correct min politicians", () => {
      expect(MIN_POLITICIANS).toBe(2);
    });

    it("should have correct max politicians", () => {
      expect(MAX_POLITICIANS).toBe(4);
    });
  });
});
