/**
 * Unit Tests for Blockchain Audit Service
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  computeHash,
  computeEntryHash,
  computeMerkleRoot,
  getLastHash,
  generateEntryId,
  createAuditEntry,
  logCreate,
  logUpdate,
  logDeleteAttempt,
  logAdminAction,
  verifyChainIntegrity,
  verifyEntryHash,
  attemptModifyEntry,
  attemptDeleteEntry,
  getAuditLog,
  getEntriesByDataType,
  getEntriesByDataId,
  getEntriesByActor,
  getEntriesByAction,
  getEntriesInTimeRange,
  getEntryById,
  getEntryCount,
  createBlockchainAnchor,
  getBlockchainAnchors,
  verifyAgainstAnchor,
  clearAuditLog,
  getAuditLogState,
  GENESIS_HASH,
  AuditError,
} from "./blockchain-audit.service";

describe("Blockchain Audit Service", () => {
  beforeEach(() => {
    clearAuditLog();
  });

  describe("computeHash", () => {
    it("should produce consistent hashes for same input", () => {
      const data = "test data";
      const hash1 = computeHash(data);
      const hash2 = computeHash(data);
      expect(hash1).toBe(hash2);
    });

    it("should produce different hashes for different inputs", () => {
      const hash1 = computeHash("data1");
      const hash2 = computeHash("data2");
      expect(hash1).not.toBe(hash2);
    });

    it("should produce 64-character hex string", () => {
      const hash = computeHash("test");
      expect(hash).toHaveLength(64);
      expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
    });
  });

  describe("computeEntryHash", () => {
    it("should compute hash for entry", () => {
      const entry = {
        id: "test-id",
        timestamp: new Date("2024-01-01"),
        actor: "user-1",
        actorType: "user" as const,
        action: "create" as const,
        dataType: "politician" as const,
        dataId: "pol-1",
        previousValue: null,
        newValue: { name: "Test" },
        metadata: undefined,
        previousHash: GENESIS_HASH,
      };
      const hash = computeEntryHash(entry);
      expect(hash).toHaveLength(64);
    });

    it("should produce different hashes for different entries", () => {
      const entry1 = {
        id: "test-id-1",
        timestamp: new Date("2024-01-01"),
        actor: "user-1",
        actorType: "user" as const,
        action: "create" as const,
        dataType: "politician" as const,
        dataId: "pol-1",
        previousValue: null,
        newValue: { name: "Test1" },
        metadata: undefined,
        previousHash: GENESIS_HASH,
      };
      const entry2 = {
        ...entry1,
        id: "test-id-2",
        newValue: { name: "Test2" },
      };
      expect(computeEntryHash(entry1)).not.toBe(computeEntryHash(entry2));
    });
  });

  describe("computeMerkleRoot", () => {
    it("should return genesis hash for empty array", () => {
      expect(computeMerkleRoot([])).toBe(GENESIS_HASH);
    });

    it("should return entry hash for single entry", () => {
      const entry = logCreate("user-1", "user", "politician", "pol-1", { name: "Test" });
      expect(computeMerkleRoot([entry])).toBe(entry.hash);
    });

    it("should compute merkle root for multiple entries", () => {
      const entry1 = logCreate("user-1", "user", "politician", "pol-1", { name: "Test1" });
      const entry2 = logCreate("user-1", "user", "politician", "pol-2", { name: "Test2" });
      const root = computeMerkleRoot([entry1, entry2]);
      expect(root).toHaveLength(64);
      expect(root).not.toBe(entry1.hash);
      expect(root).not.toBe(entry2.hash);
    });
  });

  describe("getLastHash", () => {
    it("should return genesis hash for empty log", () => {
      expect(getLastHash()).toBe(GENESIS_HASH);
    });

    it("should return last entry hash", () => {
      const entry = logCreate("user-1", "user", "politician", "pol-1", { name: "Test" });
      expect(getLastHash()).toBe(entry.hash);
    });
  });

  describe("generateEntryId", () => {
    it("should generate unique IDs", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateEntryId());
      }
      expect(ids.size).toBe(100);
    });

    it("should start with audit-", () => {
      const id = generateEntryId();
      expect(id.startsWith("audit-")).toBe(true);
    });
  });

  describe("createAuditEntry", () => {
    it("should create entry with correct fields", () => {
      const entry = createAuditEntry(
        "user-1",
        "user",
        "create",
        "politician",
        "pol-1",
        null,
        { name: "Test" },
        { source: "manual" }
      );

      expect(entry.actor).toBe("user-1");
      expect(entry.actorType).toBe("user");
      expect(entry.action).toBe("create");
      expect(entry.dataType).toBe("politician");
      expect(entry.dataId).toBe("pol-1");
      expect(entry.previousValue).toBeNull();
      expect(entry.newValue).toEqual({ name: "Test" });
      expect(entry.metadata).toEqual({ source: "manual" });
      expect(entry.hash).toHaveLength(64);
    });

    it("should chain entries correctly", () => {
      const entry1 = createAuditEntry("user-1", "user", "create", "politician", "pol-1", null, {
        name: "Test1",
      });
      const entry2 = createAuditEntry("user-1", "user", "create", "politician", "pol-2", null, {
        name: "Test2",
      });

      expect(entry1.previousHash).toBe(GENESIS_HASH);
      expect(entry2.previousHash).toBe(entry1.hash);
    });
  });

  describe("logCreate", () => {
    it("should log creation with null previousValue", () => {
      const entry = logCreate("user-1", "user", "politician", "pol-1", { name: "Test" });
      expect(entry.action).toBe("create");
      expect(entry.previousValue).toBeNull();
      expect(entry.newValue).toEqual({ name: "Test" });
    });
  });

  describe("logUpdate", () => {
    it("should log update with both values", () => {
      const entry = logUpdate(
        "user-1",
        "user",
        "politician",
        "pol-1",
        { name: "Old" },
        { name: "New" }
      );
      expect(entry.action).toBe("update");
      expect(entry.previousValue).toEqual({ name: "Old" });
      expect(entry.newValue).toEqual({ name: "New" });
    });
  });

  describe("logDeleteAttempt", () => {
    it("should log rejected deletion", () => {
      const entry = logDeleteAttempt(
        "user-1",
        "user",
        "politician",
        "pol-1",
        "User requested deletion"
      );
      expect(entry.action).toBe("delete");
      expect(entry.metadata?.rejected).toBe(true);
      expect(entry.metadata?.reason).toBe("User requested deletion");
    });
  });

  describe("logAdminAction", () => {
    it("should log admin action", () => {
      const entry = logAdminAction("admin-1", "approve_submission", "submission", "sub-1", {
        approved: true,
      });
      expect(entry.actorType).toBe("admin");
      expect(entry.action).toBe("admin_action");
      expect(entry.metadata?.adminAction).toBe("approve_submission");
    });
  });

  describe("verifyChainIntegrity", () => {
    it("should return valid for empty chain", () => {
      const result = verifyChainIntegrity();
      expect(result.isValid).toBe(true);
    });

    it("should return valid for correct chain", () => {
      logCreate("user-1", "user", "politician", "pol-1", { name: "Test1" });
      logCreate("user-1", "user", "politician", "pol-2", { name: "Test2" });
      logUpdate("user-1", "user", "politician", "pol-1", { name: "Test1" }, { name: "Updated" });

      const result = verifyChainIntegrity();
      expect(result.isValid).toBe(true);
    });
  });

  describe("verifyEntryHash", () => {
    it("should return true for valid entry", () => {
      const entry = logCreate("user-1", "user", "politician", "pol-1", { name: "Test" });
      expect(verifyEntryHash(entry)).toBe(true);
    });

    it("should return false for tampered entry", () => {
      const entry = logCreate("user-1", "user", "politician", "pol-1", { name: "Test" });
      const tamperedEntry = { ...entry, newValue: { name: "Tampered" } };
      expect(verifyEntryHash(tamperedEntry)).toBe(false);
    });
  });

  describe("attemptModifyEntry", () => {
    it("should throw MODIFICATION_REJECTED error", () => {
      const entry = logCreate("user-1", "user", "politician", "pol-1", { name: "Test" });
      expect(() =>
        attemptModifyEntry(entry.id, "admin-1", { newValue: { name: "Modified" } })
      ).toThrow(AuditError);
    });

    it("should log the modification attempt", () => {
      const entry = logCreate("user-1", "user", "politician", "pol-1", { name: "Test" });
      const countBefore = getEntryCount();

      try {
        attemptModifyEntry(entry.id, "admin-1", { newValue: { name: "Modified" } });
      } catch {
        // Expected
      }

      expect(getEntryCount()).toBe(countBefore + 1);
    });
  });

  describe("attemptDeleteEntry", () => {
    it("should throw DELETION_REJECTED error", () => {
      const entry = logCreate("user-1", "user", "politician", "pol-1", { name: "Test" });
      expect(() => attemptDeleteEntry(entry.id, "admin-1")).toThrow(AuditError);
    });

    it("should log the deletion attempt", () => {
      const entry = logCreate("user-1", "user", "politician", "pol-1", { name: "Test" });
      const countBefore = getEntryCount();

      try {
        attemptDeleteEntry(entry.id, "admin-1");
      } catch {
        // Expected
      }

      expect(getEntryCount()).toBe(countBefore + 1);
    });
  });

  describe("Query Functions", () => {
    beforeEach(() => {
      logCreate("user-1", "user", "politician", "pol-1", { name: "Politician 1" });
      logCreate("user-2", "admin", "bill", "bill-1", { title: "Bill 1" });
      logUpdate(
        "user-1",
        "user",
        "politician",
        "pol-1",
        { name: "Politician 1" },
        { name: "Updated" }
      );
    });

    it("getAuditLog should return all entries", () => {
      expect(getAuditLog()).toHaveLength(3);
    });

    it("getEntriesByDataType should filter by type", () => {
      expect(getEntriesByDataType("politician")).toHaveLength(2);
      expect(getEntriesByDataType("bill")).toHaveLength(1);
    });

    it("getEntriesByDataId should filter by ID", () => {
      expect(getEntriesByDataId("pol-1")).toHaveLength(2);
      expect(getEntriesByDataId("bill-1")).toHaveLength(1);
    });

    it("getEntriesByActor should filter by actor", () => {
      expect(getEntriesByActor("user-1")).toHaveLength(2);
      expect(getEntriesByActor("user-2")).toHaveLength(1);
    });

    it("getEntriesByAction should filter by action", () => {
      expect(getEntriesByAction("create")).toHaveLength(2);
      expect(getEntriesByAction("update")).toHaveLength(1);
    });

    it("getEntryById should return correct entry", () => {
      const entries = getAuditLog();
      const entry = getEntryById(entries[0]!.id);
      expect(entry).not.toBeNull();
      expect(entry?.id).toBe(entries[0]!.id);
    });

    it("getEntryById should return null for non-existent ID", () => {
      expect(getEntryById("non-existent")).toBeNull();
    });

    it("getEntryCount should return correct count", () => {
      expect(getEntryCount()).toBe(3);
    });
  });

  describe("getEntriesInTimeRange", () => {
    it("should filter entries by time range", () => {
      const now = new Date();
      logCreate("user-1", "user", "politician", "pol-1", { name: "Test" });

      const start = new Date(now.getTime() - 1000);
      const end = new Date(now.getTime() + 1000);

      expect(getEntriesInTimeRange(start, end)).toHaveLength(1);
    });

    it("should return empty for out-of-range", () => {
      logCreate("user-1", "user", "politician", "pol-1", { name: "Test" });

      const start = new Date("2020-01-01");
      const end = new Date("2020-12-31");

      expect(getEntriesInTimeRange(start, end)).toHaveLength(0);
    });
  });

  describe("Blockchain Anchoring", () => {
    it("should return null if not enough entries", async () => {
      logCreate("user-1", "user", "politician", "pol-1", { name: "Test" });
      const anchor = await createBlockchainAnchor();
      expect(anchor).toBeNull();
    });

    it("should create anchor with enough entries", async () => {
      // Create 100+ entries
      for (let i = 0; i < 105; i++) {
        logCreate("user-1", "user", "politician", `pol-${i}`, { name: `Politician ${i}` });
      }

      const anchor = await createBlockchainAnchor();
      expect(anchor).not.toBeNull();
      expect(anchor?.entryCount).toBe(105);
      expect(anchor?.merkleRoot).toHaveLength(64);
    });

    it("getBlockchainAnchors should return all anchors", async () => {
      for (let i = 0; i < 105; i++) {
        logCreate("user-1", "user", "politician", `pol-${i}`, { name: `Politician ${i}` });
      }
      await createBlockchainAnchor();

      expect(getBlockchainAnchors()).toHaveLength(1);
    });

    it("verifyAgainstAnchor should verify correct anchor", async () => {
      for (let i = 0; i < 105; i++) {
        logCreate("user-1", "user", "politician", `pol-${i}`, { name: `Politician ${i}` });
      }
      const anchor = await createBlockchainAnchor();

      expect(verifyAgainstAnchor(anchor!.id)).toBe(true);
    });

    it("verifyAgainstAnchor should return false for non-existent anchor", () => {
      expect(verifyAgainstAnchor("non-existent")).toBe(false);
    });
  });

  describe("getAuditLogState", () => {
    it("should return correct state", () => {
      logCreate("user-1", "user", "politician", "pol-1", { name: "Test" });
      const state = getAuditLogState();

      expect(state.entries).toHaveLength(1);
      expect(state.lastHash).toHaveLength(64);
      expect(state.chainValid).toBe(true);
    });
  });

  describe("clearAuditLog", () => {
    it("should clear all entries", () => {
      logCreate("user-1", "user", "politician", "pol-1", { name: "Test" });
      expect(getEntryCount()).toBe(1);

      clearAuditLog();
      expect(getEntryCount()).toBe(0);
      expect(getLastHash()).toBe(GENESIS_HASH);
    });
  });
});
