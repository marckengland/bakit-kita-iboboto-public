/**
 * Admin Data Review Approve API Route
 *
 * Handles approving data submissions after manual review.
 *
 * Requirements: 35.8, 35.9, 39.4
 */

import { NextRequest, NextResponse } from "next/server";
// import { prisma } from "@/lib/prisma";
import { roleHasPermission, AdminRole } from "@/services/admin-role.service";
// import { logAdminAction } from "@/services/blockchain-audit.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: _id } = await params;

    // Check admin authorization
    const adminRole = request.headers.get("x-admin-role") as AdminRole | null;
    // adminId will be used when Prisma models are added
    void request.headers.get("x-admin-id");

    if (!adminRole || !roleHasPermission(adminRole, "approve_data_change")) {
      return NextResponse.json(
        { error: "Unauthorized. Data Reviewer role required." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { notes: _notes } = body;

    // Find the review item
    // TODO: manualReviewItem and dataSubmission models need to be added to Prisma schema
    // For now, return not implemented
    return NextResponse.json(
      { error: "Data review feature not yet implemented - Prisma models pending" },
      { status: 501 }
    );

    /* Original implementation - uncomment when models are added:
    const reviewItem = await prisma.manualReviewItem.findUnique({
      where: { id },
      include: { submission: true },
    });

    if (!reviewItem) {
      return NextResponse.json(
        { error: "Review item not found" },
        { status: 404 }
      );
    }

    if (reviewItem.status !== "pending") {
      return NextResponse.json(
        { error: "Review item has already been processed" },
        { status: 400 }
      );
    }


    // Update review item and submission status
    await prisma.$transaction([
      prisma.manualReviewItem.update({
        where: { id },
        data: {
          status: "approved",
          reviewedBy: adminId,
          reviewedAt: new Date(),
          reviewNotes: notes,
        },
      }),
      prisma.dataSubmission.update({
        where: { id: reviewItem.submissionId },
        data: { status: "verified" },
      }),
    ]);

    // Log to blockchain audit
    logAdminAction(
      adminId,
      "approve_data_submission",
      reviewItem.submission.type,
      reviewItem.submissionId,
      {
        reviewItemId: id,
        notes,
        confidence: Number(reviewItem.confidence),
      }
    );

    return NextResponse.json({
      success: true,
      message: "Submission approved and published",
    });
    */
  } catch (error) {
    console.error("Error approving submission:", error);
    return NextResponse.json({ error: "Failed to approve submission" }, { status: 500 });
  }
}
