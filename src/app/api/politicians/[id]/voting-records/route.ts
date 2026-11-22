/**
 * Voting Records API Route
 *
 * GET /api/politicians/[id]/voting-records
 * Returns voting records for a politician.
 * Requirements: 5.1, 5.2
 */

import { NextRequest, NextResponse } from "next/server";
import { getVotingRecords } from "@/services/legislative.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: politicianId } = await params;
    const searchParams = request.nextUrl.searchParams;

    // Parse pagination
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);

    const result = await getVotingRecords(politicianId, { page, pageSize });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching voting records:", error);
    return NextResponse.json({ error: "Failed to fetch voting records" }, { status: 500 });
  }
}
