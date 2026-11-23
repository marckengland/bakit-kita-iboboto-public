import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
afterEach(() => vi.unstubAllEnvs());

it.each([
  "/api/auth/verify",
  "/api/bookmarks",
  "/api/voting-list",
  "/api/notifications",
  "/api/reports/inaccuracy",
  "/api/chatbot",
  "/api/cron/data-freshness",
])("keeps unsupported production endpoint %s closed", async (path) => {
  vi.stubEnv("NODE_ENV", "production");
  const response = await proxy(new NextRequest(`https://example.test${path}`, { method: "POST" }));
  expect(response.status).toBe(404);
});
it.each([
  "/api/chatbot/records",
  "/api/chatbot/rate-limit",
  "/api/contact",
  "/api/feedback",
  "/api/politicians",
  "/api/compare",
])("preserves the guest pilot route %s", async (path) => {
  vi.stubEnv("NODE_ENV", "production");
  const response = await proxy(new NextRequest(`https://example.test${path}`));
  expect(response.headers.get("x-middleware-next")).toBe("1");
});
it("preserves development account routes", async () => {
  vi.stubEnv("NODE_ENV", "development");
  expect(
    (await proxy(new NextRequest("https://example.test/api/auth/verify"))).headers.get(
      "x-middleware-next"
    )
  ).toBe("1");
});

it("retains only the authenticated read-only session probe from account routes", async () => {
  vi.stubEnv("NODE_ENV", "production");
  const url = "https://example.test/api/auth/profile";
  expect((await proxy(new NextRequest(url))).headers.get("x-middleware-next")).toBe("1");
  expect((await proxy(new NextRequest(url, { method: "POST" }))).status).toBe(404);
});
