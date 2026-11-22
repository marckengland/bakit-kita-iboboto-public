/**
 * Politician Community Reports API Route
 *
 * Retrieves verified community reports for a specific politician.
 * Requirements: 28.4, 28.8
 */

import { NextRequest, NextResponse } from "next/server";
import { getVerifiedReportsForPolitician } from "@/services/community-report.service";

// GET /api/reports/politician/[id] - Get verified reports for a politician
// Requirement 28.4: Publish verified reports with attribution
// Requirement 28.8: Clearly distinguish community-sourced info
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const reports = await getVerifiedReportsForPolitician(id);

    return NextResponse.json({
      reports,
      count: reports.length,
      isCommunitySourced: true, // Requirement 28.8: Mark as community-sourced
    });
  } catch (error) {
    console.error("Get politician reports error:", error);
    return NextResponse.json({ error: "Failed to get reports" }, { status: 500 });
  }
}
