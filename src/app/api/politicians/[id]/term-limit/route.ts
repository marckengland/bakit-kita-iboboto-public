/**
 * Term Limit API Route
 *
 * GET /api/politicians/[id]/term-limit
 * Returns term limit status for a politician.
 * Requirements: 46.1, 46.2, 46.3, 46.4, 46.5, 46.6
 */

import { NextRequest, NextResponse } from "next/server";
import { getTermLimitStatus } from "@/services/term-limit.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: politicianId } = await params;

    const termLimitStatus = await getTermLimitStatus(politicianId);

    if (!termLimitStatus) {
      return NextResponse.json({ error: "Politician not found" }, { status: 404 });
    }

    return NextResponse.json(termLimitStatus);
  } catch (error) {
    console.error("Error fetching term limit status:", error);
    return NextResponse.json({ error: "Failed to fetch term limit status" }, { status: 500 });
  }
}
