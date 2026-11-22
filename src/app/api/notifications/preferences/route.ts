/**
 * Notification Preferences API Route
 *
 * Handles fetching and updating user notification preferences.
 * Requirements: 19.5, 19.6
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateSession } from "@/services/auth.service";
import { getOrCreatePreferences, updatePreferences } from "@/services/notification.service";

/**
 * GET /api/notifications/preferences
 * Fetch notification preferences for the authenticated user
 */
export async function GET() {
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

    const preferences = await getOrCreatePreferences(session.userId);

    return NextResponse.json({ preferences });
  } catch (error) {
    console.error("Error fetching notification preferences:", error);
    return NextResponse.json({ error: "Failed to fetch preferences" }, { status: 500 });
  }
}

/**
 * PATCH /api/notifications/preferences
 * Update notification preferences
 */
export async function PATCH(request: NextRequest) {
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
    const { email, inApp, newControversy, newBill, billPassed, redFlag, electionReminder } = body;

    // Build updates object with only provided fields
    const updates: Record<string, boolean> = {};
    if (typeof email === "boolean") {
      updates.email = email;
    }
    if (typeof inApp === "boolean") {
      updates.inApp = inApp;
    }
    if (typeof newControversy === "boolean") {
      updates.newControversy = newControversy;
    }
    if (typeof newBill === "boolean") {
      updates.newBill = newBill;
    }
    if (typeof billPassed === "boolean") {
      updates.billPassed = billPassed;
    }
    if (typeof redFlag === "boolean") {
      updates.redFlag = redFlag;
    }
    if (typeof electionReminder === "boolean") {
      updates.electionReminder = electionReminder;
    }

    const preferences = await updatePreferences(session.userId, updates);

    return NextResponse.json({ preferences });
  } catch (error) {
    console.error("Error updating notification preferences:", error);
    return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 });
  }
}
