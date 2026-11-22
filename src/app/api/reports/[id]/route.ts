/**
 * Single Community Report API Route
 *
 * Handles retrieval of individual community reports.
 * Requirements: 28.4, 28.5
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateSession } from "@/services/auth.service";
import { getReportById } from "@/services/community-report.service";

// GET /api/reports/[id] - Get a single report
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    let userId: string | undefined;
    if (token) {
      try {
        const session = await validateSession(token);
        userId = session.userId;
      } catch {
        // Continue as anonymous
      }
    }

    const report = await getReportById(id, userId);

    if (!report) {
      return NextResponse.json({ error: "Report not found or not accessible" }, { status: 404 });
    }

    return NextResponse.json({ report });
  } catch (error) {
    console.error("Get report error:", error);
    return NextResponse.json({ error: "Failed to get report" }, { status: 500 });
  }
}
