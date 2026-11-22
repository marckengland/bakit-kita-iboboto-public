/**
 * Unit Tests for Authentication Service
 *
 * Tests authentication, session management, and verification flows.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import {
  generateSecureToken,
  hashToken,
  validateDocumentNumber,
  isSessionExpired,
  createSessionObject,
  createUser,
  createSession,
  validateSession,
  invalidateSession,
  verifyUser,
  sessionContainsSensitiveData,
  clearAllSessions,
  getSessionCount,
  AuthenticationError,
  SESSION_DURATION_MS,
  TOKEN_LENGTH,
} from "./auth.service";

describe("Authentication Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAllSessions();
  });

  afterEach(() => {
    clearAllSessions();
  });

  describe("generateSecureToken", () => {
    it("should generate a token of correct length", () => {
      const token = generateSecureToken();
      // Hex encoding doubles the byte length
      expect(token.length).toBe(TOKEN_LENGTH * 2);
    });

    it("should generate unique tokens", () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateSecureToken());
      }
      expect(tokens.size).toBe(100);
    });

    it("should generate hex-encoded tokens", () => {
      const token = generateSecureToken();
      expect(/^[a-f0-9]+$/i.test(token)).toBe(true);
    });
  });

  describe("hashToken", () => {
    it("should produce consistent hashes for same input", () => {
      const token = "test-token-123";
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);
      expect(hash1).toBe(hash2);
    });

    it("should produce different hashes for different inputs", () => {
      const hash1 = hashToken("token1");
      const hash2 = hashToken("token2");
      expect(hash1).not.toBe(hash2);
    });

    it("should produce 64-character SHA-256 hash", () => {
      const hash = hashToken("test");
      expect(hash.length).toBe(64);
    });
  });

  describe("validateDocumentNumber", () => {
    describe("National ID validation", () => {
      it("should accept valid National ID format", () => {
        expect(validateDocumentNumber("1234-5678-9012", "national_id")).toBe(true);
        expect(validateDocumentNumber("ABCD12345678", "national_id")).toBe(true);
      });

      it("should reject too short National ID", () => {
        expect(validateDocumentNumber("1234567", "national_id")).toBe(false);
      });

      it("should reject too long National ID", () => {
        expect(validateDocumentNumber("123456789012345678901", "national_id")).toBe(false);
      });

      it("should reject invalid characters", () => {
        expect(validateDocumentNumber("1234@5678", "national_id")).toBe(false);
      });
    });

    describe("Passport validation", () => {
      it("should accept valid Passport format", () => {
        expect(validateDocumentNumber("AB1234567", "passport")).toBe(true);
        expect(validateDocumentNumber("P12345678", "passport")).toBe(true);
      });

      it("should reject too short Passport", () => {
        expect(validateDocumentNumber("AB12345", "passport")).toBe(false);
      });

      it("should reject invalid characters in Passport", () => {
        expect(validateDocumentNumber("AB-123456", "passport")).toBe(false);
      });
    });

    it("should reject empty document number", () => {
      expect(validateDocumentNumber("", "national_id")).toBe(false);
      expect(validateDocumentNumber("", "passport")).toBe(false);
    });

    it("should reject null/undefined", () => {
      expect(validateDocumentNumber(null as any, "national_id")).toBe(false);
      expect(validateDocumentNumber(undefined as any, "passport")).toBe(false);
    });
  });

  describe("isSessionExpired", () => {
    it("should return false for non-expired session", () => {
      const session = createSessionObject("user-1", false, null);
      expect(isSessionExpired(session)).toBe(false);
    });

    it("should return true for expired session", () => {
      const session = createSessionObject("user-1", false, null);
      session.expiresAt = new Date(Date.now() - 1000);
      expect(isSessionExpired(session)).toBe(true);
    });
  });

  describe("createSessionObject", () => {
    it("should create session with correct user ID", () => {
      const session = createSessionObject("user-123", true, "national_id");
      expect(session.userId).toBe("user-123");
    });

    it("should create session with correct verification status", () => {
      const verifiedSession = createSessionObject("user-1", true, "passport");
      expect(verifiedSession.isVerified).toBe(true);
      expect(verifiedSession.verificationMethod).toBe("passport");

      const unverifiedSession = createSessionObject("user-2", false, null);
      expect(unverifiedSession.isVerified).toBe(false);
      expect(unverifiedSession.verificationMethod).toBeNull();
    });

    it("should set correct expiration time", () => {
      const before = Date.now();
      const session = createSessionObject("user-1", false, null);
      const after = Date.now();

      const expectedMin = before + SESSION_DURATION_MS;
      const expectedMax = after + SESSION_DURATION_MS;

      expect(session.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(session.expiresAt.getTime()).toBeLessThanOrEqual(expectedMax);
    });

    it("should generate unique session IDs", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(createSessionObject(`user-${i}`, false, null).id);
      }
      expect(ids.size).toBe(100);
    });
  });

  describe("createUser", () => {
    it("should create user and return session", async () => {
      const mockUser = { id: "user-123", isVerified: false };
      vi.mocked(prisma.user.create).mockResolvedValue(mockUser as any);

      const result = await createUser();

      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.session?.userId).toBe("user-123");
      expect(result.session?.isVerified).toBe(false);
    });

    it("should handle creation failure", async () => {
      vi.mocked(prisma.user.create).mockRejectedValue(new Error("DB error"));

      const result = await createUser();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("createSession", () => {
    it("should create session for existing user", async () => {
      const mockUser = {
        id: "user-123",
        isVerified: true,
        verificationMethod: "national_id",
      };
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.user.update).mockResolvedValue(mockUser as any);

      const result = await createSession("user-123");

      expect(result.success).toBe(true);
      expect(result.session?.isVerified).toBe(true);
      expect(result.session?.verificationMethod).toBe("national_id");
    });

    it("should fail for non-existent user", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await createSession("non-existent");

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  describe("validateSession", () => {
    it("should validate valid session token", async () => {
      const mockUser = { id: "user-123", isVerified: false };
      vi.mocked(prisma.user.create).mockResolvedValue(mockUser as any);

      const createResult = await createUser();
      const session = await validateSession(createResult.token!);

      expect(session.userId).toBe("user-123");
    });

    it("should reject invalid token", async () => {
      await expect(validateSession("invalid-token")).rejects.toThrow(AuthenticationError);
    });

    it("should reject empty token", async () => {
      await expect(validateSession("")).rejects.toThrow(AuthenticationError);
    });

    it("should reject expired session", async () => {
      const mockUser = { id: "user-123", isVerified: false };
      vi.mocked(prisma.user.create).mockResolvedValue(mockUser as any);

      const createResult = await createUser();

      // Manually expire the session
      void hashToken(createResult.token!);
      // Access internal session store through the module
      const session = await validateSession(createResult.token!);
      session.expiresAt = new Date(Date.now() - 1000);

      await expect(validateSession(createResult.token!)).rejects.toThrow("Session expired");
    });
  });

  describe("invalidateSession", () => {
    it("should invalidate valid session", async () => {
      const mockUser = { id: "user-123", isVerified: false };
      vi.mocked(prisma.user.create).mockResolvedValue(mockUser as any);

      const createResult = await createUser();
      const invalidated = await invalidateSession(createResult.token!);

      expect(invalidated).toBe(true);

      // Session should no longer be valid
      await expect(validateSession(createResult.token!)).rejects.toThrow();
    });

    it("should return false for invalid token", async () => {
      const result = await invalidateSession("invalid-token");
      expect(result).toBe(false);
    });

    it("should return false for empty token", async () => {
      const result = await invalidateSession("");
      expect(result).toBe(false);
    });
  });

  describe("verifyUser", () => {
    it("should verify user with valid National ID", async () => {
      const mockUser = { id: "user-123", isVerified: false };
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.user.update).mockResolvedValue({
        ...mockUser,
        isVerified: true,
        verificationMethod: "national_id",
      } as any);

      const result = await verifyUser({
        method: "national_id",
        documentNumber: "1234-5678-9012",
        userId: "user-123",
      });

      expect(result.success).toBe(true);
      expect(result.isVerified).toBe(true);
      expect(result.verificationMethod).toBe("national_id");
    });

    it("should verify user with valid Passport", async () => {
      const mockUser = { id: "user-123", isVerified: false };
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.user.update).mockResolvedValue({
        ...mockUser,
        isVerified: true,
        verificationMethod: "passport",
      } as any);

      const result = await verifyUser({
        method: "passport",
        documentNumber: "AB1234567",
        userId: "user-123",
      });

      expect(result.success).toBe(true);
      expect(result.isVerified).toBe(true);
      expect(result.verificationMethod).toBe("passport");
    });

    it("should reject invalid document format", async () => {
      const result = await verifyUser({
        method: "national_id",
        documentNumber: "invalid",
        userId: "user-123",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid document");
    });

    it("should fail for non-existent user", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await verifyUser({
        method: "national_id",
        documentNumber: "1234-5678-9012",
        userId: "non-existent",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  describe("sessionContainsSensitiveData", () => {
    it("should return false for clean session", () => {
      const session = createSessionObject("user-123", true, "national_id");
      expect(sessionContainsSensitiveData(session)).toBe(false);
    });

    it("should detect if session somehow contains document patterns", () => {
      const session = createSessionObject("user-123", true, "national_id");
      // Manually inject sensitive data (should never happen in real code)
      (session as any).nationalIdNumber = "1234-5678-9012";
      expect(sessionContainsSensitiveData(session)).toBe(true);
    });
  });

  describe("Session Store Management", () => {
    it("should track session count", async () => {
      const mockUser = { id: "user-123", isVerified: false };
      vi.mocked(prisma.user.create).mockResolvedValue(mockUser as any);

      expect(getSessionCount()).toBe(0);

      await createUser();
      expect(getSessionCount()).toBe(1);

      await createUser();
      expect(getSessionCount()).toBe(2);
    });

    it("should clear all sessions", async () => {
      const mockUser = { id: "user-123", isVerified: false };
      vi.mocked(prisma.user.create).mockResolvedValue(mockUser as any);

      await createUser();
      await createUser();
      expect(getSessionCount()).toBe(2);

      clearAllSessions();
      expect(getSessionCount()).toBe(0);
    });
  });
});
