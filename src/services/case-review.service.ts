import prisma from "@/lib/prisma";
import { caseContentHash, validateCaseReview, type ReviewIssue } from "@/lib/case-review";
export class CaseReviewConflictError extends Error {
  constructor() {
    super("The review draft changed; reload it before approving");
    this.name = "CaseReviewConflictError";
  }
}
export class CaseReviewValidationError extends Error {
  constructor(public readonly issues: ReviewIssue[]) {
    super("The review packet is incomplete or invalid");
    this.name = "CaseReviewValidationError";
  }
}
export async function approveCaseReview(input: {
  recordId: string;
  expectedContentHash: string;
  reviewer: string;
  reviewedAt: Date;
  reviewNote: string;
  approvedSourceIds: readonly string[];
  independentSourceIds: readonly [string, string];
}): Promise<{ recordId: string; approvedContentHash: string }> {
  return prisma.$transaction(
    async (tx) => {
      const row = await tx.controversy.findUnique({
        where: { id: input.recordId },
        include: { CaseEvent: true, SourceAttribution: true },
      });
      if (!row) {
        throw new CaseReviewConflictError();
      }
      const packet = { record: row, events: row.CaseEvent, sources: row.SourceAttribution };
      if (caseContentHash(packet) !== input.expectedContentHash) {
        throw new CaseReviewConflictError();
      }
      packet.record = {
        ...row,
        reviewNote: input.reviewNote,
        approvedSourceIds: [...input.approvedSourceIds],
        independentSourceIds: [...input.independentSourceIds],
      };
      const issues = validateCaseReview(packet);
      if (!input.reviewer.trim() || !Number.isFinite(input.reviewedAt.getTime())) {
        issues.push({ code: "review_metadata", recordId: row.id });
      }
      if (issues.length) {
        throw new CaseReviewValidationError(issues);
      }
      const approvedContentHash = caseContentHash(packet);
      const approval = {
        reviewState: "approved" as const,
        reviewedBy: input.reviewer,
        reviewedAt: input.reviewedAt,
      };
      await tx.caseEvent.updateMany({ where: { controversyId: row.id }, data: approval });
      await tx.sourceAttribution.updateMany({
        where: { controversyId: row.id, id: { in: [...input.approvedSourceIds] } },
        data: approval,
      });
      await tx.controversy.update({
        where: { id: row.id },
        data: {
          ...approval,
          reviewNote: input.reviewNote,
          approvedSourceIds: [...input.approvedSourceIds],
          independentSourceIds: [...input.independentSourceIds],
          approvedContentHash,
        },
      });
      return { recordId: row.id, approvedContentHash };
    },
    { isolationLevel: "Serializable" }
  );
}
