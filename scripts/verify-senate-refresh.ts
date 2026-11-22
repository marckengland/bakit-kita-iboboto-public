import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import data from "../public/data/senate-20-refresh-2026-11-22/data.json";
import { getReleasedFiling, getReleasedProfile, releaseData } from "../src/lib/release-data";
import { verifyReleaseFiles } from "../src/lib/release-import";

async function main() {
  await verifyReleaseFiles();
  const root = "public/data/senate-20-refresh-2026-11-22/";
  const approval = JSON.parse(await readFile(root + "APPROVAL.json", "utf8"));
  assert.equal(approval.status, "approved_for_integration");
  assert.equal(
    approval.proposalSha256,
    "36b8314ff2668569e9de3695dd221346e0cf23ec754690ac591c7f30709d9175"
  );
  assert.equal(approval.publicationAuthorized, false);
  assert.equal(approval.existingDatabaseAuthorized, false);
  const digest = createHash("sha256")
    .update(await readFile(root + "data.json"))
    .digest("hex");
  assert.equal(digest, "f678042490fb840e31c462715716b2453975beffd56da81a9408bca3a876e058");
  assert.equal(approval.dataSha256, digest);
  assert.equal(data.profiles.length, 24);
  assert.equal(new Set(data.profiles.map((p) => p.profileId)).size, 24);
  assert.equal(data.filings.length, 31);
  assert.equal(new Set(data.filings.map((p) => p.filingId)).size, 31);
  for (const profile of releaseData.profiles) {
    const context = getReleasedProfile(profile.id)!;
    assert.equal(context.observedOn, "2025-07-28");
    assert.equal(context.currentOffice, null);
    assert.equal(context.termStart, null);
    assert.equal(context.termEnd, null);
    assert.ok(context.refresh);
    assert.equal(context.refresh.membershipObservations[0]!.observedOn, "2026-05-06");
    const term = context.refresh.electedTerm;
    assert.equal(Number(term.scheduledEnd.slice(0, 4)) - Number(term.start.slice(0, 4)), 6);
  }
  assert.equal(data.profiles.filter((p) => p.electedTerm.start === "2022-06-30").length, 12);
  assert.equal(data.profiles.filter((p) => p.electedTerm.start === "2025-06-30").length, 12);
  const filings = releaseData.filings.map((f) => getReleasedFiling(f.id)!);
  assert.equal(filings.filter((f) => f.refresh).length, 31);
  assert.equal(filings.filter((f) => !f.refresh).length, 14);
  assert.equal(filings.flatMap((f) => f.refresh?.events ?? []).length, 41);
  for (const filing of filings) {
    assert.equal(filing.currentLegislativeStatus, null);
    assert.equal(filing.enactment, null);
    if (!filing.refresh) continue;
    const sources = new Map(filing.refresh.sources.map((s) => [s.id, s]));
    for (const event of filing.refresh.events) {
      assert.match(event.date, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(event.date <= "2026-11-22");
      assert.ok(event.sourceIds.length);
      for (const sourceId of event.sourceIds) {
        const source = sources.get(sourceId)!;
        assert.ok(source, `Unresolved event source: ${sourceId}`);
        assert.match(source.url, /^https:\/\//);
        assert.ok(source.locator && source.accessMethod && source.independence);
      }
    }
  }
  assert.equal(getReleasedFiling("ph-senate-20-sbn-142")!.filingDate, null);
  assert.equal(getReleasedFiling("ph-senate-20-sbn-219")!.refresh, undefined);
  const successor = getReleasedFiling("ph-senate-20-sbn-169")!.refresh!.successor!;
  assert.equal(successor.successorReference, "SBN-1894");
  assert.equal(successor.successorEnactment!.republicAct, "RA-12325");
  console.log(
    "Senate refresh verification passed: sealed base, 24 qualified terms, 31 histories, 41 dated events, 14 withheld additions, citations and retained unknowns. No database was opened."
  );
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Senate refresh verification failed");
  process.exitCode = 1;
});
