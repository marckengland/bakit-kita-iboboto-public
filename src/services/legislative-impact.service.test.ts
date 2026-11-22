/**
 * Unit Tests for Legislative Impact Score Service
 * Validates: Requirements 30.1, 30.2, 30.3, 30.4, 30.5, 30.6
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BillStatus } from "@prisma/client";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  default: {
    billAuthor: {
      findMany: vi.fn(),
    },
    project: {
      findMany: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import {
  calculateLawsScore,
  calculatePendingBillsScore,
  calculatePopulationScore,
  calculateBudgetScore,
  calculateTotalScore,
  normalizeScore,
  calculateImpactScore,
  getLegislativeImpactScore,
  getScoringMethodology,
  compareLegislativeImpactScores,
  SCORE_WEIGHTS,
  COMPONENT_NAMES,
} from "./legislative-impact.service";

describe("Legislative Impact Score Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("calculateLawsScore", () => {
    it("should calculate score for laws passed", () => {
      const result = calculateLawsScore(5);

      expect(result.name).toBe(COMPONENT_NAMES.LAWS_PASSED);
      expect(result.value).toBe(5);
      expect(result.weight).toBe(SCORE_WEIGHTS.lawWeight);
      expect(result.weightedValue).toBeGreaterThan(0);
    });

    it("should return 0 weighted value for 0 laws", () => {
      const result = calculateLawsScore(0);
      expect(result.weightedValue).toBe(0);
    });

    it("should cap at maximum value", () => {
      const result = calculateLawsScore(100);
      const maxResult = calculateLawsScore(50);

      // Score should be capped
      expect(result.weightedValue).toBe(maxResult.weightedValue);
    });
  });

  describe("calculatePendingBillsScore", () => {
    it("should calculate score for pending bills", () => {
      const result = calculatePendingBillsScore(10);

      expect(result.name).toBe(COMPONENT_NAMES.PENDING_BILLS);
      expect(result.value).toBe(10);
      expect(result.weight).toBe(SCORE_WEIGHTS.pendingWeight);
    });

    it("should have lower weight than laws", () => {
      const lawsScore = calculateLawsScore(1);
      const pendingScore = calculatePendingBillsScore(1);

      // Laws should be weighted higher (Requirement 30.4)
      expect(lawsScore.weight).toBeGreaterThan(pendingScore.weight);
    });
  });

  describe("calculatePopulationScore", () => {
    it("should calculate score for population affected", () => {
      const result = calculatePopulationScore(50);

      expect(result.name).toBe(COMPONENT_NAMES.POPULATION_AFFECTED);
      expect(result.value).toBe(50);
      expect(result.weightedValue).toBeGreaterThan(0);
    });
  });

  describe("calculateBudgetScore", () => {
    it("should calculate score for budget allocated", () => {
      const result = calculateBudgetScore(10);

      expect(result.name).toBe(COMPONENT_NAMES.BUDGET_ALLOCATED);
      expect(result.value).toBe(10);
      expect(result.weightedValue).toBeGreaterThan(0);
    });
  });

  describe("calculateTotalScore", () => {
    it("should sum all component weighted values", () => {
      const components = [
        { name: "A", value: 1, weight: 1, weightedValue: 10, description: "" },
        { name: "B", value: 2, weight: 2, weightedValue: 20, description: "" },
        { name: "C", value: 3, weight: 3, weightedValue: 30, description: "" },
      ];

      const total = calculateTotalScore(components);
      expect(total).toBe(60);
    });

    it("should return 0 for empty components", () => {
      const total = calculateTotalScore([]);
      expect(total).toBe(0);
    });
  });

  describe("normalizeScore", () => {
    it("should normalize score to 0-100 range", () => {
      const normalized = normalizeScore(100);
      expect(normalized).toBeGreaterThanOrEqual(0);
      expect(normalized).toBeLessThanOrEqual(100);
    });

    it("should return 0 for 0 total score", () => {
      const normalized = normalizeScore(0);
      expect(normalized).toBe(0);
    });
  });

  describe("calculateImpactScore", () => {
    it("should calculate complete impact score", () => {
      const result = calculateImpactScore(5, 10, 50, 10);

      expect(result.totalScore).toBeGreaterThan(0);
      expect(result.scoreOutOf100).toBeGreaterThanOrEqual(0);
      expect(result.scoreOutOf100).toBeLessThanOrEqual(100);
      expect(result.breakdown).toHaveLength(4);
    });

    it("should have breakdown that sums to total score", () => {
      const result = calculateImpactScore(5, 10, 50, 10);

      const breakdownSum = result.breakdown.reduce((sum, c) => sum + c.weightedValue, 0);
      expect(breakdownSum).toBeCloseTo(result.totalScore, 10);
    });

    it("should weight laws higher than pending bills", () => {
      // Same count for laws and pending
      const result = calculateImpactScore(10, 10, 0, 0);

      const lawsComponent = result.breakdown.find((c) => c.name === COMPONENT_NAMES.LAWS_PASSED);
      const pendingComponent = result.breakdown.find(
        (c) => c.name === COMPONENT_NAMES.PENDING_BILLS
      );

      expect(lawsComponent!.weightedValue).toBeGreaterThan(pendingComponent!.weightedValue);
    });
  });

  describe("getLegislativeImpactScore", () => {
    it("should calculate score for a politician", async () => {
      const mockBillAuthors = [
        { politicianId: "pol-1", Bill: { status: BillStatus.passed } },
        { politicianId: "pol-1", Bill: { status: BillStatus.passed } },
        { politicianId: "pol-1", Bill: { status: BillStatus.pending } },
      ];

      const mockProjects = [
        { budget: 1000000000, ProjectLocation: { region: "NCR" } },
        { budget: 500000000, ProjectLocation: { region: "Region III" } },
      ];

      vi.mocked(prisma.billAuthor.findMany).mockResolvedValue(mockBillAuthors as never);
      vi.mocked(prisma.project.findMany).mockResolvedValue(mockProjects as never);

      const result = await getLegislativeImpactScore("pol-1");

      expect(result.politicianId).toBe("pol-1");
      expect(result.billsPassedIntoLaw).toBe(2);
      expect(result.billsPending).toBe(1);
      expect(result.totalBillsAuthored).toBe(3);
      expect(result.totalScore).toBeGreaterThan(0);
      expect(result.breakdown).toHaveLength(4);
    });

    it("should handle politician with no bills", async () => {
      vi.mocked(prisma.billAuthor.findMany).mockResolvedValue([]);
      vi.mocked(prisma.project.findMany).mockResolvedValue([]);

      const result = await getLegislativeImpactScore("pol-empty");

      expect(result.billsPassedIntoLaw).toBe(0);
      expect(result.billsPending).toBe(0);
      expect(result.totalBillsAuthored).toBe(0);
      expect(result.scoreOutOf100).toBe(0);
    });
  });

  describe("getScoringMethodology", () => {
    it("should return methodology explanation", () => {
      const methodology = getScoringMethodology();

      expect(methodology.description).toBeTruthy();
      expect(methodology.components).toHaveLength(4);
      expect(methodology.formula).toBeTruthy();
      expect(methodology.lastUpdated).toBeInstanceOf(Date);
    });

    it("should include all score components", () => {
      const methodology = getScoringMethodology();
      const componentNames = methodology.components.map((c) => c.name);

      expect(componentNames).toContain(COMPONENT_NAMES.LAWS_PASSED);
      expect(componentNames).toContain(COMPONENT_NAMES.PENDING_BILLS);
      expect(componentNames).toContain(COMPONENT_NAMES.POPULATION_AFFECTED);
      expect(componentNames).toContain(COMPONENT_NAMES.BUDGET_ALLOCATED);
    });
  });

  describe("compareLegislativeImpactScores", () => {
    it("should compare multiple politicians and sort by score", async () => {
      // Mock different scores for different politicians
      vi.mocked(prisma.billAuthor.findMany)
        .mockResolvedValueOnce([
          { politicianId: "pol-1", Bill: { status: BillStatus.passed } },
        ] as never)
        .mockResolvedValueOnce([
          { politicianId: "pol-2", Bill: { status: BillStatus.passed } },
          { politicianId: "pol-2", Bill: { status: BillStatus.passed } },
          { politicianId: "pol-2", Bill: { status: BillStatus.passed } },
        ] as never);

      vi.mocked(prisma.project.findMany).mockResolvedValue([]);

      const results = await compareLegislativeImpactScores(["pol-1", "pol-2"]);

      expect(results).toHaveLength(2);
      // Should be sorted by score descending
      expect(results[0]!.scoreOutOf100).toBeGreaterThanOrEqual(results[1]!.scoreOutOf100);
    });
  });
});
