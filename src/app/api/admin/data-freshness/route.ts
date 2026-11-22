/**
 * Admin Data Freshness API Route
 *
 * Handles fetching data freshness status for all sources.
 *
 * Requirements: 20.8
 */

import { NextRequest, NextResponse } from "next/server";
import { roleHasPermission, AdminRole } from "@/services/admin-role.service";
import { getDataFreshness, getAllScheduleConfigs } from "@/services/data-pipeline.service";
import prisma from "@/lib/prisma";

// ============================================
// GET - Fetch data freshness report
// ============================================

export async function GET(request: NextRequest) {
  try {
    // Check admin authorization
    const adminRole = request.headers.get("x-admin-role") as AdminRole | null;

    if (!adminRole || !roleHasPermission(adminRole, "view_audit_logs")) {
      return NextResponse.json({ error: "Unauthorized. Admin role required." }, { status: 403 });
    }

    let freshnessReport;
    try {
      freshnessReport = await getDataFreshness();
    } catch (freshnessError) {
      console.error("Error getting data freshness:", freshnessError);
      // Return a default report if freshness check fails
      freshnessReport = {
        generatedAt: new Date(),
        overallHealth: "healthy" as const,
        sources: [],
        totalRecordsLastDay: 0,
        failedJobsLastDay: 0,
      };
    }

    let scheduleConfigs: ReturnType<typeof getAllScheduleConfigs> = [];
    try {
      scheduleConfigs = getAllScheduleConfigs();
    } catch {
      scheduleConfigs = [];
    }

    // Get actual record counts from database
    const [senateBillCount, houseBillCount, politicianCount, electionCount, dataFreshnessRecords] =
      await Promise.all([
        prisma.bill.count({ where: { chamber: "senate" } }),
        prisma.bill.count({ where: { chamber: "house" } }),
        prisma.politician.count(),
        prisma.electionResultRecord.count(),
        prisma.dataFreshness.findMany(),
      ]);

    // Build a map of last updated times from database
    const dbFreshness: Record<string, Date> = {};
    for (const record of dataFreshnessRecords) {
      dbFreshness[record.dataCategory] = record.lastUpdated;
    }

    const recordCounts: Record<string, number> = {
      senate: senateBillCount,
      house: houseBillCount,
      politicians: politicianCount,
      comelec: electionCount,
      dbm: 0,
      coa: 0,
      courts: 0,
      ombudsman: 0,
    };

    // Transform to match frontend expectations
    const sources = freshnessReport.sources.map((source) => {
      const config = scheduleConfigs.find((c) => c.source === source.source);

      // Check database freshness first, then fall back to in-memory job data
      const dbLastUpdated = dbFreshness[source.source];

      // Safely convert dates to ISO strings
      let lastUpdated: string | null = null;
      if (dbLastUpdated) {
        lastUpdated =
          dbLastUpdated instanceof Date ? dbLastUpdated.toISOString() : String(dbLastUpdated);
      } else if (source.lastSuccessfulScrape) {
        lastUpdated =
          source.lastSuccessfulScrape instanceof Date
            ? source.lastSuccessfulScrape.toISOString()
            : String(source.lastSuccessfulScrape);
      }

      let nextScheduledUpdate: string | null = null;
      if (source.nextScheduledScrape) {
        nextScheduledUpdate =
          source.nextScheduledScrape instanceof Date
            ? source.nextScheduledScrape.toISOString()
            : String(source.nextScheduledScrape);
      }

      // Recalculate staleness based on DB data
      const staleDaysThreshold = config?.staleDaysThreshold || 7;
      let staleDays = source.staleDays;
      let isStale = source.isStale;

      if (dbLastUpdated) {
        const now = new Date();
        const diffMs = now.getTime() - dbLastUpdated.getTime();
        staleDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        isStale = staleDays > staleDaysThreshold;
      }

      return {
        source: source.source,
        lastUpdated,
        recordCount: recordCounts[source.source] || 0,
        isStale,
        staleDays: staleDays === -1 ? 999 : staleDays,
        nextScheduledUpdate,
        isEnabled: config?.enabled ?? true,
      };
    });

    // Calculate stale source count
    const staleSourceCount = sources.filter((s) => s.isStale).length;

    // Find last full update (most recent successful scrape across all sources)
    // Handle dates that might be strings from cache
    const lastFullUpdate = freshnessReport.sources
      .filter((s) => s.lastSuccessfulScrape)
      .map((s) => {
        const date = s.lastSuccessfulScrape!;
        return date instanceof Date ? date : new Date(date);
      })
      .sort((a, b) => b.getTime() - a.getTime())[0];

    let lastFullUpdateStr: string | null = null;
    if (lastFullUpdate) {
      lastFullUpdateStr =
        lastFullUpdate instanceof Date ? lastFullUpdate.toISOString() : String(lastFullUpdate);
    }

    // Calculate total records
    const totalRecords = Object.values(recordCounts).reduce((a, b) => a + b, 0);

    return NextResponse.json({
      sources,
      overallHealth:
        freshnessReport.overallHealth === "degraded" ? "warning" : freshnessReport.overallHealth,
      lastFullUpdate: lastFullUpdateStr,
      totalRecords,
      staleSourceCount,
    });
  } catch (error) {
    console.error("Error fetching data freshness:", error);
    return NextResponse.json(
      { error: "Failed to fetch data freshness information" },
      { status: 500 }
    );
  }
}
