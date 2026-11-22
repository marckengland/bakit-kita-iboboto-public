/**
 * AI Verifier Service
 *
 * Handles AI-powered verification of data submissions.
 * Supports Claude Opus 4.5 (Anthropic) and Gemini Pro 2.5 (Google).
 * Admin can switch between models via AI Config service.
 *
 * **Validates: Requirements 35.1, 35.2, 35.3, 35.4, 35.5, 35.6, 35.7, 35.8, 35.9, 35.10**
 */

import { getVerifierModelConfig } from "./ai-config.service";

// ============================================
// Types and Interfaces
// ============================================

export type VerificationStatus = "verified" | "unverified" | "rejected" | "pending_review";

export interface DataSubmission {
  id: string;
  type: "politician" | "bill" | "controversy" | "saln" | "project";
  data: Record<string, unknown>;
  submittedBy: string;
  submittedAt: Date;
}

export interface VerificationResult {
  submissionId: string;
  status: VerificationStatus;
  confidence: number;
  reasoning: string;
  sources: VerificationSource[];
  isDuplicate: boolean;
  duplicateOf?: string;
  requiresManualReview: boolean;
}

export interface VerificationSource {
  name: string;
  url?: string;
  matchScore: number;
  matchedFields: string[];
}

export interface ManualReviewItem {
  submissionId: string;
  submission: DataSubmission;
  verificationResult: VerificationResult;
  priority: "low" | "medium" | "high";
  assignedTo?: string;
  createdAt: Date;
}

// ============================================
// Constants
// ============================================

export const CONFIDENCE_THRESHOLD = 0.7;
export const AUTO_PUBLISH_THRESHOLD = 0.9;
export const DUPLICATE_THRESHOLD = 0.85;

// Official sources for cross-referencing
export const OFFICIAL_SOURCES = [
  { name: "COMELEC", url: "https://comelec.gov.ph", types: ["politician", "election"] },
  {
    name: "Senate of the Philippines",
    url: "https://senate.gov.ph",
    types: ["bill", "politician"],
  },
  {
    name: "House of Representatives",
    url: "https://congress.gov.ph",
    types: ["bill", "politician"],
  },
  { name: "Supreme Court", url: "https://sc.judiciary.gov.ph", types: ["controversy"] },
  { name: "Commission on Audit", url: "https://coa.gov.ph", types: ["project", "saln"] },
  { name: "Department of Budget and Management", url: "https://dbm.gov.ph", types: ["project"] },
];

// ============================================
// Error Classes
// ============================================

export class VerificationError extends Error {
  constructor(
    message: string,
    public code:
      | "SUBMISSION_NOT_FOUND"
      | "INVALID_SUBMISSION"
      | "VERIFICATION_FAILED"
      | "DUPLICATE_DETECTED"
  ) {
    super(message);
    this.name = "VerificationError";
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Validate submission data structure
 */
export function validateSubmission(submission: DataSubmission): boolean {
  if (!submission.id || !submission.type || !submission.data) {
    return false;
  }

  const validTypes = ["politician", "bill", "controversy", "saln", "project"];
  if (!validTypes.includes(submission.type)) {
    return false;
  }

  return Object.keys(submission.data).length > 0;
}

/**
 * Calculate similarity between two strings
 */
export function calculateStringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) {
    return 1.0;
  }
  if (s1.length === 0 || s2.length === 0) {
    return 0;
  }

  // Simple Jaccard similarity on words
  const words1 = new Set(s1.split(/\s+/));
  const words2 = new Set(s2.split(/\s+/));

  const intersection = new Set(Array.from(words1).filter((x) => words2.has(x)));
  const union = new Set([...Array.from(words1), ...Array.from(words2)]);

  return intersection.size / union.size;
}

/**
 * Calculate overall similarity between two data objects
 */
export function calculateDataSimilarity(
  data1: Record<string, unknown>,
  data2: Record<string, unknown>
): number {
  const keys1 = Object.keys(data1);
  const keys2 = Object.keys(data2);
  const commonKeys = keys1.filter((k) => keys2.includes(k));

  if (commonKeys.length === 0) {
    return 0;
  }

  let totalSimilarity = 0;
  for (const key of commonKeys) {
    const val1 = String(data1[key] || "");
    const val2 = String(data2[key] || "");
    totalSimilarity += calculateStringSimilarity(val1, val2);
  }

  return totalSimilarity / commonKeys.length;
}

/**
 * Get relevant official sources for a submission type
 */
export function getRelevantSources(type: string): typeof OFFICIAL_SOURCES {
  return OFFICIAL_SOURCES.filter((source) => source.types.includes(type));
}

/**
 * Determine if submission requires manual review
 */
export function requiresManualReview(confidence: number, isDuplicate: boolean): boolean {
  if (isDuplicate) {
    return true;
  }
  if (confidence < CONFIDENCE_THRESHOLD) {
    return true;
  }
  if (confidence < AUTO_PUBLISH_THRESHOLD) {
    return true;
  }
  return false;
}

/**
 * Calculate review priority
 */
export function calculatePriority(confidence: number, type: string): "low" | "medium" | "high" {
  // Controversies always high priority
  if (type === "controversy") {
    return "high";
  }

  if (confidence < 0.3) {
    return "high";
  }
  if (confidence < 0.5) {
    return "medium";
  }
  return "low";
}

// ============================================
// Mock AI Verification Functions
// ============================================

/**
 * Mock cross-reference against official sources
 * In production, this would call actual APIs or scrape official websites
 */
export async function crossReferenceWithSources(
  submission: DataSubmission
): Promise<VerificationSource[]> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 50));

  const relevantSources = getRelevantSources(submission.type);
  const sources: VerificationSource[] = [];

  for (const source of relevantSources) {
    // Mock matching - in production, this would actually query the source
    const matchScore = Math.random() * 0.5 + 0.5; // 0.5 to 1.0
    const matchedFields = Object.keys(submission.data).slice(0, 3);

    sources.push({
      name: source.name,
      url: source.url,
      matchScore,
      matchedFields,
    });
  }

  return sources;
}

/**
 * Mock duplicate detection
 * In production, this would query the database for similar entries
 */
export async function detectDuplicate(
  submission: DataSubmission
): Promise<{ isDuplicate: boolean; duplicateOf?: string; similarity: number }> {
  // Simulate processing delay
  await new Promise((resolve) => setTimeout(resolve, 30));

  // Mock duplicate detection - in production, this would query the database
  // For now, we'll simulate based on submission data
  const mockExistingData = {
    fullName: "Juan Dela Cruz",
    position: "Senator",
  };

  const similarity = calculateDataSimilarity(submission.data, mockExistingData);

  if (similarity >= DUPLICATE_THRESHOLD) {
    return {
      isDuplicate: true,
      duplicateOf: "existing-entry-123",
      similarity,
    };
  }

  return { isDuplicate: false, similarity };
}

/**
 * Mock AI analysis of submission
 * In production, this would use the configured AI provider (Claude or Gemini)
 *
 * Supported Models:
 * - Claude Opus 4.5 (Anthropic): claude-opus-4-5-20250514
 * - Gemini 3.1 Pro (Google): gemini-3.1-flash-lite
 *
 * Admin can switch models via AI Config service.
 */
export async function analyzeSubmission(
  _submission: DataSubmission,
  sources: VerificationSource[]
): Promise<{ confidence: number; reasoning: string }> {
  // Get current model configuration
  const modelConfig = getVerifierModelConfig();

  // Simulate AI processing delay
  await new Promise((resolve) => setTimeout(resolve, 50));

  // System prompt for verification (used in production API calls)
  void `You are a data verification specialist for Philippine government data.
Analyze submissions against official sources and determine their accuracy.
Be strict with controversies - only accept official government or court sources.
Current model: ${modelConfig.displayName}`;

  // In production, this would make actual API call:
  // const request = formatProviderRequest(modelConfig.provider, JSON.stringify(submission), systemPrompt, { temperature: 0.3 });
  // const response = await fetch(getAPIEndpoint(modelConfig.provider), { ... });
  // const analysis = parseProviderResponse(modelConfig.provider, await response.json());

  // Calculate confidence based on source matches
  if (sources.length === 0) {
    return {
      confidence: 0.3,
      reasoning: `No official sources found to verify this submission. (Analyzed by ${modelConfig.displayName})`,
    };
  }

  const avgMatchScore = sources.reduce((sum, s) => sum + s.matchScore, 0) / sources.length;

  let reasoning: string;
  if (avgMatchScore >= 0.9) {
    reasoning = `High confidence match with official government sources. (Verified by ${modelConfig.displayName})`;
  } else if (avgMatchScore >= 0.7) {
    reasoning = `Moderate confidence match. Some fields verified against official sources. (Analyzed by ${modelConfig.displayName})`;
  } else if (avgMatchScore >= 0.5) {
    reasoning = `Low confidence match. Limited verification possible. (Analyzed by ${modelConfig.displayName})`;
  } else {
    reasoning = `Unable to verify against official sources. Manual review required. (Analyzed by ${modelConfig.displayName})`;
  }

  return {
    confidence: avgMatchScore,
    reasoning,
  };
}

// ============================================
// Core Verification Functions
// ============================================

/**
 * Verify a data submission
 */
export async function verifySubmission(submission: DataSubmission): Promise<VerificationResult> {
  // Validate submission
  if (!validateSubmission(submission)) {
    throw new VerificationError("Invalid submission data", "INVALID_SUBMISSION");
  }

  // Check for duplicates
  const duplicateCheck = await detectDuplicate(submission);

  // Cross-reference with official sources
  const sources = await crossReferenceWithSources(submission);

  // Analyze with AI
  const analysis = await analyzeSubmission(submission, sources);

  // Determine status
  let status: VerificationStatus;
  if (duplicateCheck.isDuplicate) {
    status = "pending_review";
  } else if (analysis.confidence >= AUTO_PUBLISH_THRESHOLD) {
    status = "verified";
  } else if (analysis.confidence >= CONFIDENCE_THRESHOLD) {
    status = "pending_review";
  } else if (analysis.confidence < 0.3) {
    status = "rejected";
  } else {
    status = "unverified";
  }

  const needsReview = requiresManualReview(analysis.confidence, duplicateCheck.isDuplicate);

  return {
    submissionId: submission.id,
    status,
    confidence: analysis.confidence,
    reasoning: analysis.reasoning,
    sources,
    isDuplicate: duplicateCheck.isDuplicate,
    duplicateOf: duplicateCheck.duplicateOf,
    requiresManualReview: needsReview,
  };
}

/**
 * Queue submission for manual review
 */
export async function queueForManualReview(
  submission: DataSubmission,
  verificationResult: VerificationResult
): Promise<ManualReviewItem> {
  const priority = calculatePriority(verificationResult.confidence, submission.type);

  const reviewItem: ManualReviewItem = {
    submissionId: submission.id,
    submission,
    verificationResult,
    priority,
    createdAt: new Date(),
  };

  // In production, this would save to database
  // await prisma.manualReviewQueue.create({ data: reviewItem });

  return reviewItem;
}

/**
 * Process verification result and determine next action
 */
export async function processVerificationResult(
  submission: DataSubmission,
  result: VerificationResult
): Promise<{
  action: "publish" | "queue_review" | "reject";
  result: VerificationResult;
  reviewItem?: ManualReviewItem;
}> {
  if (result.status === "verified" && !result.requiresManualReview) {
    return { action: "publish", result };
  }

  if (result.status === "rejected") {
    return { action: "reject", result };
  }

  // Queue for manual review
  const reviewItem = await queueForManualReview(submission, result);
  return { action: "queue_review", result, reviewItem };
}

/**
 * Get verification status for a submission
 */
export function getVerificationStatus(result: VerificationResult): {
  canPublish: boolean;
  needsReview: boolean;
  isRejected: boolean;
  confidence: number;
} {
  return {
    canPublish: result.status === "verified" && !result.requiresManualReview,
    needsReview: result.requiresManualReview,
    isRejected: result.status === "rejected",
    confidence: result.confidence,
  };
}
