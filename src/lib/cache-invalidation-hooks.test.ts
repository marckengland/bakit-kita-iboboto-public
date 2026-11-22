/**
 * Cache Invalidation Hooks Tests
 *
 * Tests for the cache invalidation event system.
 * Validates: Requirements 44.3
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  emitCacheInvalidation,
  batchInvalidate,
  onCacheInvalidation,
  invalidationHelpers,
  CacheInvalidationEvent,
} from "./cache-invalidation-hooks";
import { cacheInvalidation } from "./cache-service";

// Mock cache-service
vi.mock("./cache-service", () => ({
  cacheInvalidation: {
    invalidatePolitician: vi.fn().mockResolvedValue(undefined),
    invalidateBill: vi.fn().mockResolvedValue(undefined),
    invalidateSALN: vi.fn().mockResolvedValue(undefined),
    invalidateElection: vi.fn().mockResolvedValue(undefined),
    invalidateControversy: vi.fn().mockResolvedValue(undefined),
    invalidateFamilyNetwork: vi.fn().mockResolvedValue(undefined),
    invalidateSearch: vi.fn().mockResolvedValue(undefined),
    invalidateAll: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("Cache Invalidation Events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("emitCacheInvalidation", () => {
    it("should invalidate politician cache on politician_created event", async () => {
      await emitCacheInvalidation({
        type: "politician_created",
        politicianId: "pol-123",
      });

      expect(cacheInvalidation.invalidatePolitician).toHaveBeenCalledWith("pol-123");
    });

    it("should invalidate politician cache on politician_updated event", async () => {
      await emitCacheInvalidation({
        type: "politician_updated",
        politicianId: "pol-456",
      });

      expect(cacheInvalidation.invalidatePolitician).toHaveBeenCalledWith("pol-456");
    });

    it("should invalidate bill cache with author IDs on bill_updated event", async () => {
      await emitCacheInvalidation({
        type: "bill_updated",
        billId: "bill-123",
        authorIds: ["pol-1", "pol-2"],
      });

      expect(cacheInvalidation.invalidateBill).toHaveBeenCalledWith("bill-123", ["pol-1", "pol-2"]);
    });

    it("should invalidate SALN cache on saln_updated event", async () => {
      await emitCacheInvalidation({
        type: "saln_updated",
        politicianId: "pol-123",
      });

      expect(cacheInvalidation.invalidateSALN).toHaveBeenCalledWith("pol-123");
    });

    it("should invalidate election cache on election_updated event", async () => {
      await emitCacheInvalidation({
        type: "election_updated",
        politicianId: "pol-123",
      });

      expect(cacheInvalidation.invalidateElection).toHaveBeenCalledWith("pol-123");
    });

    it("should invalidate controversy cache on controversy_created event", async () => {
      await emitCacheInvalidation({
        type: "controversy_created",
        politicianId: "pol-123",
      });

      expect(cacheInvalidation.invalidateControversy).toHaveBeenCalledWith("pol-123");
    });

    it("should invalidate family network cache for all related politicians", async () => {
      await emitCacheInvalidation({
        type: "family_relationship_created",
        politicianIds: ["pol-1", "pol-2", "pol-3"],
      });

      expect(cacheInvalidation.invalidateFamilyNetwork).toHaveBeenCalledWith([
        "pol-1",
        "pol-2",
        "pol-3",
      ]);
    });

    it("should invalidate all caches on bulk_import event", async () => {
      await emitCacheInvalidation({
        type: "bulk_import",
        source: "senate",
      });

      expect(cacheInvalidation.invalidateAll).toHaveBeenCalled();
    });

    it("should invalidate search cache on search_index_updated event", async () => {
      await emitCacheInvalidation({
        type: "search_index_updated",
      });

      expect(cacheInvalidation.invalidateSearch).toHaveBeenCalled();
    });
  });

  describe("batchInvalidate", () => {
    it("should deduplicate events by type and ID", async () => {
      const events: CacheInvalidationEvent[] = [
        { type: "politician_updated", politicianId: "pol-123" },
        { type: "politician_updated", politicianId: "pol-123" }, // Duplicate
        { type: "politician_updated", politicianId: "pol-456" },
      ];

      await batchInvalidate(events);

      // Should only call twice (deduplicated)
      expect(cacheInvalidation.invalidatePolitician).toHaveBeenCalledTimes(2);
      expect(cacheInvalidation.invalidatePolitician).toHaveBeenCalledWith("pol-123");
      expect(cacheInvalidation.invalidatePolitician).toHaveBeenCalledWith("pol-456");
    });

    it("should handle mixed event types", async () => {
      const events: CacheInvalidationEvent[] = [
        { type: "politician_updated", politicianId: "pol-123" },
        { type: "bill_updated", billId: "bill-456", authorIds: ["pol-123"] },
        { type: "saln_updated", politicianId: "pol-789" },
      ];

      await batchInvalidate(events);

      expect(cacheInvalidation.invalidatePolitician).toHaveBeenCalledWith("pol-123");
      expect(cacheInvalidation.invalidateBill).toHaveBeenCalledWith("bill-456", ["pol-123"]);
      expect(cacheInvalidation.invalidateSALN).toHaveBeenCalledWith("pol-789");
    });
  });

  describe("onCacheInvalidation", () => {
    it("should register and call listeners on events", async () => {
      const listener = vi.fn();
      const unsubscribe = onCacheInvalidation(listener);

      await emitCacheInvalidation({
        type: "politician_updated",
        politicianId: "pol-123",
      });

      expect(listener).toHaveBeenCalledWith({
        type: "politician_updated",
        politicianId: "pol-123",
      });

      // Cleanup
      unsubscribe();
    });

    it("should unsubscribe listener when unsubscribe is called", async () => {
      const listener = vi.fn();
      const unsubscribe = onCacheInvalidation(listener);

      // First event should trigger listener
      await emitCacheInvalidation({
        type: "politician_updated",
        politicianId: "pol-123",
      });
      expect(listener).toHaveBeenCalledTimes(1);

      // Unsubscribe
      unsubscribe();

      // Second event should not trigger listener
      await emitCacheInvalidation({
        type: "politician_updated",
        politicianId: "pol-456",
      });
      expect(listener).toHaveBeenCalledTimes(1); // Still 1
    });
  });

  describe("invalidationHelpers", () => {
    it("should provide helper for politician create", async () => {
      await invalidationHelpers.afterPoliticianCreate("pol-123");
      expect(cacheInvalidation.invalidatePolitician).toHaveBeenCalledWith("pol-123");
    });

    it("should provide helper for politician update", async () => {
      await invalidationHelpers.afterPoliticianUpdate("pol-456");
      expect(cacheInvalidation.invalidatePolitician).toHaveBeenCalledWith("pol-456");
    });

    it("should provide helper for bill update", async () => {
      await invalidationHelpers.afterBillUpdate("bill-123", ["pol-1", "pol-2"]);
      expect(cacheInvalidation.invalidateBill).toHaveBeenCalledWith("bill-123", ["pol-1", "pol-2"]);
    });

    it("should provide helper for SALN update", async () => {
      await invalidationHelpers.afterSALNUpdate("pol-123");
      expect(cacheInvalidation.invalidateSALN).toHaveBeenCalledWith("pol-123");
    });

    it("should provide helper for election update", async () => {
      await invalidationHelpers.afterElectionUpdate("pol-123");
      expect(cacheInvalidation.invalidateElection).toHaveBeenCalledWith("pol-123");
    });

    it("should provide helper for controversy update", async () => {
      await invalidationHelpers.afterControversyUpdate("pol-123");
      expect(cacheInvalidation.invalidateControversy).toHaveBeenCalledWith("pol-123");
    });

    it("should provide helper for bulk import", async () => {
      await invalidationHelpers.afterBulkImport("senate");
      expect(cacheInvalidation.invalidateAll).toHaveBeenCalled();
    });

    it("should provide helper for search index update", async () => {
      await invalidationHelpers.afterSearchIndexUpdate();
      expect(cacheInvalidation.invalidateSearch).toHaveBeenCalled();
    });
  });
});
