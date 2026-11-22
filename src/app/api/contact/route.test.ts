import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { evaluate, send } = vi.hoisted(() => ({ evaluate: vi.fn(), send: vi.fn() }));
vi.mock("@/lib/redis", () => ({ redis: { eval: evaluate } }));

import { POST } from "./route";
import { privateContactAvailable } from "@/lib/private-contact";

const origin = "https://civic.example.test";
const input = {
  requestId: "b8b428b2-1daa-4c92-8c94-a3c2a64c9416",
  category: "correction",
  message: "Please review the linked fixture source.",
  profileUrl: "https://example.test/profile",
  replyEmail: "reader@example.test",
};

function request(value: unknown = input, headers: Record<string, string> = {}) {
  return new Request(`${origin}/api/contact`, {
    method: "POST",
    headers: { origin, "content-type": "application/json", ...headers },
    body: JSON.stringify(value),
  });
}

describe("private contact delivery", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("PRIVATE_CONTACT_ENABLED", "true");
    vi.stubEnv("PRIVATE_CONTACT_ORIGIN", origin);
    vi.stubEnv("PRIVATE_CONTACT_FROM", "Project <reports@example.test>");
    vi.stubEnv("PRIVATE_CONTACT_TO", "maintainer@example.test");
    vi.stubEnv("RESEND_API_KEY", "mail-key-fixture");
    vi.stubEnv("REDIS_URL", "redis://127.0.0.1:1/fixture");
    vi.stubEnv("REDIS_DISABLED", "false");
    vi.stubGlobal("fetch", send);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    evaluate.mockResolvedValue(1);
    send.mockResolvedValue(Response.json({ id: "accepted-fixture" }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([
    ["PRIVATE_CONTACT_ENABLED", "false"],
    ["PRIVATE_CONTACT_ORIGIN", ""],
    ["PRIVATE_CONTACT_ORIGIN", "http://public.example.test"],
    ["PRIVATE_CONTACT_FROM", ""],
    ["PRIVATE_CONTACT_TO", ""],
    ["RESEND_API_KEY", ""],
    ["REDIS_URL", ""],
    ["REDIS_DISABLED", "true"],
  ])("stays unavailable when %s is not configured safely", async (name, value) => {
    vi.stubEnv(name, value);
    expect(privateContactAvailable()).toBe(false);
    expect((await POST(request())).status).toBe(503);
    expect(evaluate).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("sends plain text only to the configured inbox and exposes no address or key", async () => {
    expect(privateContactAvailable()).toBe(true);
    const response = await POST(request());
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(send).toHaveBeenCalledTimes(1);
    const [url, options] = send.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(options.headers.Authorization).toBe("Bearer mail-key-fixture");
    expect(options.headers["Idempotency-Key"]).toBe(`private-contact/${input.requestId}`);
    expect(options.signal).toBeInstanceOf(AbortSignal);
    const email = JSON.parse(options.body);
    expect(email.to).toEqual(["maintainer@example.test"]);
    expect(email.from).toBe("Project <reports@example.test>");
    expect(email.reply_to).toBe(input.replyEmail);
    expect(email.text).toContain(input.message);
    expect(email.text).toContain(input.profileUrl);
    expect(email).not.toHaveProperty("html");
    expect(email).not.toHaveProperty("attachments");
    expect(console.error).not.toHaveBeenCalled();
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(evaluate.mock.calls[0]![2]).toMatch(/^private-contact:v1:\d+$/);
  });

  it("allows a private report without a reply address or link", async () => {
    const { replyEmail: _reply, profileUrl: _url, ...anonymous } = input;
    expect((await POST(request(anonymous))).status).toBe(202);
    expect(JSON.parse(send.mock.calls[0]![1].body)).not.toHaveProperty("reply_to");
  });

  it("uses the same provider retry key for an unchanged resubmission", async () => {
    await POST(request());
    await POST(request());
    expect(send.mock.calls.map((call) => call[1].headers["Idempotency-Key"])).toEqual([
      `private-contact/${input.requestId}`,
      `private-contact/${input.requestId}`,
    ]);
  });

  it.each(["https://other.example.test", "null", ""])(
    "rejects an invalid browser origin: %s",
    async (value) => {
      expect((await POST(request(input, { origin: value }))).status).toBe(403);
      expect(send).not.toHaveBeenCalled();
      expect(evaluate).not.toHaveBeenCalled();
    }
  );

  it("rejects a missing origin and non-JSON content type", async () => {
    const noOrigin = request();
    noOrigin.headers.delete("origin");
    expect((await POST(noOrigin)).status).toBe(403);
    expect((await POST(request(input, { "content-type": "text/plain" }))).status).toBe(415);
    expect(send).not.toHaveBeenCalled();
  });

  it.each([
    null,
    [],
    { ...input, category: "publish_this" },
    { ...input, requestId: "invalid" },
    { ...input, message: "short" },
    { ...input, message: "x".repeat(4001) },
    { ...input, replyEmail: "not-an-email" },
    { ...input, replyEmail: "reader@example.test\r\nBcc: stranger@example.test" },
    { ...input, replyEmail: [] },
    { ...input, profileUrl: "javascript:alert(1)" },
    { ...input, to: "stranger@example.test" },
    { ...input, attachments: ["unsupported"] },
  ])("rejects invalid or unsupported fields without reserving mail budget", async (value) => {
    expect((await POST(request(value))).status).toBe(400);
    expect(evaluate).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON", async () => {
    const response = await POST(
      new Request(`${origin}/api/contact`, {
        method: "POST",
        headers: { origin, "content-type": "application/json" },
        body: "{",
      })
    );
    expect(response.status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it("bounds streamed bytes even when content-length is absent or false", async () => {
    for (const length of [undefined, "1", "20000"]) {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(" ".repeat(17000)));
          controller.close();
        },
      });
      const response = await POST(
        new Request(`${origin}/api/contact`, {
          method: "POST",
          headers: {
            origin,
            "content-type": "application/json",
            ...(length ? { "content-length": length } : {}),
          },
          body: stream,
          ...{ duplex: "half" },
        })
      );
      expect(response.status).toBe(413);
    }
    expect(send).not.toHaveBeenCalled();
  });

  it("enforces a shared send budget and returns a retry hint", async () => {
    evaluate.mockResolvedValue(21);
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("bounds the time spent reading a stalled request body", async () => {
    vi.useFakeTimers();
    const response = POST(
      new Request(`${origin}/api/contact`, {
        method: "POST",
        headers: { origin, "content-type": "application/json" },
        body: new ReadableStream(),
        ...{ duplex: "half" },
      })
    );
    await vi.advanceTimersByTimeAsync(5001);
    expect((await response).status).toBe(408);
    expect(send).not.toHaveBeenCalled();
  });

  it("fails closed if the shared budget is unavailable", async () => {
    evaluate.mockRejectedValue(new Error("private redis connection details"));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private redis");
    expect(send).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith("Private contact rate limit unavailable");
  });

  it("bounds an established Redis connection that stops answering", async () => {
    vi.useFakeTimers();
    evaluate.mockImplementation(() => new Promise(() => undefined));
    let response: Response | undefined;
    void POST(request()).then((result) => {
      response = result;
    });
    await vi.advanceTimersByTimeAsync(3001);
    expect(response?.status).toBe(503);
    expect(send).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith("Private contact rate limit unavailable");
  });

  it.each([400, 429, 500])("does not expose a provider failure body (%s)", async (status) => {
    send.mockResolvedValue(new Response("private provider response", { status }));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private provider response");
    expect(console.error).toHaveBeenCalledWith("Private contact delivery failed", { status });
  });

  it("handles network failures without logging private data", async () => {
    send.mockRejectedValue(new Error("private message and credentials"));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private message");
    expect(console.error).toHaveBeenCalledWith("Private contact delivery unavailable");
  });

  it("does not claim acceptance without a valid provider message ID", async () => {
    send.mockResolvedValue(Response.json({ error: "missing ID" }));
    expect((await POST(request())).status).toBe(503);
  });
});
