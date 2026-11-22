/**
 * Admin Report Publish API
 *
 * API endpoint for publishing (verifying) a community report.
 * Implements the publish workflow for content moderators.
 *
 * Requirements: 28.4, 28.7, 39.3
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ReportStatus } from "@prisma/client";
import { roleHasPermission, AdminRole } from "@/services/admin-role.service";
import { logAdminAction } from "@/services/blockchain-audit.service";

interface PublishRequestBody {
  notes?: string;
}

/**
 * POST /api/admin/reports/[id]/publish
 *
 * Publish a community report after verification.
 * Changes status to 'verified' and logs the action.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: reportId } = await params;

    // Check admin role
    const adminRole = request.headers.get("x-admin-role") as AdminRole | null;
    const adminId = request.headers.get("x-admin-id") || "system";

    if (!adminRole || !roleHasPermission(adminRole, "moderate_content")) {
      return NextResponse.json(
        { error: "Unauthorized: Content Moderator role required" },
        { status: 403 }
      );
    }

    // Parse request body
    const body: PublishRequestBody = await request.json().catch(() => ({}));

    // Find the report
    const report = await prisma.communityReport.findUnique({
      where: { id: reportId },
      include: {
        Politician: {
          select: { fullName: true },
        },
      },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    if (report.status !== ReportStatus.pending) {
      return NextResponse.json({ error: "Report has already been processed" }, { status: 400 });
    }

    // Update report status to verified (published)
    const updatedReport = await prisma.communityReport.update({
      where: { id: reportId },
      data: {
        status: ReportStatus.verified,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
      include: {
        Politician: {
          select: { fullName: true, photo: true },
        },
        ReportEvidence: true,
        VerificationResult: true,
      },
    });

    // Log to blockchain audit
    logAdminAction(adminId, "publish_community_report", "submission", reportId, {
      politicianId: report.politicianId,
      politicianName: report.Politician.fullName,
      reportType: report.reportType,
      notes: body.notes,
    });

    // Notify submitter if they exist
    if (report.submitterId) {
      await prisma.notification.create({
        data: {
          id: crypto.randomUUID(),
          userId: report.submitterId,
          type: "new_bill", // Using new_bill as a general notification type
          title: "Report Published",
          message: `Your report about ${report.Politician.fullName} has been verified and published.`,
          link: `/politicians/${report.politicianId}`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      report: {
        id: updatedReport.id,
        status: updatedReport.status,
        reviewedBy: updatedReport.reviewedBy,
        reviewedAt: updatedReport.reviewedAt?.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error publishing report:", error);
    return NextResponse.json({ error: "Failed to publish report" }, { status: 500 });
  }
}
