/**
 * Authentication Verification API Route
 *
 * Handles user verification using National ID or Passport.
 * Requirements: 16.1, 16.2, 16.5, 16.6
 */

import { NextRequest, NextResponse } from "next/server";
import {
  createUser,
  verifyUser,
  validateDocumentNumber,
  type VerificationMethod,
} from "@/services/auth.service";
import { cookies } from "next/headers";

const AUTH_COOKIE_NAME = "auth_token";
const COOKIE_MAX_AGE = 24 * 60 * 60; // 24 hours in seconds

export async function POST(request: NextRequest) {
  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) {
    return NextResponse.json(
      { success: false, error: "Identity verification is unavailable" },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { method, documentNumber } = body as {
      method: VerificationMethod;
      documentNumber: string;
    };

    // Validate input
    if (!method || !["national_id", "passport"].includes(method)) {
      return NextResponse.json(
        { success: false, error: "Invalid verification method" },
        { status: 400 }
      );
    }

    if (!documentNumber || typeof documentNumber !== "string") {
      return NextResponse.json(
        { success: false, error: "Document number is required" },
        { status: 400 }
      );
    }

    // Validate document number format
    if (!validateDocumentNumber(documentNumber, method)) {
      return NextResponse.json(
        {
          success: false,
          error:
            method === "national_id"
              ? "Invalid National ID format. Please enter a valid PhilSys ID number."
              : "Invalid Passport format. Please enter a valid Philippine Passport number.",
        },
        { status: 400 }
      );
    }

    // Create a new user first
    const createResult = await createUser();
    if (!createResult.success || !createResult.session || !createResult.token) {
      return NextResponse.json(
        { success: false, error: "Failed to create user session" },
        { status: 500 }
      );
    }

    // Verify the user's identity
    // IMPORTANT: Document number is NOT stored after verification (Requirement 16.5)
    const verifyResult = await verifyUser({
      method,
      documentNumber,
      userId: createResult.session.userId,
    });

    if (!verifyResult.success) {
      // Requirement 16.6: Display clear error message and allow retry
      return NextResponse.json(
        {
          success: false,
          error: verifyResult.error || "Verification failed. Please try again.",
        },
        { status: 400 }
      );
    }

    // Set authentication cookie
    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE_NAME, createResult.token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });

    // Requirement 16.2: Create user session and enable personalized features
    return NextResponse.json({
      success: true,
      user: {
        id: verifyResult.userId,
        isVerified: verifyResult.isVerified,
        verificationMethod: verifyResult.verificationMethod,
      },
    });
  } catch (error) {
    console.error("Verification error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
