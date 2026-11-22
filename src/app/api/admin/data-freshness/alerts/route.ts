/**
 * Admin Data Freshness Alerts API Route
 *
 * Handles fetching scrape alerts.
 *
 * Requirements: 20.9
 */

import { NextRequest, NextResponse } from "next/server";
import { roleHasPermission, AdminRole } from "@/services/admin-role.service";
import { getAlerts, DataSourceType } from "@/services/data-pipeline.service";

// ============================================
// GET - Fetch scrape alerts
// ============================================

export async function GET(request: NextRequest) {
  try {
    // Check admin authorization
    const adminRole = request.headers.get("x-admin-role") as AdminRole | null;

    if (!adminRole || !roleHasPermission(adminRole, "view_audit_logs")) {
      return NextResponse.json({ error: "Unauthorized. Admin role required." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const acknowledged = searchParams.get("acknowledged");
    const source = searchParams.get("source");
    const limit = parseInt(searchParams.get("limit") || "50");

    const alerts = getAlerts({
      acknowledged: acknowledged === "true" ? true : acknowledged === "false" ? false : undefined,
      source: source as DataSourceType | undefined,
      limit,
    });

    // Transform alerts for response
    const transformedAlerts = alerts.map((alert) => ({
      id: alert.id,
      source: alert.source,
      severity: alert.severity,
      message: alert.message,
      createdAt: alert.createdAt.toISOString(),
      acknowledged: alert.acknowledged,
      acknowledgedBy: alert.acknowledgedBy,
      acknowledgedAt: alert.acknowledgedAt?.toISOString() || null,
    }));

    return NextResponse.json({ alerts: transformedAlerts });
  } catch (error) {
    console.error("Error fetching alerts:", error);
    return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
  }
}
