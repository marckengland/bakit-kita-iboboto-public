import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { caseFixture } from "./fixtures/case-review";
const db = vi.hoisted(() => ({
  controversy: { findMany: vi.fn() },
  redFlag: { findMany: vi.fn() },
  politician: { findUnique: vi.fn(), findMany: vi.fn() },
}));
const cache = vi.hoisted(() => ({ getOrFetch: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: db, prisma: db }));
vi.mock("@/lib/cache-service", () => ({
  enhancedCache: cache,
  cacheKeyGenerators: { politician: (id: string) => id },
  EXTENDED_CACHE_TTL: { POLITICIAN_PROFILE: 1 },
}));
vi.mock("@/services/saln.service", () => ({ getSALNHistory: vi.fn().mockResolvedValue([]) }));
vi.mock("@/services/election.service", () => ({
  getElectionHistory: vi.fn().mockResolvedValue([]),
}));
import { GET } from "../app/api/politicians/[id]/controversies/route";
import { getPolitician, listPoliticians } from "../services/politician.service";
import { getRedFlagCount, getRedFlagCountsBatch } from "../services/red-flag.service";
import { caseActivityDays } from "../services/public-research.service";
import { projectPublicRecord } from "../lib/case-review";
import { generateProfileExport } from "../services/export.service";
const sentinel = "UNREVIEWED-DO-NOT-PUBLISH";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("PUBLIC_CASE_RECORDS_ENABLED", "true");
  const p = caseFixture();
  db.controversy.findMany.mockResolvedValue([
    { ...p.record, CaseEvent: p.events, SourceAttribution: p.sources },
    {
      ...p.record,
      id: "held",
      description: sentinel,
      reviewState: "pending",
      CaseEvent: [],
      SourceAttribution: [],
    },
  ]);
  db.redFlag.findMany.mockResolvedValue(
    Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      politicianId: "person-1",
      type: "legal_case",
      title: sentinel,
      SourceAttribution: [],
    }))
  );
});
it("returns the versioned API contract and no private review metadata", async () => {
  const response = await GET(
    new NextRequest("http://localhost/api/politicians/person-1/controversies"),
    { params: Promise.resolve({ id: "person-1" }) }
  );
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(body.totals).toEqual({ cases: 1, context: 0 });
  expect(body.records[0].outcome.value).toBe("convicted");
  expect(JSON.stringify(body)).not.toMatch(
    /UNREVIEWED|reviewedBy|approvedContentHash|reviewNote|"status"/
  );
  expect(response.headers.get("cache-control")).toContain("no-store");
});
it("returns 503 and null totals on an enabled database failure", async () => {
  db.controversy.findMany.mockRejectedValue(Error("failure"));
  const response = await GET(new NextRequest("http://localhost"), {
    params: Promise.resolve({ id: "person-1" }),
  });
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({
    schemaVersion: 2,
    availability: "unavailable",
    records: [],
    totals: null,
  });
});
it("counts only the one reviewed flag when five stored flags exist", async () => {
  expect(await getRedFlagCount("person-1")).toBe(1);
  expect((await getRedFlagCountsBatch(["person-1"])).get("person-1")).toBe(1);
});
it("replaces stale counts and generic case sources after a cache hit", async () => {
  cache.getOrFetch.mockResolvedValue({
    id: "person-1",
    fullName: "Synthetic",
    positions: [],
    partyAffiliations: [],
    isActive: true,
    sources: { controversy: [{ sourceName: sentinel }], fullName: [] },
    redFlagCount: 5,
    hasRedFlags: true,
  });
  const profile = await getPolitician("person-1");
  expect(profile?.redFlagCount).toBe(1);
  expect(JSON.stringify(profile)).not.toContain(sentinel);
  vi.stubEnv("PUBLIC_CASE_RECORDS_ENABLED", "false");
  expect((await getPolitician("person-1"))?.redFlagCount).toBe(0);
});
it("exports only freshly eligible labels and states a research hold", async () => {
  cache.getOrFetch.mockResolvedValue({
    id: "person-1",
    fullName: "Synthetic",
    positions: [],
    partyAffiliations: [],
    isActive: true,
    sources: {},
    redFlagCount: 5,
  });
  let result = await generateProfileExport("person-1");
  expect(result.content).toContain("Criminal conviction");
  expect(result.content).not.toContain(sentinel);
  vi.stubEnv("PUBLIC_CASE_RECORDS_ENABLED", "false");
  result = await generateProfileExport("person-1");
  expect(result.content).not.toContain("Criminal conviction");
  expect(result.content).toContain("Research is being reviewed.");
});
it("uses documented days rather than approval time for landing activity", () => {
  const p = caseFixture();
  const r = projectPublicRecord(p)!;
  expect(caseActivityDays([r])).toEqual(["2020-02-29"]);
  r.events[0]!.date = { value: "2020-02", precision: "month" };
  expect(caseActivityDays([r])).toEqual([]);
});
it("filters eligible IDs before pagination and totals", async () => {
  const people = [
    {
      id: "held-person",
      fullName: "A",
      Position: [],
      PartyAffiliation: [],
      RedFlag: [{ id: "raw" }],
    },
    { id: "person-1", fullName: "B", Position: [], PartyAffiliation: [], RedFlag: [] },
  ];
  db.politician.findMany.mockImplementation(async (args) => {
    if (args.select) {
      return people.map((p) => ({ id: p.id }));
    }
    return people.filter((p) => !args.where.id || args.where.id.in?.includes(p.id));
  });
  const result = await listPoliticians({ hasRedFlags: true }, { page: 1, pageSize: 1 });
  expect(result.totalCount).toBe(1);
  expect(result.items.map((p) => p.id)).toEqual(["person-1"]);
  expect(db.politician.findMany.mock.calls.at(-1)?.[0].where.id).toEqual({ in: ["person-1"] });
});
