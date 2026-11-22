/**
 * Admin Audit Log Chain Verification API Route
 *
 * Provides chain integrity verification for the audit log.
 * Verifies cryptographic hash chain to detect tampering.
 *
 * Requirements: 36.6, 36.7, 39.5
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyChainIntegrity, logAdminAction } from "@/services/blockchain-audit.service";

// Valid admin roles that can verify chain integrity
const ALLOWED_ROLES = ["super_admin", "auditor"];

/**
 * POST /api/admin/audit-log/verify
 *
 * Verify the integrity of the audit log chain.
 */
export async function POST(request: NextRequest) {
  try {
    // Check admin role
    const adminRole = request.headers.get("x-admin-role");
    if (!adminRole || !ALLOWED_ROLES.includes(adminRole)) {
      return NextResponse.json(
        { error: "Unauthorized. Auditor or Super Admin role required." },
        { status: 403 }
      );
    }

    // Get admin ID from header (in production, this would come from session)
    const adminId = request.headers.get("x-admin-id") || "system";

    // Log the verification action
    logAdminAction(adminId, "verify_chain_integrity", "system", "audit_log", {
      action: "chain_verification_requested",
    });

    // Perform chain verification
    const result = verifyChainIntegrity();

    // Log the result
    logAdminAction(adminId, "verify_chain_integrity_result", "system", "audit_log", {
      isValid: result.isValid,
      message: result.message,
      invalidEntryIndex: result.invalidEntryIndex,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error verifying chain integrity:", error);
    return NextResponse.json(
      {
        isValid: false,
        message: error instanceof Error ? error.message : "Verification failed",
      },
      { status: 500 }
    );
  }
}
