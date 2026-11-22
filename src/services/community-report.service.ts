/**
 * Community Report Service
 *
 * Handles community report submission, verification, and retrieval.
 * Requirements: 28.1, 28.2, 28.3, 28.4, 28.5, 28.6, 28.7, 28.8
 */

import prisma from "@/lib/prisma";
import { ReportType, ReportStatus, ReportEvidenceType } from "@prisma/client";

// Error types
export class CommunityReportError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = "CommunityReportError";
  }
}

// Types
export interface CreateReportInput {
  submitterId?: string;
  politicianId: string;
  reportType: ReportType;
  content: string;
  evidence: {
    type: ReportEvidenceType;
    url: string;
    description?: string;
  }[];
}

export interface ReportInaccuracyInput {
  submitterId?: string;
  politicianId: string;
  dataField: string;
  currentValue: string;
  suggestedValue: string;
  reason: string;
  evidence: {
    type: ReportEvidenceType;
    url: string;
    description?: string;
  }[];
}

export interface CommunityReportSummary {
  id: string;
  politicianId: string;
  politicianName: string;
  reportType: ReportType;
  content: string;
  status: ReportStatus;
  evidenceCount: number;
  createdAt: Date;
  verificationStatus?: string;
  verificationConfidence?: number;
}

export interface CommunityReportDetail {
  id: string;
  submitterId?: string;
  politicianId: string;
  politicianName: string;
  politicianPhoto?: string;
  reportType: ReportType;
  content: string;
  status: ReportStatus;
  evidence: {
    id: string;
    type: ReportEvidenceType;
    url: string;
    description?: string;
  }[];
  verificationResult?: {
    status: string;
    confidence: number;
    reasoning: string;
  };
  reviewedBy?: string;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Submit a new community report
 * Requirement 28.1: Require supporting evidence
 * Requirement 28.2: Queue for verification before publishing
 */
export async function submitReport(input: CreateReportInput): Promise<CommunityReportDetail> {
  // Validate evidence is provided
  if (!input.evidence || input.evidence.length === 0) {
    throw new CommunityReportError(
      "At least one piece of evidence is required",
      "EVIDENCE_REQUIRED"
    );
  }

  // Validate politician exists
  const politician = await prisma.politician.findUnique({
    where: { id: input.politicianId },
    select: { id: true, fullName: true, photo: true },
  });

  if (!politician) {
    throw new CommunityReportError("Politician not found", "POLITICIAN_NOT_FOUND");
  }

  // Create the report with evidence
  const report = await prisma.communityReport.create({
    data: {
      id: crypto.randomUUID(),
      submitterId: input.submitterId,
      politicianId: input.politicianId,
      reportType: input.reportType,
      content: input.content,
      status: ReportStatus.pending, // Always starts as pending
      updatedAt: new Date(),
      ReportEvidence: {
        create: input.evidence.map((e) => ({
          id: crypto.randomUUID(),
          type: e.type,
          url: e.url,
          description: e.description,
        })),
      },
    },
    include: {
      ReportEvidence: true,
      VerificationResult: true,
    },
  });

  return {
    id: report.id,
    submitterId: report.submitterId ?? undefined,
    politicianId: report.politicianId,
    politicianName: politician.fullName,
    politicianPhoto: politician.photo ?? undefined,
    reportType: report.reportType,
    content: report.content,
    status: report.status,
    evidence: report.ReportEvidence.map((e) => ({
      id: e.id,
      type: e.type,
      url: e.url,
      description: e.description ?? undefined,
    })),
    verificationResult: report.VerificationResult
      ? {
          status: report.VerificationResult.status,
          confidence: Number(report.VerificationResult.confidence),
          reasoning: report.VerificationResult.reasoning,
        }
      : undefined,
    reviewedBy: report.reviewedBy ?? undefined,
    reviewedAt: report.reviewedAt ?? undefined,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
  };
}

/**
 * Report an inaccuracy in existing data
 * Requirement 28.6: Allow users to report inaccuracies for review
 */
export async function reportInaccuracy(
  input: ReportInaccuracyInput
): Promise<CommunityReportDetail> {
  // Format content for inaccuracy report
  const content = `Data Correction Request:
Field: ${input.dataField}
Current Value: ${input.currentValue}
Suggested Value: ${input.suggestedValue}
Reason: ${input.reason}`;

  return submitReport({
    submitterId: input.submitterId,
    politicianId: input.politicianId,
    reportType: ReportType.correction,
    content,
    evidence: input.evidence,
  });
}

/**
 * Get reports submitted by a user
 */
export async function getUserReports(userId: string): Promise<CommunityReportSummary[]> {
  const reports = await prisma.communityReport.findMany({
    where: { submitterId: userId },
    include: {
      Politician: {
        select: { fullName: true },
      },
      ReportEvidence: {
        select: { id: true },
      },
      VerificationResult: {
        select: { status: true, confidence: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return reports.map((r) => ({
    id: r.id,
    politicianId: r.politicianId,
    politicianName: r.Politician.fullName,
    reportType: r.reportType,
    content: r.content,
    status: r.status,
    evidenceCount: r.ReportEvidence.length,
    createdAt: r.createdAt,
    verificationStatus: r.VerificationResult?.status,
    verificationConfidence: r.VerificationResult
      ? Number(r.VerificationResult.confidence)
      : undefined,
  }));
}

/**
 * Get a single report by ID
 */
export async function getReportById(
  reportId: string,
  userId?: string
): Promise<CommunityReportDetail | null> {
  const report = await prisma.communityReport.findUnique({
    where: { id: reportId },
    include: {
      Politician: {
        select: { fullName: true, photo: true },
      },
      ReportEvidence: true,
      VerificationResult: true,
    },
  });

  if (!report) {
    return null;
  }

  // Only allow viewing own reports or verified reports
  if (report.status !== ReportStatus.verified && report.submitterId !== userId) {
    return null;
  }

  return {
    id: report.id,
    submitterId: report.submitterId ?? undefined,
    politicianId: report.politicianId,
    politicianName: report.Politician.fullName,
    politicianPhoto: report.Politician.photo ?? undefined,
    reportType: report.reportType,
    content: report.content,
    status: report.status,
    evidence: report.ReportEvidence.map((e) => ({
      id: e.id,
      type: e.type,
      url: e.url,
      description: e.description ?? undefined,
    })),
    verificationResult: report.VerificationResult
      ? {
          status: report.VerificationResult.status,
          confidence: Number(report.VerificationResult.confidence),
          reasoning: report.VerificationResult.reasoning,
        }
      : undefined,
    reviewedBy: report.reviewedBy ?? undefined,
    reviewedAt: report.reviewedAt ?? undefined,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
  };
}

/**
 * Get verified community reports for a politician
 * Requirement 28.4: Publish verified reports with attribution
 * Requirement 28.8: Clearly distinguish community-sourced info
 */
export async function getVerifiedReportsForPolitician(
  politicianId: string
): Promise<CommunityReportSummary[]> {
  const reports = await prisma.communityReport.findMany({
    where: {
      politicianId,
      status: ReportStatus.verified,
    },
    include: {
      Politician: {
        select: { fullName: true },
      },
      ReportEvidence: {
        select: { id: true },
      },
      VerificationResult: {
        select: { status: true, confidence: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return reports.map((r) => ({
    id: r.id,
    politicianId: r.politicianId,
    politicianName: r.Politician.fullName,
    reportType: r.reportType,
    content: r.content,
    status: r.status,
    evidenceCount: r.ReportEvidence.length,
    createdAt: r.createdAt,
    verificationStatus: r.VerificationResult?.status,
    verificationConfidence: r.VerificationResult
      ? Number(r.VerificationResult.confidence)
      : undefined,
  }));
}

/**
 * Get report statistics for a user
 */
export async function getUserReportStats(userId: string): Promise<{
  total: number;
  pending: number;
  verified: number;
  rejected: number;
}> {
  const [total, pending, verified, rejected] = await Promise.all([
    prisma.communityReport.count({ where: { submitterId: userId } }),
    prisma.communityReport.count({
      where: { submitterId: userId, status: ReportStatus.pending },
    }),
    prisma.communityReport.count({
      where: { submitterId: userId, status: ReportStatus.verified },
    }),
    prisma.communityReport.count({
      where: { submitterId: userId, status: ReportStatus.rejected },
    }),
  ]);

  return { total, pending, verified, rejected };
}
