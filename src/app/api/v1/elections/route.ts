/**
 * Public API - Elections Endpoint
 *
 * GET /api/v1/elections
 * Returns election history for a politician.
 *
 * **Validates: Requirements 34.1, 34.3, 34.7**
 */

import { NextRequest, NextResponse } from "next/server";
import { withApiAuth, addApiResponseHeaders } from "@/middleware/api-auth.middleware";
import { getElectionHistory } from "@/services/election.service";
import { ApiKey } from "@/services/api-key.service";

/**
 * GET /api/v1/elections
 *
 * Query Parameters:
 * - politicianId: Filter by politician (required)
 * - year: Filter by election year
 * - result: Filter by result (won, lost)
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
    let elections = await getElectionHistory(politicianId);

    // Apply optional filters
    const year = searchParams.get("year");
    if (year) {
      const yearNum = parseInt(year, 10);
      if (!isNaN(yearNum)) {
        elections = elections.filter((e) => e.electionYear === yearNum);
      }
    }

    const result = searchParams.get("result");
    if (result && (result === "won" || result === "lost")) {
      elections = elections.filter((e) => e.result === result);
    }

    const response = NextResponse.json({
      data: elections,
      meta: {
        apiVersion: "v1",
        timestamp: new Date().toISOString(),
        totalItems: elections.length,
        attribution:
          "Data sourced from COMELEC official records. Attribution required for publication.",
      },
    });

    return addApiResponseHeaders(response);
  } catch (error) {
    console.error("Error fetching elections:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch election history",
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}

export const GET = withApiAuth(handler);
