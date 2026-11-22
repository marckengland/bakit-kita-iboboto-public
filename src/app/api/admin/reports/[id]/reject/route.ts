/**
 * Admin Report Reject API
 *
 * API endpoint for rejecting a community report.
 * Implements the reject workflow for content moderators.
 *
 * Requirements: 28.5, 28.7, 39.3
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ReportStatus } from "@prisma/client";
import { roleHasPermission, AdminRole } from "@/services/admin-role.service";
import { logAdminAction } from "@/services/blockchain-audit.service";

interface RejectRequestBody {
  reason: string;
}

/**
 * POST /api/admin/reports/[id]/reject
 *
 * Reject a community report that cannot be verified.
 * Changes status to 'rejected' and notifies the submitter.
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
    const body: RejectRequestBody = await request.json();

    if (!body.reason || body.reason.trim().length === 0) {
      return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 });
    }

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

    // Update report status to rejected
    const updatedReport = await prisma.communityReport.update({
      where: { id: reportId },
      data: {
        status: ReportStatus.rejected,
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
    logAdminAction(adminId, "reject_community_report", "submission", reportId, {
      politicianId: report.politicianId,
      politicianName: report.Politician.fullName,
      reportType: report.reportType,
      reason: body.reason,
    });

    // Notify submitter if they exist (Requirement 28.5)
    if (report.submitterId) {
      await prisma.notification.create({
        data: {
          id: crypto.randomUUID(),
          userId: report.submitterId,
          type: "new_bill", // Using new_bill as a general notification type
          title: "Report Not Published",
          message: `Your report about ${report.Politician.fullName} could not be verified. Reason: ${body.reason}`,
          link: `/report?tab=my-reports`,
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
    console.error("Error rejecting report:", error);
    return NextResponse.json({ error: "Failed to reject report" }, { status: 500 });
  }
}
