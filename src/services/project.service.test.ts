import { legacySourceSelect } from "./public-research.service";
/**
 * Project Service Unit Tests
 *
 * Tests for project, program, and budget allocation management with COA findings.
 * Validates: Requirements 22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Prisma } from "@prisma/client";
import {
  getProjects,
  getProjectsByPosition,
  getProject,
  getProjectsByStatus,
  getCOAFindings,
  getCOAFindingsBySeverity,
  getProjectsWithIrregularities,
  getProjectOutcomes,
  getBudgetImplementationSummary,
  getProjectsByRegion,
  hasProjects,
  hasCOAFindings,
  getMultiTermProjects,
  calculateImplementationRate,
} from "./project.service";
import prisma from "@/lib/prisma";
import {
  SourceType,
  ProjectStatus,
  COAFindingSeverity,
  COAFindingStatus,
  GovernmentLevel,
} from "@prisma/client";

// Mock Prisma client
vi.mock("@/lib/prisma", () => ({
  default: {
    project: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    cOAFinding: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    projectOutcome: {
      findMany: vi.fn(),
    },
    position: {
      findMany: vi.fn(),
    },
  },
}));

describe("Project Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ============================================
  // calculateImplementationRate Tests
  // ============================================

  describe("calculateImplementationRate", () => {
    it("should calculate implementation rate correctly", () => {
      const result = calculateImplementationRate(7, 10);
      expect(result).toBe(70);
    });

    it("should return 0 when total is 0", () => {
      const result = calculateImplementationRate(0, 0);
      expect(result).toBe(0);
    });

    it("should handle 100% implementation", () => {
      const result = calculateImplementationRate(10, 10);
      expect(result).toBe(100);
    });
  });

  // ============================================
  // getProjects Tests
  // ============================================

  describe("getProjects", () => {
    it("should return projects sorted by start date descending", async () => {
      const mockRecords = [
        {
          id: "proj-1",
          politicianId: "pol-1",
          positionId: "pos-1",
          name: "Road Construction Project",
          description: "Building new roads",
          budget: new Prisma.Decimal(50000000),
          startDate: new Date("2023-01-01"),
          endDate: new Date("2024-12-31"),
          status: "ongoing" as ProjectStatus,
          implementingAgency: "DPWH",
          ProjectLocation: {
            region: "NCR",
            province: null,
            city: "Manila",
            barangay: null,
            latitude: new Prisma.Decimal(14.5995),
            longitude: new Prisma.Decimal(120.9842),
          },
          COAFinding: [],
          ProjectOutcome: [],
          SourceAttribution: [
            {
              sourceType: "official_government" as SourceType,
              sourceName: "DBM Budget Allocation",
              sourceUrl: "https://dbm.gov.ph",
              documentDate: new Date("2023-01-01"),
              retrievedAt: new Date("2023-02-01"),
              confidence: new Prisma.Decimal(0.99),
              isAIProcessed: false,
              originalDocumentId: null,
              fieldName: "project",
            },
          ],
        },
        {
          id: "proj-2",
          politicianId: "pol-1",
          positionId: "pos-1",
          name: "School Building Project",
          description: "Building new schools",
          budget: new Prisma.Decimal(30000000),
          startDate: new Date("2022-01-01"),
          endDate: new Date("2022-12-31"),
          status: "completed" as ProjectStatus,
          implementingAgency: "DepEd",
          ProjectLocation: null,
          COAFinding: [],
          ProjectOutcome: [],
          SourceAttribution: [],
        },
      ];

      vi.mocked(prisma.project.findMany).mockResolvedValue(mockRecords as never);

      const projects = await getProjects("pol-1");

      expect(projects).toHaveLength(2);
      expect(projects[0]!.name).toBe("Road Construction Project");
      expect(projects[0]!.startDate).toEqual(new Date("2023-01-01"));
      expect(prisma.project.findMany).toHaveBeenCalledWith({
        where: { politicianId: "pol-1" },
        orderBy: { startDate: "desc" },
        include: {
          ProjectLocation: true,
          COAFinding: { orderBy: { year: "desc" } },
          ProjectOutcome: { orderBy: { date: "desc" } },
          SourceAttribution: { select: legacySourceSelect },
        },
      });
    });

    it("should include DBM/COA source attribution", async () => {
      const mockRecords = [
        {
          id: "proj-1",
          politicianId: "pol-1",
          positionId: "pos-1",
          name: "Infrastructure Project",
          description: null,
          budget: new Prisma.Decimal(100000000),
          startDate: new Date("2023-01-01"),
          endDate: null,
          status: "ongoing" as ProjectStatus,
          implementingAgency: "DPWH",
          ProjectLocation: null,
          COAFinding: [],
          ProjectOutcome: [],
          SourceAttribution: [
            {
              sourceType: "official_government" as SourceType,
              sourceName: "DBM Budget Document",
              sourceUrl: "https://dbm.gov.ph/budget/2023",
              documentDate: new Date("2023-01-01"),
              retrievedAt: new Date("2023-02-01"),
              confidence: new Prisma.Decimal(0.99),
              isAIProcessed: false,
              originalDocumentId: "dbm-2023-001",
              fieldName: "project",
            },
          ],
        },
      ];

      vi.mocked(prisma.project.findMany).mockResolvedValue(mockRecords as never);

      const projects = await getProjects("pol-1");

      expect(projects[0]!.sources).toHaveLength(1);
      expect(projects[0]!.sources[0]!.sourceName).toContain("DBM");
    });

    it("should return empty array for politician with no projects", async () => {
      vi.mocked(prisma.project.findMany).mockResolvedValue([]);

      const projects = await getProjects("pol-no-projects");

      expect(projects).toEqual([]);
    });
  });

  // ============================================
  // getProjectsByPosition Tests
  // ============================================

  describe("getProjectsByPosition", () => {
    it("should return projects with position context", async () => {
      const mockRecords = [
        {
          id: "proj-1",
          politicianId: "pol-1",
          positionId: "pos-1",
          name: "Mayor's Project",
          description: "Project during mayorship",
          budget: new Prisma.Decimal(50000000),
          startDate: new Date("2022-01-01"),
          endDate: new Date("2022-12-31"),
          status: "completed" as ProjectStatus,
          implementingAgency: "City Government",
          ProjectLocation: null,
          Position: {
            id: "pos-1",
            title: "Mayor",
            level: "city" as GovernmentLevel,
            jurisdiction: "City of Manila",
          },
          COAFinding: [],
          ProjectOutcome: [],
          SourceAttribution: [],
        },
        {
          id: "proj-2",
          politicianId: "pol-1",
          positionId: "pos-2",
          name: "Senator's Project",
          description: "Project during senatorship",
          budget: new Prisma.Decimal(100000000),
          startDate: new Date("2023-01-01"),
          endDate: null,
          status: "ongoing" as ProjectStatus,
          implementingAgency: "Senate",
          ProjectLocation: null,
          Position: {
            id: "pos-2",
            title: "Senator",
            level: "national" as GovernmentLevel,
            jurisdiction: "National",
          },
          COAFinding: [],
          ProjectOutcome: [],
          SourceAttribution: [],
        },
      ];

      vi.mocked(prisma.project.findMany).mockResolvedValue(mockRecords as never);

      const projects = await getProjectsByPosition("pol-1");

      expect(projects).toHaveLength(2);
      expect(projects[0]!.positionTitle).toBe("Mayor");
      expect(projects[0]!.positionLevel).toBe("city");
      expect(projects[1]!.positionTitle).toBe("Senator");
      expect(projects[1]!.positionLevel).toBe("national");
    });
  });

  // ============================================
  // getProject Tests
  // ============================================

  describe("getProject", () => {
    it("should return detailed project information", async () => {
      const mockRecord = {
        id: "proj-1",
        politicianId: "pol-1",
        positionId: "pos-1",
        name: "Infrastructure Project",
        description: "Major infrastructure development",
        budget: new Prisma.Decimal(100000000),
        startDate: new Date("2023-01-01"),
        endDate: new Date("2024-12-31"),
        status: "ongoing" as ProjectStatus,
        implementingAgency: "DPWH",
        ProjectLocation: {
          region: "NCR",
          province: null,
          city: "Manila",
          barangay: "Ermita",
          latitude: new Prisma.Decimal(14.5995),
          longitude: new Prisma.Decimal(120.9842),
        },
        COAFinding: [
          {
            id: "coa-1",
            year: 2023,
            finding: "Minor documentation issue",
            severity: "observation" as COAFindingSeverity,
            status: "resolved" as COAFindingStatus,
          },
        ],
        ProjectOutcome: [
          {
            id: "outcome-1",
            metric: "Roads Built",
            value: "5 km",
            date: new Date("2023-06-01"),
          },
        ],
        SourceAttribution: [],
      };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockRecord as never);

      const project = await getProject("proj-1");

      expect(project).not.toBeNull();
      expect(project!.name).toBe("Infrastructure Project");
      expect(project!.location).not.toBeNull();
      expect(project!.location!.coordinates).toEqual({ lat: 14.5995, lng: 120.9842 });
      expect(project!.coaFindings).toHaveLength(1);
      expect(project!.outcomes).toHaveLength(1);
    });

    it("should return null for non-existent project", async () => {
      vi.mocked(prisma.project.findUnique).mockResolvedValue(null);

      const project = await getProject("non-existent");

      expect(project).toBeNull();
    });
  });

  // ============================================
  // getProjectsByStatus Tests
  // ============================================

  describe("getProjectsByStatus", () => {
    it("should filter projects by status", async () => {
      const mockRecords = [
        {
          id: "proj-1",
          politicianId: "pol-1",
          positionId: "pos-1",
          name: "Completed Project",
          description: null,
          budget: new Prisma.Decimal(50000000),
          startDate: new Date("2022-01-01"),
          endDate: new Date("2022-12-31"),
          status: "completed" as ProjectStatus,
          implementingAgency: null,
          ProjectLocation: null,
          COAFinding: [],
          ProjectOutcome: [],
          SourceAttribution: [],
        },
        {
          id: "proj-2",
          politicianId: "pol-1",
          positionId: "pos-1",
          name: "Ongoing Project",
          description: null,
          budget: new Prisma.Decimal(30000000),
          startDate: new Date("2023-01-01"),
          endDate: null,
          status: "ongoing" as ProjectStatus,
          implementingAgency: null,
          ProjectLocation: null,
          COAFinding: [],
          ProjectOutcome: [],
          SourceAttribution: [],
        },
      ];

      vi.mocked(prisma.project.findMany).mockResolvedValue(mockRecords as never);

      const completed = await getProjectsByStatus("pol-1", "completed");

      expect(completed).toHaveLength(1);
      expect(completed[0]!.name).toBe("Completed Project");
    });
  });

  // ============================================
  // getCOAFindings Tests
  // ============================================

  describe("getCOAFindings", () => {
    it("should return COA findings with project context", async () => {
      const mockFindings = [
        {
          id: "coa-1",
          year: 2023,
          finding: "Irregularity in procurement",
          severity: "irregularity" as COAFindingSeverity,
          status: "open" as COAFindingStatus,
          Project: {
            id: "proj-1",
            name: "Infrastructure Project",
          },
        },
        {
          id: "coa-2",
          year: 2022,
          finding: "Documentation deficiency",
          severity: "deficiency" as COAFindingSeverity,
          status: "resolved" as COAFindingStatus,
          Project: {
            id: "proj-2",
            name: "School Building Project",
          },
        },
      ];

      vi.mocked(prisma.cOAFinding.findMany).mockResolvedValue(mockFindings as never);

      const findings = await getCOAFindings("pol-1");

      expect(findings).toHaveLength(2);
      expect(findings[0]!.projectName).toBe("Infrastructure Project");
      expect(findings[0]!.severity).toBe("irregularity");
      expect(findings[1]!.projectName).toBe("School Building Project");
    });
  });

  // ============================================
  // getCOAFindingsBySeverity Tests
  // ============================================

  describe("getCOAFindingsBySeverity", () => {
    it("should filter findings by severity", async () => {
      const mockFindings = [
        {
          id: "coa-1",
          year: 2023,
          finding: "Irregularity in procurement",
          severity: "irregularity" as COAFindingSeverity,
          status: "open" as COAFindingStatus,
          Project: {
            id: "proj-1",
            name: "Project A",
          },
        },
        {
          id: "coa-2",
          year: 2022,
          finding: "Minor observation",
          severity: "observation" as COAFindingSeverity,
          status: "resolved" as COAFindingStatus,
          Project: {
            id: "proj-2",
            name: "Project B",
          },
        },
      ];

      vi.mocked(prisma.cOAFinding.findMany).mockResolvedValue(mockFindings as never);

      const irregularities = await getCOAFindingsBySeverity("pol-1", "irregularity");

      expect(irregularities).toHaveLength(1);
      expect(irregularities[0]!.severity).toBe("irregularity");
    });
  });

  // ============================================
  // getProjectsWithIrregularities Tests
  // ============================================

  describe("getProjectsWithIrregularities", () => {
    it("should return projects with COA irregularities", async () => {
      const mockRecords = [
        {
          id: "proj-1",
          politicianId: "pol-1",
          positionId: "pos-1",
          name: "Problematic Project",
          description: null,
          budget: new Prisma.Decimal(50000000),
          startDate: new Date("2022-01-01"),
          endDate: null,
          status: "ongoing" as ProjectStatus,
          implementingAgency: null,
          ProjectLocation: null,
          COAFinding: [
            {
              id: "coa-1",
              year: 2023,
              finding: "Irregularity found",
              severity: "irregularity" as COAFindingSeverity,
              status: "open" as COAFindingStatus,
            },
          ],
          ProjectOutcome: [],
          SourceAttribution: [],
        },
      ];

      vi.mocked(prisma.project.findMany).mockResolvedValue(mockRecords as never);

      const projects = await getProjectsWithIrregularities("pol-1");

      expect(projects).toHaveLength(1);
      expect(projects[0]!.coaFindings[0]!.severity).toBe("irregularity");
    });
  });

  // ============================================
  // getProjectOutcomes Tests
  // ============================================

  describe("getProjectOutcomes", () => {
    it("should return project outcomes with project context", async () => {
      const mockOutcomes = [
        {
          id: "outcome-1",
          metric: "Beneficiaries",
          value: "10,000 families",
          date: new Date("2023-06-01"),
          Project: {
            id: "proj-1",
            name: "Housing Project",
          },
        },
        {
          id: "outcome-2",
          metric: "Roads Built",
          value: "15 km",
          date: new Date("2023-03-01"),
          Project: {
            id: "proj-2",
            name: "Road Project",
          },
        },
      ];

      vi.mocked(prisma.projectOutcome.findMany).mockResolvedValue(mockOutcomes as never);

      const outcomes = await getProjectOutcomes("pol-1");

      expect(outcomes).toHaveLength(2);
      expect(outcomes[0]!.projectName).toBe("Housing Project");
      expect(outcomes[0]!.metric).toBe("Beneficiaries");
    });
  });

  // ============================================
  // getBudgetImplementationSummary Tests
  // ============================================

  describe("getBudgetImplementationSummary", () => {
    it("should calculate budget implementation summary correctly", async () => {
      const mockProjects = [
        {
          id: "proj-1",
          budget: new Prisma.Decimal(50000000),
          status: "completed" as ProjectStatus,
          COAFinding: [{ id: "coa-1" }],
        },
        {
          id: "proj-2",
          budget: new Prisma.Decimal(30000000),
          status: "completed" as ProjectStatus,
          COAFinding: [],
        },
        {
          id: "proj-3",
          budget: new Prisma.Decimal(40000000),
          status: "ongoing" as ProjectStatus,
          COAFinding: [{ id: "coa-2" }, { id: "coa-3" }],
        },
        {
          id: "proj-4",
          budget: new Prisma.Decimal(20000000),
          status: "planned" as ProjectStatus,
          COAFinding: [],
        },
        {
          id: "proj-5",
          budget: new Prisma.Decimal(10000000),
          status: "cancelled" as ProjectStatus,
          COAFinding: [],
        },
      ];

      vi.mocked(prisma.project.findMany).mockResolvedValue(mockProjects as never);

      const summary = await getBudgetImplementationSummary("pol-1");

      expect(summary.totalBudgetAllocated).toBe(150000000);
      expect(summary.projectsPlanned).toBe(1);
      expect(summary.projectsOngoing).toBe(1);
      expect(summary.projectsCompleted).toBe(2);
      expect(summary.projectsCancelled).toBe(1);
      expect(summary.implementationRate).toBe(50); // 2 completed out of 4 non-cancelled
      expect(summary.coaFindingsCount).toBe(3);
    });

    it("should handle zero projects", async () => {
      vi.mocked(prisma.project.findMany).mockResolvedValue([]);

      const summary = await getBudgetImplementationSummary("pol-1");

      expect(summary.totalBudgetAllocated).toBe(0);
      expect(summary.implementationRate).toBe(0);
    });
  });

  // ============================================
  // getProjectsByRegion Tests
  // ============================================

  describe("getProjectsByRegion", () => {
    it("should return projects in specified region", async () => {
      const mockRecords = [
        {
          id: "proj-1",
          politicianId: "pol-1",
          positionId: "pos-1",
          name: "NCR Project",
          description: null,
          budget: new Prisma.Decimal(50000000),
          startDate: new Date("2023-01-01"),
          endDate: null,
          status: "ongoing" as ProjectStatus,
          implementingAgency: null,
          ProjectLocation: {
            region: "NCR",
            province: null,
            city: "Manila",
            barangay: null,
            latitude: null,
            longitude: null,
          },
          COAFinding: [],
          ProjectOutcome: [],
          SourceAttribution: [],
        },
      ];

      vi.mocked(prisma.project.findMany).mockResolvedValue(mockRecords as never);

      const projects = await getProjectsByRegion("pol-1", "NCR");

      expect(projects).toHaveLength(1);
      expect(projects[0]!.location!.region).toBe("NCR");
    });
  });

  // ============================================
  // hasProjects Tests
  // ============================================

  describe("hasProjects", () => {
    it("should return true when projects exist", async () => {
      vi.mocked(prisma.project.count).mockResolvedValue(5);

      const result = await hasProjects("pol-1");

      expect(result).toBe(true);
    });

    it("should return false when no projects exist", async () => {
      vi.mocked(prisma.project.count).mockResolvedValue(0);

      const result = await hasProjects("pol-1");

      expect(result).toBe(false);
    });
  });

  // ============================================
  // hasCOAFindings Tests
  // ============================================

  describe("hasCOAFindings", () => {
    it("should return true when COA findings exist", async () => {
      vi.mocked(prisma.cOAFinding.count).mockResolvedValue(3);

      const result = await hasCOAFindings("pol-1");

      expect(result).toBe(true);
    });

    it("should return false when no COA findings exist", async () => {
      vi.mocked(prisma.cOAFinding.count).mockResolvedValue(0);

      const result = await hasCOAFindings("pol-1");

      expect(result).toBe(false);
    });
  });

  // ============================================
  // getMultiTermProjects Tests
  // ============================================

  describe("getMultiTermProjects", () => {
    it("should return projects that span multiple terms", async () => {
      const mockRecords = [
        {
          id: "proj-1",
          politicianId: "pol-1",
          positionId: "pos-1",
          name: "Long-term Project",
          description: null,
          budget: new Prisma.Decimal(100000000),
          startDate: new Date("2019-01-01"),
          endDate: new Date("2025-12-31"), // Extends beyond position end
          status: "ongoing" as ProjectStatus,
          implementingAgency: null,
          Position: {
            id: "pos-1",
            title: "Mayor",
            level: "city" as GovernmentLevel,
            jurisdiction: "City",
            startDate: new Date("2019-01-01"),
            endDate: new Date("2022-06-30"), // Position ended
          },
          ProjectLocation: null,
          COAFinding: [],
          ProjectOutcome: [],
          SourceAttribution: [],
        },
        {
          id: "proj-2",
          politicianId: "pol-1",
          positionId: "pos-1",
          name: "Single-term Project",
          description: null,
          budget: new Prisma.Decimal(50000000),
          startDate: new Date("2020-01-01"),
          endDate: new Date("2021-12-31"), // Within position term
          status: "completed" as ProjectStatus,
          implementingAgency: null,
          Position: {
            id: "pos-1",
            title: "Mayor",
            level: "city" as GovernmentLevel,
            jurisdiction: "City",
            startDate: new Date("2019-01-01"),
            endDate: new Date("2022-06-30"),
          },
          ProjectLocation: null,
          COAFinding: [],
          ProjectOutcome: [],
          SourceAttribution: [],
        },
      ];

      vi.mocked(prisma.project.findMany).mockResolvedValue(mockRecords as never);

      const multiTermProjects = await getMultiTermProjects("pol-1");

      expect(multiTermProjects).toHaveLength(1);
      expect(multiTermProjects[0]!.name).toBe("Long-term Project");
    });
  });
});
