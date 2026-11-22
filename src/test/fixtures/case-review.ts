import { Prisma } from "@prisma/client";
import { caseContentHash, type CaseReviewPacket } from "../../lib/case-review";

export const reviewTime = new Date("2026-11-16T00:00:00.000Z");
export function caseFixture(): CaseReviewPacket {
  const record = {
    id: "case-1",
    politicianId: "person-1",
    title: "Synthetic case",
    description: "Synthetic reviewed facts",
    category: "legal_case" as const,
    status: "convicted" as const,
    filingDate: null,
    resolutionDate: null,
    court: null,
    caseNumber: null,
    createdAt: reviewTime,
    updatedAt: reviewTime,
    recordKind: "criminal_case" as const,
    subjectRole: "accused" as const,
    reviewState: "approved" as const,
    reviewedBy: "synthetic-reviewer",
    reviewedAt: reviewTime,
    reviewNote: "Synthetic independent test sources; no real person or real source clearance.",
    approvedContentHash: null,
    approvedSourceIds: ["source-1", "source-2"],
    independentSourceIds: ["source-1", "source-2"],
    outcomeEventId: "event-1",
  };
  const events = [
    {
      id: "event-1",
      controversyId: "case-1",
      kind: "judgment" as const,
      outcome: "convicted" as const,
      relief: null,
      evidenceBasis: "primary_document" as const,
      finality: "final" as const,
      eventDate: "2020-02-29",
      jurisdiction: "Test jurisdiction",
      court: "Test court",
      caseNumber: "TEST-1",
      summary: "Synthetic judgment",
      selectedRelief: false,
      appliesToEventId: null,
      reviewState: "approved" as const,
      reviewedBy: "synthetic-reviewer",
      reviewedAt: reviewTime,
      createdAt: reviewTime,
      updatedAt: reviewTime,
    },
  ];
  const owners = {
    politicianId: null,
    positionId: null,
    partyAffiliationId: null,
    billId: null,
    votingRecordId: null,
    sessionAttendanceId: null,
    salnRecordId: null,
    electionResultRecordId: null,
    campaignFinanceId: null,
    projectId: null,
    campaignPromiseId: null,
    familyRelationshipId: null,
    redFlagId: null,
    educationId: null,
  };
  const sources = [1, 2].map((n) => ({
    ...owners,
    id: `source-${n}`,
    sourceType: n === 1 ? ("court_document" as const) : ("third_party_verified" as const),
    sourceName: `Synthetic source ${n}`,
    sourceUrl: `https://source${n}.example.test/record/1`,
    documentDate: reviewTime,
    retrievedAt: reviewTime,
    confidence: new Prisma.Decimal(0),
    isAIProcessed: true,
    originalDocumentId: null,
    fieldName: n === 1 ? "caseEvent" : "controversy",
    createdAt: reviewTime,
    controversyId: "case-1",
    caseEventId: n === 1 ? "event-1" : null,
    evidenceLocator: "Synthetic fixture paragraph",
    reviewState: "approved" as const,
    reviewedBy: "synthetic-reviewer",
    reviewedAt: reviewTime,
  }));
  return sealCase({ record, events, sources });
}
export function sealCase(packet: CaseReviewPacket): CaseReviewPacket {
  packet.record.approvedContentHash = caseContentHash(packet);
  return packet;
}
