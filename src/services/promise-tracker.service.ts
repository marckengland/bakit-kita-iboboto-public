import { legacySourceSelect } from "./public-research.service";
/**
 * Promise Tracker Service
 *
 * Service for tracking campaign promises and their fulfillment status.
 * Implements requirements: 23.1, 23.2, 23.3, 23.4, 23.5, 23.6
 */

import {
  Prisma,
  PromiseStatus,
  PromiseEvidenceType,
  SourceType,
  PromiseSignificance,
  PromiseAttribution,
} from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  PaginationParams,
  PaginatedResult,
  getPrismaPageOptions,
  createPaginatedResult,
} from "@/lib/pagination";

// ============================================
// Types and Interfaces
// ============================================

/**
 * Source attribution for promise data
 * Validates: Requirements 12.6, 12.7
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
 * Evidence linked to a fulfilled promise
 * Validates: Requirement 23.5
 */
export interface PromiseEvidenceRecord {
  id: string;
  type: PromiseEvidenceType;
  description: string;
  url?: string | null;
  date: Date;
}

/**
 * Campaign promise with evidence and sources
 * Validates: Requirements 23.1, 23.2, 23.3, 23.5
 */
export interface CampaignPromiseRecord {
  id: string;
  politicianId: string;
  electionYear: number;
  promiseText: string;
  category: string;
  status: PromiseStatus;
  significance: PromiseSignificance | null;
  attribution: PromiseAttribution | null;
  inheritedFrom: string | null;
  analysisNotes: string | null;
  evidence: PromiseEvidenceRecord[];
  sources: DataSourceAttribution[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Promise fulfillment rate calculation result
 * Validates: Requirement 23.3
 */
export interface FulfillmentRate {
  totalPromises: number;
  keptCount: number;
  partiallyKeptCount: number;
  brokenCount: number;
  inProgressCount: number;
  notYetDueCount: number;
  fulfillmentRate: number;
  fulfillmentPercentage: string;
}

/**
 * Promise summary by category
 * Validates: Requirement 23.4
 */
export interface PromiseCategorySummary {
  category: string;
  totalCount: number;
  keptCount: number;
  partiallyKeptCount: number;
  brokenCount: number;
  inProgressCount: number;
  notYetDueCount: number;
  fulfillmentRate: number;
}

/**
 * Promise timeline entry
 * Validates: Requirement 23.6
 */
export interface PromiseTimelineEntry {
  id: string;
  promiseText: string;
  category: string;
  status: PromiseStatus;
  electionYear: number;
  latestEvidenceDate?: Date | null;
}

/**
 * Filters for querying promises
 */
export interface PromiseFilters {
  status?: PromiseStatus;
  category?: string;
  electionYear?: number;
}

// ============================================
// Promise Categories
// ============================================

/**
 * Standard promise categories for Philippine politics
 * Validates: Requirement 23.4
 */
export const PROMISE_CATEGORIES = [
  "economy",
  "health",
  "education",
  "infrastructure",
  "agriculture",
  "environment",
  "security",
  "governance",
  "social_welfare",
  "foreign_policy",
  "labor",
  "housing",
  "transportation",
  "technology",
  "other",
] as const;

export type PromiseCategory = (typeof PROMISE_CATEGORIES)[number];

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
 * Transforms a Prisma CampaignPromise to the service interface
 */
function transformCampaignPromise(promise: {
  id: string;
  politicianId: string;
  electionYear: number;
  promiseText: string;
  category: string;
  status: PromiseStatus;
  significance: PromiseSignificance | null;
  attribution: PromiseAttribution | null;
  inheritedFrom: string | null;
  analysisNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  PromiseEvidence: Array<{
    id: string;
    type: PromiseEvidenceType;
    description: string;
    url: string | null;
    date: Date;
  }>;
  SourceAttribution: Array<{
    sourceType: SourceType;
    sourceName: string;
    sourceUrl: string | null;
    documentDate: Date | null;
    retrievedAt: Date;
    confidence: Prisma.Decimal | null;
    isAIProcessed: boolean;
    originalDocumentId: string | null;
    fieldName: string;
  }>;
}): CampaignPromiseRecord {
  return {
    id: promise.id,
    politicianId: promise.politicianId,
    electionYear: promise.electionYear,
    promiseText: promise.promiseText,
    category: promise.category,
    status: promise.status,
    significance: promise.significance,
    attribution: promise.attribution,
    inheritedFrom: promise.inheritedFrom,
    analysisNotes: promise.analysisNotes,
    evidence: promise.PromiseEvidence.map((e) => ({
      id: e.id,
      type: e.type,
      description: e.description,
      url: e.url,
      date: e.date,
    })),
    sources: promise.SourceAttribution.map(transformSourceAttribution),
    createdAt: promise.createdAt,
    updatedAt: promise.updatedAt,
  };
}

/**
 * Calculates fulfillment rate from promise counts
 * Formula: (kept + partially_kept * 0.5) / total_promises * 100
 * Validates: Requirement 23.3, Property 12
 */
export function calculateFulfillmentRate(
  keptCount: number,
  partiallyKeptCount: number,
  totalPromises: number
): number {
  if (totalPromises === 0) {
    return 0;
  }
  return ((keptCount + partiallyKeptCount * 0.5) / totalPromises) * 100;
}

// ============================================
// Service Implementation
// ============================================

/**
 * Get all campaign promises for a politician
 * Validates: Requirement 23.1
 */
export async function getPromisesByPolitician(
  politicianId: string,
  filters: PromiseFilters = {},
  pagination: PaginationParams = { page: 1, pageSize: 20 }
): Promise<PaginatedResult<CampaignPromiseRecord>> {
  const where: Prisma.CampaignPromiseWhereInput = {
    politicianId,
    ...(filters.status && { status: filters.status }),
    ...(filters.category && { category: filters.category }),
    ...(filters.electionYear && { electionYear: filters.electionYear }),
  };

  const { skip, take } = getPrismaPageOptions(pagination);

  const [totalCount, promises] = await Promise.all([
    prisma.campaignPromise.count({ where }),
    prisma.campaignPromise.findMany({
      where,
      skip,
      take,
      orderBy: [{ electionYear: "desc" }, { createdAt: "desc" }],
      include: {
        PromiseEvidence: {
          orderBy: { date: "desc" },
        },
        SourceAttribution: { select: legacySourceSelect },
      },
    }),
  ]);

  const items = promises.map(transformCampaignPromise);
  return createPaginatedResult(items, totalCount, pagination);
}

/**
 * Get promises filtered by status
 * Validates: Requirement 23.2
 */
export async function getPromisesByStatus(
  politicianId: string,
  status: PromiseStatus
): Promise<CampaignPromiseRecord[]> {
  const promises = await prisma.campaignPromise.findMany({
    where: {
      politicianId,
      status,
    },
    orderBy: [{ electionYear: "desc" }, { createdAt: "desc" }],
    include: {
      PromiseEvidence: {
        orderBy: { date: "desc" },
      },
      SourceAttribution: { select: legacySourceSelect },
    },
  });

  return promises.map(transformCampaignPromise);
}

/**
 * Get promises filtered by category
 * Validates: Requirement 23.4
 */
export async function getPromisesByCategory(
  politicianId: string,
  category: string
): Promise<CampaignPromiseRecord[]> {
  const promises = await prisma.campaignPromise.findMany({
    where: {
      politicianId,
      category,
    },
    orderBy: [{ electionYear: "desc" }, { createdAt: "desc" }],
    include: {
      PromiseEvidence: {
        orderBy: { date: "desc" },
      },
      SourceAttribution: { select: legacySourceSelect },
    },
  });

  return promises.map(transformCampaignPromise);
}

/**
 * Get a single campaign promise by ID
 */
export async function getPromise(id: string): Promise<CampaignPromiseRecord | null> {
  const promise = await prisma.campaignPromise.findUnique({
    where: { id },
    include: {
      PromiseEvidence: {
        orderBy: { date: "desc" },
      },
      SourceAttribution: { select: legacySourceSelect },
    },
  });

  if (!promise) {
    return null;
  }

  return transformCampaignPromise(promise);
}

/**
 * Get evidence for a specific promise
 * Validates: Requirement 23.5
 */
export async function getPromiseEvidence(promiseId: string): Promise<PromiseEvidenceRecord[]> {
  const evidence = await prisma.promiseEvidence.findMany({
    where: { campaignPromiseId: promiseId },
    orderBy: { date: "desc" },
  });

  return evidence.map((e) => ({
    id: e.id,
    type: e.type,
    description: e.description,
    url: e.url,
    date: e.date,
  }));
}

/**
 * Calculate fulfillment rate for a politician
 * Validates: Requirement 23.3, Property 12
 */
export async function getFulfillmentRate(politicianId: string): Promise<FulfillmentRate> {
  const promises = await prisma.campaignPromise.findMany({
    where: { politicianId },
    select: { status: true },
  });

  const totalPromises = promises.length;
  const keptCount = promises.filter((p) => p.status === "kept").length;
  const partiallyKeptCount = promises.filter((p) => p.status === "partially_kept").length;
  const brokenCount = promises.filter((p) => p.status === "broken").length;
  const inProgressCount = promises.filter((p) => p.status === "in_progress").length;
  const notYetDueCount = promises.filter((p) => p.status === "not_yet_due").length;

  const fulfillmentRate = calculateFulfillmentRate(keptCount, partiallyKeptCount, totalPromises);

  return {
    totalPromises,
    keptCount,
    partiallyKeptCount,
    brokenCount,
    inProgressCount,
    notYetDueCount,
    fulfillmentRate,
    fulfillmentPercentage: `${fulfillmentRate.toFixed(1)}%`,
  };
}

/**
 * Get promise summary by category for a politician
 * Validates: Requirement 23.4
 */
export async function getPromiseSummaryByCategory(
  politicianId: string
): Promise<PromiseCategorySummary[]> {
  const promises = await prisma.campaignPromise.findMany({
    where: { politicianId },
    select: {
      category: true,
      status: true,
    },
  });

  // Group by category
  const categoryMap = new Map<
    string,
    {
      totalCount: number;
      keptCount: number;
      partiallyKeptCount: number;
      brokenCount: number;
      inProgressCount: number;
      notYetDueCount: number;
    }
  >();

  for (const promise of promises) {
    const existing = categoryMap.get(promise.category) || {
      totalCount: 0,
      keptCount: 0,
      partiallyKeptCount: 0,
      brokenCount: 0,
      inProgressCount: 0,
      notYetDueCount: 0,
    };

    existing.totalCount++;
    switch (promise.status) {
      case "kept":
        existing.keptCount++;
        break;
      case "partially_kept":
        existing.partiallyKeptCount++;
        break;
      case "broken":
        existing.brokenCount++;
        break;
      case "in_progress":
        existing.inProgressCount++;
        break;
      case "not_yet_due":
        existing.notYetDueCount++;
        break;
    }

    categoryMap.set(promise.category, existing);
  }

  // Convert to array and calculate fulfillment rates
  const summaries: PromiseCategorySummary[] = [];
  categoryMap.forEach((counts, category) => {
    summaries.push({
      category,
      ...counts,
      fulfillmentRate: calculateFulfillmentRate(
        counts.keptCount,
        counts.partiallyKeptCount,
        counts.totalCount
      ),
    });
  });

  // Sort by total count descending
  return summaries.sort((a, b) => b.totalCount - a.totalCount);
}

/**
 * Get promise timeline for a politician
 * Validates: Requirement 23.6
 */
export async function getPromiseTimeline(politicianId: string): Promise<PromiseTimelineEntry[]> {
  const promises = await prisma.campaignPromise.findMany({
    where: { politicianId },
    orderBy: [{ electionYear: "desc" }, { createdAt: "desc" }],
    include: {
      PromiseEvidence: {
        orderBy: { date: "desc" },
        take: 1,
      },
    },
  });

  return promises.map((p) => ({
    id: p.id,
    promiseText: p.promiseText,
    category: p.category,
    status: p.status,
    electionYear: p.electionYear,
    latestEvidenceDate: p.PromiseEvidence[0]?.date || null,
  }));
}

/**
 * Get promises by election year
 */
export async function getPromisesByElectionYear(
  politicianId: string,
  electionYear: number
): Promise<CampaignPromiseRecord[]> {
  const promises = await prisma.campaignPromise.findMany({
    where: {
      politicianId,
      electionYear,
    },
    orderBy: { createdAt: "desc" },
    include: {
      PromiseEvidence: {
        orderBy: { date: "desc" },
      },
      SourceAttribution: { select: legacySourceSelect },
    },
  });

  return promises.map(transformCampaignPromise);
}

/**
 * Check if a politician has any campaign promises
 */
export async function hasPromises(politicianId: string): Promise<boolean> {
  const count = await prisma.campaignPromise.count({
    where: { politicianId },
  });
  return count > 0;
}

/**
 * Get all unique categories for a politician's promises
 */
export async function getPromiseCategories(politicianId: string): Promise<string[]> {
  const promises = await prisma.campaignPromise.findMany({
    where: { politicianId },
    select: { category: true },
    distinct: ["category"],
  });

  return promises.map((p) => p.category);
}

/**
 * Get all election years with promises for a politician
 */
export async function getPromiseElectionYears(politicianId: string): Promise<number[]> {
  const promises = await prisma.campaignPromise.findMany({
    where: { politicianId },
    select: { electionYear: true },
    distinct: ["electionYear"],
    orderBy: { electionYear: "desc" },
  });

  return promises.map((p) => p.electionYear);
}

/**
 * Get fulfilled promises with their evidence
 * Validates: Requirement 23.5
 */
export async function getFulfilledPromisesWithEvidence(
  politicianId: string
): Promise<CampaignPromiseRecord[]> {
  const promises = await prisma.campaignPromise.findMany({
    where: {
      politicianId,
      status: {
        in: ["kept", "partially_kept"],
      },
    },
    orderBy: [{ electionYear: "desc" }, { createdAt: "desc" }],
    include: {
      PromiseEvidence: {
        orderBy: { date: "desc" },
      },
      SourceAttribution: { select: legacySourceSelect },
    },
  });

  return promises.map(transformCampaignPromise);
}

/**
 * Get promise counts by status for a politician
 */
export async function getPromiseCountsByStatus(
  politicianId: string
): Promise<Record<PromiseStatus, number>> {
  const promises = await prisma.campaignPromise.findMany({
    where: { politicianId },
    select: { status: true },
  });

  const counts: Record<PromiseStatus, number> = {
    kept: 0,
    partially_kept: 0,
    broken: 0,
    in_progress: 0,
    not_yet_due: 0,
  };

  for (const promise of promises) {
    counts[promise.status]++;
  }

  return counts;
}
