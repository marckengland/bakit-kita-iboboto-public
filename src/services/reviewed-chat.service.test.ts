import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { caseFixture } from "@/test/fixtures/case-review";
import { answerFromReviewedRecords } from "./reviewed-chat.service";

const profile = { id: "person-1", fullName: "Synthetic Person" };
function reviewedRow() {
  const packet = caseFixture();
  return { ...packet.record, CaseEvent: packet.events, SourceAttribution: packet.sources };
}
beforeEach(() => {
  vi.stubEnv("PUBLIC_CASE_RECORDS_ENABLED", "true");
  vi.mocked(prisma.politician.findMany).mockResolvedValue([profile] as never);
  vi.mocked(prisma.politician.findFirst).mockResolvedValue(profile as never);
  vi.mocked(prisma.controversy.findMany).mockResolvedValue([reviewedRow()] as never);
});
afterEach(() => vi.unstubAllEnvs());

describe("direct reviewed-record answers", () => {
  it("asks for explicit profile selection even for a single name match", async () => {
    const result = await answerFromReviewedRecords({ message: "Synthetic" });
    expect(result.status).toBe("choose_profile");
    expect(result.candidates).toEqual([profile]);
    expect(result.records).toEqual([]);
  });
  it("keeps ambiguous people separate and discloses a truncated choice list", async () => {
    vi.mocked(prisma.politician.findMany).mockResolvedValue(
      Array.from({ length: 6 }, (_, n) => ({
        id: `person-${n}`,
        fullName: `Synthetic ${n}`,
      })) as never
    );
    const result = await answerFromReviewedRecords({ message: "Synthetic" });
    expect(result.status).toBe("choose_profile");
    expect(result.candidates).toHaveLength(5);
    expect(result.moreProfiles).toBe(true);
    expect(result.profile).toBeNull();
    expect(prisma.politician.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 6 }));
  });
  it("distinguishes an unmatched name from missing reviewed research", async () => {
    vi.mocked(prisma.politician.findMany).mockResolvedValue([]);
    expect((await answerFromReviewedRecords({ message: "Unknown" })).status).toBe("no_profile");
    vi.mocked(prisma.controversy.findMany).mockResolvedValue([]);
    const result = await answerFromReviewedRecords({ message: "cases", politicianId: profile.id });
    expect(result.status).toBe("no_reviewed_records");
    expect(result.profile).toEqual(profile);
    expect(result.records).toEqual([]);
  });
  it("returns exact approved wording, event precision and citations without an external model", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("No external calls"));
    try {
      const result = await answerFromReviewedRecords({
        message: "Is this person guilty?",
        politicianId: profile.id,
      });
      expect(result.status).toBe("records");
      expect(result.records[0]).toMatchObject({
        title: "Synthetic case",
        description: "Synthetic reviewed facts",
        section: "case",
        outcome: { value: "convicted", label: "Criminal conviction" },
        events: [
          {
            summary: "Synthetic judgment",
            date: { value: "2020-02-29", precision: "day" },
            finality: "final",
            evidenceBasis: "primary_document",
            sources: [
              {
                sourceUrl: "https://source1.example.test/record/1",
                evidenceLocator: "Synthetic fixture paragraph",
              },
            ],
          },
        ],
      });
      expect(result.records[0]?.sources).toHaveLength(2);
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      fetch.mockRestore();
    }
  });
  it("withholds everything without database reads while public review is disabled", async () => {
    vi.stubEnv("PUBLIC_CASE_RECORDS_ENABLED", "false");
    const result = await answerFromReviewedRecords({
      message: "Synthetic",
      politicianId: profile.id,
    });
    expect(result.status).toBe("withheld");
    expect(result.profile).toBeNull();
    expect(result.records).toEqual([]);
    expect(prisma.politician.findFirst).not.toHaveBeenCalled();
    expect(prisma.politician.findMany).not.toHaveBeenCalled();
    expect(prisma.controversy.findMany).not.toHaveBeenCalled();
  });
  it("omits unreviewed and edited records and rechecks on the next request", async () => {
    const request = { message: "cases", politicianId: profile.id };
    expect((await answerFromReviewedRecords(request)).records).toHaveLength(1);
    const edited = reviewedRow();
    edited.description = "UNREVIEWED SENTINEL";
    vi.mocked(prisma.controversy.findMany).mockResolvedValue([edited] as never);
    const result = await answerFromReviewedRecords(request);
    expect(result.status).toBe("no_reviewed_records");
    expect(JSON.stringify(result)).not.toContain("SENTINEL");
  });
  it("does not describe a database failure as an empty research result", async () => {
    vi.mocked(prisma.controversy.findMany).mockRejectedValue(new Error("private database detail"));
    const result = await answerFromReviewedRecords({ message: "cases", politicianId: profile.id });
    expect(result.status).toBe("unavailable");
    expect(JSON.stringify(result)).not.toContain("private database detail");
  });
  it("handles removed or inactive selected profiles without returning their research", async () => {
    vi.mocked(prisma.politician.findFirst).mockResolvedValue(null);
    const result = await answerFromReviewedRecords({ message: "cases", politicianId: profile.id });
    expect(result.status).toBe("profile_not_found");
    expect(result.records).toEqual([]);
  });
});

it("escapes LIKE metacharacters so a literal name cannot become a broad profile search", async () => {
  await answerFromReviewedRecords({ message: "Name%_\\" });
  expect(prisma.politician.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([
          { fullName: { contains: "Name\\%\\_\\\\", mode: "insensitive" } },
        ]),
      }),
    })
  );
});
