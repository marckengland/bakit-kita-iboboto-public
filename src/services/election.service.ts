import { legacySourceSelect } from "./public-research.service";
/**
 * Election Service
 *
 * Service for managing election history and controversy data for politicians.
 * Implements requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4
 *
 * Validates:
 * - Property 3: Data Completeness (all required fields present)
 * - Property 4: Source Attribution (COMELEC citation for election data)
 * - Property 5: Ordering Correctness (chronological ordering)
 */

import {
  Prisma,
  SourceType,
  ElectionType,
  ElectionResult,
  ControversyCategory,
  ControversyStatus,
} from "@prisma/client";
import prisma from "@/lib/prisma";
import { DataSourceAttribution } from "./politician.service";

// ============================================
// Types and Interfaces
// ============================================

/**
 * Election opponent data
 * Validates: Requirement 7.3 - List top opponents with their vote counts
 */
export interface ElectionOpponentData {
  id: string;
  name: string;
  party?: string | null;
  voteCount: number;
  votePercentage: number;
}

/**
 * Election result record
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5
 */
export interface ElectionResultData {
  id: string;
  politicianId: string;
  electionYear: number;
  electionType: ElectionType;
  positionSought: string;
  jurisdiction: string;
  result: ElectionResult;
  voteCount: number;
  totalVotes: number;
  votePercentage: number;
  rank?: number | null;
  /** Winning margin (positive) or deficit (negative) */
  marginOrDeficit?: number | null;
  opponents: ElectionOpponentData[];
  sources: DataSourceAttribution[];
}

/**
 * Controversy/legal case data
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4
 */
export interface ControversyData {
  id: string;
  politicianId: string;
  title: string;
  description: string;
  category: ControversyCategory;
  status: ControversyStatus;
  filingDate?: Date | null;
  resolutionDate?: Date | null;
  court?: string | null;
  caseNumber?: string | null;
  sources: DataSourceAttribution[];
  /** Whether all sources are from verifiable official sources */
  hasVerifiedSources: boolean;
}

/**
 * Valid official source types for controversies
 * Validates: Requirement 8.4 - Only display information from verifiable official sources
 */
const OFFICIAL_CONTROVERSY_SOURCES: SourceType[] = ["court_document", "official_government"];

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
 * Transforms an election opponent from Prisma to the service interface
 */
function transformOpponent(opponent: {
  id: string;
  name: string;
  party: string | null;
  voteCount: number;
  votePercentage: Prisma.Decimal;
}): ElectionOpponentData {
  return {
    id: opponent.id,
    name: opponent.name,
    party: opponent.party,
    voteCount: opponent.voteCount,
    votePercentage: Number(opponent.votePercentage),
  };
}

/**
 * Calculate winning margin or deficit
 * Validates: Requirement 7.2 - Show winning margin or deficit
 *
 * @param result - Election result (won/lost)
 * @param voteCount - Politician's vote count
 * @param opponents - List of opponents with their vote counts
 * @returns Positive number for margin (won), negative for deficit (lost), null if no opponents
 */
export function calculateMarginOrDeficit(
  result: ElectionResult,
  voteCount: number,
  opponents: ElectionOpponentData[]
): number | null {
  if (opponents.length === 0) {
    return null;
  }

  // Sort opponents by vote count descending
  const sortedOpponents = [...opponents].sort((a, b) => b.voteCount - a.voteCount);
  const topOpponent = sortedOpponents[0];

  if (!topOpponent) {
    return null;
  }

  if (result === "won") {
    // Margin is difference from the top opponent (runner-up)
    return voteCount - topOpponent.voteCount;
  } else {
    // Deficit is difference from the winner (top opponent)
    return voteCount - topOpponent.voteCount;
  }
}

/**
 * Check if a source is from a verifiable official source
 * Validates: Requirement 8.4
 */
function isOfficialSource(sourceType: SourceType): boolean {
  return OFFICIAL_CONTROVERSY_SOURCES.includes(sourceType);
}

/**
 * Check if all sources for a controversy are from official sources
 * Validates: Requirement 8.4
 */
function hasAllOfficialSources(sources: DataSourceAttribution[]): boolean {
  if (sources.length === 0) {
    return false;
  }
  return sources.every((source) => isOfficialSource(source.sourceType));
}

// ============================================
// Service Implementation
// ============================================

/**
 * Get election history for a politician
 * Validates: Requirements 7.1, 7.4, 7.5
 *
 * Returns all election results sorted chronologically (by year descending)
 * with COMELEC source attribution.
 *
 * @param politicianId - The politician's ID
 * @returns Array of election results sorted by year descending
 */
export async function getElectionHistory(politicianId: string): Promise<ElectionResultData[]> {
  const records = await prisma.electionResultRecord.findMany({
    where: { politicianId },
    orderBy: { electionYear: "desc" },
    include: {
      ElectionOpponent: {
        orderBy: { voteCount: "desc" },
      },
      SourceAttribution: { select: legacySourceSelect },
    },
  });

  return records.map((record) => {
    const opponents = record.ElectionOpponent.map(transformOpponent);
    const marginOrDeficit = calculateMarginOrDeficit(record.result, record.voteCount, opponents);

    return {
      id: record.id,
      politicianId: record.politicianId,
      electionYear: record.electionYear,
      electionType: record.electionType,
      positionSought: record.positionSought,
      jurisdiction: record.jurisdiction,
      result: record.result,
      voteCount: record.voteCount,
      totalVotes: record.totalVotes,
      votePercentage: Number(record.votePercentage),
      rank: record.rank,
      marginOrDeficit,
      opponents,
      sources: record.SourceAttribution.map(transformSourceAttribution),
    };
  });
}

/**
 * Get a single election result with detailed information
 * Validates: Requirements 7.2, 7.3, 7.5
 *
 * @param electionId - The election result record ID
 * @returns Election result with opponents and sources, or null if not found
 */
export async function getElectionResult(electionId: string): Promise<ElectionResultData | null> {
  const record = await prisma.electionResultRecord.findUnique({
    where: { id: electionId },
    include: {
      ElectionOpponent: {
        orderBy: { voteCount: "desc" },
      },
      SourceAttribution: { select: legacySourceSelect },
    },
  });

  if (!record) {
    return null;
  }

  const opponents = record.ElectionOpponent.map(transformOpponent);
  const marginOrDeficit = calculateMarginOrDeficit(record.result, record.voteCount, opponents);

  return {
    id: record.id,
    politicianId: record.politicianId,
    electionYear: record.electionYear,
    electionType: record.electionType,
    positionSought: record.positionSought,
    jurisdiction: record.jurisdiction,
    result: record.result,
    voteCount: record.voteCount,
    totalVotes: record.totalVotes,
    votePercentage: Number(record.votePercentage),
    rank: record.rank,
    marginOrDeficit,
    opponents,
    sources: record.SourceAttribution.map(transformSourceAttribution),
  };
}

/**
 * Get controversies and legal cases for a politician
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4
 *
 * Only returns controversies with verified official sources.
 *
 * @param politicianId - The politician's ID
 * @returns Array of controversies with source validation
 */
export async function getControversies(politicianId: string): Promise<ControversyData[]> {
  const records = await prisma.controversy.findMany({
    where: { politicianId },
    orderBy: { filingDate: "desc" },
    include: {
      SourceAttribution: { select: legacySourceSelect },
    },
  });

  return records
    .filter(
      (record): record is typeof record & { status: ControversyStatus } => record.status !== null
    )
    .map((record) => {
      const sources = record.SourceAttribution.map(transformSourceAttribution);
      const hasVerifiedSources = hasAllOfficialSources(sources);

      return {
        id: record.id,
        politicianId: record.politicianId,
        title: record.title,
        description: record.description,
        category: record.category,
        status: record.status,
        filingDate: record.filingDate,
        resolutionDate: record.resolutionDate,
        court: record.court,
        caseNumber: record.caseNumber,
        sources,
        hasVerifiedSources,
      };
    });
}

/**
 * Get a single controversy with detailed information
 * Validates: Requirements 8.2, 8.3, 8.4
 *
 * @param controversyId - The controversy ID
 * @returns Controversy with sources, or null if not found
 */
export async function getControversy(controversyId: string): Promise<ControversyData | null> {
  const record = await prisma.controversy.findUnique({
    where: { id: controversyId },
    include: {
      SourceAttribution: { select: legacySourceSelect },
    },
  });

  if (!record || record.status === null) {
    return null;
  }

  const sources = record.SourceAttribution.map(transformSourceAttribution);
  const hasVerifiedSources = hasAllOfficialSources(sources);

  return {
    id: record.id,
    politicianId: record.politicianId,
    title: record.title,
    description: record.description,
    category: record.category,
    status: record.status,
    filingDate: record.filingDate,
    resolutionDate: record.resolutionDate,
    court: record.court,
    caseNumber: record.caseNumber,
    sources,
    hasVerifiedSources,
  };
}

/**
 * Get only controversies with verified official sources
 * Validates: Requirement 8.4 - Only display information from verifiable official sources
 *
 * @param politicianId - The politician's ID
 * @returns Array of controversies with verified sources only
 */
export async function getVerifiedControversies(politicianId: string): Promise<ControversyData[]> {
  const allControversies = await getControversies(politicianId);
  return allControversies.filter((c) => c.hasVerifiedSources);
}

/**
 * Check if a politician has any election records
 *
 * @param politicianId - The politician's ID
 * @returns True if election records exist
 */
export async function hasElectionRecords(politicianId: string): Promise<boolean> {
  const count = await prisma.electionResultRecord.count({
    where: { politicianId },
  });
  return count > 0;
}

/**
 * Check if a politician has any controversies
 *
 * @param politicianId - The politician's ID
 * @returns True if controversies exist
 */
export async function hasControversies(politicianId: string): Promise<boolean> {
  const count = await prisma.controversy.count({
    where: { politicianId },
  });
  return count > 0;
}

/**
 * Get controversies by status
 * Validates: Requirement 8.3 - Indicate resolution status
 *
 * @param politicianId - The politician's ID
 * @param status - The controversy status to filter by
 * @returns Array of controversies with the specified status
 */
export async function getControversiesByStatus(
  politicianId: string,
  status: ControversyStatus
): Promise<ControversyData[]> {
  const allControversies = await getControversies(politicianId);
  return allControversies.filter((c) => c.status === status);
}

/**
 * Get ongoing legal cases for a politician
 * Useful for red flag detection
 *
 * @param politicianId - The politician's ID
 * @returns Array of ongoing controversies
 */
export async function getOngoingCases(politicianId: string): Promise<ControversyData[]> {
  return getControversiesByStatus(politicianId, "ongoing");
}

/**
 * Get election wins for a politician
 *
 * @param politicianId - The politician's ID
 * @returns Array of election results where the politician won
 */
export async function getElectionWins(politicianId: string): Promise<ElectionResultData[]> {
  const history = await getElectionHistory(politicianId);
  return history.filter((e) => e.result === "won");
}

/**
 * Get election losses for a politician
 *
 * @param politicianId - The politician's ID
 * @returns Array of election results where the politician lost
 */
export async function getElectionLosses(politicianId: string): Promise<ElectionResultData[]> {
  const history = await getElectionHistory(politicianId);
  return history.filter((e) => e.result === "lost");
}
