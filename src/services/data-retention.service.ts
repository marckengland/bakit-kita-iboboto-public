/**
 * Data Retention Service
 *
 * Enforces data retention policies for politician data.
 * Politician data is permanent - deletion requests are rejected.
 * Modifications require AI verification before application.
 * Only data verified as false can be removed.
 *
 * **Validates: Requirements 38.2, 38.3, 38.4, 38.8, 38.9, 38.10, 38.11, 38.12**
 */

import { logDeleteAttempt, logAdminAction, createAuditEntry } from "./blockchain-audit.service";
import { verifySubmission, DataSubmission } from "./ai-verifier.service";

// ============================================
// Types and Interfaces
// ============================================

export type DataCategory = "politician" | "bill" | "controversy" | "saln" | "project" | "election";

export interface DeletionRequest {
  id: string;
  requestedBy: string;
  requestedAt: Date;
  dataCategory: DataCategory;
  dataId: string;
  reason: string;
  evidence?: string[];
}

export interface DeletionResult {
  requestId: string;
  status: "rejected" | "pending_verification" | "approved";
  reason: string;
  loggedToBlockchain: boolean;
}

export interface ModificationRequest {
  id: string;
  requestedBy: string;
  requestedAt: Date;
  dataCategory: DataCategory;
  dataId: string;
  currentData: Record<string, unknown>;
  proposedData: Record<string, unknown>;
  reason: string;
  evidence?: string[];
}

export interface ModificationResult {
  requestId: string;
  status: "rejected" | "pending_verification" | "approved" | "applied";
  verificationConfidence?: number;
  reason: string;
  loggedToBlockchain: boolean;
}

export interface FalseDataRemovalRequest {
  id: string;
  requestedBy: string;
  requestedAt: Date;
  dataCategory: DataCategory;
  dataId: string;
  fieldToRemove: string;
  reason: string;
  evidence: string[];
  verificationResult?: {
    isVerifiedFalse: boolean;
    confidence: number;
    sources: string[];
  };
}

export interface FalseDataRemovalResult {
  requestId: string;
  status: "rejected" | "pending_verification" | "approved" | "removed";
  reason: string;
  loggedToBlockchain: boolean;
}

// ============================================
// Constants
// ============================================

export const PERMANENT_DATA_CATEGORIES: DataCategory[] = [
  "politician",
  "bill",
  "controversy",
  "saln",
  "project",
  "election",
];

export const VERIFICATION_THRESHOLD_FOR_REMOVAL = 0.85;
export const VERIFICATION_THRESHOLD_FOR_MODIFICATION = 0.7;

// ============================================
// Error Classes
// ============================================

export class DataRetentionError extends Error {
  constructor(
    message: string,
    public code:
      | "DELETION_REJECTED"
      | "MODIFICATION_REJECTED"
      | "VERIFICATION_REQUIRED"
      | "INSUFFICIENT_EVIDENCE"
  ) {
    super(message);
    this.name = "DataRetentionError";
  }
}

// ============================================
// In-Memory Storage (for development)
// ============================================

let deletionRequests: DeletionRequest[] = [];
let modificationRequests: ModificationRequest[] = [];
let falseDataRemovalRequests: FalseDataRemovalRequest[] = [];

// ============================================
// Helper Functions
// ============================================

/**
 * Generate a unique request ID
 */
export function generateRequestId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Check if a data category is permanent
 */
export function isPermanentData(category: DataCategory): boolean {
  return PERMANENT_DATA_CATEGORIES.includes(category);
}

/**
 * Validate deletion request
 */
export function validateDeletionRequest(request: DeletionRequest): boolean {
  return (
    !!request.id &&
    !!request.requestedBy &&
    !!request.dataCategory &&
    !!request.dataId &&
    !!request.reason
  );
}

/**
 * Validate modification request
 */
export function validateModificationRequest(request: ModificationRequest): boolean {
  return (
    !!request.id &&
    !!request.requestedBy &&
    !!request.dataCategory &&
    !!request.dataId &&
    !!request.currentData &&
    !!request.proposedData &&
    !!request.reason
  );
}

/**
 * Validate false data removal request
 */
export function validateFalseDataRemovalRequest(request: FalseDataRemovalRequest): boolean {
  return (
    !!request.id &&
    !!request.requestedBy &&
    !!request.dataCategory &&
    !!request.dataId &&
    !!request.fieldToRemove &&
    !!request.reason &&
    Array.isArray(request.evidence) &&
    request.evidence.length > 0
  );
}

// ============================================
// Core Functions
// ============================================

/**
 * Process a deletion request
 * Politician data deletion is always rejected
 */
export function processDeletionRequest(request: DeletionRequest): DeletionResult {
  if (!validateDeletionRequest(request)) {
    throw new DataRetentionError("Invalid deletion request", "DELETION_REJECTED");
  }

  // Store the request
  deletionRequests.push(request);

  // Map DataCategory to DataType for audit logging
  const dataTypeMap: Record<DataCategory, string> = {
    politician: "politician",
    bill: "bill",
    controversy: "controversy",
    saln: "saln",
    project: "project",
    election: "politician", // Map election to politician for audit purposes
  };

  // Log the rejection to blockchain
  logDeleteAttempt(
    request.requestedBy,
    "user",
    dataTypeMap[request.dataCategory] as
      | "politician"
      | "bill"
      | "controversy"
      | "saln"
      | "project"
      | "user"
      | "admin"
      | "submission"
      | "system",
    request.dataId,
    `Deletion rejected: ${request.reason}`
  );

  // All politician data deletions are rejected
  if (isPermanentData(request.dataCategory)) {
    return {
      requestId: request.id,
      status: "rejected",
      reason: `${request.dataCategory} data is permanent and cannot be deleted. This rejection has been logged to the blockchain.`,
      loggedToBlockchain: true,
    };
  }

  // For non-permanent data (if any), still reject but with different message
  return {
    requestId: request.id,
    status: "rejected",
    reason: "Data deletion is not permitted. This rejection has been logged to the blockchain.",
    loggedToBlockchain: true,
  };
}

/**
 * Process a modification request
 * Requires AI verification before application
 */
export async function processModificationRequest(
  request: ModificationRequest
): Promise<ModificationResult> {
  if (!validateModificationRequest(request)) {
    throw new DataRetentionError("Invalid modification request", "MODIFICATION_REJECTED");
  }

  // Store the request
  modificationRequests.push(request);

  // Create submission for AI verification
  const submission: DataSubmission = {
    id: request.id,
    type: request.dataCategory as DataSubmission["type"],
    data: request.proposedData,
    submittedBy: request.requestedBy,
    submittedAt: request.requestedAt,
  };

  // Verify with AI
  const verificationResult = await verifySubmission(submission);

  // Map DataCategory to DataType for audit logging
  const dataTypeForAudit =
    request.dataCategory === "election" ? "politician" : request.dataCategory;

  // Log the modification attempt
  createAuditEntry(
    request.requestedBy,
    "user",
    "update",
    dataTypeForAudit as
      | "politician"
      | "bill"
      | "controversy"
      | "saln"
      | "project"
      | "user"
      | "admin"
      | "submission"
      | "system",
    request.dataId,
    request.currentData,
    request.proposedData,
    {
      verificationConfidence: verificationResult.confidence,
      verificationStatus: verificationResult.status,
      reason: request.reason,
    }
  );

  // Check verification result
  if (verificationResult.confidence < VERIFICATION_THRESHOLD_FOR_MODIFICATION) {
    return {
      requestId: request.id,
      status: "pending_verification",
      verificationConfidence: verificationResult.confidence,
      reason: "Modification requires manual review due to low AI verification confidence.",
      loggedToBlockchain: true,
    };
  }

  if (verificationResult.status === "rejected") {
    return {
      requestId: request.id,
      status: "rejected",
      verificationConfidence: verificationResult.confidence,
      reason: `Modification rejected: ${verificationResult.reasoning}`,
      loggedToBlockchain: true,
    };
  }

  // Approved for application
  return {
    requestId: request.id,
    status: "approved",
    verificationConfidence: verificationResult.confidence,
    reason: "Modification verified and approved for application.",
    loggedToBlockchain: true,
  };
}

/**
 * Process a false data removal request
 * Only data verified as false can be removed
 */
export async function processFalseDataRemovalRequest(
  request: FalseDataRemovalRequest
): Promise<FalseDataRemovalResult> {
  if (!validateFalseDataRemovalRequest(request)) {
    throw new DataRetentionError(
      "Invalid false data removal request - evidence is required",
      "INSUFFICIENT_EVIDENCE"
    );
  }

  // Store the request
  falseDataRemovalRequests.push(request);

  // Create submission for AI verification
  const submission: DataSubmission = {
    id: request.id,
    type: request.dataCategory as DataSubmission["type"],
    data: {
      fieldToRemove: request.fieldToRemove,
      reason: request.reason,
      evidence: request.evidence,
    },
    submittedBy: request.requestedBy,
    submittedAt: request.requestedAt,
  };

  // Verify with AI
  const verificationResult = await verifySubmission(submission);

  // Map DataCategory to DataType for audit logging
  const dataTypeForRemoval =
    request.dataCategory === "election" ? "politician" : request.dataCategory;

  // Log the removal attempt
  logAdminAction(
    request.requestedBy,
    "false_data_removal_request",
    dataTypeForRemoval as
      | "politician"
      | "bill"
      | "controversy"
      | "saln"
      | "project"
      | "user"
      | "admin"
      | "submission"
      | "system",
    request.dataId,
    {
      fieldToRemove: request.fieldToRemove,
      reason: request.reason,
      evidence: request.evidence,
      verificationConfidence: verificationResult.confidence,
      verificationStatus: verificationResult.status,
    }
  );

  // Check if verification confirms data is false
  if (verificationResult.confidence < VERIFICATION_THRESHOLD_FOR_REMOVAL) {
    return {
      requestId: request.id,
      status: "pending_verification",
      reason: "Removal requires manual review - AI verification confidence is below threshold.",
      loggedToBlockchain: true,
    };
  }

  // For false data removal, we need high confidence that the data IS false
  // This is a mock - in production, AI would specifically verify if data is false
  const isVerifiedFalse =
    verificationResult.status === "verified" &&
    verificationResult.confidence >= VERIFICATION_THRESHOLD_FOR_REMOVAL;

  if (!isVerifiedFalse) {
    return {
      requestId: request.id,
      status: "rejected",
      reason: "Data could not be verified as false. Removal rejected.",
      loggedToBlockchain: true,
    };
  }

  return {
    requestId: request.id,
    status: "approved",
    reason: "Data verified as false. Approved for removal.",
    loggedToBlockchain: true,
  };
}

// ============================================
// Query Functions
// ============================================

/**
 * Get all deletion requests
 */
export function getDeletionRequests(): DeletionRequest[] {
  return [...deletionRequests];
}

/**
 * Get deletion requests by data ID
 */
export function getDeletionRequestsByDataId(dataId: string): DeletionRequest[] {
  return deletionRequests.filter((r) => r.dataId === dataId);
}

/**
 * Get all modification requests
 */
export function getModificationRequests(): ModificationRequest[] {
  return [...modificationRequests];
}

/**
 * Get modification requests by data ID
 */
export function getModificationRequestsByDataId(dataId: string): ModificationRequest[] {
  return modificationRequests.filter((r) => r.dataId === dataId);
}

/**
 * Get all false data removal requests
 */
export function getFalseDataRemovalRequests(): FalseDataRemovalRequest[] {
  return [...falseDataRemovalRequests];
}

/**
 * Get false data removal requests by data ID
 */
export function getFalseDataRemovalRequestsByDataId(dataId: string): FalseDataRemovalRequest[] {
  return falseDataRemovalRequests.filter((r) => r.dataId === dataId);
}

// ============================================
// Utility Functions
// ============================================

/**
 * Clear all requests (for testing only)
 */
export function clearAllRequests(): void {
  deletionRequests = [];
  modificationRequests = [];
  falseDataRemovalRequests = [];
}

/**
 * Get request counts
 */
export function getRequestCounts(): {
  deletions: number;
  modifications: number;
  falseDataRemovals: number;
} {
  return {
    deletions: deletionRequests.length,
    modifications: modificationRequests.length,
    falseDataRemovals: falseDataRemovalRequests.length,
  };
}
