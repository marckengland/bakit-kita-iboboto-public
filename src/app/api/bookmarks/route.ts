/**
 * Bookmarks API Routes
 *
 * Handles bookmark CRUD operations for authenticated users.
 * Requirements: 10.1, 10.2, 10.3
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateSession } from "@/services/auth.service";
import {
  addBookmark,
  removeBookmark,
  getBookmarks,
  UserListError,
} from "@/services/user-list.service";

// GET /api/bookmarks - Get all bookmarks for authenticated user
// Requirement 10.2: Display all saved politicians with quick access
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await validateSession(token);
    const bookmarks = await getBookmarks(session.userId);

    return NextResponse.json({
      bookmarks,
      count: bookmarks.length,
    });
  } catch (error) {
    console.error("Get bookmarks error:", error);
    return NextResponse.json({ error: "Failed to get bookmarks" }, { status: 500 });
  }
}

// POST /api/bookmarks - Add a bookmark
// Requirement 10.1: Save bookmark when user bookmarks a politician
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await validateSession(token);

    const body = await request.json();
    const { politicianId } = body;

    if (!politicianId) {
      return NextResponse.json({ error: "Politician ID is required" }, { status: 400 });
    }

    const bookmark = await addBookmark({
      userId: session.userId,
      politicianId,
    });

    return NextResponse.json({ bookmark }, { status: 201 });
  } catch (error) {
    if (error instanceof UserListError) {
      const statusMap: Record<string, number> = {
        USER_NOT_FOUND: 404,
        POLITICIAN_NOT_FOUND: 404,
        ALREADY_BOOKMARKED: 409,
      };
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusMap[error.code] || 400 }
      );
    }
    console.error("Add bookmark error:", error);
    return NextResponse.json({ error: "Failed to add bookmark" }, { status: 500 });
  }
}

// DELETE /api/bookmarks - Remove a bookmark
// Requirement 10.3: Immediately remove politician from saved list
export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await validateSession(token);

    const body = await request.json();
    const { politicianId } = body;

    if (!politicianId) {
      return NextResponse.json({ error: "Politician ID is required" }, { status: 400 });
    }

    await removeBookmark({
      userId: session.userId,
      politicianId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof UserListError) {
      const statusMap: Record<string, number> = {
        BOOKMARK_NOT_FOUND: 404,
      };
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusMap[error.code] || 400 }
      );
    }
    console.error("Remove bookmark error:", error);
    return NextResponse.json({ error: "Failed to remove bookmark" }, { status: 500 });
  }
}
