/**
 * Single Notification API Route
 *
 * Handles marking individual notifications as read and deletion.
 * Requirements: 19.4
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateSession } from "@/services/auth.service";
import {
  markAsReadForUser,
  deleteNotificationForUser,
  NotificationError,
} from "@/services/notification.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/notifications/[id]
 * Mark a notification as read
 */
export async function PATCH(_request: NextRequest, { params }: RouteParams) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let userId: string;
    try {
      const session = await validateSession(token);
      if (typeof session.userId !== "string" || !session.userId.trim()) {
        return NextResponse.json({ error: "Invalid session" }, { status: 401 });
      }
      userId = session.userId;
    } catch {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const { id } = await params;
    const notification = await markAsReadForUser(id, userId);

    return NextResponse.json({ notification });
  } catch (error) {
    if (error instanceof NotificationError && error.code === "NOTIFICATION_NOT_FOUND") {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }
    console.error("Error marking notification as read:", error);
    return NextResponse.json({ error: "Failed to mark notification as read" }, { status: 500 });
  }
}

/**
 * DELETE /api/notifications/[id]
 * Delete a notification
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let userId: string;
    try {
      const session = await validateSession(token);
      if (typeof session.userId !== "string" || !session.userId.trim()) {
        return NextResponse.json({ error: "Invalid session" }, { status: 401 });
      }
      userId = session.userId;
    } catch {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const { id } = await params;
    await deleteNotificationForUser(id, userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof NotificationError && error.code === "NOTIFICATION_NOT_FOUND") {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }
    console.error("Error deleting notification:", error);
    return NextResponse.json({ error: "Failed to delete notification" }, { status: 500 });
  }
}
