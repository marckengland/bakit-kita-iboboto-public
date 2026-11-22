/**
 * Unit Tests for Admin Role Management Service
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  generateId,
  isCriticalAction,
  getRolePermissions,
  roleHasPermission,
  createAdmin,
  getAdminById,
  getAdminByEmail,
  getAllAdmins,
  getAdminsByRole,
  updateAdminRole,
  deactivateAdmin,
  checkPermission,
  validatePermission,
  createActionRequest,
  approveActionRequest,
  rejectActionRequest,
  executeActionRequest,
  getActionRequests,
  getPendingActionRequests,
  getActionRequestsByAdmin,
  getActionRequestById,
  clearAllAdminData,
  getAdminCountsByRole,
  CRITICAL_ACTIONS,
  REQUIRED_APPROVALS_FOR_CRITICAL,
  AdminRoleError,
} from "./admin-role.service";
import { clearAuditLog } from "./blockchain-audit.service";

describe("Admin Role Management Service", () => {
  beforeEach(() => {
    clearAllAdminData();
    clearAuditLog();
  });

  describe("generateId", () => {
    it("should generate unique IDs", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateId("test"));
      }
      expect(ids.size).toBe(100);
    });

    it("should include prefix", () => {
      const id = generateId("admin");
      expect(id.startsWith("admin-")).toBe(true);
    });
  });

  describe("isCriticalAction", () => {
    it("should return true for critical actions", () => {
      for (const action of CRITICAL_ACTIONS) {
        expect(isCriticalAction(action)).toBe(true);
      }
    });

    it("should return false for non-critical actions", () => {
      expect(isCriticalAction("view_audit_logs")).toBe(false);
      expect(isCriticalAction("review_community_reports")).toBe(false);
    });
  });

  describe("getRolePermissions", () => {
    it("should return permissions for super_admin", () => {
      const permissions = getRolePermissions("super_admin");
      expect(permissions).toContain("manage_admins");
      expect(permissions).toContain("delete_profile");
    });

    it("should return limited permissions for auditor", () => {
      const permissions = getRolePermissions("auditor");
      expect(permissions).toEqual(["view_audit_logs"]);
    });

    it("should return permissions for content_moderator", () => {
      const permissions = getRolePermissions("content_moderator");
      expect(permissions).toContain("review_community_reports");
      expect(permissions).toContain("moderate_content");
      expect(permissions).not.toContain("delete_profile");
    });

    it("should return permissions for data_reviewer", () => {
      const permissions = getRolePermissions("data_reviewer");
      expect(permissions).toContain("review_ai_verification");
      expect(permissions).toContain("manual_verification");
      expect(permissions).not.toContain("delete_profile");
    });
  });

  describe("roleHasPermission", () => {
    it("should return true for allowed actions", () => {
      expect(roleHasPermission("super_admin", "delete_profile")).toBe(true);
      expect(roleHasPermission("auditor", "view_audit_logs")).toBe(true);
    });

    it("should return false for disallowed actions", () => {
      expect(roleHasPermission("auditor", "delete_profile")).toBe(false);
      expect(roleHasPermission("content_moderator", "manage_admins")).toBe(false);
    });
  });

  describe("Admin Management", () => {
    it("should create admin", () => {
      const admin = createAdmin("test@example.com", "Test Admin", "super_admin", "system");
      expect(admin.email).toBe("test@example.com");
      expect(admin.name).toBe("Test Admin");
      expect(admin.role).toBe("super_admin");
      expect(admin.isActive).toBe(true);
    });

    it("should get admin by ID", () => {
      const created = createAdmin("test@example.com", "Test", "auditor", "system");
      const found = getAdminById(created.id);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
    });

    it("should get admin by email", () => {
      createAdmin("test@example.com", "Test", "auditor", "system");
      const found = getAdminByEmail("test@example.com");
      expect(found).not.toBeNull();
      expect(found?.email).toBe("test@example.com");
    });

    it("should get all admins", () => {
      createAdmin("admin1@example.com", "Admin 1", "super_admin", "system");
      createAdmin("admin2@example.com", "Admin 2", "auditor", "system");
      expect(getAllAdmins()).toHaveLength(2);
    });

    it("should get admins by role", () => {
      createAdmin("admin1@example.com", "Admin 1", "super_admin", "system");
      createAdmin("admin2@example.com", "Admin 2", "auditor", "system");
      createAdmin("admin3@example.com", "Admin 3", "auditor", "system");

      expect(getAdminsByRole("auditor")).toHaveLength(2);
      expect(getAdminsByRole("super_admin")).toHaveLength(1);
    });

    it("should update admin role", () => {
      const admin = createAdmin("test@example.com", "Test", "auditor", "system");
      const updated = updateAdminRole(admin.id, "data_reviewer", "system");
      expect(updated.role).toBe("data_reviewer");
    });

    it("should throw when updating non-existent admin", () => {
      expect(() => updateAdminRole("non-existent", "auditor", "system")).toThrow(AdminRoleError);
    });

    it("should deactivate admin", () => {
      const admin = createAdmin("test@example.com", "Test", "auditor", "system");
      const deactivated = deactivateAdmin(admin.id, "system");
      expect(deactivated.isActive).toBe(false);
    });
  });

  describe("Permission Checking", () => {
    it("should allow action for permitted role", () => {
      const admin = createAdmin("test@example.com", "Test", "super_admin", "system");
      const result = checkPermission(admin.id, "view_audit_logs");
      expect(result.allowed).toBe(true);
    });

    it("should deny action for non-permitted role", () => {
      const admin = createAdmin("test@example.com", "Test", "auditor", "system");
      const result = checkPermission(admin.id, "delete_profile");
      expect(result.allowed).toBe(false);
    });

    it("should deny action for deactivated admin", () => {
      const admin = createAdmin("test@example.com", "Test", "super_admin", "system");
      deactivateAdmin(admin.id, "system");
      const result = checkPermission(admin.id, "view_audit_logs");
      expect(result.allowed).toBe(false);
    });

    it("should require approval for critical actions", () => {
      const admin = createAdmin("test@example.com", "Test", "super_admin", "system");
      const result = checkPermission(admin.id, "delete_profile");
      expect(result.allowed).toBe(true);
      expect(result.requiresApproval).toBe(true);
      expect(result.requiredApprovals).toBe(REQUIRED_APPROVALS_FOR_CRITICAL);
    });

    it("should throw on validatePermission failure", () => {
      const admin = createAdmin("test@example.com", "Test", "auditor", "system");
      expect(() => validatePermission(admin.id, "delete_profile")).toThrow(AdminRoleError);
    });
  });

  describe("Action Request Management", () => {
    let superAdmin1: ReturnType<typeof createAdmin>;
    let superAdmin2: ReturnType<typeof createAdmin>;
    let superAdmin3: ReturnType<typeof createAdmin>;

    beforeEach(() => {
      superAdmin1 = createAdmin("admin1@example.com", "Admin 1", "super_admin", "system");
      superAdmin2 = createAdmin("admin2@example.com", "Admin 2", "super_admin", "system");
      superAdmin3 = createAdmin("admin3@example.com", "Admin 3", "super_admin", "system");
    });

    it("should create action request for non-critical action", () => {
      const request = createActionRequest(superAdmin1.id, "view_audit_logs", "system", "logs", {});
      expect(request.status).toBe("executed");
      expect(request.requiresApproval).toBe(false);
    });

    it("should create pending request for critical action", () => {
      const request = createActionRequest(superAdmin1.id, "delete_profile", "politician", "pol-1", {
        reason: "Test",
      });
      expect(request.status).toBe("pending");
      expect(request.requiresApproval).toBe(true);
    });

    it("should approve action request", () => {
      const request = createActionRequest(
        superAdmin1.id,
        "delete_profile",
        "politician",
        "pol-1",
        {}
      );

      const approved = approveActionRequest(request.id, superAdmin2.id, "Approved");
      expect(approved.approvals).toHaveLength(1);
    });

    it("should not allow self-approval", () => {
      const request = createActionRequest(
        superAdmin1.id,
        "delete_profile",
        "politician",
        "pol-1",
        {}
      );

      expect(() => approveActionRequest(request.id, superAdmin1.id)).toThrow(AdminRoleError);
    });

    it("should mark as approved after enough approvals", () => {
      const request = createActionRequest(
        superAdmin1.id,
        "delete_profile",
        "politician",
        "pol-1",
        {}
      );

      approveActionRequest(request.id, superAdmin2.id);
      const approved = approveActionRequest(request.id, superAdmin3.id);

      expect(approved.status).toBe("approved");
    });

    it("should reject action request", () => {
      const request = createActionRequest(
        superAdmin1.id,
        "delete_profile",
        "politician",
        "pol-1",
        {}
      );

      const rejected = rejectActionRequest(request.id, superAdmin2.id, "Not justified");
      expect(rejected.status).toBe("rejected");
    });

    it("should execute approved request", () => {
      const request = createActionRequest(
        superAdmin1.id,
        "delete_profile",
        "politician",
        "pol-1",
        {}
      );

      approveActionRequest(request.id, superAdmin2.id);
      approveActionRequest(request.id, superAdmin3.id);

      const executed = executeActionRequest(request.id, superAdmin1.id);
      expect(executed.status).toBe("executed");
    });

    it("should not execute unapproved request", () => {
      const request = createActionRequest(
        superAdmin1.id,
        "delete_profile",
        "politician",
        "pol-1",
        {}
      );

      expect(() => executeActionRequest(request.id, superAdmin1.id)).toThrow(AdminRoleError);
    });
  });

  describe("Query Functions", () => {
    it("should get all action requests", () => {
      const admin = createAdmin("test@example.com", "Test", "super_admin", "system");
      createActionRequest(admin.id, "view_audit_logs", "system", "logs", {});
      createActionRequest(admin.id, "view_audit_logs", "system", "logs", {});

      expect(getActionRequests()).toHaveLength(2);
    });

    it("should get pending action requests", () => {
      const admin = createAdmin("test@example.com", "Test", "super_admin", "system");
      createActionRequest(admin.id, "view_audit_logs", "system", "logs", {});
      createActionRequest(admin.id, "delete_profile", "politician", "pol-1", {});

      expect(getPendingActionRequests()).toHaveLength(1);
    });

    it("should get action requests by admin", () => {
      const admin1 = createAdmin("admin1@example.com", "Admin 1", "super_admin", "system");
      const admin2 = createAdmin("admin2@example.com", "Admin 2", "super_admin", "system");

      createActionRequest(admin1.id, "view_audit_logs", "system", "logs", {});
      createActionRequest(admin2.id, "view_audit_logs", "system", "logs", {});

      expect(getActionRequestsByAdmin(admin1.id)).toHaveLength(1);
    });

    it("should get action request by ID", () => {
      const admin = createAdmin("test@example.com", "Test", "super_admin", "system");
      const request = createActionRequest(admin.id, "view_audit_logs", "system", "logs", {});

      const found = getActionRequestById(request.id);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(request.id);
    });
  });

  describe("getAdminCountsByRole", () => {
    it("should return correct counts", () => {
      createAdmin("admin1@example.com", "Admin 1", "super_admin", "system");
      createAdmin("admin2@example.com", "Admin 2", "auditor", "system");
      createAdmin("admin3@example.com", "Admin 3", "auditor", "system");

      const counts = getAdminCountsByRole();
      expect(counts.super_admin).toBe(1);
      expect(counts.auditor).toBe(2);
      expect(counts.content_moderator).toBe(0);
      expect(counts.data_reviewer).toBe(0);
    });
  });

  describe("clearAllAdminData", () => {
    it("should clear all data", () => {
      createAdmin("test@example.com", "Test", "super_admin", "system");
      expect(getAllAdmins()).toHaveLength(1);

      clearAllAdminData();
      expect(getAllAdmins()).toHaveLength(0);
    });
  });
});
