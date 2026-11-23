import { describe, expect, it } from "vitest";
import { assertRedisOwnership, OwnedVerificationRedis } from "../../scripts/lib/verification-redis";

const owner = {
  token: "b5f3e643-1357-43fb-8d78-cbe05a07bd8a",
  name: "bkib-verification-redis-b5f3e643-1357-43fb-8d78-cbe05a07bd8a",
  id: "a".repeat(64),
};
const container = {
  Id: owner.id,
  Name: `/${owner.name}`,
  Config: {
    Labels: { "bkib-verification-redis": "disposable", "bkib-verification-owner": owner.token },
  },
};

describe("owned verification Redis", () => {
  it("requires the exact container ID, name, purpose, and owner before use or removal", () => {
    expect(() => assertRedisOwnership(container, owner)).not.toThrow();
    for (const changed of [
      { ...container, Id: "b".repeat(64) },
      { ...container, Name: "/existing-redis" },
      { ...container, Config: { Labels: {} } },
      {
        ...container,
        Config: { Labels: { ...container.Config.Labels, "bkib-verification-redis": "persistent" } },
      },
      {
        ...container,
        Config: {
          Labels: { ...container.Config.Labels, "bkib-verification-owner": "other-owner" },
        },
      },
    ]) {
      expect(() => assertRedisOwnership(changed, owner)).toThrow(/unowned Redis/);
    }
  });

  it("allows cleanup before startup and refuses to create a resource after cleanup", async () => {
    const fixture = new OwnedVerificationRedis();
    fixture.cleanup();
    fixture.cleanup();
    await expect(fixture.start()).rejects.toThrow(/closed/);
  });
});
