import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verificationEnv } from "./lib/verification-runtime";

type Owner = { token: string; containerName: string; containerId: string };
type Container = {
  Id: string;
  Name: string;
  Config: { Labels?: Record<string, string> | null };
};
type Identity = { database: string; owner: string | null };
type Snapshot = Record<string, unknown[]>;

export function assertOwnedContainer(container: Container, owner: Owner): void {
  assert.ok(
    /^[a-f0-9]{64}$/.test(container.Id) &&
      (!owner.containerId || container.Id === owner.containerId) &&
      container.Name === `/${owner.containerName}` &&
      container.Config.Labels?.["bkib-backup"] === "disposable" &&
      container.Config.Labels?.["bkib-verification-owner"] === owner.token,
    "Refuse to use or remove an unowned container"
  );
}

export function assertOwnedDatabase(identity: Identity, database: string, token: string): void {
  assert.ok(
    identity.database === database && identity.owner === token,
    "Refuse to use an unowned database"
  );
}

export function assertEmptyRestoreTarget(tables: string[]): void {
  assert.equal(tables.length, 0, "Restore target is not empty");
}

export function assertRestoredSnapshot(before: Snapshot, after: Snapshot): void {
  assert.deepEqual(after, before, "Restored database differs from its backup source");
}

async function main(): Promise<void> {
  assert.equal(process.argv.length, 2, "This verifier accepts no arguments or database targets");
  const token = randomUUID();
  const owner: Owner = { token, containerName: `bkib-backup-${token}`, containerId: "" };
  const prefix = `bkib_backup_${token.replaceAll("-", "")}`;
  const source = `${prefix}_source`;
  const restored = `${prefix}_restore`;
  const archive = "/tmp/bkib-approved-backup.dump";
  let requested = false;
  let cleaned = false;
  let interrupted = false;
  let databaseUrl = "";
  let stage = "approved file checks";
  const original = Object.fromEntries(
    ["DATABASE_URL", "DOTENV_CONFIG_PATH", "DOTENV_CONFIG_OVERRIDE", "DOTENV_KEY"].map((key) => [
      key,
      process.env[key],
    ])
  );
  function command(program: string, args: string[]): string {
    assert.ok(!interrupted, "Verification interrupted");
    const result = spawnSync(program, args, {
      encoding: "utf8",
      env: verificationEnv(databaseUrl),
      timeout: 120_000,
      maxBuffer: 16 * 1024 * 1024,
    });
    // Subprocess diagnostics can contain private caller configuration.
    assert.equal(result.status, 0, `Backup verification command failed during ${stage}`);
    return result.stdout.trim();
  }
  function inspectOwner(): void {
    const [container] = JSON.parse(command("docker", ["inspect", owner.containerName]));
    assertOwnedContainer(container, owner);
  }
  function sql(database: string, statement: string): string {
    assert.ok([source, restored].includes(database), "Refuse an unexpected database target");
    return command("docker", [
      "exec",
      owner.containerId,
      "psql",
      "-X",
      "-h",
      "127.0.0.1",
      "-U",
      "postgres",
      "-d",
      database,
      "-v",
      "ON_ERROR_STOP=1",
      "-Atc",
      statement,
    ]);
  }
  function identity(database: string): void {
    inspectOwner();
    const row = JSON.parse(
      sql(
        database,
        `SELECT json_build_object(
      'database', current_database(), 'owner', shobj_description(oid, 'pg_database'))
      FROM pg_database WHERE datname = current_database()`
      )
    );
    assertOwnedDatabase(row, database, token);
  }
  function tables(database: string): { schema: string; name: string }[] {
    return JSON.parse(
      sql(
        database,
        `SELECT COALESCE(json_agg(t ORDER BY t.schema, t.name), '[]')
      FROM (SELECT schemaname AS schema, tablename AS name FROM pg_tables
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        AND schemaname !~ '^pg_') t`
      )
    );
  }
  function snapshot(database: string): Snapshot {
    const result: Snapshot = {};
    const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
    for (const table of tables(database)) {
      result[`${table.schema}.${table.name}`] = JSON.parse(
        sql(
          database,
          `SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text), '[]'::jsonb)
        FROM ${quote(table.schema)}.${quote(table.name)} t`
        )
      );
    }
    return result;
  }
  function cleanup(): void {
    if (cleaned) return;
    if (requested) {
      const found = spawnSync("docker", ["inspect", owner.containerName], {
        encoding: "utf8",
        env: verificationEnv(""),
        timeout: 10_000,
      });
      if (found.status === 0) {
        const [container] = JSON.parse(found.stdout);
        assertOwnedContainer(container, owner);
        const removed = spawnSync("docker", ["rm", "-f", container.Id], {
          encoding: "utf8",
          env: verificationEnv(""),
          timeout: 30_000,
        });
        assert.equal(removed.status, 0, "Owned container cleanup failed");
      } else {
        assert.match(
          found.stderr ?? "",
          /No such (?:object|container)/i,
          "Cannot verify owned container removal"
        );
      }
    }
    cleaned = true;
  }
  const handlers = new Map<NodeJS.Signals, () => void>();
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
    const handler = () => {
      interrupted = true;
      try {
        cleanup();
      } catch {
        console.error("Owned backup verification cleanup failed after interruption.");
      }
      process.exit(signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : 129);
    };
    handlers.set(signal, handler);
    process.once(signal, handler);
  }
  try {
    const { verifyReleaseFiles, importReleaseBatch, buildReleaseImportPlan } =
      await import("../src/lib/release-import");
    await verifyReleaseFiles();
    stage = "owned PostgreSQL startup";
    requested = true;
    owner.containerId = command("docker", [
      "run",
      "--rm",
      "-d",
      "--name",
      owner.containerName,
      "--label",
      "bkib-backup=disposable",
      "--label",
      `bkib-verification-owner=${token}`,
      "--tmpfs",
      "/var/lib/postgresql/data:rw,size=512m",
      "-p",
      "127.0.0.1::5432",
      "-e",
      "POSTGRES_HOST_AUTH_METHOD=trust",
      "-e",
      `POSTGRES_DB=${source}`,
      "postgres:16",
    ]);
    assert.match(owner.containerId, /^[a-f0-9]{64}$/);
    inspectOwner();
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (
        spawnSync(
          "docker",
          [
            "exec",
            owner.containerId,
            "pg_isready",
            "-h",
            "127.0.0.1",
            "-U",
            "postgres",
            "-d",
            source,
          ],
          { stdio: "ignore", timeout: 2_000 }
        ).status === 0
      ) {
        ready = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    assert.ok(ready, "Owned PostgreSQL did not become ready");
    const port = command("docker", ["port", owner.containerId, "5432/tcp"]);
    assert.match(port, /^127\.0\.0\.1:\d+$/);
    databaseUrl = `postgresql://postgres@${port}/${source}`;
    const isolated = verificationEnv(databaseUrl);
    process.env.DATABASE_URL = databaseUrl;
    process.env.DOTENV_CONFIG_PATH = isolated.DOTENV_CONFIG_PATH;
    process.env.DOTENV_CONFIG_OVERRIDE = isolated.DOTENV_CONFIG_OVERRIDE;
    delete process.env.DOTENV_KEY;
    sql(source, `COMMENT ON DATABASE "${source}" IS '${token}'`);
    identity(source);
    stage = "fresh migrations";
    command(process.execPath, [
      path.join(process.cwd(), "node_modules/prisma/build/index.js"),
      "migrate",
      "deploy",
    ]);
    stage = "application database identity";
    const { createPrismaClient } = await import("../src/lib/prisma-client");
    const db = createPrismaClient();
    try {
      const connected = await db.$queryRaw<Identity[]>`SELECT current_database() AS database,
        shobj_description(oid, 'pg_database') AS owner FROM pg_database
        WHERE datname = current_database()`;
      assert.equal(connected.length, 1);
      assertOwnedDatabase(connected[0]!, source, token);
      stage = "approved batch import";
      assert.equal((await importReleaseBatch(db)).action, "imported");
      assert.equal((await importReleaseBatch(db)).action, "unchanged");
      assert.equal(await db.politician.count(), 24);
      assert.equal(await db.bill.count(), 45);
      assert.equal(await db.sourceAttribution.count(), buildReleaseImportPlan().sources.length);
      stage = "synthetic unrelated metadata";
      await db.user.create({
        data: {
          id: "synthetic-backup-sentinel",
          language: "fil",
          updatedAt: new Date("2026-01-01T00:00:00Z"),
        },
      });
    } finally {
      await db.$disconnect();
    }
    const before = snapshot(source);
    stage = "custom-format dump";
    identity(source);
    command("docker", [
      "exec",
      owner.containerId,
      "pg_dump",
      "-h",
      "127.0.0.1",
      "-U",
      "postgres",
      "-d",
      source,
      "--format=custom",
      "--file",
      archive,
    ]);
    assert.ok(
      command("docker", ["exec", owner.containerId, "pg_restore", "--list", archive]).includes(
        "SourceAttribution"
      ),
      "Dump archive lacks citations"
    );
    stage = "owned empty restore target";
    inspectOwner();
    command("docker", [
      "exec",
      owner.containerId,
      "createdb",
      "-h",
      "127.0.0.1",
      "-U",
      "postgres",
      "--template=template0",
      restored,
    ]);
    sql(restored, `COMMENT ON DATABASE "${restored}" IS '${token}'`);
    identity(restored);
    assertEmptyRestoreTarget(tables(restored).map((table) => `${table.schema}.${table.name}`));
    stage = "real pg_restore";
    command("docker", [
      "exec",
      owner.containerId,
      "pg_restore",
      "-h",
      "127.0.0.1",
      "-U",
      "postgres",
      "--exit-on-error",
      "--no-owner",
      "--no-privileges",
      "-d",
      restored,
      archive,
    ]);
    identity(restored);
    stage = "restored rows and citation integrity";
    assertRestoredSnapshot(before, snapshot(restored));
    assert.equal(
      sql(
        restored,
        `SELECT count(*) FROM "SourceAttribution" s
      LEFT JOIN "Politician" p ON p.id = s."politicianId"
      LEFT JOIN "Bill" b ON b.id = s."billId"
      WHERE (s."politicianId" IS NOT NULL AND p.id IS NULL)
        OR (s."billId" IS NOT NULL AND b.id IS NULL)
        OR (s."politicianId" IS NULL AND s."billId" IS NULL)`
      ),
      "0"
    );
    assert.equal(
      sql(
        restored,
        `SELECT count(*) FROM "BillAuthor" a
      LEFT JOIN "Bill" b ON b.id = a."billId"
      LEFT JOIN "Politician" p ON p.id = a."politicianId"
      WHERE b.id IS NULL OR p.id IS NULL OR a.role <> 'introduced_by'`
      ),
      "0"
    );
    stage = "negative restore controls";
    assert.throws(
      () => assertOwnedDatabase({ database: restored, owner: "wrong-owner" }, restored, token),
      /unowned database/
    );
    assert.throws(
      () => assertEmptyRestoreTarget(tables(restored).map((table) => table.name)),
      /not empty/
    );
    sql(
      restored,
      `UPDATE "SourceAttribution" SET "sourceUrl" = 'https://invalid.example/synthetic-backup-control'
      WHERE id = (SELECT id FROM "SourceAttribution" ORDER BY id LIMIT 1)`
    );
    assert.throws(
      () => assertRestoredSnapshot(before, snapshot(restored)),
      /Restored database differs/
    );
    // The source is also checked after restore and the corruption control.
    assertRestoredSnapshot(before, snapshot(source));
    stage = "owned container cleanup";
    cleanup();
    cleanup();
    console.log(
      JSON.stringify({
        action: "backup-restore-verified",
        profiles: 24,
        filings: 45,
        citations: buildReleaseImportPlan().sources.length,
        allTableRowsEqual: true,
        syntheticMetadataRestored: true,
        citationIntegrity: true,
        negativeControls: true,
        sourceUnchanged: true,
        cleanupComplete: true,
      })
    );
  } catch {
    throw new Error(
      `Backup/restore verification failed during ${stage}. No existing database was used.`
    );
  } finally {
    try {
      cleanup();
    } finally {
      for (const [key, value] of Object.entries(original)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      for (const [signal, handler] of handlers) process.removeListener(signal, handler);
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Backup verification failed");
    process.exitCode = 1;
  });
}
