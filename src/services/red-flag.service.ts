/**
 * Red Flag Service
 *
 * Implements red flag detection and aggregation for politicians.
 * Red flags indicate documented issues such as legal cases, corruption,
 * political dynasty patterns, and SALN anomalies.
 *
 * Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8
 * Validates: Property 8 (Red Flag Detection)
 */

import { RedFlagType, RedFlagSeverity, ControversyStatus } from "@prisma/client";
import { getPublicRedFlagsBatch } from "./public-research.service";
import { DataSourceAttribution } from "./politician.service";
import { getControversies, ControversyData } from "./election.service";
import { getSALNAnomalies } from "./saln.service";
import { getFamilyNetwork } from "./family-network.service";

// ============================================
// Types and Interfaces
// ============================================

/**
 * Red flag data structure
 * Validates: Requirements 18.1, 18.2, 18.3, 18.4, 18.5, 18.6
 */
export interface RedFlagData {
  id: string;
  politicianId: string;
  type: RedFlagType;
  severity: RedFlagSeverity;
  title: string;
  description: string;
  relatedEntityId?: string | null;
  relatedEntityType?: string | null;
  eventDate?: Date | null;
  createdAt: Date;
  sources: DataSourceAttribution[];
}

/**
 * Red flag summary for listings
 * Validates: Requirement 18.8 - Show red flag count in listings
 */
export interface RedFlagSummary {
  politicianId: string;
  totalCount: number;
  byType: Record<RedFlagType, number>;
  bySeverity: Record<RedFlagSeverity, number>;
  hasLegalCases: boolean;
  hasCorruption: boolean;
  hasDynasty: boolean;
  hasSALNAnomalies: boolean;
}

/**
 * Red flag generation result
 */
export interface RedFlagGenerationResult {
  generated: RedFlagData[];
  errors: string[];
}

/**
 * Controversy statuses that indicate active/serious legal issues
 */
// const ACTIVE_LEGAL_STATUSES: ControversyStatus[] = ["ongoing", "convicted"];

/**
 * Controversy statuses that indicate resolved issues (less severe)
 */
// const RESOLVED_LEGAL_STATUSES: ControversyStatus[] = ["dismissed", "acquitted", "settled"];

// ============================================
// Helper Functions
// ============================================

/**
 * Transforms a source attribution from Prisma to the service interface
 */
/**
 * Determine severity for legal case red flags
 * Validates: Requirements 18.6, 18.7
 *
 * - "critical" for convictions
 * - "warning" for ongoing cases
 * - "info" for dismissed/acquitted/settled cases
 */
export function determineLegalCaseSeverity(status: ControversyStatus): RedFlagSeverity {
  switch (status) {
    case "convicted":
      return "critical";
    case "ongoing":
      return "warning";
    case "dismissed":
    case "acquitted":
    case "settled":
      return "info";
    default:
      return "warning";
  }
}

/**
 * Determine severity for corruption red flags
 * Validates: Requirements 18.2, 18.6
 *
 * - "critical" for convictions
 * - "warning" for ongoing allegations
 * - "info" for dismissed/acquitted cases
 */
export function determineCorruptionSeverity(status: ControversyStatus): RedFlagSeverity {
  switch (status) {
    case "convicted":
      return "critical";
    case "ongoing":
      return "warning";
    case "dismissed":
    case "acquitted":
    case "settled":
      return "info";
    default:
      return "warning";
  }
}

/**
 * Determine severity for SALN anomaly red flags
 * Validates: Requirements 18.4, 18.6
 *
 * - "warning" for detected anomalies (unexplained wealth)
 * - Severity can be escalated based on anomaly ratio
 */
export function determineSALNAnomalySeverity(anomalyRatio: number): RedFlagSeverity {
  // Critical if anomaly ratio is extremely high (5x or more)
  if (anomalyRatio >= 5) {
    return "critical";
  }
  // Warning for standard anomalies
  return "warning";
}

/**
 * Dynasty severity is always "info"
 * Validates: Requirement 18.7 - Dynasty indicators without corruption/legal issues
 * must have severity 'info' (not 'warning' or 'critical')
 */
export function determineDynastySeverity(): RedFlagSeverity {
  return "info";
}

/**
 * Generate title for legal case red flag
 */
function generateLegalCaseTitle(controversy: ControversyData): string {
  const statusText =
    controversy.status === "convicted"
      ? "Convicted"
      : controversy.status === "ongoing"
        ? "Ongoing"
        : controversy.status === "dismissed"
          ? "Dismissed"
          : controversy.status === "acquitted"
            ? "Acquitted"
            : "Settled";

  return `${statusText} Legal Case: ${controversy.title}`;
}

/**
 * Generate description for legal case red flag
 */
function generateLegalCaseDescription(controversy: ControversyData): string {
  let desc = controversy.description;

  if (controversy.court) {
    desc += ` Court: ${controversy.court}.`;
  }
  if (controversy.caseNumber) {
    desc += ` Case Number: ${controversy.caseNumber}.`;
  }
  if (controversy.filingDate) {
    desc += ` Filed: ${controversy.filingDate.toISOString().split("T")[0]}.`;
  }
  if (controversy.resolutionDate) {
    desc += ` Resolved: ${controversy.resolutionDate.toISOString().split("T")[0]}.`;
  }

  return desc;
}

// ============================================
// Red Flag Generation Functions
// ============================================

/**
 * Generate red flags for legal cases
 * Validates: Requirement 18.1 - Display red flag indicator for legal cases
 */
export async function generateLegalCaseRedFlags(politicianId: string): Promise<RedFlagData[]> {
  const controversies = await getControversies(politicianId);

  // Filter for legal cases (not corruption - handled separately)
  const legalCases = controversies.filter(
    (c) =>
      c.category === "legal_case" || c.category === "ethics_violation" || c.category === "other"
  );

  return legalCases.map((controversy) => ({
    id: `legal-${controversy.id}`,
    politicianId,
    type: "legal_case" as RedFlagType,
    severity: determineLegalCaseSeverity(controversy.status),
    title: generateLegalCaseTitle(controversy),
    description: generateLegalCaseDescription(controversy),
    relatedEntityId: controversy.id,
    relatedEntityType: "Controversy",
    createdAt: new Date(),
    sources: controversy.sources,
  }));
}

/**
 * Generate red flags for corruption allegations
 * Validates: Requirement 18.2 - Show corruption allegations with sources
 */
export async function generateCorruptionRedFlags(politicianId: string): Promise<RedFlagData[]> {
  const controversies = await getControversies(politicianId);

  // Filter for corruption-related cases
  const corruptionCases = controversies.filter((c) => c.category === "corruption");

  return corruptionCases.map((controversy) => ({
    id: `corruption-${controversy.id}`,
    politicianId,
    type: "corruption" as RedFlagType,
    severity: determineCorruptionSeverity(controversy.status),
    title: `Corruption Case: ${controversy.title}`,
    description: generateLegalCaseDescription(controversy),
    relatedEntityId: controversy.id,
    relatedEntityType: "Controversy",
    createdAt: new Date(),
    sources: controversy.sources,
  }));
}

/**
 * Generate red flag for political dynasty
 * Validates: Requirements 18.3, 18.7
 * - Indicate dynasty patterns
 * - Dynasty-only = info severity
 */
export async function generateDynastyRedFlag(politicianId: string): Promise<RedFlagData | null> {
  const familyNetwork = await getFamilyNetwork(politicianId);

  if (!familyNetwork || !familyNetwork.isDynasty) {
    return null;
  }

  const familyMemberNames = familyNetwork.familyMembers
    .slice(0, 5) // Limit to first 5 for description
    .map((m) => `${m.fullName} (${m.relationshipType})`)
    .join(", ");

  const moreText =
    familyNetwork.familyMembers.length > 5
      ? ` and ${familyNetwork.familyMembers.length - 5} more`
      : "";

  return {
    id: `dynasty-${politicianId}`,
    politicianId,
    type: "dynasty" as RedFlagType,
    severity: determineDynastySeverity(), // Always "info" per Requirement 18.7
    title: "Political Dynasty Member",
    description: `Part of a political family with ${familyNetwork.totalFamilyMembersInPolitics} family member(s) in politics. Related politicians: ${familyMemberNames}${moreText}. ${familyNetwork.concurrentPositions} concurrent position(s), ${familyNetwork.sequentialPositions} sequential position(s).`,
    relatedEntityId: null,
    relatedEntityType: "FamilyNetwork",
    createdAt: new Date(),
    sources: [], // Dynasty info comes from family relationships, sources are on those records
  };
}

/**
 * Generate red flags for SALN anomalies
 * Validates: Requirement 18.4 - Flag SALN anomalies
 */
export async function generateSALNAnomalyRedFlags(politicianId: string): Promise<RedFlagData[]> {
  const anomalies = await getSALNAnomalies(politicianId);

  return anomalies.map((saln) => {
    const anomalyRatio = saln.anomalyDetails?.anomalyRatio ?? 1.5;

    return {
      id: `saln-${saln.id}`,
      politicianId,
      type: "saln_anomaly" as RedFlagType,
      severity: determineSALNAnomalySeverity(anomalyRatio),
      title: `SALN Anomaly Detected (${saln.year})`,
      description:
        saln.anomalyDetails?.explanation ??
        `Unusual wealth growth detected in ${saln.year} SALN. Net worth: ₱${saln.netWorth.toLocaleString()}.`,
      relatedEntityId: saln.id,
      relatedEntityType: "SALNRecord",
      createdAt: new Date(),
      sources: saln.sources,
    };
  });
}

// ============================================
// Service Implementation
// ============================================

/**
 * Get all red flags for a politician from the database
 * Validates: Requirements 18.1, 18.2, 18.3, 18.4, 18.5, 18.6
 */
export async function getRedFlags(politicianId: string): Promise<RedFlagData[]> {
  return (await getPublicRedFlagsBatch([politicianId])).get(politicianId) ?? [];
}

/**
 * Get red flags by type
 * Validates: Requirement 18.6 - Categorize by severity
 */
export async function getRedFlagsByType(
  politicianId: string,
  type: RedFlagType
): Promise<RedFlagData[]> {
  const allFlags = await getRedFlags(politicianId);
  return allFlags.filter((flag) => flag.type === type);
}

/**
 * Get red flags by severity
 * Validates: Requirement 18.6 - Categorize by severity
 */
export async function getRedFlagsBySeverity(
  politicianId: string,
  severity: RedFlagSeverity
): Promise<RedFlagData[]> {
  const allFlags = await getRedFlags(politicianId);
  return allFlags.filter((flag) => flag.severity === severity);
}

/**
 * Get red flag summary for a politician
 * Validates: Requirement 18.8 - Show red flag count in listings
 */
export async function getRedFlagSummary(politicianId: string): Promise<RedFlagSummary> {
  const redFlags = await getRedFlags(politicianId);

  const byType: Record<RedFlagType, number> = {
    legal_case: 0,
    corruption: 0,
    dynasty: 0,
    saln_anomaly: 0,
    attendance: 0,
  };

  const bySeverity: Record<RedFlagSeverity, number> = {
    info: 0,
    warning: 0,
    critical: 0,
  };

  for (const flag of redFlags) {
    byType[flag.type]++;
    bySeverity[flag.severity]++;
  }

  return {
    politicianId,
    totalCount: redFlags.length,
    byType,
    bySeverity,
    hasLegalCases: byType.legal_case > 0,
    hasCorruption: byType.corruption > 0,
    hasDynasty: byType.dynasty > 0,
    hasSALNAnomalies: byType.saln_anomaly > 0,
  };
}

/**
 * Generate all red flags for a politician based on current data
 * This function analyzes controversies, SALN records, and family relationships
 * to generate appropriate red flags.
 *
 * Validates: Requirements 18.1, 18.2, 18.3, 18.4, 18.6, 18.7
 */
export async function generateRedFlags(politicianId: string): Promise<RedFlagGenerationResult> {
  const generated: RedFlagData[] = [];
  const errors: string[] = [];

  // Generate legal case red flags
  try {
    const legalFlags = await generateLegalCaseRedFlags(politicianId);
    generated.push(...legalFlags);
  } catch (error) {
    errors.push(`Failed to generate legal case red flags: ${error}`);
  }

  // Generate corruption red flags
  try {
    const corruptionFlags = await generateCorruptionRedFlags(politicianId);
    generated.push(...corruptionFlags);
  } catch (error) {
    errors.push(`Failed to generate corruption red flags: ${error}`);
  }

  // Generate dynasty red flag
  try {
    const dynastyFlag = await generateDynastyRedFlag(politicianId);
    if (dynastyFlag) {
      generated.push(dynastyFlag);
    }
  } catch (error) {
    errors.push(`Failed to generate dynasty red flag: ${error}`);
  }

  // Generate SALN anomaly red flags
  try {
    const salnFlags = await generateSALNAnomalyRedFlags(politicianId);
    generated.push(...salnFlags);
  } catch (error) {
    errors.push(`Failed to generate SALN anomaly red flags: ${error}`);
  }

  return { generated, errors };
}

/**
 * Check if a politician has any red flags
 */
export async function hasRedFlags(politicianId: string): Promise<boolean> {
  return (await getRedFlagCount(politicianId)) > 0;
}

/**
 * Get red flag count for a politician
 * Validates: Requirement 18.8 - Show red flag count in listings
 */
export async function getRedFlagCount(politicianId: string): Promise<number> {
  return (await getRedFlags(politicianId)).length;
}

/**
 * Get red flag counts for multiple politicians (batch operation)
 * Useful for listing pages
 * Validates: Requirement 18.8 - Show red flag count in listings
 */
export async function getRedFlagCountsBatch(politicianIds: string[]): Promise<Map<string, number>> {
  return new Map(
    [...(await getPublicRedFlagsBatch(politicianIds))].map(([id, flags]) => [id, flags.length])
  );
}

/**
 * Get the highest severity red flag for a politician
 * Useful for quick visual indicators in listings
 */
export async function getHighestSeverity(politicianId: string): Promise<RedFlagSeverity | null> {
  const flags = await getRedFlags(politicianId);
  return (
    (["critical", "warning", "info"] as const).find((severity) =>
      flags.some((flag) => flag.severity === severity)
    ) ?? null
  );
}

/**
 * Validate that dynasty-only politicians have info severity
 * Validates: Requirement 18.7 - Dynasty indicators without corruption/legal issues
 * must have severity 'info' (not 'warning' or 'critical')
 */
export async function validateDynastyOnlySeverity(politicianId: string): Promise<boolean> {
  const summary = await getRedFlagSummary(politicianId);

  // If politician only has dynasty flag (no legal, corruption, or SALN issues)
  const isDynastyOnly =
    summary.hasDynasty &&
    !summary.hasLegalCases &&
    !summary.hasCorruption &&
    !summary.hasSALNAnomalies;

  if (!isDynastyOnly) {
    return true; // Not dynasty-only, validation doesn't apply
  }

  // For dynasty-only, all flags should be "info" severity
  return summary.bySeverity.warning === 0 && summary.bySeverity.critical === 0;
}
