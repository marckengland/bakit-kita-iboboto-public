import { legacySourceSelect } from "./public-research.service";
/**
 * SALN Service
 *
 * Service for managing Statement of Assets, Liabilities, and Net Worth (SALN) data
 * with anomaly detection for identifying unusual wealth growth patterns.
 *
 * Implements requirements: 6.1, 6.2, 6.3, 15.1, 15.2, 15.3, 15.6
 * Validates: Property 9 (SALN Anomaly Detection)
 * Implements caching per Requirement 44.3
 */

import { Prisma, SourceType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { DataSourceAttribution } from "./politician.service";
import { enhancedCache, cacheKeyGenerators, EXTENDED_CACHE_TTL } from "@/lib/cache-service";

// ============================================
// Types and Interfaces
// ============================================

/**
 * SALN Property (real or personal)
 * Validates: Requirement 15.6
 */
export interface SALNPropertyData {
  id: string;
  description: string;
  location?: string | null;
  assessedValue: number;
  acquisitionDate?: Date | null;
  acquisitionMode?: string | null;
  isRealProperty: boolean;
}

/**
 * SALN Investment
 * Validates: Requirement 15.6
 */
export interface SALNInvestmentData {
  id: string;
  description: string;
  value: number;
}

/**
 * SALN Anomaly details
 * Validates: Property 9 - anomaly details must include yearOverYearChange, expectedMaxChange, anomalyRatio
 */
export interface SALNAnomalyData {
  yearOverYearChange: number;
  expectedMaxChange: number;
  anomalyRatio: number;
  explanation: string;
}

/**
 * SALN Record with all related data
 * Validates: Requirements 6.1, 6.2, 15.6
 */
export interface SALNRecordData {
  id: string;
  politicianId: string;
  year: number;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  declaredSalary?: number | null;
  anomalyDetected: boolean;
  anomalyDetails?: SALNAnomalyData | null;
  realProperties: SALNPropertyData[];
  personalProperties: SALNPropertyData[];
  investments: SALNInvestmentData[];
  sources: DataSourceAttribution[];
}

/**
 * Net worth timeline data point for charts
 * Validates: Requirement 6.3
 */
export interface NetWorthTimelinePoint {
  year: number;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  yearOverYearChange?: number | null;
  anomalyDetected: boolean;
}

/**
 * Configuration for anomaly detection
 */
export interface AnomalyDetectionConfig {
  /**
   * Multiplier for expected max change based on salary
   * Default: 2.0 (allows for savings, investments, etc.)
   */
  salaryMultiplier: number;
  /**
   * Default expected annual growth rate when no salary is declared (as percentage)
   * Default: 20 (20% annual growth)
   */
  defaultExpectedGrowthRate: number;
  /**
   * Minimum threshold for anomaly ratio to flag as anomaly
   * Default: 1.5 (150% of expected)
   */
  anomalyThreshold: number;
}

const DEFAULT_ANOMALY_CONFIG: AnomalyDetectionConfig = {
  salaryMultiplier: 2.0,
  defaultExpectedGrowthRate: 20,
  anomalyThreshold: 1.5,
};

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
 * Transforms a SALN property from Prisma to the service interface
 */
function transformProperty(property: {
  id: string;
  description: string;
  location: string | null;
  assessedValue: Prisma.Decimal;
  acquisitionDate: Date | null;
  acquisitionMode: string | null;
  isRealProperty: boolean;
}): SALNPropertyData {
  return {
    id: property.id,
    description: property.description,
    location: property.location,
    assessedValue: Number(property.assessedValue),
    acquisitionDate: property.acquisitionDate,
    acquisitionMode: property.acquisitionMode,
    isRealProperty: property.isRealProperty,
  };
}

/**
 * Transforms a SALN investment from Prisma to the service interface
 */
function transformInvestment(investment: {
  id: string;
  description: string;
  value: Prisma.Decimal;
}): SALNInvestmentData {
  return {
    id: investment.id,
    description: investment.description,
    value: Number(investment.value),
  };
}

/**
 * Calculate year-over-year change as percentage
 * Validates: Property 9 - Year-over-year change = (current_net_worth - previous_net_worth) / previous_net_worth * 100
 *
 * @param currentNetWorth - Current year's net worth
 * @param previousNetWorth - Previous year's net worth
 * @returns Percentage change, or null if previous net worth is zero
 */
export function calculateYearOverYearChange(
  currentNetWorth: number,
  previousNetWorth: number
): number | null {
  // Cannot calculate percentage change from zero
  if (previousNetWorth === 0) {
    return null;
  }

  return ((currentNetWorth - previousNetWorth) / Math.abs(previousNetWorth)) * 100;
}

/**
 * Calculate expected maximum change based on declared salary
 * Validates: Requirement 15.3 - Show expected income range based on declared salary
 *
 * @param declaredSalary - Annual declared salary
 * @param previousNetWorth - Previous year's net worth
 * @param config - Anomaly detection configuration
 * @returns Expected maximum percentage change
 */
export function calculateExpectedMaxChange(
  declaredSalary: number | null | undefined,
  previousNetWorth: number,
  config: AnomalyDetectionConfig = DEFAULT_ANOMALY_CONFIG
): number {
  // If no previous net worth, use default growth rate
  if (previousNetWorth === 0) {
    return config.defaultExpectedGrowthRate;
  }

  // If salary is declared, expected max change is salary * multiplier as percentage of net worth
  if (declaredSalary && declaredSalary > 0) {
    const expectedMaxAbsolute = declaredSalary * config.salaryMultiplier;
    return (expectedMaxAbsolute / Math.abs(previousNetWorth)) * 100;
  }

  // Default expected growth rate when no salary is declared
  return config.defaultExpectedGrowthRate;
}

/**
 * Detect anomaly in SALN record
 * Validates: Property 9 - If change exceeds expected range, anomalyDetected = true
 *
 * @param yearOverYearChange - Calculated year-over-year change percentage
 * @param expectedMaxChange - Expected maximum change percentage
 * @param config - Anomaly detection configuration
 * @returns Anomaly data if detected, null otherwise
 */
export function detectAnomaly(
  yearOverYearChange: number | null,
  expectedMaxChange: number,
  config: AnomalyDetectionConfig = DEFAULT_ANOMALY_CONFIG
): SALNAnomalyData | null {
  // Cannot detect anomaly without year-over-year change
  if (yearOverYearChange === null) {
    return null;
  }

  // Only flag positive changes that exceed expected range
  // Negative changes (wealth decrease) are not flagged as anomalies
  if (yearOverYearChange <= 0) {
    return null;
  }

  // Calculate anomaly ratio
  const anomalyRatio = yearOverYearChange / expectedMaxChange;

  // Check if anomaly threshold is exceeded
  if (anomalyRatio >= config.anomalyThreshold) {
    return {
      yearOverYearChange,
      expectedMaxChange,
      anomalyRatio,
      explanation: `Net worth increased by ${yearOverYearChange.toFixed(2)}%, which is ${anomalyRatio.toFixed(2)}x the expected maximum change of ${expectedMaxChange.toFixed(2)}% based on declared income.`,
    };
  }

  return null;
}

// ============================================
// Service Implementation
// ============================================

/**
 * Get SALN history for a politician with anomaly detection
 * Validates: Requirements 6.1, 6.2, 15.1, 15.2, 15.3
 * Implements caching per Requirement 44.3
 *
 * @param politicianId - The politician's ID
 * @param config - Optional anomaly detection configuration
 * @returns Array of SALN records sorted by year ascending
 */
export async function getSALNHistory(
  politicianId: string,
  config: AnomalyDetectionConfig = DEFAULT_ANOMALY_CONFIG
): Promise<SALNRecordData[]> {
  const cacheKey = cacheKeyGenerators.salnHistory(politicianId);

  return enhancedCache.getOrFetch<SALNRecordData[]>(
    cacheKey,
    async () => {
      const records = await prisma.sALNRecord.findMany({
        where: { politicianId },
        orderBy: { year: "asc" },
        include: {
          SALNProperty: true,
          SALNInvestment: true,
          SALNAnomaly: true,
          SourceAttribution: { select: legacySourceSelect },
        },
      });

      // Calculate anomalies for the records
      const recordsWithAnomalies = calculateAnomalies(
        records.map((record) => ({
          id: record.id,
          politicianId: record.politicianId,
          year: record.year,
          totalAssets: Number(record.totalAssets),
          totalLiabilities: Number(record.totalLiabilities),
          netWorth: Number(record.netWorth),
          declaredSalary: record.declaredSalary ? Number(record.declaredSalary) : null,
          anomalyDetected: record.anomalyDetected,
          anomalyDetails: record.SALNAnomaly
            ? {
                yearOverYearChange: Number(record.SALNAnomaly.yearOverYearChange),
                expectedMaxChange: Number(record.SALNAnomaly.expectedMaxChange),
                anomalyRatio: Number(record.SALNAnomaly.anomalyRatio),
                explanation: record.SALNAnomaly.explanation,
              }
            : null,
          realProperties: record.SALNProperty.filter((p) => p.isRealProperty).map(
            transformProperty
          ),
          personalProperties: record.SALNProperty.filter((p) => !p.isRealProperty).map(
            transformProperty
          ),
          investments: record.SALNInvestment.map(transformInvestment),
          sources: record.SourceAttribution.map(transformSourceAttribution),
        })),
        config
      );

      return recordsWithAnomalies;
    },
    EXTENDED_CACHE_TTL.SALN_DATA
  );
}

/**
 * Get a single SALN record with detailed breakdown
 * Validates: Requirement 15.6 - Allow viewing detailed SALN breakdown
 *
 * @param salnId - The SALN record ID
 * @returns SALN record with full details or null if not found
 */
export async function getSALNRecord(salnId: string): Promise<SALNRecordData | null> {
  const record = await prisma.sALNRecord.findUnique({
    where: { id: salnId },
    include: {
      SALNProperty: true,
      SALNInvestment: true,
      SALNAnomaly: true,
      SourceAttribution: { select: legacySourceSelect },
    },
  });

  if (!record) {
    return null;
  }

  return {
    id: record.id,
    politicianId: record.politicianId,
    year: record.year,
    totalAssets: Number(record.totalAssets),
    totalLiabilities: Number(record.totalLiabilities),
    netWorth: Number(record.netWorth),
    declaredSalary: record.declaredSalary ? Number(record.declaredSalary) : null,
    anomalyDetected: record.anomalyDetected,
    anomalyDetails: record.SALNAnomaly
      ? {
          yearOverYearChange: Number(record.SALNAnomaly.yearOverYearChange),
          expectedMaxChange: Number(record.SALNAnomaly.expectedMaxChange),
          anomalyRatio: Number(record.SALNAnomaly.anomalyRatio),
          explanation: record.SALNAnomaly.explanation,
        }
      : null,
    realProperties: record.SALNProperty.filter((p) => p.isRealProperty).map(transformProperty),
    personalProperties: record.SALNProperty.filter((p) => !p.isRealProperty).map(transformProperty),
    investments: record.SALNInvestment.map(transformInvestment),
    sources: record.SourceAttribution.map(transformSourceAttribution),
  };
}

/**
 * Calculate anomalies for a list of SALN records
 * Validates: Property 9 - The calculation must be deterministic and reproducible
 *
 * This function recalculates anomalies based on the provided records,
 * ensuring consistent detection across all records.
 *
 * @param records - Array of SALN records (must be sorted by year ascending)
 * @param config - Anomaly detection configuration
 * @returns Records with calculated anomaly data
 */
export function calculateAnomalies(
  records: SALNRecordData[],
  config: AnomalyDetectionConfig = DEFAULT_ANOMALY_CONFIG
): SALNRecordData[] {
  // Sort records by year to ensure correct calculation
  const sortedRecords = [...records].sort((a, b) => a.year - b.year);

  return sortedRecords.map((record, index) => {
    // First record has no previous year to compare
    if (index === 0) {
      return {
        ...record,
        anomalyDetected: false,
        anomalyDetails: null,
      };
    }

    const previousRecord = sortedRecords[index - 1];
    if (!previousRecord) {
      return {
        ...record,
        anomalyDetected: false,
        anomalyDetails: null,
      };
    }

    // Calculate year-over-year change
    const yearOverYearChange = calculateYearOverYearChange(
      record.netWorth,
      previousRecord.netWorth
    );

    // Calculate expected max change based on declared salary
    const expectedMaxChange = calculateExpectedMaxChange(
      record.declaredSalary,
      previousRecord.netWorth,
      config
    );

    // Detect anomaly
    const anomalyDetails = detectAnomaly(yearOverYearChange, expectedMaxChange, config);

    return {
      ...record,
      anomalyDetected: anomalyDetails !== null,
      anomalyDetails,
    };
  });
}

/**
 * Get net worth timeline data for charts
 * Validates: Requirement 6.3 - Display timeline/chart showing net worth changes over time
 *
 * @param politicianId - The politician's ID
 * @param config - Optional anomaly detection configuration
 * @returns Array of timeline data points sorted by year ascending
 */
export async function getNetWorthTimeline(
  politicianId: string,
  config: AnomalyDetectionConfig = DEFAULT_ANOMALY_CONFIG
): Promise<NetWorthTimelinePoint[]> {
  const records = await prisma.sALNRecord.findMany({
    where: { politicianId },
    orderBy: { year: "asc" },
    select: {
      year: true,
      totalAssets: true,
      totalLiabilities: true,
      netWorth: true,
      declaredSalary: true,
      anomalyDetected: true,
    },
  });

  // Calculate year-over-year changes and anomalies
  return records.map((record, index) => {
    const netWorth = Number(record.netWorth);
    const totalAssets = Number(record.totalAssets);
    const totalLiabilities = Number(record.totalLiabilities);

    // Calculate year-over-year change
    let yearOverYearChange: number | null = null;
    let anomalyDetected = record.anomalyDetected;

    if (index > 0) {
      const previousRecord = records[index - 1];
      if (previousRecord) {
        const previousNetWorth = Number(previousRecord.netWorth);
        yearOverYearChange = calculateYearOverYearChange(netWorth, previousNetWorth);

        // Recalculate anomaly detection for consistency
        const expectedMaxChange = calculateExpectedMaxChange(
          record.declaredSalary ? Number(record.declaredSalary) : null,
          previousNetWorth,
          config
        );
        const anomaly = detectAnomaly(yearOverYearChange, expectedMaxChange, config);
        anomalyDetected = anomaly !== null;
      }
    }

    return {
      year: record.year,
      netWorth,
      totalAssets,
      totalLiabilities,
      yearOverYearChange,
      anomalyDetected,
    };
  });
}

/**
 * Check if a politician has any SALN records
 *
 * @param politicianId - The politician's ID
 * @returns True if SALN records exist
 */
export async function hasSALNRecords(politicianId: string): Promise<boolean> {
  const count = await prisma.sALNRecord.count({
    where: { politicianId },
  });
  return count > 0;
}

/**
 * Get SALN records with anomalies for a politician
 * Useful for red flag detection
 *
 * @param politicianId - The politician's ID
 * @returns Array of SALN records where anomalies were detected
 */
export async function getSALNAnomalies(politicianId: string): Promise<SALNRecordData[]> {
  const history = await getSALNHistory(politicianId);
  return history.filter((record) => record.anomalyDetected);
}
