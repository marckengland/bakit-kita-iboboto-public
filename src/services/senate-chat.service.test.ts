import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { buildReleaseImportPlan } from "@/lib/release-import";
import { releaseData } from "@/lib/release-data";
import { answerFromSenateFilings, shouldSearchSenateFilings } from "./senate-chat.service";

const plan = buildReleaseImportPlan();
const profiles = plan.profiles.map(({ id, fullName }) => ({ id, fullName }));
const storedBills = plan.bills.map((bill) => ({
  ...bill,
  BillAuthor: plan.authors.filter((author) => author.billId === bill.id),
}));
const zubiri = profiles.find((profile) => profile.fullName.includes("Zubiri"))!;
const bam = profiles.find((profile) => profile.fullName === "Bam Aquino")!;

beforeEach(() => {
  vi.stubEnv("PUBLIC_CASE_RECORDS_ENABLED", "false");
  vi.mocked(prisma.politician.findMany).mockResolvedValue(profiles as never);
  vi.mocked(prisma.politician.findFirst).mockImplementation(
    (args) =>
      Promise.resolve(profiles.find((profile) => profile.id === args?.where?.id) ?? null) as never
  );
  vi.mocked(prisma.bill.findMany).mockResolvedValue(storedBills as never);
});
afterEach(() => vi.unstubAllEnvs());

describe("reviewed Senate chat", () => {
  it("returns SBN-142 with an unknown date and exact conflicting source observations while cases are withheld", async () => {
    const result = await answerFromSenateFilings({ message: "When was SBN-142 filed?" });
    expect(result.senate?.status).toBe("records");
    expect(result.records).toEqual([]);
    expect(result.senate?.filings).toHaveLength(1);
    expect(result.senate?.filings[0]).toMatchObject({
      id: "ph-senate-20-sbn-142",
      filingDate: null,
      currentLegislativeStatus: null,
      enactment: null,
      introducedBy: { profileId: zubiri.id },
    });
    expect(result.senate?.filings[0]?.dateObservations?.map((claim) => claim.value)).toContain(
      "2025-07-14"
    );
    expect(
      result.senate?.filings[0]?.sources.some(
        (source) => source.publisher === "Senate of the Philippines"
      )
    ).toBe(true);
    expect(prisma.controversy.findMany).not.toHaveBeenCalled();
  });

  it.each(["Zubiri", "What bills did Zubiri file?", "Ano ang mga panukala ni Zubiri?"])(
    "requires explicit identity selection for %s",
    async (message) => {
      const result = await answerFromSenateFilings({ message });
      expect(result.status).toBe("choose_profile");
      expect(result.candidates).toEqual([zubiri]);
      expect(result.senate?.filings).toEqual([]);
    }
  );

  it("keeps ambiguous surnames separate", async () => {
    const result = await answerFromSenateFilings({ message: "Tulfo" });
    expect(result.candidates.map((profile) => profile.fullName)).toEqual([
      "Erwin Tulfo",
      "Raffy Tulfo",
    ]);
    expect(result.senate?.filings).toEqual([]);
  });

  it("does not substitute a different person sharing an unmatched full name", async () => {
    const result = await answerFromSenateFilings({ message: "Ferdinand Marcos" });
    expect(result.candidates).toEqual([]);
    expect(result.senate?.filings).toEqual([]);
  });

  it("shows selected filings after profile selection without calling an external model", async () => {
    const external = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("No external calls"));
    try {
      const result = await answerFromSenateFilings({
        message: "Show filings",
        politicianId: zubiri.id,
      });
      expect(result.senate?.filings.map((filing) => filing.billNumber)).toEqual([142]);
      expect(result.profile).toEqual(zubiri);
      expect(external).not.toHaveBeenCalled();
    } finally {
      external.mockRestore();
    }
  });

  it("matches literal title/topic words only within the reviewed sample", async () => {
    const result = await answerFromSenateFilings({ message: "online gambling bills" });
    expect(result.senate?.filings.length).toBeGreaterThan(0);
    expect(
      result.senate?.filings.every((filing) =>
        /online.*gambling/i.test(`${filing.title} ${filing.summary}`)
      )
    ).toBe(true);
  });

  it.each(["SBN-102", "SBN-141", "SBN-179", "SBN-99999"])(
    "does not backfill absent or held %s",
    async (message) => {
      const result = await answerFromSenateFilings({ message });
      expect(result.senate?.status).toBe("no_matching_filings");
      expect(result.senate?.filings).toEqual([]);
    }
  );

  it.each([
    "SBN-142 in the 19th Congress",
    "Who should I vote for?",
    "What is Zubiri's net worth?",
  ])("explains unsupported coverage for %s", async (message) => {
    const result = await answerFromSenateFilings({ message });
    expect(result.senate?.status).toBe("outside_coverage");
    expect(result.senate?.filings).toEqual([]);
  });

  it("reports missing imported rows separately from no search matches", async () => {
    vi.mocked(prisma.bill.findMany).mockResolvedValue([]);
    const result = await answerFromSenateFilings({ message: "SBN-142" });
    expect(result.senate?.status).toBe("not_loaded");
    expect(result.senate?.filings).toEqual([]);
  });

  it.each(["title", "filingDate", "introducer"])(
    "withholds a stored filing after unreviewed %s drift",
    async (field) => {
      const changed = storedBills.map((bill) => {
        if (bill.id !== "ph-senate-20-sbn-142") {
          return bill;
        }
        return {
          ...bill,
          ...(field === "title"
            ? { title: "UNREVIEWED SENTINEL" }
            : field === "filingDate"
              ? { filingDate: new Date("2025-07-03") }
              : { BillAuthor: [{ politicianId: bam.id, role: "introduced_by" }] }),
        };
      });
      vi.mocked(prisma.bill.findMany).mockResolvedValue(changed as never);
      const result = await answerFromSenateFilings({ message: "SBN-142" });
      expect(result.senate?.status).toBe("needs_review");
      expect(result.senate?.filings).toEqual([]);
      expect(JSON.stringify(result)).not.toContain("SENTINEL");
    }
  );

  it("does not silently answer for the old selection when the question names another person", async () => {
    const result = await answerFromSenateFilings({
      message: "Bam Aquino bills",
      politicianId: zubiri.id,
    });
    expect(result.status).toBe("choose_profile");
    expect(result.candidates).toEqual([bam]);
    expect(result.senate?.filings).toEqual([]);
  });

  it("returns a bounded list and discloses that remaining records belong to a selected sample", async () => {
    const result = await answerFromSenateFilings({ message: "Show Senate filings" });
    expect(result.senate?.filings).toHaveLength(10);
    expect(result.senate?.remainingFilings).toBe(releaseData.filings.length - 10);
    expect(result.senate?.datasetUrl).toBe("/data/senate-20/INDEX.md");
  });

  it("does not describe storage failure as missing filings or disclose database diagnostics", async () => {
    vi.mocked(prisma.bill.findMany).mockRejectedValue(new Error("PRIVATE DATABASE SENTINEL"));
    const result = await answerFromSenateFilings({ message: "SBN-142" });
    expect(result.senate?.status).toBe("unavailable");
    expect(JSON.stringify(result)).not.toContain("SENTINEL");
  });

  it("does not show filings for inactive or missing profiles", async () => {
    vi.mocked(prisma.politician.findMany).mockResolvedValue([]);
    const result = await answerFromSenateFilings({ message: "SBN-142" });
    expect(result.senate?.filings).toEqual([]);
    expect(result.senate?.status).toBe("not_loaded");
  });

  it("keeps explicit case questions on the existing case-review path", () => {
    expect(shouldSearchSenateFilings({ message: "SBN-142" })).toBe(true);
    expect(shouldSearchSenateFilings({ message: "Zubiri" })).toBe(true);
    expect(shouldSearchSenateFilings({ message: "What cases does Zubiri have?" })).toBe(false);
    expect(shouldSearchSenateFilings({ message: "Synthetic Person" })).toBe(false);
  });
});

it.each(["SBN-142 in Congress 19", "SBN-142 in the 20th Congress and the 19th Congress"])(
  "refuses conflicting Congress constraints: %s",
  async (message) => {
    const answer = await answerFromSenateFilings({ message });
    expect(answer.senate?.status).toBe("outside_coverage");
    expect(answer.senate?.filings).toEqual([]);
  }
);
it("does not discard an unresolved author constraint", async () => {
  const answer = await answerFromSenateFilings({ message: "SBN-142 by Ferdinand Marcos" });
  expect(answer.senate?.status).toBe("no_profile");
  expect(answer.senate?.filings).toEqual([]);
});
it("combines a title query with an explicit person constraint", async () => {
  const answer = await answerFromSenateFilings({
    message: "Show online gambling bills by Zubiri",
    politicianId: zubiri.id,
  });
  expect(answer.senate?.filings.map((filing) => filing.billNumber)).toEqual([142]);
});
