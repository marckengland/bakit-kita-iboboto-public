/**
 * Voting List Check API Route
 *
 * Checks if a politician is in the user's voting list.
 * Requirements: 17.1
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateSession } from "@/services/auth.service";
import { isInVotingList } from "@/services/user-list.service";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await validateSession(token);

    const { searchParams } = new URL(request.url);
    const politicianId = searchParams.get("politicianId");
    const electionYear = searchParams.get("electionYear");

    if (!politicianId || !electionYear) {
      return NextResponse.json(
        { error: "Politician ID and election year are required" },
        { status: 400 }
      );
    }

    const year = parseInt(electionYear, 10);
    if (isNaN(year)) {
      return NextResponse.json({ error: "Invalid election year" }, { status: 400 });
    }

    const inList = await isInVotingList(session.userId, year, politicianId);

    return NextResponse.json({ isInList: inList });
  } catch (error) {
    console.error("Check voting list error:", error);
    return NextResponse.json({ error: "Failed to check voting list status" }, { status: 500 });
  }
}
