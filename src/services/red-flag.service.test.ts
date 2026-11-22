/**
 * Red Flag Service Unit Tests
 *
 * Tests for red flag detection, severity assignment, and aggregation.
 * Validates: Requirements 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  RedFlagType,
  RedFlagSeverity,
  ControversyStatus,
  ControversyCategory,
  SourceType,
} from "@prisma/client";
import {
  determineLegalCaseSeverity,
  determineCorruptionSeverity,
  determineSALNAnomalySeverity,
  determineDynastySeverity,
  getRedFlags,
  getRedFlagsByType,
  getRedFlagsBySeverity,
  getRedFlagSummary,
  generateRedFlags,
  hasRedFlags,
  getRedFlagCount,
  getRedFlagCountsBatch,
  getHighestSeverity,
  validateDynastyOnlySeverity,
  generateLegalCaseRedFlags,
  generateCorruptionRedFlags,
  generateDynastyRedFlag,
  generateSALNAnomalyRedFlags,
} from "./red-flag.service";
import prisma from "@/lib/prisma";
import { caseFixture, sealCase } from "../test/fixtures/case-review";
import { legacySourceSelect } from "./public-research.service";
import * as electionService from "./election.service";
import * as salnService from "./saln.service";
import * as familyNetworkService from "./family-network.service";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  default: {
    controversy: { findMany: vi.fn() },
    redFlag: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

// Mock dependent services
vi.mock("./election.service", () => ({
  getControversies: vi.fn(),
}));

vi.mock("./saln.service", () => ({
  getSALNAnomalies: vi.fn(),
}));

vi.mock("./family-network.service", () => ({
  getFamilyNetwork: vi.fn(),
}));

describe("Red Flag Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("PUBLIC_CASE_RECORDS_ENABLED", "true");
    vi.mocked(prisma.redFlag.findMany).mockResolvedValue([]);
    vi.mocked(prisma.controversy.findMany).mockImplementation((async () => {
      const raw = vi.mocked(prisma.redFlag.findMany).getMockImplementation();
      const flags = raw ? await raw({}) : [];
      return (flags ?? [])
        .filter((f) => f.type === "legal_case" || f.type === "corruption")
        .map((f, i) => {
          const p = caseFixture();
          p.record.id = `case-${i}`;
          p.record.politicianId = f.politicianId;
          p.record.category = f.type === "corruption" ? "corruption" : "legal_case";
          p.events[0]!.controversyId = p.record.id;
          p.events[0]!.kind = f.severity === "warning" ? "status_report" : "judgment";
          p.events[0]!.outcome = f.severity === "warning" ? "pending" : "convicted";
          p.sources.forEach((source) => {
            source.controversyId = p.record.id;
          });
          sealCase(p);
          return { ...p.record, CaseEvent: p.events, SourceAttribution: p.sources };
        });
    }) as never);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ============================================
  // Severity Determination Tests
  // ============================================

  describe("determineLegalCaseSeverity", () => {
    /**
     * Validates: Requirement 18.6 - Categorize by severity
     */
    it("should return 'critical' for convicted status", () => {
      expect(determineLegalCaseSeverity("convicted")).toBe("critical");
    });

    it("should return 'warning' for ongoing status", () => {
      expect(determineLegalCaseSeverity("ongoing")).toBe("warning");
    });

    it("should return 'info' for dismissed status", () => {
      expect(determineLegalCaseSeverity("dismissed")).toBe("info");
    });

    it("should return 'info' for acquitted status", () => {
      expect(determineLegalCaseSeverity("acquitted")).toBe("info");
    });

    it("should return 'info' for settled status", () => {
      expect(determineLegalCaseSeverity("settled")).toBe("info");
    });
  });

  describe("determineCorruptionSeverity", () => {
    /**
     * Validates: Requirement 18.2 - Show corruption allegations with sources
     */
    it("should return 'critical' for convicted corruption", () => {
      expect(determineCorruptionSeverity("convicted")).toBe("critical");
    });

    it("should return 'warning' for ongoing corruption allegations", () => {
      expect(determineCorruptionSeverity("ongoing")).toBe("warning");
    });

    it("should return 'info' for dismissed corruption cases", () => {
      expect(determineCorruptionSeverity("dismissed")).toBe("info");
    });
  });

  describe("determineSALNAnomalySeverity", () => {
    /**
     * Validates: Requirement 18.4 - Flag SALN anomalies
     */
    it("should return 'critical' for very high anomaly ratio (>= 5)", () => {
      expect(determineSALNAnomalySeverity(5)).toBe("critical");
      expect(determineSALNAnomalySeverity(10)).toBe("critical");
    });

    it("should return 'warning' for standard anomaly ratio (< 5)", () => {
      expect(determineSALNAnomalySeverity(1.5)).toBe("warning");
      expect(determineSALNAnomalySeverity(3)).toBe("warning");
      expect(determineSALNAnomalySeverity(4.9)).toBe("warning");
    });
  });

  describe("determineDynastySeverity", () => {
    /**
     * Validates: Requirement 18.7 - Dynasty-only = info severity
     */
    it("should always return 'info' for dynasty indicators", () => {
      expect(determineDynastySeverity()).toBe("info");
    });
  });

  // ============================================
  // Red Flag Generation Tests
  // ============================================

  describe("generateLegalCaseRedFlags", () => {
    /**
     * Validates: Requirement 18.1 - Display red flag indicators for legal cases
     */
    it("should generate red flags for legal cases", async () => {
      const mockControversies = [
        {
          id: "case-1",
          politicianId: "pol-1",
          title: "Tax Evasion Case",
          description: "Alleged tax evasion",
          category: "legal_case" as ControversyCategory,
          status: "ongoing" as ControversyStatus,
          filingDate: new Date("2023-01-15"),
          resolutionDate: null,
          court: "Tax Court",
          caseNumber: "TC-2023-001",
          sources: [],
          hasVerifiedSources: true,
        },
      ];

      vi.mocked(electionService.getControversies).mockResolvedValue(mockControversies);

      const flags = await generateLegalCaseRedFlags("pol-1");

      expect(flags).toHaveLength(1);
      expect(flags[0]!.type).toBe("legal_case");
      expect(flags[0]!.severity).toBe("warning"); // ongoing = warning
      expect(flags[0]!.title).toContain("Ongoing Legal Case");
      expect(flags[0]!.relatedEntityId).toBe("case-1");
    });

    it("should not include corruption cases in legal case flags", async () => {
      const mockControversies = [
        {
          id: "case-1",
          politicianId: "pol-1",
          title: "Bribery Case",
          description: "Alleged bribery",
          category: "corruption" as ControversyCategory,
          status: "ongoing" as ControversyStatus,
          filingDate: null,
          resolutionDate: null,
          court: null,
          caseNumber: null,
          sources: [],
          hasVerifiedSources: true,
        },
      ];

      vi.mocked(electionService.getControversies).mockResolvedValue(mockControversies);

      const flags = await generateLegalCaseRedFlags("pol-1");

      expect(flags).toHaveLength(0);
    });
  });

  describe("generateCorruptionRedFlags", () => {
    /**
     * Validates: Requirement 18.2 - Show corruption allegations with sources
     */
    it("should generate red flags for corruption cases", async () => {
      const mockControversies = [
        {
          id: "corruption-1",
          politicianId: "pol-1",
          title: "Bribery Scandal",
          description: "Alleged bribery involving government contracts",
          category: "corruption" as ControversyCategory,
          status: "convicted" as ControversyStatus,
          filingDate: new Date("2022-06-01"),
          resolutionDate: new Date("2023-12-01"),
          court: "Sandiganbayan",
          caseNumber: "SB-2022-123",
          sources: [
            {
              sourceType: "court_document" as SourceType,
              sourceName: "Sandiganbayan Decision",
              sourceUrl: "https://example.com/decision",
              documentDate: new Date("2023-12-01"),
              retrievedAt: new Date(),
              confidence: 0.95,
              isAIProcessed: false,
              originalDocumentId: null,
            },
          ],
          hasVerifiedSources: true,
        },
      ];

      vi.mocked(electionService.getControversies).mockResolvedValue(mockControversies);

      const flags = await generateCorruptionRedFlags("pol-1");

      expect(flags).toHaveLength(1);
      expect(flags[0]!.type).toBe("corruption");
      expect(flags[0]!.severity).toBe("critical"); // convicted = critical
      expect(flags[0]!.title).toContain("Corruption Case");
      expect(flags[0]!.sources).toHaveLength(1);
    });
  });

  describe("generateDynastyRedFlag", () => {
    /**
     * Validates: Requirements 18.3, 18.7
     * - Indicate dynasty patterns
     * - Dynasty-only = info severity
     */
    it("should generate dynasty red flag when politician is part of dynasty", async () => {
      const mockFamilyNetwork = {
        politicianId: "pol-1",
        politicianName: "Juan Dela Cruz",
        familyMembers: [
          {
            id: "rel-1",
            politicianId: "pol-2",
            fullName: "Maria Dela Cruz",
            photo: null,
            relationshipType: "spouse" as const,
            positions: [
              {
                id: "pos-1",
                title: "Mayor",
                level: "municipal" as const,
                jurisdiction: "Sample Town",
                startDate: new Date("2019-06-30"),
                endDate: null,
                isCurrent: true,
              },
            ],
            isInDatabase: true,
            sources: [],
          },
        ],
        totalFamilyMembersInPolitics: 1,
        concurrentPositions: 1,
        sequentialPositions: 0,
        positionOverlaps: [],
        isDynasty: true,
        dynastySeverity: "info" as const,
      };

      vi.mocked(familyNetworkService.getFamilyNetwork).mockResolvedValue(mockFamilyNetwork);

      const flag = await generateDynastyRedFlag("pol-1");

      expect(flag).not.toBeNull();
      expect(flag!.type).toBe("dynasty");
      expect(flag!.severity).toBe("info"); // Always info per Requirement 18.7
      expect(flag!.title).toBe("Political Dynasty Member");
      expect(flag!.description).toContain("1 family member(s) in politics");
    });

    it("should return null when politician is not part of dynasty", async () => {
      const mockFamilyNetwork = {
        politicianId: "pol-1",
        politicianName: "Juan Dela Cruz",
        familyMembers: [],
        totalFamilyMembersInPolitics: 0,
        concurrentPositions: 0,
        sequentialPositions: 0,
        positionOverlaps: [],
        isDynasty: false,
        dynastySeverity: "none" as const,
      };

      vi.mocked(familyNetworkService.getFamilyNetwork).mockResolvedValue(mockFamilyNetwork);

      const flag = await generateDynastyRedFlag("pol-1");

      expect(flag).toBeNull();
    });
  });

  describe("generateSALNAnomalyRedFlags", () => {
    /**
     * Validates: Requirement 18.4 - Flag SALN anomalies
     */
    it("should generate red flags for SALN anomalies", async () => {
      const mockAnomalies = [
        {
          id: "saln-1",
          politicianId: "pol-1",
          year: 2023,
          totalAssets: 50000000,
          totalLiabilities: 5000000,
          netWorth: 45000000,
          declaredSalary: 500000,
          anomalyDetected: true,
          anomalyDetails: {
            yearOverYearChange: 150,
            expectedMaxChange: 20,
            anomalyRatio: 7.5,
            explanation: "Net worth increased by 150%, which is 7.5x the expected maximum change.",
          },
          realProperties: [],
          personalProperties: [],
          investments: [],
          sources: [],
        },
      ];

      vi.mocked(salnService.getSALNAnomalies).mockResolvedValue(mockAnomalies);

      const flags = await generateSALNAnomalyRedFlags("pol-1");

      expect(flags).toHaveLength(1);
      expect(flags[0]!.type).toBe("saln_anomaly");
      expect(flags[0]!.severity).toBe("critical"); // anomalyRatio >= 5 = critical
      expect(flags[0]!.title).toContain("SALN Anomaly Detected (2023)");
    });
  });

  // ============================================
  // Red Flag Query Tests
  // ============================================

  describe("getRedFlags", () => {
    /**
     * Validates: Requirements 18.1, 18.2, 18.3, 18.4, 18.5, 18.6
     */
    it("should return all red flags for a politician", async () => {
      const mockRedFlags = [
        {
          id: "flag-1",
          politicianId: "pol-1",
          type: "legal_case" as RedFlagType,
          severity: "warning" as RedFlagSeverity,
          title: "Ongoing Case",
          description: "Test description",
          relatedEntityId: "case-1",
          relatedEntityType: "Controversy",
          createdAt: new Date(),
          updatedAt: new Date(),
          SourceAttribution: [],
        },
        {
          id: "flag-2",
          politicianId: "pol-1",
          type: "dynasty" as RedFlagType,
          severity: "info" as RedFlagSeverity,
          title: "Political Dynasty",
          description: "Part of political family",
          relatedEntityId: null,
          relatedEntityType: "FamilyNetwork",
          createdAt: new Date(),
          updatedAt: new Date(),
          SourceAttribution: [],
        },
      ];

      vi.mocked(prisma.redFlag.findMany).mockResolvedValue(mockRedFlags);

      const flags = await getRedFlags("pol-1");

      expect(flags).toHaveLength(2);
      expect(prisma.redFlag.findMany).toHaveBeenCalledWith({
        where: { politicianId: { in: ["pol-1"] } },
        orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
        include: { SourceAttribution: { select: legacySourceSelect } },
      });
    });
  });

  describe("getRedFlagsByType", () => {
    /**
     * Validates: Requirement 18.6 - Distinguish between different types
     */
    it("should filter red flags by type", async () => {
      const mockRedFlags = [
        {
          id: "flag-1",
          politicianId: "pol-1",
          type: "legal_case" as RedFlagType,
          severity: "warning" as RedFlagSeverity,
          title: "Legal Case",
          description: "Test",
          relatedEntityId: null,
          relatedEntityType: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          SourceAttribution: [],
        },
        {
          id: "flag-2",
          politicianId: "pol-1",
          type: "dynasty" as RedFlagType,
          severity: "info" as RedFlagSeverity,
          title: "Dynasty",
          description: "Test",
          relatedEntityId: null,
          relatedEntityType: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          SourceAttribution: [],
        },
      ];

      vi.mocked(prisma.redFlag.findMany).mockResolvedValue(mockRedFlags);

      const flags = await getRedFlagsByType("pol-1", "legal_case");

      expect(flags).toHaveLength(1);
      expect(flags[0]!.type).toBe("legal_case");
    });
  });

  describe("getRedFlagsBySeverity", () => {
    /**
     * Validates: Requirement 18.6 - Categorize by severity
     */
    it("should filter red flags by severity", async () => {
      const mockRedFlags = [
        {
          id: "flag-1",
          politicianId: "pol-1",
          type: "corruption" as RedFlagType,
          severity: "critical" as RedFlagSeverity,
          title: "Corruption",
          description: "Test",
          relatedEntityId: null,
          relatedEntityType: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          SourceAttribution: [],
        },
        {
          id: "flag-2",
          politicianId: "pol-1",
          type: "dynasty" as RedFlagType,
          severity: "info" as RedFlagSeverity,
          title: "Dynasty",
          description: "Test",
          relatedEntityId: null,
          relatedEntityType: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          SourceAttribution: [],
        },
      ];

      vi.mocked(prisma.redFlag.findMany).mockResolvedValue(mockRedFlags);

      const flags = await getRedFlagsBySeverity("pol-1", "critical");

      expect(flags).toHaveLength(1);
      expect(flags[0]!.severity).toBe("critical");
    });
  });

  // ============================================
  // Red Flag Summary Tests
  // ============================================

  describe("getRedFlagSummary", () => {
    /**
     * Validates: Requirement 18.8 - Show red flag count in listings
     */
    it("should return correct summary with counts by type and severity", async () => {
      const mockRedFlags = [
        {
          id: "flag-1",
          politicianId: "pol-1",
          type: "legal_case" as RedFlagType,
          severity: "warning" as RedFlagSeverity,
          title: "Legal Case",
          description: "Test",
          relatedEntityId: null,
          relatedEntityType: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          SourceAttribution: [],
        },
        {
          id: "flag-2",
          politicianId: "pol-1",
          type: "corruption" as RedFlagType,
          severity: "critical" as RedFlagSeverity,
          title: "Corruption",
          description: "Test",
          relatedEntityId: null,
          relatedEntityType: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          SourceAttribution: [],
        },
        {
          id: "flag-3",
          politicianId: "pol-1",
          type: "dynasty" as RedFlagType,
          severity: "info" as RedFlagSeverity,
          title: "Dynasty",
          description: "Test",
          relatedEntityId: null,
          relatedEntityType: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          SourceAttribution: [],
        },
      ];

      vi.mocked(prisma.redFlag.findMany).mockResolvedValue(mockRedFlags);

      const summary = await getRedFlagSummary("pol-1");

      expect(summary.totalCount).toBe(3);
      expect(summary.byType.legal_case).toBe(1);
      expect(summary.byType.corruption).toBe(1);
      expect(summary.byType.dynasty).toBe(1);
      expect(summary.byType.saln_anomaly).toBe(0);
      expect(summary.bySeverity.critical).toBe(1);
      expect(summary.bySeverity.warning).toBe(1);
      expect(summary.bySeverity.info).toBe(1);
      expect(summary.hasLegalCases).toBe(true);
      expect(summary.hasCorruption).toBe(true);
      expect(summary.hasDynasty).toBe(true);
      expect(summary.hasSALNAnomalies).toBe(false);
    });
  });

  // ============================================
  // Red Flag Count Tests
  // ============================================

  describe("getRedFlagCount", () => {
    /**
     * Validates: Requirement 18.8 - Show red flag count in listings
     */
    it("should return the count of red flags", async () => {
      vi.mocked(prisma.redFlag.findMany).mockResolvedValue(nonCaseFlags("pol-1", 5));

      const count = await getRedFlagCount("pol-1");

      expect(count).toBe(5);
      expect(prisma.redFlag.count).not.toHaveBeenCalled();
    });
  });

  describe("getRedFlagCountsBatch", () => {
    /**
     * Validates: Requirement 18.8 - Show red flag count in listings
     */
    it("should return counts for multiple politicians", async () => {
      vi.mocked(prisma.redFlag.findMany).mockResolvedValue([
        ...nonCaseFlags("pol-1", 3),
        ...nonCaseFlags("pol-3", 1),
      ]);

      const counts = await getRedFlagCountsBatch(["pol-1", "pol-2", "pol-3"]);

      expect(counts.get("pol-1")).toBe(3);
      expect(counts.get("pol-2")).toBe(0); // No flags
      expect(counts.get("pol-3")).toBe(1);
    });
  });

  // ============================================
  // Highest Severity Tests
  // ============================================

  describe("getHighestSeverity", () => {
    it("should return the highest severity red flag", async () => {
      vi.mocked(prisma.redFlag.findMany).mockResolvedValue([
        { ...nonCaseFlags("pol-1", 1)[0]!, severity: "critical" },
      ]);

      const severity = await getHighestSeverity("pol-1");

      expect(severity).toBe("critical");
    });

    it("should return null when no red flags exist", async () => {
      vi.mocked(prisma.redFlag.findMany).mockResolvedValue([]);

      const severity = await getHighestSeverity("pol-1");

      expect(severity).toBeNull();
    });
  });

  // ============================================
  // Dynasty-Only Validation Tests
  // ============================================

  describe("validateDynastyOnlySeverity", () => {
    /**
     * Validates: Requirement 18.7 - Dynasty indicators without corruption/legal issues
     * must have severity 'info' (not 'warning' or 'critical')
     */
    it("should return true for dynasty-only politician with info severity", async () => {
      const mockRedFlags = [
        {
          id: "flag-1",
          politicianId: "pol-1",
          type: "dynasty" as RedFlagType,
          severity: "info" as RedFlagSeverity,
          title: "Dynasty",
          description: "Test",
          relatedEntityId: null,
          relatedEntityType: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          SourceAttribution: [],
        },
      ];

      vi.mocked(prisma.redFlag.findMany).mockResolvedValue(mockRedFlags);

      const isValid = await validateDynastyOnlySeverity("pol-1");

      expect(isValid).toBe(true);
    });

    it("should return true for politician with multiple flag types", async () => {
      // When politician has other flags besides dynasty, validation doesn't apply
      const mockRedFlags = [
        {
          id: "flag-1",
          politicianId: "pol-1",
          type: "dynasty" as RedFlagType,
          severity: "info" as RedFlagSeverity,
          title: "Dynasty",
          description: "Test",
          relatedEntityId: null,
          relatedEntityType: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          SourceAttribution: [],
        },
        {
          id: "flag-2",
          politicianId: "pol-1",
          type: "legal_case" as RedFlagType,
          severity: "warning" as RedFlagSeverity,
          title: "Legal Case",
          description: "Test",
          relatedEntityId: null,
          relatedEntityType: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          SourceAttribution: [],
        },
      ];

      vi.mocked(prisma.redFlag.findMany).mockResolvedValue(mockRedFlags);

      const isValid = await validateDynastyOnlySeverity("pol-1");

      expect(isValid).toBe(true); // Not dynasty-only, so validation passes
    });
  });

  // ============================================
  // Generate Red Flags Integration Tests
  // ============================================

  describe("generateRedFlags", () => {
    /**
     * Validates: Requirements 18.1, 18.2, 18.3, 18.4, 18.6, 18.7
     */
    it("should generate all types of red flags", async () => {
      // Mock legal cases
      vi.mocked(electionService.getControversies).mockResolvedValue([
        {
          id: "case-1",
          politicianId: "pol-1",
          title: "Legal Case",
          description: "Test",
          category: "legal_case" as ControversyCategory,
          status: "ongoing" as ControversyStatus,
          filingDate: null,
          resolutionDate: null,
          court: null,
          caseNumber: null,
          sources: [],
          hasVerifiedSources: true,
        },
        {
          id: "case-2",
          politicianId: "pol-1",
          title: "Corruption Case",
          description: "Test",
          category: "corruption" as ControversyCategory,
          status: "convicted" as ControversyStatus,
          filingDate: null,
          resolutionDate: null,
          court: null,
          caseNumber: null,
          sources: [],
          hasVerifiedSources: true,
        },
      ]);

      // Mock dynasty
      vi.mocked(familyNetworkService.getFamilyNetwork).mockResolvedValue({
        politicianId: "pol-1",
        politicianName: "Test Politician",
        familyMembers: [
          {
            id: "rel-1",
            politicianId: "pol-2",
            fullName: "Family Member",
            photo: null,
            relationshipType: "spouse",
            positions: [
              {
                id: "pos-1",
                title: "Mayor",
                level: "municipal",
                jurisdiction: "Test Town",
                startDate: new Date(),
                endDate: null,
                isCurrent: true,
              },
            ],
            isInDatabase: true,
            sources: [],
          },
        ],
        totalFamilyMembersInPolitics: 1,
        concurrentPositions: 1,
        sequentialPositions: 0,
        positionOverlaps: [],
        isDynasty: true,
        dynastySeverity: "info",
      });

      // Mock SALN anomalies
      vi.mocked(salnService.getSALNAnomalies).mockResolvedValue([
        {
          id: "saln-1",
          politicianId: "pol-1",
          year: 2023,
          totalAssets: 10000000,
          totalLiabilities: 1000000,
          netWorth: 9000000,
          declaredSalary: 500000,
          anomalyDetected: true,
          anomalyDetails: {
            yearOverYearChange: 100,
            expectedMaxChange: 20,
            anomalyRatio: 5,
            explanation: "Test anomaly",
          },
          realProperties: [],
          personalProperties: [],
          investments: [],
          sources: [],
        },
      ]);

      const result = await generateRedFlags("pol-1");

      expect(result.errors).toHaveLength(0);
      expect(result.generated.length).toBeGreaterThanOrEqual(4);

      // Check that all types are present
      const types = result.generated.map((f) => f.type);
      expect(types).toContain("legal_case");
      expect(types).toContain("corruption");
      expect(types).toContain("dynasty");
      expect(types).toContain("saln_anomaly");

      // Verify dynasty severity is info
      const dynastyFlag = result.generated.find((f) => f.type === "dynasty");
      expect(dynastyFlag?.severity).toBe("info");

      // Verify corruption conviction is critical
      const corruptionFlag = result.generated.find((f) => f.type === "corruption");
      expect(corruptionFlag?.severity).toBe("critical");
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(electionService.getControversies).mockRejectedValue(new Error("Database error"));
      vi.mocked(familyNetworkService.getFamilyNetwork).mockResolvedValue(null);
      vi.mocked(salnService.getSALNAnomalies).mockResolvedValue([]);

      const result = await generateRedFlags("pol-1");

      // Should have errors but not throw
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("Failed to generate");
    });
  });

  // ============================================
  // hasRedFlags Tests
  // ============================================

  describe("hasRedFlags", () => {
    it("should return true when red flags exist", async () => {
      vi.mocked(prisma.redFlag.findMany).mockResolvedValue(nonCaseFlags("pol-1", 3));

      const result = await hasRedFlags("pol-1");

      expect(result).toBe(true);
    });

    it("should return false when no red flags exist", async () => {
      vi.mocked(prisma.redFlag.findMany).mockResolvedValue([]);

      const result = await hasRedFlags("pol-1");

      expect(result).toBe(false);
    });
  });
});

function nonCaseFlags(politicianId: string, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `${politicianId}-${i}`,
    politicianId,
    type: "dynasty" as const,
    severity: "info" as const,
    title: "Family indicator",
    description: "Synthetic",
    relatedEntityId: null,
    relatedEntityType: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    SourceAttribution: [],
  }));
}
