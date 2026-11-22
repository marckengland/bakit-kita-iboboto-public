import { describe, expect, it } from "vitest";
import { getReleasedFiling, getReleasedProfile, releaseData, releaseSources } from "./release-data";

describe("approved public release batch", () => {
  it("contains the approved cohort and selected filings, excluding held candidates", () => {
    expect(releaseData.profiles).toHaveLength(24);
    expect(releaseData.filings).toHaveLength(45);
    expect(new Set(releaseData.filings.map((bill) => bill.id)).size).toBe(45);
    expect(releaseData.filings.some((bill) => [102, 141, 179].includes(bill.billNumber))).toBe(
      false
    );
  });

  it("describes membership as an observation without inventing current office or term dates", () => {
    const context = getReleasedProfile("01K5S6MAZ4YBST5GDJV827A0HM");
    expect(context).toMatchObject({
      observedOn: "2025-07-28",
      office: "Senator",
      congress: 20,
      selectedFilingCount: 2,
    });
    expect(context?.limitations.join(" ")).toMatch(/current office|current-office/i);
    expect(getReleasedProfile("unrelated-profile")).toBeNull();
  });

  it("preserves an unresolved filing date and the competing source observations", () => {
    const filing = getReleasedFiling("ph-senate-20-sbn-142");
    expect(filing?.filingDate).toBeNull();
    expect(filing?.currentLegislativeStatus).toBeNull();
    expect(filing?.dateObservations?.map((observation) => observation.value)).toContain(
      "2025-07-14"
    );
    expect(filing?.sources.some((source) => source.url.includes("595179"))).toBe(true);
  });

  it("keeps exact claim locators and the difference between introducer and additional index authors", () => {
    const filing = getReleasedFiling("ph-senate-20-sbn-11");
    expect(filing?.introducedBy.name).toBe("Robinhood Padilla");
    expect(filing?.additionalIndexAuthors).toContainEqual(
      expect.objectContaining({ name: "Joel Villanueva", role: null, addedOn: null })
    );
    expect(filing?.claimEvidence.summary[0]?.locator).toContain("58");
    expect(getReleasedFiling("ph-senate-20-sbn-102")).toBeNull();
  });

  it("resolves every approved field citation to a source without inventing confidence scores", () => {
    const sourceIds = new Set(releaseSources.map((source) => source.id));
    expect(sourceIds.size).toBe(94);
    for (const filing of releaseData.filings) {
      for (const references of Object.values(filing.claimSources)) {
        for (const reference of references) {
          expect(sourceIds.has(reference)).toBe(true);
        }
      }
    }
  });
  it("exposes integration approval separately from the historical proposal labels", () => {
    const profile = getReleasedProfile("01K5S6MAZ4YBST5GDJV827A0HM");
    expect(profile?.datasetUrl).toBe("/data/senate-20/INDEX.md");
    const filing = getReleasedFiling("ph-senate-20-sbn-11");
    expect(filing?.integrationApproval).toMatchObject({
      status: "approved_for_integration",
      approvedOn: "2026-11-19",
      publicationAuthorized: false,
    });
  });
});
