-- CreateEnum
CREATE TYPE "ResearchRecordKind" AS ENUM ('criminal_case', 'civil_case', 'administrative_case', 'public_context');

-- CreateEnum
CREATE TYPE "ResearchSubjectRole" AS ENUM ('accused', 'civil_defendant', 'administrative_respondent', 'claimant', 'misinformation_target', 'relative_or_associate', 'commentator');

-- CreateEnum
CREATE TYPE "ResearchReviewState" AS ENUM ('pending', 'approved', 'held');

-- CreateEnum
CREATE TYPE "CaseEventKind" AS ENUM ('filing', 'status_report', 'judgment', 'appeal', 'clemency', 'enforcement');

-- CreateEnum
CREATE TYPE "ReviewedCaseOutcome" AS ENUM ('pending', 'convicted', 'acquitted', 'dismissed', 'settled', 'civil_liability', 'civil_no_liability', 'administrative_liability', 'administrative_no_liability');

-- CreateEnum
CREATE TYPE "CaseReliefType" AS ENUM ('absolute_pardon', 'conditional_pardon', 'commutation');

-- CreateEnum
CREATE TYPE "CaseEvidenceBasis" AS ENUM ('primary_document', 'attributed_reporting');

-- CreateEnum
CREATE TYPE "CaseFinality" AS ENUM ('unknown', 'non_final', 'final');

-- AlterTable
ALTER TABLE "Controversy" ADD COLUMN     "approvedContentHash" CHAR(64),
ADD COLUMN     "approvedSourceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "independentSourceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "outcomeEventId" TEXT,
ADD COLUMN     "recordKind" "ResearchRecordKind",
ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewState" "ResearchReviewState" NOT NULL DEFAULT 'pending',
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedBy" TEXT,
ADD COLUMN     "subjectRole" "ResearchSubjectRole",
ALTER COLUMN "status" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SourceAttribution" ADD COLUMN     "caseEventId" TEXT,
ADD COLUMN     "evidenceLocator" TEXT,
ADD COLUMN     "reviewState" "ResearchReviewState" NOT NULL DEFAULT 'pending',
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedBy" TEXT;

-- CreateTable
CREATE TABLE "CaseEvent" (
    "id" TEXT NOT NULL,
    "controversyId" TEXT NOT NULL,
    "kind" "CaseEventKind" NOT NULL,
    "outcome" "ReviewedCaseOutcome",
    "relief" "CaseReliefType",
    "evidenceBasis" "CaseEvidenceBasis",
    "finality" "CaseFinality" NOT NULL DEFAULT 'unknown',
    "eventDate" TEXT,
    "jurisdiction" TEXT,
    "court" TEXT,
    "caseNumber" TEXT,
    "summary" TEXT NOT NULL,
    "selectedRelief" BOOLEAN NOT NULL DEFAULT false,
    "appliesToEventId" TEXT,
    "reviewState" "ResearchReviewState" NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CaseEvent_controversyId_idx" ON "CaseEvent"("controversyId");

-- CreateIndex
CREATE UNIQUE INDEX "CaseEvent_id_controversyId_key" ON "CaseEvent"("id", "controversyId");

-- CreateIndex
CREATE INDEX "Controversy_politicianId_reviewState_idx" ON "Controversy"("politicianId", "reviewState");

-- AddForeignKey
ALTER TABLE "Controversy" ADD CONSTRAINT "case_review_outcome_owner_fk" FOREIGN KEY ("outcomeEventId", "id") REFERENCES "CaseEvent"("id", "controversyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "SourceAttribution" ADD CONSTRAINT "case_review_source_owner_fk" FOREIGN KEY ("caseEventId", "controversyId") REFERENCES "CaseEvent"("id", "controversyId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "CaseEvent" ADD CONSTRAINT "case_review_event_parent_fk" FOREIGN KEY ("controversyId") REFERENCES "Controversy"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "CaseEvent" ADD CONSTRAINT "case_review_relief_owner_fk" FOREIGN KEY ("appliesToEventId", "controversyId") REFERENCES "CaseEvent"("id", "controversyId") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- Reviewed packets retain legacy values; only complete, explicitly approved shapes qualify.
ALTER TABLE "Controversy" ADD CONSTRAINT "case_review_parent_shape" CHECK (
 "reviewState" <> 'approved' OR (
 "recordKind" IS NOT NULL AND "subjectRole" IS NOT NULL
 AND "reviewedBy" IS NOT NULL AND btrim("reviewedBy") <> '' AND "reviewedAt" IS NOT NULL
 AND "reviewNote" IS NOT NULL AND btrim("reviewNote") <> ''
 AND "approvedContentHash" IS NOT NULL AND "approvedContentHash" ~ '^[0-9a-f]{64}$'
 AND COALESCE(cardinality("approvedSourceIds") >= 2, false)
 AND array_position("approvedSourceIds", NULL) IS NULL
 AND COALESCE(cardinality("independentSourceIds") = 2, false)
 AND array_position("independentSourceIds", NULL) IS NULL
 AND COALESCE("independentSourceIds"[1] <> "independentSourceIds"[2], false)
 ));
ALTER TABLE "CaseEvent" ADD CONSTRAINT "case_review_event_shape" CHECK (
 "reviewState" <> 'approved' OR ("reviewedBy" IS NOT NULL AND btrim("reviewedBy") <> '' AND "reviewedAt" IS NOT NULL AND "evidenceBasis" IS NOT NULL));
ALTER TABLE "SourceAttribution" ADD CONSTRAINT "case_review_source_shape" CHECK (
 "reviewState" <> 'approved' OR ("reviewedBy" IS NOT NULL AND btrim("reviewedBy") <> '' AND "reviewedAt" IS NOT NULL));
ALTER TABLE "CaseEvent" ADD CONSTRAINT "case_review_selected_relief" CHECK (
 NOT "selectedRelief" OR (kind = 'clemency' AND relief IS NOT NULL AND "appliesToEventId" IS NOT NULL));
ALTER TABLE "CaseEvent" ADD CONSTRAINT "case_review_event_scope" CHECK (
 (relief IS NULL OR kind = 'clemency')
 AND (kind NOT IN ('filing','clemency','enforcement') OR outcome IS NULL)
 AND ("appliesToEventId" IS NULL OR "appliesToEventId" <> id));
ALTER TABLE "SourceAttribution" ADD CONSTRAINT "case_review_event_source_scope" CHECK (
 "caseEventId" IS NULL OR ("controversyId" IS NOT NULL AND "politicianId" IS NULL AND "fieldName" = 'caseEvent'));
