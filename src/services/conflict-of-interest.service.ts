/**
 * Conflict of Interest Detection Service
 *
 * Service for detecting potential conflicts between a politician's
 * business interests and their legislative work.
 * Implements requirements: 29.1, 29.2, 29.3, 29.4, 29.5, 29.6, 29.7
 */

import { BillAuthorRole } from "@prisma/client";
import prisma from "@/lib/prisma";

// ============================================
// Types and Interfaces
// ============================================

/**
 * Business interest from SALN
 */
export interface BusinessInterest {
  id: string;
  description: string;
  value: number;
  industry: string;
  salnYear: number;
}

/**
 * Potential conflict of interest
 * Validates: Requirement 29.3
 */
export interface ConflictOfInterest {
  id: string;
  type: "bill_authorship" | "committee_assignment";
  businessInterest: BusinessInterest;
  relatedEntity: {
    id: string;
    name: string;
    description: string;
  };
  conflictNature: string;
  severity: "low" | "medium" | "high";
  detectedAt: Date;
}

/**
 * Conflict detection result
 * Validates: Requirements 29.1, 29.7
 */
export interface ConflictDetectionResult {
  politicianId: string;
  hasConflicts: boolean;
  conflicts: ConflictOfInterest[];
  businessInterests: BusinessInterest[];
  billsAnalyzed: number;
  committeesAnalyzed: number;
  lastAnalyzedAt: Date;
  disclaimer: string;
}

/**
 * Committee assignment
 */
export interface CommitteeAssignment {
  id: string;
  name: string;
  role: string;
  industry: string;
}

// ============================================
// Industry Classification
// ============================================

/**
 * Industry keywords for classification
 */
export const INDUSTRY_KEYWORDS: Record<string, string[]> = {
  agriculture: ["farm", "agricultural", "crop", "livestock", "fishery", "rice", "coconut", "sugar"],
  banking: ["bank", "financial", "lending", "credit", "loan", "finance"],
  construction: [
    "construction",
    "building",
    "infrastructure",
    "real estate",
    "property",
    "housing",
  ],
  education: ["school", "university", "college", "education", "training", "academy"],
  energy: ["power", "energy", "electricity", "oil", "gas", "fuel", "solar", "renewable"],
  healthcare: ["hospital", "medical", "health", "pharmaceutical", "drug", "clinic", "medicine"],
  manufacturing: ["manufacturing", "factory", "industrial", "production"],
  media: ["media", "broadcast", "television", "radio", "news", "publication", "advertising"],
  mining: ["mining", "mineral", "quarry", "extraction"],
  retail: ["retail", "store", "shop", "mall", "supermarket", "grocery"],
  technology: ["technology", "software", "IT", "computer", "digital", "internet", "telecom"],
  telecommunications: ["telecom", "communication", "mobile", "network", "broadband"],
  transportation: ["transport", "shipping", "logistics", "airline", "bus", "trucking"],
  tourism: ["hotel", "resort", "tourism", "travel", "hospitality"],
};

/**
 * Classify text into industry
 */
export function classifyIndustry(text: string): string {
  const lowerText = text.toLowerCase();

  for (const [industry, keywords] of Object.entries(INDUSTRY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        return industry;
      }
    }
  }

  return "other";
}

/**
 * Check if two industries are related
 */
export function areIndustriesRelated(industry1: string, industry2: string): boolean {
  if (industry1 === industry2) {
    return true;
  }

  // Define related industry pairs
  const relatedPairs: [string, string][] = [
    ["banking", "finance"],
    ["energy", "mining"],
    ["construction", "real estate"],
    ["healthcare", "pharmaceutical"],
    ["technology", "telecommunications"],
  ];

  for (const [a, b] of relatedPairs) {
    if ((industry1 === a && industry2 === b) || (industry1 === b && industry2 === a)) {
      return true;
    }
  }

  return false;
}

// ============================================
// Conflict Detection Functions
// ============================================

/**
 * Extract business interests from SALN investments
 */
export function extractBusinessInterests(
  investments: Array<{
    id: string;
    description: string;
    value: { toNumber: () => number } | number;
    salnRecord: { year: number };
  }>
): BusinessInterest[] {
  return investments.map((inv) => ({
    id: inv.id,
    description: inv.description,
    value: typeof inv.value === "number" ? inv.value : inv.value.toNumber(),
    industry: classifyIndustry(inv.description),
    salnYear: inv.salnRecord.year,
  }));
}

/**
 * Detect conflicts between business interests and bills
 * Validates: Requirements 29.1, 29.2
 */
export function detectBillConflicts(
  businessInterests: BusinessInterest[],
  bills: Array<{
    id: string;
    title: string;
    summary: string | null;
    role: BillAuthorRole;
  }>
): ConflictOfInterest[] {
  const conflicts: ConflictOfInterest[] = [];

  for (const interest of businessInterests) {
    for (const bill of bills) {
      const billIndustry = classifyIndustry(`${bill.title} ${bill.summary || ""}`);

      if (areIndustriesRelated(interest.industry, billIndustry)) {
        conflicts.push({
          id: `conflict-bill-${interest.id}-${bill.id}`,
          type: "bill_authorship",
          businessInterest: interest,
          relatedEntity: {
            id: bill.id,
            name: bill.title,
            description: bill.summary || "No summary available",
          },
          conflictNature: `Authored bill in ${billIndustry} industry while having business interests in ${interest.industry}`,
          severity: determineSeverity(interest.value, bill.role),
          detectedAt: new Date(),
        });
      }
    }
  }

  return conflicts;
}

/**
 * Detect conflicts between business interests and committee assignments
 * Validates: Requirements 29.4, 29.5
 */
export function detectCommitteeConflicts(
  businessInterests: BusinessInterest[],
  committees: CommitteeAssignment[]
): ConflictOfInterest[] {
  const conflicts: ConflictOfInterest[] = [];

  for (const interest of businessInterests) {
    for (const committee of committees) {
      if (areIndustriesRelated(interest.industry, committee.industry)) {
        conflicts.push({
          id: `conflict-committee-${interest.id}-${committee.id}`,
          type: "committee_assignment",
          businessInterest: interest,
          relatedEntity: {
            id: committee.id,
            name: committee.name,
            description: `Role: ${committee.role}`,
          },
          conflictNature: `Sits on ${committee.name} committee while having business interests in ${interest.industry}`,
          severity: determineSeverityForCommittee(interest.value, committee.role),
          detectedAt: new Date(),
        });
      }
    }
  }

  return conflicts;
}

/**
 * Determine severity based on investment value and role
 */
function determineSeverity(
  investmentValue: number,
  role: BillAuthorRole
): "low" | "medium" | "high" {
  // High value investments (> 10M PHP) with principal authorship = high severity
  if (investmentValue > 10_000_000 && role === "principal_author") {
    return "high";
  }
  // Medium value (1M-10M) or co-authorship = medium severity
  if (investmentValue > 1_000_000 || role === "principal_author") {
    return "medium";
  }
  return "low";
}

/**
 * Determine severity for committee conflicts
 */
function determineSeverityForCommittee(
  investmentValue: number,
  role: string
): "low" | "medium" | "high" {
  const isChair = role.toLowerCase().includes("chair") || role.toLowerCase().includes("head");

  if (investmentValue > 10_000_000 && isChair) {
    return "high";
  }
  if (investmentValue > 1_000_000 || isChair) {
    return "medium";
  }
  return "low";
}

// ============================================
// Service Implementation
// ============================================

/**
 * Detect all conflicts of interest for a politician
 * Validates: Requirements 29.1, 29.2, 29.3, 29.4, 29.5, 29.6, 29.7
 */
export async function detectConflictsOfInterest(
  politicianId: string
): Promise<ConflictDetectionResult> {
  // Get SALN investments (business interests)
  const salnRecords = await prisma.sALNRecord.findMany({
    where: { politicianId },
    include: {
      SALNInvestment: true,
    },
    orderBy: { year: "desc" },
    take: 3, // Last 3 years
  });

  // Extract business interests from investments
  const allInvestments = salnRecords.flatMap((record) =>
    record.SALNInvestment.map((inv) => ({
      ...inv,
      salnRecord: { year: record.year },
    }))
  );
  const businessInterests = extractBusinessInterests(allInvestments);

  // Get bills authored by the politician
  const billAuthors = await prisma.billAuthor.findMany({
    where: { politicianId },
    include: {
      Bill: {
        select: {
          id: true,
          title: true,
          summary: true,
        },
      },
    },
  });

  const bills = billAuthors.map((ba) => ({
    id: ba.Bill.id,
    title: ba.Bill.title,
    summary: ba.Bill.summary,
    role: ba.role,
  }));

  // Detect bill conflicts
  const billConflicts = detectBillConflicts(businessInterests, bills);

  // For committee assignments, we would need a Committee model
  // For now, we'll return an empty array for committee conflicts
  const committeeConflicts: ConflictOfInterest[] = [];

  const allConflicts = [...billConflicts, ...committeeConflicts];

  return {
    politicianId,
    hasConflicts: allConflicts.length > 0,
    conflicts: allConflicts,
    businessInterests,
    billsAnalyzed: bills.length,
    committeesAnalyzed: 0, // Would be populated with actual committee data
    lastAnalyzedAt: new Date(),
    disclaimer:
      "This analysis presents potential conflicts objectively based on available data. " +
      "Users should draw their own conclusions. The presence of a potential conflict " +
      "does not imply wrongdoing.",
  };
}

/**
 * Get conflicts for a specific bill
 */
export async function getConflictsForBill(billId: string): Promise<ConflictOfInterest[]> {
  // Get all authors of the bill
  const billAuthors = await prisma.billAuthor.findMany({
    where: { billId },
    include: {
      Bill: {
        select: {
          id: true,
          title: true,
          summary: true,
        },
      },
    },
  });

  const allConflicts: ConflictOfInterest[] = [];

  for (const author of billAuthors) {
    // Get business interests for each author
    const salnRecords = await prisma.sALNRecord.findMany({
      where: { politicianId: author.politicianId },
      include: { SALNInvestment: true },
      orderBy: { year: "desc" },
      take: 1,
    });

    const investments = salnRecords.flatMap((record) =>
      record.SALNInvestment.map((inv) => ({
        ...inv,
        salnRecord: { year: record.year },
      }))
    );
    const businessInterests = extractBusinessInterests(investments);

    const conflicts = detectBillConflicts(businessInterests, [
      {
        id: author.Bill.id,
        title: author.Bill.title,
        summary: author.Bill.summary,
        role: author.role,
      },
    ]);

    allConflicts.push(...conflicts);
  }

  return allConflicts;
}

/**
 * Check if a politician has any conflicts
 */
export async function hasConflicts(politicianId: string): Promise<boolean> {
  const result = await detectConflictsOfInterest(politicianId);
  return result.hasConflicts;
}

/**
 * Get conflict summary for a politician
 */
export async function getConflictSummary(politicianId: string): Promise<{
  totalConflicts: number;
  billConflicts: number;
  committeeConflicts: number;
  highSeverity: number;
  mediumSeverity: number;
  lowSeverity: number;
}> {
  const result = await detectConflictsOfInterest(politicianId);

  return {
    totalConflicts: result.conflicts.length,
    billConflicts: result.conflicts.filter((c) => c.type === "bill_authorship").length,
    committeeConflicts: result.conflicts.filter((c) => c.type === "committee_assignment").length,
    highSeverity: result.conflicts.filter((c) => c.severity === "high").length,
    mediumSeverity: result.conflicts.filter((c) => c.severity === "medium").length,
    lowSeverity: result.conflicts.filter((c) => c.severity === "low").length,
  };
}

/**
 * Generate conflict report for display
 * Validates: Requirement 29.6
 */
export function generateConflictReport(result: ConflictDetectionResult): string {
  if (!result.hasConflicts) {
    return "No potential conflicts of interest were found based on available data.";
  }

  const lines: string[] = [
    `Found ${result.conflicts.length} potential conflict(s) of interest:`,
    "",
  ];

  for (const conflict of result.conflicts) {
    lines.push(`• ${conflict.conflictNature}`);
    lines.push(`  Business Interest: ${conflict.businessInterest.description}`);
    lines.push(`  Related: ${conflict.relatedEntity.name}`);
    lines.push(`  Severity: ${conflict.severity}`);
    lines.push("");
  }

  lines.push(result.disclaimer);

  return lines.join("\n");
}
