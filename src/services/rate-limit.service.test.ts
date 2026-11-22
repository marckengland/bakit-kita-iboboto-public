/**
 * Unit Tests for Rate Limiting Service
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  getRateLimitKey,
  getRateLimitConfig,
  isWindowExpired,
  calculateRemaining,
  calculateResetTime,
  detectRapidFire,
  detectRepeatedQuery,
  checkRateLimit,
  recordRequest,
  getRateLimitStatus,
  clearRateLimit,
  clearAllRateLimits,
  RATE_LIMITS,
  RateLimitEntry,
} from "./rate-limit.service";

describe("Rate Limiting Service", () => {
  beforeEach(() => {
    clearAllRateLimits();
  });

  describe("getRateLimitKey", () => {
    it("should return user key for authenticated users", () => {
      const key = getRateLimitKey("user-123", "192.168.1.1");
      expect(key).toBe("user:user-123");
    });

    it("should return IP key for anonymous users", () => {
      const key = getRateLimitKey(null, "192.168.1.1");
      expect(key).toBe("ip:192.168.1.1");
    });
  });

  describe("getRateLimitConfig", () => {
    it("should return authenticated config for authenticated users", () => {
      const config = getRateLimitConfig(true);
      expect(config.maxRequests).toBe(RATE_LIMITS.authenticated.maxRequests);
    });

    it("should return anonymous config for anonymous users", () => {
      const config = getRateLimitConfig(false);
      expect(config.maxRequests).toBe(RATE_LIMITS.anonymous.maxRequests);
    });

    it("should have higher limits for authenticated users", () => {
      const authConfig = getRateLimitConfig(true);
      const anonConfig = getRateLimitConfig(false);
      expect(authConfig.maxRequests).toBeGreaterThan(anonConfig.maxRequests);
    });
  });

  describe("isWindowExpired", () => {
    it("should return false for fresh window", () => {
      const entry: RateLimitEntry = {
        count: 5,
        windowStart: new Date(),
        isBlocked: false,
        suspiciousPatternCount: 0,
      };
      expect(isWindowExpired(entry, 60000)).toBe(false);
    });

    it("should return true for expired window", () => {
      const entry: RateLimitEntry = {
        count: 5,
        windowStart: new Date(Date.now() - 120000),
        isBlocked: false,
        suspiciousPatternCount: 0,
      };
      expect(isWindowExpired(entry, 60000)).toBe(true);
    });
  });

  describe("calculateRemaining", () => {
    it("should return max requests for expired window", () => {
      const entry: RateLimitEntry = {
        count: 100,
        windowStart: new Date(Date.now() - 120000),
        isBlocked: false,
        suspiciousPatternCount: 0,
      };
      const config = { maxRequests: 50, windowMs: 60000 };
      expect(calculateRemaining(entry, config)).toBe(50);
    });

    it("should return remaining requests for active window", () => {
      const entry: RateLimitEntry = {
        count: 30,
        windowStart: new Date(),
        isBlocked: false,
        suspiciousPatternCount: 0,
      };
      const config = { maxRequests: 50, windowMs: 60000 };
      expect(calculateRemaining(entry, config)).toBe(20);
    });

    it("should return 0 when limit exceeded", () => {
      const entry: RateLimitEntry = {
        count: 60,
        windowStart: new Date(),
        isBlocked: false,
        suspiciousPatternCount: 0,
      };
      const config = { maxRequests: 50, windowMs: 60000 };
      expect(calculateRemaining(entry, config)).toBe(0);
    });
  });

  describe("calculateResetTime", () => {
    it("should return correct reset time", () => {
      const windowStart = new Date();
      const entry: RateLimitEntry = {
        count: 5,
        windowStart,
        isBlocked: false,
        suspiciousPatternCount: 0,
      };
      const config = { maxRequests: 50, windowMs: 60000 };
      const resetTime = calculateResetTime(entry, config);
      expect(resetTime.getTime()).toBe(windowStart.getTime() + 60000);
    });
  });

  describe("detectRapidFire", () => {
    it("should detect rapid-fire requests", () => {
      const now = Date.now();
      const history = Array.from({ length: 5 }, (_, i) => ({
        query: "test",
        timestamp: new Date(now + i * 100), // 100ms apart
      }));

      const pattern = detectRapidFire("test-key", history);
      expect(pattern).not.toBeNull();
      expect(pattern?.type).toBe("rapid_fire");
    });

    it("should not flag normal request patterns", () => {
      const now = Date.now();
      const history = Array.from({ length: 5 }, (_, i) => ({
        query: "test",
        timestamp: new Date(now + i * 5000), // 5 seconds apart
      }));

      const pattern = detectRapidFire("test-key", history);
      expect(pattern).toBeNull();
    });

    it("should return null for insufficient history", () => {
      const history = [{ query: "test", timestamp: new Date() }];
      const pattern = detectRapidFire("test-key", history);
      expect(pattern).toBeNull();
    });
  });

  describe("detectRepeatedQuery", () => {
    it("should detect repeated queries", () => {
      const history = [
        { query: "same query", timestamp: new Date() },
        { query: "same query", timestamp: new Date() },
        { query: "same query", timestamp: new Date() },
      ];

      const pattern = detectRepeatedQuery("same query", history);
      expect(pattern).not.toBeNull();
      expect(pattern?.type).toBe("repeated_query");
    });

    it("should not flag different queries", () => {
      const history = [
        { query: "query 1", timestamp: new Date() },
        { query: "query 2", timestamp: new Date() },
        { query: "query 3", timestamp: new Date() },
      ];

      const pattern = detectRepeatedQuery("query 4", history);
      expect(pattern).toBeNull();
    });

    it("should be case-insensitive", () => {
      const history = [
        { query: "Same Query", timestamp: new Date() },
        { query: "SAME QUERY", timestamp: new Date() },
        { query: "same query", timestamp: new Date() },
      ];

      const pattern = detectRepeatedQuery("SAME QUERY", history);
      expect(pattern).not.toBeNull();
    });
  });

  describe("checkRateLimit", () => {
    it("should allow requests within limit", () => {
      const status = checkRateLimit("user-1", "192.168.1.1", true);
      expect(status.allowed).toBe(true);
      expect(status.remaining).toBe(RATE_LIMITS.authenticated.maxRequests - 1);
    });

    it("should deny requests when limit exceeded", () => {
      // Exhaust the limit
      for (let i = 0; i < RATE_LIMITS.anonymous.maxRequests; i++) {
        recordRequest(null, "192.168.1.1", false);
      }

      const status = checkRateLimit(null, "192.168.1.1", false);
      expect(status.allowed).toBe(false);
      expect(status.remaining).toBe(0);
    });

    it("should have different limits for authenticated vs anonymous", () => {
      const authStatus = checkRateLimit("user-1", "192.168.1.1", true);
      const anonStatus = checkRateLimit(null, "192.168.1.2", false);

      expect(authStatus.remaining).toBeGreaterThan(anonStatus.remaining);
    });
  });

  describe("recordRequest", () => {
    it("should increment request count", () => {
      recordRequest("user-1", "192.168.1.1", true);
      recordRequest("user-1", "192.168.1.1", true);
      recordRequest("user-1", "192.168.1.1", true);

      const status = getRateLimitStatus("user-1", "192.168.1.1", true);
      expect(status.remaining).toBe(RATE_LIMITS.authenticated.maxRequests - 3);
    });

    it("should track queries for pattern detection", () => {
      recordRequest("user-1", "192.168.1.1", true, "test query");
      recordRequest("user-1", "192.168.1.1", true, "test query");
      recordRequest("user-1", "192.168.1.1", true, "test query");

      // Should have recorded the queries
      const status = getRateLimitStatus("user-1", "192.168.1.1", true);
      expect(status.remaining).toBe(RATE_LIMITS.authenticated.maxRequests - 3);
    });
  });

  describe("getRateLimitStatus", () => {
    it("should return full allowance for new users", () => {
      const status = getRateLimitStatus("new-user", "192.168.1.1", true);
      expect(status.allowed).toBe(true);
      expect(status.remaining).toBe(RATE_LIMITS.authenticated.maxRequests);
      expect(status.isBlocked).toBe(false);
    });

    it("should return correct remaining after requests", () => {
      recordRequest("user-1", "192.168.1.1", true);
      recordRequest("user-1", "192.168.1.1", true);

      const status = getRateLimitStatus("user-1", "192.168.1.1", true);
      expect(status.remaining).toBe(RATE_LIMITS.authenticated.maxRequests - 2);
    });
  });

  describe("clearRateLimit", () => {
    it("should clear rate limit for user", () => {
      recordRequest("user-1", "192.168.1.1", true);
      recordRequest("user-1", "192.168.1.1", true);

      clearRateLimit("user-1", "192.168.1.1");

      const status = getRateLimitStatus("user-1", "192.168.1.1", true);
      expect(status.remaining).toBe(RATE_LIMITS.authenticated.maxRequests);
    });
  });

  describe("Integration: Rate Limiting Flow", () => {
    it("should handle complete rate limiting flow", () => {
      const userId = "test-user";
      const ip = "192.168.1.1";

      // Check initial status
      let status = checkRateLimit(userId, ip, true);
      expect(status.allowed).toBe(true);

      // Make some requests
      for (let i = 0; i < 10; i++) {
        recordRequest(userId, ip, true);
      }

      // Check status after requests
      status = getRateLimitStatus(userId, ip, true);
      expect(status.remaining).toBe(RATE_LIMITS.authenticated.maxRequests - 10);

      // Clear and verify reset
      clearRateLimit(userId, ip);
      status = getRateLimitStatus(userId, ip, true);
      expect(status.remaining).toBe(RATE_LIMITS.authenticated.maxRequests);
    });
  });
});
