/**
 * Property-Based Tests for Blockchain Audit Service
 * Property 17: Audit Log Integrity
 * Validates: Requirements 36.1, 36.2, 36.3, 36.4, 36.5, 36.6, 36.7
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import {
  computeHash,
  computeMerkleRoot,
  createAuditEntry,
  logCreate,
  verifyChainIntegrity,
  verifyEntryHash,
  attemptModifyEntry,
  attemptDeleteEntry,
  getAuditLog,
  getLastHash,
  clearAuditLog,
  GENESIS_HASH,
  AuditError,
  AuditAction,
  DataType,
  type AuditEntry,
} from "./blockchain-audit.service";

const NUM_RUNS = 100;

// ============================================
// Arbitraries
// ============================================

const arbitraryActor = (): fc.Arbitrary<string> => fc.uuid().map((id) => `user-${id}`);

const arbitraryActorType = (): fc.Arbitrary<"user" | "admin" | "system"> =>
  fc.constantFrom("user", "admin", "system");

const arbitraryAction = (): fc.Arbitrary<AuditAction> =>
  fc.constantFrom(
    "create",
    "update",
    "delete",
    "verify",
    "reject",
    "approve",
    "login",
    "logout",
    "admin_action"
  );

const arbitraryDataType = (): fc.Arbitrary<DataType> =>
  fc.constantFrom(
    "politician",
    "bill",
    "controversy",
    "saln",
    "project",
    "user",
    "admin",
    "submission",
    "system"
  );

const arbitraryDataId = (): fc.Arbitrary<string> => fc.uuid().map((id) => `data-${id}`);

const arbitraryDataValue = (): fc.Arbitrary<Record<string, any>> =>
  fc.dictionary(
    fc.string({ minLength: 1, maxLength: 20 }),
    fc.oneof(fc.string({ minLength: 1, maxLength: 50 }), fc.integer(), fc.boolean()),
    { minKeys: 1, maxKeys: 5 }
  );

// ============================================
// Property Tests
// ============================================

describe("Audit Log Integrity - Property 17", () => {
  beforeEach(() => {
    clearAuditLog();
  });

  describe("Property 17.1: Entry Creation with Required Fields", () => {
    it("should create entries with all required fields", () => {
      fc.assert(
        fc.property(
          arbitraryActor(),
          arbitraryActorType(),
          arbitraryAction(),
          arbitraryDataType(),
          arbitraryDataId(),
          arbitraryDataValue(),
          (actor, actorType, action, dataType, dataId, newValue) => {
            clearAuditLog();
            const entry = createAuditEntry(
              actor,
              actorType,
              action,
              dataType,
              dataId,
              null,
              newValue
            );

            // Verify all required fields are present
            expect(entry.id).toBeDefined();
            expect(entry.timestamp).toBeInstanceOf(Date);
            expect(entry.actor).toBe(actor);
            expect(entry.actorType).toBe(actorType);
            expect(entry.action).toBe(action);
            expect(entry.dataType).toBe(dataType);
            expect(entry.dataId).toBe(dataId);
            expect(entry.previousHash).toBeDefined();
            expect(entry.hash).toBeDefined();
            expect(entry.hash).toHaveLength(64);

            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe("Property 17.2: Cryptographic Hash Chaining", () => {
    it("should chain entries with previous hash", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 10 }),
          arbitraryActor(),
          arbitraryDataType(),
          (count, actor, dataType) => {
            clearAuditLog();

            // Create multiple entries
            for (let i = 0; i < count; i++) {
              logCreate(actor, "user", dataType, `data-${i}`, { index: i });
            }

            const entries = getAuditLog();

            // First entry should link to genesis
            expect(entries[0]!.previousHash).toBe(GENESIS_HASH);

            // Each subsequent entry should link to previous
            for (let i = 1; i < entries.length; i++) {
              expect(entries[i]!.previousHash).toBe(entries[i - 1]!.hash);
            }

            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should produce unique hashes for each entry", () => {
      fc.assert(
        fc.property(fc.integer({ min: 2, max: 20 }), arbitraryActor(), (count, actor) => {
          clearAuditLog();

          for (let i = 0; i < count; i++) {
            logCreate(actor, "user", "politician", `pol-${i}`, { name: `Politician ${i}` });
          }

          const entries = getAuditLog();
          const hashes = entries.map((e) => e.hash);
          const uniqueHashes = new Set(hashes);

          expect(uniqueHashes.size).toBe(count);
          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe("Property 17.3: Append-Only Log", () => {
    it("should only allow appending new entries", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 10 }), arbitraryActor(), (count, actor) => {
          clearAuditLog();

          const initialCount = getAuditLog().length;

          for (let i = 0; i < count; i++) {
            logCreate(actor, "user", "politician", `pol-${i}`, { name: `Test ${i}` });
          }

          // Count should only increase
          expect(getAuditLog().length).toBe(initialCount + count);
          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe("Property 17.4: Modification Rejection", () => {
    it("should reject all modification attempts", () => {
      fc.assert(
        fc.property(arbitraryActor(), arbitraryDataValue(), (actor, newData) => {
          clearAuditLog();
          const entry = logCreate("user-1", "user", "politician", "pol-1", { name: "Test" });
          const countBefore = getAuditLog().length;

          let errorThrown = false;
          try {
            attemptModifyEntry(entry.id, actor, newData);
          } catch (e) {
            if (e instanceof AuditError && e.code === "MODIFICATION_REJECTED") {
              errorThrown = true;
            }
          }

          expect(errorThrown).toBe(true);
          // The attempt should be logged
          expect(getAuditLog().length).toBe(countBefore + 1);
          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe("Property 17.5: Deletion Rejection", () => {
    it("should reject all deletion attempts", () => {
      fc.assert(
        fc.property(arbitraryActor(), (actor) => {
          clearAuditLog();
          const entry = logCreate("user-1", "user", "politician", "pol-1", { name: "Test" });
          const countBefore = getAuditLog().length;

          let errorThrown = false;
          try {
            attemptDeleteEntry(entry.id, actor);
          } catch (e) {
            if (e instanceof AuditError && e.code === "DELETION_REJECTED") {
              errorThrown = true;
            }
          }

          expect(errorThrown).toBe(true);
          // The attempt should be logged
          expect(getAuditLog().length).toBe(countBefore + 1);
          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe("Property 17.6: Chain Integrity Verification", () => {
    it("should verify valid chains", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 20 }), arbitraryActor(), (count, actor) => {
          clearAuditLog();

          for (let i = 0; i < count; i++) {
            logCreate(actor, "user", "politician", `pol-${i}`, { name: `Test ${i}` });
          }

          const result = verifyChainIntegrity();
          expect(result.isValid).toBe(true);
          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should detect tampered entries", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 10 }),
          fc.integer({ min: 0, max: 9 }),
          (count, tamperIndex) => {
            clearAuditLog();
            const actualCount = Math.max(2, count);
            const actualTamperIndex = tamperIndex % actualCount;

            for (let i = 0; i < actualCount; i++) {
              logCreate("user-1", "user", "politician", `pol-${i}`, { name: `Test ${i}` });
            }

            const entries = getAuditLog();
            // Tamper with an entry (this simulates external tampering)
            const tamperedEntry = {
              ...entries[actualTamperIndex]!,
              newValue: { name: "TAMPERED" },
            } as AuditEntry;

            // Verify the tampered entry fails hash verification
            expect(verifyEntryHash(tamperedEntry)).toBe(false);
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe("Property 17.7: Hash Consistency", () => {
    it("should produce consistent hashes for same data", () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 100 }), (data) => {
          const hash1 = computeHash(data);
          const hash2 = computeHash(data);
          expect(hash1).toBe(hash2);
          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should produce different hashes for different data", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (data1, data2) => {
            fc.pre(data1 !== data2);
            const hash1 = computeHash(data1);
            const hash2 = computeHash(data2);
            expect(hash1).not.toBe(hash2);
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe("Property 17.8: Entry Hash Verification", () => {
    it("should verify all created entries", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }),
          arbitraryActor(),
          arbitraryDataType(),
          (count, actor, dataType) => {
            clearAuditLog();

            for (let i = 0; i < count; i++) {
              logCreate(actor, "user", dataType, `data-${i}`, { index: i });
            }

            const entries = getAuditLog();
            for (const entry of entries) {
              expect(verifyEntryHash(entry)).toBe(true);
            }

            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe("Property 17.9: Merkle Root Computation", () => {
    it("should compute consistent merkle roots", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 10 }), (count) => {
          clearAuditLog();

          for (let i = 0; i < count; i++) {
            logCreate("user-1", "user", "politician", `pol-${i}`, { name: `Test ${i}` });
          }

          const entries = getAuditLog();
          const root1 = computeMerkleRoot(entries);
          const root2 = computeMerkleRoot(entries);

          expect(root1).toBe(root2);
          expect(root1).toHaveLength(64);
          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should produce different roots for different entry sets", () => {
      fc.assert(
        fc.property(fc.integer({ min: 2, max: 10 }), (count) => {
          clearAuditLog();

          for (let i = 0; i < count; i++) {
            logCreate("user-1", "user", "politician", `pol-${i}`, { name: `Test ${i}` });
          }

          const entries = getAuditLog();
          const fullRoot = computeMerkleRoot(entries);
          const partialRoot = computeMerkleRoot(entries.slice(0, -1));

          expect(fullRoot).not.toBe(partialRoot);
          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe("Property 17.10: Last Hash Tracking", () => {
    it("should always return the last entry hash", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 20 }), (count) => {
          clearAuditLog();

          for (let i = 0; i < count; i++) {
            const entry = logCreate("user-1", "user", "politician", `pol-${i}`, {
              name: `Test ${i}`,
            });
            expect(getLastHash()).toBe(entry.hash);
          }

          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });
});
