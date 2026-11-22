import { beforeEach, expect, it, vi } from "vitest";
import { caseFixture } from "../test/fixtures/case-review";
import { caseContentHash } from "../lib/case-review";
const db = vi.hoisted(() => ({
  $transaction: vi.fn(),
  controversy: { findUnique: vi.fn(), update: vi.fn() },
  caseEvent: { updateMany: vi.fn() },
  sourceAttribution: { updateMany: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ default: db }));
import {
  approveCaseReview,
  CaseReviewConflictError,
  CaseReviewValidationError,
} from "./case-review.service";
beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((fn) => fn(db));
});
function draft() {
  const p = caseFixture();
  p.record.reviewState = "pending";
  db.controversy.findUnique.mockResolvedValue({
    ...p.record,
    CaseEvent: p.events,
    SourceAttribution: p.sources,
  });
  return {
    p,
    input: {
      recordId: p.record.id,
      expectedContentHash: caseContentHash(p),
      reviewer: "Maintainer",
      reviewedAt: new Date(),
      reviewNote: "Verified wording",
      approvedSourceIds: p.record.approvedSourceIds,
      independentSourceIds: p.record.independentSourceIds as [string, string],
    },
  };
}
it("rejects a stale draft without writing", async () => {
  const { input } = draft();
  input.expectedContentHash = "changed";
  await expect(approveCaseReview(input)).rejects.toBeInstanceOf(CaseReviewConflictError);
  expect(db.controversy.update).not.toHaveBeenCalled();
});
it("requires independent evidence and event citations", async () => {
  const { input } = draft();
  input.approvedSourceIds = ["source-2"];
  await expect(approveCaseReview(input)).rejects.toBeInstanceOf(CaseReviewValidationError);
  expect(db.caseEvent.updateMany).not.toHaveBeenCalled();
});
it("approves a pending packet atomically without changing unselected sources", async () => {
  const { input } = draft();
  const result = await approveCaseReview(input);
  expect(result.approvedContentHash).toMatch(/^[a-f0-9]{64}$/);
  expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
    isolationLevel: "Serializable",
  });
  expect(db.sourceAttribution.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { controversyId: "case-1", id: { in: ["source-1", "source-2"] } },
    })
  );
});
it("rejects a missing event citation before approving any row", async () => {
  const { p, input } = draft();
  p.sources[0]!.caseEventId = null;
  input.expectedContentHash = caseContentHash(p);
  await expect(approveCaseReview(input)).rejects.toMatchObject({
    issues: expect.arrayContaining([expect.objectContaining({ code: "event_citation" })]),
  });
  expect(db.caseEvent.updateMany).not.toHaveBeenCalled();
});
it("rejects relief targeting another record before approving any row", async () => {
  const { p, input } = draft();
  p.events.push({
    ...p.events[0]!,
    id: "relief",
    kind: "clemency",
    outcome: null,
    relief: "absolute_pardon",
    selectedRelief: true,
    appliesToEventId: "foreign-event",
  });
  p.sources.push({ ...p.sources[0]!, id: "relief-source", caseEventId: "relief" });
  p.record.approvedSourceIds.push("relief-source");
  input.expectedContentHash = caseContentHash(p);
  await expect(approveCaseReview(input)).rejects.toBeInstanceOf(CaseReviewValidationError);
  expect(db.caseEvent.updateMany).not.toHaveBeenCalled();
});
it("rejects an independent source outside the selected packet", async () => {
  const { input } = draft();
  input.independentSourceIds = ["source-1", "not-selected"];
  await expect(approveCaseReview(input)).rejects.toBeInstanceOf(CaseReviewValidationError);
  expect(db.controversy.update).not.toHaveBeenCalled();
});
