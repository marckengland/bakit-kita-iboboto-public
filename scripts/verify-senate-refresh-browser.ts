import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { existsSync, mkdirSync, mkdtempSync, readdirSync } from "node:fs";
import type { Browser, Page } from "playwright";
import {
  launchReviewedBrowser,
  verifyReadinessBoundary,
  waitForVisibleText,
} from "./lib/reviewed-browser";
import path from "node:path";
import { verificationEnv, stopOwnedProcess } from "./lib/verification-runtime";
import { OwnedVerificationRedis } from "./lib/verification-redis";

const app = process.cwd();
assert.ok(
  existsSync(path.join(app, "package-lock.json")),
  "Run this command from the project root"
);
const cache = path.join(app, "node_modules/.cache");
mkdirSync(cache, { recursive: true });
const evidence =
  process.env.BKIB_BROWSER_EVIDENCE_DIR ?? mkdtempSync(path.join(cache, "senate-refresh-browser-"));
assert.ok(
  !existsSync(evidence) || readdirSync(evidence).length === 0,
  "Browser evidence directory must be empty"
);
mkdirSync(evidence, { recursive: true });
const ownershipToken = randomUUID();
const containerName = `bkib-refresh-browser-${ownershipToken}`;
const databaseName = `bkib_refresh_${ownershipToken.replaceAll("-", "")}`;
const ownedRedis = new OwnedVerificationRedis();
let owned = "";
let containerRequested = false;
let ownedUrl = "";
let interrupted: NodeJS.Signals | undefined;
let server: ReturnType<typeof spawn> | undefined;
let browser: Browser | undefined;
let stage = "owned PostgreSQL";
let logs = "";
const observations: Record<string, unknown> = {};
let lastPage: Page | undefined;
function command(program: string, args: string[]) {
  const result = spawnSync(program, args, {
    encoding: "utf8",
    env: verificationEnv(ownedUrl),
    timeout: 120000,
  });
  if (result.status !== 0)
    throw new Error(
      redact(
        `Command failed during ${stage}: ${result.stderr ?? result.error?.message ?? "unknown subprocess failure"}`
      )
    );
  return result.stdout.trim();
}
function fetchLocal(url: string, options: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...options, signal: AbortSignal.timeout(30_000) });
}
async function freePort(): Promise<number> {
  const s = createServer();
  return new Promise((resolve, reject) => {
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const address = s.address();
      assert.ok(address && typeof address === "object");
      s.close(() => resolve(address.port));
    });
  });
}
async function main() {
  assert.ok(
    process.argv.slice(2).every((arg) => arg === "--self-test"),
    "Only --self-test is supported"
  );
  stage = "readiness boundary controls";
  browser = await launchReviewedBrowser();
  await verifyReadinessBoundary(browser);
  if (process.argv.includes("--self-test")) {
    return;
  }

  stage = "owned PostgreSQL";
  await writeFile(
    path.join(evidence, "OWNER.json"),
    JSON.stringify({ containerName, databaseName, ownershipToken }, null, 2) + "\n"
  );
  assert.equal(interrupted, undefined, "Verification was interrupted before container creation");
  containerRequested = true;
  owned = command("docker", [
    "run",
    "--rm",
    "-d",
    "--name",
    containerName,
    "--label",
    "bkib-refresh=disposable",
    "--label",
    `bkib-verification-owner=${ownershipToken}`,
    "--tmpfs",
    "/var/lib/postgresql/data:rw,size=512m",
    "-p",
    "127.0.0.1::5432",
    "-e",
    "POSTGRES_HOST_AUTH_METHOD=trust",
    "-e",
    `POSTGRES_DB=${databaseName}`,
    "postgres:16",
  ]);
  assert.match(owned, /^[a-f0-9]{64}$/);
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (
      spawnSync(
        "docker",
        [
          "exec",
          owned,
          "psql",
          "-h",
          "127.0.0.1",
          "-U",
          "postgres",
          "-d",
          databaseName,
          "-Atc",
          "SELECT 1",
        ],
        { stdio: "ignore", timeout: 2_000 }
      ).status === 0
    ) {
      ready = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.ok(ready);
  const pgPort = command("docker", ["port", owned, "5432/tcp"]).split(":").at(-1);
  ownedUrl = `postgresql://postgres@127.0.0.1:${pgPort}/${databaseName}`;
  const isolated = verificationEnv(ownedUrl);
  process.env.DATABASE_URL = ownedUrl;
  process.env.DOTENV_CONFIG_PATH = isolated.DOTENV_CONFIG_PATH;
  process.env.DOTENV_CONFIG_OVERRIDE = isolated.DOTENV_CONFIG_OVERRIDE;
  delete process.env.DOTENV_KEY;
  stage = "owned database identity";
  command("docker", [
    "exec",
    owned,
    "psql",
    "-X",
    "-v",
    "ON_ERROR_STOP=1",
    "-U",
    "postgres",
    "-d",
    databaseName,
    "-c",
    `COMMENT ON DATABASE "${databaseName}" IS '${ownershipToken}'`,
  ]);
  const { createPrismaClient } = await import("../src/lib/prisma-client");
  const identityClient = createPrismaClient();
  try {
    const identity = await identityClient.$queryRaw<{ database: string; owner: string | null }[]>`
      SELECT current_database() AS database, shobj_description(oid, 'pg_database') AS owner
      FROM pg_database WHERE datname = current_database()
    `;
    assert.deepEqual(identity, [{ database: databaseName, owner: ownershipToken }]);
  } finally {
    await identityClient.$disconnect();
  }
  observations.databaseOwnershipVerifiedBeforeMigration = true;
  stage = "fresh migrations";
  assert.equal(interrupted, undefined, "Verification was interrupted before migrations");
  command(process.execPath, [
    path.join(app, "node_modules/prisma/build/index.js"),
    "migrate",
    "deploy",
  ]);
  const { importReleaseBatch } = await import("../src/lib/release-import");
  const { releaseData } = await import("../src/lib/release-data");
  const db = createPrismaClient();
  try {
    await importReleaseBatch(db);
    assert.equal(await db.politician.count(), 24);
    assert.equal(await db.bill.count(), 45);
  } finally {
    await db.$disconnect();
  }
  const filing = releaseData.filings.find((f) => f.billNumber === 169)!;
  const first = filing.introducedBy.profileId;
  const second = releaseData.profiles.find((p) => p.id !== first)!.id;
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  stage = "local production server";
  const redisUrl = await ownedRedis.start();
  const serverEnv = {
    ...verificationEnv(ownedUrl),
    NODE_ENV: "production",
    __NEXT_PROCESSED_ENV: "true",
    REDIS_DISABLED: "false",
    REDIS_URL: redisUrl,
    ELASTICSEARCH_URL: "http://127.0.0.1:1",
    PUBLIC_CASE_RECORDS_ENABLED: "false",
    PRIVATE_CONTACT_ENABLED: "false",
    DATA_PIPELINE_ENABLED: "false",
    AI_RESEARCH_ENABLED: "false",
  };
  server = spawn(
    process.execPath,
    [
      path.join(app, "node_modules/next/dist/bin/next"),
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    { cwd: app, env: serverEnv, stdio: ["ignore", "pipe", "pipe"] }
  );
  let serverError: Error | undefined;
  server.on("error", (error) => {
    serverError = error;
  });
  server.stdout?.on("data", (b) => (logs += b.toString()));
  server.stderr?.on("data", (b) => (logs += b.toString()));
  ready = false;
  for (let i = 0; i < 100; i++) {
    if (serverError) throw serverError;
    assert.ok(
      server.exitCode === null && server.signalCode === null,
      "Verification server stopped before readiness"
    );
    try {
      if ((await fetchLocal(origin)).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.ok(ready);
  stage = "production guest and reporting boundary";
  for (const endpoint of [
    "/api/auth/verify",
    "/api/reports/inaccuracy",
    "/api/chatbot",
    "/api/cron/data-freshness",
  ]) {
    const response = await fetchLocal(origin + endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(response.status, 404, `Unsupported production endpoint: ${endpoint}`);
  }
  const disabledContact = await fetchLocal(origin + "/api/contact", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  assert.equal(disabledContact.status, 503);
  const oversizedFeedback = await fetchLocal(origin + "/api/feedback", {
    method: "POST",
    headers: { "content-type": "application/json", "x-user-id": "forged" },
    body: JSON.stringify({ padding: "x".repeat(2 * 1024 * 1024 + 1) }),
  });
  assert.equal(oversizedFeedback.status, 413);
  const privacy = await fetchLocal(origin + "/privacy");
  assert.equal(privacy.status, 200);
  const privacyText = await privacy.text();
  assert.ok(privacyText.includes("Private report delivery is unavailable"));
  assert.ok(privacyText.includes("ordinary feedback"));
  observations.guestBoundary = {
    unusedEndpointsClosed: true,
    contactDisabled: true,
    oversizedFeedbackRejected: true,
    privacyServed: true,
  };
  stage = "real APIs";
  const profile = (await (await fetchLocal(origin + `/api/politicians/${first}`)).json()) as any;
  assert.ok(profile.politician.reviewedBatch.refresh.electedTerm.start);
  assert.equal(profile.politician.reviewedBatch.currentOffice, null);
  const comparison = (await (
    await fetchLocal(origin + `/api/compare?ids=${first},${second}`)
  ).json()) as any;
  const compared169 = comparison.reviewedFilings[first].filings.find(
    (f: any) => f.reference === "SBN-169"
  );
  assert.equal(compared169.refresh.successor.successorReference, "SBN-1894");
  const chat = (await (
    await fetchLocal(origin + "/api/chatbot/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "SBN 169 in the 20th Congress", scope: "senate_filings" }),
    })
  ).json()) as any;
  assert.equal(
    chat.answer.senate.filings[0].refresh.successor.successorEnactment.republicAct,
    "RA-12325"
  );
  assert.equal(chat.answer.senate.filings[0].enactment, null);
  const held = (await (
    await fetchLocal(origin + `/api/politicians/${first}/controversies`)
  ).json()) as any;
  assert.equal(held.availability, "withheld");
  const exported = await (
    await fetchLocal(origin + `/api/politicians/${first}/export?format=html`)
  ).text();
  assert.ok(exported.includes("Scheduled term end"));
  assert.ok(exported.includes("RA-12325"));
  observations.api = {
    profileTerms: true,
    comparisonHistory: true,
    chatSuccessorOnly: true,
    casesWithheld: true,
    exportCitations: true,
  };
  stage = "owned database drift guards";
  const initialDetail = (await (
    await fetchLocal(origin + `/api/bills/${filing.id}`)
  ).json()) as any;
  assert.equal(initialDetail.reviewedBatch.refresh.successor.successorReference, "SBN-1894");
  const mutate = createPrismaClient();
  try {
    try {
      await mutate.bill.update({
        where: { id: filing.id },
        data: { title: "Synthetic stored-row conflict for isolated verification" },
      });
      const stale = (await (await fetchLocal(origin + `/api/bills/${filing.id}`)).json()) as any;
      assert.equal(stale.reviewedBatch.refresh, undefined);
      const listed = (await (
        await fetchLocal(origin + `/api/politicians/${first}/bills`)
      ).json()) as any;
      assert.equal(
        listed.items.find((item: any) => item.id === filing.id).reviewedBatch.refresh,
        undefined
      );
    } finally {
      await mutate.bill.update({ where: { id: filing.id }, data: { title: filing.title } });
    }
    const originalName = releaseData.profiles.find((person) => person.id === first)!.displayName;
    try {
      await mutate.politician.update({
        where: { id: first },
        data: { fullName: "Synthetic conflicting identity" },
      });
      const changedProfile = (await (
        await fetchLocal(origin + `/api/politicians/${first}`)
      ).json()) as any;
      assert.equal(changedProfile.politician.reviewedBatch.refresh, undefined);
      const changedDetail = (await (
        await fetchLocal(origin + `/api/bills/${filing.id}`)
      ).json()) as any;
      assert.equal(changedDetail.reviewedBatch.refresh, undefined);
    } finally {
      await mutate.politician.update({ where: { id: first }, data: { fullName: originalName } });
    }
  } finally {
    await mutate.$disconnect();
  }
  observations.drift = {
    cachedBillWithheld: true,
    listHistoryWithheld: true,
    changedProfileWithheld: true,
    changedIntroducerWithheld: true,
  };

  const authProbe = await fetchLocal(origin + "/api/auth/profile");
  assert.equal(authProbe.status, 401);
  stage = "browser context";
  const context = await browser.newContext();
  await context.addCookies([{ name: "NEXT_LOCALE", value: "en", url: origin }]);
  await context.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.startsWith(origin) || url.startsWith("data:")) await route.continue();
    else await route.abort();
  });
  const page = await context.newPage();
  lastPage = page;
  await page.bringToFront();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));

  await page.setViewportSize({ width: 1280, height: 900 });
  stage = "browser homepage";
  await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForSelector("#assistant-input", { timeout: 30_000 });
  assert.equal(await page.$$("a a, button details").then((items) => items.length), 0);
  stage = "browser profile navigation";
  await page.goto(origin + `/politicians/${first}`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  const profileEvidence = page.locator("main .card").first();
  await profileEvidence
    .locator("dt")
    .getByText("Scheduled term end", { exact: true })
    .first()
    .waitFor({ state: "visible", timeout: 30_000 });
  await waitForVisibleText(page, "Scheduled term end", 30_000, profileEvidence);
  const detailsButton = page
    .locator("#selected-filings tr")
    .filter({ hasText: "SBN-169" })
    .getByRole("button");
  await detailsButton.waitFor({ state: "visible", timeout: 30_000 });
  assert.equal(await detailsButton.count(), 1, "SBN169 details button missing");
  await detailsButton.click({ timeout: 30_000 });
  await waitForVisibleText(
    page,
    "RA-12325",
    30_000,
    page
      .getByRole("dialog", { name: "Bill Details" })
      .getByRole("region", { name: "Dated bill history" })
  );
  observations.desktopLayout = await page.evaluate(() => {
    const dock = document.querySelector("#research-assistant")!;
    const css = getComputedStyle(dock);
    return {
      viewport: innerWidth,
      documentWidth: document.documentElement.clientWidth,
      dock: dock.getBoundingClientRect().toJSON(),
      right: css.right,
      transform: css.transform,
      zoom: getComputedStyle(document.documentElement).zoom,
    };
  });
  assert.ok((await page.content()).includes("Original bill enactment remains unverified"));
  await page.screenshot({
    path: path.join(evidence, "profile-history-desktop.png"),
    fullPage: true,
  });
  stage = "browser responsive history";
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    document.documentElement.style.zoom = "1.25";
  });
  const overflow = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: document.documentElement.clientWidth,
  }));
  assert.ok(overflow.scroll <= overflow.width + 2, JSON.stringify(overflow));
  await page.evaluate(() =>
    document.querySelector('[aria-label="Dated bill history"]')?.scrollIntoView({ block: "center" })
  );
  await page.screenshot({
    path: path.join(evidence, "profile-history-mobile.png"),
    fullPage: true,
  });
  stage = "browser comparison";
  await page.evaluate(() => {
    document.documentElement.style.zoom = "";
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(origin + `/compare?ids=${first},${second}`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  const comparisonEvidence = page.getByRole("region", { name: "Compare the reviewed records" });
  await comparisonEvidence
    .locator("dt")
    .getByText("Scheduled term end", { exact: true })
    .first()
    .waitFor({ state: "visible", timeout: 30_000 });
  await waitForVisibleText(page, "Scheduled term end", 30_000, comparisonEvidence);
  assert.ok((await page.content()).includes("SBN-169"));
  assert.ok((await page.content()).includes("RA-12325"));
  await page.screenshot({ path: path.join(evidence, "comparison-refresh.png"), fullPage: true });
  stage = "browser reviewed chat";
  await page.goto(origin + "/chatbot", { waitUntil: "domcontentloaded", timeout: 30_000 });
  const field = await page.waitForSelector("#assistant-input", { timeout: 30_000 });
  assert.ok(field);
  await field.type("SBN 169 in the 20th Congress");
  await field.press("Enter");
  await waitForVisibleText(page, "RA-12325", 30_000, page.locator("#research-assistant"));
  assert.ok((await page.content()).includes("Checked stored records"));
  await page.screenshot({ path: path.join(evidence, "chat-refresh.png"), fullPage: true });
  assert.deepEqual(pageErrors, []);
  observations.browser = {
    profileModal: true,
    mobile390CssZoom125: true,
    comparisonTwoPeople: true,
    chatHistory: true,
    pageErrors,
  };
}
function redact(value: string): string {
  return value.replace(/postgres(?:ql)?:\/\/[^\s"']+/g, "[DATABASE_URL redacted]");
}

let cleanupPromise: Promise<string[]> | undefined;
function cleanup(): Promise<string[]> {
  return (cleanupPromise ??= (async () => {
    const errors: string[] = [];
    for (const close of [
      async () => {
        if (browser) await browser.close();
      },
      async () => {
        await stopOwnedProcess(server);
      },
      async () => {
        ownedRedis.cleanup();
      },
      async () => {
        // A generated name and matching owner label also cover interrupted startup.
        if (!containerRequested) return;
        const found = spawnSync(
          "docker",
          [
            "inspect",
            "--format",
            '{{ index .Config.Labels "bkib-verification-owner" }}',
            containerName,
          ],
          { encoding: "utf8", env: verificationEnv(ownedUrl), timeout: 10_000 }
        );
        if (found.status === 0) {
          assert.equal(found.stdout.trim(), ownershipToken, "Refuse to stop an unowned container");
          command("docker", ["stop", containerName]);
        } else {
          assert.ok(
            /No such (?:object|container)/i.test(found.stderr ?? ""),
            "Cannot verify removal of the owned container"
          );
        }
      },
    ]) {
      try {
        await close();
      } catch (error) {
        errors.push(redact(String(error)));
      }
    }
    observations.cleanup = { complete: errors.length === 0, errors };
    await writeFile(path.join(evidence, "server.log"), redact(logs));
    return errors;
  })());
}

let finishPromise: Promise<void> | undefined;
function finish(failure: string | null): Promise<void> {
  return (finishPromise ??= (async () => {
    const cleanupErrors = await cleanup();
    const finalFailure =
      [interrupted && `Interrupted by ${interrupted}`, failure, ...cleanupErrors]
        .filter(Boolean)
        .join("; ") || null;
    await writeFile(
      path.join(evidence, "RESULT.json"),
      JSON.stringify(
        {
          verified: finalFailure === null,
          stage,
          ...(finalFailure && { error: finalFailure }),
          ...observations,
        },
        null,
        2
      ) + "\n"
    );
    if (finalFailure) {
      console.error(`Refresh browser verification failed during ${stage}: ${finalFailure}`);
      process.exitCode =
        interrupted === "SIGINT"
          ? 130
          : interrupted === "SIGTERM"
            ? 143
            : interrupted === "SIGHUP"
              ? 129
              : 1;
    } else {
      console.log(
        process.argv.includes("--self-test")
          ? "Browser readiness controls passed."
          : "Refresh browser verification passed: owned database, real profile/compare/chat/export APIs, profile modal, mobile layout, comparison and record chat."
      );
    }
    console.log(`Browser verification evidence: ${path.relative(app, evidence)}`);
  })());
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
  process.once(signal, () => {
    interrupted = signal;
    void finish(null).finally(() => {
      process.exit(signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : 129);
    });
  });
}

async function run(): Promise<void> {
  let failure: string | null = null;
  try {
    await main();
  } catch (error) {
    failure = redact(String(error));
    if (lastPage && !lastPage.isClosed()) {
      observations.browserDiagnostics = await lastPage
        .evaluate(() => ({ state: document.readyState, title: document.title }))
        .catch(() => null);
      await lastPage
        .screenshot({
          path: path.join(evidence, "browser-failure.png"),
          fullPage: true,
          timeout: 5_000,
        })
        .catch(() => {});
    }
  }
  await finish(failure);
}
run().catch((error: unknown) => {
  console.error(redact(String(error)));
  process.exitCode = 1;
});
