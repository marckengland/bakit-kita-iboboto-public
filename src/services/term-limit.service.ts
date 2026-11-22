/**
 * Term Limit Service
 *
 * Implements term limit tracking, consecutive/non-consecutive term counting,
 * term-hopping detection, and term limit status calculation.
 *
 * Requirements: 46.1, 46.2, 46.3, 46.4, 46.5, 46.6
 *
 * Philippine Term Limit Rules (Constitutional):
 * - President: 1 term (6 years), no re-election
 * - Vice President: 2 consecutive terms (6 years each)
 * - Senator: 2 consecutive terms (6 years each)
 * - Congressman: 3 consecutive terms (3 years each)
 * - Governor/Vice Governor: 3 consecutive terms (3 years each)
 * - Mayor/Vice Mayor: 3 consecutive terms (3 years each)
 * - Councilor: 3 consecutive terms (3 years each)
 * - Barangay Captain: 3 consecutive terms (3 years each)
 */

import { GovernmentLevel } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getReleasedProfile, type ReleasedProfileContext } from "@/lib/release-data";

// ============================================
// Types and Interfaces
// ============================================

/**
 * Position data for term limit calculations
 */
export interface PositionData {
  id: string;
  title: string;
  level: GovernmentLevel;
  jurisdiction: string;
  startDate: Date;
  endDate: Date | null;
  termNumber: number;
  isConsecutive: boolean;
  isCurrent: boolean;
}

/**
 * Term limit rules for a specific position type
 * Validates: Requirement 46.6
 */
export interface TermLimitRule {
  positionType: string;
  maxConsecutiveTerms: number;
  termLengthYears: number;
  allowsReelection: boolean;
  level: GovernmentLevel;
}

/**
 * Term history for a specific position
 * Validates: Requirements 46.1, 46.4, 46.5
 */
export interface TermHistory {
  position: string;
  level: GovernmentLevel;
  jurisdiction: string;
  consecutiveTermsServed: number;
  totalTermsServed: number;
  maxTerms: number;
  termLengthYears: number;
  reachedLimit: boolean;
  years: string;
  terms: TermDetail[];
}

/**
 * Detail of a single term
 */
export interface TermDetail {
  termNumber: number;
  startDate: Date;
  endDate: Date | null;
  isConsecutive: boolean;
  isCurrent: boolean;
}

/**
 * Current position term limit status
 * Validates: Requirements 46.2, 46.3
 */
export interface CurrentPositionStatus {
  position: string;
  level: GovernmentLevel;
  jurisdiction: string;
  termNumber: number;
  maxTerms: number;
  termsRemaining: number;
  isFinalTerm: boolean;
  eligibleForReelection: boolean;
  termLengthYears: number;
}

/**
 * Term-hopping detection result
 * Validates: Requirement 46.5
 */
export interface TermHoppingPattern {
  detected: boolean;
  patterns: TermHoppingInstance[];
}

/**
 * A single instance of term-hopping
 */
export interface TermHoppingInstance {
  fromPosition: string;
  fromJurisdiction: string;
  toPosition: string;
  toJurisdiction: string;
  yearOfSwitch: number;
  reachedLimitInPreviousPosition: boolean;
}

/**
 * Complete term limit status for a politician
 * Validates: Requirements 46.1, 46.2, 46.3, 46.4, 46.5, 46.6
 */
export interface TermLimitStatus {
  politicianId: string;
  currentPosition: CurrentPositionStatus | null;
  positionHistory: TermHistory[];
  totalYearsInOffice: number | null;
  termHoppingDetected: boolean | null;
  termHoppingPatterns: TermHoppingInstance[];
  positionsWhereReachedLimit: string[];
  reviewedBatch?: ReleasedProfileContext;
}

// ============================================
// Term Limit Rules Configuration
// ============================================

/**
 * Philippine constitutional term limit rules by position type
 * Validates: Requirement 46.6
 */
export const TERM_LIMIT_RULES: TermLimitRule[] = [
  // National positions
  {
    positionType: "President",
    maxConsecutiveTerms: 1,
    termLengthYears: 6,
    allowsReelection: false,
    level: "national",
  },
  {
    positionType: "Vice President",
    maxConsecutiveTerms: 2,
    termLengthYears: 6,
    allowsReelection: true,
    level: "national",
  },
  {
    positionType: "Senator",
    maxConsecutiveTerms: 2,
    termLengthYears: 6,
    allowsReelection: true,
    level: "national",
  },
  {
    positionType: "Congressman",
    maxConsecutiveTerms: 3,
    termLengthYears: 3,
    allowsReelection: true,
    level: "national",
  },
  {
    positionType: "Congresswoman",
    maxConsecutiveTerms: 3,
    termLengthYears: 3,
    allowsReelection: true,
    level: "national",
  },
  {
    positionType: "Representative",
    maxConsecutiveTerms: 3,
    termLengthYears: 3,
    allowsReelection: true,
    level: "national",
  },
  {
    positionType: "Party-list Representative",
    maxConsecutiveTerms: 3,
    termLengthYears: 3,
    allowsReelection: true,
    level: "national",
  },
  // Provincial positions
  {
    positionType: "Governor",
    maxConsecutiveTerms: 3,
    termLengthYears: 3,
    allowsReelection: true,
    level: "provincial",
  },
  {
    positionType: "Vice Governor",
    maxConsecutiveTerms: 3,
    termLengthYears: 3,
    allowsReelection: true,
    level: "provincial",
  },
  {
    positionType: "Provincial Board Member",
    maxConsecutiveTerms: 3,
    termLengthYears: 3,
    allowsReelection: true,
    level: "provincial",
  },
  // City positions
  {
    positionType: "City Mayor",
    maxConsecutiveTerms: 3,
    termLengthYears: 3,
    allowsReelection: true,
    level: "city",
  },
  {
    positionType: "City Vice Mayor",
    maxConsecutiveTerms: 3,
    termLengthYears: 3,
    allowsReelection: true,
    level: "city",
  },
  {
    positionType: "City Councilor",
    maxConsecutiveTerms: 3,
    termLengthYears: 3,
    allowsReelection: true,
    level: "city",
  },
  // Municipal positions
  {
    positionType: "Mayor",
    maxConsecutiveTerms: 3,
    termLengthYears: 3,
    allowsReelection: true,
    level: "municipal",
  },
  {
    positionType: "Vice Mayor",
    maxConsecutiveTerms: 3,
    termLengthYears: 3,
    allowsReelection: true,
    level: "municipal",
  },
  {
    positionType: "Municipal Councilor",
    maxConsecutiveTerms: 3,
    termLengthYears: 3,
    allowsReelection: true,
    level: "municipal",
  },
  {
    positionType: "Councilor",
    maxConsecutiveTerms: 3,
    termLengthYears: 3,
    allowsReelection: true,
    level: "municipal",
  },
  // Barangay positions
  {
    positionType: "Barangay Captain",
    maxConsecutiveTerms: 3,
    termLengthYears: 3,
    allowsReelection: true,
    level: "barangay",
  },
  {
    positionType: "Barangay Chairman",
    maxConsecutiveTerms: 3,
    termLengthYears: 3,
    allowsReelection: true,
    level: "barangay",
  },
  {
    positionType: "Punong Barangay",
    maxConsecutiveTerms: 3,
    termLengthYears: 3,
    allowsReelection: true,
    level: "barangay",
  },
  {
    positionType: "Barangay Kagawad",
    maxConsecutiveTerms: 3,
    termLengthYears: 3,
    allowsReelection: true,
    level: "barangay",
  },
];

// ============================================
// Helper Functions
// ============================================

/**
 * Get term limit rule for a position type
 * Uses fuzzy matching to handle variations in position titles
 * Validates: Requirement 46.6
 */
export function getTermLimitRule(positionTitle: string): TermLimitRule | null {
  const normalizedTitle = positionTitle.toLowerCase().trim();

  // Direct match first
  const directMatch = TERM_LIMIT_RULES.find(
    (rule) => rule.positionType.toLowerCase() === normalizedTitle
  );
  if (directMatch) {
    return directMatch;
  }

  // Fuzzy matching for common variations
  for (const rule of TERM_LIMIT_RULES) {
    const ruleType = rule.positionType.toLowerCase();

    // Check if position contains the rule type
    if (normalizedTitle.includes(ruleType)) {
      return rule;
    }

    // Check if rule type contains the position (for abbreviated titles)
    if (ruleType.includes(normalizedTitle)) {
      return rule;
    }
  }

  // Special case handling for common variations
  if (normalizedTitle.includes("congressman") || normalizedTitle.includes("congresswoman")) {
    return TERM_LIMIT_RULES.find((r) => r.positionType === "Congressman") || null;
  }

  if (normalizedTitle.includes("representative")) {
    return TERM_LIMIT_RULES.find((r) => r.positionType === "Representative") || null;
  }

  if (normalizedTitle.includes("mayor") && !normalizedTitle.includes("vice")) {
    return TERM_LIMIT_RULES.find((r) => r.positionType === "Mayor") || null;
  }

  if (normalizedTitle.includes("vice mayor")) {
    return TERM_LIMIT_RULES.find((r) => r.positionType === "Vice Mayor") || null;
  }

  if (normalizedTitle.includes("governor") && !normalizedTitle.includes("vice")) {
    return TERM_LIMIT_RULES.find((r) => r.positionType === "Governor") || null;
  }

  if (normalizedTitle.includes("vice governor")) {
    return TERM_LIMIT_RULES.find((r) => r.positionType === "Vice Governor") || null;
  }

  if (normalizedTitle.includes("councilor") || normalizedTitle.includes("kagawad")) {
    return TERM_LIMIT_RULES.find((r) => r.positionType === "Councilor") || null;
  }

  if (normalizedTitle.includes("barangay captain") || normalizedTitle.includes("punong barangay")) {
    return TERM_LIMIT_RULES.find((r) => r.positionType === "Barangay Captain") || null;
  }

  // Default: return null if no match found
  return null;
}

/**
 * Calculate total years in office from positions
 */
export function calculateTotalYearsInOffice(
  positions: Array<{ startDate: Date; endDate: Date | null }>
): number {
  let totalDays = 0;

  for (const pos of positions) {
    const endDate = pos.endDate || new Date();
    const days = Math.floor((endDate.getTime() - pos.startDate.getTime()) / (1000 * 60 * 60 * 24));
    totalDays += Math.max(0, days);
  }

  return Math.round(totalDays / 365);
}

/**
 * Format years range from term details
 */
export function formatYearsRange(terms: TermDetail[]): string {
  if (terms.length === 0) {
    return "";
  }

  const sortedTerms = [...terms].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  const years = sortedTerms.map((term) => {
    const startYear = term.startDate.getFullYear();
    const endYear = term.endDate ? term.endDate.getFullYear() : "present";
    return `${startYear}-${endYear}`;
  });

  return years.join(", ");
}

/**
 * Count consecutive terms for a position
 * Validates: Requirement 46.4
 */
export function countConsecutiveTerms(
  terms: Array<{ termNumber: number; isConsecutive: boolean; isCurrent: boolean }>
): number {
  if (terms.length === 0) {
    return 0;
  }

  // Sort by term number descending to find current consecutive streak
  const sortedTerms = [...terms].sort((a, b) => b.termNumber - a.termNumber);

  let consecutiveCount = 0;
  for (const term of sortedTerms) {
    if (term.isConsecutive || term.termNumber === 1) {
      consecutiveCount++;
    } else {
      break;
    }
  }

  return consecutiveCount;
}

/**
 * Detect term-hopping patterns
 * Term-hopping: switching positions to circumvent term limits
 * Validates: Requirement 46.5
 */
export function detectTermHopping(positionHistory: TermHistory[]): TermHoppingPattern {
  const patterns: TermHoppingInstance[] = [];

  // Sort positions by their earliest term start date
  const sortedPositions = [...positionHistory].sort((a, b) => {
    const aStart = a.terms[0]?.startDate.getTime() || 0;
    const bStart = b.terms[0]?.startDate.getTime() || 0;
    return aStart - bStart;
  });

  // Look for patterns where politician reached limit then switched positions
  for (let i = 0; i < sortedPositions.length - 1; i++) {
    const currentPos = sortedPositions[i];
    const nextPos = sortedPositions[i + 1];

    if (!currentPos || !nextPos) {
      continue;
    }

    // Check if reached limit in current position
    if (currentPos.reachedLimit) {
      // Get the end year of the last term in current position
      const lastTerm = currentPos.terms[currentPos.terms.length - 1];
      const switchYear = lastTerm?.endDate?.getFullYear() || lastTerm?.startDate.getFullYear() || 0;

      // Check if next position started around the same time
      const nextStartYear = nextPos.terms[0]?.startDate.getFullYear() || 0;

      // If positions are within 1 year of each other, it's likely term-hopping
      if (Math.abs(nextStartYear - switchYear) <= 1) {
        patterns.push({
          fromPosition: currentPos.position,
          fromJurisdiction: currentPos.jurisdiction,
          toPosition: nextPos.position,
          toJurisdiction: nextPos.jurisdiction,
          yearOfSwitch: switchYear,
          reachedLimitInPreviousPosition: true,
        });
      }
    }
  }

  return {
    detected: patterns.length > 0,
    patterns,
  };
}

/**
 * Group positions by position type and jurisdiction
 * Validates: Requirement 46.1
 */
export function groupPositionsByTypeAndJurisdiction(
  positions: PositionData[]
): Map<string, PositionData[]> {
  const grouped = new Map<string, PositionData[]>();

  for (const pos of positions) {
    // Create a key based on position title and jurisdiction
    const key = `${pos.title.toLowerCase()}|${pos.jurisdiction.toLowerCase()}`;

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(pos);
  }

  return grouped;
}

// ============================================
// Service Implementation
// ============================================

/**
 * Get term limit status for a politician
 * Validates: Requirements 46.1, 46.2, 46.3, 46.4, 46.5, 46.6
 */
export async function getTermLimitStatus(politicianId: string): Promise<TermLimitStatus | null> {
  const politician = await prisma.politician.findUnique({
    where: { id: politicianId },
    include: {
      Position: {
        orderBy: { startDate: "asc" },
      },
    },
  });

  if (!politician) {
    return null;
  }

  const reviewedBatch = getReleasedProfile(politicianId);
  if (reviewedBatch) {
    return {
      politicianId,
      currentPosition: null,
      positionHistory: [],
      totalYearsInOffice: null,
      termHoppingDetected: null,
      termHoppingPatterns: [],
      positionsWhereReachedLimit: [],
      reviewedBatch,
    };
  }

  return calculateTermLimitStatus(politicianId, politician.Position);
}

/**
 * Calculate term limit status from position data
 * This is the core calculation function that can be used with any position data
 * Validates: Requirements 46.1, 46.2, 46.3, 46.4, 46.5, 46.6
 */
export function calculateTermLimitStatus(
  politicianId: string,
  positions: PositionData[]
): TermLimitStatus {
  // Group positions by type and jurisdiction
  const groupedPositions = groupPositionsByTypeAndJurisdiction(positions);

  // Build position history
  const positionHistory: TermHistory[] = [];
  const positionsWhereReachedLimit: string[] = [];

  for (const [, posGroup] of Array.from(groupedPositions.entries())) {
    const firstPos = posGroup[0];
    if (!firstPos) {
      continue;
    }

    const rule = getTermLimitRule(firstPos.title);
    const maxTerms = rule?.maxConsecutiveTerms || 3; // Default to 3 if no rule found
    const termLengthYears = rule?.termLengthYears || 3;

    // Build term details
    const terms: TermDetail[] = posGroup.map((pos) => ({
      termNumber: pos.termNumber,
      startDate: pos.startDate,
      endDate: pos.endDate,
      isConsecutive: pos.isConsecutive,
      isCurrent: pos.isCurrent,
    }));

    // Count consecutive terms
    const consecutiveTermsServed = countConsecutiveTerms(terms);
    const totalTermsServed = terms.length;
    const reachedLimit = consecutiveTermsServed >= maxTerms;

    if (reachedLimit) {
      positionsWhereReachedLimit.push(`${firstPos.title} (${firstPos.jurisdiction})`);
    }

    positionHistory.push({
      position: firstPos.title,
      level: firstPos.level,
      jurisdiction: firstPos.jurisdiction,
      consecutiveTermsServed,
      totalTermsServed,
      maxTerms,
      termLengthYears,
      reachedLimit,
      years: formatYearsRange(terms),
      terms,
    });
  }

  // Find current position
  const currentPositionData = positions.find((p) => p.isCurrent);
  let currentPosition: CurrentPositionStatus | null = null;

  if (currentPositionData) {
    const rule = getTermLimitRule(currentPositionData.title);
    const maxTerms = rule?.maxConsecutiveTerms || 3;
    const termLengthYears = rule?.termLengthYears || 3;
    const allowsReelection = rule?.allowsReelection ?? true;

    // Find the position history for current position
    const currentHistory = positionHistory.find(
      (h) =>
        h.position.toLowerCase() === currentPositionData.title.toLowerCase() &&
        h.jurisdiction.toLowerCase() === currentPositionData.jurisdiction.toLowerCase()
    );

    const termNumber = currentHistory?.consecutiveTermsServed || currentPositionData.termNumber;
    const termsRemaining = Math.max(0, maxTerms - termNumber);
    const isFinalTerm = termNumber >= maxTerms;
    const eligibleForReelection = allowsReelection && !isFinalTerm;

    currentPosition = {
      position: currentPositionData.title,
      level: currentPositionData.level,
      jurisdiction: currentPositionData.jurisdiction,
      termNumber,
      maxTerms,
      termsRemaining,
      isFinalTerm,
      eligibleForReelection,
      termLengthYears,
    };
  }

  // Calculate total years in office
  const totalYearsInOffice = calculateTotalYearsInOffice(positions);

  // Detect term-hopping patterns
  const termHopping = detectTermHopping(positionHistory);

  return {
    politicianId,
    currentPosition,
    positionHistory,
    totalYearsInOffice,
    termHoppingDetected: termHopping.detected,
    termHoppingPatterns: termHopping.patterns,
    positionsWhereReachedLimit,
  };
}

/**
 * Check if a politician is eligible for re-election in their current position
 * Validates: Requirement 46.3
 */
export async function isEligibleForReelection(politicianId: string): Promise<boolean | null> {
  const status = await getTermLimitStatus(politicianId);

  if (status?.reviewedBatch) {
    return null;
  }

  if (!status?.currentPosition) {
    return false;
  }

  return status.currentPosition.eligibleForReelection;
}

/**
 * Check if a politician is in their final term
 * Validates: Requirement 46.3
 */
export async function isInFinalTerm(politicianId: string): Promise<boolean | null> {
  const status = await getTermLimitStatus(politicianId);

  if (status?.reviewedBatch) {
    return null;
  }

  if (!status?.currentPosition) {
    return false;
  }

  return status.currentPosition.isFinalTerm;
}

/**
 * Get positions where a politician has reached term limits
 * Validates: Requirement 46.6
 */
export async function getPositionsWhereReachedLimit(politicianId: string): Promise<string[]> {
  const status = await getTermLimitStatus(politicianId);

  if (!status) {
    return [];
  }

  return status.positionsWhereReachedLimit;
}

/**
 * Check if term-hopping is detected for a politician
 * Validates: Requirement 46.5
 */
export async function hasTermHopping(politicianId: string): Promise<boolean | null> {
  const status = await getTermLimitStatus(politicianId);

  if (!status) {
    return false;
  }

  return status.termHoppingDetected;
}

/**
 * Get term limit rules for a specific position type
 * Validates: Requirement 46.6
 */
export function getTermLimitRules(): TermLimitRule[] {
  return [...TERM_LIMIT_RULES];
}

/**
 * Get term limit rule by position type
 * Validates: Requirement 46.6
 */
export function getTermLimitRuleByPosition(positionType: string): TermLimitRule | null {
  return getTermLimitRule(positionType);
}
