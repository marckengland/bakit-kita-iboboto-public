/**
 * API Key Service
 *
 * Handles API key authentication and management for the public REST API.
 *
 * **Validates: Requirements 34.1, 34.2, 34.4, 34.6**
 */

import { randomBytes, createHash } from "crypto";

// ============================================
// Types and Interfaces
// ============================================

export interface ApiKey {
  id: string;
  name: string;
  keyHash: string;
  userId: string;
  organizationName?: string;
  email: string;
  createdAt: Date;
  lastUsedAt?: Date;
  expiresAt?: Date;
  isActive: boolean;
  rateLimit: number; // requests per hour
  usageCount: number;
}

export interface ApiKeyCreateInput {
  name: string;
  userId: string;
  organizationName?: string;
  email: string;
  rateLimit?: number;
  expiresAt?: Date;
}

export interface ApiKeyValidationResult {
  valid: boolean;
  apiKey?: ApiKey;
  error?: string;
}

export interface ApiUsageLog {
  apiKeyId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTimeMs: number;
  timestamp: Date;
  ip: string;
  userAgent?: string;
}

export interface ApiRateLimitStatus {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  limit: number;
}

// ============================================
// Constants
// ============================================

const DEFAULT_RATE_LIMIT = 1000; // requests per hour
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// ============================================
// In-Memory Storage (use database in production)
// ============================================

const apiKeyStore = new Map<string, ApiKey>();
const apiKeyByHash = new Map<string, string>(); // hash -> id
const usageLogs: ApiUsageLog[] = [];
const rateLimitStore = new Map<string, { count: number; windowStart: Date }>();

// ============================================
// Helper Functions
// ============================================

/**
 * Generate a secure API key
 * Format: bkib_live_<32 random hex characters>
 */
export function generateApiKey(): { key: string; hash: string } {
  const randomPart = randomBytes(16).toString("hex");
  const key = `bkib_live_${randomPart}`;
  const hash = hashApiKey(key);
  return { key, hash };
}

/**
 * Hash an API key for secure storage
 */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return randomBytes(12).toString("hex");
}

// ============================================
// API Key Management
// ============================================

/**
 * Create a new API key
 * Validates: Requirement 34.2 - API key registration
 */
export function createApiKey(input: ApiKeyCreateInput): { apiKey: ApiKey; plainKey: string } {
  const { key, hash } = generateApiKey();
  const id = generateId();

  const apiKey: ApiKey = {
    id,
    name: input.name,
    keyHash: hash,
    userId: input.userId,
    organizationName: input.organizationName,
    email: input.email,
    createdAt: new Date(),
    isActive: true,
    rateLimit: input.rateLimit ?? DEFAULT_RATE_LIMIT,
    usageCount: 0,
    expiresAt: input.expiresAt,
  };

  apiKeyStore.set(id, apiKey);
  apiKeyByHash.set(hash, id);

  return { apiKey, plainKey: key };
}

/**
 * Validate an API key
 * Validates: Requirement 34.2 - API key authentication
 */
export function validateApiKey(key: string): ApiKeyValidationResult {
  if (!key) {
    return { valid: false, error: "API key is required" };
  }

  // Check format
  if (!key.startsWith("bkib_live_")) {
    return { valid: false, error: "Invalid API key format" };
  }

  const hash = hashApiKey(key);
  const apiKeyId = apiKeyByHash.get(hash);

  if (!apiKeyId) {
    return { valid: false, error: "Invalid API key" };
  }

  const apiKey = apiKeyStore.get(apiKeyId);

  if (!apiKey) {
    return { valid: false, error: "API key not found" };
  }

  if (!apiKey.isActive) {
    return { valid: false, error: "API key is inactive" };
  }

  if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
    return { valid: false, error: "API key has expired" };
  }

  // Update last used timestamp
  apiKey.lastUsedAt = new Date();
  apiKeyStore.set(apiKeyId, apiKey);

  return { valid: true, apiKey };
}

/**
 * Get API key by ID
 */
export function getApiKey(id: string): ApiKey | null {
  return apiKeyStore.get(id) ?? null;
}

/**
 * List API keys for a user
 */
export function listApiKeys(userId: string): ApiKey[] {
  return Array.from(apiKeyStore.values()).filter((key) => key.userId === userId);
}

/**
 * Revoke an API key
 */
export function revokeApiKey(id: string): boolean {
  const apiKey = apiKeyStore.get(id);
  if (!apiKey) {
    return false;
  }

  apiKey.isActive = false;
  apiKeyStore.set(id, apiKey);
  return true;
}

/**
 * Delete an API key
 */
export function deleteApiKey(id: string): boolean {
  const apiKey = apiKeyStore.get(id);
  if (!apiKey) {
    return false;
  }

  apiKeyByHash.delete(apiKey.keyHash);
  apiKeyStore.delete(id);
  return true;
}

// ============================================
// Rate Limiting
// ============================================

/**
 * Check rate limit for an API key
 * Validates: Requirement 34.4 - Rate limiting
 */
export function checkApiRateLimit(apiKeyId: string): ApiRateLimitStatus {
  const apiKey = apiKeyStore.get(apiKeyId);
  if (!apiKey) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(),
      limit: 0,
    };
  }

  const now = new Date();
  let entry = rateLimitStore.get(apiKeyId);

  // Reset window if expired
  if (!entry || now.getTime() - entry.windowStart.getTime() > RATE_LIMIT_WINDOW_MS) {
    entry = { count: 0, windowStart: now };
    rateLimitStore.set(apiKeyId, entry);
  }

  const remaining = Math.max(0, apiKey.rateLimit - entry.count);
  const resetAt = new Date(entry.windowStart.getTime() + RATE_LIMIT_WINDOW_MS);

  return {
    allowed: remaining > 0,
    remaining,
    resetAt,
    limit: apiKey.rateLimit,
  };
}

/**
 * Record an API request (increment rate limit counter)
 */
export function recordApiRequest(apiKeyId: string): void {
  const apiKey = apiKeyStore.get(apiKeyId);
  if (!apiKey) {
    return;
  }

  const now = new Date();
  let entry = rateLimitStore.get(apiKeyId);

  if (!entry || now.getTime() - entry.windowStart.getTime() > RATE_LIMIT_WINDOW_MS) {
    entry = { count: 1, windowStart: now };
  } else {
    entry.count++;
  }

  rateLimitStore.set(apiKeyId, entry);

  // Update usage count
  apiKey.usageCount++;
  apiKeyStore.set(apiKeyId, apiKey);
}

// ============================================
// Usage Logging
// ============================================

/**
 * Log API usage
 * Validates: Requirement 34.6 - Log usage for analytics
 */
export function logApiUsage(log: ApiUsageLog): void {
  usageLogs.push(log);

  // Keep only last 10000 logs in memory (use database in production)
  if (usageLogs.length > 10000) {
    usageLogs.shift();
  }
}

/**
 * Get usage logs for an API key
 */
export function getApiUsageLogs(apiKeyId: string, limit: number = 100): ApiUsageLog[] {
  return usageLogs.filter((log) => log.apiKeyId === apiKeyId).slice(-limit);
}

/**
 * Get usage statistics for an API key
 */
export function getApiUsageStats(apiKeyId: string): {
  totalRequests: number;
  requestsToday: number;
  requestsThisHour: number;
  averageResponseTime: number;
  endpointBreakdown: Record<string, number>;
} {
  const logs = usageLogs.filter((log) => log.apiKeyId === apiKeyId);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const requestsToday = logs.filter((log) => log.timestamp >= todayStart).length;
  const requestsThisHour = logs.filter((log) => log.timestamp >= hourAgo).length;

  const totalResponseTime = logs.reduce((sum, log) => sum + log.responseTimeMs, 0);
  const averageResponseTime = logs.length > 0 ? totalResponseTime / logs.length : 0;

  const endpointBreakdown: Record<string, number> = {};
  for (const log of logs) {
    endpointBreakdown[log.endpoint] = (endpointBreakdown[log.endpoint] ?? 0) + 1;
  }

  return {
    totalRequests: logs.length,
    requestsToday,
    requestsThisHour,
    averageResponseTime,
    endpointBreakdown,
  };
}

// ============================================
// Testing Utilities
// ============================================

/**
 * Clear all API keys (for testing)
 */
export function clearAllApiKeys(): void {
  apiKeyStore.clear();
  apiKeyByHash.clear();
  rateLimitStore.clear();
  usageLogs.length = 0;
}

/**
 * Seed a test API key (for testing)
 */
export function seedTestApiKey(key: string, options?: Partial<ApiKey>): ApiKey {
  const hash = hashApiKey(key);
  const id = generateId();

  const apiKey: ApiKey = {
    id,
    name: options?.name ?? "Test API Key",
    keyHash: hash,
    userId: options?.userId ?? "test-user",
    email: options?.email ?? "test@example.com",
    createdAt: new Date(),
    isActive: options?.isActive ?? true,
    rateLimit: options?.rateLimit ?? DEFAULT_RATE_LIMIT,
    usageCount: options?.usageCount ?? 0,
    ...options,
  };

  apiKeyStore.set(id, apiKey);
  apiKeyByHash.set(hash, id);

  return apiKey;
}
