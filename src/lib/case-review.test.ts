import { describe, it, expect } from "vitest";
import { caseFixture, sealCase } from "../test/fixtures/case-review";
import {
  parseCaseDate,
  caseContentHash,
  validateCaseReview,
  projectPublicRecord,
  derivePublicCaseFlag,
} from "./case-review";

describe("case review rules", () => {
  it.each(["0001", "2016-11", "2000-02-29", "0001-01-01"])(
    "preserves date precision for %s",
    (value) => {
      expect(parseCaseDate(value)?.value).toBe(value);
    }
  );
  it.each(["0000", "1900-02-29", "2016-02-30", "2016-00", "2020-01-01T00:00:00Z"])(
    "rejects invalid date %s",
    (value) => expect(() => parseCaseDate(value)).toThrow()
  );
  it("preserves an unknown date", () => expect(parseCaseDate(null)).toBeNull());
  it("preserves months without an invented day", () =>
    expect(parseCaseDate("2016-11")).toEqual({ value: "2016-11", precision: "month" }));
  it("holds changed evidence and all pending packets", () => {
    const packet = caseFixture();
    packet.sources[0]!.sourceUrl += "-changed";
    expect(projectPublicRecord(packet)).toBeNull();
    packet.record.reviewState = "pending";
    expect(projectPublicRecord(sealCase(packet))).toBeNull();
  });
  it("does not hash row order or generated timestamps", () => {
    const packet = caseFixture();
    const before = caseContentHash(packet);
    packet.sources.reverse();
    packet.record.updatedAt = new Date();
    expect(caseContentHash(packet)).toBe(before);
  });
  it("accepts a pending draft for content validation but not public display", () => {
    const packet = caseFixture();
    packet.record.reviewState = "pending";
    packet.events[0]!.reviewState = "pending";
    expect(validateCaseReview(packet)).toEqual([]);
    expect(projectPublicRecord(packet)).toBeNull();
  });
  it("rejects cross-record evidence and enforcement as a selected outcome", () => {
    const packet = caseFixture();
    packet.events[0]!.controversyId = "other";
    expect(validateCaseReview(packet).length).toBeGreaterThan(0);
    packet.events[0]!.controversyId = packet.record.id;
    packet.events[0]!.kind = "enforcement";
    expect(projectPublicRecord(sealCase(packet))).toBeNull();
  });
  it("preserves unselected legacy citations without publishing them", () => {
    const packet = caseFixture();
    packet.sources.push({
      ...packet.sources[0]!,
      id: "old",
      sourceUrl: null,
      reviewState: "pending",
    });
    const record = projectPublicRecord(sealCase(packet))!;
    expect(record.sources.map((s) => s.id)).not.toContain("old");
    packet.record.approvedSourceIds.push("old");
    expect(validateCaseReview(packet).length).toBeGreaterThan(0);
  });
  it("never gives civil liability a criminal critical flag", () => {
    const packet = caseFixture();
    packet.record.recordKind = "civil_case";
    packet.record.subjectRole = "civil_defendant";
    packet.events[0]!.outcome = "civil_liability";
    const record = projectPublicRecord(sealCase(packet))!;
    expect(record.section).toBe("case");
    if (record.section !== "case") {
      throw Error("Expected case");
    }
    expect(record.outcome.label).toBe("Civil liability judgment");
    expect(derivePublicCaseFlag(record)?.severity).toBe("info");
  });
  it.each(["misinformation_target", "relative_or_associate", "commentator"] as const)(
    "does not turn %s into a legal case",
    (role) => {
      const packet = caseFixture();
      packet.record.recordKind = "public_context";
      packet.record.subjectRole = role;
      packet.record.outcomeEventId = null;
      packet.events = [];
      packet.sources[0]!.caseEventId = null;
      packet.sources[0]!.fieldName = "controversy";
      expect(projectPublicRecord(sealCase(packet))?.section).toBe("context");
    }
  );
  it("keeps a conviction and pardon distinct", () => {
    const packet = caseFixture();
    packet.events.push({
      ...packet.events[0]!,
      id: "pardon",
      kind: "clemency",
      outcome: null,
      relief: "absolute_pardon",
      selectedRelief: true,
      appliesToEventId: "event-1",
      eventDate: "2021-11",
      summary: "Synthetic pardon",
    });
    packet.sources.push({ ...packet.sources[0]!, id: "pardon-source", caseEventId: "pardon" });
    packet.record.approvedSourceIds.push("pardon-source");
    const record = projectPublicRecord(sealCase(packet))!;
    if (record.section !== "case") {
      throw Error("Expected case");
    }
    expect(record.outcome.value).toBe("convicted");
    expect(record.relief[0]?.type).toBe("absolute_pardon");
    expect(derivePublicCaseFlag(record)?.severity).toBe("info");
  });
});

it("rejects a packet with another record's unselected citation", () => {
  const p = caseFixture();
  p.sources.push({
    ...p.sources[0]!,
    id: "foreign",
    controversyId: "other",
    reviewState: "pending",
    sourceUrl: null,
  });
  expect(validateCaseReview(p).some((issue) => issue.code === "source_owner")).toBe(true);
});
it.each(["sourceName", "sourceUrl", "evidenceLocator"] as const)(
  "holds a legacy edit to %s",
  (field) => {
    const p = caseFixture();
    p.sources[0]![field] += "x";
    expect(projectPublicRecord(p)).toBeNull();
  }
);
it.each(["pending", "held"] as const)("holds a selected citation marked %s", (state) => {
  const p = caseFixture();
  p.sources[0]!.reviewState = state;
  expect(projectPublicRecord(p)).toBeNull();
});
it("requires independent documents and rejects credential-bearing URLs", () => {
  const p = caseFixture();
  p.sources[1]!.sourceUrl = p.sources[0]!.sourceUrl;
  expect(validateCaseReview(p).some((i) => i.code === "independent_sources")).toBe(true);
  p.sources[1]!.sourceUrl = "https://synthetic:fixture@example.test/document";
  expect(validateCaseReview(p).some((i) => i.code === "source_url")).toBe(true);
});
it("shows a dated pending report without assigning a conviction severity", () => {
  const p = caseFixture();
  p.events[0]!.kind = "status_report";
  p.events[0]!.outcome = "pending";
  p.events[0]!.eventDate = "2026-11";
  const record = projectPublicRecord(sealCase(p))!;
  expect(record.section).toBe("case");
  if (record.section !== "case") {
    throw Error("Expected case");
  }
  expect(record.outcome.label).toBe("Case reported pending as of 2026-11");
  expect(derivePublicCaseFlag(record)?.severity).toBe("warning");
  expect(derivePublicCaseFlag(record)?.eventDate).toBeNull();
  p.events[0]!.eventDate = null;
  expect(projectPublicRecord(sealCase(p))).toBeNull();
});
it("presents claimants as context and marks attributed reporting", () => {
  const p = caseFixture();
  p.record.subjectRole = "claimant";
  expect(projectPublicRecord(sealCase(p))?.section).toBe("context");
  p.record.subjectRole = "accused";
  p.events[0]!.evidenceBasis = "attributed_reporting";
  const record = projectPublicRecord(sealCase(p))!;
  if (record.section !== "case") {
    throw Error("Expected case");
  }
  expect(record.outcome.label).toBe("Criminal conviction — reported");
  expect(derivePublicCaseFlag(record)?.severity).toBe("info");
});
it("holds relevant relief that a packet has not explicitly selected", () => {
  const p = caseFixture();
  p.events.push({
    ...p.events[0]!,
    id: "pardon",
    kind: "clemency",
    outcome: null,
    relief: "absolute_pardon",
    appliesToEventId: "event-1",
    selectedRelief: false,
  });
  p.sources.push({ ...p.sources[0]!, id: "pardon-source", caseEventId: "pardon" });
  p.record.approvedSourceIds.push("pardon-source");
  expect(projectPublicRecord(sealCase(p))).toBeNull();
});
