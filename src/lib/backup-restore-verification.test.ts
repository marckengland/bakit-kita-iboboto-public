import { describe, expect, it } from "vitest";
import {
  assertOwnedContainer,
  assertOwnedDatabase,
  assertEmptyRestoreTarget,
  assertRestoredSnapshot,
} from "../../scripts/verify-backup-restore";

const owner = {
  token: "aabf17de-7b87-4866-9027-90e0f543a1cc",
  containerName: "bkib-backup-aabf17de-7b87-4866-9027-90e0f543a1cc",
  containerId: "a".repeat(64),
};
const container = {
  Id: "a".repeat(64),
  Name: `/${owner.containerName}`,
  Config: {
    Labels: {
      "bkib-backup": "disposable",
      "bkib-verification-owner": owner.token,
    },
  },
};
const database = `bkib_backup_${owner.token.replaceAll("-", "")}_restore`;

// These guards protect cleanup and restore from a changed resource identity.
describe("disposable backup ownership", () => {
  it("accepts only the created container's ID, name, purpose, and owner label", () => {
    expect(() => assertOwnedContainer(container, owner)).not.toThrow();
    for (const changed of [
      { ...container, Id: "b".repeat(64) },
      { ...container, Name: "/another-container" },
      { ...container, Config: { Labels: {} } },
      {
        ...container,
        Config: { Labels: { ...container.Config.Labels, "bkib-backup": "persistent" } },
      },
      {
        ...container,
        Config: {
          Labels: { ...container.Config.Labels, "bkib-verification-owner": "someone-else" },
        },
      },
    ]) {
      expect(() => assertOwnedContainer(changed, owner)).toThrow(/unowned container/);
    }
  });

  it("requires both the generated database name and its ownership comment", () => {
    expect(() =>
      assertOwnedDatabase({ database, owner: owner.token }, database, owner.token)
    ).not.toThrow();
    for (const identity of [
      { database: "existing_database", owner: owner.token },
      { database, owner: null },
      { database, owner: "someone-else" },
    ]) {
      expect(() => assertOwnedDatabase(identity, database, owner.token)).toThrow(
        /unowned database/
      );
    }
  });

  it("refuses a restore target with any existing user table, including empty tables", () => {
    expect(() => assertEmptyRestoreTarget([])).not.toThrow();
    expect(() => assertEmptyRestoreTarget(["public.sentinel"])).toThrow(/not empty/);
  });
});

// A restored citation, missing table, or unrelated metadata change must fail the proof.
describe("restored data equality", () => {
  const before = {
    "public.SourceAttribution": [
      { id: "citation", fieldName: "title", sourceUrl: "https://senate.gov.ph/example" },
    ],
    "public.User": [{ id: "synthetic-only", language: "fil" }],
  };

  it("accepts an independently loaded identical snapshot", () => {
    expect(() => assertRestoredSnapshot(before, JSON.parse(JSON.stringify(before)))).not.toThrow();
  });

  it("rejects altered citation fields and missing citations", () => {
    for (const sources of [
      [{ id: "citation", fieldName: "summary", sourceUrl: "https://senate.gov.ph/example" }],
      [],
    ]) {
      expect(() =>
        assertRestoredSnapshot(before, { ...before, "public.SourceAttribution": sources })
      ).toThrow(/Restored database differs/);
    }
  });

  it("rejects missing tables and altered unrelated synthetic metadata", () => {
    expect(() =>
      assertRestoredSnapshot(before, {
        "public.SourceAttribution": before["public.SourceAttribution"],
      })
    ).toThrow(/Restored database differs/);
    expect(() =>
      assertRestoredSnapshot(before, {
        ...before,
        "public.User": [{ id: "synthetic-only", language: "en" }],
      })
    ).toThrow(/Restored database differs/);
  });
});
