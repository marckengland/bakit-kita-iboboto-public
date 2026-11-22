/**
 * Campaign Finance API Route
 *
 * GET /api/politicians/[id]/campaign-finance
 * Returns campaign finance records for a politician.
 * Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.7
 */

import { NextRequest, NextResponse } from "next/server";
import { getCampaignFinanceHistory } from "@/services/campaign-finance.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: politicianId } = await params;

    const records = await getCampaignFinanceHistory(politicianId);

    return NextResponse.json(records);
  } catch (error) {
    console.error("Error fetching campaign finance records:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaign finance records" },
      { status: 500 }
    );
  }
}
