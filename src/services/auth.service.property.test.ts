/**
 * Property-Based Tests for Authentication Service
 *
 * **Property 21: Authentication Session Management**
 * *For any* authentication flow:
 * - Successful authentication must create a valid session
 * - The session must not contain National ID or Passport numbers (only verification status)
 * - Logout must invalidate the session
 * - Expired sessions must be rejected
 * - Session tokens must be cryptographically secure
 *
 * **Validates: Requirements 16.2, 16.4, 16.5, 41.3**
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fc from "fast-check";

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
  validateSession,
  invalidateSession,
  sessionContainsSensitiveData,
  clearAllSessions,
  VerificationMethod,
  SESSION_DURATION_MS,
  TOKEN_LENGTH,
  MIN_DOCUMENT_LENGTH,
  MAX_DOCUMENT_LENGTH,
} from "./auth.service";

const NUM_RUNS = 100;

// ============================================
// Arbitraries for Property-Based Testing
// ============================================

const arbitraryUserId = (): fc.Arbitrary<string> =>
  fc.string({ minLength: 10, maxLength: 30 }).map((s) => `user-${s}`);

const arbitraryVerificationMethod = (): fc.Arbitrary<VerificationMethod> =>
  fc.constantFrom("national_id", "passport");

const arbitraryValidNationalId = (): fc.Arbitrary<string> =>
  fc
    .tuple(
      fc.stringMatching(/^[A-Z0-9]{4}$/),
      fc.stringMatching(/^[A-Z0-9]{4}$/),
      fc.stringMatching(/^[A-Z0-9]{4}$/)
    )
    .map(([a, b, c]) => `${a}-${b}-${c}`);

const arbitraryValidPassport = (): fc.Arbitrary<string> =>
  fc
    .tuple(fc.stringMatching(/^[A-Z]{2}$/), fc.stringMatching(/^[0-9]{7}$/))
    .map(([letters, numbers]) => `${letters}${numbers}`);

const arbitraryInvalidDocumentNumber = (): fc.Arbitrary<string> =>
  fc.oneof(
    fc.constant(""),
    fc.string({ maxLength: MIN_DOCUMENT_LENGTH - 1 }),
    fc.string({ minLength: MAX_DOCUMENT_LENGTH + 1, maxLength: 50 }),
    fc.string({ minLength: 8, maxLength: 15 }).filter((s) => /[^A-Z0-9-]/i.test(s))
  );

// ============================================
// Property Tests
// ============================================

describe("Authentication Session Management - Property 21", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAllSessions();
  });

  afterEach(() => {
    clearAllSessions();
  });

  /**
   * **Validates: Requirement 16.2**
   * Successful authentication must create a valid session
   */
  describe("Property 21.1: Session Creation", () => {
    it("should create valid session for any user", () => {
      fc.assert(
        fc.property(
          arbitraryUserId(),
          fc.boolean(),
          fc.option(arbitraryVerificationMethod(), { nil: null }),
          (userId, isVerified, verificationMethod) => {
            const session = createSessionObject(userId, isVerified, verificationMethod);

            // Session must have required fields
            expect(session.id).toBeDefined();
            expect(session.userId).toBe(userId);
            expect(session.isVerified).toBe(isVerified);
            expect(session.verificationMethod).toBe(verificationMethod);
            expect(session.createdAt).toBeInstanceOf(Date);
            expect(session.expiresAt).toBeInstanceOf(Date);

            // Session must not be expired when created
            expect(isSessionExpired(session)).toBe(false);

            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should create unique session IDs", () => {
      fc.assert(
        fc.property(fc.array(arbitraryUserId(), { minLength: 2, maxLength: 50 }), (userIds) => {
          const sessionIds = userIds.map((userId) => createSessionObject(userId, false, null).id);

          const uniqueIds = new Set(sessionIds);
          expect(uniqueIds.size).toBe(sessionIds.length);

          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirement 41.3**
   * Session must not contain National ID or Passport numbers
   */
  describe("Property 21.2: No Sensitive Data in Session", () => {
    it("should never store document numbers in session", () => {
      fc.assert(
        fc.property(
          arbitraryUserId(),
          fc.boolean(),
          fc.option(arbitraryVerificationMethod(), { nil: null }),
          (userId, isVerified, verificationMethod) => {
            const session = createSessionObject(userId, isVerified, verificationMethod);

            // Session must not contain sensitive data
            expect(sessionContainsSensitiveData(session)).toBe(false);

            // Verify session structure only contains allowed fields
            const allowedKeys = [
              "id",
              "userId",
              "isVerified",
              "verificationMethod",
              "createdAt",
              "expiresAt",
            ];
            const sessionKeys = Object.keys(session);

            for (const key of sessionKeys) {
              expect(allowedKeys).toContain(key);
            }

            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should only store verification status, not document details", () => {
      fc.assert(
        fc.property(arbitraryUserId(), arbitraryVerificationMethod(), (userId, method) => {
          const session = createSessionObject(userId, true, method);

          // Session should have verification method name, not document number
          expect(session.verificationMethod).toBe(method);

          // Stringify and check for document number patterns
          const sessionStr = JSON.stringify(session);

          // Should not contain actual document number patterns
          expect(sessionStr).not.toMatch(/\d{4}-\d{4}-\d{4}/);
          expect(sessionStr).not.toMatch(/[A-Z]{2}\d{7}[A-Z]?/);

          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirement 16.4**
   * Logout must invalidate the session
   */
  describe("Property 21.3: Session Invalidation", () => {
    it("should invalidate session on logout", async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: 10 }), async (sessionCount) => {
          const tokens: string[] = [];

          // Create multiple sessions
          for (let i = 0; i < sessionCount; i++) {
            const mockUser = { id: `user-${i}`, isVerified: false };
            vi.mocked(prisma.user.create).mockResolvedValueOnce(mockUser as any);
            const result = await createUser();
            if (result.token) {
              tokens.push(result.token);
            }
          }

          // Invalidate each session
          for (const token of tokens) {
            const invalidated = await invalidateSession(token);
            expect(invalidated).toBe(true);

            // Session should no longer be valid
            await expect(validateSession(token)).rejects.toThrow();
          }

          return true;
        }),
        { numRuns: Math.min(NUM_RUNS, 20) } // Reduced for async tests
      );
    });

    it("should not affect other sessions when one is invalidated", async () => {
      const mockUser1 = { id: "user-1", isVerified: false };
      const mockUser2 = { id: "user-2", isVerified: false };

      vi.mocked(prisma.user.create)
        .mockResolvedValueOnce(mockUser1 as any)
        .mockResolvedValueOnce(mockUser2 as any);

      const result1 = await createUser();
      const result2 = await createUser();

      // Invalidate first session
      await invalidateSession(result1.token!);

      // Second session should still be valid
      const session2 = await validateSession(result2.token!);
      expect(session2.userId).toBe("user-2");
    });
  });

  /**
   * **Validates: Requirement 16.5**
   * Expired sessions must be rejected
   */
  describe("Property 21.4: Session Expiration", () => {
    it("should set correct expiration time", () => {
      fc.assert(
        fc.property(arbitraryUserId(), (userId) => {
          const before = Date.now();
          const session = createSessionObject(userId, false, null);
          const after = Date.now();

          const expectedMinExpiry = before + SESSION_DURATION_MS;
          const expectedMaxExpiry = after + SESSION_DURATION_MS;

          expect(session.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMinExpiry);
          expect(session.expiresAt.getTime()).toBeLessThanOrEqual(expectedMaxExpiry);

          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should correctly identify expired sessions", () => {
      fc.assert(
        fc.property(arbitraryUserId(), fc.integer({ min: 1, max: 1000000 }), (userId, msInPast) => {
          const session = createSessionObject(userId, false, null);

          // Set expiration to past
          session.expiresAt = new Date(Date.now() - msInPast);

          expect(isSessionExpired(session)).toBe(true);

          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should correctly identify non-expired sessions", () => {
      fc.assert(
        fc.property(
          arbitraryUserId(),
          fc.integer({ min: 1000, max: SESSION_DURATION_MS }),
          (userId, msInFuture) => {
            const session = createSessionObject(userId, false, null);

            // Set expiration to future
            session.expiresAt = new Date(Date.now() + msInFuture);

            expect(isSessionExpired(session)).toBe(false);

            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * **Validates: Requirement 16.2**
   * Session tokens must be cryptographically secure
   */
  describe("Property 21.5: Token Security", () => {
    it("should generate tokens of correct length", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), (count) => {
          for (let i = 0; i < count; i++) {
            const token = generateSecureToken();
            expect(token.length).toBe(TOKEN_LENGTH * 2); // Hex encoding
          }
          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should generate unique tokens", () => {
      fc.assert(
        fc.property(fc.integer({ min: 10, max: 100 }), (count) => {
          const tokens = new Set<string>();
          for (let i = 0; i < count; i++) {
            tokens.add(generateSecureToken());
          }
          expect(tokens.size).toBe(count);
          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should produce consistent hashes", () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 100 }), (input) => {
          const hash1 = hashToken(input);
          const hash2 = hashToken(input);
          expect(hash1).toBe(hash2);
          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should produce different hashes for different inputs", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (input1, input2) => {
            fc.pre(input1 !== input2);
            const hash1 = hashToken(input1);
            const hash2 = hashToken(input2);
            expect(hash1).not.toBe(hash2);
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  /**
   * Additional property tests for document validation
   */
  describe("Property 21.6: Document Validation", () => {
    it("should accept valid National ID formats", () => {
      fc.assert(
        fc.property(arbitraryValidNationalId(), (docNumber) => {
          expect(validateDocumentNumber(docNumber, "national_id")).toBe(true);
          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should accept valid Passport formats", () => {
      fc.assert(
        fc.property(arbitraryValidPassport(), (docNumber) => {
          expect(validateDocumentNumber(docNumber, "passport")).toBe(true);
          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should reject invalid document numbers", () => {
      fc.assert(
        fc.property(
          arbitraryInvalidDocumentNumber(),
          arbitraryVerificationMethod(),
          (docNumber, method) => {
            // Empty strings and very short/long strings should be rejected
            if (
              docNumber === "" ||
              docNumber.length < MIN_DOCUMENT_LENGTH ||
              docNumber.length > MAX_DOCUMENT_LENGTH
            ) {
              expect(validateDocumentNumber(docNumber, method)).toBe(false);
            }
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});
