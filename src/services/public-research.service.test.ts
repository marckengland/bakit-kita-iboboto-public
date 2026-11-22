import { beforeEach, describe, expect, it, vi } from "vitest";
import { caseFixture } from "../test/fixtures/case-review";
const db = vi.hoisted(() => ({
  controversy: { findMany: vi.fn() },
  redFlag: { findMany: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ default: db }));
import {
  getPublicResearchBatch,
  getPublicRedFlagsBatch,
  PublicResearchUnavailableError,
} from "./public-research.service";
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("PUBLIC_CASE_RECORDS_ENABLED", "true");
  db.redFlag.findMany.mockResolvedValue([]);
});
describe("public research reader", () => {
  it("defaults off without selecting new schema", async () => {
    vi.stubEnv("PUBLIC_CASE_RECORDS_ENABLED", "");
    db.controversy.findMany.mockRejectedValue(Error("must not query"));
    expect((await getPublicResearchBatch(["person-1"])).get("person-1")?.availability).toBe(
      "withheld"
    );
    expect(db.controversy.findMany).not.toHaveBeenCalled();
  });
  it("publishes only complete unchanged reviewed packets", async () => {
    const p = caseFixture();
    db.controversy.findMany.mockResolvedValue([
      { ...p.record, CaseEvent: p.events, SourceAttribution: p.sources },
      { ...p.record, id: "held", reviewState: "pending", CaseEvent: [], SourceAttribution: [] },
    ]);
    const result = (await getPublicResearchBatch(["person-1"])).get("person-1")!;
    expect(result.records.map((r) => r.id)).toEqual(["case-1"]);
    p.sources[0]!.sourceUrl += "changed";
    expect((await getPublicResearchBatch(["person-1"])).get("person-1")?.records).toEqual([]);
  });
  it("discards stored adverse text including mislabelled controversy links", async () => {
    const p = caseFixture();
    db.controversy.findMany.mockResolvedValue([
      { ...p.record, CaseEvent: p.events, SourceAttribution: p.sources },
    ]);
    db.redFlag.findMany.mockResolvedValue([
      ...["legal_case", "corruption"].map((type) => ({ type, title: "STALE" })),
      { type: "dynasty", relatedEntityType: "CoNtRoVeRsY", title: "STALE" },
      {
        id: "base",
        politicianId: "person-1",
        type: "dynasty",
        severity: "info",
        title: "Family",
        SourceAttribution: [],
      },
    ]);
    const flags = (await getPublicRedFlagsBatch(["person-1"])).get("person-1")!;
    expect(flags.map((f) => f.id)).toEqual(["case:case-1", "base"]);
    expect(JSON.stringify(flags)).not.toContain("STALE");
  });
  it("fails closed rather than returning empty success", async () => {
    db.controversy.findMany.mockRejectedValue(Error("db down"));
    await expect(getPublicResearchBatch(["person-1"])).rejects.toBeInstanceOf(
      PublicResearchUnavailableError
    );
  });
  it("does not query an empty batch", async () => {
    expect((await getPublicResearchBatch([])).size).toBe(0);
    expect(db.controversy.findMany).not.toHaveBeenCalled();
  });
});
