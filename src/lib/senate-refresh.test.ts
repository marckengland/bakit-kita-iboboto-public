import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getReleasedFiling, getReleasedProfile, releaseData } from "./release-data";

describe("approved November 22 Senate refresh", () => {
  it("adds elected terms without turning scheduled tenure into present office", () => {
    const profile = getReleasedProfile("01K5S6MAZ4YBST5GDJV827A0HM")!;
    expect(profile).toHaveProperty("refresh.electedTerm.start", "2025-06-30");
    expect(profile).toHaveProperty("refresh.electedTerm.scheduledEnd", "2031-06-30");
    expect(profile.currentOffice).toBeNull();
    expect(profile.termStart).toBeNull();
    expect(profile.termEnd).toBeNull();
    expect(profile.observedOn).toBe("2025-07-28");
  });

  it("covers the original 24 identities with two equal elected cohorts and dated observations", () => {
    const profiles = releaseData.profiles.map(({ id }) => getReleasedProfile(id)!);
    expect(profiles.filter((p) => p.refresh?.electedTerm.start === "2022-06-30")).toHaveLength(12);
    expect(profiles.filter((p) => p.refresh?.electedTerm.start === "2025-06-30")).toHaveLength(12);
    for (const profile of profiles) {
      expect(profile.refresh?.membershipObservations).toHaveLength(1);
      expect(profile.refresh?.membershipObservations[0]?.observedOn).toBe("2026-05-06");
      expect(profile.currentOffice).toBeNull();
    }
  });

  it("returns 41 dated events for 31 bills and no invented history for the other 14", () => {
    const filings = releaseData.filings.map(({ id }) => getReleasedFiling(id)!);
    expect(filings.filter((f) => f.refresh?.events.length)).toHaveLength(31);
    expect(filings.flatMap((f) => f.refresh?.events ?? [])).toHaveLength(41);
    expect(filings.filter((f) => !f.refresh?.events.length)).toHaveLength(14);
    expect(getReleasedFiling("ph-senate-20-sbn-219")?.refresh).toBeUndefined();
    expect(getReleasedProfile("unrelated-person")).toBeNull();
    expect(getReleasedFiling("ph-senate-20-sbn-102")).toBeNull();
  });

  it("keeps the law on the substitute chain instead of marking the original bill enacted", () => {
    const filing = getReleasedFiling("ph-senate-20-sbn-169")!;
    expect(filing).toHaveProperty("refresh.successor.successorReference", "SBN-1894");
    expect(filing).toHaveProperty("refresh.successor.successorEnactment.republicAct", "RA-12325");
    expect(filing).toHaveProperty("refresh.successor.successorEnactment.approvedOn", "2026-09-04");
    expect(filing.currentLegislativeStatus).toBeNull();
    expect(filing.enactment).toBeNull();
    expect(getReleasedFiling("ph-senate-20-sbn-123")?.refresh?.successor).toBeNull();
  });

  it("adds the hearing agenda without resolving the conflicting SBN-142 filing date", () => {
    const filing = getReleasedFiling("ph-senate-20-sbn-142")!;
    expect(filing.refresh?.events).toContainEqual(
      expect.objectContaining({ date: "2026-02-11", type: "committee_hearing_agenda" })
    );
    expect(filing.filingDate).toBeNull();
    expect(filing.currentLegislativeStatus).toBeNull();
    expect(filing.enactment).toBeNull();
  });

  it("resolves every event to exact source locators and preserves historical date semantics", () => {
    const updates = releaseData.filings.flatMap(({ id }) => getReleasedFiling(id)?.refresh ?? []);
    expect(updates).toHaveLength(31);
    for (const update of updates) {
      for (const event of update.events) {
        expect(event.date <= "2026-11-22").toBe(true);
        expect(event.sourceIds.length).toBeGreaterThan(0);
        for (const id of event.sourceIds) {
          const source = update.sources.find((s) => s.id === id)!;
          expect(source).toBeDefined();
          expect(source.url).toMatch(/^https:\/\//);
          expect(source.locator.length).toBeGreaterThan(0);
          expect(source.accessMethod.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("preserves the original reviewed batch bytes and all 45 unknown original-bill statuses", () => {
    const hash = createHash("sha256")
      .update(readFileSync("public/data/senate-20/data.json"))
      .digest("hex");
    expect(hash).toBe("94cbbdbbc3fc19897b6fc753d21b9bbf2292ccc9d5cb21b057fe5b4d988e98cc");
    for (const { id } of releaseData.filings) {
      expect(getReleasedFiling(id)?.currentLegislativeStatus).toBeNull();
      expect(getReleasedFiling(id)?.enactment).toBeNull();
    }
  });
});
