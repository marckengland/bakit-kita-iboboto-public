/**
 * Conflicts of Interest API Route
 * GET /api/politicians/[id]/conflicts
 * Returns conflict of interest detection results for a politician.
 */

import { NextRequest, NextResponse } from "next/server";
import { getReleasedProfile } from "@/lib/release-data";
import { detectConflictsOfInterest } from "@/services/conflict-of-interest.service";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reviewedBatch = getReleasedProfile(id);
  if (reviewedBatch) {
    return NextResponse.json({
      availability: "not_reviewed",
      hasConflicts: null,
      conflicts: [],
      reviewedBatch,
    });
  }

  try {
    const conflicts = await detectConflictsOfInterest(id);
    return NextResponse.json(conflicts);
  } catch (error) {
    console.error("Failed to detect conflicts:", error);
    return NextResponse.json(
      { hasConflicts: false, conflicts: [], summary: { total: 0, bySeverity: {}, byType: {} } },
      { status: 200 }
    );
  }
}
