import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({ eval: vi.fn(), present: true }));
vi.mock("@/lib/redis", () => ({
  get redis() {
    return boundary.present ? { eval: boundary.eval } : null;
  },
}));

import {
  getPublicRequestBudget,
  PublicBudgetUnavailableError,
  reservePublicRequest,
  trustedClientIp,
} from "./public-request-budget";

const request = (headers?: HeadersInit) => new Request("https://example.test", { headers });
const now = Date.UTC(2026, 10, 23, 12, 0, 0);
const reply = (overrides: number[] = []) => {
  const values = [1, 4, now + 60_000, 5, 60_000, 0, now];
  overrides.forEach((value, index) => (values[index] = value));
  return values;
};

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("REDIS_URL", "redis://localhost:6379");
  vi.stubEnv("REDIS_DISABLED", "false");
  vi.stubEnv("PUBLIC_CLIENT_IP_HEADER", "");
  boundary.present = true;
  boundary.eval.mockReset().mockResolvedValue(reply());
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("public request budgets", () => {
  it.each(["development", "test"])("does not consume in %s", async (environment) => {
    vi.stubEnv("NODE_ENV", environment);
    expect(await reservePublicRequest(request(), "feedback")).toBeNull();
    expect(await getPublicRequestBudget(request(), "feedback")).toBeNull();
    expect(boundary.eval).not.toHaveBeenCalled();
  });

  it.each(["missing URL", "disabled", "missing client"])(
    "fails closed with %s",
    async (failure) => {
      if (failure === "missing URL") {
        vi.stubEnv("REDIS_URL", "");
      }
      if (failure === "disabled") {
        vi.stubEnv("REDIS_DISABLED", "true");
      }
      if (failure === "missing client") {
        boundary.present = false;
      }
      await expect(reservePublicRequest(request(), "feedback")).rejects.toThrow(
        PublicBudgetUnavailableError
      );
      expect(boundary.eval).not.toHaveBeenCalled();
    }
  );

  it("reserves globally without trusting forwarded headers", async () => {
    const result = await reservePublicRequest(
      request({ "x-forwarded-for": "192.0.2.1" }),
      "feedback"
    );
    expect(result).toEqual({
      allowed: true,
      remaining: 4,
      resetAt: new Date(now + 60_000),
      isBlocked: false,
      maxRequests: 5,
      windowMs: 60_000,
    });
    const [, count, ...args] = boundary.eval.mock.calls[0]!;
    expect(count).toBe(2);
    expect(args.slice(0, 2)).toEqual([
      "public-budget:{feedback}:minute",
      "public-budget:{feedback}:hour",
    ]);
    expect(args.slice(2)).toEqual([1, 5, 20]);
    expect(JSON.stringify(args)).not.toContain("192.0.2.1");
  });

  it.each([
    ["records", 120, 1200, 20, 100],
    ["feedback", 5, 20, 5, 5],
    ["assistant", 10, 100, 20, 100],
  ] as const)(
    "uses the %s global and client caps",
    async (scope, minute, hour, anonymous, authenticated) => {
      boundary.eval.mockResolvedValue([1, minute - 1, now + 60_000, minute, 60_000, 0, now]);
      vi.stubEnv("PUBLIC_CLIENT_IP_HEADER", "x-real-ip");
      await reservePublicRequest(request({ "x-real-ip": "192.0.2.1" }), scope);
      expect(boundary.eval.mock.lastCall?.slice(-4)).toEqual([1, minute, hour, anonymous]);
      await reservePublicRequest(request(), scope, "verified-user");
      expect(boundary.eval.mock.lastCall?.slice(-4)).toEqual([1, minute, hour, authenticated]);
      expect(JSON.stringify(boundary.eval.mock.calls)).not.toContain("verified-user");
      expect(JSON.stringify(boundary.eval.mock.calls)).not.toContain("192.0.2.1");
    }
  );

  it("reads status without reserving", async () => {
    await getPublicRequestBudget(request(), "feedback");
    expect(boundary.eval.mock.lastCall?.slice(-3)).toEqual([0, 5, 20]);
  });

  it("distinguishes the accepted last request from later blocked requests", async () => {
    boundary.eval.mockResolvedValue(reply([1, 0, now + 60_000, 5, 60_000, 1]));
    expect(await reservePublicRequest(request(), "feedback")).toMatchObject({
      allowed: true,
      isBlocked: true,
      remaining: 0,
    });
    boundary.eval.mockResolvedValue(reply([0, 0, now + 60_000, 5, 60_000, 1]));
    expect(await getPublicRequestBudget(request(), "feedback")).toMatchObject({
      allowed: false,
      isBlocked: true,
      remaining: 0,
    });
  });

  it.each([
    null,
    [],
    [1, 4],
    [1, -1, now + 60_000, 5, 60_000, 0, now],
    [1, 4, now - 1, 5, 60_000, 0, now],
    [1, 4, now + 60_001, 5, 60_000, 0, now],
    [1, 4, now + 60_000, 999, 60_000, 0, now],
    [1, 0, now + 60_000, 5, 60_000, 0, now],
    [1, 4, now + 60_000, 5, 60_000, 0, NaN],
    [1, 4, 9_000_000_000_000_000, 5, 60_000, 0, 8_999_999_999_999_999],
  ])("rejects malformed Redis reply %j", async (value) => {
    boundary.eval.mockResolvedValue(value);
    await expect(reservePublicRequest(request(), "feedback")).rejects.toThrow(
      "Public request budget unavailable"
    );
  });

  it("hides Redis error contents", async () => {
    boundary.eval.mockRejectedValue(new Error("redis://secret:password@private-host"));
    await expect(reservePublicRequest(request(), "feedback")).rejects.toThrow(
      /^Public request budget unavailable$/
    );
  });

  it("fails closed within a three-second Redis deadline", async () => {
    vi.useFakeTimers();
    boundary.eval.mockImplementation(() => new Promise(() => {}));
    const check = expect(reservePublicRequest(request(), "feedback")).rejects.toThrow(
      PublicBudgetUnavailableError
    );
    await vi.advanceTimersByTimeAsync(3000);
    await check;
  });
});

describe("explicitly trusted ingress IP", () => {
  it("does not trust headers without configuration or support arbitrary configuration", () => {
    expect(trustedClientIp(request({ "x-real-ip": "192.0.2.1" }))).toBeNull();
    vi.stubEnv("PUBLIC_CLIENT_IP_HEADER", "x-forwarded-for");
    expect(trustedClientIp(request({ "x-forwarded-for": "192.0.2.1" }))).toBeNull();
  });

  it.each(["x-vercel-forwarded-for", "cf-connecting-ip", "x-real-ip"])(
    "accepts a single validated IP from configured %s",
    (header) => {
      vi.stubEnv("PUBLIC_CLIENT_IP_HEADER", header);
      expect(trustedClientIp(request({ [header]: "192.0.2.1" }))).toBe("192.0.2.1");
      expect(trustedClientIp(request({ [header]: "2001:db8::1" }))).toBe("2001:db8::1");
    }
  );

  it.each(["192.0.2.1, 192.0.2.2", "garbage", "192.0.2.1:80", "[2001:db8::1]", "999.0.2.1"])(
    "rejects %s",
    (value) => {
      vi.stubEnv("PUBLIC_CLIENT_IP_HEADER", "x-real-ip");
      expect(trustedClientIp(request({ "x-real-ip": value }))).toBeNull();
    }
  );
});
