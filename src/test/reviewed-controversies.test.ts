import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

interface RecordData {
  id: string;
  politicianId: string;
  title: string;
  description: string;
  status: string;
  filingDate?: Date | null;
  court?: string | null;
  caseNumber?: string | null;
  SourceAttribution?: { create: Record<string, unknown>[] };
}

function database(fullName: string, initial: RecordData[] = []) {
  const records = initial.map((record) => ({ ...record }));
  const citations: Record<string, unknown>[] = [];
  const writes: string[] = [];
  let clients = 0;
  const matches = (record: RecordData, query: Record<string, unknown>) => {
    const title = query.title as { in?: string[]; contains?: string } | undefined;
    return (
      (!query.politicianId || record.politicianId === query.politicianId) &&
      (!title ||
        (title.in
          ? title.in.includes(record.title)
          : record.title.toLowerCase().includes(title.contains!.toLowerCase())))
    );
  };
  const client = {
    politician: {
      findFirst: async ({ where }: { where: { fullName: string } }) =>
        where.fullName === fullName ? { id: "person", fullName } : null,
      findMany: async ({ where }: { where: { fullName: string } }) =>
        where.fullName === fullName ? [{ id: "person", fullName }] : [],
      count: async () => 1,
    },
    controversy: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) =>
        records.find((record) => matches(record, where)) ?? null,
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        records.filter((record) => matches(record, where)),
      create: async ({ data }: { data: RecordData }) => {
        writes.push("controversy.create");
        records.push(data);
        citations.push(
          ...(data.SourceAttribution?.create ?? []).map((source) => ({
            ...source,
            controversyId: data.id,
          }))
        );
        return data;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<RecordData> }) => {
        writes.push("controversy.update");
        const record = records.find((item) => item.id === where.id)!;
        Object.assign(record, data);
        return record;
      },
      count: async () => records.length,
    },
    sourceAttribution: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) =>
        citations.find((source) =>
          Object.entries(where).every(([key, value]) => source[key] === value)
        ) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        writes.push("sourceAttribution.create");
        citations.push(data);
        return data;
      },
    },
    $disconnect: async () => undefined,
  };
  const transactional = {
    ...client,
    $transaction: async <T>(callback: (tx: typeof client) => Promise<T>) => callback(client),
  };
  return {
    records,
    citations,
    writes,
    get clients() {
      return clients;
    },
    createClient: () => {
      clients++;
      return transactional;
    },
  };
}

// Execute the real scripts with only the external database boundary replaced.
// Capturing main's promise lets the test await its existing work without a live DB.
async function runScript(file: string, db: ReturnType<typeof database>) {
  const nativeRequire = createRequire(import.meta.url);
  const output = { log: vi.fn(), error: vi.fn(), warn: vi.fn() };
  function load(filename: string): Record<string, unknown> {
    const loadedModule = { exports: {} as Record<string, unknown> };
    const compiled = ts.transpileModule(
      readFileSync(filename, "utf8").replace(
        /\nmain\(\)[\s\S]*$/,
        "\nexports.completion = main();"
      ),
      {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }
    ).outputText;
    const require = (specifier: string): unknown => {
      if (specifier.endsWith("/prisma-client")) {
        return { createPrismaClient: db.createClient };
      }
      if (specifier.startsWith(".")) {
        return load(path.resolve(path.dirname(filename), `${specifier}.ts`));
      }
      return nativeRequire(specifier);
    };
    vm.runInNewContext(compiled, {
      module: loadedModule,
      exports: loadedModule.exports,
      require,
      console: output,
      crypto: globalThis.crypto,
      Date,
    });
    return loadedModule.exports;
  }
  const exports = load(path.resolve(file));
  await exports.completion;
  return output;
}

const primaryTax = "https://records.example.test/synthetic/tax/decision";
const primaryLibel = "https://records.example.test/synthetic/libel/decision";
const primaryIntegrity = "https://records.example.test/synthetic/integrity/decision";

describe("synthetic allegation imports", () => {
  it("stores the tax disposition and its exact citations together without inventing a filing date", async () => {
    const db = database("Synthetic Person A");
    await runScript("scripts/maintenance/add-controversies.ts", db);
    const record = db.records.find((item) => item.title.includes("income tax returns"))!;
    expect(record).toBeDefined();
    expect(record.status).toBe("convicted");
    expect(record.filingDate).toBeNull();
    expect(record.description).toContain("acquitted him of nonpayment charges");
    expect(record.description).toContain("removed imprisonment");
    expect(record.caseNumber).toBe("SYNTHETIC-TAX-001");
    expect(db.citations).toContainEqual(
      expect.objectContaining({
        controversyId: record.id,
        sourceUrl: primaryTax,
        sourceType: "court_document",
      })
    );
    expect(record.SourceAttribution?.create.length).toBeGreaterThanOrEqual(2);
    expect(db.records).toHaveLength(4);
  });

  it("retains the synthetic libel case identity and filing date instead of an unrelated person", async () => {
    const db = database("Synthetic Person B");
    await runScript("scripts/maintenance/add-controversies-batch2.ts", db);
    const record = db.records.find((item) => item.title.includes("Libel conviction"))!;
    expect(record.description).toContain("Synthetic Complainant D");
    expect(record.description).toContain("Synthetic Trial Court Branch 7");
    expect(record.description).not.toContain("Synthetic Unrelated Person E");
    expect(record.filingDate?.toISOString()).toBe("2041-02-03T00:00:00.000Z");
    expect(db.citations).toContainEqual(
      expect.objectContaining({ controversyId: record.id, sourceUrl: primaryLibel })
    );
    expect(db.records).toHaveLength(2);
  });

  it("keeps the separate plunder and bribery records with acquittals and exact reconsideration date", async () => {
    const db = database("Synthetic Person C");
    await runScript("scripts/maintenance/add-controversies.ts", db);
    expect(db.records).toHaveLength(2);
    expect(
      db.records.every((record) => record.status === "acquitted" && record.filingDate === null)
    ).toBe(true);
    const bribery = db.records.find((record) => record.title.includes("bribery"))!;
    expect(bribery.description).toContain("May 12, 2042");
    expect(bribery.description).toContain("April 10, 2042");
    expect(db.citations).toContainEqual(
      expect.objectContaining({ controversyId: bribery.id, sourceUrl: primaryIntegrity })
    );
  });

  it("does not create a duplicate tax case when the old title is already present", async () => {
    const db = database("Synthetic Person A", [
      {
        id: "old",
        politicianId: "person",
        title: "Synthetic Tax evasion conviction (fixture only; old label)",
        description: "Existing record",
        status: "convicted",
      },
    ]);
    await runScript("scripts/maintenance/add-controversies.ts", db);
    expect(
      db.records.filter(
        (record) =>
          record.title.includes("Tax evasion") || record.title.includes("income tax returns")
      )
    ).toHaveLength(1);
    expect(db.records.find((record) => record.id === "old")?.description).toBe("Existing record");
  });

  it("repairs only the known tax case, preserves unrelated records and citations, and is repeatable", async () => {
    const db = database("Synthetic Person A", [
      {
        id: "tax",
        politicianId: "person",
        title: "Synthetic Tax evasion conviction (fixture only; old label)",
        description: "Old tax wording",
        status: "convicted",
      },
      {
        id: "other",
        politicianId: "person",
        title: "Synthetic unrelated case (fixture only; Tax evasion match probe)",
        description: "Keep",
        status: "ongoing",
      },
    ]);
    db.citations.push({
      id: "retained",
      controversyId: "tax",
      sourceUrl: "https://example.org/prior-source",
    });
    await runScript("scripts/maintenance/fix-bbm-controversy.ts", db);
    await runScript("scripts/maintenance/fix-bbm-controversy.ts", db);
    expect(db.records).toHaveLength(2);
    expect(db.records.find((record) => record.id === "tax")?.description).toContain(
      "removed imprisonment"
    );
    expect(db.records.find((record) => record.id === "other")?.description).toBe("Keep");
    expect(db.citations.filter((source) => source.sourceUrl === primaryTax)).toHaveLength(1);
    expect(db.citations).toContainEqual(expect.objectContaining({ id: "retained" }));
  });

  it("refuses an ambiguous tax correction without writing anything", async () => {
    const db = database("Synthetic Person A", [
      {
        id: "one",
        politicianId: "person",
        title: "Synthetic Tax evasion conviction (fixture only; old label)",
        description: "One",
        status: "convicted",
      },
      {
        id: "two",
        politicianId: "person",
        title: "Synthetic Tax evasion conviction (fixture only; old label)",
        description: "Two",
        status: "convicted",
      },
    ]);
    await expect(runScript("scripts/maintenance/fix-bbm-controversy.ts", db)).rejects.toThrow(
      /ambiguous/i
    );
    expect(db.writes).toEqual([]);
  });

  it.each([
    [
      "Synthetic Person B",
      "Synthetic Libel conviction (fixture only; old label)",
      "Synthetic Complainant D",
      primaryLibel,
    ],
    [
      "Synthetic Person C",
      "Synthetic bribery conviction (fixture only; old label)",
      "May 12, 2042",
      primaryIntegrity,
    ],
    [
      "Synthetic Person C",
      "Synthetic plunder charge (fixture only)",
      "Separate graft proceedings",
      primaryIntegrity,
    ],
  ])(
    "keeps the reviewed repair consistent with the seed for %s / %s",
    async (person, title, detail, sourceUrl) => {
      const db = database(person, [
        { id: "case", politicianId: "person", title, description: "Old", status: "convicted" },
      ]);
      await runScript("scripts/maintenance/fix-reviewed-controversies.ts", db);
      expect(db.records).toHaveLength(1);
      expect(db.records[0]?.description).toContain(detail);
      expect(db.citations).toContainEqual(
        expect.objectContaining({
          controversyId: "case",
          sourceUrl,
          confidence: 0,
          isAIProcessed: true,
        })
      );
    }
  );

  it("leaves unapproved cases intact when applying the reviewed batch", async () => {
    const db = database("Synthetic Person B", [
      {
        id: "approved",
        politicianId: "person",
        title: "Synthetic Libel conviction (fixture only; old label)",
        description: "Old approved entry",
        status: "convicted",
      },
      {
        id: "unapproved",
        politicianId: "person",
        title: "Synthetic unrelated case (fixture only)",
        description: "Keep pending review",
        status: "ongoing",
      },
    ]);
    await runScript("scripts/maintenance/fix-reviewed-controversies.ts", db);
    expect(db.records).toHaveLength(2);
    expect(db.records.find((record) => record.id === "approved")?.description).toContain(
      "Synthetic Complainant D"
    );
    expect(db.records.find((record) => record.id === "unapproved")).toEqual({
      id: "unapproved",
      politicianId: "person",
      title: "Synthetic unrelated case (fixture only)",
      description: "Keep pending review",
      status: "ongoing",
    });
    expect(db.citations.every((source) => source.controversyId === "approved")).toBe(true);
    expect(db.writes).not.toContain("controversy.create");
  });
});

describe("unreviewed legacy backfills", () => {
  it.each([
    "fix-source-urls.ts",
    "backfill-family-sources.ts",
    "backfill-controversy-sources.ts",
    "fix-controversy-accuracy.ts",
  ])("blocks %s before database initialization or any mutation", async (file) => {
    const db = database("Nobody");
    const failure = await runScript(`scripts/maintenance/${file}`, db).then(
      () => null,
      (error: unknown) => error
    );
    expect(db.clients).toBe(0);
    expect(db.writes).toEqual([]);
    expect(failure).toMatchObject({ message: expect.stringMatching(/review|approval/i) });
  });
});
