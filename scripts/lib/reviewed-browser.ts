import assert from "node:assert/strict";
import type { Browser, Locator, Page } from "playwright";
import { verificationEnv } from "./verification-runtime";

export const READINESS_TIMEOUT_MS = 30_000;

/** Use the installed, locked Chrome without downloading a browser or calling an API. */
export async function launchReviewedBrowser(): Promise<Browser> {
  const [{ chromium }, { default: puppeteer }] = await Promise.all([
    import("playwright"),
    import("puppeteer"),
  ]);
  return chromium.launch({
    headless: true,
    // The verifier owns signal cleanup for the browser, server and database together.
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false,
    env: verificationEnv(""),
    executablePath: await puppeteer.executablePath(),
    args: ["--no-sandbox"],
  });
}

export async function waitForVisibleText(
  page: Page,
  text: string,
  timeout = READINESS_TIMEOUT_MS,
  scope: Locator = page.locator("body")
): Promise<void> {
  assert.ok(timeout > 0 && timeout <= READINESS_TIMEOUT_MS, "Readiness deadline must be bounded");
  const completeText = new RegExp("\\b" + text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b");
  await scope.getByText(completeText).first().waitFor({ state: "visible", timeout });
  assert.ok(await page.evaluate((expected) => document.body.innerText.includes(expected), text));
}

/** These controls run in an intercepted .test fixture, not in application records. */
export async function verifyReadinessBoundary(browser: Browser): Promise<void> {
  const context = await browser.newContext();
  try {
    await context.route("http://browser-fixture.test/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: route.request().url().endsWith("/ready")
          ? "<p>Scheduled term end</p>"
          : "<p>Different label</p>",
      })
    );
    const page = await context.newPage();
    await page.goto("http://browser-fixture.test/start");
    await assert.rejects(waitForVisibleText(page, "Scheduled term end", 150), {
      name: "TimeoutError",
    });
    const ready = waitForVisibleText(page, "Scheduled term end");
    await page.goto("http://browser-fixture.test/ready");
    await ready;
    assert.ok(await page.evaluate(() => document.body.innerText.includes("Scheduled term end")));
    await page.locator("p").evaluate((element) => {
      element.textContent = "Changed term label";
    });
    await assert.rejects(waitForVisibleText(page, "Scheduled term end", 150), {
      name: "TimeoutError",
    });
    for (const [actual, expected] of [
      ["Scheduled term ending", "Scheduled term end"],
      ["RA-123250", "RA-12325"],
    ]) {
      await page.locator("p").evaluate((element, value) => {
        element.textContent = value;
      }, actual);
      await assert.rejects(waitForVisibleText(page, expected!, 150), { name: "TimeoutError" });
    }
    await page.setContent(
      '<section id="outside">Scheduled term end</section><section id="expected"><p>Different label</p></section>'
    );
    await assert.rejects(
      waitForVisibleText(page, "Scheduled term end", 150, page.locator("#expected")),
      { name: "TimeoutError" }
    );
    assert.equal(READINESS_TIMEOUT_MS, 30_000);
  } finally {
    await context.close();
  }
}
