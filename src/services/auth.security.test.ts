import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createHash } from "crypto";

const { user, redis, entries, cookieGet, cookieDelete } = vi.hoisted(() => {
  const entries = new Map<string, string>();
  return {
    entries,
    user: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    redis: {
      get: vi.fn(async (key: string) => entries.get(key) ?? null),
      setex: vi.fn(async (key: string, _ttl: number, value: string) => {
        entries.set(key, value);
        return "OK";
      }),
      del: vi.fn(async (key: string) => Number(entries.delete(key))),
    },
    cookieGet: vi.fn(),
    cookieDelete: vi.fn(),
  };
});
vi.mock("@/lib/prisma", () => ({ default: { user } }));
vi.mock("@/lib/redis", () => ({ redis }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookieGet, delete: cookieDelete }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  entries.clear();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("REDIS_URL", "redis://session-store:6379");
  vi.stubEnv("REDIS_DISABLED", "false");
  user.create.mockResolvedValue({ id: "user-1", isVerified: false });
  user.findUnique.mockResolvedValue({
    id: "user-1",
    isVerified: true,
    verificationMethod: "national_id",
    verifiedAt: new Date(),
  });
  user.update.mockResolvedValue({ id: "user-1" });
  cookieGet.mockReturnValue({ value: "token" });
});
afterEach(() => vi.unstubAllEnvs());

describe("production identity verification", () => {
  it("rejects verification before parsing input or creating a user", async () => {
    const { POST } = await import("@/app/api/auth/verify/route");
    const request = new NextRequest("http://localhost/api/auth/verify", {
      method: "POST",
      body: "invalid json",
    });
    const parse = vi.spyOn(request, "json");
    const response = await POST(request);
    expect(response.status).toBe(503);
    expect(parse).not.toHaveBeenCalled();
    expect(user.create).not.toHaveBeenCalled();
  });

  it("does not accept a plausible fake document through the service", async () => {
    const { verifyUser } = await import("./auth.service");
    const result = await verifyUser({
      userId: "user-1",
      method: "national_id",
      documentNumber: "1234-5678-9012",
    });
    expect(result).toMatchObject({ success: false, isVerified: false, verificationMethod: null });
    expect(user.findUnique).not.toHaveBeenCalled();
    expect(user.update).not.toHaveBeenCalled();
  });

  it("does not carry historical mock verification into a new session", async () => {
    const { createSession } = await import("./auth.service");
    const result = await createSession("user-1");
    expect(result.success).toBe(true);
    expect(result.session).toMatchObject({ isVerified: false, verificationMethod: null });
  });

  it("does not expose historical mock verification as verified user identity", async () => {
    const { getUser } = await import("./auth.service");
    expect(await getUser("user-1")).toMatchObject({
      isVerified: false,
      verificationMethod: null,
      verifiedAt: null,
    });
  });
});

describe("production shared sessions", () => {
  it("validates and revokes sessions across separate service instances", async () => {
    const first = await import("./auth.service");
    const created = await first.createUser();
    expect(created.success).toBe(true);
    vi.resetModules();
    const second = await import("./auth.service");
    const validated = await second.validateSession(created.token!);
    expect(validated.userId).toBe("user-1");
    expect(validated.createdAt).toBeInstanceOf(Date);
    expect(validated.expiresAt).toBeInstanceOf(Date);
    expect(redis.setex).toHaveBeenCalledTimes(1);
    expect(await second.invalidateSession(created.token!)).toBe(true);
    await expect(first.validateSession(created.token!)).rejects.toThrow("Session not found");
  });

  it("stores only a SHA256 token key with a 24-hour TTL", async () => {
    const { createUser } = await import("./auth.service");
    const created = await createUser();
    const [key, ttl, value] = redis.setex.mock.calls[0]!;
    expect(key).toBe(
      `auth:session:v1:${createHash("sha256").update(created.token!).digest("hex")}`
    );
    expect(ttl).toBe(86400);
    expect(value).not.toContain(created.token!);
  });

  it.each(["missing", "disabled"])("fails closed when Redis is %s", async (mode) => {
    const auth = await import("./auth.service");
    vi.stubEnv("NODE_ENV", "test");
    const local = await auth.createUser();
    vi.stubEnv("NODE_ENV", "production");
    if (mode === "missing") {
      vi.stubEnv("REDIS_URL", undefined);
    } else {
      vi.stubEnv("REDIS_DISABLED", "true");
    }
    await expect(auth.validateSession(local.token!)).rejects.toMatchObject({
      code: "AUTH_UNAVAILABLE",
    });
    expect((await auth.createUser()).success).toBe(false);
    expect(redis.get).not.toHaveBeenCalled();
    expect(redis.setex).not.toHaveBeenCalled();
  });

  it("returns authentication unavailable when Redis reads fail", async () => {
    redis.get.mockRejectedValueOnce(new Error("Redis unavailable"));
    const { validateSession } = await import("./auth.service");
    await expect(validateSession("token")).rejects.toMatchObject({ code: "AUTH_UNAVAILABLE" });
  });

  it("does not create a usable session when Redis writes fail", async () => {
    redis.setex.mockRejectedValueOnce(new Error("Redis unavailable"));
    const { createUser } = await import("./auth.service");
    expect(await createUser()).toMatchObject({
      success: false,
      error: "Authentication unavailable",
    });
  });

  it.each([
    "not json",
    JSON.stringify({ userId: "user-1" }),
    JSON.stringify({
      id: "id",
      userId: "user-1",
      isVerified: false,
      verificationMethod: null,
      createdAt: "invalid",
      expiresAt: "invalid",
    }),
  ])("rejects malformed serialized sessions", async (value) => {
    redis.get.mockResolvedValueOnce(value);
    const { validateSession } = await import("./auth.service");
    await expect(validateSession("token")).rejects.toMatchObject({ code: "AUTH_UNAVAILABLE" });
  });

  it("rejects and removes an expired shared session without renewing it", async () => {
    const now = Date.now();
    redis.get.mockResolvedValueOnce(
      JSON.stringify({
        id: "id",
        userId: "user-1",
        isVerified: false,
        verificationMethod: null,
        createdAt: new Date(now - 86400000),
        expiresAt: new Date(now - 1000),
      })
    );
    const { validateSession } = await import("./auth.service");
    await expect(validateSession("expired-token")).rejects.toMatchObject({
      code: "SESSION_EXPIRED",
    });
    expect(redis.del).toHaveBeenCalledWith(
      `auth:session:v1:${createHash("sha256").update("expired-token").digest("hex")}`
    );
    expect(redis.setex).not.toHaveBeenCalled();
  });

  it("does not trust verification flags in stored sessions", async () => {
    const now = new Date();
    redis.get.mockResolvedValueOnce(
      JSON.stringify({
        id: "id",
        userId: "user-1",
        isVerified: true,
        verificationMethod: "national_id",
        createdAt: now,
        expiresAt: new Date(now.getTime() + 86400000),
      })
    );
    const { validateSession } = await import("./auth.service");
    expect(await validateSession("token")).toMatchObject({
      isVerified: false,
      verificationMethod: null,
    });
  });

  it("does not report successful logout when Redis revocation fails", async () => {
    redis.del.mockRejectedValueOnce(new Error("Redis unavailable"));
    const { POST } = await import("@/app/api/auth/logout/route");
    const response = await POST();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ success: false });
    expect(cookieDelete).toHaveBeenCalledWith("auth_token");
  });
});
