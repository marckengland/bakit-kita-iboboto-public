/**
 * Admin Alert Acknowledge API Route
 *
 * Handles acknowledging scrape alerts.
 *
 * Requirements: 20.9
 */

import { NextRequest, NextResponse } from "next/server";
import { roleHasPermission, AdminRole } from "@/services/admin-role.service";
import { acknowledgeAlert } from "@/services/data-pipeline.service";

// ============================================
// POST - Acknowledge an alert
// ============================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Check admin authorization
    const adminRole = request.headers.get("x-admin-role") as AdminRole | null;
    const adminId = request.headers.get("x-admin-id") || "admin-user";

    if (!adminRole || !roleHasPermission(adminRole, "view_audit_logs")) {
      return NextResponse.json({ error: "Unauthorized. Admin role required." }, { status: 403 });
    }

    const { id } = await params;
    const alert = acknowledgeAlert(id, adminId);

    if (!alert) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: alert.id,
      acknowledged: alert.acknowledged,
      acknowledgedBy: alert.acknowledgedBy,
      acknowledgedAt: alert.acknowledgedAt?.toISOString(),
    });
  } catch (error) {
    console.error("Error acknowledging alert:", error);
    return NextResponse.json({ error: "Failed to acknowledge alert" }, { status: 500 });
  }
}
