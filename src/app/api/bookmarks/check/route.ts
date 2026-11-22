/**
 * Bookmark Check API Route
 *
 * Checks if a politician is bookmarked by the authenticated user.
 * Requirements: 10.1
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateSession } from "@/services/auth.service";
import { isBookmarked } from "@/services/user-list.service";

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

    if (!politicianId) {
      return NextResponse.json({ error: "Politician ID is required" }, { status: 400 });
    }

    const bookmarked = await isBookmarked(session.userId, politicianId);

    return NextResponse.json({ isBookmarked: bookmarked });
  } catch (error) {
    console.error("Check bookmark error:", error);
    return NextResponse.json({ error: "Failed to check bookmark status" }, { status: 500 });
  }
}
