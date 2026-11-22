import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Prisma, PrismaClient } from "@prisma/client";
import { releaseData, releaseSources } from "./release-data";

const approvedFiles: Record<string, string> = {
  SHA256SUMS: "f263d2ea773e1978247784c3520cfcb41455975e1e91c26fd80ba1d21d3620e2",
  "APPROVAL.json": "0c1f94dacb61a77d4d8078afe82658f13a48226569e27c6ff611d11b112d5b5d",
  "DATA_LICENSE.md": "59dd86a45e91753a206775008eb8043a9da648e77ba9878500c6b95bba6095fe",
  "README.md": "a041094521a7224503a97c4921ed85503017080bfb073d08c475e6c39308fa3a",
  "REVIEW_NOTES.md": "de117f9be61a58e3394c8242aaddd4c2692fb84f154f2c58ee8172e2f0be50ce",
  "UPSTREAM_CC0.txt": "b6c5b760a1b98c720d43dd18faa525ffa148ec7e9b3dc099a2bb48bd17d203ea",
  "coverage.csv": "276444e798a8043e0640b6040b1f5fa9b7c82963f7d3d5be827e77fa2be8c5d6",
  "data.json": "94cbbdbbc3fc19897b6fc753d21b9bbf2292ccc9d5cb21b057fe5b4d988e98cc",
  "sources.json": "b2bcfdfe04f5f553958789b60b75277f9df3c934eb28e499e6e7087ecd44cba4",
};
export const approvedReleaseArchive =
  "b8fbb6053bce3aa2a284d612fab490b85663abc52bb4fdfb7fda549075dc1faa";
export class ReleaseImportError extends Error {}

/** Checks the reviewed bytes against an application-owned approval, not a self-supplied checksum. */
export async function verifyReleaseFiles(
  directory = path.join(process.cwd(), "public/data/senate-20")
) {
  for (const [name, expected] of Object.entries(approvedFiles)) {
    const actual = createHash("sha256")
      .update(await readFile(path.join(directory, name)))
      .digest("hex");
    if (actual !== expected) {
      throw new ReleaseImportError(`Approved batch integrity check failed: ${name}`);
    }
  }
  const approval = JSON.parse(await readFile(path.join(directory, "APPROVAL.json"), "utf8"));
  if (
    approval.approvedArchiveSha256 !== approvedReleaseArchive ||
    approval.structuredFactsLicense !== "CC0-1.0"
  ) {
    throw new ReleaseImportError("Approved batch integration record does not match");
  }
  return { profiles: releaseData.profiles.length, filings: releaseData.filings.length };
}

function publicNameParts(name: string) {
  const suffix = name.endsWith(" III") ? "III" : null;
  const plain = suffix ? name.slice(0, -4) : name;
  const lastName = plain.endsWith(" Dela Rosa") ? "Dela Rosa" : plain.split(" ").at(-1)!;
  return { firstName: plain.slice(0, -(lastName.length + 1)), lastName, suffix };
}

export function buildReleaseImportPlan() {
  const updatedAt = new Date();
  const profiles: Prisma.PoliticianCreateManyInput[] = releaseData.profiles.map((profile) => ({
    id: profile.id,
    fullName: profile.displayName,
    ...publicNameParts(profile.displayName),
    legalName: null,
    birthday: null,
    birthplace: null,
    photo: null,
    isActive: true, // Catalog visibility; reviewedBatch.currentOffice remains unknown.
    updatedAt,
  }));
  const bills: Prisma.BillCreateManyInput[] = releaseData.filings.map((bill) => ({
    id: bill.id,
    billNumber: bill.reference,
    title: bill.title,
    summary: bill.summary,
    filingDate: bill.filingDate ? new Date(`${bill.filingDate}T00:00:00Z`) : null,
    status: null,
    session: null,
    republicActNumber: null,
    fullText: null,
    chamber: "senate",
    congress: bill.congress,
    updatedAt,
  }));
  const authors: Prisma.BillAuthorCreateManyInput[] = releaseData.filings.map((bill) => ({
    id: `released-introducer:${bill.id}`,
    billId: bill.id,
    politicianId: bill.introducedBy.profileId,
    role: "introduced_by",
  }));
  const sourceById = new Map(releaseSources.map((source) => [source.id, source]));
  const sources = new Map<string, Prisma.SourceAttributionCreateManyInput>();
  function attach(
    entityId: string,
    relation: "politicianId" | "billId",
    field: string,
    sourceId: string,
    locator: string,
    accessUrl?: string
  ) {
    const source = sourceById.get(sourceId);
    if (!source) {
      throw new ReleaseImportError("Released field has an unresolved source");
    }
    const id = `released-source:${createHash("sha256").update([entityId, field, sourceId, locator].join("\n")).digest("hex")}`;
    sources.set(id, {
      id,
      [relation]: entityId,
      fieldName: field,
      sourceType: "legislative_record",
      sourceName: `${source.publisher}: ${locator}`,
      sourceUrl: accessUrl ?? source.url,
      documentDate:
        "documentDate" in source && source.documentDate
          ? new Date(`${source.documentDate}T00:00:00Z`)
          : null,
      retrievedAt: new Date(`${source.retrievedOn}T00:00:00Z`),
      confidence: null,
      isAIProcessed: true,
      originalDocumentId: `${releaseData.datasetId}/${sourceId}`,
    });
  }
  for (const profile of releaseData.profiles) {
    for (const field of ["fullName", "membershipObservation"]) {
      attach(
        profile.id,
        "politicianId",
        field,
        "senate-opening-roster-20",
        `July 28, 2025 opening roster caption naming ${profile.displayName}; membership observed on this date, not a term start`
      );
    }
  }
  for (const bill of releaseData.filings) {
    for (const [field, evidence] of Object.entries(bill.claimEvidence)) {
      for (const item of evidence) {
        if (item.support === "corroborates_measure_subject") {
          continue;
        }
        attach(bill.id, "billId", field, item.sourceId, item.locator, item.accessUrl);
      }
    }
  }
  return { profiles, bills, authors, sources: [...sources.values()] };
}

type Plan = ReturnType<typeof buildReleaseImportPlan>;
function quoteIdentifier(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}
function comparable(value: unknown) {
  return value instanceof Date ? value.toISOString() : value;
}
function matches(actual: Record<string, unknown>[], expected: Record<string, unknown>[]) {
  const rows = new Map(actual.map((row) => [row.id, row]));
  return (
    actual.length === expected.length &&
    expected.every((want) => {
      const got = rows.get(want.id);
      return (
        got &&
        Object.entries(want).every(
          ([key, value]) =>
            key === "updatedAt" || key === "createdAt" || comparable(got[key]) === comparable(value)
        ) &&
        Object.entries(got).every(([key, value]) => {
          if (key === "updatedAt" || key === "createdAt" || Object.hasOwn(want, key)) {
            return true;
          }
          return value === null || (key === "reviewState" && value === "pending");
        })
      );
    })
  );
}

/** Never updates or deletes a row. Repeat imports must match the existing batch exactly. */
export async function importReleaseBatch(
  client: PrismaClient,
  plan: Plan = buildReleaseImportPlan()
) {
  return client.$transaction(
    async (tx) => {
      const tables = await tx.$queryRaw<
        Array<{ name: string; isTarget: boolean; rowsecurity: boolean }>
      >`SELECT tablename AS name, schemaname = current_schema() AS "isTarget", rowsecurity FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema') AND schemaname !~ '^pg_'`;
      if (tables.some((table) => !table.isTarget || table.rowsecurity)) {
        throw new ReleaseImportError(
          "Target database has tables outside the application schema or row security prevents an empty-database check. Nothing was changed."
        );
      }
      const counts = new Map<string, number>();
      for (const table of tables.filter((table) => table.name !== "_prisma_migrations")) {
        const [row] = await tx.$queryRawUnsafe<Array<{ count: bigint }>>(
          `SELECT count(*) AS count FROM ${quoteIdentifier(table.name)}`
        );
        counts.set(table.name, Number(row!.count));
      }
      const expected = new Map<string, number>([
        ["Politician", plan.profiles.length],
        ["Bill", plan.bills.length],
        ["BillAuthor", plan.authors.length],
        ["SourceAttribution", plan.sources.length],
      ]);
      const empty = [...counts.values()].every((count) => count === 0);
      if (!empty) {
        const noOtherRows = [...counts].every(
          ([table, count]) => count === (expected.get(table) ?? 0)
        );
        if (noOtherRows) {
          const [profiles, bills, authors, sources] = await Promise.all([
            tx.politician.findMany(),
            tx.bill.findMany(),
            tx.billAuthor.findMany(),
            tx.sourceAttribution.findMany(),
          ]);
          if (
            matches(profiles, plan.profiles) &&
            matches(bills, plan.bills) &&
            matches(authors, plan.authors) &&
            matches(sources, plan.sources)
          ) {
            return {
              action: "unchanged" as const,
              profiles: plan.profiles.length,
              filings: plan.bills.length,
              sources: plan.sources.length,
            };
          }
        }
        throw new ReleaseImportError(
          "Target database is not empty or does not match this batch. Nothing was changed."
        );
      }
      await tx.politician.createMany({ data: plan.profiles });
      await tx.bill.createMany({ data: plan.bills });
      await tx.billAuthor.createMany({ data: plan.authors });
      await tx.sourceAttribution.createMany({ data: plan.sources });
      return {
        action: "imported" as const,
        profiles: plan.profiles.length,
        filings: plan.bills.length,
        sources: plan.sources.length,
      };
    },
    { isolationLevel: "Serializable", timeout: 30_000 }
  );
}
