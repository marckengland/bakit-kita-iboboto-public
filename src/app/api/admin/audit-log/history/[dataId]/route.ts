/**
 * Admin Audit Log History API Route
 *
 * Provides modification history for a specific data record.
 *
 * Requirements: 36.7, 39.5
 */

import { NextRequest, NextResponse } from "next/server";
import { getEntriesByDataId } from "@/services/blockchain-audit.service";

// Valid admin roles that can access modification history
const ALLOWED_ROLES = ["super_admin", "auditor", "data_reviewer"];

interface RouteParams {
  params: Promise<{
    dataId: string;
  }>;
}

/**
 * GET /api/admin/audit-log/history/[dataId]
 *
 * Fetch modification history for a specific data record.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Check admin role
    const adminRole = request.headers.get("x-admin-role");
    if (!adminRole || !ALLOWED_ROLES.includes(adminRole)) {
      return NextResponse.json({ error: "Unauthorized. Admin role required." }, { status: 403 });
    }

    const { dataId } = await params;

    if (!dataId) {
      return NextResponse.json({ error: "Data ID is required" }, { status: 400 });
    }

    // Get all entries for this data ID
    const entries = getEntriesByDataId(decodeURIComponent(dataId));

    // Sort by timestamp ascending (oldest first for history view)
    entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return NextResponse.json({
      dataId: decodeURIComponent(dataId),
      entries,
      count: entries.length,
    });
  } catch (error) {
    console.error("Error fetching modification history:", error);
    return NextResponse.json({ error: "Failed to fetch modification history" }, { status: 500 });
  }
}
