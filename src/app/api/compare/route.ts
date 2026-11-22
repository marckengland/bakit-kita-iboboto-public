/**
 * Comparison API Route
 *
 * Handles politician comparison requests.
 * Requirements: 9.1, 9.2, 9.3, 9.4
 */

import { NextRequest, NextResponse } from "next/server";
import { comparePoliticians, ComparisonValidationError } from "@/services/comparison.service";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const ids = searchParams.get("ids");

    if (!ids) {
      return NextResponse.json(
        { error: "Missing politician IDs. Use ?ids=id1,id2,id3" },
        { status: 400 }
      );
    }

    const politicianIds = ids.split(",").filter((id) => id.trim());

    const result = await comparePoliticians(politicianIds);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ComparisonValidationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }

    console.error("Comparison error:", error);
    return NextResponse.json({ error: "Failed to compare politicians" }, { status: 500 });
  }
}
