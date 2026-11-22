import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { createPrismaClient } from "../src/lib/prisma-client";
import {
  buildReleaseImportPlan,
  importReleaseBatch,
  verifyReleaseFiles,
} from "../src/lib/release-import";

let ownedContainer = "";
let stage = "approved file checks";
const originalUrl = process.env.DATABASE_URL;
function command(program: string, args: string[], env = process.env) {
  const result = spawnSync(program, args, { encoding: "utf8", env, timeout: 120_000 });
  if (result.status !== 0) throw new Error(`Verification command failed during ${stage}`);
  return result.stdout.trim();
}
function migrate(url: string) {
  command(
    process.execPath,
    [path.join(process.cwd(), "node_modules/prisma/build/index.js"), "migrate", "deploy"],
    {
      ...process.env,
      DATABASE_URL: url,
      DOTENV_CONFIG_PATH: "/dev/null",
    }
  );
}
async function main() {
  await verifyReleaseFiles();
  stage = "owned disposable PostgreSQL startup";
  ownedContainer = command("docker", [
    "run",
    "--rm",
    "-d",
    "--name",
    `bkib-data-verify-${randomUUID()}`,
    "--label",
    "bkib-release-data=disposable",
    "--tmpfs",
    "/var/lib/postgresql/data:rw,size=512m",
    "-p",
    "127.0.0.1::5432",
    "-e",
    "POSTGRES_HOST_AUTH_METHOD=trust",
    "-e",
    "POSTGRES_DB=bkib_release_verify",
    "postgres:16",
  ]);
  assert.match(ownedContainer, /^[a-f0-9]{64}$/);
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    const result = spawnSync("docker", ["exec", ownedContainer, "pg_isready", "-U", "postgres"], {
      encoding: "utf8",
    });
    if (result.status === 0) {
      ready = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.ok(ready, "Owned PostgreSQL did not become ready");
  const port = command("docker", ["port", ownedContainer, "5432/tcp"]).split(":").at(-1)!;
  const url = `postgresql://postgres@127.0.0.1:${port}/bkib_release_verify`;
  stage = "fresh migration deployment";
  migrate(url);
  process.env.DATABASE_URL = url;
  const db = createPrismaClient();
  try {
    stage = "import and idempotence";
    assert.equal((await importReleaseBatch(db)).action, "imported");
    assert.equal((await importReleaseBatch(db)).action, "unchanged");
    assert.equal(await db.politician.count(), 24);
    assert.equal(await db.bill.count(), 45);
    assert.equal(await db.bill.count({ where: { status: null, session: null } }), 45);
    assert.equal(
      (await db.bill.findUniqueOrThrow({ where: { id: "ph-senate-20-sbn-142" } })).filingDate,
      null
    );
    assert.equal(await db.billAuthor.count({ where: { role: "introduced_by" } }), 45);
    assert.equal(
      await db.position.count(),
      0,
      "Observed memberships must not invent Position terms"
    );
    assert.equal(await db.sourceAttribution.count({ where: { confidence: { not: null } } }), 0);
    stage = "other-schema refusal";
    await db.$executeRaw`CREATE SCHEMA owned_other_schema`;
    await db.$executeRaw`CREATE TABLE owned_other_schema.sentinel (value text)`;
    await db.$executeRaw`INSERT INTO owned_other_schema.sentinel VALUES ('synthetic verification only')`;
    await assert.rejects(importReleaseBatch(db), /outside|not empty/);
    await db.$executeRaw`DROP SCHEMA owned_other_schema CASCADE`;
    stage = "implicit-field drift refusal";
    const profileId = buildReleaseImportPlan().profiles[0]!.id;
    await db.politician.update({
      where: { id: profileId },
      data: { nickname: "Synthetic verification drift" },
    });
    await assert.rejects(importReleaseBatch(db), /not empty|does not match/);
    assert.equal(
      (await db.politician.findUniqueOrThrow({ where: { id: profileId } })).nickname,
      "Synthetic verification drift"
    );
    await db.politician.update({ where: { id: profileId }, data: { nickname: null } });
    const sourceId = buildReleaseImportPlan().sources[0]!.id;
    await db.sourceAttribution.update({
      where: { id: sourceId },
      data: { evidenceLocator: "Synthetic verification drift" },
    });
    await assert.rejects(importReleaseBatch(db), /not empty|does not match/);
    await db.sourceAttribution.update({ where: { id: sourceId }, data: { evidenceLocator: null } });
    stage = "nonempty database refusal";
    const sentinel = await db.politician.create({
      data: {
        id: "owned-verification-sentinel",
        fullName: "Synthetic Verification Sentinel",
        firstName: "Synthetic",
        lastName: "Sentinel",
        updatedAt: new Date(),
      },
    });
    await assert.rejects(importReleaseBatch(db), /not empty|does not match/);
    assert.equal(await db.politician.count(), 25);
    assert.deepEqual(await db.politician.findUnique({ where: { id: sentinel.id } }), sentinel);
  } finally {
    await db.$disconnect();
  }

  stage = "atomic rollback database";
  command("docker", ["exec", ownedContainer, "createdb", "-U", "postgres", "bkib_release_atomic"]);
  const atomicUrl = url.replace(/\/bkib_release_verify$/, "/bkib_release_atomic");
  migrate(atomicUrl);
  process.env.DATABASE_URL = atomicUrl;
  const atomic = createPrismaClient();
  try {
    const invalid = buildReleaseImportPlan();
    invalid.sources.push({ ...invalid.sources[0]! });
    await assert.rejects(importReleaseBatch(atomic, invalid));
    assert.equal(await atomic.politician.count(), 0);
    assert.equal(await atomic.bill.count(), 0);
    assert.equal(await atomic.billAuthor.count(), 0);
    assert.equal(await atomic.sourceAttribution.count(), 0);
  } finally {
    await atomic.$disconnect();
  }
  console.log(
    "Populated data verification passed: approved bytes, fresh migrations, 24 profiles, 45 filings, unknowns, original-introducer credit, repeat import, nonempty refusal, and atomic rollback."
  );
}
main()
  .catch(() => {
    console.error(
      `Populated data verification failed during ${stage}. No existing database was used.`
    );
    process.exitCode = 1;
  })
  .finally(() => {
    if (originalUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalUrl;
    if (ownedContainer) spawnSync("docker", ["rm", "-f", ownedContainer], { encoding: "utf8" });
  });
