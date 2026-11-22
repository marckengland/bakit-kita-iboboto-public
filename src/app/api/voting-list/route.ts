/**
 * Voting List API Routes
 *
 * Handles voting list CRUD operations for authenticated users.
 * Requirements: 17.1, 17.2, 17.3, 17.5
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateSession } from "@/services/auth.service";
import {
  addToVotingList,
  removeFromVotingList,
  getVotingListByLevel,
  getAllVotingLists,
  UserListError,
} from "@/services/user-list.service";

// GET /api/voting-list - Get voting list for authenticated user
// Requirement 17.2: Display all selected politicians organized by position level
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await validateSession(token);

    const { searchParams } = new URL(request.url);
    const electionYear = searchParams.get("electionYear");

    if (electionYear) {
      // Get voting list for specific year organized by level
      const year = parseInt(electionYear, 10);
      if (isNaN(year)) {
        return NextResponse.json({ error: "Invalid election year" }, { status: 400 });
      }

      const votingListByLevel = await getVotingListByLevel(session.userId, year);

      // Calculate total count
      const totalCount = Object.values(votingListByLevel).reduce(
        (sum, items) => sum + items.length,
        0
      );

      return NextResponse.json({
        electionYear: year,
        byLevel: votingListByLevel,
        totalCount,
      });
    } else {
      // Get all voting lists
      const votingLists = await getAllVotingLists(session.userId);
      return NextResponse.json({ votingLists });
    }
  } catch (error) {
    if (error instanceof UserListError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    console.error("Get voting list error:", error);
    return NextResponse.json({ error: "Failed to get voting list" }, { status: 500 });
  }
}

// POST /api/voting-list - Add to voting list
// Requirement 17.1: Save selection to account when logged-in user adds politician
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await validateSession(token);

    const body = await request.json();
    const { politicianId, position, electionYear } = body;

    if (!politicianId || !position || !electionYear) {
      return NextResponse.json(
        { error: "Politician ID, position, and election year are required" },
        { status: 400 }
      );
    }

    const item = await addToVotingList({
      userId: session.userId,
      politicianId,
      position,
      electionYear,
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    if (error instanceof UserListError) {
      const statusMap: Record<string, number> = {
        POLITICIAN_NOT_FOUND: 404,
        ALREADY_IN_LIST: 409,
        INVALID_YEAR: 400,
      };
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusMap[error.code] || 400 }
      );
    }
    console.error("Add to voting list error:", error);
    return NextResponse.json({ error: "Failed to add to voting list" }, { status: 500 });
  }
}

// DELETE /api/voting-list - Remove from voting list
// Requirement 17.3: Immediately update list when user removes politician
export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await validateSession(token);

    const body = await request.json();
    const { politicianId, electionYear } = body;

    if (!politicianId || !electionYear) {
      return NextResponse.json(
        { error: "Politician ID and election year are required" },
        { status: 400 }
      );
    }

    await removeFromVotingList({
      userId: session.userId,
      politicianId,
      electionYear,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof UserListError) {
      const statusMap: Record<string, number> = {
        NOT_IN_LIST: 404,
        INVALID_YEAR: 400,
      };
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusMap[error.code] || 400 }
      );
    }
    console.error("Remove from voting list error:", error);
    return NextResponse.json({ error: "Failed to remove from voting list" }, { status: 500 });
  }
}
