/**
 * Admin Trigger All Scrapes API Route
 *
 * Handles triggering manual scrapes for all data sources.
 *
 * Requirements: 20.8, 20.9
 */

import { NextRequest, NextResponse } from "next/server";
import { roleHasPermission, AdminRole } from "@/services/admin-role.service";
import { triggerAllScrapes } from "@/services/data-pipeline.service";

// ============================================
// POST - Trigger all scrapes
// ============================================

export async function POST(request: NextRequest) {
  try {
    // Check admin authorization
    const adminRole = request.headers.get("x-admin-role") as AdminRole | null;

    if (!adminRole || !roleHasPermission(adminRole, "manage_data_pipeline")) {
      return NextResponse.json(
        { error: "Unauthorized. Super Admin role required to trigger scrapes." },
        { status: 403 }
      );
    }

    const jobs = await triggerAllScrapes();

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
    console.error("Error triggering all scrapes:", error);

    const message = error instanceof Error ? error.message : "Failed to trigger scrapes";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
