/**
 * Legislative Impact Score Service
 *
 * Service for calculating and retrieving legislative impact scores.
 * Implements requirements: 30.1, 30.2, 30.3, 30.4, 30.5, 30.6
 */

import { BillStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getReleasedProfile, type ReleasedProfileContext } from "@/lib/release-data";

// ============================================
// Types and Interfaces
// ============================================

/**
 * Score breakdown component
 * Validates: Requirement 30.3
 */
export interface ScoreComponent {
  name: string;
  value: number;
  weight: number;
  weightedValue: number;
  description: string;
}

/**
 * Legislative Impact Score result
 * Validates: Requirements 30.1, 30.2, 30.3
 */
export interface LegislativeImpactScore {
  politicianId: string;
  totalScore: number | null;
  scoreOutOf100: number | null;
  breakdown: ScoreComponent[];
  billsPassedIntoLaw: number | null;
  billsPending: number | null;
  totalBillsAuthored: number | null;
  estimatedPopulationAffected: number | null;
  totalBudgetAllocated: number | null;
  lastCalculatedAt: Date | null;
  unavailableReason?: "selected_filings_only" | "unknown_bill_status";
  reviewedBatch?: ReleasedProfileContext;
}

/**
 * Scoring methodology explanation
 * Validates: Requirement 30.6
 */
export interface ScoringMethodology {
  description: string;
  components: {
    name: string;
    weight: number;
    maxPoints: number;
    explanation: string;
  }[];
  formula: string;
  lastUpdated: Date;
}

// ============================================
// Scoring Constants
// ============================================

/**
 * Weight configuration for impact score calculation
 * Validates: Requirement 30.4 - laws weighted higher than pending bills
 */
export const SCORE_WEIGHTS = {
  // Bills that became law (highest weight)
  lawWeight: 10,
  // Pending bills (lower weight)
  pendingWeight: 2,
  // Population affected per million
  populationWeight: 5,
  // Budget allocated per billion PHP
  budgetWeight: 3,
} as const;

/**
 * Maximum values for normalization
 */
export const MAX_VALUES = {
  laws: 50, // Max laws for full score
  pendingBills: 100, // Max pending bills for full score
  population: 100, // Population in millions
  budget: 100, // Budget in billions PHP
} as const;

/**
 * Score component names
 */
export const COMPONENT_NAMES = {
  LAWS_PASSED: "Laws Passed",
  PENDING_BILLS: "Pending Bills",
  POPULATION_AFFECTED: "Population Affected",
  BUDGET_ALLOCATED: "Budget Allocated",
} as const;

// ============================================
// Core Calculation Functions
// ============================================

/**
 * Calculate the weighted score for laws passed
 * Validates: Requirement 30.4
 */
export function calculateLawsScore(lawsCount: number): ScoreComponent {
  const normalizedValue = Math.min(lawsCount / MAX_VALUES.laws, 1);
  const weightedValue = normalizedValue * SCORE_WEIGHTS.lawWeight * 10;

  return {
    name: COMPONENT_NAMES.LAWS_PASSED,
    value: lawsCount,
    weight: SCORE_WEIGHTS.lawWeight,
    weightedValue,
    description: `${lawsCount} bill(s) became law`,
  };
}

/**
 * Calculate the weighted score for pending bills
 * Validates: Requirement 30.4
 */
export function calculatePendingBillsScore(pendingCount: number): ScoreComponent {
  const normalizedValue = Math.min(pendingCount / MAX_VALUES.pendingBills, 1);
  const weightedValue = normalizedValue * SCORE_WEIGHTS.pendingWeight * 10;

  return {
    name: COMPONENT_NAMES.PENDING_BILLS,
    value: pendingCount,
    weight: SCORE_WEIGHTS.pendingWeight,
    weightedValue,
    description: `${pendingCount} bill(s) pending`,
  };
}

/**
 * Calculate the weighted score for population affected
 * Validates: Requirement 30.2
 */
export function calculatePopulationScore(populationMillions: number): ScoreComponent {
  const normalizedValue = Math.min(populationMillions / MAX_VALUES.population, 1);
  const weightedValue = normalizedValue * SCORE_WEIGHTS.populationWeight * 10;

  return {
    name: COMPONENT_NAMES.POPULATION_AFFECTED,
    value: populationMillions,
    weight: SCORE_WEIGHTS.populationWeight,
    weightedValue,
    description: `Estimated ${populationMillions.toFixed(1)}M population affected`,
  };
}

/**
 * Calculate the weighted score for budget allocated
 * Validates: Requirement 30.2
 */
export function calculateBudgetScore(budgetBillions: number): ScoreComponent {
  const normalizedValue = Math.min(budgetBillions / MAX_VALUES.budget, 1);
  const weightedValue = normalizedValue * SCORE_WEIGHTS.budgetWeight * 10;

  return {
    name: COMPONENT_NAMES.BUDGET_ALLOCATED,
    value: budgetBillions,
    weight: SCORE_WEIGHTS.budgetWeight,
    weightedValue,
    description: `₱${budgetBillions.toFixed(2)}B budget allocated to projects`,
  };
}

/**
 * Calculate the total impact score from components
 * Validates: Requirements 30.1, 30.2, 30.3, 30.4
 */
export function calculateTotalScore(components: ScoreComponent[]): number {
  return components.reduce((sum, component) => sum + component.weightedValue, 0);
}

/**
 * Normalize score to 0-100 scale
 */
export function normalizeScore(totalScore: number): number {
  // Maximum possible score based on weights
  const maxPossibleScore =
    SCORE_WEIGHTS.lawWeight * 10 +
    SCORE_WEIGHTS.pendingWeight * 10 +
    SCORE_WEIGHTS.populationWeight * 10 +
    SCORE_WEIGHTS.budgetWeight * 10;

  return Math.min((totalScore / maxPossibleScore) * 100, 100);
}

/**
 * Calculate complete legislative impact score
 * Validates: Requirements 30.1, 30.2, 30.3, 30.4
 */
export function calculateImpactScore(
  lawsCount: number,
  pendingCount: number,
  populationMillions: number,
  budgetBillions: number
): {
  totalScore: number;
  scoreOutOf100: number;
  breakdown: ScoreComponent[];
} {
  const lawsComponent = calculateLawsScore(lawsCount);
  const pendingComponent = calculatePendingBillsScore(pendingCount);
  const populationComponent = calculatePopulationScore(populationMillions);
  const budgetComponent = calculateBudgetScore(budgetBillions);

  const breakdown = [lawsComponent, pendingComponent, populationComponent, budgetComponent];
  const totalScore = calculateTotalScore(breakdown);
  const scoreOutOf100 = normalizeScore(totalScore);

  return {
    totalScore,
    scoreOutOf100,
    breakdown,
  };
}

// ============================================
// Service Implementation
// ============================================

/**
 * Get legislative impact score for a politician
 * Validates: Requirements 30.1, 30.2, 30.3
 */
export async function getLegislativeImpactScore(
  politicianId: string
): Promise<LegislativeImpactScore> {
  const reviewedBatch = getReleasedProfile(politicianId, null);
  if (reviewedBatch) {
    return unavailableScore(politicianId, "selected_filings_only", reviewedBatch);
  }

  // Get bills authored by the politician
  const billAuthors = await prisma.billAuthor.findMany({
    where: { politicianId },
    include: {
      Bill: {
        select: {
          status: true,
        },
      },
    },
  });

  if (billAuthors.some(({ Bill }) => Bill.status === null)) {
    return unavailableScore(politicianId, "unknown_bill_status");
  }

  // Count bills by status
  const billsPassedIntoLaw = billAuthors.filter(
    (ba) => ba.Bill.status === BillStatus.passed
  ).length;
  const billsPending = billAuthors.filter((ba) => ba.Bill.status === BillStatus.pending).length;
  const totalBillsAuthored = billAuthors.length;

  // Get projects and calculate budget
  const projects = await prisma.project.findMany({
    where: { politicianId },
    select: {
      budget: true,
      ProjectLocation: {
        select: {
          region: true,
        },
      },
    },
  });

  // Calculate total budget in billions
  const totalBudget = projects.reduce((sum, p) => {
    return sum + (p.budget ? Number(p.budget) : 0);
  }, 0);
  const totalBudgetBillions = totalBudget / 1_000_000_000;

  // Estimate population affected based on laws passed
  // Using Philippine population estimate: ~115 million
  // National laws affect entire population, local laws affect regional population
  const estimatedPopulationMillions = estimatePopulationAffected(billsPassedIntoLaw, projects);

  // Calculate the score
  const { totalScore, scoreOutOf100, breakdown } = calculateImpactScore(
    billsPassedIntoLaw,
    billsPending,
    estimatedPopulationMillions,
    totalBudgetBillions
  );

  return {
    politicianId,
    totalScore,
    scoreOutOf100,
    breakdown,
    billsPassedIntoLaw,
    billsPending,
    totalBillsAuthored,
    estimatedPopulationAffected: estimatedPopulationMillions * 1_000_000,
    totalBudgetAllocated: totalBudget,
    lastCalculatedAt: new Date(),
  };
}

function unavailableScore(
  politicianId: string,
  unavailableReason: NonNullable<LegislativeImpactScore["unavailableReason"]>,
  reviewedBatch?: ReleasedProfileContext
): LegislativeImpactScore {
  return {
    politicianId,
    totalScore: null,
    scoreOutOf100: null,
    breakdown: [],
    billsPassedIntoLaw: null,
    billsPending: null,
    totalBillsAuthored: null,
    estimatedPopulationAffected: null,
    totalBudgetAllocated: null,
    lastCalculatedAt: null,
    unavailableReason,
    ...(reviewedBatch && { reviewedBatch }),
  };
}

/**
 * Estimate population affected by laws and projects
 * This is a simplified estimation based on available data
 */
function estimatePopulationAffected(
  lawsCount: number,
  projects: Array<{ ProjectLocation: { region: string } | null }>
): number {
  // Base population affected by national laws (in millions)
  // Each law is estimated to affect a portion of the population
  const lawPopulationImpact = lawsCount * 10; // 10 million per law average

  // Regional population estimates (simplified)
  const regionPopulations: Record<string, number> = {
    NCR: 13.5,
    "Region I": 5.3,
    "Region II": 3.7,
    "Region III": 12.4,
    "Region IV-A": 16.2,
    "Region IV-B": 3.2,
    "Region V": 6.1,
    "Region VI": 7.5,
    "Region VII": 8.0,
    "Region VIII": 4.5,
    "Region IX": 3.9,
    "Region X": 5.0,
    "Region XI": 5.2,
    "Region XII": 4.9,
    "Region XIII": 2.8,
    CAR: 1.8,
    BARMM: 4.4,
  };

  // Calculate project population impact
  const projectRegions = new Set<string>();
  for (const project of projects) {
    if (project.ProjectLocation?.region) {
      projectRegions.add(project.ProjectLocation.region);
    }
  }

  let projectPopulationImpact = 0;
  Array.from(projectRegions).forEach((region) => {
    projectPopulationImpact += regionPopulations[region] || 2.0;
  });

  return Math.min(lawPopulationImpact + projectPopulationImpact, 115); // Cap at PH population
}

/**
 * Get scoring methodology explanation
 * Validates: Requirement 30.6
 */
export function getScoringMethodology(): ScoringMethodology {
  return {
    description:
      "The Legislative Impact Score measures the effectiveness and reach of a legislator's work based on objective metrics. Higher scores indicate greater legislative impact.",
    components: [
      {
        name: COMPONENT_NAMES.LAWS_PASSED,
        weight: SCORE_WEIGHTS.lawWeight,
        maxPoints: SCORE_WEIGHTS.lawWeight * 10,
        explanation:
          "Bills that have been signed into law. This is weighted highest as it represents completed legislative work.",
      },
      {
        name: COMPONENT_NAMES.PENDING_BILLS,
        weight: SCORE_WEIGHTS.pendingWeight,
        maxPoints: SCORE_WEIGHTS.pendingWeight * 10,
        explanation:
          "Bills currently pending in Congress. Weighted lower than passed laws but still contributes to the score.",
      },
      {
        name: COMPONENT_NAMES.POPULATION_AFFECTED,
        weight: SCORE_WEIGHTS.populationWeight,
        maxPoints: SCORE_WEIGHTS.populationWeight * 10,
        explanation:
          "Estimated number of Filipinos affected by the legislator's laws and projects.",
      },
      {
        name: COMPONENT_NAMES.BUDGET_ALLOCATED,
        weight: SCORE_WEIGHTS.budgetWeight,
        maxPoints: SCORE_WEIGHTS.budgetWeight * 10,
        explanation: "Total budget allocated to projects sponsored by the legislator.",
      },
    ],
    formula:
      "(Laws × 10 × lawWeight) + (Pending × pendingWeight) + (Population × populationWeight) + (Budget × budgetWeight)",
    lastUpdated: new Date("2024-01-01"),
  };
}

type RankedLegislativeImpactScore = LegislativeImpactScore & { scoreOutOf100: number };

/**
 * Compare legislative impact scores for multiple politicians
 * Validates: Requirement 30.5
 */
export async function compareLegislativeImpactScores(
  politicianIds: string[]
): Promise<RankedLegislativeImpactScore[]> {
  const scores = await Promise.all(politicianIds.map((id) => getLegislativeImpactScore(id)));

  return scores
    .filter((score): score is RankedLegislativeImpactScore => score.scoreOutOf100 !== null)
    .sort((a, b) => b.scoreOutOf100 - a.scoreOutOf100);
}

/**
 * Get score ranking for a politician among all legislators
 */
export async function getScoreRanking(
  politicianId: string
): Promise<{ rank: number | null; total: number | null; percentile: number | null }> {
  if (getReleasedProfile(politicianId)) {
    return { rank: null, total: null, percentile: null };
  }
  // Get all legislators (politicians with bill authorship)
  const legislators = await prisma.billAuthor.findMany({
    select: { politicianId: true },
    distinct: ["politicianId"],
  });

  const uniquePoliticianIds = Array.from(new Set(legislators.map((l) => l.politicianId)));

  // Calculate scores for all
  const allScores = await Promise.all(
    uniquePoliticianIds.map(async (id) => ({
      id,
      score: (await getLegislativeImpactScore(id)).scoreOutOf100,
    }))
  );

  const ranked = allScores
    .filter((entry): entry is { id: string; score: number } => entry.score !== null)
    .sort((a, b) => b.score - a.score);

  if (allScores.some((entry) => entry.id === politicianId && entry.score === null)) {
    return { rank: null, total: null, percentile: null };
  }

  const rank = ranked.findIndex((s) => s.id === politicianId) + 1;
  const total = ranked.length;
  const percentile = total > 0 ? ((total - rank + 1) / total) * 100 : 0;

  return { rank, total, percentile };
}
