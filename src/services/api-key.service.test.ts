/**
 * API Key Service Tests
 *
 * Tests for API key authentication and rate limiting.
 *
 * **Validates: Requirements 34.2, 34.4, 34.6**
 */

import {
  createApiKey,
  validateApiKey,
  getApiKey,
  listApiKeys,
  revokeApiKey,
  deleteApiKey,
  checkApiRateLimit,
  recordApiRequest,
  logApiUsage,
  getApiUsageLogs,
  getApiUsageStats,
  clearAllApiKeys,
  seedTestApiKey,
  hashApiKey,
  generateApiKey,
} from "./api-key.service";

describe("API Key Service", () => {
  beforeEach(() => {
    clearAllApiKeys();
  });

  describe("generateApiKey", () => {
    it("should generate a key with correct format", () => {
      const { key, hash } = generateApiKey();

      expect(key).toMatch(/^bkib_live_[a-f0-9]{32}$/);
      expect(hash).toHaveLength(64); // SHA-256 hex
    });

    it("should generate unique keys", () => {
      const keys = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const { key } = generateApiKey();
        keys.add(key);
      }
      expect(keys.size).toBe(100);
    });
  });

  describe("hashApiKey", () => {
    it("should produce consistent hashes", () => {
      const key = "bkib_live_test123";
      const hash1 = hashApiKey(key);
      const hash2 = hashApiKey(key);

      expect(hash1).toBe(hash2);
    });

    it("should produce different hashes for different keys", () => {
      const hash1 = hashApiKey("bkib_live_key1");
      const hash2 = hashApiKey("bkib_live_key2");

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("createApiKey", () => {
    it("should create an API key with correct properties", () => {
      const { apiKey, plainKey } = createApiKey({
        name: "Test Key",
        userId: "user-123",
        email: "test@example.com",
        organizationName: "Test Org",
      });

      expect(apiKey.name).toBe("Test Key");
      expect(apiKey.userId).toBe("user-123");
      expect(apiKey.email).toBe("test@example.com");
      expect(apiKey.organizationName).toBe("Test Org");
      expect(apiKey.isActive).toBe(true);
      expect(apiKey.rateLimit).toBe(1000);
      expect(apiKey.usageCount).toBe(0);
      expect(plainKey).toMatch(/^bkib_live_/);
    });

    it("should allow custom rate limit", () => {
      const { apiKey } = createApiKey({
        name: "High Volume Key",
        userId: "user-123",
        email: "test@example.com",
        rateLimit: 5000,
      });

      expect(apiKey.rateLimit).toBe(5000);
    });

    it("should allow expiration date", () => {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const { apiKey } = createApiKey({
        name: "Expiring Key",
        userId: "user-123",
        email: "test@example.com",
        expiresAt,
      });

      expect(apiKey.expiresAt).toEqual(expiresAt);
    });
  });

  describe("validateApiKey", () => {
    it("should validate a valid API key", () => {
      const { plainKey } = createApiKey({
        name: "Test Key",
        userId: "user-123",
        email: "test@example.com",
      });

      const result = validateApiKey(plainKey);

      expect(result.valid).toBe(true);
      expect(result.apiKey).toBeDefined();
      expect(result.apiKey?.name).toBe("Test Key");
    });

    it("should reject empty API key", () => {
      const result = validateApiKey("");

      expect(result.valid).toBe(false);
      expect(result.error).toBe("API key is required");
    });

    it("should reject invalid format", () => {
      const result = validateApiKey("invalid_key_format");

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid API key format");
    });

    it("should reject non-existent API key", () => {
      const result = validateApiKey("bkib_live_nonexistent12345678901234");

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid API key");
    });

    it("should reject inactive API key", () => {
      const { apiKey, plainKey } = createApiKey({
        name: "Test Key",
        userId: "user-123",
        email: "test@example.com",
      });

      revokeApiKey(apiKey.id);

      const result = validateApiKey(plainKey);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("API key is inactive");
    });

    it("should reject expired API key", () => {
      const expiredDate = new Date(Date.now() - 1000);
      seedTestApiKey("bkib_live_expired1234567890123456", {
        expiresAt: expiredDate,
      });

      const result = validateApiKey("bkib_live_expired1234567890123456");

      expect(result.valid).toBe(false);
      expect(result.error).toBe("API key has expired");
    });

    it("should update lastUsedAt on successful validation", () => {
      const { apiKey, plainKey } = createApiKey({
        name: "Test Key",
        userId: "user-123",
        email: "test@example.com",
      });

      expect(apiKey.lastUsedAt).toBeUndefined();

      validateApiKey(plainKey);

      const updatedKey = getApiKey(apiKey.id);
      expect(updatedKey?.lastUsedAt).toBeDefined();
    });
  });

  describe("getApiKey", () => {
    it("should return API key by ID", () => {
      const { apiKey } = createApiKey({
        name: "Test Key",
        userId: "user-123",
        email: "test@example.com",
      });

      const retrieved = getApiKey(apiKey.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(apiKey.id);
    });

    it("should return null for non-existent ID", () => {
      const retrieved = getApiKey("non-existent-id");

      expect(retrieved).toBeNull();
    });
  });

  describe("listApiKeys", () => {
    it("should list API keys for a user", () => {
      createApiKey({ name: "Key 1", userId: "user-1", email: "test@example.com" });
      createApiKey({ name: "Key 2", userId: "user-1", email: "test@example.com" });
      createApiKey({ name: "Key 3", userId: "user-2", email: "test@example.com" });

      const user1Keys = listApiKeys("user-1");
      const user2Keys = listApiKeys("user-2");

      expect(user1Keys).toHaveLength(2);
      expect(user2Keys).toHaveLength(1);
    });

    it("should return empty array for user with no keys", () => {
      const keys = listApiKeys("non-existent-user");

      expect(keys).toHaveLength(0);
    });
  });

  describe("revokeApiKey", () => {
    it("should revoke an API key", () => {
      const { apiKey } = createApiKey({
        name: "Test Key",
        userId: "user-123",
        email: "test@example.com",
      });

      const result = revokeApiKey(apiKey.id);

      expect(result).toBe(true);
      expect(getApiKey(apiKey.id)?.isActive).toBe(false);
    });

    it("should return false for non-existent key", () => {
      const result = revokeApiKey("non-existent-id");

      expect(result).toBe(false);
    });
  });

  describe("deleteApiKey", () => {
    it("should delete an API key", () => {
      const { apiKey } = createApiKey({
        name: "Test Key",
        userId: "user-123",
        email: "test@example.com",
      });

      const result = deleteApiKey(apiKey.id);

      expect(result).toBe(true);
      expect(getApiKey(apiKey.id)).toBeNull();
    });

    it("should return false for non-existent key", () => {
      const result = deleteApiKey("non-existent-id");

      expect(result).toBe(false);
    });
  });

  describe("Rate Limiting", () => {
    it("should allow requests within rate limit", () => {
      const { apiKey } = createApiKey({
        name: "Test Key",
        userId: "user-123",
        email: "test@example.com",
        rateLimit: 100,
      });

      const status = checkApiRateLimit(apiKey.id);

      expect(status.allowed).toBe(true);
      expect(status.remaining).toBe(100);
      expect(status.limit).toBe(100);
    });

    it("should decrement remaining count after recording request", () => {
      const { apiKey } = createApiKey({
        name: "Test Key",
        userId: "user-123",
        email: "test@example.com",
        rateLimit: 100,
      });

      recordApiRequest(apiKey.id);
      recordApiRequest(apiKey.id);
      recordApiRequest(apiKey.id);

      const status = checkApiRateLimit(apiKey.id);

      expect(status.remaining).toBe(97);
    });

    it("should block requests when rate limit exceeded", () => {
      const { apiKey } = createApiKey({
        name: "Test Key",
        userId: "user-123",
        email: "test@example.com",
        rateLimit: 3,
      });

      recordApiRequest(apiKey.id);
      recordApiRequest(apiKey.id);
      recordApiRequest(apiKey.id);

      const status = checkApiRateLimit(apiKey.id);

      expect(status.allowed).toBe(false);
      expect(status.remaining).toBe(0);
    });

    it("should increment usage count", () => {
      const { apiKey } = createApiKey({
        name: "Test Key",
        userId: "user-123",
        email: "test@example.com",
      });

      recordApiRequest(apiKey.id);
      recordApiRequest(apiKey.id);

      const updated = getApiKey(apiKey.id);
      expect(updated?.usageCount).toBe(2);
    });
  });

  describe("Usage Logging", () => {
    it("should log API usage", () => {
      const { apiKey } = createApiKey({
        name: "Test Key",
        userId: "user-123",
        email: "test@example.com",
      });

      logApiUsage({
        apiKeyId: apiKey.id,
        endpoint: "/api/v1/politicians",
        method: "GET",
        statusCode: 200,
        responseTimeMs: 150,
        timestamp: new Date(),
        ip: "127.0.0.1",
      });

      const logs = getApiUsageLogs(apiKey.id);

      expect(logs).toHaveLength(1);
      expect(logs[0]?.endpoint).toBe("/api/v1/politicians");
    });

    it("should calculate usage statistics", () => {
      const { apiKey } = createApiKey({
        name: "Test Key",
        userId: "user-123",
        email: "test@example.com",
      });

      logApiUsage({
        apiKeyId: apiKey.id,
        endpoint: "/api/v1/politicians",
        method: "GET",
        statusCode: 200,
        responseTimeMs: 100,
        timestamp: new Date(),
        ip: "127.0.0.1",
      });

      logApiUsage({
        apiKeyId: apiKey.id,
        endpoint: "/api/v1/bills",
        method: "GET",
        statusCode: 200,
        responseTimeMs: 200,
        timestamp: new Date(),
        ip: "127.0.0.1",
      });

      const stats = getApiUsageStats(apiKey.id);

      expect(stats.totalRequests).toBe(2);
      expect(stats.averageResponseTime).toBe(150);
      expect(stats.endpointBreakdown["/api/v1/politicians"]).toBe(1);
      expect(stats.endpointBreakdown["/api/v1/bills"]).toBe(1);
    });
  });

  describe("seedTestApiKey", () => {
    it("should create a test API key with known value", () => {
      const testKey = "bkib_live_testkey12345678901234567";
      const apiKey = seedTestApiKey(testKey, {
        name: "Seeded Test Key",
        userId: "test-user",
      });

      expect(apiKey.name).toBe("Seeded Test Key");

      const result = validateApiKey(testKey);
      expect(result.valid).toBe(true);
    });
  });
});
