/**
 * User Settings API Route
 *
 * Updates user preferences and settings.
 * Requirements: 16.2, 16.3
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateSession } from "@/services/auth.service";
import prisma from "@/lib/prisma";

const AUTH_COOKIE_NAME = "auth_token";

const VALID_LANGUAGES = ["en", "fil", "ceb", "ilo", "hil"];

export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    // Validate the session
    const session = await validateSession(token);

    // Parse request body
    const body = await request.json();
    const { language } = body as { language?: string };

    // Validate language if provided
    if (language && !VALID_LANGUAGES.includes(language)) {
      return NextResponse.json({ success: false, error: "Invalid language" }, { status: 400 });
    }

    // Update user settings
    const updateData: { language?: string } = {};
    if (language) {
      updateData.language = language;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid settings to update" },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.userId },
      data: updateData,
      select: {
        id: true,
        language: true,
      },
    });

    return NextResponse.json({
      success: true,
      user: updatedUser,
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

    console.error("Settings update error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
