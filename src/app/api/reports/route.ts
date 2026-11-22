/**
 * Community Reports API Routes
 *
 * Handles community report submission and retrieval.
 * Requirements: 28.1, 28.2, 28.3, 28.4, 28.5, 28.6, 28.7, 28.8
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateSession } from "@/services/auth.service";
import {
  submitReport,
  getUserReports,
  getUserReportStats,
  CommunityReportError,
} from "@/services/community-report.service";
import { ReportType, ReportEvidenceType } from "@prisma/client";

// Validate report type
function isValidReportType(type: string): type is ReportType {
  return ["new_info", "correction", "controversy"].includes(type);
}

// Validate evidence type
function isValidEvidenceType(type: string): type is ReportEvidenceType {
  return ["document", "link", "image"].includes(type);
}

// GET /api/reports - Get user's submitted reports
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await validateSession(token);
    const [reports, stats] = await Promise.all([
      getUserReports(session.userId),
      getUserReportStats(session.userId),
    ]);

    return NextResponse.json({
      reports,
      stats,
    });
  } catch (error) {
    console.error("Get reports error:", error);
    return NextResponse.json({ error: "Failed to get reports" }, { status: 500 });
  }
}

// POST /api/reports - Submit a new community report
// Requirement 28.1: Require supporting evidence
// Requirement 28.2: Queue for verification
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    // Allow anonymous submissions but track authenticated users
    let userId: string | undefined;
    if (token) {
      try {
        const session = await validateSession(token);
        userId = session.userId;
      } catch {
        // Continue as anonymous
      }
    }

    const body = await request.json();
    const { politicianId, reportType, content, evidence } = body;

    // Validate required fields
    if (!politicianId) {
      return NextResponse.json(
        { error: "Politician ID is required", code: "MISSING_POLITICIAN_ID" },
        { status: 400 }
      );
    }

    if (!reportType || !isValidReportType(reportType)) {
      return NextResponse.json(
        {
          error: "Valid report type is required (new_info, correction, controversy)",
          code: "INVALID_REPORT_TYPE",
        },
        { status: 400 }
      );
    }

    if (!content || content.trim().length < 10) {
      return NextResponse.json(
        {
          error: "Report content must be at least 10 characters",
          code: "INVALID_CONTENT",
        },
        { status: 400 }
      );
    }

    // Validate evidence - Requirement 28.1
    if (!evidence || !Array.isArray(evidence) || evidence.length === 0) {
      return NextResponse.json(
        {
          error: "At least one piece of evidence is required",
          code: "EVIDENCE_REQUIRED",
        },
        { status: 400 }
      );
    }

    // Validate each evidence item
    for (const item of evidence) {
      if (!item.type || !isValidEvidenceType(item.type)) {
        return NextResponse.json(
          {
            error: "Each evidence must have a valid type (document, link, image)",
            code: "INVALID_EVIDENCE_TYPE",
          },
          { status: 400 }
        );
      }

      if (!item.url || typeof item.url !== "string") {
        return NextResponse.json(
          { error: "Each evidence must have a URL", code: "INVALID_EVIDENCE_URL" },
          { status: 400 }
        );
      }

      // Basic URL validation
      try {
        new URL(item.url);
      } catch {
        return NextResponse.json(
          { error: `Invalid URL: ${item.url}`, code: "INVALID_URL_FORMAT" },
          { status: 400 }
        );
      }
    }

    const report = await submitReport({
      submitterId: userId,
      politicianId,
      reportType,
      content,
      evidence: evidence.map(
        (e: { type: ReportEvidenceType; url: string; description?: string }) => ({
          type: e.type,
          url: e.url,
          description: e.description,
        })
      ),
    });

    return NextResponse.json(
      {
        report,
        message: "Report submitted successfully. It will be reviewed before publishing.",
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof CommunityReportError) {
      const statusMap: Record<string, number> = {
        EVIDENCE_REQUIRED: 400,
        POLITICIAN_NOT_FOUND: 404,
      };
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusMap[error.code] || 400 }
      );
    }
    console.error("Submit report error:", error);
    return NextResponse.json({ error: "Failed to submit report" }, { status: 500 });
  }
}
