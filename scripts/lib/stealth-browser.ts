import type { Browser, LaunchOptions } from "puppeteer";

/** Launch a separate browser using the explicitly loaded Puppeteer 25 engine. */
export async function launchStealthBrowser(options: LaunchOptions = {}): Promise<Browser> {
  // Load the ESM engine before the legacy loader attempts its own require().
  const { default: vanilla } = await import("puppeteer");
  const { addExtra } = await import("puppeteer-extra");
  const { default: StealthPlugin } = await import("puppeteer-extra-plugin-stealth");
  const puppeteer = addExtra(vanilla);
  puppeteer.use(StealthPlugin());
  return puppeteer.launch(options);
}
