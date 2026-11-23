import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { verificationEnv } from "./verification-runtime";

type Owner = { token: string; name: string; id: string };
type Container = {
  Id: string;
  Name: string;
  Config: { Labels?: Record<string, string> | null };
};

export function assertRedisOwnership(container: Container, owner: Owner): void {
  assert.ok(
    /^[a-f0-9]{64}$/.test(container.Id) &&
      (!owner.id || owner.id === container.Id) &&
      container.Name === `/${owner.name}` &&
      container.Config.Labels?.["bkib-verification-redis"] === "disposable" &&
      container.Config.Labels?.["bkib-verification-owner"] === owner.token,
    "Refuse to use or remove an unowned Redis container"
  );
}

/** Call cleanup from the verifier's existing finally and signal handlers. */
export class OwnedVerificationRedis {
  private readonly owner: Owner;
  private requested = false;
  private closed = false;
  private cleaned = false;
  private starting: Promise<string> | undefined;

  constructor() {
    const token = randomUUID();
    this.owner = { token, name: `bkib-verification-redis-${token}`, id: "" };
  }

  async start(): Promise<string> {
    assert.ok(!this.closed, "Redis verification fixture is closed");
    return (this.starting ??= this.launch());
  }

  private command(args: string[]): string {
    assert.ok(!this.closed, "Redis verification fixture is closed");
    const result = spawnSync("docker", args, {
      encoding: "utf8",
      env: verificationEnv(""),
      timeout: 30_000,
    });
    assert.equal(result.status, 0, "Owned Redis fixture command failed");
    return result.stdout.trim();
  }

  private verifyOwner(): void {
    const [container] = JSON.parse(this.command(["inspect", this.owner.name]));
    assertRedisOwnership(container, this.owner);
  }

  private async launch(): Promise<string> {
    try {
      this.requested = true;
      this.owner.id = this.command([
        "run",
        "--rm",
        "-d",
        "--name",
        this.owner.name,
        "--label",
        "bkib-verification-redis=disposable",
        "--label",
        `bkib-verification-owner=${this.owner.token}`,
        "-p",
        "127.0.0.1::6379",
        "redis:7",
        "redis-server",
        "--save",
        "",
        "--appendonly",
        "no",
      ]);
      assert.match(this.owner.id, /^[a-f0-9]{64}$/);
      this.verifyOwner();
      let ready = false;
      for (let attempt = 0; attempt < 60; attempt++) {
        assert.ok(!this.closed, "Redis verification fixture is closed");
        const ping = spawnSync(
          "docker",
          ["exec", this.owner.id, "redis-cli", "-h", "127.0.0.1", "PING"],
          {
            encoding: "utf8",
            env: verificationEnv(""),
            timeout: 2_000,
          }
        );
        if (ping.status === 0 && ping.stdout.trim() === "PONG") {
          ready = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert.ok(ready, "Owned Redis did not become ready");
      this.verifyOwner();
      const published = this.command(["port", this.owner.id, "6379/tcp"]);
      assert.match(published, /^127\.0\.0\.1:\d+$/);
      return `redis://${published}`;
    } catch (error) {
      this.cleanup();
      throw error;
    }
  }

  cleanup(): void {
    this.closed = true;
    if (this.cleaned) return;
    if (this.requested) {
      const found = spawnSync("docker", ["inspect", this.owner.name], {
        encoding: "utf8",
        env: verificationEnv(""),
        timeout: 10_000,
      });
      if (found.status === 0) {
        const [container] = JSON.parse(found.stdout);
        assertRedisOwnership(container, this.owner);
        const removed = spawnSync("docker", ["rm", "-f", container.Id], {
          encoding: "utf8",
          env: verificationEnv(""),
          timeout: 30_000,
        });
        assert.equal(removed.status, 0, "Owned Redis cleanup failed");
      } else {
        assert.match(
          found.stderr ?? "",
          /No such (?:object|container)/i,
          "Cannot verify owned Redis removal"
        );
      }
    }
    this.cleaned = true;
  }
}
