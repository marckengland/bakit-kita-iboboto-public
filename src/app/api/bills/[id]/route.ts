/**
 * Bill Details API Route
 *
 * GET /api/bills/[id]
 * Returns full bill details including authors and sources.
 * Requirement: 3.3 - Navigate to detailed view showing full bill content
 */

import { NextRequest, NextResponse } from "next/server";
import { getBillById } from "@/services/legislative.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id: billId } = await params;

    const bill = await getBillById(billId);

    if (!bill) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    }

    return NextResponse.json(bill);
  } catch (error) {
    console.error("Error fetching bill:", error);
    return NextResponse.json({ error: "Failed to fetch bill" }, { status: 500 });
  }
}
