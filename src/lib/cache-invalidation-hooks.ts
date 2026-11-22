/**
 * Cache Invalidation Hooks
 * Provides hooks for invalidating caches when data is updated
 *
 * Validates: Requirements 44.3 - Implement caching to reduce database load
 *
 * These hooks should be called after any data modification to ensure
 * cache consistency. They can be integrated with:
 * - Data pipeline scrapers
 * - Admin data modifications
 * - Community report approvals
 * - AI verification updates
 */

import { cacheInvalidation } from "./cache-service";

/**
 * Hook types for different data update events
 */
export type CacheInvalidationEvent =
  | { type: "politician_created"; politicianId: string }
  | { type: "politician_updated"; politicianId: string }
  | { type: "politician_deleted"; politicianId: string }
  | { type: "bill_created"; billId: string; authorIds: string[] }
  | { type: "bill_updated"; billId: string; authorIds: string[] }
  | { type: "bill_deleted"; billId: string; authorIds: string[] }
  | { type: "saln_created"; politicianId: string }
  | { type: "saln_updated"; politicianId: string }
  | { type: "saln_deleted"; politicianId: string }
  | { type: "election_created"; politicianId: string }
  | { type: "election_updated"; politicianId: string }
  | { type: "controversy_created"; politicianId: string }
  | { type: "controversy_updated"; politicianId: string }
  | { type: "controversy_deleted"; politicianId: string }
  | { type: "family_relationship_created"; politicianIds: string[] }
  | { type: "family_relationship_updated"; politicianIds: string[] }
  | { type: "family_relationship_deleted"; politicianIds: string[] }
  | { type: "position_created"; politicianId: string }
  | { type: "position_updated"; politicianId: string }
  | { type: "voting_record_created"; politicianId: string }
  | { type: "attendance_updated"; politicianId: string }
  | { type: "promise_created"; politicianId: string }
  | { type: "promise_updated"; politicianId: string }
  | { type: "project_created"; politicianId: string }
  | { type: "project_updated"; politicianId: string }
  | { type: "campaign_finance_updated"; politicianId: string }
  | { type: "bulk_import"; source: string }
  | { type: "search_index_updated" };

/**
 * Event listeners for cache invalidation
 */
type CacheInvalidationListener = (event: CacheInvalidationEvent) => Promise<void>;

const listeners: CacheInvalidationListener[] = [];

/**
 * Register a listener for cache invalidation events
 */
export function onCacheInvalidation(listener: CacheInvalidationListener): () => void {
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  };
}

/**
 * Emit a cache invalidation event
 * This triggers the appropriate cache invalidation based on the event type
 */
export async function emitCacheInvalidation(event: CacheInvalidationEvent): Promise<void> {
  // Handle the event based on type
  switch (event.type) {
    case "politician_created":
    case "politician_updated":
    case "politician_deleted":
      await cacheInvalidation.invalidatePolitician(event.politicianId);
      break;

    case "bill_created":
    case "bill_updated":
    case "bill_deleted":
      await cacheInvalidation.invalidateBill(event.billId, event.authorIds);
      break;

    case "saln_created":
    case "saln_updated":
    case "saln_deleted":
      await cacheInvalidation.invalidateSALN(event.politicianId);
      break;

    case "election_created":
    case "election_updated":
      await cacheInvalidation.invalidateElection(event.politicianId);
      break;

    case "controversy_created":
    case "controversy_updated":
    case "controversy_deleted":
      await cacheInvalidation.invalidateControversy(event.politicianId);
      break;

    case "family_relationship_created":
    case "family_relationship_updated":
    case "family_relationship_deleted":
      await cacheInvalidation.invalidateFamilyNetwork(event.politicianIds);
      break;

    case "position_created":
    case "position_updated":
    case "voting_record_created":
    case "attendance_updated":
    case "promise_created":
    case "promise_updated":
    case "project_created":
    case "project_updated":
    case "campaign_finance_updated":
      await cacheInvalidation.invalidatePolitician(event.politicianId);
      break;

    case "bulk_import":
      // For bulk imports, invalidate all caches
      await cacheInvalidation.invalidateAll();
      break;

    case "search_index_updated":
      await cacheInvalidation.invalidateSearch();
      break;
  }

  // Notify all listeners
  await Promise.all(listeners.map((listener) => listener(event)));
}

/**
 * Decorator function to automatically invalidate cache after data operations
 * Usage: wrap your data update functions with this decorator
 */
export function withCacheInvalidation<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  getEvent: (...args: Parameters<T>) => CacheInvalidationEvent | null
): T {
  return (async (...args: Parameters<T>) => {
    const result = await fn(...args);
    const event = getEvent(...args);
    if (event) {
      await emitCacheInvalidation(event);
    }
    return result;
  }) as T;
}

/**
 * Batch cache invalidation for multiple events
 * Useful when processing bulk updates
 */
export async function batchInvalidate(events: CacheInvalidationEvent[]): Promise<void> {
  // Deduplicate events by type and ID
  const uniqueEvents = new Map<string, CacheInvalidationEvent>();

  for (const event of events) {
    const key = getEventKey(event);
    uniqueEvents.set(key, event);
  }

  // Process all unique events
  await Promise.all(Array.from(uniqueEvents.values()).map(emitCacheInvalidation));
}

/**
 * Generate a unique key for an event for deduplication
 */
function getEventKey(event: CacheInvalidationEvent): string {
  switch (event.type) {
    case "politician_created":
    case "politician_updated":
    case "politician_deleted":
      return `politician:${event.politicianId}`;

    case "bill_created":
    case "bill_updated":
    case "bill_deleted":
      return `bill:${event.billId}`;

    case "saln_created":
    case "saln_updated":
    case "saln_deleted":
      return `saln:${event.politicianId}`;

    case "election_created":
    case "election_updated":
      return `election:${event.politicianId}`;

    case "controversy_created":
    case "controversy_updated":
    case "controversy_deleted":
      return `controversy:${event.politicianId}`;

    case "family_relationship_created":
    case "family_relationship_updated":
    case "family_relationship_deleted":
      return `family:${event.politicianIds.sort().join(",")}`;

    case "position_created":
    case "position_updated":
      return `position:${event.politicianId}`;

    case "voting_record_created":
      return `voting:${event.politicianId}`;

    case "attendance_updated":
      return `attendance:${event.politicianId}`;

    case "promise_created":
    case "promise_updated":
      return `promise:${event.politicianId}`;

    case "project_created":
    case "project_updated":
      return `project:${event.politicianId}`;

    case "campaign_finance_updated":
      return `campaign:${event.politicianId}`;

    case "bulk_import":
      return `bulk:${event.source}`;

    case "search_index_updated":
      return "search";
  }
}

/**
 * Helper functions for common cache invalidation scenarios
 */
export const invalidationHelpers = {
  /**
   * Invalidate after creating a new politician
   */
  async afterPoliticianCreate(politicianId: string): Promise<void> {
    await emitCacheInvalidation({ type: "politician_created", politicianId });
  },

  /**
   * Invalidate after updating a politician
   */
  async afterPoliticianUpdate(politicianId: string): Promise<void> {
    await emitCacheInvalidation({ type: "politician_updated", politicianId });
  },

  /**
   * Invalidate after creating/updating a bill
   */
  async afterBillUpdate(billId: string, authorIds: string[]): Promise<void> {
    await emitCacheInvalidation({ type: "bill_updated", billId, authorIds });
  },

  /**
   * Invalidate after SALN update
   */
  async afterSALNUpdate(politicianId: string): Promise<void> {
    await emitCacheInvalidation({ type: "saln_updated", politicianId });
  },

  /**
   * Invalidate after election data update
   */
  async afterElectionUpdate(politicianId: string): Promise<void> {
    await emitCacheInvalidation({ type: "election_updated", politicianId });
  },

  /**
   * Invalidate after controversy update
   */
  async afterControversyUpdate(politicianId: string): Promise<void> {
    await emitCacheInvalidation({ type: "controversy_updated", politicianId });
  },

  /**
   * Invalidate after bulk data import
   */
  async afterBulkImport(source: string): Promise<void> {
    await emitCacheInvalidation({ type: "bulk_import", source });
  },

  /**
   * Invalidate search index
   */
  async afterSearchIndexUpdate(): Promise<void> {
    await emitCacheInvalidation({ type: "search_index_updated" });
  },
};

export default {
  emitCacheInvalidation,
  batchInvalidate,
  onCacheInvalidation,
  withCacheInvalidation,
  invalidationHelpers,
};
