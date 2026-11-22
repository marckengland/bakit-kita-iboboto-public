import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { POST } from "./route";
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
let client = 0;
function request(body: unknown, raw = false) {
  return new NextRequest("https://example.test/api/chatbot/records", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": `198.51.100.${++client}` },
    body: raw ? String(body) : JSON.stringify(body),
  });
}
beforeEach(() => vi.stubEnv("PUBLIC_CASE_RECORDS_ENABLED", "false"));
afterEach(() => vi.unstubAllEnvs());
it("returns a noncached withheld answer without requiring an AI key", async () => {
  vi.stubEnv("GOOGLE_AI_API_KEY", "");
  const response = await POST(request({ message: "Synthetic" }));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  const data = await response.json();
  expect(data.answer.status).toBe("withheld");
  expect(data.answer.records).toEqual([]);
  expect(data.rateLimitStatus.remaining).toBeGreaterThanOrEqual(0);
  expect(data).not.toHaveProperty("conversationId");
  expect(prisma.user.create).not.toHaveBeenCalled();
});
it.each([
  null,
  [],
  {},
  { message: " " },
  { message: 4 },
  { message: "x".repeat(2001) },
  { message: "Synthetic", politicianId: [] },
  { message: "Synthetic", politicianId: "" },
  { message: "Synthetic", politicianId: "x".repeat(201) },
])("rejects invalid input %#", async (body) => {
  const response = await POST(request(body));
  expect(response.status).toBe(400);
  expect(response.headers.get("cache-control")).toContain("no-store");
});
it("reports malformed JSON as a client error", async () => {
  expect((await POST(request("{", true))).status).toBe(400);
});
it("uses the same public projection when a profile is selected", async () => {
  vi.stubEnv("PUBLIC_CASE_RECORDS_ENABLED", "true");
  vi.mocked(prisma.politician.findFirst).mockResolvedValue({
    id: "person-1",
    fullName: "Synthetic Person",
  } as never);
  vi.mocked(prisma.controversy.findMany).mockResolvedValue([]);
  const response = await POST(
    request({ message: "cases", politicianId: "person-1", conversationId: "ignored" })
  );
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.answer.status).toBe("no_reviewed_records");
  expect(data.answer.profile.fullName).toBe("Synthetic Person");
  expect(data.answer.records).toEqual([]);
});
it("rate limits repeat requests without storing conversation history", async () => {
  const req = () =>
    new NextRequest("https://example.test/api/chatbot/records", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "198.51.100.250" },
      body: JSON.stringify({ message: "Synthetic" }),
    });
  let response = await POST(req());
  for (let n = 0; n < 30 && response.status !== 429; n++) {
    response = await POST(req());
  }
  expect(response.status).toBe(429);
  expect((await response.json()).rateLimitStatus.remaining).toBe(0);
});
