// Match the Node environment initialized by Next before using its server test helper.
import "next/dist/server/node-environment-baseline";
import { describe, expect, it } from "vitest";
import { unstable_getResponseFromNextConfig } from "next/experimental/testing/server";

// Load the application's real config, including its headers() implementation.
const configPath = "../../next.config.mjs";
const { default: nextConfig } = await import(configPath);

describe("API HTTP cache policy", () => {
  it.each([
    "/api/auth/profile",
    "/api/notifications",
    "/api/admin/ai-config",
    "/api/cron/data-freshness",
    "/api/politicians",
    "/api/export/report.png",
  ])("prevents shared caches from storing responses at %s", async (path) => {
    const response = await unstable_getResponseFromNextConfig({
      url: `https://bakit.example${path}`,
      nextConfig,
    });

    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("retains long-lived caching for versioned static assets", async () => {
    const response = await unstable_getResponseFromNextConfig({
      url: "https://bakit.example/_next/static/chunk.js",
      nextConfig,
    });

    expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
  });
});
