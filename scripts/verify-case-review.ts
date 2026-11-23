import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { OwnedVerificationRedis } from "./lib/verification-redis";

const root = process.cwd();
const migration = "20261116090000_case_review";
const temp = mkdtempSync(path.join(root, "node_modules/.cache/case-review-"));
let container = "";
let verificationUrl = "";
let stage = "container startup";
function docker(args: string[], input?: string): string {
  return execFileSync("docker", args, {
    input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}
function sql(statement: string): string {
  return docker(
    [
      "exec",
      "-i",
      container,
      "psql",
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      "case_review_verify",
      "-At",
    ],
    statement
  );
}
function rejected(statement: string): void {
  assert.throws(() => sql(statement));
}
function deploy(): void {
  execFileSync(
    path.join(root, "node_modules/.bin/prisma"),
    ["migrate", "deploy", "--config", path.join(temp, "prisma.config.ts")],
    {
      env: { ...process.env, DATABASE_URL: verificationUrl, DOTENV_CONFIG_PATH: "/dev/null" },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
}
const ownedRedis = new OwnedVerificationRedis();
let server: import("node:child_process").ChildProcess | undefined;
let appPrisma: Awaited<typeof import("../src/lib/prisma")>["default"] | undefined;
let secondPrisma: typeof appPrisma;
async function freePort(): Promise<number> {
  const { createServer } = await import("node:net");
  const socket = createServer();
  return new Promise((resolve, reject) => {
    socket.on("error", reject);
    socket.listen(0, "127.0.0.1", () => {
      const addr = socket.address();
      assert.ok(addr && typeof addr !== "string");
      socket.close((error) => (error ? reject(error) : resolve(addr.port)));
    });
  });
}
async function stopServer() {
  if (!server) return;
  const child = server;
  server = undefined;
  if (child.exitCode === null) {
    child.kill("SIGTERM");
    await new Promise<void>((resolve) => child.once("exit", () => resolve()));
  }
}
async function startServer(enabled: boolean): Promise<string> {
  await stopServer();
  const port = await freePort();
  const redisUrl = await ownedRedis.start();
  server = spawn(
    process.execPath,
    [
      path.join(root, "node_modules/next/dist/bin/next"),
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        NODE_ENV: "production",
        DATABASE_URL: verificationUrl,
        DOTENV_CONFIG_PATH: "/dev/null",
        __NEXT_PROCESSED_ENV: "true",
        DATA_PIPELINE_ENABLED: "false",
        AI_RESEARCH_ENABLED: "false",
        PUBLIC_CASE_RECORDS_ENABLED: String(enabled),
        REDIS_DISABLED: "false",
        REDIS_URL: redisUrl,
      },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  // Consume bounded output without forwarding SQL, environment, or source data.
  server.stdout?.resume();
  server.stderr?.resume();
  const origin = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw Error("Fixture production server exited");
    try {
      const response = await fetch(`${origin}/manifest.json`);
      if (response.ok) return origin;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error("Fixture production server did not start");
}
const sentinel = "UNREVIEWED-DO-NOT-PUBLISH";
async function checkHttp(origin: string, enabled: boolean) {
  for (const url of [
    "/api/politicians/fixture-person/controversies",
    "/politicians/fixture-person",
    "/",
    "/api/politicians/fixture-person/export?format=html",
  ]) {
    stage = `production HTTP ${url}`;
    const response = await fetch(origin + url);
    const text = await response.text();
    assert.equal(response.status, 200, `${url} response status`);
    assert.ok(!text.includes(sentinel), `${url} exposed held text`);
    if (url.includes("controversies")) {
      const body = JSON.parse(text);
      assert.equal(body.schemaVersion, 2);
      assert.equal(body.availability, enabled ? "available" : "withheld");
      assert.deepEqual(body.totals, enabled ? { cases: 1, context: 0 } : null);
      assert.equal(body.records.length, enabled ? 1 : 0);
      assert.match(response.headers.get("cache-control") ?? "", /no-store/);
    }
    if (!enabled) {
      assert.ok(!text.includes("Criminal conviction"), `${url} exposed approved case while off`);
      if (url.includes("/politicians/fixture-person") && !url.includes("controversies"))
        assert.ok(
          text.includes("Research is being reviewed."),
          `${url} missing research-hold notice`
        );
    }
  }
}
async function checkReviewedChat(origin: string, expected: "records" | "withheld" | "unavailable") {
  const response = await fetch(origin + "/api/chatbot/records", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Show reviewed records", politicianId: "fixture-person" }),
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  const data = await response.json();
  assert.equal(data.answer.status, expected);
  assert.ok(!JSON.stringify(data).includes(sentinel));
  assert.ok(!("conversationId" in data));
  assert.equal(data.answer.records.length, expected === "records" ? 1 : 0);
  if (expected === "records") {
    assert.equal(data.answer.records[0].outcome.label, "Criminal conviction");
    assert.equal(data.answer.records[0].sources.length, 2);
    assert.equal(
      data.answer.records[0].events[0].sources[0].sourceUrl,
      "https://source1.example.test/record/1"
    );
  }
}

async function updateFixtureDate(date: string) {
  const db = appPrisma!;
  await db.caseEvent.update({ where: { id: "event-1" }, data: { eventDate: date } });
  const row = await db.controversy.findUniqueOrThrow({
    where: { id: "case-1" },
    include: { CaseEvent: true, SourceAttribution: true },
  });
  const { caseContentHash } = await import("../src/lib/case-review");
  const { approveCaseReview } = await import("../src/services/case-review.service");
  await approveCaseReview({
    recordId: row.id,
    expectedContentHash: caseContentHash({
      record: row,
      events: row.CaseEvent,
      sources: row.SourceAttribution,
    }),
    reviewer: "fixture-maintainer",
    reviewedAt: new Date(),
    reviewNote: row.reviewNote!,
    approvedSourceIds: row.approvedSourceIds,
    independentSourceIds: row.independentSourceIds as [string, string],
  });
}
async function checkReviewedChatBrowser(origin: string) {
  stage = "reviewed chat browser lifecycle";
  const { default: puppeteer } = await import("puppeteer");
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    await browser
      .defaultBrowserContext()
      .setCookie({ name: "NEXT_LOCALE", value: "en", url: origin });
    const page = await browser.newPage();
    let holdNext = false;
    let held: import("puppeteer").HTTPRequest | undefined;
    await page.setRequestInterception(true);
    page.on("request", async (request) => {
      if (holdNext && request.url().endsWith("/api/chatbot/records")) {
        held = request;
        holdNext = false;
        return;
      }
      if (request.url().startsWith(origin) || request.url().startsWith("data:"))
        await request.continue();
      else await request.abort();
    });
    await page.goto(origin + "/", { waitUntil: "networkidle0" });
    await page.type("#assistant-input", "Synthetic Person");
    await page.focus("#assistant-input");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() =>
      document.querySelector("#research-assistant")?.textContent?.includes("Choose a profile")
    );
    await page.evaluate(() =>
      Array.from(document.querySelectorAll("#research-assistant button"))
        .find((b) => b.textContent === "Synthetic Person")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    );
    await page.waitForFunction(() =>
      document.querySelector("#research-assistant")?.textContent?.includes("Synthetic case")
    );
    assert.ok(
      !(await page.$eval("#research-assistant", (el) => el.textContent)).includes(
        "Answers are generated by AI"
      ),
      "Reviewed mode must not claim AI generated its answer"
    );
    assert.equal(
      await page.$eval('button[aria-label="Close conversation"]', (button) => {
        const rect = button.getBoundingClientRect();
        return (
          document
            .elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
            ?.closest("button") === button
        );
      }),
      true,
      "Conversation close control must be above the page header"
    );
    stage = "reviewed chat close";
    await page.locator('button[aria-label="Close conversation"]').click();
    await page.waitForFunction(() => !document.querySelector(".assistant-shell-open"));
    await page.evaluate(() =>
      Array.from(document.querySelectorAll("#research-assistant button"))
        .find((b) => b.textContent === "Open conversation")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    );
    stage = "reviewed chat reopen";
    await page.waitForFunction(() => !!document.querySelector(".assistant-shell-open"));
    assert.ok(
      !(await page.$eval("#research-assistant", (el) => el.textContent)).includes("Synthetic case"),
      "Close/reopen must not replay reviewed records"
    );
    stage = "reviewed chat pending cancellation";
    holdNext = true;
    const pending = page.waitForRequest((request) =>
      request.url().endsWith("/api/chatbot/records")
    );
    await page.type("#assistant-input", "refresh");
    await page.keyboard.press("Enter");
    await pending;
    await page.locator('button[aria-label="Close conversation"]').click();
    await page.waitForNetworkIdle({ idleTime: 100 });
    assert.equal(
      held?.failure()?.errorText,
      "net::ERR_ABORTED",
      "Closing must cancel the pending record request"
    );
    assert.equal(
      await page.$eval("#assistant-input", (input) => (input as HTMLTextAreaElement).value),
      "refresh",
      "Cancelled request draft must remain available"
    );
    await page.evaluate(() =>
      Array.from(document.querySelectorAll("#research-assistant button"))
        .find((b) => b.textContent === "Open conversation")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    );
    await page.waitForFunction(() => !!document.querySelector(".assistant-shell-open"));
    assert.ok(
      !(await page.$eval("#research-assistant", (el) => el.textContent)).includes("Synthetic case")
    );
    await page.$eval("#assistant-input", (input) => {
      (input as HTMLTextAreaElement).select();
    });
    await page.keyboard.press("Backspace");
    stage = "reviewed chat mobile refresh";
    await page.setViewport({ width: 390, height: 844 });
    await page.type("#assistant-input", "refresh");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() =>
      document.querySelector("#research-assistant")?.textContent?.includes("Synthetic case")
    );
    stage = "reviewed chat offline invalidation";
    await page.setOfflineMode(true);
    await page.waitForFunction(() =>
      document
        .querySelector("#research-assistant")
        ?.textContent?.includes("Previous answers were cleared")
    );
    assert.ok(
      !(await page.$eval("#research-assistant", (el) => el.textContent)).includes("Synthetic case"),
      "Offline chat must not display its previous record payload"
    );
    await page.setOfflineMode(false);
    assert.ok(
      !(await page.$eval("#research-assistant", (el) => el.textContent)).includes("Synthetic case"),
      "Reconnect must not replay the old answer"
    );
    await page.type("#assistant-input", "refresh");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() =>
      document.querySelector("#research-assistant")?.textContent?.includes("Synthetic case")
    );
    stage = "reviewed chat profile navigation";
    await page
      .locator('#research-assistant a[href="/politicians/fixture-person#reviewed-research"]')
      .click();
    await page.waitForFunction(() => location.pathname === "/politicians/fixture-person");
    stage = "reviewed chat mobile cleanup";
    await page.waitForFunction(
      () =>
        !document.querySelector("#main-content")?.hasAttribute("inert") &&
        !document.querySelector(".assistant-shell-open")
    );
    process.stdout.write("Reviewed chat citations, close/reopen, and mobile navigation passed\n");
  } finally {
    await browser.close();
  }
}
async function checkReviewedChatQuota(origin: string) {
  stage = "reviewed chat expired quota";
  const { default: puppeteer } = await import("puppeteer");
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    await browser
      .defaultBrowserContext()
      .setCookie({ name: "NEXT_LOCALE", value: "en", url: origin });
    const page = await browser.newPage();
    let posts = 0;
    await page.setRequestInterception(true);
    page.on("request", async (request) => {
      if (request.url().endsWith("/api/chatbot/records")) {
        posts++;
        const response = await fetch(request.url(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: request.postData(),
        });
        const data = await response.json();
        data.rateLimitStatus = { remaining: 0, resetAt: "2000-01-01T00:00:00Z", isBlocked: false };
        await request.respond({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(data),
        });
      } else if (request.url().startsWith(origin) || request.url().startsWith("data:"))
        await request.continue();
      else await request.abort();
    });
    await page.goto(origin + "/chatbot", { waitUntil: "networkidle0" });
    await page.type("#assistant-input", "Synthetic Person");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() =>
      document.querySelector("#research-assistant")?.textContent?.includes("Choose a profile")
    );
    await page.evaluate(() =>
      Array.from(document.querySelectorAll("#research-assistant button"))
        .find((b) => b.textContent === "Synthetic Person")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    );
    await page.waitForFunction(
      () =>
        document.querySelector("#research-assistant")?.textContent?.includes("Synthetic case") ||
        document.querySelector('[role="alert"]')
    );
    assert.equal(posts, 2, "Expired local quota must permit a fresh server request");
  } finally {
    await browser.close();
  }
}

async function checkOffline(origin: string) {
  stage = "browser runtime";
  const { default: puppeteer } = await import("puppeteer");
  assert.ok(
    existsSync(await puppeteer.executablePath()),
    "Installed Puppeteer browser is required"
  );
  stage = "browser launch";
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    stage = "browser offline fixture";
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on("request", async (request) => {
      if (request.interceptResolutionState().action === "disabled") return;
      if (request.url().startsWith(origin) || request.url().startsWith("data:"))
        await request.continue();
      else await request.abort();
    });
    await page.setExtraHTTPHeaders({ "Accept-Language": "en" });
    await page.goto(origin + "/manifest.json");
    await page.evaluate(async (sentinel) => {
      const cache = await caches.open("bkib-dynamic-v1");
      for (const url of [
        "/",
        "/politicians",
        "/politicians/fixture-person",
        "/api/politicians/fixture-person",
        "/api/politicians/fixture-person/controversies",
      ]) {
        await cache.put(url, new Response(sentinel));
      }
      const assets = await caches.open("bkib-static-v1");
      await assets.put("/keep.svg", new Response("keep-static"));
      const req = indexedDB.open("bkib-offline", 1);
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        req.onupgradeneeded = () => {
          req.result.createObjectStore("profiles", { keyPath: "id" });
          req.result.createObjectStore("sync-queue", { keyPath: "id" });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const tx = db.transaction(["profiles", "sync-queue"], "readwrite");
      tx.objectStore("profiles").put({
        id: "fixture-person",
        data: {
          fullName: "Saved Synthetic Person",
          controversies: [sentinel],
          redFlags: [sentinel],
          redFlagCount: 9,
        },
        downloadedAt: new Date().toISOString(),
        lastSyncedAt: null,
        sizeBytes: 300,
      });
      tx.objectStore("sync-queue").put({
        id: "owned-note",
        action: "bookmark",
        payload: { id: "fixture-person" },
        createdAt: new Date().toISOString(),
        retryCount: 0,
      });
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
      await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller)
        await new Promise<void>((resolve) =>
          navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), {
            once: true,
          })
        );
    }, sentinel);
    const expired = await page.evaluate(async () => ({
      old: !!(await caches.match("/politicians/fixture-person")),
      kept: await (await caches.match("/keep.svg"))?.text(),
    }));
    assert.deepEqual(expired, { old: false, kept: "keep-static" });
    const manual = await page.evaluate(
      async () =>
        new Promise<{ cached: boolean }>((resolve) => {
          const channel = new MessageChannel();
          channel.port1.onmessage = (e) => resolve(e.data);
          navigator.serviceWorker.controller!.postMessage(
            {
              type: "CACHE_POLITICIAN_PROFILE",
              payload: {
                politicianId: "fixture-person",
                data: { redFlags: ["MANUAL-CASE-SENTINEL"] },
              },
            },
            [channel.port2]
          );
        })
    );
    assert.equal(manual.cached, false);
    assert.equal(
      await page.evaluate(async () => !!(await caches.match("/api/politicians/fixture-person"))),
      false
    );
    await page.goto(origin + "/", { waitUntil: "domcontentloaded" });
    let landing = await page.evaluate(() => document.body.innerText);
    const { caseActivityDays } = await import("../src/services/public-research.service");
    async function readReviewedResearch() {
      const response = await fetch(origin + "/api/politicians/fixture-person/controversies");
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.availability, "available");
      return body;
    }
    assert.equal(
      (await readReviewedResearch()).totals.cases,
      1,
      "Public count must include only the approved case"
    );
    assert.ok(landing.includes("Data coverage"), "Homepage must disclose data coverage");
    assert.ok(
      !landing.includes("Reviewed case update"),
      "Old event or recent approval must not become recent case activity"
    );
    assert.ok(
      !landing.includes("Critical Red Flag"),
      "Stored case flags must not become a ranking signal"
    );
    await updateFixtureDate(new Date().toISOString().slice(0, 7));
    await page.reload({ waitUntil: "domcontentloaded" });
    landing = await page.evaluate(() => document.body.innerText);
    assert.ok(
      !landing.includes("Reviewed case update"),
      "Partial event dates cannot become recent day signals"
    );
    assert.deepEqual(
      caseActivityDays((await readReviewedResearch()).records),
      [],
      "Partial event dates cannot become recent day signals"
    );
    const today = new Date().toISOString().slice(0, 10);
    await updateFixtureDate(today);
    await page.reload({ waitUntil: "domcontentloaded" });
    landing = await page.evaluate(() => document.body.innerText);
    assert.deepEqual(
      caseActivityDays((await readReviewedResearch()).records),
      [today],
      "An approved exact recent event should contribute case activity"
    );
    assert.ok(landing.includes("Data coverage"), "Homepage coverage notes must remain available");
    await updateFixtureDate("2020-02-29");
    stage = "browser saved biography online";
    await page.goto(origin + "/downloads", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.innerText.includes("Saved Synthetic Person"));
    stage = "browser live profile online";
    await page.goto(origin + "/politicians/fixture-person", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.innerText.includes("Criminal conviction"));
    stage = "browser actual offline transition";
    page.removeAllListeners("request");
    await page.setRequestInterception(false);
    await page.setOfflineMode(true);
    for (const target of browser.targets().filter((target) => target.type() === "service_worker")) {
      const session = await target.createCDPSession();
      await session.send("Network.enable");
      await session.send("Network.emulateNetworkConditions", {
        offline: true,
        latency: 0,
        downloadThroughput: 0,
        uploadThroughput: 0,
      });
    }
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await page.waitForFunction(() => !document.body.innerText.includes("Criminal conviction"));
    assert.ok(
      (await page.evaluate(() => document.body.innerText)).includes(
        "Case details require an online review check."
      )
    );
    await page.goto(origin + "/politicians/fixture-person", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.innerText.includes("Saved Synthetic Person"));
    const body = await page.evaluate(() => document.body.innerText);
    assert.ok(body.includes("Case details require an online review check."));
    assert.ok(!body.includes(sentinel));
    const stored = await page.evaluate(async () => {
      const req = indexedDB.open("bkib-offline", 1);
      const db = await new Promise<IDBDatabase>((resolve) => {
        req.onsuccess = () => resolve(req.result);
      });
      const tx = db.transaction(["profiles", "sync-queue"], "readonly");
      const values = await Promise.all(
        ["profiles", "sync-queue"].map(
          (store, index) =>
            new Promise<unknown>((resolve) => {
              const request = tx
                .objectStore(store)
                .get(index === 0 ? "fixture-person" : "owned-note");
              request.onsuccess = () => resolve(request.result);
            })
        )
      );
      db.close();
      return values;
    });
    assert.ok(JSON.stringify(stored[0]).includes(sentinel), "Raw owned saved profile must survive");
    assert.ok(stored[1], "Queued user action must survive");
    const offlineApi = await page.evaluate(async () => {
      const response = await fetch("/api/politicians/fixture-person/controversies");
      return { status: response.status, text: await response.text() };
    });
    assert.equal(offlineApi.status, 503);
    assert.ok(!offlineApi.text.includes(sentinel));
  } finally {
    await browser.close();
  }
}
async function checkApplication() {
  process.env.DATABASE_URL = verificationUrl;
  process.env.PUBLIC_CASE_RECORDS_ENABLED = "true";
  process.env.REDIS_DISABLED = "true";
  const { createPrismaClient } = await import("../src/lib/prisma-client");
  const fixtureClient = createPrismaClient({ log: [] });
  (globalThis as typeof globalThis & { prisma: typeof fixtureClient }).prisma = fixtureClient;
  const { default: db } = await import("../src/lib/prisma");
  appPrisma = db;
  secondPrisma = createPrismaClient({ log: [] });
  const { caseFixture } = await import("../src/test/fixtures/case-review");
  const { caseContentHash } = await import("../src/lib/case-review");
  const { approveCaseReview, CaseReviewConflictError } =
    await import("../src/services/case-review.service");
  const { getPublicResearchBatch, getPublicRedFlagsBatch } =
    await import("../src/services/public-research.service");
  stage = "Prisma transaction rollback";
  await assert.rejects(
    db.$transaction(async (tx) => {
      await tx.caseEvent.create({
        data: {
          id: "must-rollback",
          controversyId: "fixture-other",
          kind: "filing",
          summary: "Rollback fixture",
        },
      });
      await tx.sourceAttribution.create({
        data: {
          id: "wrong-transaction-source",
          sourceType: "court_document",
          sourceName: "Fixture",
          confidence: 0,
          fieldName: "caseEvent",
          controversyId: "fixture-other",
          caseEventId: "fixture-event",
        },
      });
    })
  );
  assert.equal(await db.caseEvent.count({ where: { id: "must-rollback" } }), 0);
  stage = "Prisma review fixture and stale approval";
  const p = caseFixture();
  p.record.politicianId = "fixture-person";
  await db.controversy.create({
    data: { ...p.record, outcomeEventId: null, reviewState: "pending", approvedContentHash: null },
  });
  for (const event of p.events)
    await db.caseEvent.create({ data: { ...event, reviewState: "pending" } });
  for (const source of p.sources)
    await db.sourceAttribution.create({ data: { ...source, reviewState: "pending" } });
  await db.controversy.update({
    where: { id: p.record.id },
    data: { outcomeEventId: p.record.outcomeEventId },
  });
  const load = async () => {
    const row = await db.controversy.findUniqueOrThrow({
      where: { id: p.record.id },
      include: { CaseEvent: true, SourceAttribution: true },
    });
    return { record: row, events: row.CaseEvent, sources: row.SourceAttribution };
  };
  let packet = await load();
  const stale = caseContentHash(packet);
  await secondPrisma.caseEvent.update({
    where: { id: p.events[0]!.id },
    data: { summary: "Synthetic judgment edited by second connection" },
  });
  const input = {
    recordId: p.record.id,
    expectedContentHash: stale,
    reviewer: "fixture-maintainer",
    reviewedAt: new Date(),
    reviewNote: p.record.reviewNote!,
    approvedSourceIds: p.record.approvedSourceIds,
    independentSourceIds: p.record.independentSourceIds as [string, string],
  };
  await assert.rejects(approveCaseReview(input), CaseReviewConflictError);
  assert.equal((await load()).record.reviewState, "pending");
  packet = await load();
  await approveCaseReview({ ...input, expectedContentHash: caseContentHash(packet) });
  let envelope = (await getPublicResearchBatch(["fixture-person"])).get("fixture-person")!;
  assert.equal(envelope.records.length, 1);
  assert.equal((await getPublicRedFlagsBatch(["fixture-person"])).get("fixture-person")!.length, 1);
  stage = "legacy writer fingerprint invalidation";
  sql(
    `UPDATE "SourceAttribution" SET "sourceUrl"='https://changed.example.test/record' WHERE id='source-1';`
  );
  assert.equal(
    (await getPublicResearchBatch(["fixture-person"])).get("fixture-person")!.records.length,
    0
  );
  assert.equal((await load()).record.reviewState, "approved");
  sql(
    `UPDATE "SourceAttribution" SET "sourceUrl"='https://source1.example.test/record/1' WHERE id='source-1';`
  );
  assert.equal(
    (await getPublicResearchBatch(["fixture-person"])).get("fixture-person")!.records.length,
    1
  );
  stage = "production HTTP and offline browser boundaries";
  let origin = await startServer(true);
  await checkHttp(origin, true);
  await checkReviewedChat(origin, "records");
  for (const message of ["%", "_", "\\"]) {
    const literal = await fetch(origin + "/api/chatbot/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    assert.equal(
      (await literal.json()).answer.status,
      "no_profile",
      "Name lookup must treat metacharacters literally"
    );
  }
  await checkReviewedChatBrowser(origin);
  await checkReviewedChatQuota(origin);
  stage = "enabled production unavailable states";
  sql('ALTER TABLE "CaseEvent" RENAME TO "CaseEvent_fixture_unavailable";');
  try {
    await checkReviewedChat(origin, "unavailable");
    const response = await fetch(origin + "/api/politicians/fixture-person/controversies");
    assert.equal(response.status, 503);
    assert.equal((await response.json()).availability, "unavailable");
    for (const route of ["/politicians/fixture-person", "/"]) {
      const result = await fetch(origin + route, { headers: { "Accept-Language": "en" } });
      const text = await result.text();
      assert.ok(
        text.includes("Reviewed research is temporarily unavailable"),
        `${route} missing unavailable state`
      );
      assert.ok(!text.includes(sentinel));
      assert.ok(!text.includes("Politician Not Found"));
    }
  } finally {
    sql('ALTER TABLE "CaseEvent_fixture_unavailable" RENAME TO "CaseEvent";');
  }
  await checkOffline(origin);
  stage = "default-off production rollback with unavailable event table";
  await stopServer();
  process.env.PUBLIC_CASE_RECORDS_ENABLED = "false";
  sql('ALTER TABLE "CaseEvent" RENAME TO "CaseEvent_fixture_unavailable";');
  assert.equal(
    (await getPublicResearchBatch(["fixture-person"])).get("fixture-person")!.availability,
    "withheld"
  );
  assert.equal((await getPublicRedFlagsBatch(["fixture-person"])).get("fixture-person")!.length, 0);
  origin = await startServer(false);
  await checkHttp(origin, false);
  await checkReviewedChat(origin, "withheld");
  await stopServer();
  sql('ALTER TABLE "CaseEvent_fixture_unavailable" RENAME TO "CaseEvent";');
  assert.equal(await db.caseEvent.count({ where: { controversyId: p.record.id } }), 1);
  assert.equal(await db.sourceAttribution.count({ where: { controversyId: p.record.id } }), 2);
  process.stdout.write(
    "Case-review transactions, HTTP, browser offline, and feature rollback verification passed\n"
  );
}

async function main(): Promise<void> {
  try {
    container = docker([
      "run",
      "--rm",
      "-d",
      "--label",
      "bakit-case-review=disposable",
      "--name",
      `case-review-${randomUUID()}`,
      "-p",
      "127.0.0.1::5432",
      "-e",
      "POSTGRES_HOST_AUTH_METHOD=trust",
      "postgres:16",
    ]);
    assert.match(container, /^[a-f0-9]{64}$/);
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        docker(["exec", container, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"]);
        ready = true;
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    assert.ok(ready, "Disposable PostgreSQL did not start");
    const port = docker(["port", container, "5432/tcp"]).split(":").at(-1)!;
    assert.match(port, /^\d+$/);
    verificationUrl = `postgresql://postgres@127.0.0.1:${port}/case_review_verify`;
    docker(["exec", container, "createdb", "-U", "postgres", "case_review_verify"]);
    mkdirSync(path.join(temp, "migrations"));
    for (const entry of readdirSync(path.join(root, "prisma/migrations"), {
      withFileTypes: true,
    })) {
      if (entry.name !== migration)
        cpSync(
          path.join(root, "prisma/migrations", entry.name),
          path.join(temp, "migrations", entry.name),
          { recursive: true }
        );
    }
    cpSync(path.join(root, "prisma/schema.prisma"), path.join(temp, "schema.prisma"));
    writeFileSync(
      path.join(temp, "prisma.config.ts"),
      'import {defineConfig} from "prisma/config"; export default defineConfig({schema:"schema.prisma",migrations:{path:"migrations"},datasource:{url:process.env.DATABASE_URL!}});'
    );
    stage = "preceding migration deployment";
    deploy();
    stage = "legacy fixture seeding";
    sql(`INSERT INTO "Politician" (id,"fullName","firstName","lastName","updatedAt") VALUES ('fixture-person','Synthetic Person','Synthetic','Person',now());
      INSERT INTO "Controversy" (id,"politicianId",title,description,category,status,"updatedAt") VALUES ('fixture-case','fixture-person','Legacy fixture','UNREVIEWED-DO-NOT-PUBLISH','legal_case','convicted',now()),('fixture-other','fixture-person','Other','Other','legal_case','dismissed',now());`);
    sql(`INSERT INTO "SourceAttribution" (id,"sourceType","sourceName","sourceUrl",confidence,"isAIProcessed","fieldName","controversyId") VALUES ('legacy-source','court_document','Synthetic legacy citation',NULL,0.27,true,'controversy','fixture-case');
      UPDATE "Controversy" SET "filingDate"='2001-02-03',"resolutionDate"='2002-04-05',court='Synthetic legacy court',"caseNumber"='LEGACY-1' WHERE id='fixture-case';
      INSERT INTO "RedFlag" (id,"politicianId",type,severity,title,description,"relatedEntityId","relatedEntityType","updatedAt") VALUES ('legacy-legal','fixture-person','legal_case','critical','UNREVIEWED-DO-NOT-PUBLISH','UNREVIEWED-DO-NOT-PUBLISH','fixture-case','Controversy',now()),('legacy-corruption','fixture-person','corruption','critical','UNREVIEWED-DO-NOT-PUBLISH','UNREVIEWED-DO-NOT-PUBLISH',NULL,NULL,now()),('legacy-mislabelled','fixture-person','dynasty','critical','UNREVIEWED-DO-NOT-PUBLISH','UNREVIEWED-DO-NOT-PUBLISH','fixture-case','CoNtRoVeRsY',now());`);
    const oldTables = ["Politician", "Controversy", "SourceAttribution", "RedFlag"];
    const snapshots = oldTables.map((table) => {
      const columns = sql(
        `SELECT string_agg(quote_ident(attname),',' ORDER BY attnum) FROM pg_attribute WHERE attrelid='"${table}"'::regclass AND attnum>0 AND NOT attisdropped;`
      );
      return {
        table,
        columns,
        value: sql(`SELECT row_to_json(x) FROM (SELECT ${columns} FROM "${table}" ORDER BY id) x;`),
      };
    });
    stage = "default-off production on preceding schema";
    const oldOrigin = await startServer(false);
    await checkHttp(oldOrigin, false);
    await checkReviewedChat(oldOrigin, "withheld");
    await stopServer();
    stage = "new migration deployment";
    assert.ok(
      existsSync(path.join(root, "prisma/migrations", migration)),
      "Required case review migration is missing"
    );
    {
      cpSync(
        path.join(root, "prisma/migrations", migration),
        path.join(temp, "migrations", migration),
        { recursive: true }
      );
      deploy();
    }
    stage = "new CaseEvent schema assertion";
    assert.equal(sql('SELECT count(*) FROM "CaseEvent";'), "0");
    for (const snapshot of snapshots) {
      assert.equal(
        sql(
          `SELECT row_to_json(x) FROM (SELECT ${snapshot.columns} FROM "${snapshot.table}" ORDER BY id) x;`
        ),
        snapshot.value,
        `Retained every original ${snapshot.table} column and row`
      );
    }
    sql(`INSERT INTO "Controversy" (id,"politicianId",title,description,category,status,"updatedAt") VALUES ('fixture-draft','fixture-person','Draft','Draft','other',NULL,now());
      INSERT INTO "CaseEvent" (id,"controversyId",kind,summary,"updatedAt") VALUES ('fixture-event','fixture-case','judgment','Synthetic judgment',now());`);
    rejected(`UPDATE "Controversy" SET "outcomeEventId"='fixture-event' WHERE id='fixture-other';`);
    rejected(
      `INSERT INTO "CaseEvent" (id,"controversyId",kind,summary,"appliesToEventId","updatedAt") VALUES ('wrong-target','fixture-other','clemency','Wrong','fixture-event',now());`
    );
    rejected(
      `INSERT INTO "SourceAttribution" (id,"sourceType","sourceName",confidence,"fieldName","controversyId","caseEventId") VALUES ('wrong-source','court_document','Synthetic',0,'caseEvent','fixture-other','fixture-event');`
    );
    rejected(`DELETE FROM "Controversy" WHERE id='fixture-case';`);
    rejected(`UPDATE "Controversy" SET "reviewState"='approved' WHERE id='fixture-case';`);
    assert.equal(
      sql(`SELECT "reviewState" FROM "Controversy" WHERE id='fixture-case';`),
      "pending"
    );
    process.stdout.write("Case-review schema and ownership verification passed\n");
    await checkApplication();
  } finally {
    await cleanup();
  }
}

let cleanupPromise: Promise<void> | undefined;
function cleanup(): Promise<void> {
  return (cleanupPromise ??= (async () => {
    try {
      ownedRedis.cleanup();
    } finally {
      await stopServer();
      await secondPrisma?.$disconnect();
      await appPrisma?.$disconnect();
      if (container) docker(["rm", "-f", container]);
      rmSync(temp, { recursive: true, force: true });
    }
  })());
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
  process.once(signal, () => {
    void cleanup().finally(() => {
      process.exit(signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : 129);
    });
  });
}

main().catch((error: unknown) => {
  // Child-process failures can carry SQL and connection settings; report no raw output.
  process.stderr.write(
    `Case-review verification failed: ${error instanceof assert.AssertionError ? error.message : `owned fixture operation failed at ${stage}: ${error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/g, "[fixture URL redacted]").slice(0, 800) : "unknown error"}`}\n`
  );
  if (error && typeof error === "object" && "stderr" in error) {
    const detail = String(error.stderr)
      .replace(/postgres(?:ql)?:\/\/[^\s]+/g, "[fixture URL redacted]")
      .slice(0, 1200);
    process.stderr.write(detail + "\n");
  }
  process.exitCode = 1;
});
