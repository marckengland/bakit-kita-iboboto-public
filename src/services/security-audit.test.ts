/**
 * Security Audit Tests
 *
 * Comprehensive security audit tests verifying:
 * 1. Data encryption configuration (at rest and in transit)
 * 2. Authentication security (session management, token validation)
 * 3. PII handling (no storage of document numbers after verification)
 * 4. Admin role separation and permission enforcement
 *
 * **Validates: Requirements 41.1, 41.2, 41.3, 41.4, 41.5, 41.6, 41.7, 41.8**
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHash } from "crypto";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import {
  generateSecureToken,
  hashToken,
  validateDocumentNumber,
  createSessionObject,
  createUser,
  validateSession,
  invalidateSession,
  verifyUser,
  sessionContainsSensitiveData,
  clearAllSessions,
  getUser,
  SESSION_DURATION_MS,
  TOKEN_LENGTH,
} from "./auth.service";

import {
  createAdmin,
  checkPermission,
  createActionRequest,
  approveActionRequest,
  rejectActionRequest,
  clearAllAdminData,
  isCriticalAction,
  CRITICAL_ACTIONS,
  REQUIRED_APPROVALS_FOR_CRITICAL,
  AdminRole,
  AdminAction,
  AdminRoleError,
} from "./admin-role.service";

import {
  logCreate,
  logUpdate,
  logDeleteAttempt,
  logAdminAction,
  verifyChainIntegrity,
  attemptModifyEntry,
  attemptDeleteEntry,
  clearAuditLog,
  getAuditLog,
  AuditError,
} from "./blockchain-audit.service";

// ============================================
// Test Constants
// ============================================

const VALID_NATIONAL_ID = "ABCD-1234-EFGH";
const VALID_PASSPORT = "AB1234567";
const SENSITIVE_PATTERNS = [
  /\d{4}-\d{4}-\d{4}/, // National ID pattern
  /[A-Z]{2}\d{7}[A-Z]?/, // Passport pattern
  /nationalIdNumber/i,
  /passportNumber/i,
  /documentNumber/i,
];

// ============================================
// Section 1: Data Encryption Configuration Tests
// Validates: Requirements 41.1, 41.4
// ============================================

describe("Security Audit - Data Encryption Configuration", () => {
  describe("Requirement 41.4: Encryption at Rest and in Transit", () => {
    it("should use cryptographic hashing for token storage", () => {
      const token = generateSecureToken();
      const hashedToken = hashToken(token);

      // Hash should be different from original token
      expect(hashedToken).not.toBe(token);

      // Hash should be consistent (same input = same output)
      expect(hashToken(token)).toBe(hashedToken);

      // Hash should be SHA-256 (64 hex characters)
      expect(hashedToken).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should generate cryptographically secure tokens", () => {
      const tokens = new Set<string>();
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        const token = generateSecureToken();
        tokens.add(token);

        // Token should be hex-encoded
        expect(token).toMatch(/^[a-f0-9]+$/);

        // Token should have correct length (TOKEN_LENGTH * 2 for hex)
        expect(token.length).toBe(TOKEN_LENGTH * 2);
      }

      // All tokens should be unique
      expect(tokens.size).toBe(iterations);
    });

    it("should use SHA-256 for audit log hash chaining", () => {
      clearAuditLog();

      logCreate("system", "system", "politician", "pol-1", { name: "Test" });
      const auditLog = getAuditLog();

      expect(auditLog.length).toBe(1);
      const entry = auditLog[0];

      // Hash should be SHA-256 (64 hex characters)
      expect(entry?.hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should verify hash chain integrity for tamper detection", () => {
      clearAuditLog();

      // Create multiple audit entries
      logCreate("system", "system", "politician", "pol-1", { name: "Test 1" });
      logUpdate("admin-1", "admin", "politician", "pol-1", { name: "Test 1" }, { name: "Test 2" });
      logCreate("system", "system", "bill", "bill-1", { title: "Test Bill" });

      const result = verifyChainIntegrity();
      expect(result.isValid).toBe(true);
    });

    it("should detect tampering in audit log", () => {
      clearAuditLog();

      logCreate("system", "system", "politician", "pol-1", { name: "Test" });
      const auditLog = getAuditLog();

      // Tamper with the entry (this simulates what would happen if someone modified the log)
      const entry = auditLog[0];
      if (entry) {
        // Create a tampered copy
        const tamperedEntry = { ...entry, newValue: { name: "Tampered" } };

        // The hash should no longer match
        const expectedHash = createHash("sha256")
          .update(
            JSON.stringify({
              id: tamperedEntry.id,
              timestamp: tamperedEntry.timestamp.toISOString(),
              actor: tamperedEntry.actor,
              actorType: tamperedEntry.actorType,
              action: tamperedEntry.action,
              dataType: tamperedEntry.dataType,
              dataId: tamperedEntry.dataId,
              previousValue: tamperedEntry.previousValue,
              newValue: tamperedEntry.newValue,
              metadata: tamperedEntry.metadata,
              previousHash: tamperedEntry.previousHash,
            })
          )
          .digest("hex");

        expect(expectedHash).not.toBe(entry.hash);
      }
    });
  });
});

// ============================================
// Section 2: Authentication Security Tests
// Validates: Requirements 41.2, 41.3
// ============================================

describe("Security Audit - Authentication Security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAllSessions();
  });

  afterEach(() => {
    clearAllSessions();
  });

  describe("Requirement 41.2: Minimum Data Collection", () => {
    it("should only collect necessary data for authentication", async () => {
      const mockUser = {
        id: "user-123",
        isVerified: false,
        verificationMethod: null,
        verifiedAt: null,
        language: "en",
        createdAt: new Date(),
        lastLoginAt: null,
      };

      vi.mocked(prisma.user.create).mockResolvedValueOnce(mockUser as any);

      const result = await createUser();

      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();

      // Session should only contain minimal required fields
      const sessionKeys = Object.keys(result.session!);
      const allowedKeys = [
        "id",
        "userId",
        "isVerified",
        "verificationMethod",
        "createdAt",
        "expiresAt",
      ];

      for (const key of sessionKeys) {
        expect(allowedKeys).toContain(key);
      }
    });

    it("should not store unnecessary user data in session", () => {
      const session = createSessionObject("user-123", true, "national_id");

      // Session should not contain email, name, or other PII
      const sessionStr = JSON.stringify(session);
      expect(sessionStr).not.toContain("email");
      expect(sessionStr).not.toContain("name");
      expect(sessionStr).not.toContain("address");
      expect(sessionStr).not.toContain("phone");
    });
  });

  describe("Requirement 41.3: No PII Storage Beyond Verification", () => {
    it("should not store National ID numbers after verification", async () => {
      const mockUser = {
        id: "user-123",
        isVerified: false,
        verificationMethod: null,
        verifiedAt: null,
        language: "en",
        createdAt: new Date(),
        lastLoginAt: null,
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.user.update).mockResolvedValue({
        ...mockUser,
        isVerified: true,
        verificationMethod: "national_id",
        verifiedAt: new Date(),
      } as any);

      const result = await verifyUser({
        method: "national_id",
        documentNumber: VALID_NATIONAL_ID,
        userId: "user-123",
      });

      expect(result.success).toBe(true);
      expect(result.isVerified).toBe(true);
      expect(result.verificationMethod).toBe("national_id");

      // Verify that update was called WITHOUT the document number
      const updateCall = vi.mocked(prisma.user.update).mock.calls[0];
      const updateData = updateCall?.[0]?.data;

      expect(updateData).not.toHaveProperty("nationalIdNumber");
      expect(updateData).not.toHaveProperty("documentNumber");
      expect(updateData).not.toHaveProperty("idNumber");
    });

    it("should not store Passport numbers after verification", async () => {
      const mockUser = {
        id: "user-456",
        isVerified: false,
        verificationMethod: null,
        verifiedAt: null,
        language: "en",
        createdAt: new Date(),
        lastLoginAt: null,
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.user.update).mockResolvedValue({
        ...mockUser,
        isVerified: true,
        verificationMethod: "passport",
        verifiedAt: new Date(),
      } as any);

      const result = await verifyUser({
        method: "passport",
        documentNumber: VALID_PASSPORT,
        userId: "user-456",
      });

      expect(result.success).toBe(true);
      expect(result.isVerified).toBe(true);
      expect(result.verificationMethod).toBe("passport");

      // Verify that update was called WITHOUT the document number
      const updateCall = vi.mocked(prisma.user.update).mock.calls[0];
      const updateData = updateCall?.[0]?.data;

      expect(updateData).not.toHaveProperty("passportNumber");
      expect(updateData).not.toHaveProperty("documentNumber");
      expect(updateData).not.toHaveProperty("idNumber");
    });

    it("should never include document numbers in session data", () => {
      // Test with various verification methods
      const methods: Array<"national_id" | "passport"> = ["national_id", "passport"];

      for (const method of methods) {
        const session = createSessionObject("user-123", true, method);

        // Check that session doesn't contain sensitive patterns
        expect(sessionContainsSensitiveData(session)).toBe(false);

        // Verify no document number patterns in session
        const sessionStr = JSON.stringify(session);
        for (const pattern of SENSITIVE_PATTERNS) {
          expect(sessionStr).not.toMatch(pattern);
        }
      }
    });

    it("should only store verification status, not document details", () => {
      const session = createSessionObject("user-123", true, "national_id");

      // Session should have verification method name, not document number
      expect(session.verificationMethod).toBe("national_id");
      expect(session.isVerified).toBe(true);

      // Session should not contain any document number
      const sessionStr = JSON.stringify(session);
      expect(sessionStr).not.toContain(VALID_NATIONAL_ID);
      expect(sessionStr).not.toContain(VALID_PASSPORT);
    });
  });

  describe("Session Management Security", () => {
    it("should set appropriate session expiration", () => {
      const session = createSessionObject("user-123", false, null);

      const expectedExpiry = Date.now() + SESSION_DURATION_MS;
      const actualExpiry = session.expiresAt.getTime();

      // Allow 1 second tolerance
      expect(Math.abs(actualExpiry - expectedExpiry)).toBeLessThan(1000);
    });

    it("should invalidate session on logout", async () => {
      const mockUser = { id: "user-123", isVerified: false };
      vi.mocked(prisma.user.create).mockResolvedValueOnce(mockUser as any);

      const result = await createUser();
      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();

      // Validate session works before logout
      const session = await validateSession(result.token!);
      expect(session.userId).toBe("user-123");

      // Logout
      const invalidated = await invalidateSession(result.token!);
      expect(invalidated).toBe(true);

      // Session should no longer be valid
      await expect(validateSession(result.token!)).rejects.toThrow();
    });

    it("should reject invalid tokens", async () => {
      await expect(validateSession("invalid-token")).rejects.toThrow();
      await expect(validateSession("")).rejects.toThrow();
    });

    it("should generate unique session IDs", () => {
      const sessionIds = new Set<string>();
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        const session = createSessionObject(`user-${i}`, false, null);
        sessionIds.add(session.id);
      }

      expect(sessionIds.size).toBe(iterations);
    });
  });

  describe("Document Validation Security", () => {
    it("should validate National ID format", () => {
      // Valid formats
      expect(validateDocumentNumber("ABCD-1234-EFGH", "national_id")).toBe(true);
      expect(validateDocumentNumber("1234-5678-9012", "national_id")).toBe(true);

      // Invalid formats
      expect(validateDocumentNumber("", "national_id")).toBe(false);
      expect(validateDocumentNumber("short", "national_id")).toBe(false);
      expect(validateDocumentNumber("invalid@chars!", "national_id")).toBe(false);
    });

    it("should validate Passport format", () => {
      // Valid formats
      expect(validateDocumentNumber("AB1234567", "passport")).toBe(true);
      expect(validateDocumentNumber("XY9876543", "passport")).toBe(true);

      // Invalid formats
      expect(validateDocumentNumber("", "passport")).toBe(false);
      expect(validateDocumentNumber("short", "passport")).toBe(false);
      expect(validateDocumentNumber("invalid@chars!", "passport")).toBe(false);
    });
  });
});

// ============================================
// Section 3: Admin Role Separation Tests
// Validates: Requirements 41.5, 41.6, 41.7, 41.8
// ============================================

describe("Security Audit - Admin Role Separation", () => {
  beforeEach(() => {
    clearAllAdminData();
    clearAuditLog();
  });

  describe("Role-Based Access Control", () => {
    it("should enforce distinct permissions for each admin role", () => {
      const roles: AdminRole[] = ["super_admin", "content_moderator", "data_reviewer", "auditor"];

      for (const role of roles) {
        const admin = createAdmin(`${role}@example.com`, `${role} User`, role, "system");

        // Super admin should have all permissions
        if (role === "super_admin") {
          const allActions: AdminAction[] = [
            "view_audit_logs",
            "review_community_reports",
            "moderate_content",
            "review_ai_verification",
            "manual_verification",
            "approve_data_change",
            "reject_data_change",
            "delete_profile",
            "modify_verified_data",
            "manage_admins",
            "system_configuration",
          ];

          for (const action of allActions) {
            const result = checkPermission(admin.id, action);
            expect(result.allowed).toBe(true);
          }
        }

        // Auditor should only have view_audit_logs
        if (role === "auditor") {
          expect(checkPermission(admin.id, "view_audit_logs").allowed).toBe(true);
          expect(checkPermission(admin.id, "moderate_content").allowed).toBe(false);
          expect(checkPermission(admin.id, "delete_profile").allowed).toBe(false);
        }

        // Content moderator should have limited permissions
        if (role === "content_moderator") {
          expect(checkPermission(admin.id, "view_audit_logs").allowed).toBe(true);
          expect(checkPermission(admin.id, "review_community_reports").allowed).toBe(true);
          expect(checkPermission(admin.id, "moderate_content").allowed).toBe(true);
          expect(checkPermission(admin.id, "delete_profile").allowed).toBe(false);
          expect(checkPermission(admin.id, "manage_admins").allowed).toBe(false);
        }

        // Data reviewer should have data-related permissions
        if (role === "data_reviewer") {
          expect(checkPermission(admin.id, "view_audit_logs").allowed).toBe(true);
          expect(checkPermission(admin.id, "review_ai_verification").allowed).toBe(true);
          expect(checkPermission(admin.id, "manual_verification").allowed).toBe(true);
          expect(checkPermission(admin.id, "approve_data_change").allowed).toBe(true);
          expect(checkPermission(admin.id, "delete_profile").allowed).toBe(false);
        }
      }
    });

    it("should require multi-admin approval for critical actions", () => {
      const admin = createAdmin("admin@example.com", "Admin", "super_admin", "system");

      for (const action of CRITICAL_ACTIONS) {
        const result = checkPermission(admin.id, action);
        expect(result.allowed).toBe(true);
        expect(result.requiresApproval).toBe(true);
        expect(result.requiredApprovals).toBe(REQUIRED_APPROVALS_FOR_CRITICAL);
      }
    });

    it("should prevent self-approval for critical actions", () => {
      const admin = createAdmin("admin@example.com", "Admin", "super_admin", "system");

      const request = createActionRequest(admin.id, "delete_profile", "politician", "pol-1", {});
      expect(request.status).toBe("pending");

      // Attempt self-approval should fail
      expect(() => approveActionRequest(request.id, admin.id)).toThrow(AdminRoleError);
    });

    it("should require different admin for approval", () => {
      const admin1 = createAdmin("admin1@example.com", "Admin 1", "super_admin", "system");
      const admin2 = createAdmin("admin2@example.com", "Admin 2", "super_admin", "system");

      const request = createActionRequest(admin1.id, "delete_profile", "politician", "pol-1", {});
      expect(request.status).toBe("pending");

      // Different admin can approve
      const approved = approveActionRequest(request.id, admin2.id);
      expect(approved.approvals.length).toBe(1);
      expect(approved.approvals[0]?.adminId).toBe(admin2.id);
    });

    it("should log all admin actions to blockchain", () => {
      clearAuditLog();

      createAdmin("admin@example.com", "Admin", "super_admin", "system");

      // Creating admin should be logged
      const auditLog = getAuditLog();
      expect(auditLog.length).toBeGreaterThan(0);

      const lastEntry = auditLog[auditLog.length - 1];
      expect(lastEntry?.actorType).toBe("admin");
    });
  });

  describe("Separation of Duties", () => {
    it("should enforce that no single admin can both submit and approve changes", () => {
      const admin1 = createAdmin("admin1@example.com", "Admin 1", "super_admin", "system");
      const admin2 = createAdmin("admin2@example.com", "Admin 2", "super_admin", "system");
      const admin3 = createAdmin("admin3@example.com", "Admin 3", "super_admin", "system");

      // Admin 1 creates request
      const request = createActionRequest(
        admin1.id,
        "modify_verified_data",
        "politician",
        "pol-1",
        {
          field: "name",
          newValue: "Updated Name",
        }
      );

      // Admin 1 cannot approve their own request
      expect(() => approveActionRequest(request.id, admin1.id)).toThrow(AdminRoleError);

      // Admin 2 can approve
      approveActionRequest(request.id, admin2.id);

      // Admin 3 can also approve (reaching required approvals)
      const finalRequest = approveActionRequest(request.id, admin3.id);
      expect(finalRequest.status).toBe("approved");
      expect(finalRequest.approvals.length).toBe(REQUIRED_APPROVALS_FOR_CRITICAL);
    });

    it("should prevent duplicate approvals from same admin", () => {
      const admin1 = createAdmin("admin1@example.com", "Admin 1", "super_admin", "system");
      const admin2 = createAdmin("admin2@example.com", "Admin 2", "super_admin", "system");

      const request = createActionRequest(admin1.id, "delete_profile", "politician", "pol-1", {});

      // First approval succeeds
      approveActionRequest(request.id, admin2.id);

      // Second approval from same admin should fail
      expect(() => approveActionRequest(request.id, admin2.id)).toThrow(AdminRoleError);
    });

    it("should allow rejection by authorized admins", () => {
      const admin1 = createAdmin("admin1@example.com", "Admin 1", "super_admin", "system");
      const admin2 = createAdmin("admin2@example.com", "Admin 2", "super_admin", "system");

      const request = createActionRequest(admin1.id, "delete_profile", "politician", "pol-1", {});

      const rejected = rejectActionRequest(request.id, admin2.id, "Not justified");
      expect(rejected.status).toBe("rejected");
    });
  });

  describe("Audit Log Immutability", () => {
    it("should reject attempts to modify audit entries", () => {
      clearAuditLog();

      logCreate("system", "system", "politician", "pol-1", { name: "Test" });
      const auditLog = getAuditLog();
      const entryId = auditLog[0]?.id;

      expect(() =>
        attemptModifyEntry(entryId!, "admin-1", { newValue: { name: "Modified" } })
      ).toThrow(AuditError);
    });

    it("should reject attempts to delete audit entries", () => {
      clearAuditLog();

      logCreate("system", "system", "politician", "pol-1", { name: "Test" });
      const auditLog = getAuditLog();
      const entryId = auditLog[0]?.id;

      expect(() => attemptDeleteEntry(entryId!, "admin-1")).toThrow(AuditError);
    });

    it("should log deletion attempts to the audit log", () => {
      clearAuditLog();

      logDeleteAttempt("admin-1", "admin", "politician", "pol-1", "User requested deletion");

      const auditLog = getAuditLog();
      const lastEntry = auditLog[auditLog.length - 1];

      expect(lastEntry?.action).toBe("delete");
      expect(lastEntry?.metadata?.rejected).toBe(true);
    });

    it("should maintain chain integrity after multiple operations", () => {
      clearAuditLog();

      // Perform various operations
      logCreate("system", "system", "politician", "pol-1", { name: "Test 1" });
      logUpdate("admin-1", "admin", "politician", "pol-1", { name: "Test 1" }, { name: "Test 2" });
      logCreate("system", "system", "bill", "bill-1", { title: "Test Bill" });
      logDeleteAttempt("admin-2", "admin", "politician", "pol-1", "Requested by politician");
      logAdminAction("admin-1", "review_data", "politician", "pol-1", { reviewed: true });

      const result = verifyChainIntegrity();
      expect(result.isValid).toBe(true);
    });
  });
});

// ============================================
// Section 4: Data Privacy Compliance Tests
// Validates: Requirements 41.5, 41.6, 41.7
// ============================================

describe("Security Audit - Data Privacy Compliance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAllSessions();
  });

  describe("Requirement 41.5: User Data Access Rights", () => {
    it("should allow users to view their data", async () => {
      const mockUser = {
        id: "user-123",
        isVerified: true,
        verificationMethod: "national_id",
        verifiedAt: new Date(),
        language: "en",
        createdAt: new Date(),
        lastLoginAt: new Date(),
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

      const user = await getUser("user-123");

      expect(user).toBeDefined();
      expect(user?.id).toBe("user-123");
      expect(user?.isVerified).toBe(true);

      // User data should not contain sensitive document numbers
      const userStr = JSON.stringify(user);
      for (const pattern of SENSITIVE_PATTERNS) {
        expect(userStr).not.toMatch(pattern);
      }
    });

    it("should return only non-sensitive user fields", async () => {
      const mockUser = {
        id: "user-123",
        isVerified: true,
        verificationMethod: "passport",
        verifiedAt: new Date(),
        language: "fil",
        createdAt: new Date(),
        lastLoginAt: new Date(),
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

      const user = await getUser("user-123");

      // Should have expected fields
      expect(user).toHaveProperty("id");
      expect(user).toHaveProperty("isVerified");
      expect(user).toHaveProperty("verificationMethod");
      expect(user).toHaveProperty("language");
      expect(user).toHaveProperty("createdAt");

      // Should NOT have sensitive fields
      expect(user).not.toHaveProperty("nationalIdNumber");
      expect(user).not.toHaveProperty("passportNumber");
      expect(user).not.toHaveProperty("documentNumber");
    });
  });

  describe("Requirement 41.6: Explicit Consent", () => {
    it("should create user with unverified status initially", async () => {
      const mockUser = {
        id: "user-new",
        isVerified: false,
        verificationMethod: null,
        verifiedAt: null,
        language: "en",
        createdAt: new Date(),
        lastLoginAt: null,
      };

      vi.mocked(prisma.user.create).mockResolvedValue(mockUser as any);

      const result = await createUser();

      expect(result.success).toBe(true);
      expect(result.session?.isVerified).toBe(false);
      expect(result.session?.verificationMethod).toBeNull();
    });
  });

  describe("Requirement 41.7: Privacy Policy Compliance", () => {
    it("should distinguish between user personal data and politician public records", () => {
      clearAuditLog();

      // User data operations
      logCreate("system", "system", "user", "user-1", { language: "en" });

      // Politician data operations (public records)
      logCreate("system", "system", "politician", "pol-1", { name: "Public Figure" });

      const auditLog = getAuditLog();

      // Both should be logged but with different data types
      const userEntry = auditLog.find((e) => e.dataType === "user");
      const politicianEntry = auditLog.find((e) => e.dataType === "politician");

      expect(userEntry).toBeDefined();
      expect(politicianEntry).toBeDefined();
      expect(userEntry?.dataType).toBe("user");
      expect(politicianEntry?.dataType).toBe("politician");
    });
  });
});

// ============================================
// Section 5: Critical Action Identification Tests
// ============================================

describe("Security Audit - Critical Action Identification", () => {
  it("should correctly identify all critical actions", () => {
    const expectedCritical: AdminAction[] = [
      "delete_profile",
      "modify_verified_data",
      "manage_admins",
      "system_configuration",
    ];

    for (const action of expectedCritical) {
      expect(isCriticalAction(action)).toBe(true);
    }
  });

  it("should correctly identify non-critical actions", () => {
    const nonCritical: AdminAction[] = [
      "view_audit_logs",
      "review_community_reports",
      "moderate_content",
      "review_ai_verification",
      "manual_verification",
      "approve_data_change",
      "reject_data_change",
    ];

    for (const action of nonCritical) {
      expect(isCriticalAction(action)).toBe(false);
    }
  });
});

// ============================================
// Section 6: Token Security Tests
// ============================================

describe("Security Audit - Token Security", () => {
  it("should generate tokens with sufficient entropy", () => {
    const tokens: string[] = [];
    const iterations = 1000;

    for (let i = 0; i < iterations; i++) {
      tokens.push(generateSecureToken());
    }

    // All tokens should be unique
    const uniqueTokens = new Set(tokens);
    expect(uniqueTokens.size).toBe(iterations);

    // Tokens should have correct length
    for (const token of tokens) {
      expect(token.length).toBe(TOKEN_LENGTH * 2);
    }
  });

  it("should use one-way hashing for token storage", () => {
    const token = generateSecureToken();
    const hash = hashToken(token);

    // Hash should be different from token
    expect(hash).not.toBe(token);

    // Hash should be consistent
    expect(hashToken(token)).toBe(hash);

    // Different tokens should produce different hashes
    const token2 = generateSecureToken();
    expect(hashToken(token2)).not.toBe(hash);
  });

  it("should produce collision-resistant hashes", () => {
    const hashes = new Set<string>();
    const iterations = 1000;

    for (let i = 0; i < iterations; i++) {
      const token = generateSecureToken();
      hashes.add(hashToken(token));
    }

    // All hashes should be unique (no collisions)
    expect(hashes.size).toBe(iterations);
  });
});

// ============================================
// Section 7: Deactivated Admin Tests
// ============================================

describe("Security Audit - Deactivated Admin Handling", () => {
  beforeEach(() => {
    clearAllAdminData();
    clearAuditLog();
  });

  it("should deny all actions for deactivated admins", () => {
    const admin = createAdmin("admin@example.com", "Admin", "super_admin", "system");

    // Deactivate admin
    admin.isActive = false;

    // All actions should be denied
    const actions: AdminAction[] = [
      "view_audit_logs",
      "review_community_reports",
      "moderate_content",
      "delete_profile",
    ];

    for (const action of actions) {
      const result = checkPermission(admin.id, action);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("deactivated");
    }
  });
});
