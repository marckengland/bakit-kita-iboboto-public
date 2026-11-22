/**
 * Promise Tracker Service Unit Tests
 *
 * Tests for campaign promise tracking and fulfillment rate calculation.
 * Validates: Requirements 23.1, 23.2, 23.3, 23.4, 23.5, 23.6
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Prisma } from "@prisma/client";
import {
  getPromisesByPolitician,
  getPromisesByStatus,
  getPromisesByCategory,
  getPromise,
  getPromiseEvidence,
  getFulfillmentRate,
  getPromiseSummaryByCategory,
  getPromiseTimeline,
  getPromisesByElectionYear,
  hasPromises,
  getPromiseCategories,
  getPromiseElectionYears,
  getFulfilledPromisesWithEvidence,
  getPromiseCountsByStatus,
  calculateFulfillmentRate,
  PROMISE_CATEGORIES,
} from "./promise-tracker.service";
import prisma from "@/lib/prisma";
import { PromiseStatus, PromiseEvidenceType, SourceType } from "@prisma/client";

// Mock Prisma client
vi.mock("@/lib/prisma", () => ({
  default: {
    campaignPromise: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    promiseEvidence: {
      findMany: vi.fn(),
    },
  },
}));

describe("Promise Tracker Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ============================================
  // calculateFulfillmentRate Tests
  // ============================================

  describe("calculateFulfillmentRate", () => {
    it("should return 0 when there are no promises", () => {
      const result = calculateFulfillmentRate(0, 0, 0);
      expect(result).toBe(0);
    });

    it("should return 100 when all promises are kept", () => {
      const result = calculateFulfillmentRate(10, 0, 10);
      expect(result).toBe(100);
    });

    it("should return 50 when all promises are partially kept", () => {
      const result = calculateFulfillmentRate(0, 10, 10);
      expect(result).toBe(50);
    });

    it("should calculate correctly with mixed kept and partially kept", () => {
      // Formula: (kept + partially_kept * 0.5) / total * 100
      // (5 + 4 * 0.5) / 10 * 100 = 7 / 10 * 100 = 70
      const result = calculateFulfillmentRate(5, 4, 10);
      expect(result).toBe(70);
    });

    it("should return 0 when no promises are kept or partially kept", () => {
      const result = calculateFulfillmentRate(0, 0, 10);
      expect(result).toBe(0);
    });

    it("should handle decimal results correctly", () => {
      // (1 + 1 * 0.5) / 3 * 100 = 1.5 / 3 * 100 = 50
      const result = calculateFulfillmentRate(1, 1, 3);
      expect(result).toBe(50);
    });
  });

  // ============================================
  // PROMISE_CATEGORIES Tests
  // ============================================

  describe("PROMISE_CATEGORIES", () => {
    it("should contain expected categories", () => {
      expect(PROMISE_CATEGORIES).toContain("economy");
      expect(PROMISE_CATEGORIES).toContain("health");
      expect(PROMISE_CATEGORIES).toContain("education");
      expect(PROMISE_CATEGORIES).toContain("infrastructure");
      expect(PROMISE_CATEGORIES).toContain("other");
    });

    it("should have at least 10 categories", () => {
      expect(PROMISE_CATEGORIES.length).toBeGreaterThanOrEqual(10);
    });
  });

  // ============================================
  // getPromisesByPolitician Tests
  // ============================================

  describe("getPromisesByPolitician", () => {
    it("should return paginated promises for a politician", async () => {
      const mockPromises = [
        {
          id: "promise-1",
          politicianId: "pol-1",
          electionYear: 2022,
          promiseText: "Build more hospitals",
          category: "health",
          status: "kept" as PromiseStatus,
          createdAt: new Date("2022-01-01"),
          updatedAt: new Date("2023-06-01"),
          PromiseEvidence: [
            {
              id: "ev-1",
              type: "project" as PromiseEvidenceType,
              description: "Hospital construction completed",
              url: "https://example.com/hospital",
              date: new Date("2023-05-01"),
            },
          ],
          SourceAttribution: [
            {
              sourceType: "official_government" as SourceType,
              sourceName: "Campaign Materials 2022",
              sourceUrl: "https://comelec.gov.ph",
              documentDate: new Date("2022-01-15"),
              retrievedAt: new Date("2022-02-01"),
              confidence: new Prisma.Decimal(0.95),
              isAIProcessed: true,
              originalDocumentId: "doc-1",
              fieldName: "promiseText",
            },
          ],
        },
        {
          id: "promise-2",
          politicianId: "pol-1",
          electionYear: 2022,
          promiseText: "Improve education system",
          category: "education",
          status: "in_progress" as PromiseStatus,
          createdAt: new Date("2022-01-02"),
          updatedAt: new Date("2023-06-01"),
          PromiseEvidence: [],
          SourceAttribution: [],
        },
      ];

      vi.mocked(prisma.campaignPromise.count).mockResolvedValue(2);
      vi.mocked(prisma.campaignPromise.findMany).mockResolvedValue(mockPromises as never);

      const result = await getPromisesByPolitician("pol-1");

      expect(result.items).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.items[0]!.promiseText).toBe("Build more hospitals");
      expect(result.items[0]!.evidence).toHaveLength(1);
      expect(result.items[0]!.sources).toHaveLength(1);
    });

    it("should return empty result for politician with no promises", async () => {
      vi.mocked(prisma.campaignPromise.count).mockResolvedValue(0);
      vi.mocked(prisma.campaignPromise.findMany).mockResolvedValue([]);

      const result = await getPromisesByPolitician("pol-no-promises");

      expect(result.items).toEqual([]);
      expect(result.totalCount).toBe(0);
    });
  });

  // ============================================
  // getPromisesByStatus Tests
  // ============================================

  describe("getPromisesByStatus", () => {
    it("should return promises filtered by status", async () => {
      const mockPromises = [
        {
          id: "promise-1",
          politicianId: "pol-1",
          electionYear: 2022,
          promiseText: "Promise kept",
          category: "economy",
          status: "kept" as PromiseStatus,
          createdAt: new Date(),
          updatedAt: new Date(),
          PromiseEvidence: [],
          SourceAttribution: [],
        },
      ];

      vi.mocked(prisma.campaignPromise.findMany).mockResolvedValue(mockPromises as never);

      const result = await getPromisesByStatus("pol-1", "kept");

      expect(result).toHaveLength(1);
      expect(result[0]!.status).toBe("kept");
    });

    it("should return empty array when no promises match status", async () => {
      vi.mocked(prisma.campaignPromise.findMany).mockResolvedValue([]);

      const result = await getPromisesByStatus("pol-1", "broken");

      expect(result).toEqual([]);
    });
  });

  // ============================================
  // getPromisesByCategory Tests
  // ============================================

  describe("getPromisesByCategory", () => {
    it("should return promises filtered by category", async () => {
      const mockPromises = [
        {
          id: "promise-1",
          politicianId: "pol-1",
          electionYear: 2022,
          promiseText: "Health promise",
          category: "health",
          status: "in_progress" as PromiseStatus,
          createdAt: new Date(),
          updatedAt: new Date(),
          PromiseEvidence: [],
          SourceAttribution: [],
        },
      ];

      vi.mocked(prisma.campaignPromise.findMany).mockResolvedValue(mockPromises as never);

      const result = await getPromisesByCategory("pol-1", "health");

      expect(result).toHaveLength(1);
      expect(result[0]!.category).toBe("health");
    });
  });

  // ============================================
  // getPromise Tests
  // ============================================

  describe("getPromise", () => {
    it("should return a single promise by ID", async () => {
      const mockPromise = {
        id: "promise-1",
        politicianId: "pol-1",
        electionYear: 2022,
        promiseText: "Test promise",
        category: "economy",
        status: "kept" as PromiseStatus,
        createdAt: new Date(),
        updatedAt: new Date(),
        PromiseEvidence: [
          {
            id: "ev-1",
            type: "legislation" as PromiseEvidenceType,
            description: "Law passed",
            url: "https://example.com/law",
            date: new Date(),
          },
        ],
        SourceAttribution: [],
      };

      vi.mocked(prisma.campaignPromise.findUnique).mockResolvedValue(mockPromise as never);

      const result = await getPromise("promise-1");

      expect(result).not.toBeNull();
      expect(result!.id).toBe("promise-1");
      expect(result!.evidence).toHaveLength(1);
    });

    it("should return null for non-existent promise", async () => {
      vi.mocked(prisma.campaignPromise.findUnique).mockResolvedValue(null);

      const result = await getPromise("non-existent");

      expect(result).toBeNull();
    });
  });

  // ============================================
  // getPromiseEvidence Tests
  // ============================================

  describe("getPromiseEvidence", () => {
    it("should return evidence for a promise", async () => {
      const mockEvidence = [
        {
          id: "ev-1",
          campaignPromiseId: "promise-1",
          type: "legislation" as PromiseEvidenceType,
          description: "Republic Act passed",
          url: "https://congress.gov.ph/ra/12345",
          date: new Date("2023-06-01"),
          createdAt: new Date(),
        },
        {
          id: "ev-2",
          campaignPromiseId: "promise-1",
          type: "project" as PromiseEvidenceType,
          description: "Infrastructure project completed",
          url: null,
          date: new Date("2023-05-01"),
          createdAt: new Date(),
        },
      ];

      vi.mocked(prisma.promiseEvidence.findMany).mockResolvedValue(mockEvidence as never);

      const result = await getPromiseEvidence("promise-1");

      expect(result).toHaveLength(2);
      expect(result[0]!.type).toBe("legislation");
      expect(result[1]!.type).toBe("project");
    });

    it("should return empty array when no evidence exists", async () => {
      vi.mocked(prisma.promiseEvidence.findMany).mockResolvedValue([]);

      const result = await getPromiseEvidence("promise-no-evidence");

      expect(result).toEqual([]);
    });
  });

  // ============================================
  // getFulfillmentRate Tests
  // ============================================

  describe("getFulfillmentRate", () => {
    it("should calculate fulfillment rate correctly", async () => {
      const mockPromises = [
        { status: "kept" as PromiseStatus },
        { status: "kept" as PromiseStatus },
        { status: "partially_kept" as PromiseStatus },
        { status: "broken" as PromiseStatus },
        { status: "in_progress" as PromiseStatus },
      ];

      vi.mocked(prisma.campaignPromise.findMany).mockResolvedValue(mockPromises as never);

      const result = await getFulfillmentRate("pol-1");

      // (2 kept + 1 partially_kept * 0.5) / 5 total * 100 = 2.5 / 5 * 100 = 50%
      expect(result.totalPromises).toBe(5);
      expect(result.keptCount).toBe(2);
      expect(result.partiallyKeptCount).toBe(1);
      expect(result.brokenCount).toBe(1);
      expect(result.inProgressCount).toBe(1);
      expect(result.notYetDueCount).toBe(0);
      expect(result.fulfillmentRate).toBe(50);
      expect(result.fulfillmentPercentage).toBe("50.0%");
    });

    it("should return 0% for politician with no promises", async () => {
      vi.mocked(prisma.campaignPromise.findMany).mockResolvedValue([]);

      const result = await getFulfillmentRate("pol-no-promises");

      expect(result.totalPromises).toBe(0);
      expect(result.fulfillmentRate).toBe(0);
      expect(result.fulfillmentPercentage).toBe("0.0%");
    });

    it("should return 100% when all promises are kept", async () => {
      const mockPromises = [
        { status: "kept" as PromiseStatus },
        { status: "kept" as PromiseStatus },
        { status: "kept" as PromiseStatus },
      ];

      vi.mocked(prisma.campaignPromise.findMany).mockResolvedValue(mockPromises as never);

      const result = await getFulfillmentRate("pol-1");

      expect(result.fulfillmentRate).toBe(100);
      expect(result.fulfillmentPercentage).toBe("100.0%");
    });

    it("should count all status types correctly", async () => {
      const mockPromises = [
        { status: "kept" as PromiseStatus },
        { status: "partially_kept" as PromiseStatus },
        { status: "broken" as PromiseStatus },
        { status: "in_progress" as PromiseStatus },
        { status: "not_yet_due" as PromiseStatus },
      ];

      vi.mocked(prisma.campaignPromise.findMany).mockResolvedValue(mockPromises as never);

      const result = await getFulfillmentRate("pol-1");

      expect(result.keptCount).toBe(1);
      expect(result.partiallyKeptCount).toBe(1);
      expect(result.brokenCount).toBe(1);
      expect(result.inProgressCount).toBe(1);
      expect(result.notYetDueCount).toBe(1);
    });
  });

  // ============================================
  // getPromiseSummaryByCategory Tests
  // ============================================

  describe("getPromiseSummaryByCategory", () => {
    it("should return summary grouped by category", async () => {
      const mockPromises = [
        { category: "health", status: "kept" as PromiseStatus },
        { category: "health", status: "kept" as PromiseStatus },
        { category: "health", status: "broken" as PromiseStatus },
        { category: "education", status: "in_progress" as PromiseStatus },
        { category: "economy", status: "partially_kept" as PromiseStatus },
      ];

      vi.mocked(prisma.campaignPromise.findMany).mockResolvedValue(mockPromises as never);

      const result = await getPromiseSummaryByCategory("pol-1");

      expect(result).toHaveLength(3);

      // Health has 3 promises (most), should be first
      const healthSummary = result.find((s) => s.category === "health");
      expect(healthSummary).toBeDefined();
      expect(healthSummary!.totalCount).toBe(3);
      expect(healthSummary!.keptCount).toBe(2);
      expect(healthSummary!.brokenCount).toBe(1);
      // (2 + 0 * 0.5) / 3 * 100 = 66.67%
      expect(healthSummary!.fulfillmentRate).toBeCloseTo(66.67, 1);
    });

    it("should return empty array for politician with no promises", async () => {
      vi.mocked(prisma.campaignPromise.findMany).mockResolvedValue([]);

      const result = await getPromiseSummaryByCategory("pol-no-promises");

      expect(result).toEqual([]);
    });

    it("should sort by total count descending", async () => {
      const mockPromises = [
        { category: "health", status: "kept" as PromiseStatus },
        { category: "economy", status: "kept" as PromiseStatus },
        { category: "economy", status: "kept" as PromiseStatus },
        { category: "economy", status: "kept" as PromiseStatus },
      ];

      vi.mocked(prisma.campaignPromise.findMany).mockResolvedValue(mockPromises as never);

      const result = await getPromiseSummaryByCategory("pol-1");

      expect(result[0]!.category).toBe("economy");
      expect(result[0]!.totalCount).toBe(3);
      expect(result[1]!.category).toBe("health");
      expect(result[1]!.totalCount).toBe(1);
    });
  });

  // ============================================
  // getPromiseTimeline Tests
  // ============================================

  describe("getPromiseTimeline", () => {
    it("should return promise timeline with latest evidence date", async () => {
      const mockPromises = [
        {
          id: "promise-1",
          promiseText: "Promise 1",
          category: "health",
          status: "kept" as PromiseStatus,
          electionYear: 2022,
          PromiseEvidence: [{ date: new Date("2023-06-01") }],
        },
        {
          id: "promise-2",
          promiseText: "Promise 2",
          category: "economy",
          status: "in_progress" as PromiseStatus,
          electionYear: 2019,
          PromiseEvidence: [],
        },
      ];

      vi.mocked(prisma.campaignPromise.findMany).mockResolvedValue(mockPromises as never);

      const result = await getPromiseTimeline("pol-1");

      expect(result).toHaveLength(2);
      expect(result[0]!.latestEvidenceDate).toEqual(new Date("2023-06-01"));
      expect(result[1]!.latestEvidenceDate).toBeNull();
    });
  });

  // ============================================
  // getPromisesByElectionYear Tests
  // ============================================

  describe("getPromisesByElectionYear", () => {
    it("should return promises for specific election year", async () => {
      const mockPromises = [
        {
          id: "promise-1",
          politicianId: "pol-1",
          electionYear: 2022,
          promiseText: "2022 Promise",
          category: "health",
          status: "kept" as PromiseStatus,
          createdAt: new Date(),
          updatedAt: new Date(),
          PromiseEvidence: [],
          SourceAttribution: [],
        },
      ];

      vi.mocked(prisma.campaignPromise.findMany).mockResolvedValue(mockPromises as never);

      const result = await getPromisesByElectionYear("pol-1", 2022);

      expect(result).toHaveLength(1);
      expect(result[0]!.electionYear).toBe(2022);
    });
  });

  // ============================================
  // hasPromises Tests
  // ============================================

  describe("hasPromises", () => {
    it("should return true when politician has promises", async () => {
      vi.mocked(prisma.campaignPromise.count).mockResolvedValue(5);

      const result = await hasPromises("pol-1");

      expect(result).toBe(true);
    });

    it("should return false when politician has no promises", async () => {
      vi.mocked(prisma.campaignPromise.count).mockResolvedValue(0);

      const result = await hasPromises("pol-no-promises");

      expect(result).toBe(false);
    });
  });

  // ============================================
  // getPromiseCategories Tests
  // ============================================

  describe("getPromiseCategories", () => {
    it("should return unique categories for a politician", async () => {
      const mockPromises = [
        { category: "health" },
        { category: "education" },
        { category: "economy" },
      ];

      vi.mocked(prisma.campaignPromise.findMany).mockResolvedValue(mockPromises as never);

      const result = await getPromiseCategories("pol-1");

      expect(result).toHaveLength(3);
      expect(result).toContain("health");
      expect(result).toContain("education");
      expect(result).toContain("economy");
    });
  });

  // ============================================
  // getPromiseElectionYears Tests
  // ============================================

  describe("getPromiseElectionYears", () => {
    it("should return unique election years sorted descending", async () => {
      const mockPromises = [{ electionYear: 2022 }, { electionYear: 2019 }, { electionYear: 2016 }];

      vi.mocked(prisma.campaignPromise.findMany).mockResolvedValue(mockPromises as never);

      const result = await getPromiseElectionYears("pol-1");

      expect(result).toEqual([2022, 2019, 2016]);
    });
  });

  // ============================================
  // getFulfilledPromisesWithEvidence Tests
  // ============================================

  describe("getFulfilledPromisesWithEvidence", () => {
    it("should return kept and partially kept promises with evidence", async () => {
      const mockPromises = [
        {
          id: "promise-1",
          politicianId: "pol-1",
          electionYear: 2022,
          promiseText: "Kept promise",
          category: "health",
          status: "kept" as PromiseStatus,
          createdAt: new Date(),
          updatedAt: new Date(),
          PromiseEvidence: [
            {
              id: "ev-1",
              type: "legislation" as PromiseEvidenceType,
              description: "Law passed",
              url: "https://example.com",
              date: new Date(),
            },
          ],
          SourceAttribution: [],
        },
        {
          id: "promise-2",
          politicianId: "pol-1",
          electionYear: 2022,
          promiseText: "Partially kept promise",
          category: "economy",
          status: "partially_kept" as PromiseStatus,
          createdAt: new Date(),
          updatedAt: new Date(),
          PromiseEvidence: [],
          SourceAttribution: [],
        },
      ];

      vi.mocked(prisma.campaignPromise.findMany).mockResolvedValue(mockPromises as never);

      const result = await getFulfilledPromisesWithEvidence("pol-1");

      expect(result).toHaveLength(2);
    });
  });

  // ============================================
  // getPromiseCountsByStatus Tests
  // ============================================

  describe("getPromiseCountsByStatus", () => {
    it("should return counts for each status", async () => {
      const mockPromises = [
        { status: "kept" as PromiseStatus },
        { status: "kept" as PromiseStatus },
        { status: "partially_kept" as PromiseStatus },
        { status: "broken" as PromiseStatus },
        { status: "in_progress" as PromiseStatus },
        { status: "not_yet_due" as PromiseStatus },
      ];

      vi.mocked(prisma.campaignPromise.findMany).mockResolvedValue(mockPromises as never);

      const result = await getPromiseCountsByStatus("pol-1");

      expect(result.kept).toBe(2);
      expect(result.partially_kept).toBe(1);
      expect(result.broken).toBe(1);
      expect(result.in_progress).toBe(1);
      expect(result.not_yet_due).toBe(1);
    });

    it("should return zeros for politician with no promises", async () => {
      vi.mocked(prisma.campaignPromise.findMany).mockResolvedValue([]);

      const result = await getPromiseCountsByStatus("pol-no-promises");

      expect(result.kept).toBe(0);
      expect(result.partially_kept).toBe(0);
      expect(result.broken).toBe(0);
      expect(result.in_progress).toBe(0);
      expect(result.not_yet_due).toBe(0);
    });
  });
});
