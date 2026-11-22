/**
 * Cron Data Freshness API Route
 *
 * Called by external cron services (Vercel Cron, Railway Cron, etc.)
 * to trigger automatic data updates. Secured by CRON_SECRET env var.
 *
 * Configure in vercel.json:
 *   { "crons": [{ "path": "/api/cron/data-freshness", "schedule": "0 0/6 * * *" }] }
 *
 * Or call externally every 6 hours with the Authorization header set to Bearer CRON_SECRET.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  triggerAllScrapes,
  checkStaleData,
  getDataFreshness,
} from "@/services/data-pipeline.service";
import { logger } from "../../../../lib/logger";
import { verifyCronAuth } from "@/lib/cron-auth";

export const maxDuration = 300; // 5 minutes max for serverless

export async function GET(request: NextRequest) {
  const unauthorized = verifyCronAuth(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    logger.info("[cron] Starting scheduled data freshness update...");

    // Run all scrapes
    const jobs = await triggerAllScrapes();

    // Check for stale data and create alerts
    const staleAlerts = await checkStaleData();

    // Get updated freshness report
    const report = await getDataFreshness();

    const summary = {
      timestamp: new Date().toISOString(),
      jobsRun: jobs.length,
      completed: jobs.filter((j) => j.status === "completed").length,
      failed: jobs.filter((j) => j.status === "failed").length,
      totalRecordsAdded: jobs.reduce((sum, j) => sum + j.recordsAdded, 0),
      totalRecordsUpdated: jobs.reduce((sum, j) => sum + j.recordsUpdated, 0),
      staleAlerts: staleAlerts.length,
      overallHealth: report.overallHealth,
    };

    logger.info("[cron] Data freshness update complete:", summary);

    return NextResponse.json(summary);
  } catch (error) {
    console.error("[cron] Data freshness update failed:", error);
    return NextResponse.json({ error: "Cron job failed", details: String(error) }, { status: 500 });
  }
}
