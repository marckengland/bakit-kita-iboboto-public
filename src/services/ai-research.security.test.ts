import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResearchField, ResearchFinding } from "./ai-research.service";

const db = vi.hoisted(() => {
  const publicTable = () => ({
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    count: vi.fn(),
  });
  const publicTables = Object.fromEntries(
    [
      "politician",
      "controversy",
      "education",
      "factCheck",
      "election",
      "electionResultRecord",
      "sALNRecord",
      "redFlag",
      "partyAffiliation",
      "politicalParty",
      "sourceAttribution",
      "dataFreshness",
    ].map((name) => [name, publicTable()])
  );
  return {
    publicTables: publicTables as Record<string, ReturnType<typeof publicTable>>,
    politician: publicTables.politician as ReturnType<typeof publicTable>,
    aIResearchProposal: { createMany: vi.fn() },
  };
});

vi.mock("@/lib/prisma", () => ({
  default: { ...db.publicTables, aIResearchProposal: db.aIResearchProposal },
}));

import * as research from "./ai-research.service";
import {
  triggerAIResearchFallback,
  triggerSourceSpecificAIFallback,
} from "./data-pipeline.service";

const finding: ResearchFinding = {
  field: "birthday",
  value: "1970-01-15",
  sources: [
    {
      name: "Rappler",
      url: "https://www.rappler.com/philippines/person-profile/",
      date: "2026-01-01",
    },
    { name: "PhilStar", url: "https://www.philstar.com/headlines/2026/01/01/person-profile" },
  ],
  confidence: 0.95,
  reasoning: "Both articles list the same birthday.",
};

function expectNoPublicWrites() {
  for (const [name, table] of Object.entries(db.publicTables)) {
    for (const operation of ["create", "update", "upsert"] as const) {
      expect(table[operation as keyof typeof table], `${name}.${operation}`).not.toHaveBeenCalled();
    }
  }
}

describe("AI research publication boundary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("AI_RESEARCH_ENABLED", undefined);
    vi.stubEnv("GOOGLE_AI_API_KEY", "test-key");
    db.politician.findMany.mockResolvedValue([
      {
        id: "person-1",
        fullName: "Test Person",
        birthday: null,
        birthplace: "Manila",
        Position: [{ title: "Senator" }],
        _count: { BillAuthor: 1 },
      },
    ]);
    db.aIResearchProposal.createMany.mockResolvedValue({ count: 1 });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify({ findings: [finding], totalSourcesChecked: 2 }) }],
              },
            },
          ],
        }),
      })
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("defaults all research entrypoints off before provider calls or database access", async () => {
    await research.researchPolitician("person-1", "Test Person", ["birthday"]);
    const runners = [
      research.researchMissingData,
      research.researchControversies,
      research.researchEducation,
      research.researchFactChecks,
      research.researchElectionHistory,
      research.researchNetWorth,
      research.researchRedFlags,
      research.researchPartyAffiliations,
      research.researchAll,
    ];
    for (const runner of runners) {
      expect(await runner(1)).toMatchObject({
        politiciansResearched: 0,
        fieldsUpdated: 0,
        findingsStaged: 0,
      });
    }
    expect(fetch).not.toHaveBeenCalled();
    expect(db.politician.findMany).not.toHaveBeenCalled();
    expect(db.aIResearchProposal.createMany).not.toHaveBeenCalled();
    expectNoPublicWrites();
  });

  it("queues value and all citations atomically without publishing or adding public attribution", async () => {
    vi.stubEnv("AI_RESEARCH_ENABLED", "true");
    const report = await research.researchMissingData(1);
    expect(report).toMatchObject({ fieldsUpdated: 0, findingsStaged: 1, errors: [] });
    expect(db.aIResearchProposal.createMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: expect.stringMatching(/^[a-f0-9]{64}$/),
        politicianId: "person-1",
        fieldName: "birthday",
        value: "1970-01-15",
        sources: finding.sources,
        confidence: 0.95,
        reasoning: finding.reasoning,
      }),
      skipDuplicates: true,
    });
    expectNoPublicWrites();
  });

  it.each([
    [research.researchControversies, "controversies"],
    [research.researchEducation, "education"],
    [research.researchFactChecks, "fact_checks"],
    [research.researchElectionHistory, "election_history"],
    [research.researchNetWorth, "net_worth"],
    [research.researchRedFlags, "red_flags"],
    [research.researchPartyAffiliations, "party"],
  ] as const)(
    "stages each research domain without publishing (%s)",
    async (runner, field: ResearchField) => {
      vi.stubEnv("AI_RESEARCH_ENABLED", "true");
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  { text: JSON.stringify({ findings: [{ ...finding, field, value: "[]" }] }) },
                ],
              },
            },
          ],
        }),
      } as Response);
      expect(await runner(1)).toMatchObject({ fieldsUpdated: 0, findingsStaged: 1 });
      expect(db.aIResearchProposal.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fieldName: field,
            value: "[]",
            sources: finding.sources,
          }),
        })
      );
      expectNoPublicWrites();
    }
  );

  it("keeps manual pipeline fallback paths off without research opt-in", async () => {
    await triggerAIResearchFallback();
    await triggerSourceSpecificAIFallback("politicians");
    expect(fetch).not.toHaveBeenCalled();
    expect(db.politician.findMany).not.toHaveBeenCalled();
    expect(db.aIResearchProposal.createMany).not.toHaveBeenCalled();
    expectNoPublicWrites();
  });

  it("deduplicates the same finding without overwriting reviewed proposals", async () => {
    vi.stubEnv("AI_RESEARCH_ENABLED", "true");
    db.aIResearchProposal.createMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    expect(await research.researchMissingData(1)).toMatchObject({ findingsStaged: 1 });
    expect(await research.researchMissingData(1)).toMatchObject({ findingsStaged: 0 });
    const calls = db.aIResearchProposal.createMany.mock.calls;
    expect(calls[0]?.[0].data.id).toBe(calls[1]?.[0].data.id);
    expectNoPublicWrites();
  });

  it.each([
    ["duplicates", [finding.sources[0], finding.sources[0]]],
    [
      "fragment duplicates",
      [finding.sources[0], { ...finding.sources[0], url: `${finding.sources[0]?.url}#biography` }],
    ],
    [
      "repeated slash duplicates",
      [
        finding.sources[0],
        { name: "Rappler", url: "https://www.rappler.com/philippines/person-profile//" },
      ],
    ],
    [
      "encoded article duplicates",
      [
        finding.sources[0],
        { name: "Rappler", url: "https://www.rappler.com/philippines/person-%70rofile/" },
      ],
    ],
    [
      "encoded index homepage",
      [finding.sources[0], { name: "PhilStar", url: "https://www.philstar.com/%69ndex.php" }],
    ],
    [
      "protocol and tracking duplicates",
      [
        finding.sources[0],
        { name: "Rappler", url: "http://rappler.com/philippines/person-profile/?utm_source=other" },
      ],
    ],
    ["homepage", [finding.sources[0], { name: "PhilStar", url: "https://www.philstar.com/" }]],
    [
      "non HTTP",
      [finding.sources[0], { name: "PhilStar", url: "ftp://www.philstar.com/headlines/person" }],
    ],
    [
      "spoofed hostname",
      [
        finding.sources[0],
        { name: "PhilStar", url: "https://philstar.com.attacker.example/headlines/person" },
      ],
    ],
    [
      "untrusted hostname",
      [finding.sources[0], { name: "News", url: "https://example.com/person" }],
    ],
  ])("rejects %s citations even when the model claims high confidence", async (_label, sources) => {
    vi.stubEnv("AI_RESEARCH_ENABLED", "true");
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: { parts: [{ text: JSON.stringify({ findings: [{ ...finding, sources }] }) }] },
          },
        ],
      }),
    } as Response);
    expect(await research.researchMissingData(1)).toMatchObject({
      fieldsUpdated: 0,
      findingsStaged: 0,
      fieldsSkippedLowConfidence: 1,
    });
    expect(db.aIResearchProposal.createMany).not.toHaveBeenCalled();
    expectNoPublicWrites();
  });

  it("rejects low confidence even with two credible citations", async () => {
    vi.stubEnv("AI_RESEARCH_ENABLED", "true");
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify({ findings: [{ ...finding, confidence: 0.89 }] }) }],
            },
          },
        ],
      }),
    } as Response);
    expect(await research.researchMissingData(1)).toMatchObject({
      findingsStaged: 0,
      fieldsSkippedLowConfidence: 1,
    });
    expectNoPublicWrites();
  });

  it("reports a queue failure without falling back to public writes", async () => {
    vi.stubEnv("AI_RESEARCH_ENABLED", "true");
    db.aIResearchProposal.createMany.mockRejectedValueOnce(new Error("queue unavailable"));
    expect(await research.researchMissingData(1)).toMatchObject({
      fieldsUpdated: 0,
      findingsStaged: 0,
      errors: [expect.stringContaining("queue unavailable")],
    });
    expectNoPublicWrites();
  });
});
