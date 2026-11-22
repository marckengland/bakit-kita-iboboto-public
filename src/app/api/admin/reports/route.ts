/**
 * Admin Community Reports API
 *
 * API endpoint for fetching community reports for moderation.
 * Implements moderation queue with filtering and pagination.
 *
 * Requirements: 28.2, 28.7, 39.3
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ReportType, ReportStatus } from "@prisma/client";
import { roleHasPermission, AdminRole } from "@/services/admin-role.service";

/**
 * GET /api/admin/reports
 *
 * Fetch community reports for moderation queue.
 * Supports filtering by type and status, with pagination.
 */
export async function GET(request: NextRequest) {
  try {
    // Check admin role
    const adminRole = request.headers.get("x-admin-role") as AdminRole | null;
    if (!adminRole || !roleHasPermission(adminRole, "review_community_reports")) {
      return NextResponse.json(
        { error: "Unauthorized: Content Moderator role required" },
        { status: 403 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const type = searchParams.get("type") as ReportType | null;
    const status = searchParams.get("status") as ReportStatus | null;

    // Build where clause
    const where: {
      reportType?: ReportType;
      status?: ReportStatus;
    } = {};

    if (type) {
      where.reportType = type;
    }
    if (status) {
      where.status = status;
    }

    // Fetch reports with pagination
    const [reports, total] = await Promise.all([
      prisma.communityReport.findMany({
        where,
        include: {
          Politician: {
            select: {
              fullName: true,
              photo: true,
            },
          },
          ReportEvidence: true,
          VerificationResult: true,
          User: {
            select: {
              id: true,
            },
          },
        },
        orderBy: [
          { status: "asc" }, // Pending first
          { createdAt: "desc" },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.communityReport.count({ where }),
    ]);

    // Transform reports for response
    const transformedReports = reports.map((report) => ({
      id: report.id,
      submitterId: report.submitterId,
      politicianId: report.politicianId,
      politicianName: report.Politician.fullName,
      politicianPhoto: report.Politician.photo,
      reportType: report.reportType,
      content: report.content,
      status: report.status,
      evidence: report.ReportEvidence.map((e) => ({
        id: e.id,
        type: e.type,
        url: e.url,
        description: e.description,
      })),
      verificationResult: report.VerificationResult
        ? {
            status: report.VerificationResult.status,
            confidence: Number(report.VerificationResult.confidence),
            reasoning: report.VerificationResult.reasoning,
          }
        : undefined,
      reviewedBy: report.reviewedBy,
      reviewedAt: report.reviewedAt?.toISOString(),
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      reports: transformedReports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching reports:", error);
    return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
  }
}
