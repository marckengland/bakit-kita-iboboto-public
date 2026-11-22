/**
 * Elections API Route
 *
 * GET /api/politicians/[id]/elections
 * Returns election history for a politician.
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { NextRequest, NextResponse } from "next/server";
import { getElectionHistory } from "@/services/election.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: politicianId } = await params;

    const elections = await getElectionHistory(politicianId);

    return NextResponse.json(elections);
  } catch (error) {
    console.error("Error fetching election history:", error);
    return NextResponse.json({ error: "Failed to fetch election history" }, { status: 500 });
  }
}
