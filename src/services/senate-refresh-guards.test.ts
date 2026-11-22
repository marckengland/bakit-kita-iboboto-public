import { beforeEach, expect, it, vi } from "vitest";
import { prisma } from "../lib/prisma";
import { enhancedCache } from "../lib/cache-service";
import { getReleasedFiling, releaseData } from "../lib/release-data";
import { getBillById, getBills } from "./legislative.service";
import { getPolitician } from "./politician.service";

vi.mock("../lib/cache-service", async (original) => {
  const actual = await original<typeof import("../lib/cache-service")>();
  return {
    ...actual,
    enhancedCache: { ...actual.enhancedCache, getOrFetch: vi.fn((_key, fetcher) => fetcher()) },
  };
});
const approved = getReleasedFiling("ph-senate-20-sbn-169")!;
const person = releaseData.profiles.find((p) => p.id === approved.introducedBy.profileId)!;
function stored() {
  return {
    id: approved.id,
    billNumber: approved.reference,
    title: approved.title,
    summary: approved.summary,
    filingDate: new Date(approved.filingDate!),
    status: null,
    republicActNumber: null,
    chamber: "senate",
    congress: 20,
    session: null,
    fullText: null,
    BillAuthor: [
      {
        politicianId: person.id,
        role: "introduced_by",
        Politician: { id: person.id, fullName: person.displayName },
      },
    ],
    SourceAttribution: [],
  };
}
beforeEach(() => {
  vi.mocked(prisma.politician.findFirst).mockResolvedValue({
    id: person.id,
    fullName: person.displayName,
  } as never);
  vi.mocked(prisma.politician.findMany).mockResolvedValue([
    { id: person.id, fullName: person.displayName },
  ] as never);
  vi.mocked(prisma.bill.findMany).mockResolvedValue([stored()] as never);
  vi.mocked(prisma.bill.findUnique).mockResolvedValue(stored() as never);
  vi.mocked(prisma.bill.count).mockResolvedValue(1);
});

it("adds history to a matching stored bill on the actual detail and list services", async () => {
  expect(
    (await getBillById(approved.id))?.reviewedBatch?.refresh?.successor?.successorReference
  ).toBe("SBN-1894");
  expect((await getBills(person.id)).items[0]?.reviewedBatch?.refresh?.events).toHaveLength(4);
});

it.each(["title", "status", "author", "name"])(
  "withholds new history for stored %s drift",
  async (field) => {
    const row = stored();
    if (field === "title") {
      row.title = "Synthetic conflicting title";
    }
    if (field === "status") {
      (row as { status: string | null }).status = "passed";
    }
    if (field === "author") {
      row.BillAuthor[0]!.politicianId = "another-person";
    }
    if (field === "name") {
      vi.mocked(prisma.politician.findMany).mockResolvedValue([
        { id: person.id, fullName: "Synthetic conflicting person" },
      ] as never);
    }
    vi.mocked(prisma.bill.findUnique).mockResolvedValue(row as never);
    vi.mocked(prisma.bill.findMany).mockResolvedValue([row] as never);
    expect((await getBillById(approved.id))?.reviewedBatch?.refresh).toBeUndefined();
    expect((await getBills(person.id)).items[0]?.reviewedBatch?.refresh).toBeUndefined();
  }
);

it("rechecks a stale cached detail before attaching refresh history", async () => {
  vi.mocked(enhancedCache.getOrFetch).mockResolvedValueOnce({
    ...stored(),
    title: "Synthetic stale cached title",
    authorRole: "introduced_by",
    authors: [
      { politicianId: person.id, politicianName: person.displayName, role: "introduced_by" },
    ],
    sources: [],
    reviewedBatch: approved,
  } as never);
  expect((await getBillById(approved.id))?.reviewedBatch?.refresh).toBeUndefined();
});

it("withholds elected terms from a changed stored person", async () => {
  vi.mocked(prisma.politician.findUnique).mockResolvedValue({
    id: person.id,
    fullName: "Synthetic conflicting person",
    firstName: "Synthetic",
    lastName: "Person",
    Position: [],
    PartyAffiliation: [],
    SourceAttribution: [],
    isActive: true,
  } as never);
  expect((await getPolitician(person.id))?.reviewedBatch?.refresh).toBeUndefined();
});

it("validates a JSON-deserialized cached date without losing approved history", async () => {
  const cached = JSON.parse(
    JSON.stringify({
      ...stored(),
      authors: [
        { politicianId: person.id, politicianName: person.displayName, role: "introduced_by" },
      ],
      sources: [],
      reviewedBatch: approved,
    })
  );
  vi.mocked(enhancedCache.getOrFetch).mockResolvedValueOnce(cached);
  expect(
    (await getBillById(approved.id))?.reviewedBatch?.refresh?.successor?.successorReference
  ).toBe("SBN-1894");
});

it("withholds history for a malformed cached date", async () => {
  vi.mocked(enhancedCache.getOrFetch).mockResolvedValueOnce({
    ...stored(),
    filingDate: "invalid-date",
    authors: [
      { politicianId: person.id, politicianName: person.displayName, role: "introduced_by" },
    ],
    sources: [],
    reviewedBatch: approved,
  } as never);
  expect((await getBillById(approved.id))?.reviewedBatch?.refresh).toBeUndefined();
});

it("withholds history when a cached author name no longer matches the approved identity", async () => {
  vi.mocked(enhancedCache.getOrFetch).mockResolvedValueOnce({
    ...stored(),
    authors: [
      {
        politicianId: person.id,
        politicianName: "Synthetic stale author name",
        role: "introduced_by",
      },
    ],
    sources: [],
    reviewedBatch: approved,
  } as never);
  expect((await getBillById(approved.id))?.reviewedBatch?.refresh).toBeUndefined();
});
