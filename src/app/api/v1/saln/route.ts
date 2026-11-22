/**
 * Public API - SALN Endpoint
 *
 * GET /api/v1/saln
 * Returns SALN (Statement of Assets, Liabilities, and Net Worth) records for a politician.
 *
 * **Validates: Requirements 34.1, 34.3, 34.7**
 */

import { NextRequest, NextResponse } from "next/server";
import { withApiAuth, addApiResponseHeaders } from "@/middleware/api-auth.middleware";
import { getSALNHistory, getNetWorthTimeline } from "@/services/saln.service";
import { ApiKey } from "@/services/api-key.service";

/**
 * GET /api/v1/saln
 *
 * Query Parameters:
 * - politicianId: Filter by politician (required)
 * - year: Filter by specific year
 * - includeTimeline: Include net worth timeline data (true/false)
 * - includeDetails: Include detailed breakdown (properties, investments) (true/false)
 */
async function handler(request: NextRequest, _apiKey: ApiKey): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);

  // Politician ID is required
  const politicianId = searchParams.get("politicianId");
  if (!politicianId) {
    return NextResponse.json(
      {
        error: {
          code: "BAD_REQUEST",
          message: "politicianId query parameter is required",
          timestamp: new Date().toISOString(),
        },
      },
      { status: 400 }
    );
  }

  try {
    let salnRecords = await getSALNHistory(politicianId);

    // Apply year filter
    const year = searchParams.get("year");
    if (year) {
      const yearNum = parseInt(year, 10);
      if (!isNaN(yearNum)) {
        salnRecords = salnRecords.filter((r) => r.year === yearNum);
      }
    }

    // Optionally include timeline data
    const includeTimeline = searchParams.get("includeTimeline") === "true";
    let timeline = null;
    if (includeTimeline) {
      timeline = await getNetWorthTimeline(politicianId);
    }

    // Optionally strip detailed breakdown
    const includeDetails = searchParams.get("includeDetails") !== "false";
    const data = salnRecords.map((record) => {
      if (includeDetails) {
        return record;
      }
      // Return summary without detailed breakdown
      return {
        id: record.id,
        politicianId: record.politicianId,
        year: record.year,
        totalAssets: record.totalAssets,
        totalLiabilities: record.totalLiabilities,
        netWorth: record.netWorth,
        declaredSalary: record.declaredSalary,
        anomalyDetected: record.anomalyDetected,
        anomalyDetails: record.anomalyDetails,
        sources: record.sources,
      };
    });

    const response = NextResponse.json({
      data,
      ...(timeline && { timeline }),
      meta: {
        apiVersion: "v1",
        timestamp: new Date().toISOString(),
        totalItems: data.length,
        attribution:
          "Data sourced from official SALN filings. Attribution required for publication.",
      },
    });

    return addApiResponseHeaders(response);
  } catch (error) {
    console.error("Error fetching SALN records:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch SALN records",
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}

export const GET = withApiAuth(handler);
