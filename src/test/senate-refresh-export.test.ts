import { describe, expect, it, vi } from "vitest";
import { getReleasedFiling, getReleasedProfile } from "../lib/release-data";
import { generateProfileExport, generateComparisonExport } from "../services/export.service";
import { getPolitician } from "../services/politician.service";
import { answerFromSenateFilings } from "../services/senate-chat.service";
import { comparePoliticians } from "../services/comparison.service";

vi.mock("../services/politician.service", () => ({ getPolitician: vi.fn() }));
vi.mock("../services/comparison.service", () => ({ comparePoliticians: vi.fn() }));
vi.mock("../services/saln.service", () => ({ getSALNHistory: vi.fn().mockResolvedValue([]) }));
vi.mock("../services/election.service", () => ({
  getElectionHistory: vi.fn().mockResolvedValue([]),
}));
vi.mock("../services/red-flag.service", () => ({ getRedFlags: vi.fn().mockResolvedValue([]) }));

vi.mock("../services/senate-chat.service", () => ({
  answerFromSenateFilings: vi
    .fn()
    .mockResolvedValue({ senate: { status: "not_loaded", filings: [] } }),
}));

const id = "01K5S6MAZ4YBST5GDJV827A0HM";
const reviewedBatch = getReleasedProfile(id)!;

describe("qualified elected terms in exports", () => {
  it("retains scheduled dates and exact source links in a profile export", async () => {
    vi.mocked(getPolitician).mockResolvedValueOnce({
      id,
      fullName: "Bam Aquino",
      positions: [],
      partyAffiliations: [],
      reviewedBatch,
    } as never);
    const { content } = await generateProfileExport(id);
    expect(content).toContain("Elected term begins");
    expect(content).toContain("2025-06-30");
    expect(content).toContain("Scheduled term end");
    expect(content).toContain("2031-06-30");
    expect(content).toContain("2026-05-06");
    expect(content).toContain("Current office unknown");
    expect(content).toContain("comelec.gov.ph");
  });

  it("keeps actual tenure unknown in comparison exports", async () => {
    vi.mocked(comparePoliticians).mockResolvedValueOnce({
      politicians: [{ id, fullName: "Bam Aquino", reviewedBatch }],
      metrics: [],
      differences: [],
      comparedAt: new Date("2026-11-22"),
    });
    const { content } = await generateComparisonExport([id, "another-person"]);
    expect(content).toContain("Scheduled term end");
    expect(content).toContain("Current office unknown");
    expect(content).toContain("not establish continuous service");
    expect(content).toContain("comelec.gov.ph");
  });
});

it("exports verified successor history without transferring enactment to the original", async () => {
  const filing = getReleasedFiling("ph-senate-20-sbn-169")!;
  const profileId = filing.introducedBy.profileId;
  vi.mocked(getPolitician).mockResolvedValueOnce({
    id: profileId,
    fullName: filing.introducedBy.name,
    positions: [],
    partyAffiliations: [],
    reviewedBatch: getReleasedProfile(profileId),
  } as never);
  vi.mocked(answerFromSenateFilings).mockResolvedValueOnce({
    senate: { status: "records", filings: [filing] },
  } as never);
  const { content } = await generateProfileExport(profileId);
  expect(content).toContain("Dated bill history");
  expect(content).toContain("SBN-169");
  expect(content).toContain("SBN-1894");
  expect(content).toContain("RA-12325");
  expect(content).toContain("Original bill enactment remains unverified");
  expect(content).toContain("officialgazette.gov.ph");
});

it("does not export static filing history when stored records need review", async () => {
  vi.mocked(getPolitician).mockResolvedValueOnce({
    id,
    fullName: "Bam Aquino",
    positions: [],
    partyAffiliations: [],
    reviewedBatch,
  } as never);
  vi.mocked(answerFromSenateFilings).mockResolvedValueOnce({
    senate: { status: "needs_review", filings: [] },
  } as never);
  const { content } = await generateProfileExport(id);
  expect(content).toContain("unavailable or need review");
  expect(content).not.toContain("RA-12325");
});

it("keeps Gatchalian's dated office observations and source-access limits in exports", async () => {
  const { releaseData } = await import("../lib/release-data");
  const person = releaseData.profiles.find((profile) =>
    profile.displayName.includes("Gatchalian")
  )!;
  const context = getReleasedProfile(person.id)!;
  vi.mocked(getPolitician).mockResolvedValueOnce({
    id: person.id,
    fullName: person.displayName,
    positions: [],
    partyAffiliations: [],
    reviewedBatch: context,
  } as never);
  const { content } = await generateProfileExport(person.id);
  expect(context.refresh!.officeObservations).toHaveLength(2);
  for (const observation of context.refresh!.officeObservations) {
    expect(content).toContain(observation.asOf);
    expect(content).toContain(observation.office);
  }
  const source = context.refresh!.sources.find((item) => item.accessMethod.includes("index"))!;
  expect(source).toBeDefined();
  expect(content).toContain(
    `Access method: ${source.accessMethod.charAt(0).toLowerCase() + source.accessMethod.slice(1)}`
  );
  expect(content).toContain(source.documentDate!);
  expect(content).toContain("Current office unknown");
});

it("labels each person's history and explains unavailable comparison evidence", async () => {
  const filing = getReleasedFiling("ph-senate-20-sbn-169")!;
  vi.mocked(comparePoliticians).mockResolvedValueOnce({
    politicians: [
      {
        id: filing.introducedBy.profileId,
        fullName: "Reviewed person",
        reviewedBatch: getReleasedProfile(filing.introducedBy.profileId),
      },
      { id, fullName: "Unavailable person", reviewedBatch },
    ],
    metrics: [],
    differences: [],
    comparedAt: new Date("2026-11-22"),
    reviewedFilings: {
      [filing.introducedBy.profileId]: { status: "records", filings: [filing] },
      [id]: { status: "needs_review", filings: [] },
    },
  } as never);
  const { content } = await generateComparisonExport([filing.introducedBy.profileId, id]);
  expect(content).toContain("Reviewed history for Reviewed person");
  expect(content).toContain("Reviewed history for Unavailable person");
  expect(content).toContain("does not establish that the person filed nothing");
  expect(content).toContain("RA-12325");
  expect(content).toContain("Source date:");
});
