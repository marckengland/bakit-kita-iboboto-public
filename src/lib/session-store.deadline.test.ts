import { afterEach, expect, it, vi } from "vitest";
const { pending } = vi.hoisted(() => ({
  pending: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock("@/lib/redis", () => ({ redis: { get: pending, setex: pending, del: pending } }));
import { readSharedSession, writeSharedSession, revokeSharedSession } from "./session-store";
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
it.each(["read", "write", "revoke"] as const)("bounds a stalled Redis session %s", async (mode) => {
  vi.useFakeTimers();
  vi.stubEnv("REDIS_URL", "redis://127.0.0.1:1/fixture");
  vi.stubEnv("REDIS_DISABLED", "false");
  const operation =
    mode === "read"
      ? readSharedSession("synthetic-token")
      : mode === "revoke"
        ? revokeSharedSession("synthetic-token")
        : writeSharedSession("synthetic-token", {
            id: "session",
            userId: "person",
            isVerified: false,
            verificationMethod: null,
            createdAt: new Date("2026-11-23T00:00:00Z"),
            expiresAt: new Date("2026-11-24T00:00:00Z"),
          });
  const result = operation.then(
    () => "accepted",
    (error: Error) => error.message
  );
  await vi.advanceTimersByTimeAsync(3001);
  expect(await Promise.race([result, Promise.resolve("still waiting")])).toBe(
    "Authentication unavailable"
  );
});
