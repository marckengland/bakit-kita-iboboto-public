/**
 * SALN API Route
 *
 * GET /api/politicians/[id]/saln
 * Returns SALN records for a politician with anomaly detection.
 * Requirements: 6.1, 6.2, 15.1, 15.2, 15.3
 */

import { NextRequest, NextResponse } from "next/server";
import { getSALNHistory } from "@/services/saln.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: politicianId } = await params;

    const records = await getSALNHistory(politicianId);

    return NextResponse.json(records);
  } catch (error) {
    console.error("Error fetching SALN records:", error);
    return NextResponse.json({ error: "Failed to fetch SALN records" }, { status: 500 });
  }
}
