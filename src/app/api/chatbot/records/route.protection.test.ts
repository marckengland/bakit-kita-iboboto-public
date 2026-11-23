import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const { evaluate } = vi.hoisted(() => ({ evaluate: vi.fn() }));
vi.mock("@/lib/redis", () => ({ redis: { eval: evaluate } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
import { POST } from "./route";
import { GET } from "../rate-limit/route";
function request(body: unknown = { message: "Synthetic" }, type = "application/json") {
  return new NextRequest("https://example.test/api/chatbot/records", {
    method: "POST",
    headers: { "content-type": type },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("REDIS_URL", "redis://127.0.0.1:1/fixture");
  vi.stubEnv("REDIS_DISABLED", "false");
  vi.stubEnv("PUBLIC_CASE_RECORDS_ENABLED", "false");
  evaluate.mockReset();
  const now = Date.now();
  evaluate.mockResolvedValue([1, 37, (Math.floor(now / 60000) + 1) * 60000, 120, 60000, 0, now]);
});
afterEach(() => {
  vi.unstubAllEnvs();
});
it("refuses oversized chat input before a read or budget reservation", async () => {
  expect((await POST(request({ message: "Synthetic", padding: "x".repeat(17000) }))).status).toBe(
    413
  );
  expect(evaluate).not.toHaveBeenCalled();
});
it("requires a JSON media type", async () => {
  expect((await POST(request(undefined, "text/plain"))).status).toBe(415);
});
it("fails closed when the shared production budget is unavailable", async () => {
  evaluate.mockRejectedValue(new Error("Unavailable"));
  expect((await POST(request())).status).toBe(503);
});
it("returns the shared production budget rather than a process-local counter", async () => {
  const result = await POST(request());
  expect(result.status).toBe(200);
  expect((await result.json()).rateLimitStatus.remaining).toBe(37);
});
it("uses the shared read-only budget for the status endpoint", async () => {
  const result = await GET(new NextRequest("https://example.test/api/chatbot/rate-limit"));
  expect(result.status).toBe(200);
  expect((await result.json()).rateLimitStatus).toMatchObject({
    remaining: 37,
    maxRequests: 120,
    windowMs: 60000,
  });
  expect(evaluate.mock.calls[0]?.[4]).toBe(0);
});
