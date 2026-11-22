/**
 * Logout API Route
 *
 * Clears the user session while preserving locally stored preferences.
 * Requirement: 16.4
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AuthenticationError, invalidateSession } from "@/services/auth.service";

const AUTH_COOKIE_NAME = "auth_token";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

    if (token) {
      // Invalidate the session on the server
      await invalidateSession(token);
    }

    // Clear the authentication cookie
    // Note: Local storage preferences (bookmarks, etc.) are preserved on the client
    cookieStore.delete(AUTH_COOKIE_NAME);

    return NextResponse.json({ success: true });
  } catch (error) {
    // Clear the browser cookie, but report failure if server revocation failed.
    const cookieStore = await cookies();
    cookieStore.delete(AUTH_COOKIE_NAME);

    const unavailable = error instanceof AuthenticationError && error.code === "AUTH_UNAVAILABLE";
    console.error("Logout error:", unavailable ? "AUTH_UNAVAILABLE" : "LOGOUT_FAILED");
    return NextResponse.json(
      { success: false, error: unavailable ? "Authentication unavailable" : "Failed to log out" },
      { status: unavailable ? 503 : 500 }
    );
  }
}
