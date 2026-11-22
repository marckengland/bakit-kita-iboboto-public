/**
 * Admin Manual Scrape Trigger API Route
 *
 * Handles triggering manual scrapes for specific data sources.
 *
 * Requirements: 20.8, 20.9
 */

import { NextRequest, NextResponse } from "next/server";
import { roleHasPermission, AdminRole } from "@/services/admin-role.service";
import { triggerScrape, DataSourceType } from "@/services/data-pipeline.service";

const VALID_SOURCES: DataSourceType[] = [
  "senate",
  "house",
  "comelec",
  "dbm",
  "coa",
  "courts",
  "ombudsman",
  "politicians",
];

// ============================================
// POST - Trigger a manual scrape
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

    const body = await request.json();
    const { source } = body;

    if (!source || !VALID_SOURCES.includes(source)) {
      return NextResponse.json(
        { error: `Invalid source. Must be one of: ${VALID_SOURCES.join(", ")}` },
        { status: 400 }
      );
    }

    const job = await triggerScrape(source);

    return NextResponse.json({
      id: job.id,
      source: job.source,
      status: job.status,
      recordsProcessed: job.recordsProcessed,
      recordsAdded: job.recordsAdded,
      recordsUpdated: job.recordsUpdated,
      errors: job.errors,
      startedAt: job.startedAt.toISOString(),
      completedAt: job.completedAt?.toISOString() || null,
    });
  } catch (error) {
    console.error("Error triggering scrape:", error);

    const message = error instanceof Error ? error.message : "Failed to trigger scrape";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
