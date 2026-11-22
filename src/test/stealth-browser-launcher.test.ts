import { beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  vanilla: { launch: vi.fn() },
  launch: vi.fn(),
  use: vi.fn(),
  addExtra: vi.fn(),
  plugin: vi.fn(),
}));
vi.mock("puppeteer", () => ({ default: boundary.vanilla }));
vi.mock("puppeteer-extra", () => ({ addExtra: boundary.addExtra }));
vi.mock("puppeteer-extra-plugin-stealth", () => ({ default: boundary.plugin }));

import { launchStealthBrowser } from "../../scripts/lib/stealth-browser";

beforeEach(() => {
  vi.resetAllMocks();
  boundary.addExtra.mockReturnValue({ launch: boundary.launch, use: boundary.use });
  boundary.plugin.mockReturnValue({ name: "stealth" });
});

describe("legacy stealth browser launcher", () => {
  it("uses the explicitly imported engine and registers stealth before launch", async () => {
    const browser = { close: vi.fn() };
    boundary.launch.mockResolvedValue(browser);
    const result = await launchStealthBrowser({ headless: true });

    expect(boundary.addExtra).toHaveBeenCalledWith(boundary.vanilla);
    expect(boundary.use).toHaveBeenCalledWith({ name: "stealth" });
    expect(boundary.use.mock.invocationCallOrder[0]).toBeLessThan(
      boundary.launch.mock.invocationCallOrder[0]!
    );
    expect(result).toBe(browser);
    expect(browser.close).not.toHaveBeenCalled();
  });

  it("preserves caller browser options", async () => {
    const options = {
      headless: false as const,
      args: ["--window-size=1920,1080"],
      defaultViewport: { width: 1920, height: 1080 },
    };
    await launchStealthBrowser(options);
    expect(boundary.launch).toHaveBeenCalledWith(options);
    expect(boundary.launch.mock.calls[0]?.[0]).toBe(options);
  });

  it("creates a new plugin instance for each recycled browser", async () => {
    const first = { name: "stealth-first" };
    const second = { name: "stealth-second" };
    boundary.plugin.mockReturnValueOnce(first).mockReturnValueOnce(second);
    await launchStealthBrowser({ headless: true });
    await launchStealthBrowser({ headless: true });
    expect(boundary.addExtra).toHaveBeenCalledTimes(2);
    expect(boundary.use).toHaveBeenNthCalledWith(1, first);
    expect(boundary.use).toHaveBeenNthCalledWith(2, second);
  });

  it("propagates browser startup failure to the existing caller error handler", async () => {
    const failure = new Error("Browser startup failed");
    boundary.launch.mockRejectedValue(failure);
    await expect(launchStealthBrowser({ headless: true })).rejects.toBe(failure);
  });
});
