/**
 * SALN Timeline API Route
 *
 * GET /api/politicians/[id]/saln/timeline
 * Returns net worth timeline data for charts.
 * Requirement: 6.3 - Display timeline/chart showing net worth changes over time
 */

import { NextRequest, NextResponse } from "next/server";
import { getNetWorthTimeline } from "@/services/saln.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: politicianId } = await params;

    const timeline = await getNetWorthTimeline(politicianId);

    return NextResponse.json(timeline);
  } catch (error) {
    console.error("Error fetching SALN timeline:", error);
    return NextResponse.json({ error: "Failed to fetch SALN timeline" }, { status: 500 });
  }
}
