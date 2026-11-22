import { legacySourceSelect } from "./public-research.service";
/**
 * Campaign Finance Service Unit Tests
 *
 * Tests for campaign finance data management from COMELEC SOCE filings.
 * Validates: Requirements 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.7
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Prisma } from "@prisma/client";
import {
  getCampaignFinanceHistory,
  getCampaignFinance,
  getCampaignFinanceByYear,
  getNotableDonors,
  getTopContributors,
  getExpendituresByCategory,
  getCampaignFinanceSummary,
  hasCampaignFinanceRecords,
  getSpendingLimitViolations,
  checkSpendingCompliance,
  calculateSpendingPercentage,
} from "./campaign-finance.service";
import prisma from "@/lib/prisma";
import { SourceType, DonorType, ContributionType, ExpenditureCategory } from "@prisma/client";

// Mock Prisma client
vi.mock("@/lib/prisma", () => ({
  default: {
    campaignFinance: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    campaignContribution: {
      findMany: vi.fn(),
    },
    campaignExpenditure: {
      groupBy: vi.fn(),
    },
  },
}));

describe("Campaign Finance Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ============================================
  // checkSpendingCompliance Tests
  // ============================================

  describe("checkSpendingCompliance", () => {
    it("should return true when spending is within limit", () => {
      const result = checkSpendingCompliance(5000000, 10000000);
      expect(result).toBe(true);
    });

    it("should return true when spending equals limit", () => {
      const result = checkSpendingCompliance(10000000, 10000000);
      expect(result).toBe(true);
    });

    it("should return false when spending exceeds limit", () => {
      const result = checkSpendingCompliance(15000000, 10000000);
      expect(result).toBe(false);
    });
  });

  // ============================================
  // calculateSpendingPercentage Tests
  // ============================================

  describe("calculateSpendingPercentage", () => {
    it("should calculate percentage correctly", () => {
      const result = calculateSpendingPercentage(5000000, 10000000);
      expect(result).toBe(50);
    });

    it("should handle 100% usage", () => {
      const result = calculateSpendingPercentage(10000000, 10000000);
      expect(result).toBe(100);
    });

    it("should handle over 100% usage", () => {
      const result = calculateSpendingPercentage(15000000, 10000000);
      expect(result).toBe(150);
    });

    it("should return Infinity when limit is zero and spending exists", () => {
      const result = calculateSpendingPercentage(5000000, 0);
      expect(result).toBe(Infinity);
    });

    it("should return 0 when both are zero", () => {
      const result = calculateSpendingPercentage(0, 0);
      expect(result).toBe(0);
    });
  });

  // ============================================
  // getCampaignFinanceHistory Tests
  // ============================================

  describe("getCampaignFinanceHistory", () => {
    it("should return campaign finance records sorted by year descending", async () => {
      const mockRecords = [
        {
          id: "cf-1",
          politicianId: "pol-1",
          electionYear: 2022,
          totalContributions: new Prisma.Decimal(50000000),
          totalExpenditures: new Prisma.Decimal(45000000),
          spendingLimit: new Prisma.Decimal(100000000),
          withinLimit: true,
          CampaignContribution: [
            {
              id: "contrib-1",
              donorName: "ABC Corporation",
              donorType: "corporation" as DonorType,
              amount: new Prisma.Decimal(10000000),
              type: "cash" as ContributionType,
              date: new Date("2022-01-15"),
              isNotableDonor: true,
            },
          ],
          CampaignExpenditure: [
            {
              id: "exp-1",
              category: "advertising" as ExpenditureCategory,
              description: "TV Ads",
              amount: new Prisma.Decimal(20000000),
              date: new Date("2022-02-01"),
            },
          ],
          SourceAttribution: [
            {
              sourceType: "comelec_filing" as SourceType,
              sourceName: "COMELEC SOCE 2022",
              sourceUrl: "https://comelec.gov.ph/soce/2022",
              documentDate: new Date("2022-06-30"),
              retrievedAt: new Date("2022-07-15"),
              confidence: new Prisma.Decimal(0.99),
              isAIProcessed: false,
              originalDocumentId: null,
              fieldName: "campaignFinance",
            },
          ],
        },
        {
          id: "cf-2",
          politicianId: "pol-1",
          electionYear: 2016,
          totalContributions: new Prisma.Decimal(30000000),
          totalExpenditures: new Prisma.Decimal(28000000),
          spendingLimit: new Prisma.Decimal(80000000),
          withinLimit: true,
          CampaignContribution: [],
          CampaignExpenditure: [],
          SourceAttribution: [],
        },
      ];

      vi.mocked(prisma.campaignFinance.findMany).mockResolvedValue(mockRecords as never);

      const history = await getCampaignFinanceHistory("pol-1");

      expect(history).toHaveLength(2);
      expect(history[0]!.electionYear).toBe(2022);
      expect(history[1]!.electionYear).toBe(2016);
      expect(prisma.campaignFinance.findMany).toHaveBeenCalledWith({
        where: { politicianId: "pol-1" },
        orderBy: { electionYear: "desc" },
        include: {
          CampaignContribution: { orderBy: { amount: "desc" } },
          CampaignExpenditure: { orderBy: { amount: "desc" } },
          SourceAttribution: { select: legacySourceSelect },
        },
      });
    });

    it("should include COMELEC SOCE source attribution", async () => {
      const mockRecords = [
        {
          id: "cf-1",
          politicianId: "pol-1",
          electionYear: 2022,
          totalContributions: new Prisma.Decimal(50000000),
          totalExpenditures: new Prisma.Decimal(45000000),
          spendingLimit: new Prisma.Decimal(100000000),
          withinLimit: true,
          CampaignContribution: [],
          CampaignExpenditure: [],
          SourceAttribution: [
            {
              sourceType: "comelec_filing" as SourceType,
              sourceName: "COMELEC SOCE Filing 2022",
              sourceUrl: "https://comelec.gov.ph/soce",
              documentDate: new Date("2022-06-30"),
              retrievedAt: new Date("2022-07-15"),
              confidence: new Prisma.Decimal(0.99),
              isAIProcessed: false,
              originalDocumentId: "soce-2022-001",
              fieldName: "campaignFinance",
            },
          ],
        },
      ];

      vi.mocked(prisma.campaignFinance.findMany).mockResolvedValue(mockRecords as never);

      const history = await getCampaignFinanceHistory("pol-1");

      expect(history[0]!.sources).toHaveLength(1);
      expect(history[0]!.sources[0]!.sourceName).toContain("COMELEC");
      expect(history[0]!.sources[0]!.sourceType).toBe("comelec_filing");
    });

    it("should return empty array for politician with no campaign finance records", async () => {
      vi.mocked(prisma.campaignFinance.findMany).mockResolvedValue([]);

      const history = await getCampaignFinanceHistory("pol-no-records");

      expect(history).toEqual([]);
    });
  });

  // ============================================
  // getCampaignFinance Tests
  // ============================================

  describe("getCampaignFinance", () => {
    it("should return detailed campaign finance record", async () => {
      const mockRecord = {
        id: "cf-1",
        politicianId: "pol-1",
        electionYear: 2022,
        totalContributions: new Prisma.Decimal(50000000),
        totalExpenditures: new Prisma.Decimal(45000000),
        spendingLimit: new Prisma.Decimal(100000000),
        withinLimit: true,
        CampaignContribution: [
          {
            id: "contrib-1",
            donorName: "ABC Corporation",
            donorType: "corporation" as DonorType,
            amount: new Prisma.Decimal(10000000),
            type: "cash" as ContributionType,
            date: new Date("2022-01-15"),
            isNotableDonor: true,
          },
          {
            id: "contrib-2",
            donorName: "John Doe",
            donorType: "individual" as DonorType,
            amount: new Prisma.Decimal(500000),
            type: "cash" as ContributionType,
            date: new Date("2022-01-20"),
            isNotableDonor: false,
          },
        ],
        CampaignExpenditure: [
          {
            id: "exp-1",
            category: "advertising" as ExpenditureCategory,
            description: "TV Advertisements",
            amount: new Prisma.Decimal(20000000),
            date: new Date("2022-02-01"),
          },
          {
            id: "exp-2",
            category: "rallies" as ExpenditureCategory,
            description: "Campaign Rallies",
            amount: new Prisma.Decimal(15000000),
            date: new Date("2022-03-01"),
          },
        ],
        SourceAttribution: [],
      };

      vi.mocked(prisma.campaignFinance.findUnique).mockResolvedValue(mockRecord as never);

      const result = await getCampaignFinance("cf-1");

      expect(result).not.toBeNull();
      expect(result!.contributions).toHaveLength(2);
      expect(result!.expenditures).toHaveLength(2);
      expect(result!.totalContributions).toBe(50000000);
      expect(result!.totalExpenditures).toBe(45000000);
    });

    it("should return null for non-existent record", async () => {
      vi.mocked(prisma.campaignFinance.findUnique).mockResolvedValue(null);

      const result = await getCampaignFinance("non-existent");

      expect(result).toBeNull();
    });
  });

  // ============================================
  // getCampaignFinanceByYear Tests
  // ============================================

  describe("getCampaignFinanceByYear", () => {
    it("should return campaign finance for specific election year", async () => {
      const mockRecord = {
        id: "cf-1",
        politicianId: "pol-1",
        electionYear: 2022,
        totalContributions: new Prisma.Decimal(50000000),
        totalExpenditures: new Prisma.Decimal(45000000),
        spendingLimit: new Prisma.Decimal(100000000),
        withinLimit: true,
        CampaignContribution: [],
        CampaignExpenditure: [],
        SourceAttribution: [],
      };

      vi.mocked(prisma.campaignFinance.findUnique).mockResolvedValue(mockRecord as never);

      const result = await getCampaignFinanceByYear("pol-1", 2022);

      expect(result).not.toBeNull();
      expect(result!.electionYear).toBe(2022);
      expect(prisma.campaignFinance.findUnique).toHaveBeenCalledWith({
        where: {
          politicianId_electionYear: {
            politicianId: "pol-1",
            electionYear: 2022,
          },
        },
        include: {
          CampaignContribution: { orderBy: { amount: "desc" } },
          CampaignExpenditure: { orderBy: { amount: "desc" } },
          SourceAttribution: { select: legacySourceSelect },
        },
      });
    });

    it("should return null when no record exists for year", async () => {
      vi.mocked(prisma.campaignFinance.findUnique).mockResolvedValue(null);

      const result = await getCampaignFinanceByYear("pol-1", 2010);

      expect(result).toBeNull();
    });
  });

  // ============================================
  // getNotableDonors Tests
  // ============================================

  describe("getNotableDonors", () => {
    it("should return notable donors sorted by amount", async () => {
      const mockContributions = [
        {
          id: "contrib-1",
          donorName: "Big Corporation",
          donorType: "corporation" as DonorType,
          amount: new Prisma.Decimal(50000000),
          type: "cash" as ContributionType,
          date: new Date("2022-01-15"),
          isNotableDonor: true,
        },
        {
          id: "contrib-2",
          donorName: "Wealthy Individual",
          donorType: "individual" as DonorType,
          amount: new Prisma.Decimal(10000000),
          type: "cash" as ContributionType,
          date: new Date("2022-01-20"),
          isNotableDonor: true,
        },
      ];

      vi.mocked(prisma.campaignContribution.findMany).mockResolvedValue(mockContributions as never);

      const donors = await getNotableDonors("pol-1");

      expect(donors).toHaveLength(2);
      expect(donors[0]!.donorName).toBe("Big Corporation");
      expect(donors[0]!.isNotableDonor).toBe(true);
    });

    it("should filter by election year when provided", async () => {
      vi.mocked(prisma.campaignContribution.findMany).mockResolvedValue([]);

      await getNotableDonors("pol-1", 2022);

      expect(prisma.campaignContribution.findMany).toHaveBeenCalledWith({
        where: {
          CampaignFinance: {
            politicianId: "pol-1",
            electionYear: 2022,
          },
          isNotableDonor: true,
        },
        orderBy: { amount: "desc" },
      });
    });
  });

  // ============================================
  // getTopContributors Tests
  // ============================================

  describe("getTopContributors", () => {
    it("should return top contributors with default limit", async () => {
      const mockContributions = Array.from({ length: 10 }, (_, i) => ({
        id: `contrib-${i}`,
        donorName: `Donor ${i}`,
        donorType: "individual" as DonorType,
        amount: new Prisma.Decimal((10 - i) * 1000000),
        type: "cash" as ContributionType,
        date: new Date("2022-01-15"),
        isNotableDonor: i < 5,
      }));

      vi.mocked(prisma.campaignContribution.findMany).mockResolvedValue(mockContributions as never);

      const contributors = await getTopContributors("pol-1");

      expect(contributors).toHaveLength(10);
      expect(prisma.campaignContribution.findMany).toHaveBeenCalledWith({
        where: {
          CampaignFinance: {
            politicianId: "pol-1",
          },
        },
        orderBy: { amount: "desc" },
        take: 10,
      });
    });

    it("should respect custom limit", async () => {
      vi.mocked(prisma.campaignContribution.findMany).mockResolvedValue([]);

      await getTopContributors("pol-1", 5);

      expect(prisma.campaignContribution.findMany).toHaveBeenCalledWith({
        where: {
          CampaignFinance: {
            politicianId: "pol-1",
          },
        },
        orderBy: { amount: "desc" },
        take: 5,
      });
    });
  });

  // ============================================
  // getExpendituresByCategory Tests
  // ============================================

  describe("getExpendituresByCategory", () => {
    it("should return expenditure totals by category", async () => {
      const mockGrouped = [
        {
          category: "advertising" as ExpenditureCategory,
          _sum: { amount: new Prisma.Decimal(30000000) },
        },
        {
          category: "rallies" as ExpenditureCategory,
          _sum: { amount: new Prisma.Decimal(20000000) },
        },
        {
          category: "materials" as ExpenditureCategory,
          _sum: { amount: new Prisma.Decimal(10000000) },
        },
      ];

      vi.mocked(prisma.campaignExpenditure.groupBy).mockResolvedValue(mockGrouped as never);

      const categories = await getExpendituresByCategory("pol-1");

      expect(categories).toHaveLength(3);
      expect(categories[0]!.category).toBe("advertising");
      expect(categories[0]!.total).toBe(30000000);
    });

    it("should filter by election year when provided", async () => {
      vi.mocked(prisma.campaignExpenditure.groupBy).mockResolvedValue([]);

      await getExpendituresByCategory("pol-1", 2022);

      expect(prisma.campaignExpenditure.groupBy).toHaveBeenCalledWith({
        by: ["category"],
        where: {
          CampaignFinance: {
            politicianId: "pol-1",
            electionYear: 2022,
          },
        },
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
      });
    });
  });

  // ============================================
  // getCampaignFinanceSummary Tests
  // ============================================

  describe("getCampaignFinanceSummary", () => {
    it("should return summary with top contributors and expenditure categories", async () => {
      const mockRecord = {
        id: "cf-1",
        politicianId: "pol-1",
        electionYear: 2022,
        totalContributions: new Prisma.Decimal(50000000),
        totalExpenditures: new Prisma.Decimal(45000000),
        spendingLimit: new Prisma.Decimal(100000000),
        withinLimit: true,
        CampaignContribution: [
          {
            id: "contrib-1",
            donorName: "Notable Donor 1",
            donorType: "corporation" as DonorType,
            amount: new Prisma.Decimal(20000000),
            type: "cash" as ContributionType,
            date: new Date("2022-01-15"),
            isNotableDonor: true,
          },
          {
            id: "contrib-2",
            donorName: "Notable Donor 2",
            donorType: "individual" as DonorType,
            amount: new Prisma.Decimal(10000000),
            type: "cash" as ContributionType,
            date: new Date("2022-01-20"),
            isNotableDonor: true,
          },
          {
            id: "contrib-3",
            donorName: "Small Donor",
            donorType: "individual" as DonorType,
            amount: new Prisma.Decimal(100000),
            type: "cash" as ContributionType,
            date: new Date("2022-01-25"),
            isNotableDonor: false,
          },
        ],
        CampaignExpenditure: [
          {
            id: "exp-1",
            category: "advertising" as ExpenditureCategory,
            description: "TV Ads",
            amount: new Prisma.Decimal(20000000),
            date: new Date("2022-02-01"),
          },
          {
            id: "exp-2",
            category: "advertising" as ExpenditureCategory,
            description: "Radio Ads",
            amount: new Prisma.Decimal(5000000),
            date: new Date("2022-02-15"),
          },
          {
            id: "exp-3",
            category: "rallies" as ExpenditureCategory,
            description: "Campaign Rallies",
            amount: new Prisma.Decimal(15000000),
            date: new Date("2022-03-01"),
          },
        ],
        SourceAttribution: [],
      };

      vi.mocked(prisma.campaignFinance.findUnique).mockResolvedValue(mockRecord as never);

      const summary = await getCampaignFinanceSummary("pol-1", 2022);

      expect(summary).not.toBeNull();
      expect(summary!.topContributors).toHaveLength(2); // Only notable donors
      expect(summary!.topExpenditureCategories).toHaveLength(2);
      expect(summary!.topExpenditureCategories[0]!.category).toBe("advertising");
      expect(summary!.topExpenditureCategories[0]!.total).toBe(25000000); // 20M + 5M
    });

    it("should return null when no record exists", async () => {
      vi.mocked(prisma.campaignFinance.findUnique).mockResolvedValue(null);

      const summary = await getCampaignFinanceSummary("pol-1", 2010);

      expect(summary).toBeNull();
    });
  });

  // ============================================
  // hasCampaignFinanceRecords Tests
  // ============================================

  describe("hasCampaignFinanceRecords", () => {
    it("should return true when records exist", async () => {
      vi.mocked(prisma.campaignFinance.count).mockResolvedValue(3);

      const result = await hasCampaignFinanceRecords("pol-1");

      expect(result).toBe(true);
    });

    it("should return false when no records exist", async () => {
      vi.mocked(prisma.campaignFinance.count).mockResolvedValue(0);

      const result = await hasCampaignFinanceRecords("pol-1");

      expect(result).toBe(false);
    });
  });

  // ============================================
  // getSpendingLimitViolations Tests
  // ============================================

  describe("getSpendingLimitViolations", () => {
    it("should return records where spending exceeded limits", async () => {
      const mockRecords = [
        {
          id: "cf-1",
          politicianId: "pol-1",
          electionYear: 2022,
          totalContributions: new Prisma.Decimal(150000000),
          totalExpenditures: new Prisma.Decimal(120000000),
          spendingLimit: new Prisma.Decimal(100000000),
          withinLimit: false,
          CampaignContribution: [],
          CampaignExpenditure: [],
          SourceAttribution: [],
        },
      ];

      vi.mocked(prisma.campaignFinance.findMany).mockResolvedValue(mockRecords as never);

      const violations = await getSpendingLimitViolations();

      expect(violations).toHaveLength(1);
      expect(violations[0]!.withinLimit).toBe(false);
      expect(violations[0]!.totalExpenditures).toBeGreaterThan(violations[0]!.spendingLimit);
    });

    it("should filter by election year when provided", async () => {
      vi.mocked(prisma.campaignFinance.findMany).mockResolvedValue([]);

      await getSpendingLimitViolations(2022);

      expect(prisma.campaignFinance.findMany).toHaveBeenCalledWith({
        where: {
          withinLimit: false,
          electionYear: 2022,
        },
        include: {
          CampaignContribution: { orderBy: { amount: "desc" } },
          CampaignExpenditure: { orderBy: { amount: "desc" } },
          SourceAttribution: { select: legacySourceSelect },
        },
      });
    });
  });
});
