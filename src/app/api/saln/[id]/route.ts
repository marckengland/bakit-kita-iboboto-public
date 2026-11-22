/**
 * SALN Record Detail API Route
 *
 * GET /api/saln/[id]
 * Returns a single SALN record with detailed breakdown.
 * Requirement: 15.6 - Allow viewing detailed SALN breakdown
 */

import { NextRequest, NextResponse } from "next/server";
import { getSALNRecord } from "@/services/saln.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: salnId } = await params;

    const record = await getSALNRecord(salnId);

    if (!record) {
      return NextResponse.json({ error: "SALN record not found" }, { status: 404 });
    }

    return NextResponse.json(record);
  } catch (error) {
    console.error("Error fetching SALN record:", error);
    return NextResponse.json({ error: "Failed to fetch SALN record" }, { status: 500 });
  }
}
