import { legacySourceSelect } from "./public-research.service";
/**
 * Family Network Service
 *
 * Implements family relationship queries, family tree traversal,
 * dynasty detection, and concurrent/sequential position analysis.
 *
 * Requirements: 24.1, 24.2, 24.3, 24.4, 24.5, 24.7
 */

import { RelationshipType, GovernmentLevel, SourceType, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

// ============================================
// Types and Interfaces
// ============================================

/**
 * Source attribution for family relationship data
 */
export interface DataSourceAttribution {
  sourceType: SourceType;
  sourceName: string;
  sourceUrl?: string | null;
  documentDate?: Date | null;
  retrievedAt: Date;
  confidence: number | null;
  isAIProcessed: boolean;
  originalDocumentId?: string | null;
}

/**
 * Position held by a family member
 * Validates: Requirement 24.3
 */
export interface FamilyMemberPosition {
  id: string;
  title: string;
  level: GovernmentLevel;
  jurisdiction: string;
  startDate: Date;
  endDate: Date | null;
  isCurrent: boolean;
}

/**
 * A family member in the network
 * Validates: Requirements 24.1, 24.2, 24.3
 */
export interface FamilyMember {
  id: string;
  politicianId: string;
  fullName: string;
  photo: string | null;
  relationshipType: RelationshipType;
  positions: FamilyMemberPosition[];
  isInDatabase: boolean;
  sources: DataSourceAttribution[];
}

/**
 * Position overlap analysis for concurrent/sequential detection
 * Validates: Requirement 24.4
 */
export interface PositionOverlap {
  politicianId: string;
  politicianName: string;
  relatedPoliticianId: string;
  relatedPoliticianName: string;
  relationshipType: RelationshipType;
  overlapType: "concurrent" | "sequential";
  position1: {
    title: string;
    jurisdiction: string;
    startDate: Date;
    endDate: Date | null;
  };
  position2: {
    title: string;
    jurisdiction: string;
    startDate: Date;
    endDate: Date | null;
  };
  overlapPeriod?: {
    start: Date;
    end: Date;
  };
}

/**
 * Dynasty detection result
 * Validates: Requirements 24.5, 24.7
 */
export interface DynastyDetectionResult {
  isDynasty: boolean;
  totalFamilyMembersInPolitics: number;
  concurrentPositions: number;
  sequentialPositions: number;
  familyMembers: FamilyMember[];
  positionOverlaps: PositionOverlap[];
  dynastySeverity: "none" | "info";
}

/**
 * Complete family network for a politician
 * Validates: Requirements 24.1, 24.2, 24.3, 24.4, 24.5, 24.6, 24.7
 */
export interface FamilyNetwork {
  politicianId: string;
  politicianName: string;
  familyMembers: FamilyMember[];
  totalFamilyMembersInPolitics: number;
  concurrentPositions: number;
  sequentialPositions: number;
  positionOverlaps: PositionOverlap[];
  isDynasty: boolean;
  dynastySeverity: "none" | "info";
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
 * Check if two date ranges overlap (concurrent positions)
 * Returns the overlap period if they overlap, null otherwise
 */
export function getDateRangeOverlap(
  start1: Date,
  end1: Date | null,
  start2: Date,
  end2: Date | null
): { start: Date; end: Date } | null {
  // Use current date if end date is null (position is current)
  const effectiveEnd1 = end1 || new Date();
  const effectiveEnd2 = end2 || new Date();

  // Check if ranges overlap
  const overlapStart = start1 > start2 ? start1 : start2;
  const overlapEnd = effectiveEnd1 < effectiveEnd2 ? effectiveEnd1 : effectiveEnd2;

  if (overlapStart <= overlapEnd) {
    return { start: overlapStart, end: overlapEnd };
  }

  return null;
}

/**
 * Check if positions are sequential (one ends and another starts in same position)
 * Sequential means: same position title AND same jurisdiction AND
 * one position ends within a reasonable time before the other starts
 */
export function arePositionsSequential(
  pos1: FamilyMemberPosition,
  pos2: FamilyMemberPosition,
  maxGapDays: number = 365 // Allow up to 1 year gap for election cycles
): boolean {
  // Must be same position title and jurisdiction
  if (pos1.title.toLowerCase() !== pos2.title.toLowerCase()) {
    return false;
  }
  if (pos1.jurisdiction.toLowerCase() !== pos2.jurisdiction.toLowerCase()) {
    return false;
  }

  // Determine which position comes first
  const [earlier, later] = pos1.startDate < pos2.startDate ? [pos1, pos2] : [pos2, pos1];

  // Earlier position must have ended
  if (!earlier.endDate) {
    return false;
  }

  // Check if later position starts within maxGapDays of earlier ending
  const gapMs = later.startDate.getTime() - earlier.endDate.getTime();
  const gapDays = gapMs / (1000 * 60 * 60 * 24);

  return gapDays >= 0 && gapDays <= maxGapDays;
}

/**
 * Get the inverse relationship type
 * e.g., if A is parent of B, then B is child of A
 */
export function getInverseRelationship(type: RelationshipType): RelationshipType {
  switch (type) {
    case "parent":
      return "child";
    case "child":
      return "parent";
    case "grandparent":
      return "grandchild";
    case "grandchild":
      return "grandparent";
    case "spouse":
      return "spouse";
    case "sibling":
      return "sibling";
    case "cousin":
      return "cousin";
    case "in_law":
      return "in_law";
    default:
      return type;
  }
}

// ============================================
// Service Implementation
// ============================================

/**
 * Get direct family relationships for a politician
 * Validates: Requirements 24.1, 24.2
 */
export async function getFamilyRelationships(politicianId: string): Promise<FamilyMember[]> {
  // Get relationships where this politician is the source
  const relationshipsFrom = await prisma.familyRelationship.findMany({
    where: { politicianId },
    include: {
      Politician_FamilyRelationship_relatedPoliticianIdToPolitician: {
        include: {
          Position: {
            orderBy: { startDate: "desc" },
          },
        },
      },
      SourceAttribution: { select: legacySourceSelect },
    },
  });

  // Get relationships where this politician is the target
  const relationshipsTo = await prisma.familyRelationship.findMany({
    where: { relatedPoliticianId: politicianId },
    include: {
      Politician_FamilyRelationship_politicianIdToPolitician: {
        include: {
          Position: {
            orderBy: { startDate: "desc" },
          },
        },
      },
      SourceAttribution: { select: legacySourceSelect },
    },
  });

  const familyMembers: FamilyMember[] = [];
  const seenIds = new Set<string>();

  // Process relationships from this politician
  for (const rel of relationshipsFrom) {
    if (seenIds.has(rel.relatedPoliticianId)) {
      continue;
    }
    seenIds.add(rel.relatedPoliticianId);

    const relatedPolitician = rel.Politician_FamilyRelationship_relatedPoliticianIdToPolitician;
    familyMembers.push({
      id: rel.id,
      politicianId: rel.relatedPoliticianId,
      fullName: relatedPolitician.fullName,
      photo: relatedPolitician.photo,
      relationshipType: rel.relationshipType,
      positions: relatedPolitician.Position.map((pos) => ({
        id: pos.id,
        title: pos.title,
        level: pos.level,
        jurisdiction: pos.jurisdiction,
        startDate: pos.startDate,
        endDate: pos.endDate,
        isCurrent: pos.isCurrent,
      })),
      isInDatabase: true,
      sources: rel.SourceAttribution.map(transformSourceAttribution),
    });
  }

  // Process relationships to this politician (with inverse relationship type)
  for (const rel of relationshipsTo) {
    if (seenIds.has(rel.politicianId)) {
      continue;
    }
    seenIds.add(rel.politicianId);

    const politician = rel.Politician_FamilyRelationship_politicianIdToPolitician;
    familyMembers.push({
      id: rel.id,
      politicianId: rel.politicianId,
      fullName: politician.fullName,
      photo: politician.photo,
      relationshipType: getInverseRelationship(rel.relationshipType),
      positions: politician.Position.map((pos) => ({
        id: pos.id,
        title: pos.title,
        level: pos.level,
        jurisdiction: pos.jurisdiction,
        startDate: pos.startDate,
        endDate: pos.endDate,
        isCurrent: pos.isCurrent,
      })),
      isInDatabase: true,
      sources: rel.SourceAttribution.map(transformSourceAttribution),
    });
  }

  return familyMembers;
}

/**
 * Traverse family tree using BFS to find all relatives
 * Validates: Requirement 24.6 (expand family tree to see extended connections)
 */
export async function traverseFamilyTree(
  politicianId: string,
  maxDepth: number = 3
): Promise<Map<string, { member: FamilyMember; depth: number }>> {
  const visited = new Map<string, { member: FamilyMember; depth: number }>();
  const queue: Array<{ id: string; depth: number }> = [{ id: politicianId, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (visited.has(current.id) || current.depth > maxDepth) {
      continue;
    }

    // Skip the root politician (we don't add them as a family member)
    if (current.id !== politicianId) {
      // Get the family member data
      const politician = await prisma.politician.findUnique({
        where: { id: current.id },
        include: {
          Position: {
            orderBy: { startDate: "desc" },
          },
        },
      });

      if (politician) {
        // Find the relationship to the root politician
        const relationship = await prisma.familyRelationship.findFirst({
          where: {
            OR: [
              { politicianId: politicianId, relatedPoliticianId: current.id },
              { politicianId: current.id, relatedPoliticianId: politicianId },
            ],
          },
          include: {
            SourceAttribution: { select: legacySourceSelect },
          },
        });

        if (relationship) {
          const isFromRoot = relationship.politicianId === politicianId;
          const relType = isFromRoot
            ? relationship.relationshipType
            : getInverseRelationship(relationship.relationshipType);

          visited.set(current.id, {
            member: {
              id: relationship.id,
              politicianId: current.id,
              fullName: politician.fullName,
              photo: politician.photo,
              relationshipType: relType,
              positions: politician.Position.map((pos) => ({
                id: pos.id,
                title: pos.title,
                level: pos.level,
                jurisdiction: pos.jurisdiction,
                startDate: pos.startDate,
                endDate: pos.endDate,
                isCurrent: pos.isCurrent,
              })),
              isInDatabase: true,
              sources: relationship.SourceAttribution.map(transformSourceAttribution),
            },
            depth: current.depth,
          });
        }
      }
    } else {
      // Mark root as visited but don't add to results
      visited.set(current.id, { member: null as unknown as FamilyMember, depth: 0 });
    }

    // Get next level of relatives if not at max depth
    if (current.depth < maxDepth) {
      const directRelatives = await getFamilyRelationships(current.id);
      for (const relative of directRelatives) {
        if (!visited.has(relative.politicianId)) {
          queue.push({ id: relative.politicianId, depth: current.depth + 1 });
        }
      }
    }
  }

  // Remove the root politician from results
  visited.delete(politicianId);

  return visited;
}

/**
 * Analyze position overlaps between a politician and their family members
 * Validates: Requirement 24.4
 */
export function analyzePositionOverlaps(
  politicianId: string,
  politicianName: string,
  politicianPositions: FamilyMemberPosition[],
  familyMembers: FamilyMember[]
): PositionOverlap[] {
  const overlaps: PositionOverlap[] = [];

  for (const member of familyMembers) {
    for (const pos1 of politicianPositions) {
      for (const pos2 of member.positions) {
        // Check for concurrent positions
        const overlap = getDateRangeOverlap(
          pos1.startDate,
          pos1.endDate,
          pos2.startDate,
          pos2.endDate
        );

        if (overlap) {
          overlaps.push({
            politicianId,
            politicianName,
            relatedPoliticianId: member.politicianId,
            relatedPoliticianName: member.fullName,
            relationshipType: member.relationshipType,
            overlapType: "concurrent",
            position1: {
              title: pos1.title,
              jurisdiction: pos1.jurisdiction,
              startDate: pos1.startDate,
              endDate: pos1.endDate,
            },
            position2: {
              title: pos2.title,
              jurisdiction: pos2.jurisdiction,
              startDate: pos2.startDate,
              endDate: pos2.endDate,
            },
            overlapPeriod: overlap,
          });
        }

        // Check for sequential positions (same position, one after another)
        if (arePositionsSequential(pos1, pos2)) {
          overlaps.push({
            politicianId,
            politicianName,
            relatedPoliticianId: member.politicianId,
            relatedPoliticianName: member.fullName,
            relationshipType: member.relationshipType,
            overlapType: "sequential",
            position1: {
              title: pos1.title,
              jurisdiction: pos1.jurisdiction,
              startDate: pos1.startDate,
              endDate: pos1.endDate,
            },
            position2: {
              title: pos2.title,
              jurisdiction: pos2.jurisdiction,
              startDate: pos2.startDate,
              endDate: pos2.endDate,
            },
          });
        }
      }
    }
  }

  return overlaps;
}

/**
 * Detect political dynasty patterns
 * Validates: Requirements 24.5, 24.7
 *
 * A political dynasty is detected when:
 * - A politician has family members who are/were in politics
 *
 * Dynasty severity is always "info" as per Requirement 18.7:
 * "Dynasty indicators without corruption/legal issues must have severity 'info'"
 */
export function detectDynasty(
  familyMembers: FamilyMember[],
  positionOverlaps: PositionOverlap[]
): DynastyDetectionResult {
  // Count family members who have held political positions
  const membersWithPositions = familyMembers.filter((member) => member.positions.length > 0);

  const totalFamilyMembersInPolitics = membersWithPositions.length;

  // Count concurrent and sequential positions
  const concurrentPositions = positionOverlaps.filter((o) => o.overlapType === "concurrent").length;
  const sequentialPositions = positionOverlaps.filter((o) => o.overlapType === "sequential").length;

  // Dynasty is detected if there are family members in politics
  const isDynasty = totalFamilyMembersInPolitics > 0;

  // Dynasty severity is always "info" for dynasty-only (no corruption/legal issues)
  // Per Requirement 18.7
  const dynastySeverity = isDynasty ? "info" : "none";

  return {
    isDynasty,
    totalFamilyMembersInPolitics,
    concurrentPositions,
    sequentialPositions,
    familyMembers: membersWithPositions,
    positionOverlaps,
    dynastySeverity,
  };
}

/**
 * Get complete family network for a politician
 * Validates: Requirements 24.1, 24.2, 24.3, 24.4, 24.5, 24.6, 24.7
 */
export async function getFamilyNetwork(politicianId: string): Promise<FamilyNetwork | null> {
  // Get the politician's basic info and positions
  const politician = await prisma.politician.findUnique({
    where: { id: politicianId },
    include: {
      Position: {
        orderBy: { startDate: "desc" },
      },
    },
  });

  if (!politician) {
    return null;
  }

  // Get direct family relationships
  const familyMembers = await getFamilyRelationships(politicianId);

  // Transform politician positions for analysis
  const politicianPositions: FamilyMemberPosition[] = politician.Position.map((pos) => ({
    id: pos.id,
    title: pos.title,
    level: pos.level,
    jurisdiction: pos.jurisdiction,
    startDate: pos.startDate,
    endDate: pos.endDate,
    isCurrent: pos.isCurrent,
  }));

  // Analyze position overlaps
  const positionOverlaps = analyzePositionOverlaps(
    politicianId,
    politician.fullName,
    politicianPositions,
    familyMembers
  );

  // Detect dynasty patterns
  const dynastyResult = detectDynasty(familyMembers, positionOverlaps);

  return {
    politicianId,
    politicianName: politician.fullName,
    familyMembers,
    totalFamilyMembersInPolitics: dynastyResult.totalFamilyMembersInPolitics,
    concurrentPositions: dynastyResult.concurrentPositions,
    sequentialPositions: dynastyResult.sequentialPositions,
    positionOverlaps,
    isDynasty: dynastyResult.isDynasty,
    dynastySeverity: dynastyResult.dynastySeverity,
  };
}

/**
 * Get extended family network using tree traversal
 * Validates: Requirement 24.6
 */
export async function getExtendedFamilyNetwork(
  politicianId: string,
  maxDepth: number = 3
): Promise<FamilyNetwork | null> {
  // Get the politician's basic info and positions
  const politician = await prisma.politician.findUnique({
    where: { id: politicianId },
    include: {
      Position: {
        orderBy: { startDate: "desc" },
      },
    },
  });

  if (!politician) {
    return null;
  }

  // Traverse family tree to get extended relatives
  const familyTree = await traverseFamilyTree(politicianId, maxDepth);
  const familyMembers = Array.from(familyTree.values())
    .filter((entry) => entry.member !== null)
    .map((entry) => entry.member);

  // Transform politician positions for analysis
  const politicianPositions: FamilyMemberPosition[] = politician.Position.map((pos) => ({
    id: pos.id,
    title: pos.title,
    level: pos.level,
    jurisdiction: pos.jurisdiction,
    startDate: pos.startDate,
    endDate: pos.endDate,
    isCurrent: pos.isCurrent,
  }));

  // Analyze position overlaps
  const positionOverlaps = analyzePositionOverlaps(
    politicianId,
    politician.fullName,
    politicianPositions,
    familyMembers
  );

  // Detect dynasty patterns
  const dynastyResult = detectDynasty(familyMembers, positionOverlaps);

  return {
    politicianId,
    politicianName: politician.fullName,
    familyMembers,
    totalFamilyMembersInPolitics: dynastyResult.totalFamilyMembersInPolitics,
    concurrentPositions: dynastyResult.concurrentPositions,
    sequentialPositions: dynastyResult.sequentialPositions,
    positionOverlaps,
    isDynasty: dynastyResult.isDynasty,
    dynastySeverity: dynastyResult.dynastySeverity,
  };
}

/**
 * Check if a politician is part of a political dynasty
 * Validates: Requirement 24.7
 */
export async function isPoliticalDynasty(politicianId: string): Promise<boolean> {
  // Quick check: count family relationships where related politician has positions
  const relationshipsWithPositions = await prisma.familyRelationship.count({
    where: {
      OR: [{ politicianId }, { relatedPoliticianId: politicianId }],
      AND: [
        {
          OR: [
            {
              Politician_FamilyRelationship_relatedPoliticianIdToPolitician: {
                Position: {
                  some: {},
                },
              },
            },
            {
              Politician_FamilyRelationship_politicianIdToPolitician: {
                Position: {
                  some: {},
                },
              },
            },
          ],
        },
      ],
    },
  });

  return relationshipsWithPositions > 0;
}
