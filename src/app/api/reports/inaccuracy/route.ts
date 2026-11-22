/**
 * Inaccuracy Report API Route
 *
 * Handles reporting inaccuracies in existing politician data.
 * Requirement 28.6: Allow users to report inaccuracies for review
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateSession } from "@/services/auth.service";
import { reportInaccuracy, CommunityReportError } from "@/services/community-report.service";
import { ReportEvidenceType } from "@prisma/client";

// Validate evidence type
function isValidEvidenceType(type: string): type is ReportEvidenceType {
  return ["document", "link", "image"].includes(type);
}

// POST /api/reports/inaccuracy - Report an inaccuracy in existing data
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
    const { politicianId, dataField, currentValue, suggestedValue, reason, evidence } = body;

    // Validate required fields
    if (!politicianId) {
      return NextResponse.json(
        { error: "Politician ID is required", code: "MISSING_POLITICIAN_ID" },
        { status: 400 }
      );
    }

    if (!dataField || typeof dataField !== "string") {
      return NextResponse.json(
        { error: "Data field is required", code: "MISSING_DATA_FIELD" },
        { status: 400 }
      );
    }

    if (!currentValue || typeof currentValue !== "string") {
      return NextResponse.json(
        { error: "Current value is required", code: "MISSING_CURRENT_VALUE" },
        { status: 400 }
      );
    }

    if (!suggestedValue || typeof suggestedValue !== "string") {
      return NextResponse.json(
        { error: "Suggested value is required", code: "MISSING_SUGGESTED_VALUE" },
        { status: 400 }
      );
    }

    if (!reason || reason.trim().length < 10) {
      return NextResponse.json(
        {
          error: "Reason must be at least 10 characters",
          code: "INVALID_REASON",
        },
        { status: 400 }
      );
    }

    // Validate evidence
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

      try {
        new URL(item.url);
      } catch {
        return NextResponse.json(
          { error: `Invalid URL: ${item.url}`, code: "INVALID_URL_FORMAT" },
          { status: 400 }
        );
      }
    }

    const report = await reportInaccuracy({
      submitterId: userId,
      politicianId,
      dataField,
      currentValue,
      suggestedValue,
      reason,
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
        message:
          "Inaccuracy report submitted successfully. It will be reviewed before any changes are made.",
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
    console.error("Report inaccuracy error:", error);
    return NextResponse.json({ error: "Failed to submit inaccuracy report" }, { status: 500 });
  }
}
