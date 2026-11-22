/**
 * Property-Based Tests for Rate Limiting Service
 *
 * **Property 18: Rate Limiting Enforcement**
 * *For any* user making AI chatbot requests:
 * - Requests within the rate limit must succeed
 * - Requests exceeding the rate limit must be rejected with appropriate error
 * - Authenticated users must have higher rate limits than anonymous users
 * - Rate limit status must accurately reflect remaining allowance
 *
 * **Validates: Requirements 37.1, 37.2, 37.3**
 */

import { describe, it, expect, beforeEach } from "vitest";
import fc from "fast-check";
import {
  getRateLimitKey,
  getRateLimitConfig,
  isWindowExpired,
  calculateRemaining,
  checkRateLimit,
  recordRequest,
  getRateLimitStatus,
  clearAllRateLimits,
  RATE_LIMITS,
  RateLimitEntry,
} from "./rate-limit.service";

const NUM_RUNS = 100;

// ============================================
// Arbitraries for Property-Based Testing
// ============================================

const arbitraryUserId = (): fc.Arbitrary<string> => fc.uuid().map((id) => `user-${id}`);

const arbitraryIpAddress = (): fc.Arbitrary<string> =>
  fc
    .tuple(
      fc.integer({ min: 1, max: 255 }),
      fc.integer({ min: 0, max: 255 }),
      fc.integer({ min: 0, max: 255 }),
      fc.integer({ min: 1, max: 254 })
    )
    .map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

const arbitraryWindowMs = (): fc.Arbitrary<number> => fc.integer({ min: 1000, max: 3600000 });

// ============================================
// Property Tests
// ============================================

describe("Rate Limiting Enforcement - Property 18", () => {
  beforeEach(() => {
    clearAllRateLimits();
  });

  /**
   * **Validates: Requirement 37.1**
   * Requests within the rate limit must succeed
   */
  describe("Property 18.1: Requests Within Limit Succeed", () => {
    it("should allow all requests within limit for authenticated users", () => {
      fc.assert(
        fc.property(
          arbitraryUserId(),
          arbitraryIpAddress(),
          fc.integer({ min: 1, max: RATE_LIMITS.authenticated.maxRequests - 1 }),
          (userId, ip, requestCount) => {
            clearAllRateLimits();

            // Make requests
            for (let i = 0; i < requestCount; i++) {
              recordRequest(userId, ip, true);
            }

            // Check status
            const status = checkRateLimit(userId, ip, true);
            expect(status.allowed).toBe(true);
            expect(status.remaining).toBeGreaterThanOrEqual(0);

            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should allow all requests within limit for anonymous users", () => {
      fc.assert(
        fc.property(
          arbitraryIpAddress(),
          fc.integer({ min: 1, max: RATE_LIMITS.anonymous.maxRequests - 1 }),
          (ip, requestCount) => {
            clearAllRateLimits();

            // Make requests
            for (let i = 0; i < requestCount; i++) {
              recordRequest(null, ip, false);
            }

            // Check status
            const status = checkRateLimit(null, ip, false);
            expect(status.allowed).toBe(true);

            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirement 37.2**
   * Requests exceeding the rate limit must be rejected
   */
  describe("Property 18.2: Requests Exceeding Limit Rejected", () => {
    it("should reject requests after limit exceeded for authenticated users", () => {
      fc.assert(
        fc.property(
          arbitraryUserId(),
          arbitraryIpAddress(),
          fc.integer({ min: 1, max: 50 }),
          (userId, ip, _extraRequests) => {
            clearAllRateLimits();

            // Exhaust the limit
            for (let i = 0; i < RATE_LIMITS.authenticated.maxRequests; i++) {
              recordRequest(userId, ip, true);
            }

            // Check that further requests are rejected
            const status = checkRateLimit(userId, ip, true);
            expect(status.allowed).toBe(false);
            expect(status.remaining).toBe(0);

            return true;
          }
        ),
        { numRuns: Math.min(NUM_RUNS, 20) } // Reduced for performance
      );
    });

    it("should reject requests after limit exceeded for anonymous users", () => {
      fc.assert(
        fc.property(arbitraryIpAddress(), fc.integer({ min: 1, max: 20 }), (ip, _extraRequests) => {
          clearAllRateLimits();

          // Exhaust the limit
          for (let i = 0; i < RATE_LIMITS.anonymous.maxRequests; i++) {
            recordRequest(null, ip, false);
          }

          // Check that further requests are rejected
          const status = checkRateLimit(null, ip, false);
          expect(status.allowed).toBe(false);
          expect(status.remaining).toBe(0);

          return true;
        }),
        { numRuns: Math.min(NUM_RUNS, 20) }
      );
    });
  });

  /**
   * **Validates: Requirement 37.3**
   * Authenticated users must have higher rate limits than anonymous users
   */
  describe("Property 18.3: Authenticated Users Have Higher Limits", () => {
    it("should always have higher limits for authenticated users", () => {
      fc.assert(
        fc.property(fc.boolean(), (_isAuthenticated) => {
          const authConfig = getRateLimitConfig(true);
          const anonConfig = getRateLimitConfig(false);

          expect(authConfig.maxRequests).toBeGreaterThan(anonConfig.maxRequests);

          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should reflect higher limits in status for authenticated users", () => {
      fc.assert(
        fc.property(arbitraryUserId(), arbitraryIpAddress(), (userId, ip) => {
          clearAllRateLimits();

          const authStatus = getRateLimitStatus(userId, ip, true);
          const anonStatus = getRateLimitStatus(null, ip, false);

          expect(authStatus.remaining).toBeGreaterThan(anonStatus.remaining);

          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirement 37.1, 37.2**
   * Rate limit status must accurately reflect remaining allowance
   */
  describe("Property 18.4: Accurate Remaining Allowance", () => {
    it("should accurately track remaining requests", () => {
      fc.assert(
        fc.property(
          arbitraryUserId(),
          arbitraryIpAddress(),
          fc.integer({ min: 1, max: 50 }),
          (userId, ip, requestCount) => {
            clearAllRateLimits();

            const initialStatus = getRateLimitStatus(userId, ip, true);
            const initialRemaining = initialStatus.remaining;

            // Make requests
            for (let i = 0; i < requestCount; i++) {
              recordRequest(userId, ip, true);
            }

            const finalStatus = getRateLimitStatus(userId, ip, true);
            expect(finalStatus.remaining).toBe(initialRemaining - requestCount);

            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should never have negative remaining", () => {
      fc.assert(
        fc.property(
          arbitraryUserId(),
          arbitraryIpAddress(),
          fc.integer({ min: 1, max: 200 }),
          (userId, ip, requestCount) => {
            clearAllRateLimits();

            // Make many requests
            for (let i = 0; i < requestCount; i++) {
              recordRequest(userId, ip, true);
            }

            const status = getRateLimitStatus(userId, ip, true);
            expect(status.remaining).toBeGreaterThanOrEqual(0);

            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * Additional property tests for rate limit key generation
   */
  describe("Property 18.5: Rate Limit Key Consistency", () => {
    it("should generate consistent keys for same user", () => {
      fc.assert(
        fc.property(arbitraryUserId(), arbitraryIpAddress(), (userId, ip) => {
          const key1 = getRateLimitKey(userId, ip);
          const key2 = getRateLimitKey(userId, ip);
          expect(key1).toBe(key2);
          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should generate different keys for different users", () => {
      fc.assert(
        fc.property(
          arbitraryUserId(),
          arbitraryUserId(),
          arbitraryIpAddress(),
          (userId1, userId2, ip) => {
            fc.pre(userId1 !== userId2);
            const key1 = getRateLimitKey(userId1, ip);
            const key2 = getRateLimitKey(userId2, ip);
            expect(key1).not.toBe(key2);
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should use IP for anonymous users", () => {
      fc.assert(
        fc.property(arbitraryIpAddress(), (ip) => {
          const key = getRateLimitKey(null, ip);
          expect(key).toContain(ip);
          expect(key.startsWith("ip:")).toBe(true);
          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * Property tests for window expiration
   */
  describe("Property 18.6: Window Expiration", () => {
    it("should correctly identify expired windows", () => {
      fc.assert(
        fc.property(
          arbitraryWindowMs(),
          fc.integer({ min: 1, max: 10000 }),
          (windowMs, extraMs) => {
            const entry: RateLimitEntry = {
              count: 10,
              windowStart: new Date(Date.now() - windowMs - extraMs),
              isBlocked: false,
              suspiciousPatternCount: 0,
            };

            expect(isWindowExpired(entry, windowMs)).toBe(true);
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should correctly identify non-expired windows", () => {
      fc.assert(
        fc.property(
          arbitraryWindowMs(),
          fc.integer({ min: 0, max: 1000 }),
          (windowMs, elapsedMs) => {
            fc.pre(elapsedMs < windowMs);

            const entry: RateLimitEntry = {
              count: 10,
              windowStart: new Date(Date.now() - elapsedMs),
              isBlocked: false,
              suspiciousPatternCount: 0,
            };

            expect(isWindowExpired(entry, windowMs)).toBe(false);
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * Property tests for remaining calculation
   */
  describe("Property 18.7: Remaining Calculation", () => {
    it("should calculate remaining correctly", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 0, max: 100 }),
          (maxRequests, count) => {
            const entry: RateLimitEntry = {
              count,
              windowStart: new Date(),
              isBlocked: false,
              suspiciousPatternCount: 0,
            };
            const config = { maxRequests, windowMs: 60000 };

            const remaining = calculateRemaining(entry, config);
            expect(remaining).toBe(Math.max(0, maxRequests - count));

            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});
