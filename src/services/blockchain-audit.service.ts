/**
 * Blockchain Audit Service
 *
 * Implements an append-only audit log with cryptographic hash chaining.
 * Provides tamper-evident logging for all data modifications.
 * Supports periodic anchoring to public blockchain (Polygon).
 *
 * **Validates: Requirements 36.1, 36.2, 36.3, 36.4, 36.5, 36.6, 36.7, 36.8, 36.9, 36.10**
 */

import { createHash } from "crypto";

// ============================================
// Types and Interfaces
// ============================================

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "verify"
  | "reject"
  | "approve"
  | "login"
  | "logout"
  | "admin_action";

export type DataType =
  | "politician"
  | "bill"
  | "controversy"
  | "saln"
  | "project"
  | "user"
  | "admin"
  | "submission"
  | "system";

export interface AuditEntry {
  id: string;
  timestamp: Date;
  actor: string;
  actorType: "user" | "admin" | "system";
  action: AuditAction;
  dataType: DataType;
  dataId: string;
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  previousHash: string;
  hash: string;
}

export interface AuditLogState {
  entries: AuditEntry[];
  lastHash: string;
  chainValid: boolean;
}

export interface BlockchainAnchor {
  id: string;
  timestamp: Date;
  entryCount: number;
  firstEntryId: string;
  lastEntryId: string;
  merkleRoot: string;
  transactionHash?: string;
  blockNumber?: number;
  network: string;
}

export interface ChainVerificationResult {
  isValid: boolean;
  invalidEntryIndex?: number;
  expectedHash?: string;
  actualHash?: string;
  message: string;
}

// ============================================
// Constants
// ============================================

export const GENESIS_HASH = "0".repeat(64);
export const HASH_ALGORITHM = "sha256";
export const ANCHOR_INTERVAL_HOURS = 24;
export const MIN_ENTRIES_FOR_ANCHOR = 100;

// ============================================
// Error Classes
// ============================================

export class AuditError extends Error {
  constructor(
    message: string,
    public code:
      | "CHAIN_CORRUPTED"
      | "MODIFICATION_REJECTED"
      | "DELETION_REJECTED"
      | "INVALID_ENTRY"
      | "ANCHOR_FAILED"
  ) {
    super(message);
    this.name = "AuditError";
  }
}

// ============================================
// In-Memory Audit Log (for development)
// In production, this would be stored in a database
// ============================================

let auditLog: AuditEntry[] = [];
let anchors: BlockchainAnchor[] = [];

// ============================================
// Hash Functions
// ============================================

/**
 * Compute SHA-256 hash of data
 */
export function computeHash(data: string): string {
  return createHash(HASH_ALGORITHM).update(data).digest("hex");
}

/**
 * Compute hash for an audit entry
 */
export function computeEntryHash(entry: Omit<AuditEntry, "hash">): string {
  const dataToHash = JSON.stringify({
    id: entry.id,
    timestamp: entry.timestamp.toISOString(),
    actor: entry.actor,
    actorType: entry.actorType,
    action: entry.action,
    dataType: entry.dataType,
    dataId: entry.dataId,
    previousValue: entry.previousValue,
    newValue: entry.newValue,
    metadata: entry.metadata,
    previousHash: entry.previousHash,
  });
  return computeHash(dataToHash);
}

/**
 * Compute Merkle root for a set of entries
 */
export function computeMerkleRoot(entries: AuditEntry[]): string {
  if (entries.length === 0) {
    return GENESIS_HASH;
  }
  if (entries.length === 1) {
    const firstEntry = entries[0];
    return firstEntry ? firstEntry.hash : GENESIS_HASH;
  }

  const hashes = entries.map((e) => e.hash);

  while (hashes.length > 1) {
    const newHashes: string[] = [];
    for (let i = 0; i < hashes.length; i += 2) {
      const left = hashes[i] ?? "";
      const right = hashes[i + 1] ?? left;
      newHashes.push(computeHash(left + right));
    }
    hashes.length = 0;
    hashes.push(...newHashes);
  }

  return hashes[0] ?? GENESIS_HASH;
}

// ============================================
// Core Audit Functions
// ============================================

/**
 * Get the last hash in the chain
 */
export function getLastHash(): string {
  if (auditLog.length === 0) {
    return GENESIS_HASH;
  }
  const lastEntry = auditLog[auditLog.length - 1];
  return lastEntry ? lastEntry.hash : GENESIS_HASH;
}

/**
 * Generate a unique entry ID
 */
export function generateEntryId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `audit-${timestamp}-${random}`;
}

/**
 * Create a new audit entry
 */
export function createAuditEntry(
  actor: string,
  actorType: "user" | "admin" | "system",
  action: AuditAction,
  dataType: DataType,
  dataId: string,
  previousValue: Record<string, unknown> | null,
  newValue: Record<string, unknown> | null,
  metadata?: Record<string, unknown>
): AuditEntry {
  const previousHash = getLastHash();
  const id = generateEntryId();
  const timestamp = new Date();

  const entryWithoutHash: Omit<AuditEntry, "hash"> = {
    id,
    timestamp,
    actor,
    actorType,
    action,
    dataType,
    dataId,
    previousValue,
    newValue,
    metadata,
    previousHash,
  };

  const hash = computeEntryHash(entryWithoutHash);

  const entry: AuditEntry = {
    ...entryWithoutHash,
    hash,
  };

  auditLog.push(entry);
  return entry;
}

/**
 * Log a data creation
 */
export function logCreate(
  actor: string,
  actorType: "user" | "admin" | "system",
  dataType: DataType,
  dataId: string,
  newValue: Record<string, unknown>,
  metadata?: Record<string, unknown>
): AuditEntry {
  return createAuditEntry(actor, actorType, "create", dataType, dataId, null, newValue, metadata);
}

/**
 * Log a data update
 */
export function logUpdate(
  actor: string,
  actorType: "user" | "admin" | "system",
  dataType: DataType,
  dataId: string,
  previousValue: Record<string, unknown>,
  newValue: Record<string, unknown>,
  metadata?: Record<string, unknown>
): AuditEntry {
  return createAuditEntry(
    actor,
    actorType,
    "update",
    dataType,
    dataId,
    previousValue,
    newValue,
    metadata
  );
}

/**
 * Log a deletion attempt (always rejected for politician data)
 */
export function logDeleteAttempt(
  actor: string,
  actorType: "user" | "admin" | "system",
  dataType: DataType,
  dataId: string,
  reason: string
): AuditEntry {
  return createAuditEntry(actor, actorType, "delete", dataType, dataId, null, null, {
    rejected: true,
    reason,
  });
}

/**
 * Log an admin action
 */
export function logAdminAction(
  adminId: string,
  action: string,
  targetType: DataType,
  targetId: string,
  details: Record<string, unknown>
): AuditEntry {
  return createAuditEntry(adminId, "admin", "admin_action", targetType, targetId, null, details, {
    adminAction: action,
  });
}

// ============================================
// Chain Verification
// ============================================

/**
 * Verify the integrity of the entire audit chain
 */
export function verifyChainIntegrity(): ChainVerificationResult {
  if (auditLog.length === 0) {
    return { isValid: true, message: "Empty chain is valid" };
  }

  const firstEntry = auditLog[0];
  if (!firstEntry) {
    return { isValid: true, message: "Empty chain is valid" };
  }

  // Verify first entry links to genesis
  if (firstEntry.previousHash !== GENESIS_HASH) {
    return {
      isValid: false,
      invalidEntryIndex: 0,
      expectedHash: GENESIS_HASH,
      actualHash: firstEntry.previousHash,
      message: "First entry does not link to genesis hash",
    };
  }

  // Verify each entry's hash and chain linkage
  for (let i = 0; i < auditLog.length; i++) {
    const entry = auditLog[i];
    if (!entry) {
      continue;
    }

    // Recompute hash
    const expectedHash = computeEntryHash({
      id: entry.id,
      timestamp: entry.timestamp,
      actor: entry.actor,
      actorType: entry.actorType,
      action: entry.action,
      dataType: entry.dataType,
      dataId: entry.dataId,
      previousValue: entry.previousValue,
      newValue: entry.newValue,
      metadata: entry.metadata,
      previousHash: entry.previousHash,
    });

    if (entry.hash !== expectedHash) {
      return {
        isValid: false,
        invalidEntryIndex: i,
        expectedHash,
        actualHash: entry.hash,
        message: `Entry ${i} hash mismatch - data may have been tampered`,
      };
    }

    // Verify chain linkage (except for first entry)
    const previousEntry = auditLog[i - 1];
    if (i > 0 && previousEntry && entry.previousHash !== previousEntry.hash) {
      return {
        isValid: false,
        invalidEntryIndex: i,
        expectedHash: previousEntry.hash,
        actualHash: entry.previousHash,
        message: `Entry ${i} chain linkage broken`,
      };
    }
  }

  return { isValid: true, message: "Chain integrity verified" };
}

/**
 * Verify a specific entry's hash
 */
export function verifyEntryHash(entry: AuditEntry): boolean {
  const expectedHash = computeEntryHash({
    id: entry.id,
    timestamp: entry.timestamp,
    actor: entry.actor,
    actorType: entry.actorType,
    action: entry.action,
    dataType: entry.dataType,
    dataId: entry.dataId,
    previousValue: entry.previousValue,
    newValue: entry.newValue,
    metadata: entry.metadata,
    previousHash: entry.previousHash,
  });
  return entry.hash === expectedHash;
}

// ============================================
// Modification Prevention
// ============================================

/**
 * Attempt to modify an audit entry (always rejected)
 */
export function attemptModifyEntry(
  entryId: string,
  actor: string,
  newData: Partial<AuditEntry>
): never {
  // Log the attempt
  createAuditEntry(
    actor,
    "admin",
    "admin_action",
    "system",
    entryId,
    null,
    { attemptedModification: newData },
    { rejected: true, reason: "Audit entries are immutable" }
  );

  throw new AuditError("Audit entries cannot be modified", "MODIFICATION_REJECTED");
}

/**
 * Attempt to delete an audit entry (always rejected)
 */
export function attemptDeleteEntry(entryId: string, actor: string): never {
  // Log the attempt
  createAuditEntry(actor, "admin", "admin_action", "system", entryId, null, null, {
    rejected: true,
    reason: "Audit entries cannot be deleted",
  });

  throw new AuditError("Audit entries cannot be deleted", "DELETION_REJECTED");
}

// ============================================
// Query Functions
// ============================================

/**
 * Get all audit entries
 */
export function getAuditLog(): AuditEntry[] {
  return [...auditLog];
}

/**
 * Get audit entries by data type
 */
export function getEntriesByDataType(dataType: DataType): AuditEntry[] {
  return auditLog.filter((e) => e.dataType === dataType);
}

/**
 * Get audit entries by data ID
 */
export function getEntriesByDataId(dataId: string): AuditEntry[] {
  return auditLog.filter((e) => e.dataId === dataId);
}

/**
 * Get audit entries by actor
 */
export function getEntriesByActor(actor: string): AuditEntry[] {
  return auditLog.filter((e) => e.actor === actor);
}

/**
 * Get audit entries by action
 */
export function getEntriesByAction(action: AuditAction): AuditEntry[] {
  return auditLog.filter((e) => e.action === action);
}

/**
 * Get audit entries in a time range
 */
export function getEntriesInTimeRange(start: Date, end: Date): AuditEntry[] {
  return auditLog.filter((e) => e.timestamp >= start && e.timestamp <= end);
}

/**
 * Get entry by ID
 */
export function getEntryById(id: string): AuditEntry | null {
  return auditLog.find((e) => e.id === id) || null;
}

/**
 * Get entry count
 */
export function getEntryCount(): number {
  return auditLog.length;
}

// ============================================
// Blockchain Anchoring
// ============================================

/**
 * Create a blockchain anchor for recent entries
 * In production, this would submit to Polygon
 */
export async function createBlockchainAnchor(): Promise<BlockchainAnchor | null> {
  const lastAnchor = anchors[anchors.length - 1];
  const startIndex = lastAnchor
    ? auditLog.findIndex((e) => e.id === lastAnchor.lastEntryId) + 1
    : 0;

  const entriesToAnchor = auditLog.slice(startIndex);

  if (entriesToAnchor.length < MIN_ENTRIES_FOR_ANCHOR) {
    return null;
  }

  const firstEntry = entriesToAnchor[0];
  const lastEntry = entriesToAnchor[entriesToAnchor.length - 1];
  if (!firstEntry || !lastEntry) {
    return null;
  }

  const merkleRoot = computeMerkleRoot(entriesToAnchor);

  const anchor: BlockchainAnchor = {
    id: `anchor-${Date.now().toString(36)}`,
    timestamp: new Date(),
    entryCount: entriesToAnchor.length,
    firstEntryId: firstEntry.id,
    lastEntryId: lastEntry.id,
    merkleRoot,
    network: "polygon-mumbai", // testnet for development
    // transactionHash and blockNumber would be set after actual blockchain submission
  };

  // In production, submit to Polygon here:
  // const tx = await contract.anchor(merkleRoot);
  // anchor.transactionHash = tx.hash;
  // anchor.blockNumber = tx.blockNumber;

  anchors.push(anchor);
  return anchor;
}

/**
 * Get all blockchain anchors
 */
export function getBlockchainAnchors(): BlockchainAnchor[] {
  return [...anchors];
}

/**
 * Verify entries against a blockchain anchor
 */
export function verifyAgainstAnchor(anchorId: string): boolean {
  const anchor = anchors.find((a) => a.id === anchorId);
  if (!anchor) {
    return false;
  }

  const startIndex = auditLog.findIndex((e) => e.id === anchor.firstEntryId);
  const endIndex = auditLog.findIndex((e) => e.id === anchor.lastEntryId);

  if (startIndex === -1 || endIndex === -1) {
    return false;
  }

  const entries = auditLog.slice(startIndex, endIndex + 1);
  const computedMerkleRoot = computeMerkleRoot(entries);

  return computedMerkleRoot === anchor.merkleRoot;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Clear audit log (for testing only)
 */
export function clearAuditLog(): void {
  auditLog = [];
  anchors = [];
}

/**
 * Get audit log state
 */
export function getAuditLogState(): AuditLogState {
  const verification = verifyChainIntegrity();
  return {
    entries: [...auditLog],
    lastHash: getLastHash(),
    chainValid: verification.isValid,
  };
}
