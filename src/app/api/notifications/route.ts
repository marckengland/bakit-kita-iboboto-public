/**
 * Notifications API Route
 *
 * Handles fetching and managing user notifications.
 * Requirements: 19.1, 19.2, 19.3, 19.4
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateSession } from "@/services/auth.service";
import {
  getNotifications,
  markAllAsRead,
  getUnreadCount,
  NotificationType,
} from "@/services/notification.service";

/**
 * GET /api/notifications
 * Fetch notifications for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let session;
    try {
      session = await validateSession(token);
    } catch {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const type = searchParams.get("type") as NotificationType | null;
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const notifications = await getNotifications(session.userId, {
      unreadOnly,
      type: type || undefined,
      limit,
      offset,
    });

    const unreadCount = await getUnreadCount(session.userId);

    return NextResponse.json({
      notifications,
      unreadCount,
      pagination: {
        limit,
        offset,
        hasMore: notifications.length === limit,
      },
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}

/**
 * POST /api/notifications
 * Mark all notifications as read
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let session;
    try {
      session = await validateSession(token);
    } catch {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    if (action === "markAllRead") {
      const count = await markAllAsRead(session.userId);
      return NextResponse.json({ success: true, markedCount: count });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error processing notification action:", error);
    return NextResponse.json({ error: "Failed to process action" }, { status: 500 });
  }
}
