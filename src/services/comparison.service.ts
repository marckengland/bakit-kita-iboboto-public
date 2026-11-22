import type { FilingRefresh } from "@/lib/senate-refresh";
/**
 * Comparison Service
 *
 * Side-by-side politician comparison with metric highlighting.
 * Implements requirements: 9.1, 9.2, 9.3, 9.4
 */

import { answerFromSenateFilings } from "./senate-chat.service";
import prisma from "@/lib/prisma";
import { getReleasedProfile, type ReleasedProfileContext } from "@/lib/release-data";

// ============================================
// Types and Interfaces
// ============================================

/**
 * Comparison metric category
 */
export type MetricCategory = "legislative" | "financial" | "attendance" | "promises" | "experience";

/**
 * Comparison metric
 * Validates: Requirement 9.2
 */
export interface ComparisonMetric {
  name: string;
  category: MetricCategory;
  values: Record<string, number | string | null>;
  unit?: string;
  higherIsBetter?: boolean;
}

/**
 * Metric difference highlighting
 * Validates: Requirement 9.3
 */
export interface MetricDifference {
  metricName: string;
  category: MetricCategory;
  highestValue: number | string | null;
  highestPoliticianId: string;
  lowestValue: number | string | null;
  lowestPoliticianId: string;
  difference: number | null;
  percentageDifference: number | null;
  isTie: boolean;
}

/**
 * Politician summary for comparison
 */
export interface PoliticianSummary {
  id: string;
  fullName: string;
  photo?: string;
  reviewedBatch?: ReleasedProfileContext;
  currentPosition?: {
    title: string;
    level: string;
    jurisdiction: string;
  };
  currentParty?: {
    name: string;
    abbreviation: string;
  };
}

/**
 * Comparison result
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4
 */
export interface ReviewedComparisonFilings {
  status: string;
  filings: {
    id: string;
    reference: string;
    title: string;
    filingDate: string | null;
    sourceUrl: string;
    refresh?: FilingRefresh;
  }[];
}

export interface ComparisonResult {
  reviewedFilings?: Record<string, ReviewedComparisonFilings>;
  politicians: PoliticianSummary[];
  metrics: ComparisonMetric[];
  differences: MetricDifference[];
  comparedAt: Date;
}

/**
 * Comparison validation error
 */
export class ComparisonValidationError extends Error {
  constructor(
    message: string,
    public code: "TOO_FEW" | "TOO_MANY" | "NOT_FOUND"
  ) {
    super(message);
    this.name = "ComparisonValidationError";
  }
}

// ============================================
// Constants
// ============================================

export const MIN_POLITICIANS = 2;
export const MAX_POLITICIANS = 4;

// ============================================
// Validation Functions
// ============================================

/**
 * Validate politician count for comparison
 * Validates: Requirement 9.4
 */
export function validatePoliticianCount(count: number): void {
  if (count < MIN_POLITICIANS) {
    throw new ComparisonValidationError(
      `Comparison requires at least ${MIN_POLITICIANS} politicians`,
      "TOO_FEW"
    );
  }
  if (count > MAX_POLITICIANS) {
    throw new ComparisonValidationError(
      `Comparison allows at most ${MAX_POLITICIANS} politicians`,
      "TOO_MANY"
    );
  }
}

/**
 * Validate all politician IDs exist
 */
export async function validatePoliticiansExist(politicianIds: string[]): Promise<void> {
  const existingCount = await prisma.politician.count({
    where: { id: { in: politicianIds } },
  });

  if (existingCount !== politicianIds.length) {
    throw new ComparisonValidationError("One or more politicians not found", "NOT_FOUND");
  }
}

// ============================================
// Metric Calculation Functions
// ============================================

/**
 * Calculate legislative metrics for a politician
 */
export async function calculateLegislativeMetrics(
  politicianId: string
): Promise<Record<string, number>> {
  const [billsAuthored, billsPassed, votingRecords] = await Promise.all([
    prisma.billAuthor.count({ where: { politicianId } }),
    prisma.billAuthor.count({
      where: {
        politicianId,
        Bill: { status: "passed" },
      },
    }),
    prisma.votingRecord.count({ where: { politicianId } }),
  ]);

  return {
    billsAuthored,
    billsPassed,
    votingRecords,
    passRate: billsAuthored > 0 ? (billsPassed / billsAuthored) * 100 : 0,
  };
}

/**
 * Calculate financial metrics for a politician
 */
export async function calculateFinancialMetrics(
  politicianId: string
): Promise<Record<string, number | null>> {
  const latestSaln = await prisma.sALNRecord.findFirst({
    where: { politicianId },
    orderBy: { year: "desc" },
  });

  return {
    netWorth: latestSaln?.netWorth.toNumber() ?? null,
    totalAssets: latestSaln?.totalAssets.toNumber() ?? null,
    totalLiabilities: latestSaln?.totalLiabilities.toNumber() ?? null,
    salnYear: latestSaln?.year ?? null,
  };
}

/**
 * Calculate attendance metrics for a politician
 */
export async function calculateAttendanceMetrics(
  politicianId: string
): Promise<Record<string, number>> {
  const [totalSessions, presentSessions] = await Promise.all([
    prisma.sessionAttendance.count({ where: { politicianId } }),
    prisma.sessionAttendance.count({
      where: { politicianId, status: "present" },
    }),
  ]);

  return {
    totalSessions,
    presentSessions,
    attendanceRate: totalSessions > 0 ? (presentSessions / totalSessions) * 100 : 0,
  };
}

/**
 * Calculate promise metrics for a politician
 */
export async function calculatePromiseMetrics(
  politicianId: string
): Promise<Record<string, number>> {
  const promises = await prisma.campaignPromise.groupBy({
    by: ["status"],
    where: { politicianId },
    _count: true,
  });

  const counts = {
    total: 0,
    kept: 0,
    partiallyKept: 0,
    broken: 0,
    inProgress: 0,
  };

  for (const p of promises) {
    counts.total += p._count;
    if (p.status === "kept") {
      counts.kept = p._count;
    }
    if (p.status === "partially_kept") {
      counts.partiallyKept = p._count;
    }
    if (p.status === "broken") {
      counts.broken = p._count;
    }
    if (p.status === "in_progress") {
      counts.inProgress = p._count;
    }
  }

  const fulfillmentRate =
    counts.total > 0 ? ((counts.kept + counts.partiallyKept * 0.5) / counts.total) * 100 : 0;

  return { ...counts, fulfillmentRate };
}

/**
 * Calculate experience metrics for a politician
 */
export async function calculateExperienceMetrics(
  politicianId: string
): Promise<Record<string, number>> {
  const positions = await prisma.position.findMany({
    where: { politicianId },
    select: { startDate: true, endDate: true },
  });

  let totalYears = 0;
  for (const pos of positions) {
    const end = pos.endDate ?? new Date();
    const years = (end.getTime() - pos.startDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
    totalYears += years;
  }

  const electionsWon = await prisma.electionResultRecord.count({
    where: { politicianId, result: "won" },
  });

  return {
    positionsHeld: positions.length,
    totalYearsInOffice: Math.round(totalYears * 10) / 10,
    electionsWon,
  };
}

// ============================================
// Difference Calculation Functions
// ============================================

/**
 * Calculate difference for a numeric metric
 */
export function calculateMetricDifference(metric: ComparisonMetric): MetricDifference | null {
  const numericValues: Array<{ id: string; value: number }> = [];

  for (const [id, value] of Object.entries(metric.values)) {
    if (typeof value === "number" && !isNaN(value)) {
      numericValues.push({ id, value });
    }
  }

  if (numericValues.length < 2) {
    return null;
  }

  const sorted = [...numericValues].sort((a, b) => b.value - a.value);
  const highest = sorted[0];
  const lowest = sorted[sorted.length - 1];

  if (!highest || !lowest) {
    return null;
  }

  const difference = highest.value - lowest.value;

  // If all values are 0, no data to compare
  if (highest.value === 0 && lowest.value === 0) {
    return null;
  }

  // If values are equal (tie), report it as a tie
  if (difference === 0) {
    return {
      metricName: metric.name,
      category: metric.category,
      highestValue: highest.value,
      highestPoliticianId: highest.id,
      lowestValue: lowest.value,
      lowestPoliticianId: lowest.id,
      difference: 0,
      percentageDifference: 0,
      isTie: true,
    };
  }

  const percentageDifference = lowest.value !== 0 ? (difference / lowest.value) * 100 : null;

  return {
    metricName: metric.name,
    category: metric.category,
    highestValue: highest.value,
    highestPoliticianId: highest.id,
    lowestValue: lowest.value,
    lowestPoliticianId: lowest.id,
    difference,
    percentageDifference:
      percentageDifference !== null ? Math.round(percentageDifference * 10) / 10 : null,
    isTie: false,
  };
}

/**
 * Calculate all differences for metrics
 */
export function calculateAllDifferences(metrics: ComparisonMetric[]): MetricDifference[] {
  const differences: MetricDifference[] = [];

  for (const metric of metrics) {
    const diff = calculateMetricDifference(metric);
    if (diff) {
      differences.push(diff);
    }
  }

  return differences;
}

// ============================================
// Main Comparison Functions
// ============================================

/**
 * Get politician summary for comparison
 */
async function getPoliticianSummary(politicianId: string): Promise<PoliticianSummary | null> {
  const politician = await prisma.politician.findUnique({
    where: { id: politicianId },
    include: {
      Position: {
        where: { isCurrent: true },
        take: 1,
      },
      PartyAffiliation: {
        where: { isCurrent: true },
        include: { PoliticalParty: true },
        take: 1,
      },
    },
  });

  if (!politician) {
    return null;
  }

  const currentPosition = politician.Position[0];
  const currentParty = politician.PartyAffiliation[0]?.PoliticalParty;
  const reviewedBatch = getReleasedProfile(politician.id, politician.fullName);

  return {
    id: politician.id,
    fullName: politician.fullName,
    photo: politician.photo ?? undefined,
    ...(reviewedBatch && { reviewedBatch }),
    currentPosition: currentPosition
      ? {
          title: currentPosition.title,
          level: currentPosition.level,
          jurisdiction: currentPosition.jurisdiction,
        }
      : undefined,
    currentParty: currentParty
      ? {
          name: currentParty.name,
          abbreviation: currentParty.abbreviation ?? "",
        }
      : undefined,
  };
}

/**
 * Build comparison metrics for politicians
 */
async function buildComparisonMetrics(politicianIds: string[]): Promise<ComparisonMetric[]> {
  const metrics: ComparisonMetric[] = [];

  // Calculate all metrics for each politician
  const allMetrics = await Promise.all(
    politicianIds.map(async (id) => {
      if (getReleasedProfile(id)) {
        return {
          id,
          legislative: null,
          financial: null,
          attendance: null,
          promises: null,
          experience: null,
        };
      }
      return {
        id,
        legislative: await calculateLegislativeMetrics(id),
        financial: await calculateFinancialMetrics(id),
        attendance: await calculateAttendanceMetrics(id),
        promises: await calculatePromiseMetrics(id),
        experience: await calculateExperienceMetrics(id),
      };
    })
  );

  // Build legislative metrics
  metrics.push({
    name: "Bills Authored",
    category: "legislative",
    values: Object.fromEntries(
      allMetrics.map((m) => [m.id, m.legislative?.billsAuthored ?? null])
    ) as Record<string, number | string | null>,
    higherIsBetter: true,
  });

  metrics.push({
    name: "Bills Passed",
    category: "legislative",
    values: Object.fromEntries(
      allMetrics.map((m) => [m.id, m.legislative?.billsPassed ?? null])
    ) as Record<string, number | string | null>,
    higherIsBetter: true,
  });

  metrics.push({
    name: "Bill Pass Rate",
    category: "legislative",
    values: Object.fromEntries(
      allMetrics.map((m) => [
        m.id,
        (m.legislative?.billsAuthored ?? 0) > 0
          ? Math.round((m.legislative?.passRate ?? 0) * 10) / 10
          : null,
      ])
    ) as Record<string, number | string | null>,
    unit: "%",
    higherIsBetter: true,
  });

  // Build financial metrics
  metrics.push({
    name: "Net Worth",
    category: "financial",
    values: Object.fromEntries(
      allMetrics.map((m) => [m.id, m.financial?.netWorth ?? null])
    ) as Record<string, number | string | null>,
    unit: "PHP",
  });

  // Build attendance metrics
  metrics.push({
    name: "Attendance Rate",
    category: "attendance",
    values: Object.fromEntries(
      allMetrics.map((m) => [
        m.id,
        (m.attendance?.totalSessions ?? 0) > 0
          ? Math.round((m.attendance?.attendanceRate ?? 0) * 10) / 10
          : null,
      ])
    ) as Record<string, number | string | null>,
    unit: "%",
    higherIsBetter: true,
  });

  // Build promise metrics
  metrics.push({
    name: "Promise Fulfillment Rate",
    category: "promises",
    values: Object.fromEntries(
      allMetrics.map((m) => [
        m.id,
        (m.promises?.total ?? 0) > 0
          ? Math.round((m.promises?.fulfillmentRate ?? 0) * 10) / 10
          : null,
      ])
    ) as Record<string, number | string | null>,
    unit: "%",
    higherIsBetter: true,
  });

  // Build experience metrics
  metrics.push({
    name: "Years in Office",
    category: "experience",
    values: Object.fromEntries(
      allMetrics.map((m) => [m.id, m.experience?.totalYearsInOffice ?? null])
    ) as Record<string, number | string | null>,
    unit: "years",
  });

  metrics.push({
    name: "Elections Won",
    category: "experience",
    values: Object.fromEntries(
      allMetrics.map((m) => [m.id, m.experience?.electionsWon ?? null])
    ) as Record<string, number | string | null>,
    higherIsBetter: true,
  });

  return metrics;
}

/**
 * Compare politicians
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4
 */
export async function comparePoliticians(politicianIds: string[]): Promise<ComparisonResult> {
  // Validate count
  validatePoliticianCount(politicianIds.length);

  // Remove duplicates
  const uniqueIds = Array.from(new Set(politicianIds));
  validatePoliticianCount(uniqueIds.length);

  // Validate all politicians exist
  await validatePoliticiansExist(uniqueIds);

  // Get politician summaries
  const politicians = await Promise.all(uniqueIds.map((id) => getPoliticianSummary(id)));

  const validPoliticians = politicians.filter((p): p is PoliticianSummary => p !== null);

  // Build comparison metrics
  const metrics = await buildComparisonMetrics(uniqueIds);

  // Read approved sample facts separately from metrics whose coverage remains unknown.
  const reviewedEntries = await Promise.all(
    validPoliticians
      .filter((profile) => profile.reviewedBatch)
      .map(async (profile) => {
        const answer = await answerFromSenateFilings({
          message: "Show filings",
          politicianId: profile.id,
        });
        return [
          profile.id,
          {
            status: answer.senate?.status ?? "unavailable",
            filings: (answer.senate?.filings ?? []).map((filing) => ({
              id: filing.id,
              reference: filing.reference,
              title: filing.title,
              filingDate: filing.filingDate,
              sourceUrl: filing.sources[0]?.url ?? "/data/senate-20/INDEX.md",
              ...(filing.refresh && { refresh: filing.refresh }),
            })),
          },
        ] as const;
      })
  );
  // Calculate differences
  const differences = calculateAllDifferences(metrics);

  return {
    ...(reviewedEntries.length && { reviewedFilings: Object.fromEntries(reviewedEntries) }),
    politicians: validPoliticians,
    metrics,
    differences,
    comparedAt: new Date(),
  };
}

/**
 * Get comparable metrics for politicians (without full comparison)
 */
export async function getComparableMetrics(politicianIds: string[]): Promise<ComparisonMetric[]> {
  validatePoliticianCount(politicianIds.length);
  const uniqueIds = Array.from(new Set(politicianIds));
  return buildComparisonMetrics(uniqueIds);
}
