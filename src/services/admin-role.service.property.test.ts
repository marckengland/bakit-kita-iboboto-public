/**
 * Property-Based Tests for Admin Role Management Service
 * Property 20: Admin Role Separation
 * Validates: Requirements 39.1, 39.6, 39.7, 39.8
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import {
  generateId,
  isCriticalAction,
  getRolePermissions,
  roleHasPermission,
  createAdmin,
  checkPermission,
  createActionRequest,
  approveActionRequest,
  clearAllAdminData,
  CRITICAL_ACTIONS,
  REQUIRED_APPROVALS_FOR_CRITICAL,
  AdminRole,
  AdminAction,
  AdminRoleError,
} from "./admin-role.service";
import { clearAuditLog, getAuditLog } from "./blockchain-audit.service";

const NUM_RUNS = 100;

// ============================================
// Arbitraries
// ============================================

const arbitraryAdminRole = (): fc.Arbitrary<AdminRole> =>
  fc.constantFrom("super_admin", "content_moderator", "data_reviewer", "auditor");

const arbitraryAdminAction = (): fc.Arbitrary<AdminAction> =>
  fc.constantFrom(
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
    "system_configuration"
  );

const arbitraryCriticalAction = (): fc.Arbitrary<AdminAction> =>
  fc.constantFrom(
    "delete_profile",
    "modify_verified_data",
    "manage_admins",
    "system_configuration"
  );

const arbitraryNonCriticalAction = (): fc.Arbitrary<AdminAction> =>
  fc.constantFrom(
    "view_audit_logs",
    "review_community_reports",
    "moderate_content",
    "review_ai_verification",
    "manual_verification",
    "approve_data_change",
    "reject_data_change"
  );

const arbitraryEmail = (): fc.Arbitrary<string> => fc.uuid().map((id) => `admin-${id}@example.com`);

const arbitraryName = (): fc.Arbitrary<string> =>
  fc.constantFrom("Admin User", "Test Admin", "System Admin", "Content Mod", "Data Reviewer");

// ============================================
// Property Tests
// ============================================

describe("Admin Role Separation - Property 20", () => {
  beforeEach(() => {
    clearAllAdminData();
    clearAuditLog();
  });

  describe("Property 20.1: Actions Must Be Logged to Blockchain", () => {
    it("should log all admin actions to blockchain", () => {
      fc.assert(
        fc.property(
          arbitraryEmail(),
          arbitraryName(),
          arbitraryAdminRole(),
          (email, name, role) => {
            clearAllAdminData();
            clearAuditLog();

            const auditCountBefore = getAuditLog().length;
            createAdmin(email, name, role, "system");

            expect(getAuditLog().length).toBeGreaterThan(auditCountBefore);
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    it("should log action requests to blockchain", () => {
      fc.assert(
        fc.property(arbitraryNonCriticalAction(), (action) => {
          clearAllAdminData();
          clearAuditLog();

          const admin = createAdmin("test@example.com", "Test", "super_admin", "system");
          const auditCountBefore = getAuditLog().length;

          // Only test actions that super_admin has permission for
          if (roleHasPermission("super_admin", action)) {
            createActionRequest(admin.id, action, "system", "test-1", {});
            expect(getAuditLog().length).toBeGreaterThan(auditCountBefore);
          }

          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe("Property 20.2: Critical Actions Require Multi-Admin Approval", () => {
    it("should require approval for all critical actions", () => {
      fc.assert(
        fc.property(arbitraryCriticalAction(), (action) => {
          clearAllAdminData();

          const admin = createAdmin("test@example.com", "Test", "super_admin", "system");
          const result = checkPermission(admin.id, action);

          expect(result.requiresApproval).toBe(true);
          expect(result.requiredApprovals).toBe(REQUIRED_APPROVALS_FOR_CRITICAL);
          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should create pending requests for critical actions", () => {
      fc.assert(
        fc.property(arbitraryCriticalAction(), (action) => {
          clearAllAdminData();

          const admin = createAdmin("test@example.com", "Test", "super_admin", "system");
          const request = createActionRequest(admin.id, action, "politician", "pol-1", {});

          expect(request.status).toBe("pending");
          expect(request.requiresApproval).toBe(true);
          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe("Property 20.3: Self-Approval Prevention", () => {
    it("should prevent self-approval for all critical actions", () => {
      fc.assert(
        fc.property(arbitraryCriticalAction(), (action) => {
          clearAllAdminData();

          const admin = createAdmin("test@example.com", "Test", "super_admin", "system");
          const request = createActionRequest(admin.id, action, "politician", "pol-1", {});

          let errorThrown = false;
          try {
            approveActionRequest(request.id, admin.id);
          } catch (e) {
            if (e instanceof AdminRoleError && e.code === "SELF_APPROVAL_DENIED") {
              errorThrown = true;
            }
          }

          expect(errorThrown).toBe(true);
          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe("Property 20.4: Role-Based Access Control", () => {
    it("should enforce role permissions consistently", () => {
      fc.assert(
        fc.property(arbitraryAdminRole(), arbitraryAdminAction(), (role, action) => {
          clearAllAdminData();

          const admin = createAdmin("test@example.com", "Test", role, "system");
          const result = checkPermission(admin.id, action);

          const expectedPermission = roleHasPermission(role, action);

          if (expectedPermission) {
            expect(result.allowed).toBe(true);
          } else {
            expect(result.allowed).toBe(false);
          }

          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should give super_admin access to all actions", () => {
      fc.assert(
        fc.property(arbitraryAdminAction(), (action) => {
          clearAllAdminData();

          const admin = createAdmin("test@example.com", "Test", "super_admin", "system");
          const result = checkPermission(admin.id, action);

          expect(result.allowed).toBe(true);
          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should limit auditor to view_audit_logs only", () => {
      fc.assert(
        fc.property(arbitraryAdminAction(), (action) => {
          clearAllAdminData();

          const admin = createAdmin("test@example.com", "Test", "auditor", "system");
          const result = checkPermission(admin.id, action);

          if (action === "view_audit_logs") {
            expect(result.allowed).toBe(true);
          } else {
            expect(result.allowed).toBe(false);
          }

          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe("Property 20.5: Content Moderator Permissions", () => {
    it("should allow content moderator only specific actions", () => {
      fc.assert(
        fc.property(arbitraryAdminAction(), (action) => {
          clearAllAdminData();

          const admin = createAdmin("test@example.com", "Test", "content_moderator", "system");
          const result = checkPermission(admin.id, action);

          const allowedActions = [
            "view_audit_logs",
            "review_community_reports",
            "moderate_content",
          ];

          if (allowedActions.includes(action)) {
            expect(result.allowed).toBe(true);
          } else {
            expect(result.allowed).toBe(false);
          }

          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe("Property 20.6: Data Reviewer Permissions", () => {
    it("should allow data reviewer only specific actions", () => {
      fc.assert(
        fc.property(arbitraryAdminAction(), (action) => {
          clearAllAdminData();

          const admin = createAdmin("test@example.com", "Test", "data_reviewer", "system");
          const result = checkPermission(admin.id, action);

          const allowedActions = [
            "view_audit_logs",
            "review_ai_verification",
            "manual_verification",
            "approve_data_change",
            "reject_data_change",
          ];

          if (allowedActions.includes(action)) {
            expect(result.allowed).toBe(true);
          } else {
            expect(result.allowed).toBe(false);
          }

          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe("Property 20.7: ID Generation Uniqueness", () => {
    it("should generate unique IDs", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 10 }),
          fc.integer({ min: 10, max: 100 }),
          (prefix, count) => {
            const ids = new Set<string>();
            for (let i = 0; i < count; i++) {
              ids.add(generateId(prefix));
            }
            expect(ids.size).toBe(count);
            return true;
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe("Property 20.8: Critical Action Identification", () => {
    it("should correctly identify critical actions", () => {
      fc.assert(
        fc.property(arbitraryAdminAction(), (action) => {
          const isCritical = isCriticalAction(action);
          const expectedCritical = CRITICAL_ACTIONS.includes(action);
          expect(isCritical).toBe(expectedCritical);
          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe("Property 20.9: Permission Consistency", () => {
    it("should return consistent permissions for same role", () => {
      fc.assert(
        fc.property(arbitraryAdminRole(), (role) => {
          const permissions1 = getRolePermissions(role);
          const permissions2 = getRolePermissions(role);
          expect(permissions1).toEqual(permissions2);
          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });

    it("should have roleHasPermission consistent with getRolePermissions", () => {
      fc.assert(
        fc.property(arbitraryAdminRole(), arbitraryAdminAction(), (role, action) => {
          const permissions = getRolePermissions(role);
          const hasPermission = roleHasPermission(role, action);
          expect(hasPermission).toBe(permissions.includes(action));
          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe("Property 20.10: Deactivated Admin Denial", () => {
    it("should deny all actions for deactivated admins", () => {
      fc.assert(
        fc.property(arbitraryAdminAction(), (action) => {
          clearAllAdminData();

          const admin = createAdmin("test@example.com", "Test", "super_admin", "system");
          admin.isActive = false; // Directly deactivate for testing

          const result = checkPermission(admin.id, action);
          expect(result.allowed).toBe(false);
          expect(result.reason).toContain("deactivated");

          return true;
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });
});
