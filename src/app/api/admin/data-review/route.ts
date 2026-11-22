/**
 * Admin Data Review API Route
 *
 * Handles fetching review queue items for data reviewers.
 *
 * Requirements: 35.8, 35.9, 39.4
 */

import { NextRequest, NextResponse } from "next/server";
import { roleHasPermission, AdminRole } from "@/services/admin-role.service";

// ============================================
// GET - Fetch review queue items
// ============================================

export async function GET(request: NextRequest) {
  try {
    // Check admin authorization
    const adminRole = request.headers.get("x-admin-role") as AdminRole | null;

    if (!adminRole || !roleHasPermission(adminRole, "review_ai_verification")) {
      return NextResponse.json(
        { error: "Unauthorized. Data Reviewer role required." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    // Note: ManualReviewItem model not yet implemented in schema
    // Return empty results for now
    return NextResponse.json({
      items: [],
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 0,
      },
    });
  } catch (error) {
    console.error("Error fetching review items:", error);
    return NextResponse.json({ error: "Failed to fetch review items" }, { status: 500 });
  }
}
