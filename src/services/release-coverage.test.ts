import { BillAuthorRole, Chamber, GovernmentLevel, SourceType } from "@prisma/client";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/elasticsearch", () => ({
  default: { search: vi.fn() },
  INDICES: { POLITICIANS: "politicians" },
}));

vi.mock("@/middleware/api-auth.middleware", () => ({
  withApiAuth: (handler: (request: NextRequest) => Promise<Response>) => handler,
  addApiResponseHeaders: (response: Response) => response,
}));

vi.mock("@/lib/prisma", () => {
  const client = {
    bill: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    billAuthor: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
    campaignPromise: { groupBy: vi.fn().mockResolvedValue([]) },
    politician: { count: vi.fn().mockResolvedValue(2), findMany: vi.fn(), findUnique: vi.fn() },
    position: { findMany: vi.fn().mockResolvedValue([]) },
    electionResultRecord: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
    },
    project: { findMany: vi.fn().mockResolvedValue([]) },
    redFlag: { findMany: vi.fn().mockResolvedValue([]) },
    sALNRecord: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    sessionAttendance: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
    },
    votingRecord: { count: vi.fn().mockResolvedValue(0) },
  };
  return { default: client, prisma: client };
});

import { GET as getConflicts } from "@/app/api/politicians/[id]/conflicts/route";
import { GET as listBills } from "@/app/api/politicians/[id]/bills/route";
import { GET as findProfiles } from "@/app/api/politicians/search/route";
import { GET as searchProfiles } from "@/app/api/search/route";
import { GET as autocompleteProfiles } from "@/app/api/search/autocomplete/route";
import { GET as publicBills } from "@/app/api/v1/bills/route";
import { GET as publicBill } from "@/app/api/v1/bills/[id]/route";
import { GET as publicProfiles } from "@/app/api/v1/politicians/route";
import { GET as publicProfile } from "@/app/api/v1/politicians/[id]/route";
import elasticsearch from "@/lib/elasticsearch";
import { caseContentHash } from "@/lib/case-review";
import prisma from "@/lib/prisma";
import { caseFixture } from "@/test/fixtures/case-review";
import { generateProfileExport, generateComparisonExport } from "./export.service";
import { getComparableMetrics } from "./comparison.service";
import { getBillById, getBills } from "./legislative.service";
import {
  compareLegislativeImpactScores,
  getLegislativeImpactScore,
} from "./legislative-impact.service";
import { getPolitician, listPoliticians } from "./politician.service";
import { getTermLimitStatus, isEligibleForReelection } from "./term-limit.service";

const emptyIndex = {
  took: 1,
  timed_out: false,
  _shards: { total: 1, successful: 1, skipped: 0, failed: 0 },
  hits: { hits: [], total: { value: 0, relation: "eq" as const } },
};

const profileId = "01K5ST4HCY5N9130WESWJH9BSZ";
const otherProfileId = "01K5S6MAZ4YBST5GDJV827A0HM";
const billId = "ph-senate-20-sbn-142";
const recordedAt = new Date("2026-11-19");
const profile = {
  id: profileId,
  fullName: "Juan Miguel F. Zubiri",
  legalName: null,
  nickname: null,
  firstName: "Juan Miguel",
  middleName: "F.",
  lastName: "Zubiri",
  suffix: null,
  birthday: null,
  birthplace: null,
  photo: null,
  isActive: true,
  createdAt: recordedAt,
  updatedAt: recordedAt,
  Position: [],
  PartyAffiliation: [],
  SourceAttribution: [],
};
const bill = {
  id: billId,
  billNumber: "SBN-142",
  title: "Anti-Online Gambling Act of 2025",
  summary: "Would prohibit online gambling in the Philippines.",
  fullText: null,
  filingDate: null,
  status: null,
  republicActNumber: null,
  chamber: Chamber.senate,
  congress: 20,
  session: null,
  createdAt: recordedAt,
  updatedAt: recordedAt,
  BillAuthor: [
    {
      role: BillAuthorRole.introduced_by,
      Politician: { id: profileId, fullName: profile.fullName },
    },
  ],
  SourceAttribution: [
    {
      sourceType: SourceType.legislative_record,
      sourceName: "Senate Legislative Information System",
      sourceUrl: "https://web.senate.gov.ph/lis/bill_res.aspx?congress=20&q=SBN-142",
      documentDate: null,
      retrievedAt: recordedAt,
      confidence: null,
      isAIProcessed: false,
      originalDocumentId: null,
      fieldName: "title",
    },
  ],
};

describe("reviewed release coverage", () => {
  it("provides the dated membership observation without inferring current office", async () => {
    vi.mocked(prisma.politician.findUnique).mockResolvedValue(profile);
    vi.mocked(prisma.politician.findMany).mockResolvedValue([profile]);

    const detail = await getPolitician(profileId);
    const directory = await listPoliticians();

    expect(detail?.redFlagCount).toBeNull();
    for (const result of [detail, directory.items[0]]) {
      expect(result).toMatchObject({
        currentPosition: null,
        hasRedFlags: null,
        reviewedBatch: { office: "Senator", congress: 20, observedOn: "2025-07-28" },
      });
    }
  });

  it("preserves the withheld filing date, conflict evidence, and unknown source confidence", async () => {
    vi.mocked(prisma.bill.findUnique).mockResolvedValue(bill);
    vi.mocked(prisma.bill.findMany).mockResolvedValue([bill]);
    vi.mocked(prisma.bill.count).mockResolvedValue(1);

    const detail = await getBillById(billId);
    const list = await getBills(profileId);
    for (const result of [detail, list.items[0]]) {
      expect(result).toMatchObject({
        filingDate: null,
        status: null,
        session: null,
        authorRole: BillAuthorRole.introduced_by,
        reviewedBatch: {
          reference: "SBN-142",
          dateObservations: expect.arrayContaining([
            expect.objectContaining({ value: "2025-07-14" }),
          ]),
          claimSources: expect.objectContaining({ filingDate: [] }),
        },
      });
    }
    expect(detail?.sources[0]?.confidence).toBeNull();
  });

  it("leaves career comparison metrics unknown for the selected batch", async () => {
    const metrics = await getComparableMetrics([profileId, otherProfileId]);

    expect(metrics.map(({ name }) => name)).toContain("Bills Authored");
    for (const { values } of metrics) {
      expect(values).toEqual({ [profileId]: null, [otherProfileId]: null });
    }
  });

  it("withholds an impact score when only selected filings were reviewed", async () => {
    expect(await getLegislativeImpactScore(profileId)).toMatchObject({
      politicianId: profileId,
      scoreOutOf100: null,
      totalBillsAuthored: null,
      reviewedBatch: { selectedFilingCount: 1 },
    });
  });

  it("leaves career length and eligibility unknown for dated membership", async () => {
    vi.mocked(prisma.politician.findUnique).mockResolvedValue(profile);

    expect(await getTermLimitStatus(profileId)).toMatchObject({
      currentPosition: null,
      totalYearsInOffice: null,
      reviewedBatch: { observedOn: "2025-07-28" },
    });
    expect(await isEligibleForReelection(profileId)).toBeNull();
  });

  it("keeps selection coverage in the HTTP response when a bill filter returns no rows", async () => {
    vi.mocked(prisma.bill.findMany).mockResolvedValue([]);
    vi.mocked(prisma.bill.count).mockResolvedValue(0);
    const response = await listBills(
      new NextRequest("http://localhost/api/politicians/profile/bills?status=passed"),
      { params: Promise.resolve({ id: profileId }) }
    );
    expect(await response.json()).toMatchObject({
      items: [],
      totalCount: 0,
      reviewedBatch: { selectedFilingCount: 1 },
    });
  });

  it("includes dated membership in a quick profile search result", async () => {
    vi.mocked(prisma.politician.findMany).mockResolvedValue([profile]);
    const response = await findProfiles(
      new NextRequest("http://localhost/api/politicians/search?q=Zubiri")
    );

    expect(await response.json()).toMatchObject({
      results: [{ id: profileId, reviewedBatch: { observedOn: "2025-07-28" } }],
    });
  });

  it("exports the dated observation and current-office uncertainty", async () => {
    vi.mocked(prisma.politician.findUnique).mockResolvedValue(profile);

    const { content } = await generateProfileExport(profileId);

    expect(content).toContain("2025-07-28");
    expect(content).toContain("Current office unknown");
    expect(content).not.toContain("Former Official");
  });

  it("exports covered comparison profiles without an inferred party or career total", async () => {
    vi.mocked(prisma.politician.findUnique)
      .mockResolvedValueOnce(profile)
      .mockResolvedValueOnce({ ...profile, id: otherProfileId, fullName: "Bam Aquino" });

    const { content } = await generateComparisonExport([profileId, otherProfileId]);

    expect(content).toContain("2025-07-28");
    expect(content).toContain("Selected filings");
    expect(content).not.toContain("Independent");
  });

  it("includes an observed senator in the national directory filter without asserting current office", async () => {
    vi.mocked(prisma.politician.findMany).mockImplementation((args) => {
      const id = args?.where?.id;
      const matches = typeof id === "object" && Array.isArray(id?.in) && id.in.includes(profileId);
      return Promise.resolve(matches ? [profile] : []) as ReturnType<
        typeof prisma.politician.findMany
      >;
    });

    const result = await listPoliticians({ level: GovernmentLevel.national, position: "Senator" });

    expect(result.items).toMatchObject([
      { id: profileId, currentPosition: null, reviewedBatch: { office: "Senator" } },
    ]);
  });

  it("does not infer that conflicts are absent from unreviewed financial records", async () => {
    const response = await getConflicts(
      new NextRequest("http://localhost/api/politicians/profile/conflicts"),
      { params: Promise.resolve({ id: profileId }) }
    );

    expect(await response.json()).toMatchObject({
      hasConflicts: null,
      availability: "not_reviewed",
      reviewedBatch: { observedOn: "2025-07-28" },
    });
  });

  it("distinguishes unknown and zero confidence when binding case evidence", () => {
    const packet = caseFixture();
    const unknown = {
      ...packet,
      sources: packet.sources.map((source, i) =>
        i === 0 ? { ...source, confidence: null } : source
      ),
    };

    expect(caseContentHash(unknown)).not.toBe(caseContentHash(packet));
  });

  it("leaves the selected batch out of an impact-score ranking", async () => {
    const scores = await compareLegislativeImpactScores([profileId, "legacy-profile"]);

    expect(scores.map(({ politicianId }) => politicianId)).toEqual(["legacy-profile"]);
  });

  it("finds the imported profile by name when full-text search is unavailable", async () => {
    vi.mocked(elasticsearch.search).mockRejectedValueOnce(new Error("search index unavailable"));
    vi.mocked(prisma.politician.findMany).mockResolvedValue([profile]);
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const response = await searchProfiles(
        new NextRequest("http://localhost/api/search?q=Zubiri")
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        searchMode: "name_lookup",
        total: 1,
        results: [{ politician: { id: profileId, reviewedBatch: { office: "Senator" } } }],
      });
    } finally {
      errorLog.mockRestore();
    }
  });

  it("finds the reviewed senator with national and position filters when the index is healthy but empty", async () => {
    vi.mocked(elasticsearch.search).mockReset().mockResolvedValue(emptyIndex);
    vi.mocked(prisma.politician.findMany).mockImplementation((args) => {
      const id = args?.where?.id;
      const matches = typeof id === "object" && Array.isArray(id?.in) && id.in.includes(profileId);
      return Promise.resolve(matches ? [profile] : []) as ReturnType<
        typeof prisma.politician.findMany
      >;
    });
    const response = await searchProfiles(
      new NextRequest("http://localhost/api/search?q=Zubiri&level=national&position=Senator")
    );

    expect(await response.json()).toMatchObject({
      searchMode: "name_lookup",
      total: 1,
      results: [
        {
          politician: {
            id: profileId,
            currentPosition: null,
            reviewedBatch: { office: "Senator", observedOn: "2025-07-28" },
          },
        },
      ],
    });
  });

  it("paginates queryless national and Senator matches when the index is healthy but empty", async () => {
    vi.mocked(elasticsearch.search).mockReset().mockResolvedValue(emptyIndex);
    vi.mocked(prisma.politician.findMany).mockImplementation((args) => {
      const id = args?.where?.id;
      const matches = typeof id === "object" && Array.isArray(id?.in) && id.in.includes(profileId);
      const profiles = [profile, { ...profile, id: otherProfileId, fullName: "Bam Aquino" }];
      return Promise.resolve(matches ? profiles : []) as ReturnType<
        typeof prisma.politician.findMany
      >;
    });
    const response = await searchProfiles(
      new NextRequest(
        "http://localhost/api/search?level=national&position=Senator&page=2&pageSize=1"
      )
    );

    expect(await response.json()).toMatchObject({
      total: 2,
      totalPages: 2,
      page: 2,
      pageSize: 1,
      results: [
        {
          politician: {
            id: profileId,
            currentPosition: null,
            reviewedBatch: { office: "Senator" },
          },
        },
      ],
    });
  });

  it.each(["q=Zubiri", "level=national&position=Senator"])(
    "preserves full-text search without imported reviewed profiles for %s",
    async (query) => {
      vi.mocked(prisma.politician.count).mockResolvedValueOnce(0);
      vi.mocked(elasticsearch.search)
        .mockReset()
        .mockResolvedValue({
          ...emptyIndex,
          hits: {
            total: { value: 1, relation: "eq" },
            hits: [
              {
                _index: "politicians",
                _id: "legacy-zubiri",
                _score: 4.2,
                _source: {
                  ...profile,
                  id: "legacy-zubiri",
                  hasRedFlags: false,
                  currentPosition: {
                    title: "Senator",
                    level: "national",
                    jurisdiction: "Philippines",
                  },
                },
              },
            ],
          },
        });

      const response = await searchProfiles(
        new NextRequest("http://localhost/api/search?" + query)
      );
      const result = await response.json();

      expect(result).not.toHaveProperty("searchMode");
      expect(result.results).toMatchObject([
        { politician: { id: "legacy-zubiri" }, relevanceScore: 4.2 },
      ]);
    }
  );

  it("suggests an imported name with dated membership when autocomplete's index is empty", async () => {
    vi.mocked(elasticsearch.search).mockReset().mockResolvedValue(emptyIndex);
    vi.mocked(prisma.politician.findMany).mockResolvedValue([profile]);
    const response = await autocompleteProfiles(
      new NextRequest("http://localhost/api/search/autocomplete?q=Zub")
    );

    expect(await response.json()).toMatchObject({
      suggestions: [
        { id: profileId, text: profile.fullName, subtext: expect.stringContaining("2025-07-28") },
      ],
    });
  });

  it("describes the CC0 scope and provenance in the four batch API responses", async () => {
    vi.mocked(prisma.politician.findMany).mockResolvedValue([profile]);
    vi.mocked(prisma.politician.findUnique).mockResolvedValue(profile);
    vi.mocked(prisma.bill.findMany).mockResolvedValue([bill]);
    vi.mocked(prisma.bill.findUnique).mockResolvedValue(bill);
    vi.mocked(prisma.bill.count).mockResolvedValue(1);
    const responses = await Promise.all([
      publicProfiles(new NextRequest("http://localhost/api/v1/politicians")),
      publicProfile(new NextRequest("http://localhost/api/v1/politicians/" + profileId), {
        params: Promise.resolve({ id: profileId }),
      }),
      publicBills(new NextRequest("http://localhost/api/v1/bills?politicianId=" + profileId)),
      publicBill(new NextRequest("http://localhost/api/v1/bills/" + billId), {
        params: Promise.resolve({ id: billId }),
      }),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(200);
      const { meta } = await response.json();
      expect(meta.attribution).toContain("CC0-1.0");
      expect(meta.attribution).toContain("Original documents retain their own rights");
      expect(meta.attribution).not.toContain("Attribution required");
      expect(meta.reviewedBatchReuse).toMatchObject({
        structuredFactsLicense: "CC0-1.0",
        sourceDocumentRightsTransferred: false,
        datasetUrl: "/data/senate-20/INDEX.md",
      });
    }
  });
});
