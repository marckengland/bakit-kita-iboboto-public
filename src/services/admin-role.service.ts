/**
 * Admin Role Management Service
 *
 * Implements role-based access control for admin users.
 * Enforces separation of duties and multi-admin approval for critical actions.
 * All admin actions are logged to the blockchain audit log.
 *
 * **Validates: Requirements 39.1, 39.2, 39.3, 39.4, 39.5, 39.6, 39.7, 39.8**
 */

import { logAdminAction, DataType } from "./blockchain-audit.service";

// ============================================
// Types and Interfaces
// ============================================

export type AdminRole = "super_admin" | "content_moderator" | "data_reviewer" | "auditor";

export type AdminAction =
  | "view_audit_logs"
  | "review_community_reports"
  | "moderate_content"
  | "review_ai_verification"
  | "manual_verification"
  | "approve_data_change"
  | "reject_data_change"
  | "delete_profile"
  | "modify_verified_data"
  | "manage_admins"
  | "system_configuration"
  | "manage_data_pipeline";

export interface Admin {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  createdAt: Date;
  lastLoginAt?: Date;
  isActive: boolean;
}

export interface AdminActionRequest {
  id: string;
  action: AdminAction;
  requestedBy: string;
  requestedAt: Date;
  targetType: string;
  targetId: string;
  details: Record<string, unknown>;
  requiresApproval: boolean;
  approvals: AdminApproval[];
  status: "pending" | "approved" | "rejected" | "executed";
}

export interface AdminApproval {
  adminId: string;
  adminRole: AdminRole;
  approvedAt: Date;
  comment?: string;
}

export interface PermissionCheckResult {
  allowed: boolean;
  reason: string;
  requiresApproval?: boolean;
  requiredApprovals?: number;
}

// ============================================
// Constants
// ============================================

export const ROLE_PERMISSIONS: Record<AdminRole, AdminAction[]> = {
  super_admin: [
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
    "manage_data_pipeline",
  ],
  content_moderator: ["view_audit_logs", "review_community_reports", "moderate_content"],
  data_reviewer: [
    "view_audit_logs",
    "review_ai_verification",
    "manual_verification",
    "approve_data_change",
    "reject_data_change",
  ],
  auditor: ["view_audit_logs"],
};

export const CRITICAL_ACTIONS: AdminAction[] = [
  "delete_profile",
  "modify_verified_data",
  "manage_admins",
  "system_configuration",
];

export const REQUIRED_APPROVALS_FOR_CRITICAL = 2;

// ============================================
// Error Classes
// ============================================

export class AdminRoleError extends Error {
  constructor(
    message: string,
    public code:
      | "PERMISSION_DENIED"
      | "ADMIN_NOT_FOUND"
      | "INVALID_ROLE"
      | "SELF_APPROVAL_DENIED"
      | "INSUFFICIENT_APPROVALS"
      | "ACTION_ALREADY_PROCESSED"
  ) {
    super(message);
    this.name = "AdminRoleError";
  }
}

// ============================================
// In-Memory Storage (for development)
// ============================================

let admins: Admin[] = [];
let actionRequests: AdminActionRequest[] = [];

// ============================================
// Helper Functions
// ============================================

/**
 * Generate a unique ID
 */
export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Check if an action is critical
 */
export function isCriticalAction(action: AdminAction): boolean {
  return CRITICAL_ACTIONS.includes(action);
}

/**
 * Get permissions for a role
 */
export function getRolePermissions(role: AdminRole): AdminAction[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Check if a role has permission for an action
 */
export function roleHasPermission(role: AdminRole, action: AdminAction): boolean {
  const permissions = getRolePermissions(role);
  return permissions.includes(action);
}

// ============================================
// Admin Management
// ============================================

/**
 * Create a new admin
 */
export function createAdmin(
  email: string,
  name: string,
  role: AdminRole,
  createdBy: string
): Admin {
  const admin: Admin = {
    id: generateId("admin"),
    email,
    name,
    role,
    createdAt: new Date(),
    isActive: true,
  };

  admins.push(admin);

  // Log to blockchain
  logAdminAction(createdBy, "create_admin", "admin", admin.id, {
    email,
    name,
    role,
  });

  return admin;
}

/**
 * Get admin by ID
 */
export function getAdminById(id: string): Admin | null {
  return admins.find((a) => a.id === id) || null;
}

/**
 * Get admin by email
 */
export function getAdminByEmail(email: string): Admin | null {
  return admins.find((a) => a.email === email) || null;
}

/**
 * Get all admins
 */
export function getAllAdmins(): Admin[] {
  return [...admins];
}

/**
 * Get admins by role
 */
export function getAdminsByRole(role: AdminRole): Admin[] {
  return admins.filter((a) => a.role === role);
}

/**
 * Update admin role
 */
export function updateAdminRole(adminId: string, newRole: AdminRole, updatedBy: string): Admin {
  const admin = getAdminById(adminId);
  if (!admin) {
    throw new AdminRoleError("Admin not found", "ADMIN_NOT_FOUND");
  }

  const oldRole = admin.role;
  admin.role = newRole;

  // Log to blockchain
  logAdminAction(updatedBy, "update_admin_role", "admin", adminId, {
    oldRole,
    newRole,
  });

  return admin;
}

/**
 * Deactivate admin
 */
export function deactivateAdmin(adminId: string, deactivatedBy: string): Admin {
  const admin = getAdminById(adminId);
  if (!admin) {
    throw new AdminRoleError("Admin not found", "ADMIN_NOT_FOUND");
  }

  admin.isActive = false;

  // Log to blockchain
  logAdminAction(deactivatedBy, "deactivate_admin", "admin", adminId, {
    deactivatedAt: new Date(),
  });

  return admin;
}

// ============================================
// Permission Checking
// ============================================

/**
 * Check if an admin can perform an action
 */
export function checkPermission(adminId: string, action: AdminAction): PermissionCheckResult {
  const admin = getAdminById(adminId);

  if (!admin) {
    return {
      allowed: false,
      reason: "Admin not found",
    };
  }

  if (!admin.isActive) {
    return {
      allowed: false,
      reason: "Admin account is deactivated",
    };
  }

  if (!roleHasPermission(admin.role, action)) {
    return {
      allowed: false,
      reason: `Role '${admin.role}' does not have permission for action '${action}'`,
    };
  }

  if (isCriticalAction(action)) {
    return {
      allowed: true,
      reason: "Permission granted, but requires multi-admin approval",
      requiresApproval: true,
      requiredApprovals: REQUIRED_APPROVALS_FOR_CRITICAL,
    };
  }

  return {
    allowed: true,
    reason: "Permission granted",
  };
}

/**
 * Validate that an admin can perform an action (throws on failure)
 */
export function validatePermission(adminId: string, action: AdminAction): void {
  const result = checkPermission(adminId, action);
  if (!result.allowed) {
    throw new AdminRoleError(result.reason, "PERMISSION_DENIED");
  }
}

// ============================================
// Action Request Management
// ============================================

/**
 * Create an action request
 */
export function createActionRequest(
  adminId: string,
  action: AdminAction,
  targetType: string,
  targetId: string,
  details: Record<string, unknown>
): AdminActionRequest {
  // Check permission first
  const permissionResult = checkPermission(adminId, action);
  if (!permissionResult.allowed) {
    throw new AdminRoleError(permissionResult.reason, "PERMISSION_DENIED");
  }

  const request: AdminActionRequest = {
    id: generateId("req"),
    action,
    requestedBy: adminId,
    requestedAt: new Date(),
    targetType,
    targetId,
    details,
    requiresApproval: permissionResult.requiresApproval || false,
    approvals: [],
    status: permissionResult.requiresApproval ? "pending" : "executed",
  };

  actionRequests.push(request);

  // Log to blockchain
  logAdminAction(adminId, `request_${action}`, targetType as DataType, targetId, {
    requestId: request.id,
    requiresApproval: request.requiresApproval,
    details,
  });

  return request;
}

/**
 * Approve an action request
 */
export function approveActionRequest(
  requestId: string,
  approvingAdminId: string,
  comment?: string
): AdminActionRequest {
  const request = actionRequests.find((r) => r.id === requestId);
  if (!request) {
    throw new AdminRoleError("Action request not found", "ADMIN_NOT_FOUND");
  }

  if (request.status !== "pending") {
    throw new AdminRoleError(
      "Action request has already been processed",
      "ACTION_ALREADY_PROCESSED"
    );
  }

  // Check self-approval
  if (request.requestedBy === approvingAdminId) {
    throw new AdminRoleError("Cannot approve your own action request", "SELF_APPROVAL_DENIED");
  }

  // Check if already approved by this admin
  if (request.approvals.some((a) => a.adminId === approvingAdminId)) {
    throw new AdminRoleError("Already approved by this admin", "ACTION_ALREADY_PROCESSED");
  }

  // Check permission
  const admin = getAdminById(approvingAdminId);
  if (!admin) {
    throw new AdminRoleError("Approving admin not found", "ADMIN_NOT_FOUND");
  }

  if (!roleHasPermission(admin.role, request.action)) {
    throw new AdminRoleError(
      "Approving admin does not have permission for this action",
      "PERMISSION_DENIED"
    );
  }

  // Add approval
  request.approvals.push({
    adminId: approvingAdminId,
    adminRole: admin.role,
    approvedAt: new Date(),
    comment,
  });

  // Check if enough approvals
  if (request.approvals.length >= REQUIRED_APPROVALS_FOR_CRITICAL) {
    request.status = "approved";
  }

  // Log to blockchain
  logAdminAction(approvingAdminId, "approve_action", "admin" as DataType, requestId, {
    action: request.action,
    approvalCount: request.approvals.length,
    status: request.status,
    comment,
  });

  return request;
}

/**
 * Reject an action request
 */
export function rejectActionRequest(
  requestId: string,
  rejectingAdminId: string,
  reason: string
): AdminActionRequest {
  const request = actionRequests.find((r) => r.id === requestId);
  if (!request) {
    throw new AdminRoleError("Action request not found", "ADMIN_NOT_FOUND");
  }

  if (request.status !== "pending") {
    throw new AdminRoleError(
      "Action request has already been processed",
      "ACTION_ALREADY_PROCESSED"
    );
  }

  // Check permission
  const admin = getAdminById(rejectingAdminId);
  if (!admin) {
    throw new AdminRoleError("Rejecting admin not found", "ADMIN_NOT_FOUND");
  }

  if (!roleHasPermission(admin.role, request.action)) {
    throw new AdminRoleError(
      "Rejecting admin does not have permission for this action",
      "PERMISSION_DENIED"
    );
  }

  request.status = "rejected";

  // Log to blockchain
  logAdminAction(rejectingAdminId, "reject_action", "admin" as DataType, requestId, {
    action: request.action,
    reason,
  });

  return request;
}

/**
 * Execute an approved action request
 */
export function executeActionRequest(
  requestId: string,
  executingAdminId: string
): AdminActionRequest {
  const request = actionRequests.find((r) => r.id === requestId);
  if (!request) {
    throw new AdminRoleError("Action request not found", "ADMIN_NOT_FOUND");
  }

  if (request.status !== "approved" && request.status !== "executed") {
    throw new AdminRoleError("Action request is not approved", "INSUFFICIENT_APPROVALS");
  }

  request.status = "executed";

  // Log to blockchain
  logAdminAction(executingAdminId, "execute_action", "admin" as DataType, requestId, {
    action: request.action,
    executedAt: new Date(),
  });

  return request;
}

// ============================================
// Query Functions
// ============================================

/**
 * Get all action requests
 */
export function getActionRequests(): AdminActionRequest[] {
  return [...actionRequests];
}

/**
 * Get pending action requests
 */
export function getPendingActionRequests(): AdminActionRequest[] {
  return actionRequests.filter((r) => r.status === "pending");
}

/**
 * Get action requests by admin
 */
export function getActionRequestsByAdmin(adminId: string): AdminActionRequest[] {
  return actionRequests.filter((r) => r.requestedBy === adminId);
}

/**
 * Get action request by ID
 */
export function getActionRequestById(id: string): AdminActionRequest | null {
  return actionRequests.find((r) => r.id === id) || null;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Clear all data (for testing only)
 */
export function clearAllAdminData(): void {
  admins = [];
  actionRequests = [];
}

/**
 * Get admin counts by role
 */
export function getAdminCountsByRole(): Record<AdminRole, number> {
  return {
    super_admin: admins.filter((a) => a.role === "super_admin").length,
    content_moderator: admins.filter((a) => a.role === "content_moderator").length,
    data_reviewer: admins.filter((a) => a.role === "data_reviewer").length,
    auditor: admins.filter((a) => a.role === "auditor").length,
  };
}
