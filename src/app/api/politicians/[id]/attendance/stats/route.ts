/**
 * Attendance Stats API Route
 *
 * GET /api/politicians/[id]/attendance/stats
 * Returns attendance statistics for a politician.
 * Requirements: 5.3, 5.4, 5.5
 */

import { NextRequest, NextResponse } from "next/server";
import { getReleasedProfile } from "@/lib/release-data";
import { getAttendanceStats } from "@/services/legislative.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: politicianId } = await params;

    const reviewedBatch = getReleasedProfile(politicianId, null);
    if (reviewedBatch) {
      return NextResponse.json({ availability: "not_reviewed", stats: null, reviewedBatch });
    }

    const stats = await getAttendanceStats(politicianId);

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching attendance stats:", error);
    return NextResponse.json({ error: "Failed to fetch attendance stats" }, { status: 500 });
  }
}
