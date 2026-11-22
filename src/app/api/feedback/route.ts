/**
 * Feedback API Route
 *
 * Handles user feedback submissions including bug reports, feature suggestions,
 * data corrections, and general feedback.
 *
 * Requirements: 43.1, 43.2, 43.3, 43.4, 43.6
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isLocalAdminEnabled } from "@/lib/admin-access";

// ============================================
// Types
// ============================================

type FeedbackCategory =
  | "bug_report"
  | "feature_suggestion"
  | "data_correction"
  | "general_feedback";

interface FeedbackAttachment {
  name: string;
  type: string;
  dataUrl: string;
}

interface FeedbackSubmission {
  category: FeedbackCategory;
  subject: string;
  description: string;
  sourceUrl?: string;
  attachments?: FeedbackAttachment[];
  isAnonymous: boolean;
  email?: string;
}

// ============================================
// Validation
// ============================================

const VALID_CATEGORIES: FeedbackCategory[] = [
  "bug_report",
  "feature_suggestion",
  "data_correction",
  "general_feedback",
];

function validateFeedback(data: unknown): {
  valid: boolean;
  error?: string;
  data?: FeedbackSubmission;
} {
  if (!data || typeof data !== "object") {
    return { valid: false, error: "Invalid request body" };
  }

  const submission = data as Record<string, unknown>;

  // Validate category
  if (!submission.category || !VALID_CATEGORIES.includes(submission.category as FeedbackCategory)) {
    return { valid: false, error: "Invalid feedback category" };
  }

  // Validate subject
  if (
    !submission.subject ||
    typeof submission.subject !== "string" ||
    submission.subject.trim().length === 0
  ) {
    return { valid: false, error: "Subject is required" };
  }

  if (submission.subject.length > 100) {
    return { valid: false, error: "Subject must be 100 characters or less" };
  }

  // Validate description
  if (
    !submission.description ||
    typeof submission.description !== "string" ||
    submission.description.trim().length < 10
  ) {
    return { valid: false, error: "Description must be at least 10 characters" };
  }

  if (submission.description.length > 2000) {
    return { valid: false, error: "Description must be 2000 characters or less" };
  }

  // Validate email if provided
  if (
    submission.email &&
    typeof submission.email === "string" &&
    submission.email.trim().length > 0
  ) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(submission.email)) {
      return { valid: false, error: "Invalid email address" };
    }
  }

  // Validate sourceUrl for data corrections
  if (submission.category === "data_correction") {
    if (
      !submission.sourceUrl ||
      typeof submission.sourceUrl !== "string" ||
      submission.sourceUrl.trim().length === 0
    ) {
      return { valid: false, error: "Source URL is required for data corrections" };
    }
    try {
      new URL(submission.sourceUrl as string);
    } catch {
      return { valid: false, error: "Invalid source URL" };
    }
  }

  // Validate attachments if provided
  if (submission.attachments) {
    if (!Array.isArray(submission.attachments)) {
      return { valid: false, error: "Attachments must be an array" };
    }

    if (submission.attachments.length > 5) {
      return { valid: false, error: "Maximum 5 attachments allowed" };
    }

    for (const attachment of submission.attachments) {
      if (!attachment.name || !attachment.type || !attachment.dataUrl) {
        return { valid: false, error: "Invalid attachment format" };
      }
    }
  }

  return {
    valid: true,
    data: {
      category: submission.category as FeedbackCategory,
      subject: (submission.subject as string).trim(),
      description: (submission.description as string).trim(),
      sourceUrl: submission.sourceUrl ? (submission.sourceUrl as string).trim() : undefined,
      attachments: submission.attachments as FeedbackAttachment[] | undefined,
      isAnonymous: Boolean(submission.isAnonymous),
      email: submission.email as string | undefined,
    },
  };
}

// ============================================
// POST Handler - Submit Feedback
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = validateFeedback(body);

    if (!validation.valid || !validation.data) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { category, subject, description, sourceUrl, attachments, isAnonymous, email } =
      validation.data;

    // Get user info from headers if available (set by auth middleware)
    const userId = request.headers.get("x-user-id");
    const userAgent = request.headers.get("user-agent") || "Unknown";
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      "Unknown";

    // Append source URL to description for data corrections (no dedicated column)
    const finalDescription = sourceUrl ? `${description}\n\nSource: ${sourceUrl}` : description;

    // Create feedback record
    const feedback = await prisma.feedback.create({
      data: {
        id: crypto.randomUUID(),
        category,
        subject,
        description: finalDescription,
        attachments: attachments ? JSON.stringify(attachments) : undefined,
        isAnonymous,
        email: isAnonymous ? null : email,
        userId: isAnonymous ? null : userId,
        userAgent,
        ipAddress: isAnonymous ? null : ipAddress,
        status: "pending",
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Thank you for your feedback! We appreciate your input and will review it shortly.",
      feedbackId: feedback.id,
    });
  } catch (error) {
    console.error("Feedback submission error:", error);
    return NextResponse.json(
      { error: "Failed to submit feedback. Please try again." },
      { status: 500 }
    );
  }
}

// ============================================
// GET Handler - List Feedback (Admin only)
// ============================================

export async function GET(request: NextRequest) {
  try {
    // Check for admin authorization
    if (!isLocalAdminEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const adminRole = request.headers.get("x-admin-role");
    if (!adminRole || !["super_admin", "content_moderator"].includes(adminRole)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const category = searchParams.get("category") as FeedbackCategory | null;
    const status = searchParams.get("status") as
      | "pending"
      | "reviewed"
      | "resolved"
      | "dismissed"
      | null;

    const where: Record<string, unknown> = {};
    if (category && VALID_CATEGORIES.includes(category)) {
      where.category = category;
    }
    if (status) {
      where.status = status;
    }

    const [feedbacks, total] = await Promise.all([
      prisma.feedback.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.feedback.count({ where }),
    ]);

    return NextResponse.json({
      feedbacks: feedbacks.map((f) => ({
        ...f,
        attachments: f.attachments
          ? typeof f.attachments === "string"
            ? JSON.parse(f.attachments)
            : f.attachments
          : [],
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Feedback list error:", error);
    return NextResponse.json({ error: "Failed to fetch feedback" }, { status: 500 });
  }
}
