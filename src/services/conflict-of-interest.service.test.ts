/**
 * Unit Tests for Conflict of Interest Detection Service
 * Validates: Requirements 29.1, 29.2, 29.3, 29.4, 29.5, 29.6, 29.7
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { BillAuthorRole } from "@prisma/client";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  default: {
    sALNRecord: { findMany: vi.fn() },
    billAuthor: { findMany: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import {
  classifyIndustry,
  areIndustriesRelated,
  extractBusinessInterests,
  detectBillConflicts,
  detectCommitteeConflicts,
  detectConflictsOfInterest,
  generateConflictReport,
} from "./conflict-of-interest.service";

describe("Conflict of Interest Detection Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("classifyIndustry", () => {
    it("should classify agriculture-related text", () => {
      expect(classifyIndustry("Rice farming corporation")).toBe("agriculture");
      expect(classifyIndustry("Coconut plantation")).toBe("agriculture");
    });

    it("should classify banking-related text", () => {
      expect(classifyIndustry("Rural Bank of Manila")).toBe("banking");
      expect(classifyIndustry("Financial services company")).toBe("banking");
    });

    it("should classify healthcare-related text", () => {
      expect(classifyIndustry("Medical Center Inc")).toBe("healthcare");
      expect(classifyIndustry("Pharmaceutical company")).toBe("healthcare");
    });

    it("should return 'other' for unclassified text", () => {
      expect(classifyIndustry("Generic company xyz")).toBe("other");
    });
  });

  describe("areIndustriesRelated", () => {
    it("should return true for same industry", () => {
      expect(areIndustriesRelated("banking", "banking")).toBe(true);
      expect(areIndustriesRelated("healthcare", "healthcare")).toBe(true);
    });

    it("should return true for related industries", () => {
      expect(areIndustriesRelated("technology", "telecommunications")).toBe(true);
      expect(areIndustriesRelated("telecommunications", "technology")).toBe(true);
    });

    it("should return false for unrelated industries", () => {
      expect(areIndustriesRelated("agriculture", "banking")).toBe(false);
      expect(areIndustriesRelated("healthcare", "mining")).toBe(false);
    });
  });

  describe("extractBusinessInterests", () => {
    it("should extract and classify business interests", () => {
      const investments = [
        {
          id: "inv-1",
          description: "Rural Bank shares",
          value: { toNumber: () => 5000000 },
          salnRecord: { year: 2023 },
        },
        {
          id: "inv-2",
          description: "Rice mill investment",
          value: 2000000,
          salnRecord: { year: 2023 },
        },
      ];

      const result = extractBusinessInterests(investments);

      expect(result).toHaveLength(2);
      expect(result[0]!.industry).toBe("banking");
      expect(result[1]!.industry).toBe("agriculture");
    });
  });

  describe("detectBillConflicts", () => {
    it("should detect conflicts when industries match", () => {
      const businessInterests = [
        {
          id: "bi-1",
          description: "Bank shares",
          value: 5000000,
          industry: "banking",
          salnYear: 2023,
        },
      ];

      const bills = [
        {
          id: "bill-1",
          title: "Banking Reform Act",
          summary: "A bill to reform the banking sector",
          role: "principal_author" as BillAuthorRole,
        },
      ];

      const conflicts = detectBillConflicts(businessInterests, bills);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]!.type).toBe("bill_authorship");
      expect(conflicts[0]!.businessInterest.id).toBe("bi-1");
      expect(conflicts[0]!.relatedEntity.id).toBe("bill-1");
    });

    it("should not detect conflicts when industries don't match", () => {
      const businessInterests = [
        {
          id: "bi-1",
          description: "Farm",
          value: 1000000,
          industry: "agriculture",
          salnYear: 2023,
        },
      ];

      const bills = [
        {
          id: "bill-1",
          title: "Education Reform Act",
          summary: "A bill about schools",
          role: "principal_author" as BillAuthorRole,
        },
      ];

      const conflicts = detectBillConflicts(businessInterests, bills);

      expect(conflicts).toHaveLength(0);
    });

    it("should assign higher severity for high-value principal authorship", () => {
      const businessInterests = [
        {
          id: "bi-1",
          description: "Bank",
          value: 15000000, // > 10M
          industry: "banking",
          salnYear: 2023,
        },
      ];

      const bills = [
        {
          id: "bill-1",
          title: "Banking Act",
          summary: "Financial reform",
          role: "principal_author" as BillAuthorRole,
        },
      ];

      const conflicts = detectBillConflicts(businessInterests, bills);

      expect(conflicts[0]!.severity).toBe("high");
    });
  });

  describe("detectCommitteeConflicts", () => {
    it("should detect conflicts when committee matches business interest", () => {
      const businessInterests = [
        {
          id: "bi-1",
          description: "Energy company",
          value: 5000000,
          industry: "energy",
          salnYear: 2023,
        },
      ];

      const committees = [
        {
          id: "comm-1",
          name: "Committee on Energy",
          role: "Chairperson",
          industry: "energy",
        },
      ];

      const conflicts = detectCommitteeConflicts(businessInterests, committees);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]!.type).toBe("committee_assignment");
    });
  });

  describe("detectConflictsOfInterest", () => {
    it("should return no conflicts when no business interests", async () => {
      vi.mocked(prisma.sALNRecord.findMany).mockResolvedValue([]);
      vi.mocked(prisma.billAuthor.findMany).mockResolvedValue([]);

      const result = await detectConflictsOfInterest("pol-1");

      expect(result.hasConflicts).toBe(false);
      expect(result.conflicts).toHaveLength(0);
      expect(result.disclaimer).toBeTruthy();
    });

    it("should detect conflicts when matching interests and bills exist", async () => {
      vi.mocked(prisma.sALNRecord.findMany).mockResolvedValue([
        {
          id: "saln-1",
          politicianId: "pol-1",
          year: 2023,
          totalAssets: 10000000 as unknown as import("@prisma/client").Prisma.Decimal,
          totalLiabilities: 0 as unknown as import("@prisma/client").Prisma.Decimal,
          netWorth: 10000000 as unknown as import("@prisma/client").Prisma.Decimal,
          declaredSalary: null,
          anomalyDetected: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          SALNInvestment: [
            {
              id: "inv-1",
              salnRecordId: "saln-1",
              description: "Bank shares",
              value: 5000000 as unknown as import("@prisma/client").Prisma.Decimal,
              createdAt: new Date(),
            },
          ],
        },
      ] as never);

      vi.mocked(prisma.billAuthor.findMany).mockResolvedValue([
        {
          id: "ba-1",
          billId: "bill-1",
          politicianId: "pol-1",
          role: "principal_author",
          createdAt: new Date(),
          Bill: {
            id: "bill-1",
            title: "Banking Reform Act",
            summary: "Reform the financial sector",
          },
        },
      ] as never);

      const result = await detectConflictsOfInterest("pol-1");

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts.length).toBeGreaterThan(0);
    });
  });

  describe("generateConflictReport", () => {
    it("should generate report for no conflicts", () => {
      const result = {
        politicianId: "pol-1",
        hasConflicts: false,
        conflicts: [],
        businessInterests: [],
        billsAnalyzed: 5,
        committeesAnalyzed: 2,
        lastAnalyzedAt: new Date(),
        disclaimer: "Test disclaimer",
      };

      const report = generateConflictReport(result);

      expect(report).toContain("No potential conflicts");
    });

    it("should generate detailed report for conflicts", () => {
      const result = {
        politicianId: "pol-1",
        hasConflicts: true,
        conflicts: [
          {
            id: "c-1",
            type: "bill_authorship" as const,
            businessInterest: {
              id: "bi-1",
              description: "Bank shares",
              value: 5000000,
              industry: "banking",
              salnYear: 2023,
            },
            relatedEntity: {
              id: "bill-1",
              name: "Banking Act",
              description: "Reform bill",
            },
            conflictNature: "Authored banking bill while owning bank shares",
            severity: "medium" as const,
            detectedAt: new Date(),
          },
        ],
        businessInterests: [],
        billsAnalyzed: 5,
        committeesAnalyzed: 2,
        lastAnalyzedAt: new Date(),
        disclaimer: "Test disclaimer",
      };

      const report = generateConflictReport(result);

      expect(report).toContain("1 potential conflict");
      expect(report).toContain("Bank shares");
      expect(report).toContain("Banking Act");
    });
  });
});
