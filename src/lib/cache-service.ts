/**
 * Comprehensive Caching Service
 * Implements Redis caching for frequently accessed data with cache invalidation
 *
 * Validates: Requirements 44.3, 44.4
 * - Implement caching to reduce database load and improve response times
 * - Use CDN for static assets (configured in next.config.mjs)
 */

import { cache, CACHE_KEYS, CACHE_TTL, redis } from "./redis";

// Extended cache key prefixes for comprehensive caching
export const EXTENDED_CACHE_KEYS = {
  ...CACHE_KEYS,
  BILL_LIST: "bill_list:",
  BILL_DETAIL: "bill_detail:",
  SALN_HISTORY: "saln_history:",
  SALN_RECORD: "saln_record:",
  SALN_TIMELINE: "saln_timeline:",
  VOTING_RECORD: "voting_record:",
  ATTENDANCE: "attendance:",
  RED_FLAGS: "red_flags:",
  FAMILY_NETWORK: "family_network:",
  TERM_LIMIT: "term_limit:",
  PROMISES: "promises:",
  PROJECTS: "projects:",
  CAMPAIGN_FINANCE: "campaign_finance:",
  COMPARISON: "comparison:",
  LEGISLATIVE_IMPACT: "legislative_impact:",
  CONFLICT_INTEREST: "conflict_interest:",
} as const;

// Extended TTL values for different data types
export const EXTENDED_CACHE_TTL = {
  ...CACHE_TTL,
  POLITICIAN_PROFILE: 1800, // 30 minutes - politician profiles change infrequently
  POLITICIAN_LIST: 600, // 10 minutes - list may change with new filters
  BILL_DATA: 3600, // 1 hour - bills don't change frequently
  SALN_DATA: 7200, // 2 hours - SALN data is updated rarely
  ELECTION_DATA: 86400, // 24 hours - historical election data is static
  RED_FLAGS: 1800, // 30 minutes - red flags may be updated
  FAMILY_NETWORK: 86400, // 24 hours - family relationships rarely change
  TERM_LIMIT: 86400, // 24 hours - term limits are static
  COMPARISON: 300, // 5 minutes - comparisons are dynamic
  SEARCH_RESULTS: 300, // 5 minutes - search results may change
} as const;

/**
 * Cache key generators for consistent key formatting
 */
export const cacheKeyGenerators = {
  politician: (id: string) => `${EXTENDED_CACHE_KEYS.POLITICIAN}${id}`,
  politicianList: (filters: Record<string, unknown>, page: number, pageSize: number) => {
    const filterHash = hashObject(filters);
    return `${EXTENDED_CACHE_KEYS.POLITICIAN_LIST}${filterHash}:${page}:${pageSize}`;
  },
  bill: (id: string) => `${EXTENDED_CACHE_KEYS.BILL_DETAIL}${id}`,
  billList: (politicianId: string, filters: Record<string, unknown>) => {
    const filterHash = hashObject(filters);
    return `${EXTENDED_CACHE_KEYS.BILL_LIST}${politicianId}:${filterHash}`;
  },
  salnHistory: (politicianId: string) => `${EXTENDED_CACHE_KEYS.SALN_HISTORY}${politicianId}`,
  salnRecord: (id: string) => `${EXTENDED_CACHE_KEYS.SALN_RECORD}${id}`,
  salnTimeline: (politicianId: string) => `${EXTENDED_CACHE_KEYS.SALN_TIMELINE}${politicianId}`,
  votingRecord: (politicianId: string, page: number, pageSize: number) =>
    `${EXTENDED_CACHE_KEYS.VOTING_RECORD}${politicianId}:${page}:${pageSize}`,
  attendance: (politicianId: string) => `${EXTENDED_CACHE_KEYS.ATTENDANCE}${politicianId}`,
  redFlags: (politicianId: string) => `${EXTENDED_CACHE_KEYS.RED_FLAGS}${politicianId}`,
  familyNetwork: (politicianId: string) => `${EXTENDED_CACHE_KEYS.FAMILY_NETWORK}${politicianId}`,
  termLimit: (politicianId: string) => `${EXTENDED_CACHE_KEYS.TERM_LIMIT}${politicianId}`,
  promises: (politicianId: string) => `${EXTENDED_CACHE_KEYS.PROMISES}${politicianId}`,
  projects: (politicianId: string, positionId?: string) =>
    `${EXTENDED_CACHE_KEYS.PROJECTS}${politicianId}${positionId ? `:${positionId}` : ""}`,
  campaignFinance: (politicianId: string, year?: number) =>
    `${EXTENDED_CACHE_KEYS.CAMPAIGN_FINANCE}${politicianId}${year ? `:${year}` : ""}`,
  comparison: (politicianIds: string[]) =>
    `${EXTENDED_CACHE_KEYS.COMPARISON}${politicianIds.sort().join(":")}`,
  legislativeImpact: (politicianId: string) =>
    `${EXTENDED_CACHE_KEYS.LEGISLATIVE_IMPACT}${politicianId}`,
  conflictInterest: (politicianId: string) =>
    `${EXTENDED_CACHE_KEYS.CONFLICT_INTEREST}${politicianId}`,
  search: (query: string, filters: Record<string, unknown>) => {
    const filterHash = hashObject(filters);
    return `${EXTENDED_CACHE_KEYS.SEARCH}${query}:${filterHash}`;
  },
  autocomplete: (prefix: string) => `${EXTENDED_CACHE_KEYS.AUTOCOMPLETE}${prefix}`,
};

/**
 * Simple hash function for objects to create cache keys
 */
function hashObject(obj: Record<string, unknown>): string {
  const str = JSON.stringify(obj, Object.keys(obj).sort());
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Cache invalidation service for handling data updates
 */
export const cacheInvalidation = {
  /**
   * Invalidate all caches related to a politician
   * Called when politician data is updated
   */
  async invalidatePolitician(politicianId: string): Promise<void> {
    const patterns = [
      `${EXTENDED_CACHE_KEYS.POLITICIAN}${politicianId}*`,
      `${EXTENDED_CACHE_KEYS.POLITICIAN_LIST}*`,
      `${EXTENDED_CACHE_KEYS.BILL_LIST}${politicianId}*`,
      `${EXTENDED_CACHE_KEYS.SALN_HISTORY}${politicianId}*`,
      `${EXTENDED_CACHE_KEYS.SALN_TIMELINE}${politicianId}*`,
      `${EXTENDED_CACHE_KEYS.VOTING_RECORD}${politicianId}*`,
      `${EXTENDED_CACHE_KEYS.ATTENDANCE}${politicianId}*`,
      `${EXTENDED_CACHE_KEYS.RED_FLAGS}${politicianId}*`,
      `${EXTENDED_CACHE_KEYS.FAMILY_NETWORK}${politicianId}*`,
      `${EXTENDED_CACHE_KEYS.TERM_LIMIT}${politicianId}*`,
      `${EXTENDED_CACHE_KEYS.PROMISES}${politicianId}*`,
      `${EXTENDED_CACHE_KEYS.PROJECTS}${politicianId}*`,
      `${EXTENDED_CACHE_KEYS.CAMPAIGN_FINANCE}${politicianId}*`,
      `${EXTENDED_CACHE_KEYS.LEGISLATIVE_IMPACT}${politicianId}*`,
      `${EXTENDED_CACHE_KEYS.CONFLICT_INTEREST}${politicianId}*`,
      `${EXTENDED_CACHE_KEYS.COMPARISON}*${politicianId}*`,
      `${EXTENDED_CACHE_KEYS.SEARCH}*`,
      `${EXTENDED_CACHE_KEYS.AUTOCOMPLETE}*`,
    ];

    await Promise.all(patterns.map((pattern) => cache.delByPattern(pattern)));
  },

  /**
   * Invalidate bill-related caches
   * Called when bill data is updated
   */
  async invalidateBill(billId: string, authorIds: string[] = []): Promise<void> {
    const patterns = [
      `${EXTENDED_CACHE_KEYS.BILL_DETAIL}${billId}*`,
      `${EXTENDED_CACHE_KEYS.BILL_LIST}*`,
      `${EXTENDED_CACHE_KEYS.SEARCH}*`,
    ];

    // Also invalidate caches for all authors
    for (const authorId of authorIds) {
      patterns.push(`${EXTENDED_CACHE_KEYS.LEGISLATIVE_IMPACT}${authorId}*`);
      patterns.push(`${EXTENDED_CACHE_KEYS.CONFLICT_INTEREST}${authorId}*`);
    }

    await Promise.all(patterns.map((pattern) => cache.delByPattern(pattern)));
  },

  /**
   * Invalidate SALN-related caches
   * Called when SALN data is updated
   */
  async invalidateSALN(politicianId: string): Promise<void> {
    const patterns = [
      `${EXTENDED_CACHE_KEYS.SALN_HISTORY}${politicianId}*`,
      `${EXTENDED_CACHE_KEYS.SALN_RECORD}*`,
      `${EXTENDED_CACHE_KEYS.SALN_TIMELINE}${politicianId}*`,
      `${EXTENDED_CACHE_KEYS.RED_FLAGS}${politicianId}*`,
      `${EXTENDED_CACHE_KEYS.CONFLICT_INTEREST}${politicianId}*`,
      `${EXTENDED_CACHE_KEYS.COMPARISON}*${politicianId}*`,
    ];

    await Promise.all(patterns.map((pattern) => cache.delByPattern(pattern)));
  },

  /**
   * Invalidate election-related caches
   * Called when election data is updated
   */
  async invalidateElection(politicianId: string): Promise<void> {
    const patterns = [
      `${EXTENDED_CACHE_KEYS.ELECTION}${politicianId}*`,
      `${EXTENDED_CACHE_KEYS.TERM_LIMIT}${politicianId}*`,
      `${EXTENDED_CACHE_KEYS.COMPARISON}*${politicianId}*`,
    ];

    await Promise.all(patterns.map((pattern) => cache.delByPattern(pattern)));
  },

  /**
   * Invalidate controversy/red flag caches
   * Called when controversy data is updated
   */
  async invalidateControversy(politicianId: string): Promise<void> {
    const patterns = [
      `${EXTENDED_CACHE_KEYS.RED_FLAGS}${politicianId}*`,
      `${EXTENDED_CACHE_KEYS.POLITICIAN}${politicianId}*`,
      `${EXTENDED_CACHE_KEYS.COMPARISON}*${politicianId}*`,
    ];

    await Promise.all(patterns.map((pattern) => cache.delByPattern(pattern)));
  },

  /**
   * Invalidate family network caches
   * Called when family relationship data is updated
   */
  async invalidateFamilyNetwork(politicianIds: string[]): Promise<void> {
    const patterns: string[] = [];
    for (const id of politicianIds) {
      patterns.push(`${EXTENDED_CACHE_KEYS.FAMILY_NETWORK}${id}*`);
      patterns.push(`${EXTENDED_CACHE_KEYS.RED_FLAGS}${id}*`);
    }

    await Promise.all(patterns.map((pattern) => cache.delByPattern(pattern)));
  },

  /**
   * Invalidate all search-related caches
   * Called when any searchable data is updated
   */
  async invalidateSearch(): Promise<void> {
    await Promise.all([
      cache.delByPattern(`${EXTENDED_CACHE_KEYS.SEARCH}*`),
      cache.delByPattern(`${EXTENDED_CACHE_KEYS.AUTOCOMPLETE}*`),
    ]);
  },

  /**
   * Invalidate all caches (use sparingly)
   * Called during major data migrations or system updates
   */
  async invalidateAll(): Promise<void> {
    const allPrefixes = Object.values(EXTENDED_CACHE_KEYS);
    await Promise.all(allPrefixes.map((prefix) => cache.delByPattern(`${prefix}*`)));
  },
};

/**
 * Cached data wrapper with metadata
 */
export interface CachedData<T> {
  data: T;
  cachedAt: number;
  ttl: number;
}

/**
 * Enhanced cache operations with type safety and metadata
 */
export const enhancedCache = {
  /**
   * Get cached data with metadata
   */
  async get<T>(key: string): Promise<CachedData<T> | null> {
    const cached = await cache.get<CachedData<T>>(key);
    if (!cached) {
      return null;
    }
    return cached;
  },

  /**
   * Set cached data with metadata
   */
  async set<T>(key: string, data: T, ttlSeconds: number): Promise<boolean> {
    const cachedData: CachedData<T> = {
      data,
      cachedAt: Date.now(),
      ttl: ttlSeconds,
    };
    return cache.set(key, cachedData, ttlSeconds);
  },

  /**
   * Get or fetch pattern with automatic caching
   * Returns the data directly (unwrapped from CachedData)
   */
  async getOrFetch<T>(key: string, fetcher: () => Promise<T>, ttlSeconds: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached) {
      return cached.data;
    }

    const fresh = await fetcher();
    await this.set(key, fresh, ttlSeconds);
    return fresh;
  },

  /**
   * Batch get multiple keys
   */
  async mget<T>(keys: string[]): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();

    if (keys.length === 0) {
      return results;
    }

    try {
      if (!redis) {
        keys.forEach((key) => results.set(key, null));
        return results;
      }
      const values = await redis.mget(...keys);
      keys.forEach((key, index) => {
        const value = values[index];
        if (value) {
          try {
            const parsed = JSON.parse(value) as CachedData<T>;
            results.set(key, parsed.data);
          } catch {
            results.set(key, null);
          }
        } else {
          results.set(key, null);
        }
      });
    } catch (error) {
      console.error("Batch cache get error:", error);
      keys.forEach((key) => results.set(key, null));
    }

    return results;
  },

  /**
   * Batch set multiple key-value pairs
   */
  async mset<T>(entries: Array<{ key: string; value: T; ttl: number }>): Promise<boolean> {
    if (entries.length === 0) {
      return true;
    }

    try {
      if (!redis) {
        return false;
      }
      const pipeline = redis.pipeline();

      for (const entry of entries) {
        const cachedData: CachedData<T> = {
          data: entry.value,
          cachedAt: Date.now(),
          ttl: entry.ttl,
        };
        pipeline.setex(entry.key, entry.ttl, JSON.stringify(cachedData));
      }

      await pipeline.exec();
      return true;
    } catch (error) {
      console.error("Batch cache set error:", error);
      return false;
    }
  },
};

/**
 * Cache warming utilities for preloading frequently accessed data
 */
export const cacheWarming = {
  /**
   * Warm politician profile cache
   */
  async warmPoliticianProfile(
    politicianId: string,
    fetcher: () => Promise<unknown>
  ): Promise<void> {
    const key = cacheKeyGenerators.politician(politicianId);
    const exists = await cache.exists(key);
    if (!exists) {
      const data = await fetcher();
      await enhancedCache.set(key, data, EXTENDED_CACHE_TTL.POLITICIAN_PROFILE);
    }
  },

  /**
   * Warm multiple politician profiles in batch
   */
  async warmPoliticianProfiles(
    politicianIds: string[],
    fetcher: (ids: string[]) => Promise<Map<string, unknown>>
  ): Promise<void> {
    const keys = politicianIds.map((id) => cacheKeyGenerators.politician(id));
    const cached = await enhancedCache.mget<unknown>(keys);

    const missingIds = politicianIds.filter((_id, index) => {
      const key = keys[index];
      return key ? !cached.get(key) : true;
    });

    if (missingIds.length > 0) {
      const freshData = await fetcher(missingIds);
      const entries = Array.from(freshData.entries()).map(([id, data]) => ({
        key: cacheKeyGenerators.politician(id),
        value: data,
        ttl: EXTENDED_CACHE_TTL.POLITICIAN_PROFILE,
      }));
      await enhancedCache.mset(entries);
    }
  },
};

/**
 * Cache statistics for monitoring
 */
export const cacheStats = {
  /**
   * Get cache hit/miss statistics
   */
  async getStats(): Promise<{
    totalKeys: number;
    memoryUsage: string;
    keysByPrefix: Record<string, number>;
  }> {
    try {
      if (!redis) {
        return {
          totalKeys: 0,
          memoryUsage: "unknown",
          keysByPrefix: {},
        };
      }
      const info = await redis.info("memory");
      const memoryMatch = info.match(/used_memory_human:(\S+)/);
      const memoryUsage: string = memoryMatch?.[1] ?? "unknown";

      const keysByPrefix: Record<string, number> = {};

      for (const [name, prefix] of Object.entries(EXTENDED_CACHE_KEYS)) {
        const keys = await redis.keys(`${prefix}*`);
        keysByPrefix[name] = keys.length;
      }

      const totalKeys = Object.values(keysByPrefix).reduce((a, b) => a + b, 0);

      return {
        totalKeys,
        memoryUsage,
        keysByPrefix,
      };
    } catch (error) {
      console.error("Cache stats error:", error);
      return {
        totalKeys: 0,
        memoryUsage: "unknown",
        keysByPrefix: {},
      };
    }
  },
};

export default {
  cache,
  enhancedCache,
  cacheKeyGenerators,
  cacheInvalidation,
  cacheWarming,
  cacheStats,
  EXTENDED_CACHE_KEYS,
  EXTENDED_CACHE_TTL,
};
