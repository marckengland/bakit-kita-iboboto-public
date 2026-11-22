import { legacySourceSelect } from "./public-research.service";
/**
 * Campaign Finance Service
 *
 * Service for managing campaign finance data from COMELEC Statement of
 * Contributions and Expenditures (SOCE) filings.
 *
 * Implements requirements: 21.1, 21.2, 21.3, 21.4, 21.5
 *
 * Validates:
 * - Property 3: Data Completeness (all required fields present)
 * - Property 4: Source Attribution (COMELEC SOCE citation)
 */

import {
  Prisma,
  SourceType,
  DonorType,
  ContributionType,
  ExpenditureCategory,
} from "@prisma/client";
import prisma from "@/lib/prisma";
import { DataSourceAttribution } from "./politician.service";

// ============================================
// Types and Interfaces
// ============================================

/**
 * Campaign contribution data
 * Validates: Requirements 21.2, 21.4
 */
export interface CampaignContributionData {
  id: string;
  donorName: string;
  donorType: DonorType;
  amount: number;
  type: ContributionType;
  date: Date;
  isNotableDonor: boolean;
}

/**
 * Campaign expenditure data
 * Validates: Requirement 21.3
 */
export interface CampaignExpenditureData {
  id: string;
  category: ExpenditureCategory;
  description: string;
  amount: number;
  date: Date;
}

/**
 * Campaign finance record
 * Validates: Requirements 21.1, 21.2, 21.3, 21.4, 21.5
 */
export interface CampaignFinanceData {
  id: string;
  politicianId: string;
  electionYear: number;
  totalContributions: number;
  totalExpenditures: number;
  spendingLimit: number;
  withinLimit: boolean;
  contributions: CampaignContributionData[];
  expenditures: CampaignExpenditureData[];
  sources: DataSourceAttribution[];
}

/**
 * Summary of campaign finance for comparison
 * Validates: Requirement 21.6
 */
export interface CampaignFinanceSummary {
  politicianId: string;
  electionYear: number;
  totalContributions: number;
  totalExpenditures: number;
  spendingLimit: number;
  withinLimit: boolean;
  topContributors: CampaignContributionData[];
  topExpenditureCategories: { category: ExpenditureCategory; total: number }[];
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
 * Transforms a campaign contribution from Prisma to the service interface
 */
function transformContribution(contribution: {
  id: string;
  donorName: string;
  donorType: DonorType;
  amount: Prisma.Decimal;
  type: ContributionType;
  date: Date;
  isNotableDonor: boolean;
}): CampaignContributionData {
  return {
    id: contribution.id,
    donorName: contribution.donorName,
    donorType: contribution.donorType,
    amount: Number(contribution.amount),
    type: contribution.type,
    date: contribution.date,
    isNotableDonor: contribution.isNotableDonor,
  };
}

/**
 * Transforms a campaign expenditure from Prisma to the service interface
 */
function transformExpenditure(expenditure: {
  id: string;
  category: ExpenditureCategory;
  description: string;
  amount: Prisma.Decimal;
  date: Date;
}): CampaignExpenditureData {
  return {
    id: expenditure.id,
    category: expenditure.category,
    description: expenditure.description,
    amount: Number(expenditure.amount),
    date: expenditure.date,
  };
}

/**
 * Check if spending is within COMELEC limit
 * Validates: Requirement 21.5 - Show whether politician stayed within spending limits
 *
 * @param totalExpenditures - Total campaign expenditures
 * @param spendingLimit - COMELEC spending limit
 * @returns True if within limit
 */
export function checkSpendingCompliance(totalExpenditures: number, spendingLimit: number): boolean {
  return totalExpenditures <= spendingLimit;
}

/**
 * Calculate spending limit compliance percentage
 *
 * @param totalExpenditures - Total campaign expenditures
 * @param spendingLimit - COMELEC spending limit
 * @returns Percentage of limit used (can exceed 100%)
 */
export function calculateSpendingPercentage(
  totalExpenditures: number,
  spendingLimit: number
): number {
  if (spendingLimit === 0) {
    return totalExpenditures > 0 ? Infinity : 0;
  }
  return (totalExpenditures / spendingLimit) * 100;
}

// ============================================
// Service Implementation
// ============================================

/**
 * Get campaign finance records for a politician
 * Validates: Requirements 21.1, 21.7
 *
 * @param politicianId - The politician's ID
 * @returns Array of campaign finance records sorted by election year descending
 */
export async function getCampaignFinanceHistory(
  politicianId: string
): Promise<CampaignFinanceData[]> {
  const records = await prisma.campaignFinance.findMany({
    where: { politicianId },
    orderBy: { electionYear: "desc" },
    include: {
      CampaignContribution: {
        orderBy: { amount: "desc" },
      },
      CampaignExpenditure: {
        orderBy: { amount: "desc" },
      },
      SourceAttribution: { select: legacySourceSelect },
    },
  });

  return records.map((record) => ({
    id: record.id,
    politicianId: record.politicianId,
    electionYear: record.electionYear,
    totalContributions: Number(record.totalContributions),
    totalExpenditures: Number(record.totalExpenditures),
    spendingLimit: Number(record.spendingLimit),
    withinLimit: record.withinLimit,
    contributions: record.CampaignContribution.map(transformContribution),
    expenditures: record.CampaignExpenditure.map(transformExpenditure),
    sources: record.SourceAttribution.map(transformSourceAttribution),
  }));
}

/**
 * Get a single campaign finance record
 * Validates: Requirements 21.2, 21.3, 21.7
 *
 * @param campaignFinanceId - The campaign finance record ID
 * @returns Campaign finance record or null if not found
 */
export async function getCampaignFinance(
  campaignFinanceId: string
): Promise<CampaignFinanceData | null> {
  const record = await prisma.campaignFinance.findUnique({
    where: { id: campaignFinanceId },
    include: {
      CampaignContribution: {
        orderBy: { amount: "desc" },
      },
      CampaignExpenditure: {
        orderBy: { amount: "desc" },
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
    electionYear: record.electionYear,
    totalContributions: Number(record.totalContributions),
    totalExpenditures: Number(record.totalExpenditures),
    spendingLimit: Number(record.spendingLimit),
    withinLimit: record.withinLimit,
    contributions: record.CampaignContribution.map(transformContribution),
    expenditures: record.CampaignExpenditure.map(transformExpenditure),
    sources: record.SourceAttribution.map(transformSourceAttribution),
  };
}

/**
 * Get campaign finance for a specific election year
 * Validates: Requirement 21.1
 *
 * @param politicianId - The politician's ID
 * @param electionYear - The election year
 * @returns Campaign finance record or null if not found
 */
export async function getCampaignFinanceByYear(
  politicianId: string,
  electionYear: number
): Promise<CampaignFinanceData | null> {
  const record = await prisma.campaignFinance.findUnique({
    where: {
      politicianId_electionYear: {
        politicianId,
        electionYear,
      },
    },
    include: {
      CampaignContribution: {
        orderBy: { amount: "desc" },
      },
      CampaignExpenditure: {
        orderBy: { amount: "desc" },
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
    electionYear: record.electionYear,
    totalContributions: Number(record.totalContributions),
    totalExpenditures: Number(record.totalExpenditures),
    spendingLimit: Number(record.spendingLimit),
    withinLimit: record.withinLimit,
    contributions: record.CampaignContribution.map(transformContribution),
    expenditures: record.CampaignExpenditure.map(transformExpenditure),
    sources: record.SourceAttribution.map(transformSourceAttribution),
  };
}

/**
 * Get notable donors (large contributions from corporations or individuals)
 * Validates: Requirement 21.4 - Highlight notable donors
 *
 * @param politicianId - The politician's ID
 * @param electionYear - Optional election year filter
 * @returns Array of notable contributions sorted by amount descending
 */
export async function getNotableDonors(
  politicianId: string,
  electionYear?: number
): Promise<CampaignContributionData[]> {
  const whereClause: Prisma.CampaignContributionWhereInput = {
    CampaignFinance: {
      politicianId,
      ...(electionYear && { electionYear }),
    },
    isNotableDonor: true,
  };

  const contributions = await prisma.campaignContribution.findMany({
    where: whereClause,
    orderBy: { amount: "desc" },
  });

  return contributions.map(transformContribution);
}

/**
 * Get top contributors across all elections
 * Validates: Requirement 21.4
 *
 * @param politicianId - The politician's ID
 * @param limit - Maximum number of contributors to return
 * @returns Array of top contributions sorted by amount descending
 */
export async function getTopContributors(
  politicianId: string,
  limit: number = 10
): Promise<CampaignContributionData[]> {
  const contributions = await prisma.campaignContribution.findMany({
    where: {
      CampaignFinance: {
        politicianId,
      },
    },
    orderBy: { amount: "desc" },
    take: limit,
  });

  return contributions.map(transformContribution);
}

/**
 * Get expenditures by category for a politician
 * Validates: Requirement 21.3 - Categorize spending
 *
 * @param politicianId - The politician's ID
 * @param electionYear - Optional election year filter
 * @returns Array of expenditure totals by category
 */
export async function getExpendituresByCategory(
  politicianId: string,
  electionYear?: number
): Promise<{ category: ExpenditureCategory; total: number }[]> {
  const whereClause: Prisma.CampaignExpenditureWhereInput = {
    CampaignFinance: {
      politicianId,
      ...(electionYear && { electionYear }),
    },
  };

  const expenditures = await prisma.campaignExpenditure.groupBy({
    by: ["category"],
    where: whereClause,
    _sum: {
      amount: true,
    },
    orderBy: {
      _sum: {
        amount: "desc",
      },
    },
  });

  return expenditures.map((e) => ({
    category: e.category,
    total: Number(e._sum.amount) || 0,
  }));
}

/**
 * Get campaign finance summary for comparison
 * Validates: Requirement 21.6 - Include campaign spending as comparable metric
 *
 * @param politicianId - The politician's ID
 * @param electionYear - The election year
 * @returns Campaign finance summary or null if not found
 */
export async function getCampaignFinanceSummary(
  politicianId: string,
  electionYear: number
): Promise<CampaignFinanceSummary | null> {
  const record = await getCampaignFinanceByYear(politicianId, electionYear);

  if (!record) {
    return null;
  }

  // Get top 5 contributors
  const topContributors = record.contributions.filter((c) => c.isNotableDonor).slice(0, 5);

  // Calculate expenditure totals by category
  const categoryTotals = new Map<ExpenditureCategory, number>();
  for (const exp of record.expenditures) {
    const current = categoryTotals.get(exp.category) || 0;
    categoryTotals.set(exp.category, current + exp.amount);
  }

  const topExpenditureCategories = Array.from(categoryTotals.entries())
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return {
    politicianId: record.politicianId,
    electionYear: record.electionYear,
    totalContributions: record.totalContributions,
    totalExpenditures: record.totalExpenditures,
    spendingLimit: record.spendingLimit,
    withinLimit: record.withinLimit,
    topContributors,
    topExpenditureCategories,
  };
}

/**
 * Check if a politician has campaign finance records
 *
 * @param politicianId - The politician's ID
 * @returns True if campaign finance records exist
 */
export async function hasCampaignFinanceRecords(politicianId: string): Promise<boolean> {
  const count = await prisma.campaignFinance.count({
    where: { politicianId },
  });
  return count > 0;
}

/**
 * Get politicians who exceeded spending limits
 * Useful for red flag detection
 *
 * @param electionYear - Optional election year filter
 * @returns Array of campaign finance records where spending exceeded limits
 */
export async function getSpendingLimitViolations(
  electionYear?: number
): Promise<CampaignFinanceData[]> {
  const records = await prisma.campaignFinance.findMany({
    where: {
      withinLimit: false,
      ...(electionYear && { electionYear }),
    },
    include: {
      CampaignContribution: {
        orderBy: { amount: "desc" },
      },
      CampaignExpenditure: {
        orderBy: { amount: "desc" },
      },
      SourceAttribution: { select: legacySourceSelect },
    },
  });

  return records.map((record) => ({
    id: record.id,
    politicianId: record.politicianId,
    electionYear: record.electionYear,
    totalContributions: Number(record.totalContributions),
    totalExpenditures: Number(record.totalExpenditures),
    spendingLimit: Number(record.spendingLimit),
    withinLimit: record.withinLimit,
    contributions: record.CampaignContribution.map(transformContribution),
    expenditures: record.CampaignExpenditure.map(transformExpenditure),
    sources: record.SourceAttribution.map(transformSourceAttribution),
  }));
}
