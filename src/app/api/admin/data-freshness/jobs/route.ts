/**
 * Admin Data Freshness Jobs API Route
 *
 * Handles fetching recent scrape jobs.
 *
 * Requirements: 20.8, 20.9
 */

import { NextRequest, NextResponse } from "next/server";
import { roleHasPermission, AdminRole } from "@/services/admin-role.service";
import { getRecentJobs } from "@/services/data-pipeline.service";

// ============================================
// GET - Fetch recent scrape jobs
// ============================================

export async function GET(request: NextRequest) {
  try {
    // Check admin authorization
    const adminRole = request.headers.get("x-admin-role") as AdminRole | null;

    if (!adminRole || !roleHasPermission(adminRole, "view_audit_logs")) {
      return NextResponse.json({ error: "Unauthorized. Admin role required." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");

    const jobs = getRecentJobs(limit);

    // Transform jobs for response
    const transformedJobs = jobs.map((job) => ({
      id: job.id,
      source: job.source,
      status: job.status,
      recordsProcessed: job.recordsProcessed,
      recordsAdded: job.recordsAdded,
      recordsUpdated: job.recordsUpdated,
      errors: job.errors,
      startedAt: job.startedAt.toISOString(),
      completedAt: job.completedAt?.toISOString() || null,
    }));

    return NextResponse.json({ jobs: transformedJobs });
  } catch (error) {
    console.error("Error fetching scrape jobs:", error);
    return NextResponse.json({ error: "Failed to fetch scrape jobs" }, { status: 500 });
  }
}
