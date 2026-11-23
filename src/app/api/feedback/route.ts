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
import { validateSession } from "@/services/auth.service";
import { readBoundedJson, RequestBodyError } from "@/lib/request-body";
import {
  reservePublicRequest,
  trustedClientIp,
  PublicBudgetUnavailableError,
} from "@/lib/public-request-budget";
import {
  FEEDBACK_ATTACHMENT_BYTES,
  FEEDBACK_ATTACHMENT_COUNT,
  FEEDBACK_BODY_BYTES,
  FEEDBACK_FILE_TYPES,
} from "@/lib/feedback-limits";

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
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { valid: false, error: "Invalid request body" };
  }

  const submission = data as Record<string, unknown>;
  if (
    submission.email !== undefined &&
    (typeof submission.email !== "string" || submission.email.length > 254)
  ) {
    return { valid: false, error: "Invalid email address" };
  }
  if (
    submission.sourceUrl !== undefined &&
    (typeof submission.sourceUrl !== "string" || submission.sourceUrl.length > 2000)
  ) {
    return { valid: false, error: "Invalid source URL" };
  }

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
      if (!["http:", "https:"].includes(new URL(submission.sourceUrl as string).protocol)) {
        return { valid: false, error: "Invalid source URL" };
      }
    } catch {
      return { valid: false, error: "Invalid source URL" };
    }
  }

  // Validate attachments if provided
  if (submission.attachments) {
    if (!Array.isArray(submission.attachments)) {
      return { valid: false, error: "Attachments must be an array" };
    }

    if (submission.attachments.length > FEEDBACK_ATTACHMENT_COUNT) {
      return { valid: false, error: "Maximum 5 attachments allowed" };
    }

    for (const attachment of submission.attachments) {
      if (
        !attachment ||
        typeof attachment !== "object" ||
        typeof attachment.name !== "string" ||
        !attachment.name.trim() ||
        attachment.name.length > 200 ||
        typeof attachment.type !== "string" ||
        !FEEDBACK_FILE_TYPES.includes(attachment.type) ||
        typeof attachment.dataUrl !== "string"
      ) {
        return { valid: false, error: "Invalid attachment format" };
      }
      const prefix = `data:${attachment.type};base64,`;
      if (!attachment.dataUrl.startsWith(prefix)) {
        return { valid: false, error: "Invalid attachment format" };
      }
      const encoded = attachment.dataUrl.slice(prefix.length);
      if (
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded) ||
        encoded.length > Math.ceil(FEEDBACK_ATTACHMENT_BYTES / 3) * 4
      ) {
        return { valid: false, error: "Invalid or oversized attachment" };
      }
      const decoded = Buffer.from(encoded, "base64");
      if (
        decoded.length === 0 ||
        decoded.length > FEEDBACK_ATTACHMENT_BYTES ||
        decoded.toString("base64") !== encoded
      ) {
        return { valid: false, error: "Invalid or oversized attachment" };
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
    const body = await readBoundedJson(request, FEEDBACK_BODY_BYTES);
    const validation = validateFeedback(body);

    if (!validation.valid || !validation.data) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { category, subject, description, sourceUrl, attachments, isAnonymous, email } =
      validation.data;

    let userId: string | null = null;
    const token = request.cookies.get("auth_token")?.value;
    if (token) {
      try {
        userId = (await validateSession(token)).userId;
      } catch {
        /* Invalid sessions remain anonymous. */
      }
    }
    const budget = await reservePublicRequest(request, "feedback", userId);
    if (budget && !budget.allowed) {
      return NextResponse.json(
        { error: "Too many feedback submissions. Try again later." },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": String(
              Math.max(1, Math.ceil((budget.resetAt.getTime() - Date.now()) / 1000))
            ),
          },
        }
      );
    }
    const userAgent = request.headers.get("user-agent")?.slice(0, 512) || "Unknown";
    const ipAddress = trustedClientIp(request);

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
    if (error instanceof RequestBodyError) {
      return NextResponse.json(
        { error: "Invalid feedback request." },
        { status: error.status, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (error instanceof PublicBudgetUnavailableError) {
      console.error("Feedback request budget unavailable");
      return NextResponse.json(
        { error: "Feedback is temporarily unavailable." },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }
    console.error("Feedback submission failed");
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
