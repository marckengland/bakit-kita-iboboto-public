import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { create, validateSession } = vi.hoisted(() => ({
  create: vi.fn(async (args: { data: unknown }) => ({ id: "feedback-test", ...args.data! })),
  validateSession: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { feedback: { create } } }));
vi.mock("@/services/auth.service", () => ({ validateSession }));
import { POST } from "./route";

const valid = {
  category: "general_feedback",
  subject: "A correction",
  description: "Please check this record.",
  isAnonymous: false,
};
function request(body: unknown = valid, headers: Record<string, string> = {}) {
  return new NextRequest("https://example.test/api/feedback", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  create.mockClear();
  validateSession.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("feedback submission protections", () => {
  it("does not attribute a caller-supplied user header to an account", async () => {
    const result = await POST(request(valid, { "x-user-id": "another-person" }));
    expect(result.status).toBe(200);
    expect(create.mock.calls[0]?.[0].data).toMatchObject({ userId: null });
  });
  it("uses a validated session instead of the supplied user header", async () => {
    validateSession.mockResolvedValue({ userId: "session-owner" });
    const result = await POST(
      request(valid, { cookie: "auth_token=synthetic-token", "x-user-id": "another-person" })
    );
    expect(result.status).toBe(200);
    expect(create.mock.calls[0]?.[0].data).toMatchObject({ userId: "session-owner" });
  });
  it("keeps invalid sessions anonymous", async () => {
    validateSession.mockRejectedValue(new Error("Expired"));
    expect((await POST(request(valid, { cookie: "auth_token=expired" }))).status).toBe(200);
    expect(create.mock.calls[0]?.[0].data).toMatchObject({ userId: null });
  });
  it("ignores untrusted forwarded IP metadata", async () => {
    expect((await POST(request(valid, { "x-forwarded-for": "198.51.100.1" }))).status).toBe(200);
    expect(create.mock.calls[0]?.[0].data).toMatchObject({ ipAddress: null });
  });
  it("refuses a streamed oversized body before a database write", async () => {
    const response = await POST(request({ ...valid, padding: "x".repeat(2 * 1024 * 1024) }));
    expect(response.status).toBe(413);
    expect(create).not.toHaveBeenCalled();
  });
  it.each([
    null,
    { name: "a.html", type: "text/html", dataUrl: "data:text/html;base64,PHNjcmlwdD4=" },
    { name: "a.png", type: "image/png", dataUrl: "data:image/jpeg;base64,YQ==" },
    { name: "a.png", type: "image/png", dataUrl: "data:image/png;base64,???" },
    { name: "a.png", type: "image/png", dataUrl: 4 },
    {
      name: "a.png",
      type: "image/png",
      dataUrl: "data:image/png;base64," + Buffer.alloc(256 * 1024 + 1).toString("base64"),
    },
  ])("rejects malformed, unsupported or oversized attachment %#", async (attachment) => {
    const response = await POST(request({ ...valid, attachments: [attachment] }));
    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });
  it("accepts a bounded attachment without changing submission behavior", async () => {
    const attachment = {
      name: "sample.png",
      type: "image/png",
      dataUrl: "data:image/png;base64,iVBORw0KGgo=",
    };
    expect((await POST(request({ ...valid, attachments: [attachment] }))).status).toBe(200);
    expect(create.mock.calls[0]?.[0].data).toMatchObject({
      attachments: JSON.stringify([attachment]),
    });
  });
  it("ends a stalled body read after five seconds", async () => {
    vi.useFakeTimers();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("{"));
      },
    });
    const req = new NextRequest(
      new Request("https://example.test/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        duplex: "half",
      } as RequestInit)
    );
    const response = POST(req).then((r) => r.status);
    await vi.advanceTimersByTimeAsync(5001);
    expect(await Promise.race([response, Promise.resolve("still reading")])).toBe(408);
    expect(create).not.toHaveBeenCalled();
    await body.cancel().catch(() => undefined);
  });
});
