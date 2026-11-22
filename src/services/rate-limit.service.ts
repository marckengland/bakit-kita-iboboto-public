/**
 * Rate Limiting Service
 *
 * Handles rate limiting for AI chatbot and other API endpoints.
 *
 * **Validates: Requirements 37.1, 37.2, 37.3, 37.4, 37.5, 37.6**
 */

// ============================================
// Types and Interfaces
// ============================================

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  blockDurationMs?: number;
}

export interface RateLimitStatus {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  isBlocked: boolean;
  blockedUntil?: Date;
}

export interface RateLimitEntry {
  count: number;
  windowStart: Date;
  isBlocked: boolean;
  blockedUntil?: Date;
  suspiciousPatternCount: number;
}

export interface SuspiciousPattern {
  type: "rapid_fire" | "repeated_query" | "abuse_attempt";
  timestamp: Date;
  details: string;
}

// ============================================
// Constants
// ============================================

// Rate limits for different user types
export const RATE_LIMITS = {
  authenticated: {
    maxRequests: 100,
    windowMs: 60 * 60 * 1000, // 1 hour
    blockDurationMs: 30 * 60 * 1000, // 30 minutes
  },
  anonymous: {
    maxRequests: 20,
    windowMs: 60 * 60 * 1000, // 1 hour
    blockDurationMs: 60 * 60 * 1000, // 1 hour
  },
} as const satisfies Record<string, RateLimitConfig>;

// Thresholds for suspicious pattern detection
export const SUSPICIOUS_THRESHOLDS = {
  rapidFireMs: 1000, // Requests faster than 1 second apart
  rapidFireCount: 5, // Number of rapid requests to trigger alert
  repeatedQueryCount: 3, // Same query repeated this many times
  maxSuspiciousPatterns: 3, // Patterns before blocking
};

// ============================================
// In-Memory Rate Limit Store (use Redis in production)
// ============================================

const rateLimitStore = new Map<string, RateLimitEntry>();
const queryHistory = new Map<string, { query: string; timestamp: Date }[]>();
const suspiciousPatterns = new Map<string, SuspiciousPattern[]>();

// ============================================
// Helper Functions
// ============================================

/**
 * Get rate limit key for a user
 */
export function getRateLimitKey(userId: string | null, ip: string): string {
  return userId ? `user:${userId}` : `ip:${ip}`;
}

/**
 * Get rate limit config based on authentication status
 */
export function getRateLimitConfig(isAuthenticated: boolean): RateLimitConfig {
  const config = isAuthenticated ? RATE_LIMITS.authenticated : RATE_LIMITS.anonymous;
  if (!config) {
    // Fallback to anonymous limits if config is undefined
    return {
      maxRequests: 20,
      windowMs: 60 * 60 * 1000,
      blockDurationMs: 60 * 60 * 1000,
    };
  }
  return config;
}

/**
 * Check if window has expired
 */
export function isWindowExpired(entry: RateLimitEntry, windowMs: number): boolean {
  const now = new Date();
  return now.getTime() - entry.windowStart.getTime() > windowMs;
}

/**
 * Calculate remaining requests
 */
export function calculateRemaining(entry: RateLimitEntry, config: RateLimitConfig): number {
  if (isWindowExpired(entry, config.windowMs)) {
    return config.maxRequests;
  }
  return Math.max(0, config.maxRequests - entry.count);
}

/**
 * Calculate reset time
 */
export function calculateResetTime(entry: RateLimitEntry, config: RateLimitConfig): Date {
  return new Date(entry.windowStart.getTime() + config.windowMs);
}

// ============================================
// Suspicious Pattern Detection
// ============================================

/**
 * Detect rapid-fire requests
 */
export function detectRapidFire(
  _key: string,
  history: { query: string; timestamp: Date }[]
): SuspiciousPattern | null {
  if (history.length < SUSPICIOUS_THRESHOLDS.rapidFireCount) {
    return null;
  }

  const recentRequests = history.slice(-SUSPICIOUS_THRESHOLDS.rapidFireCount);
  let rapidCount = 0;

  for (let i = 1; i < recentRequests.length; i++) {
    const current = recentRequests[i];
    const previous = recentRequests[i - 1];
    if (!current || !previous) {
      continue;
    }
    const timeDiff = current.timestamp.getTime() - previous.timestamp.getTime();
    if (timeDiff < SUSPICIOUS_THRESHOLDS.rapidFireMs) {
      rapidCount++;
    }
  }

  if (rapidCount >= SUSPICIOUS_THRESHOLDS.rapidFireCount - 1) {
    return {
      type: "rapid_fire",
      timestamp: new Date(),
      details: `${rapidCount + 1} requests within ${SUSPICIOUS_THRESHOLDS.rapidFireMs}ms intervals`,
    };
  }

  return null;
}

/**
 * Detect repeated queries
 */
export function detectRepeatedQuery(
  query: string,
  history: { query: string; timestamp: Date }[]
): SuspiciousPattern | null {
  const normalizedQuery = query.toLowerCase().trim();
  const recentSameQueries = history.filter((h) => h.query.toLowerCase().trim() === normalizedQuery);

  if (recentSameQueries.length >= SUSPICIOUS_THRESHOLDS.repeatedQueryCount) {
    return {
      type: "repeated_query",
      timestamp: new Date(),
      details: `Query "${query.substring(0, 50)}..." repeated ${recentSameQueries.length} times`,
    };
  }

  return null;
}

/**
 * Record suspicious pattern
 */
export function recordSuspiciousPattern(key: string, pattern: SuspiciousPattern): void {
  const patterns = suspiciousPatterns.get(key) || [];
  patterns.push(pattern);
  suspiciousPatterns.set(key, patterns);
}

/**
 * Check if user should be blocked due to suspicious patterns
 */
export function shouldBlockForSuspiciousActivity(key: string): boolean {
  const patterns = suspiciousPatterns.get(key) || [];
  // Only count recent patterns (last hour)
  const recentPatterns = patterns.filter(
    (p) => new Date().getTime() - p.timestamp.getTime() < 60 * 60 * 1000
  );
  return recentPatterns.length >= SUSPICIOUS_THRESHOLDS.maxSuspiciousPatterns;
}

// ============================================
// Core Rate Limiting Functions
// ============================================

/**
 * Check rate limit for a request
 */
export function checkRateLimit(
  userId: string | null,
  ip: string,
  isAuthenticated: boolean
): RateLimitStatus {
  const key = getRateLimitKey(userId, ip);
  const config = getRateLimitConfig(isAuthenticated);
  const now = new Date();

  let entry = rateLimitStore.get(key);

  // Check if blocked
  if (entry?.isBlocked && entry.blockedUntil) {
    if (now < entry.blockedUntil) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.blockedUntil,
        isBlocked: true,
        blockedUntil: entry.blockedUntil,
      };
    } else {
      // Unblock
      entry.isBlocked = false;
      entry.blockedUntil = undefined;
    }
  }

  // Check for suspicious activity block
  if (shouldBlockForSuspiciousActivity(key)) {
    const blockedUntil = new Date(now.getTime() + (config.blockDurationMs || 0));
    if (entry) {
      entry.isBlocked = true;
      entry.blockedUntil = blockedUntil;
    } else {
      entry = {
        count: 0,
        windowStart: now,
        isBlocked: true,
        blockedUntil,
        suspiciousPatternCount: SUSPICIOUS_THRESHOLDS.maxSuspiciousPatterns,
      };
      rateLimitStore.set(key, entry);
    }
    return {
      allowed: false,
      remaining: 0,
      resetAt: blockedUntil,
      isBlocked: true,
      blockedUntil,
    };
  }

  // Initialize or reset entry if window expired
  if (!entry || isWindowExpired(entry, config.windowMs)) {
    entry = {
      count: 0,
      windowStart: now,
      isBlocked: false,
      suspiciousPatternCount: 0,
    };
    rateLimitStore.set(key, entry);
  }

  const remaining = calculateRemaining(entry, config);
  const resetAt = calculateResetTime(entry, config);

  if (remaining <= 0) {
    return {
      allowed: false,
      remaining: 0,
      resetAt,
      isBlocked: false,
    };
  }

  return {
    allowed: true,
    remaining: remaining - 1, // Account for current request
    resetAt,
    isBlocked: false,
  };
}

/**
 * Record a request (increment counter)
 */
export function recordRequest(
  userId: string | null,
  ip: string,
  isAuthenticated: boolean,
  query?: string
): void {
  const key = getRateLimitKey(userId, ip);
  const config = getRateLimitConfig(isAuthenticated);
  const now = new Date();

  let entry = rateLimitStore.get(key);

  if (!entry || isWindowExpired(entry, config.windowMs)) {
    entry = {
      count: 1,
      windowStart: now,
      isBlocked: false,
      suspiciousPatternCount: 0,
    };
  } else {
    entry.count++;
  }

  rateLimitStore.set(key, entry);

  // Record query for pattern detection
  if (query) {
    const history = queryHistory.get(key) || [];
    history.push({ query, timestamp: now });
    // Keep only last 20 queries
    if (history.length > 20) {
      history.shift();
    }
    queryHistory.set(key, history);

    // Check for suspicious patterns
    const rapidFire = detectRapidFire(key, history);
    if (rapidFire) {
      recordSuspiciousPattern(key, rapidFire);
    }

    const repeated = detectRepeatedQuery(query, history);
    if (repeated) {
      recordSuspiciousPattern(key, repeated);
    }
  }
}

/**
 * Get current rate limit status
 */
export function getRateLimitStatus(
  userId: string | null,
  ip: string,
  isAuthenticated: boolean
): RateLimitStatus {
  const key = getRateLimitKey(userId, ip);
  const config = getRateLimitConfig(isAuthenticated);
  const now = new Date();

  const entry = rateLimitStore.get(key);

  if (!entry) {
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetAt: new Date(now.getTime() + config.windowMs),
      isBlocked: false,
    };
  }

  if (entry.isBlocked && entry.blockedUntil && now < entry.blockedUntil) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.blockedUntil,
      isBlocked: true,
      blockedUntil: entry.blockedUntil,
    };
  }

  const remaining = calculateRemaining(entry, config);
  const resetAt = calculateResetTime(entry, config);

  return {
    allowed: remaining > 0,
    remaining,
    resetAt,
    isBlocked: false,
  };
}

/**
 * Get suspicious patterns for a user
 */
export function getSuspiciousPatterns(userId: string | null, ip: string): SuspiciousPattern[] {
  const key = getRateLimitKey(userId, ip);
  return suspiciousPatterns.get(key) || [];
}

/**
 * Clear rate limit for a user (admin function)
 */
export function clearRateLimit(userId: string | null, ip: string): void {
  const key = getRateLimitKey(userId, ip);
  rateLimitStore.delete(key);
  queryHistory.delete(key);
  suspiciousPatterns.delete(key);
}

/**
 * Clear all rate limits (for testing)
 */
export function clearAllRateLimits(): void {
  rateLimitStore.clear();
  queryHistory.clear();
  suspiciousPatterns.clear();
}
