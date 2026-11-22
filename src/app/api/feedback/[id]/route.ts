/**
 * Individual Feedback API Route
 *
 * Handles operations on individual feedback items (admin only).
 *
 * Requirements: 43.5
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isLocalAdminEnabled } from "@/lib/admin-access";

type FeedbackStatus = "pending" | "reviewed" | "resolved" | "dismissed";

const VALID_STATUSES: FeedbackStatus[] = ["pending", "reviewed", "resolved", "dismissed"];

// ============================================
// GET Handler - Get Single Feedback
// ============================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isLocalAdminEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const adminRole = request.headers.get("x-admin-role");
    if (!adminRole || !["super_admin", "content_moderator"].includes(adminRole)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const feedback = await prisma.feedback.findUnique({
      where: { id },
    });

    if (!feedback) {
      return NextResponse.json({ error: "Feedback not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...feedback,
      attachments: feedback.attachments ? JSON.parse(feedback.attachments as string) : [],
    });
  } catch (error) {
    console.error("Get feedback error:", error);
    return NextResponse.json({ error: "Failed to fetch feedback" }, { status: 500 });
  }
}

// ============================================
// PATCH Handler - Update Feedback Status
// ============================================

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isLocalAdminEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const adminRole = request.headers.get("x-admin-role");
    if (!adminRole || !["super_admin", "content_moderator"].includes(adminRole)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Validate status
    if (body.status && !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};

    if (body.status) {
      updateData.status = body.status;
      updateData.reviewedAt = new Date();
      // In production, get admin ID from auth
      updateData.reviewedBy = request.headers.get("x-admin-id") || "admin";
    }

    if (body.adminNotes !== undefined) {
      updateData.adminNotes = body.adminNotes;
    }

    const feedback = await prisma.feedback.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      feedback: {
        ...feedback,
        attachments: feedback.attachments ? JSON.parse(feedback.attachments as string) : [],
      },
    });
  } catch (error) {
    console.error("Update feedback error:", error);
    return NextResponse.json({ error: "Failed to update feedback" }, { status: 500 });
  }
}

// ============================================
// DELETE Handler - Delete Feedback
// ============================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isLocalAdminEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const adminRole = request.headers.get("x-admin-role");
    if (adminRole !== "super_admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    await prisma.feedback.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete feedback error:", error);
    return NextResponse.json({ error: "Failed to delete feedback" }, { status: 500 });
  }
}
