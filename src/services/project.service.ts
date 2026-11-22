import { legacySourceSelect } from "./public-research.service";
/**
 * Project Service
 *
 * Service for managing projects, programs, and budget allocations
 * with COA audit findings tracking.
 *
 * Implements requirements: 22.1, 22.2, 22.3, 4.1, 4.2, 4.3, 4.4, 4.5
 *
 * Validates:
 * - Property 3: Data Completeness (all required fields present)
 * - Property 4: Source Attribution (DBM, COA citations)
 */

import {
  Prisma,
  SourceType,
  ProjectStatus,
  COAFindingSeverity,
  COAFindingStatus,
} from "@prisma/client";
import prisma from "@/lib/prisma";
import { DataSourceAttribution } from "./politician.service";

// ============================================
// Types and Interfaces
// ============================================

/**
 * Project location data
 * Validates: Requirement 22.4 - Map projects geographically
 */
export interface ProjectLocationData {
  region: string;
  province?: string | null;
  city?: string | null;
  barangay?: string | null;
  coordinates?: { lat: number; lng: number } | null;
}

/**
 * COA audit finding data
 * Validates: Requirement 22.3 - Display COA audit results and flagged irregularities
 */
export interface COAFindingData {
  id: string;
  year: number;
  finding: string;
  severity: COAFindingSeverity;
  status: COAFindingStatus;
}

/**
 * Project outcome data
 * Validates: Requirement 4.4 - Display measurable results or impact metrics
 */
export interface ProjectOutcomeData {
  id: string;
  metric: string;
  value: string;
  date: Date;
}

/**
 * Project data
 * Validates: Requirements 22.1, 22.2, 4.1, 4.2, 4.3
 */
export interface ProjectData {
  id: string;
  politicianId: string;
  positionId: string;
  name: string;
  description?: string | null;
  budget?: number | null;
  startDate: Date;
  endDate?: Date | null;
  status: ProjectStatus;
  implementingAgency?: string | null;
  location?: ProjectLocationData | null;
  coaFindings: COAFindingData[];
  outcomes: ProjectOutcomeData[];
  sources: DataSourceAttribution[];
}

/**
 * Project with position context
 * Validates: Requirement 4.3 - Organize projects by position
 */
export interface ProjectWithPosition extends ProjectData {
  positionTitle: string;
  positionLevel: string;
  positionJurisdiction: string;
}

/**
 * Project summary for listings
 */
export interface ProjectSummary {
  id: string;
  name: string;
  status: ProjectStatus;
  budget?: number | null;
  startDate: Date;
  endDate?: Date | null;
  hasCoaFindings: boolean;
  coaFindingCount: number;
  outcomeCount: number;
}

/**
 * Budget allocation vs implementation summary
 * Validates: Requirement 22.6 - Compare budget allocation vs actual implementation
 */
export interface BudgetImplementationSummary {
  politicianId: string;
  totalBudgetAllocated: number;
  projectsPlanned: number;
  projectsOngoing: number;
  projectsCompleted: number;
  projectsCancelled: number;
  implementationRate: number;
  coaFindingsCount: number;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Transforms a source attribution from Prisma to the service interface
 */
function transformSourceAttribution(source: {
  sourceType: SourceType;
  sourceName: string;
  sourceUrl: string | null;
  documentDate: Date | null;
  retrievedAt: Date;
  confidence: Prisma.Decimal | null;
  isAIProcessed: boolean;
  originalDocumentId: string | null;
  fieldName: string;
}): DataSourceAttribution {
  return {
    sourceType: source.sourceType,
    sourceName: source.sourceName,
    sourceUrl: source.sourceUrl,
    documentDate: source.documentDate,
    retrievedAt: source.retrievedAt,
    confidence: source.confidence === null ? null : Number(source.confidence),
    isAIProcessed: source.isAIProcessed,
    originalDocumentId: source.originalDocumentId,
  };
}

/**
 * Transforms a COA finding from Prisma to the service interface
 */
function transformCOAFinding(finding: {
  id: string;
  year: number;
  finding: string;
  severity: COAFindingSeverity;
  status: COAFindingStatus;
}): COAFindingData {
  return {
    id: finding.id,
    year: finding.year,
    finding: finding.finding,
    severity: finding.severity,
    status: finding.status,
  };
}

/**
 * Transforms a project outcome from Prisma to the service interface
 */
function transformOutcome(outcome: {
  id: string;
  metric: string;
  value: string;
  date: Date;
}): ProjectOutcomeData {
  return {
    id: outcome.id,
    metric: outcome.metric,
    value: outcome.value,
    date: outcome.date,
  };
}

/**
 * Transforms a project location from Prisma to the service interface
 */
function transformLocation(
  location: {
    region: string;
    province: string | null;
    city: string | null;
    barangay: string | null;
    latitude: Prisma.Decimal | null;
    longitude: Prisma.Decimal | null;
  } | null
): ProjectLocationData | null {
  if (!location) {
    return null;
  }

  return {
    region: location.region,
    province: location.province,
    city: location.city,
    barangay: location.barangay,
    coordinates:
      location.latitude && location.longitude
        ? {
            lat: Number(location.latitude),
            lng: Number(location.longitude),
          }
        : null,
  };
}

/**
 * Calculate implementation rate
 * Validates: Requirement 22.6 - Compare budget allocation vs actual implementation
 *
 * @param completed - Number of completed projects
 * @param total - Total number of projects (excluding cancelled)
 * @returns Implementation rate as percentage
 */
export function calculateImplementationRate(completed: number, total: number): number {
  if (total === 0) {
    return 0;
  }
  return (completed / total) * 100;
}

// ============================================
// Service Implementation
// ============================================

/**
 * Get all projects for a politician
 * Validates: Requirements 22.1, 4.1
 *
 * @param politicianId - The politician's ID
 * @returns Array of projects sorted by start date descending
 */
export async function getProjects(politicianId: string): Promise<ProjectData[]> {
  const records = await prisma.project.findMany({
    where: { politicianId },
    orderBy: { startDate: "desc" },
    include: {
      ProjectLocation: true,
      COAFinding: {
        orderBy: { year: "desc" },
      },
      ProjectOutcome: {
        orderBy: { date: "desc" },
      },
      SourceAttribution: { select: legacySourceSelect },
    },
  });

  return records.map((record) => ({
    id: record.id,
    politicianId: record.politicianId,
    positionId: record.positionId,
    name: record.name,
    description: record.description,
    budget: record.budget ? Number(record.budget) : null,
    startDate: record.startDate,
    endDate: record.endDate,
    status: record.status,
    implementingAgency: record.implementingAgency,
    location: transformLocation(record.ProjectLocation),
    coaFindings: record.COAFinding.map(transformCOAFinding),
    outcomes: record.ProjectOutcome.map(transformOutcome),
    sources: record.SourceAttribution.map(transformSourceAttribution),
  }));
}

/**
 * Get projects organized by position
 * Validates: Requirement 4.3 - Organize projects by position during which they were implemented
 *
 * @param politicianId - The politician's ID
 * @returns Array of projects with position context
 */
export async function getProjectsByPosition(politicianId: string): Promise<ProjectWithPosition[]> {
  const records = await prisma.project.findMany({
    where: { politicianId },
    orderBy: { startDate: "desc" },
    include: {
      Position: true,
      ProjectLocation: true,
      COAFinding: {
        orderBy: { year: "desc" },
      },
      ProjectOutcome: {
        orderBy: { date: "desc" },
      },
      SourceAttribution: { select: legacySourceSelect },
    },
  });

  return records.map((record) => ({
    id: record.id,
    politicianId: record.politicianId,
    positionId: record.positionId,
    name: record.name,
    description: record.description,
    budget: record.budget ? Number(record.budget) : null,
    startDate: record.startDate,
    endDate: record.endDate,
    status: record.status,
    implementingAgency: record.implementingAgency,
    location: transformLocation(record.ProjectLocation),
    coaFindings: record.COAFinding.map(transformCOAFinding),
    outcomes: record.ProjectOutcome.map(transformOutcome),
    sources: record.SourceAttribution.map(transformSourceAttribution),
    positionTitle: record.Position.title,
    positionLevel: record.Position.level,
    positionJurisdiction: record.Position.jurisdiction,
  }));
}

/**
 * Get a single project with full details
 * Validates: Requirements 22.2, 4.2
 *
 * @param projectId - The project ID
 * @returns Project data or null if not found
 */
export async function getProject(projectId: string): Promise<ProjectData | null> {
  const record = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      ProjectLocation: true,
      COAFinding: {
        orderBy: { year: "desc" },
      },
      ProjectOutcome: {
        orderBy: { date: "desc" },
      },
      SourceAttribution: { select: legacySourceSelect },
    },
  });

  if (!record) {
    return null;
  }

  return {
    id: record.id,
    politicianId: record.politicianId,
    positionId: record.positionId,
    name: record.name,
    description: record.description,
    budget: record.budget ? Number(record.budget) : null,
    startDate: record.startDate,
    endDate: record.endDate,
    status: record.status,
    implementingAgency: record.implementingAgency,
    location: transformLocation(record.ProjectLocation),
    coaFindings: record.COAFinding.map(transformCOAFinding),
    outcomes: record.ProjectOutcome.map(transformOutcome),
    sources: record.SourceAttribution.map(transformSourceAttribution),
  };
}

/**
 * Get projects by status
 * Validates: Requirement 22.5 - Indicate current status
 *
 * @param politicianId - The politician's ID
 * @param status - The project status to filter by
 * @returns Array of projects with the specified status
 */
export async function getProjectsByStatus(
  politicianId: string,
  status: ProjectStatus
): Promise<ProjectData[]> {
  const allProjects = await getProjects(politicianId);
  return allProjects.filter((p) => p.status === status);
}

/**
 * Get COA findings for a politician's projects
 * Validates: Requirement 22.3 - Display COA audit results
 *
 * @param politicianId - The politician's ID
 * @returns Array of COA findings with project context
 */
export async function getCOAFindings(
  politicianId: string
): Promise<(COAFindingData & { projectId: string; projectName: string })[]> {
  const findings = await prisma.cOAFinding.findMany({
    where: {
      Project: {
        politicianId,
      },
    },
    orderBy: { year: "desc" },
    include: {
      Project: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return findings.map((finding) => ({
    id: finding.id,
    year: finding.year,
    finding: finding.finding,
    severity: finding.severity,
    status: finding.status,
    projectId: finding.Project.id,
    projectName: finding.Project.name,
  }));
}

/**
 * Get COA findings by severity
 * Validates: Requirement 22.3 - Display flagged irregularities
 *
 * @param politicianId - The politician's ID
 * @param severity - The severity level to filter by
 * @returns Array of COA findings with the specified severity
 */
export async function getCOAFindingsBySeverity(
  politicianId: string,
  severity: COAFindingSeverity
): Promise<(COAFindingData & { projectId: string; projectName: string })[]> {
  const allFindings = await getCOAFindings(politicianId);
  return allFindings.filter((f) => f.severity === severity);
}

/**
 * Get projects with COA irregularities
 * Useful for red flag detection
 *
 * @param politicianId - The politician's ID
 * @returns Array of projects that have COA irregularities
 */
export async function getProjectsWithIrregularities(politicianId: string): Promise<ProjectData[]> {
  const records = await prisma.project.findMany({
    where: {
      politicianId,
      COAFinding: {
        some: {
          severity: "irregularity",
        },
      },
    },
    include: {
      ProjectLocation: true,
      COAFinding: {
        orderBy: { year: "desc" },
      },
      ProjectOutcome: {
        orderBy: { date: "desc" },
      },
      SourceAttribution: { select: legacySourceSelect },
    },
  });

  return records.map((record) => ({
    id: record.id,
    politicianId: record.politicianId,
    positionId: record.positionId,
    name: record.name,
    description: record.description,
    budget: record.budget ? Number(record.budget) : null,
    startDate: record.startDate,
    endDate: record.endDate,
    status: record.status,
    implementingAgency: record.implementingAgency,
    location: transformLocation(record.ProjectLocation),
    coaFindings: record.COAFinding.map(transformCOAFinding),
    outcomes: record.ProjectOutcome.map(transformOutcome),
    sources: record.SourceAttribution.map(transformSourceAttribution),
  }));
}

/**
 * Get project outcomes for a politician
 * Validates: Requirement 4.4 - Display measurable results
 *
 * @param politicianId - The politician's ID
 * @returns Array of outcomes with project context
 */
export async function getProjectOutcomes(
  politicianId: string
): Promise<(ProjectOutcomeData & { projectId: string; projectName: string })[]> {
  const outcomes = await prisma.projectOutcome.findMany({
    where: {
      Project: {
        politicianId,
      },
    },
    orderBy: { date: "desc" },
    include: {
      Project: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return outcomes.map((outcome) => ({
    id: outcome.id,
    metric: outcome.metric,
    value: outcome.value,
    date: outcome.date,
    projectId: outcome.Project.id,
    projectName: outcome.Project.name,
  }));
}

/**
 * Get budget implementation summary
 * Validates: Requirement 22.6 - Compare budget allocation vs actual implementation
 *
 * @param politicianId - The politician's ID
 * @returns Budget implementation summary
 */
export async function getBudgetImplementationSummary(
  politicianId: string
): Promise<BudgetImplementationSummary> {
  const projects = await prisma.project.findMany({
    where: { politicianId },
    include: {
      COAFinding: true,
    },
  });

  const totalBudgetAllocated = projects.reduce(
    (sum, p) => sum + (p.budget ? Number(p.budget) : 0),
    0
  );

  const projectsPlanned = projects.filter((p) => p.status === "planned").length;
  const projectsOngoing = projects.filter((p) => p.status === "ongoing").length;
  const projectsCompleted = projects.filter((p) => p.status === "completed").length;
  const projectsCancelled = projects.filter((p) => p.status === "cancelled").length;

  // Implementation rate excludes cancelled projects
  const totalNonCancelled = projects.length - projectsCancelled;
  const implementationRate = calculateImplementationRate(projectsCompleted, totalNonCancelled);

  const coaFindingsCount = projects.reduce((sum, p) => sum + p.COAFinding.length, 0);

  return {
    politicianId,
    totalBudgetAllocated,
    projectsPlanned,
    projectsOngoing,
    projectsCompleted,
    projectsCancelled,
    implementationRate,
    coaFindingsCount,
  };
}

/**
 * Get projects by location (region)
 * Validates: Requirement 22.4 - Map projects geographically
 *
 * @param politicianId - The politician's ID
 * @param region - The region to filter by
 * @returns Array of projects in the specified region
 */
export async function getProjectsByRegion(
  politicianId: string,
  region: string
): Promise<ProjectData[]> {
  const records = await prisma.project.findMany({
    where: {
      politicianId,
      ProjectLocation: {
        region,
      },
    },
    include: {
      ProjectLocation: true,
      COAFinding: {
        orderBy: { year: "desc" },
      },
      ProjectOutcome: {
        orderBy: { date: "desc" },
      },
      SourceAttribution: { select: legacySourceSelect },
    },
  });

  return records.map((record) => ({
    id: record.id,
    politicianId: record.politicianId,
    positionId: record.positionId,
    name: record.name,
    description: record.description,
    budget: record.budget ? Number(record.budget) : null,
    startDate: record.startDate,
    endDate: record.endDate,
    status: record.status,
    implementingAgency: record.implementingAgency,
    location: transformLocation(record.ProjectLocation),
    coaFindings: record.COAFinding.map(transformCOAFinding),
    outcomes: record.ProjectOutcome.map(transformOutcome),
    sources: record.SourceAttribution.map(transformSourceAttribution),
  }));
}

/**
 * Check if a politician has any projects
 *
 * @param politicianId - The politician's ID
 * @returns True if projects exist
 */
export async function hasProjects(politicianId: string): Promise<boolean> {
  const count = await prisma.project.count({
    where: { politicianId },
  });
  return count > 0;
}

/**
 * Check if a politician has any COA findings
 *
 * @param politicianId - The politician's ID
 * @returns True if COA findings exist
 */
export async function hasCOAFindings(politicianId: string): Promise<boolean> {
  const count = await prisma.cOAFinding.count({
    where: {
      Project: {
        politicianId,
      },
    },
  });
  return count > 0;
}

/**
 * Get projects that span multiple terms/positions
 * Validates: Requirement 4.5 - Indicate continuity across positions
 *
 * @param politicianId - The politician's ID
 * @returns Array of projects that span multiple positions (based on date overlap)
 */
export async function getMultiTermProjects(politicianId: string): Promise<ProjectData[]> {
  // Get all projects with their position dates
  const projects = await prisma.project.findMany({
    where: { politicianId },
    include: {
      Position: true,
      ProjectLocation: true,
      COAFinding: {
        orderBy: { year: "desc" },
      },
      ProjectOutcome: {
        orderBy: { date: "desc" },
      },
      SourceAttribution: { select: legacySourceSelect },
    },
  });

  // Find projects that extend beyond their associated position's end date
  const multiTermProjects = projects.filter((project) => {
    const position = project.Position;
    if (!position.endDate || !project.endDate) {
      return false;
    }
    // Project extends beyond position end date
    return project.endDate > position.endDate;
  });

  return multiTermProjects.map((record) => ({
    id: record.id,
    politicianId: record.politicianId,
    positionId: record.positionId,
    name: record.name,
    description: record.description,
    budget: record.budget ? Number(record.budget) : null,
    startDate: record.startDate,
    endDate: record.endDate,
    status: record.status,
    implementingAgency: record.implementingAgency,
    location: transformLocation(record.ProjectLocation),
    coaFindings: record.COAFinding.map(transformCOAFinding),
    outcomes: record.ProjectOutcome.map(transformOutcome),
    sources: record.SourceAttribution.map(transformSourceAttribution),
  }));
}
