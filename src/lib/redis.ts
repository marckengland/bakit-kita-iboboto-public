import Redis from "ioredis";
import { logger } from "./logger";

// Global Redis instance for singleton pattern in development
const globalForRedis = globalThis as unknown as {
  redis: Redis | null | undefined;
  redisAvailable: boolean | undefined;
};

// Track if Redis is available
let redisAvailable = globalForRedis.redisAvailable ?? true;

/**
 * Redis client configuration for session and data caching
 * Uses singleton pattern to prevent multiple connections in development
 * Gracefully handles missing Redis server
 */
function createRedisClient(): Redis | null {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:56380";

  // Skip Redis in development if REDIS_DISABLED is set
  if (process.env.REDIS_DISABLED === "true") {
    logger.info("Redis disabled via REDIS_DISABLED env var");
    redisAvailable = false;
    return null;
  }

  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      if (times > 2) {
        // Stop retrying after 2 attempts
        redisAvailable = false;
        logger.info("Redis unavailable - caching disabled");
        return null;
      }
      return Math.min(times * 50, 500);
    },
    enableReadyCheck: true,
    lazyConnect: true,
    connectTimeout: 3000,
  });

  client.on("error", (error) => {
    if (redisAvailable) {
      const errorCode = (error as NodeJS.ErrnoException).code;
      console.error("Redis connection error:", errorCode || error.message);
      redisAvailable = false;
    }
  });

  client.on("connect", () => {
    redisAvailable = true;
    if (process.env.NODE_ENV === "development") {
      logger.info("Redis connected successfully");
    }
  });

  return client;
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
  globalForRedis.redisAvailable = redisAvailable;
}

// Cache key prefixes for organization
export const CACHE_KEYS = {
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
} as const;

// Default TTL values in seconds
export const CACHE_TTL = {
  SHORT: 60, // 1 minute - for frequently changing data
  MEDIUM: 300, // 5 minutes - for moderately changing data
  LONG: 3600, // 1 hour - for stable data
  DAY: 86400, // 24 hours - for rarely changing data
  SESSION: 604800, // 7 days - for user sessions
} as const;

/**
 * Cache utility functions for common operations
 * Gracefully handles missing Redis connection
 */
export const cache = {
  /**
   * Check if Redis is available
   */
  isAvailable(): boolean {
    return redisAvailable && redis !== null;
  },

  /**
   * Get a cached value by key
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isAvailable()) {
      return null;
    }
    try {
      const data = await redis!.get(key);
      if (!data) {
        return null;
      }
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  },

  /**
   * Set a cached value with optional TTL
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await redis!.setex(key, ttlSeconds, serialized);
      } else {
        await redis!.set(key, serialized);
      }
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Delete a cached value by key
   */
  async del(key: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }
    try {
      await redis!.del(key);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Delete multiple cached values by pattern
   */
  async delByPattern(pattern: string): Promise<number> {
    if (!this.isAvailable()) {
      return 0;
    }
    try {
      const keys = await redis!.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }
      return await redis!.del(...keys);
    } catch {
      return 0;
    }
  },

  /**
   * Check if a key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }
    try {
      const result = await redis!.exists(key);
      return result === 1;
    } catch {
      return false;
    }
  },

  /**
   * Get remaining TTL for a key in seconds
   */
  async ttl(key: string): Promise<number> {
    if (!this.isAvailable()) {
      return -1;
    }
    try {
      return await redis!.ttl(key);
    } catch {
      return -1;
    }
  },

  /**
   * Increment a counter (useful for rate limiting)
   */
  async incr(key: string, ttlSeconds?: number): Promise<number> {
    if (!this.isAvailable()) {
      return 0;
    }
    try {
      const count = await redis!.incr(key);
      if (ttlSeconds && count === 1) {
        await redis!.expire(key, ttlSeconds);
      }
      return count;
    } catch {
      return 0;
    }
  },

  /**
   * Get or set pattern - returns cached value or fetches and caches new value
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T | null> {
    try {
      if (this.isAvailable()) {
        const cached = await this.get<T>(key);
        if (cached !== null) {
          return cached;
        }
      }

      const fresh = await fetcher();
      if (this.isAvailable()) {
        await this.set(key, fresh, ttlSeconds);
      }
      return fresh;
    } catch {
      // If cache fails, try fetcher directly
      try {
        return await fetcher();
      } catch {
        return null;
      }
    }
  },

  /**
   * Invalidate politician-related caches
   */
  async invalidatePolitician(politicianId: string): Promise<void> {
    await this.delByPattern(`${CACHE_KEYS.POLITICIAN}${politicianId}*`);
    await this.delByPattern(`${CACHE_KEYS.POLITICIAN_LIST}*`);
    await this.delByPattern(`${CACHE_KEYS.SEARCH}*`);
    await this.delByPattern(`${CACHE_KEYS.AUTOCOMPLETE}*`);
  },

  /**
   * Invalidate all search-related caches
   */
  async invalidateSearch(): Promise<void> {
    await this.delByPattern(`${CACHE_KEYS.SEARCH}*`);
    await this.delByPattern(`${CACHE_KEYS.AUTOCOMPLETE}*`);
  },
};

export default redis;
