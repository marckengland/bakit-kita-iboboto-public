import { describe, expect, it } from "vitest";
import { mkdtemp, copyFile, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildReleaseImportPlan, verifyReleaseFiles } from "./release-import";

describe("reviewed release import plan", () => {
  it("preserves unknowns and precise introduction credit instead of applying database defaults", () => {
    const plan = buildReleaseImportPlan();
    expect(plan.profiles).toHaveLength(24);
    expect(plan.bills).toHaveLength(45);
    expect(plan.bills.every((bill) => bill.status === null && bill.session === null)).toBe(true);
    expect(plan.bills.find((bill) => bill.id === "ph-senate-20-sbn-142")?.filingDate).toBeNull();
    expect(plan.bills.filter((bill) => bill.filingDate !== null)).toHaveLength(44);
    expect(plan.authors.every((author) => author.role === "introduced_by")).toBe(true);
    expect(plan.sources.every((source) => source.confidence === null)).toBe(true);
    expect(
      plan.sources.some(
        (source) => source.fieldName === "summary" && source.sourceName.includes("58")
      )
    ).toBe(true);
  });

  it("uses stable record IDs and does not fill legal names, birthdays, or photographs", () => {
    const first = buildReleaseImportPlan();
    const second = buildReleaseImportPlan();
    expect(first.profiles.map((row) => row.id)).toEqual(second.profiles.map((row) => row.id));
    expect(new Set(first.sources.map((row) => row.id)).size).toBe(first.sources.length);
    expect(
      first.profiles.every(
        (row) => row.legalName === null && row.birthday === null && row.photo === null
      )
    ).toBe(true);
    expect(first.profiles.find((row) => row.fullName === "Ronald Dela Rosa")).toMatchObject({
      firstName: "Ronald",
      lastName: "Dela Rosa",
    });
    expect(first.profiles.find((row) => row.fullName === "Vicente Sotto III")).toMatchObject({
      firstName: "Vicente",
      lastName: "Sotto",
      suffix: "III",
    });
  });

  it("accepts only the approved file bytes, refusing a changed record even when its checksum file is rewritten", async () => {
    await expect(verifyReleaseFiles()).resolves.toMatchObject({ profiles: 24, filings: 45 });
    const dir = await mkdtemp(path.join(tmpdir(), "bkib-import-integrity-"));
    try {
      for (const name of [
        "data.json",
        "sources.json",
        "SHA256SUMS",
        "APPROVAL.json",
        "README.md",
        "REVIEW_NOTES.md",
        "DATA_LICENSE.md",
        "UPSTREAM_CC0.txt",
        "coverage.csv",
      ]) {
        await copyFile(
          path.join(process.cwd(), "public/data/senate-20", name),
          path.join(dir, name)
        );
      }
      const file = path.join(dir, "data.json");
      const changed = (await readFile(file, "utf8")).replace(
        '"filingDate": null',
        '"filingDate": "2025-07-01"'
      );
      await writeFile(file, changed);
      await writeFile(
        path.join(dir, "SHA256SUMS"),
        "self-supplied checksums are not authorization\n"
      );
      await expect(verifyReleaseFiles(dir)).rejects.toThrow(/approved|integrity/i);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it.each(["SHA256SUMS", "APPROVAL.json"])(
    "refuses drift in approval metadata: %s",
    async (changedFile) => {
      const dir = await mkdtemp(path.join(tmpdir(), "bkib-approval-integrity-"));
      try {
        for (const name of [
          "data.json",
          "sources.json",
          "SHA256SUMS",
          "APPROVAL.json",
          "README.md",
          "REVIEW_NOTES.md",
          "DATA_LICENSE.md",
          "UPSTREAM_CC0.txt",
          "coverage.csv",
        ]) {
          await copyFile(
            path.join(process.cwd(), "public/data/senate-20", name),
            path.join(dir, name)
          );
        }
        const file = path.join(dir, changedFile);
        const original = await readFile(file, "utf8");
        await writeFile(
          file,
          changedFile === "APPROVAL.json"
            ? original.replace('"publicationAuthorized": false', '"publicationAuthorized": true')
            : original + "tampered approval inventory\n"
        );
        await expect(verifyReleaseFiles(dir)).rejects.toThrow(/approved|integrity/i);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    }
  );
});
