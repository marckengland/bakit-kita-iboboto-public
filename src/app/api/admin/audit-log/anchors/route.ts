/**
 * Admin Audit Log Blockchain Anchors API Route
 *
 * Provides access to blockchain anchors for external verification.
 *
 * Requirements: 36.9, 39.5
 */

import { NextRequest, NextResponse } from "next/server";
import { getBlockchainAnchors } from "@/services/blockchain-audit.service";

// Valid admin roles that can access anchors
const ALLOWED_ROLES = ["super_admin", "auditor"];

/**
 * GET /api/admin/audit-log/anchors
 *
 * Fetch all blockchain anchors.
 */
export async function GET(request: NextRequest) {
  try {
    // Check admin role
    const adminRole = request.headers.get("x-admin-role");
    if (!adminRole || !ALLOWED_ROLES.includes(adminRole)) {
      return NextResponse.json(
        { error: "Unauthorized. Auditor or Super Admin role required." },
        { status: 403 }
      );
    }

    const anchors = getBlockchainAnchors();

    return NextResponse.json({
      anchors,
      count: anchors.length,
    });
  } catch (error) {
    console.error("Error fetching blockchain anchors:", error);
    return NextResponse.json({ error: "Failed to fetch blockchain anchors" }, { status: 500 });
  }
}
