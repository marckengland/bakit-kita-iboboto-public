/**
 * User Profile API Route
 *
 * Returns the current user's profile information.
 * Requirements: 16.2, 16.3
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateSession, getUser } from "@/services/auth.service";

const AUTH_COOKIE_NAME = "auth_token";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    // Validate the session
    const session = await validateSession(token);

    // Get user details
    const user = await getUser(session.userId);

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        isVerified: user.isVerified,
        verificationMethod: user.verificationMethod,
        verifiedAt: user.verifiedAt?.toISOString() || null,
        language: user.language,
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: user.lastLoginAt?.toISOString() || null,
      },
    });
  } catch (error) {
    // Handle specific authentication errors
    if (error instanceof Error) {
      if (
        error.message.includes("expired") ||
        error.message.includes("not found") ||
        error.message.includes("Invalid")
      ) {
        return NextResponse.json(
          { success: false, error: "Session expired or invalid" },
          { status: 401 }
        );
      }
    }

    console.error("Profile fetch error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch profile" }, { status: 500 });
  }
}
