/**
 * Cache Service Tests
 *
 * Tests for the comprehensive caching strategy implementation.
 * Validates: Requirements 44.3, 44.4
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  cacheKeyGenerators,
  cacheInvalidation,
  enhancedCache,
  EXTENDED_CACHE_KEYS,
  EXTENDED_CACHE_TTL,
} from "./cache-service";
import { cache } from "./redis";

// Mock Redis
vi.mock("./redis", () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
    mget: vi.fn(),
    pipeline: vi.fn(() => ({
      setex: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    })),
    exists: vi.fn(),
    ttl: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
    info: vi.fn(),
  },
  cache: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    delByPattern: vi.fn(),
    exists: vi.fn(),
    ttl: vi.fn(),
    incr: vi.fn(),
    getOrSet: vi.fn(),
  },
  CACHE_KEYS: {
    POLITICIAN: "politician:",
    POLITICIAN_LIST: "politician_list:",
    BILL: "bill:",
    SALN: "saln:",
    ELECTION: "election:",
    SEARCH: "search:",
    AUTOCOMPLETE: "autocomplete:",
    SESSION: "session:",
    RATE_LIMIT: "rate_limit:",
    USER: "user:",
  },
  CACHE_TTL: {
    SHORT: 60,
    MEDIUM: 300,
    LONG: 3600,
    DAY: 86400,
    SESSION: 604800,
  },
}));

describe("Cache Key Generators", () => {
  it("should generate politician cache key", () => {
    const key = cacheKeyGenerators.politician("pol-123");
    expect(key).toBe("politician:pol-123");
  });

  it("should generate politician list cache key with filters", () => {
    const key = cacheKeyGenerators.politicianList({ level: "national", party: "PDP" }, 1, 20);
    expect(key).toMatch(/^politician_list:/);
    expect(key).toContain(":1:20");
  });

  it("should generate bill cache key", () => {
    const key = cacheKeyGenerators.bill("bill-456");
    expect(key).toBe("bill_detail:bill-456");
  });

  it("should generate SALN history cache key", () => {
    const key = cacheKeyGenerators.salnHistory("pol-123");
    expect(key).toBe("saln_history:pol-123");
  });

  it("should generate comparison cache key with sorted IDs", () => {
    const key1 = cacheKeyGenerators.comparison(["pol-3", "pol-1", "pol-2"]);
    const key2 = cacheKeyGenerators.comparison(["pol-1", "pol-2", "pol-3"]);
    expect(key1).toBe(key2); // Should be the same regardless of order
    expect(key1).toContain("comparison:");
  });

  it("should generate search cache key with filters", () => {
    const key = cacheKeyGenerators.search("Juan", { level: "national" });
    expect(key).toMatch(/^search:Juan:/);
  });

  it("should generate autocomplete cache key", () => {
    const key = cacheKeyGenerators.autocomplete("Mar");
    expect(key).toBe("autocomplete:Mar");
  });
});

describe("Cache Invalidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cache.delByPattern).mockResolvedValue(0);
  });

  it("should invalidate all politician-related caches", async () => {
    await cacheInvalidation.invalidatePolitician("pol-123");

    // Should call delByPattern for multiple patterns
    expect(cache.delByPattern).toHaveBeenCalled();
    const calls = vi.mocked(cache.delByPattern).mock.calls;

    // Check that politician-specific patterns are invalidated
    const patterns = calls.map((call) => call[0]);
    expect(patterns.some((p) => p.includes("politician:pol-123"))).toBe(true);
    expect(patterns.some((p) => p.includes("politician_list:"))).toBe(true);
    expect(patterns.some((p) => p.includes("search:"))).toBe(true);
  });

  it("should invalidate bill caches including author caches", async () => {
    await cacheInvalidation.invalidateBill("bill-456", ["pol-1", "pol-2"]);

    const calls = vi.mocked(cache.delByPattern).mock.calls;
    const patterns = calls.map((call) => call[0]);

    expect(patterns.some((p) => p.includes("bill_detail:bill-456"))).toBe(true);
    expect(patterns.some((p) => p.includes("legislative_impact:pol-1"))).toBe(true);
    expect(patterns.some((p) => p.includes("legislative_impact:pol-2"))).toBe(true);
  });

  it("should invalidate SALN caches", async () => {
    await cacheInvalidation.invalidateSALN("pol-123");

    const calls = vi.mocked(cache.delByPattern).mock.calls;
    const patterns = calls.map((call) => call[0]);

    expect(patterns.some((p) => p.includes("saln_history:pol-123"))).toBe(true);
    expect(patterns.some((p) => p.includes("red_flags:pol-123"))).toBe(true);
  });

  it("should invalidate family network caches for all related politicians", async () => {
    await cacheInvalidation.invalidateFamilyNetwork(["pol-1", "pol-2", "pol-3"]);

    const calls = vi.mocked(cache.delByPattern).mock.calls;
    const patterns = calls.map((call) => call[0]);

    expect(patterns.some((p) => p.includes("family_network:pol-1"))).toBe(true);
    expect(patterns.some((p) => p.includes("family_network:pol-2"))).toBe(true);
    expect(patterns.some((p) => p.includes("family_network:pol-3"))).toBe(true);
  });

  it("should invalidate search caches", async () => {
    await cacheInvalidation.invalidateSearch();

    const calls = vi.mocked(cache.delByPattern).mock.calls;
    const patterns = calls.map((call) => call[0]);

    expect(patterns.some((p) => p.includes("search:"))).toBe(true);
    expect(patterns.some((p) => p.includes("autocomplete:"))).toBe(true);
  });
});

describe("Enhanced Cache Operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should get cached data with metadata", async () => {
    const cachedData = {
      data: { id: "pol-123", name: "Test Politician" },
      cachedAt: Date.now(),
      ttl: 1800,
    };
    vi.mocked(cache.get).mockResolvedValue(cachedData);

    const result = await enhancedCache.get("politician:pol-123");

    expect(result).toEqual(cachedData);
    expect(cache.get).toHaveBeenCalledWith("politician:pol-123");
  });

  it("should return null for cache miss", async () => {
    vi.mocked(cache.get).mockResolvedValue(null);

    const result = await enhancedCache.get("politician:nonexistent");

    expect(result).toBeNull();
  });

  it("should set cached data with metadata", async () => {
    vi.mocked(cache.set).mockResolvedValue(true);

    const data = { id: "pol-123", name: "Test Politician" };
    const result = await enhancedCache.set("politician:pol-123", data, 1800);

    expect(result).toBe(true);
    expect(cache.set).toHaveBeenCalledWith(
      "politician:pol-123",
      expect.objectContaining({
        data,
        ttl: 1800,
      }),
      1800
    );
  });

  it("should get or fetch data - cache hit", async () => {
    const cachedData = {
      data: { id: "pol-123", name: "Cached Politician" },
      cachedAt: Date.now(),
      ttl: 1800,
    };
    vi.mocked(cache.get).mockResolvedValue(cachedData);

    const fetcher = vi.fn().mockResolvedValue({ id: "pol-123", name: "Fresh Politician" });

    const result = await enhancedCache.getOrFetch("politician:pol-123", fetcher, 1800);

    expect(result).toEqual(cachedData.data);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("should get or fetch data - cache miss", async () => {
    vi.mocked(cache.get).mockResolvedValue(null);
    vi.mocked(cache.set).mockResolvedValue(true);

    const freshData = { id: "pol-123", name: "Fresh Politician" };
    const fetcher = vi.fn().mockResolvedValue(freshData);

    const result = await enhancedCache.getOrFetch("politician:pol-123", fetcher, 1800);

    expect(result).toEqual(freshData);
    expect(fetcher).toHaveBeenCalled();
    expect(cache.set).toHaveBeenCalled();
  });
});

describe("Cache TTL Values", () => {
  it("should have appropriate TTL for politician profiles", () => {
    expect(EXTENDED_CACHE_TTL.POLITICIAN_PROFILE).toBe(1800); // 30 minutes
  });

  it("should have appropriate TTL for bill data", () => {
    expect(EXTENDED_CACHE_TTL.BILL_DATA).toBe(3600); // 1 hour
  });

  it("should have appropriate TTL for SALN data", () => {
    expect(EXTENDED_CACHE_TTL.SALN_DATA).toBe(7200); // 2 hours
  });

  it("should have appropriate TTL for election data", () => {
    expect(EXTENDED_CACHE_TTL.ELECTION_DATA).toBe(86400); // 24 hours
  });

  it("should have appropriate TTL for family network", () => {
    expect(EXTENDED_CACHE_TTL.FAMILY_NETWORK).toBe(86400); // 24 hours
  });

  it("should have appropriate TTL for comparisons", () => {
    expect(EXTENDED_CACHE_TTL.COMPARISON).toBe(300); // 5 minutes
  });
});

describe("Cache Key Prefixes", () => {
  it("should have all required cache key prefixes", () => {
    expect(EXTENDED_CACHE_KEYS.POLITICIAN).toBeDefined();
    expect(EXTENDED_CACHE_KEYS.POLITICIAN_LIST).toBeDefined();
    expect(EXTENDED_CACHE_KEYS.BILL_DETAIL).toBeDefined();
    expect(EXTENDED_CACHE_KEYS.SALN_HISTORY).toBeDefined();
    expect(EXTENDED_CACHE_KEYS.SALN_RECORD).toBeDefined();
    expect(EXTENDED_CACHE_KEYS.VOTING_RECORD).toBeDefined();
    expect(EXTENDED_CACHE_KEYS.ATTENDANCE).toBeDefined();
    expect(EXTENDED_CACHE_KEYS.RED_FLAGS).toBeDefined();
    expect(EXTENDED_CACHE_KEYS.FAMILY_NETWORK).toBeDefined();
    expect(EXTENDED_CACHE_KEYS.TERM_LIMIT).toBeDefined();
    expect(EXTENDED_CACHE_KEYS.PROMISES).toBeDefined();
    expect(EXTENDED_CACHE_KEYS.PROJECTS).toBeDefined();
    expect(EXTENDED_CACHE_KEYS.CAMPAIGN_FINANCE).toBeDefined();
    expect(EXTENDED_CACHE_KEYS.COMPARISON).toBeDefined();
    expect(EXTENDED_CACHE_KEYS.LEGISLATIVE_IMPACT).toBeDefined();
    expect(EXTENDED_CACHE_KEYS.CONFLICT_INTEREST).toBeDefined();
  });
});
