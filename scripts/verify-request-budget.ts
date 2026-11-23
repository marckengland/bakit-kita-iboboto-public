import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

type Owner = { name: string; id: string; token: string };
type Container = { Id: string; Name: string; Config: { Labels?: Record<string, string> | null } };
const label = "bkib-budget-verification";

function command(args: string[]): string {
  const result = spawnSync("docker", args, { encoding: "utf8", timeout: 20_000 });
  assert.equal(result.status, 0, "Disposable Redis Docker command failed");
  if (args[0] === "run" && process.env.REQUEST_BUDGET_VERIFY_INJECT_STARTUP_FAILURE === "true") {
    throw new Error("Injected startup failure before container ID capture");
  }
  return result.stdout.trim();
}

function assertOwned(result: Container, owner: Owner): string {
  assert.ok(
    /^[a-f0-9]{64}$/.test(result.Id) &&
      (!owner.id || result.Id === owner.id) &&
      result.Name === `/${owner.name}` &&
      result.Config.Labels?.[label] === owner.token,
    "Refusing to use or remove an unowned Redis container"
  );
  return result.Id;
}

function owned(owner: Owner): void {
  assertOwned(JSON.parse(command(["inspect", owner.name]))[0], owner);
}

function cleanup(owner: Owner): void {
  const found = spawnSync("docker", ["inspect", owner.name], {
    encoding: "utf8",
    timeout: 20_000,
  });
  if (found.status === 0) {
    const actualId = assertOwned(JSON.parse(found.stdout)[0], owner);
    command(["rm", "--force", actualId]);
  } else {
    assert.match(
      found.stderr ?? "",
      /No such (?:object|container)/i,
      "Cannot verify disposable Redis cleanup"
    );
  }
  assert.equal(
    command(["ps", "--all", "--quiet", "--filter", `label=${label}=${owner.token}`]),
    ""
  );
}

async function worker(): Promise<void> {
  const owner: Owner = JSON.parse(process.env.BKIB_BUDGET_OWNER || "null");
  assert.ok(owner?.token && owner?.name && owner?.id, "Missing disposable Redis owner");
  owned(owner);
  assert.match(process.env.REDIS_URL || "", /^redis:\/\/127\.0\.0\.1:\d+\/0$/);
  const { reservePublicRequest, getPublicRequestBudget, PublicBudgetUnavailableError } =
    await import("../src/lib/public-request-budget");
  const { redis } = await import("../src/lib/redis");
  assert.ok(redis);
  const mode = process.argv[3];
  const scope = process.argv[4] as "records" | "feedback" | "assistant";
  assert.ok(["records", "feedback", "assistant"].includes(scope));
  const count = Number(process.argv[5]);
  assert.ok(Number.isSafeInteger(count) && count >= 1 && count <= 200);
  const request = new Request("https://budget-verification.invalid", {
    headers: { "x-real-ip": "192.0.2.80", "x-forwarded-for": "192.0.2.99" },
  });
  try {
    if (mode === "outage" || mode === "corrupt") {
      const start = performance.now();
      await assert.rejects(reservePublicRequest(request, scope), (error: unknown) => {
        assert.ok(error instanceof PublicBudgetUnavailableError);
        assert.equal(error.message, "Public request budget unavailable");
        return true;
      });
      assert.ok(performance.now() - start < 3500, "Outage exceeded bounded deadline");
      process.stdout.write(JSON.stringify({ failedClosed: true }) + "\n");
      return;
    }
    const results = await Promise.all(
      Array.from({ length: count }, () =>
        mode === "status"
          ? getPublicRequestBudget(request, scope)
          : reservePublicRequest(request, scope, mode === "user" ? "verified-test-user" : null)
      )
    );
    assert.ok(results.every((value) => value !== null));
    process.stdout.write(
      JSON.stringify({ accepted: results.filter((value) => value?.allowed).length }) + "\n"
    );
  } finally {
    redis.disconnect();
  }
}

async function main(): Promise<void> {
  assert.equal(process.argv.length, 2, "Verifier accepts no URL or arguments");
  const token = randomUUID();
  const owner: Owner = { name: `bkib-budget-${token}`, token, id: "" };
  let requested = false;
  let url = "";
  let interrupted = false;
  const interrupt = () => {
    interrupted = true;
  };
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", interrupt);
  process.on("SIGHUP", interrupt);
  const cli = (...args: string[]) => {
    assert.ok(!interrupted, "Verification interrupted");
    owned(owner);
    return command(["exec", owner.name, "redis-cli", "--raw", ...args]);
  };
  async function run(
    mode: string,
    scope = "records",
    count = 80,
    trusted = false
  ): Promise<{ accepted: number; failedClosed?: boolean }> {
    assert.ok(!interrupted, "Verification interrupted");
    owned(owner);
    return await new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ["--import", "tsx", fileURLToPath(import.meta.url), "--worker", mode, scope, String(count)],
        {
          env: {
            ...process.env,
            NODE_ENV: "production",
            REDIS_DISABLED: "false",
            REDIS_URL: url,
            PUBLIC_CLIENT_IP_HEADER: trusted ? "x-real-ip" : "",
            BKIB_BUDGET_OWNER: JSON.stringify(owner),
          },
          stdio: ["ignore", "pipe", "pipe"],
        }
      );
      let output = "";
      child.stdout.on("data", (chunk) => {
        output += chunk;
      });
      // Redis's existing error handler can report connection errors during the
      // deliberate outage. Keep that output private and report only our result.
      child.stderr.resume();
      const deadline = setTimeout(() => {
        child.kill("SIGKILL");
      }, 12_000);
      child.once("error", reject);
      child.once("exit", (code) => {
        clearTimeout(deadline);
        if (code !== 0) {
          reject(new Error("Production budget worker failed"));
          return;
        }
        try {
          resolve(JSON.parse(output.trim()));
        } catch {
          reject(new Error("Invalid worker result"));
        }
      });
    });
  }
  const clear = () => {
    const keys = cli("KEYS", "public-budget:*").split("\n").filter(Boolean);
    if (keys.length) {
      cli("DEL", ...keys);
    }
  };
  try {
    // The only network target is a new, uniquely labeled local container.
    requested = true;
    owner.id = command([
      "run",
      "--detach",
      "--name",
      owner.name,
      "--label",
      `${label}=${token}`,
      "--publish",
      "127.0.0.1::6379",
      "redis:7",
      "redis-server",
      "--save",
      "",
      "--appendonly",
      "no",
    ]);
    if (process.env.REQUEST_BUDGET_VERIFY_INJECT_STARTUP_SIGNAL === "SIGHUP") {
      process.kill(process.pid, "SIGHUP");
      await new Promise((resolve) => setImmediate(resolve));
    }
    assert.ok(!interrupted, "Verification interrupted");
    owned(owner);
    const mapping = command(["port", owner.name, "6379/tcp"]);
    assert.match(mapping, /^127\.0\.0\.1:\d+$/);
    url = `redis://${mapping}/0`;
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        if (cli("PING") === "PONG") {
          break;
        }
      } catch {
        // Redis may still be starting inside the owned container.
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(cli("PING"), "PONG");
    if (process.env.REQUEST_BUDGET_VERIFY_INJECT_FAILURE === "true") {
      throw new Error("Injected verification failure");
    }

    const concurrent = await Promise.all([run("reserve"), run("reserve")]);
    assert.equal(
      concurrent.reduce((sum, value) => sum + value.accepted, 0),
      120
    );
    assert.equal(cli("GET", "public-budget:{records}:minute"), "120");
    assert.equal(cli("GET", "public-budget:{records}:hour"), "120");
    process.stdout.write("PASS: two independent production workers share the global minute cap\n");

    const key = "public-budget:{records}:hour";
    const beforeStatus = cli("GET", key);
    await run("status", "records", 40);
    assert.equal(cli("GET", key), beforeStatus);
    process.stdout.write("PASS: status reads do not consume counters\n");

    clear();
    cli("SET", key, "1198", "PX", "3600000");
    const hourly = await Promise.all([run("reserve", "records", 8), run("reserve", "records", 8)]);
    assert.equal(
      hourly.reduce((sum, value) => sum + value.accepted, 0),
      2
    );
    assert.equal(cli("GET", key), "1200");
    assert.equal(cli("GET", "public-budget:{records}:minute"), "2");
    process.stdout.write(
      "PASS: hourly exhaustion is atomic and does not overconsume minute counters\n"
    );

    for (const scope of ["records", "feedback", "assistant"]) {
      clear();
      const minuteCap = scope === "records" ? 120 : scope === "feedback" ? 5 : 10;
      const hourCap = scope === "records" ? 1200 : scope === "feedback" ? 20 : 100;
      const result = await run("reserve", scope, minuteCap + 5);
      assert.equal(result.accepted, minuteCap);
      cli("DEL", `public-budget:{${scope}}:minute`);
      cli("SET", `public-budget:{${scope}}:hour`, String(hourCap - 1), "PX", "3600000");
      assert.equal((await run("reserve", scope, 5)).accepted, 1);
      for (const [dimension, window] of [
        ["minute", 60_000],
        ["hour", 3_600_000],
      ] as const) {
        const expiry = Number(cli("PEXPIRETIME", `public-budget:{${scope}}:${dimension}`));
        const time = cli("TIME").split("\n").map(Number);
        const now = time[0]! * 1000 + Math.floor(time[1]! / 1000);
        assert.equal(expiry % window, 0);
        assert.ok(expiry > now && expiry <= now + window);
      }
    }
    process.stdout.write("PASS: all scope caps and exact minute/hour boundary expiries\n");

    clear();
    const perIp = await Promise.all([
      run("reserve", "records", 40, true),
      run("reserve", "records", 40, true),
    ]);
    assert.equal(
      perIp.reduce((sum, value) => sum + value.accepted, 0),
      20
    );
    const clientKeys = cli("KEYS", "public-budget:*:client:*");
    assert.ok(!clientKeys.includes("192.0.2.80") && /client:[a-f0-9]{64}:hour/.test(clientKeys));
    clear();
    const perUser = await Promise.all([run("user", "records", 80), run("user", "records", 80)]);
    assert.equal(
      perUser.reduce((sum, value) => sum + value.accepted, 0),
      100
    );
    process.stdout.write(
      "PASS: trusted anonymous and verified user caps share only hashed identifiers\n"
    );

    clear();
    // Redis itself removes expired counters. A fresh request then starts both
    // windows and gives each the next exact boundary, without stale counts.
    for (const dimension of ["minute", "hour"]) {
      const expiredKey = `public-budget:{feedback}:${dimension}`;
      cli("SET", expiredKey, "5");
      cli("PEXPIREAT", expiredKey, "1");
    }
    assert.equal((await run("reserve", "feedback", 1)).accepted, 1);
    assert.equal(cli("GET", "public-budget:{feedback}:minute"), "1");
    assert.equal(cli("GET", "public-budget:{feedback}:hour"), "1");
    cli("SET", "public-budget:{feedback}:minute", "malformed");
    assert.equal((await run("corrupt", "feedback", 1)).failedClosed, true);
    assert.equal(cli("GET", "public-budget:{feedback}:hour"), "1");
    cli("SET", "public-budget:{feedback}:minute", "0");
    cli("SET", "public-budget:{feedback}:hour", "1e0");
    assert.equal((await run("corrupt", "feedback", 1)).failedClosed, true);
    assert.equal(cli("GET", "public-budget:{feedback}:minute"), "0");
    process.stdout.write(
      "PASS: expired windows restart and malformed counters fail closed without partial writes\n"
    );

    owned(owner);
    command(["stop", "--time", "0", owner.name]);
    assert.equal((await run("outage", "feedback", 1)).failedClosed, true);
    process.stdout.write("PASS: injected Redis outage fails closed within the deadline\n");
  } finally {
    if (requested) {
      cleanup(owner);
      process.stdout.write("PASS: verified ownership and removed disposable Redis\n");
    }
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", interrupt);
    process.off("SIGHUP", interrupt);
  }
}

if (process.argv[2] === "--worker") {
  worker().catch(() => {
    process.exitCode = 1;
  });
} else {
  main().catch((error: unknown) => {
    process.stderr.write(
      error instanceof Error ? error.message + "\n" : "Request budget verification failed\n"
    );
    process.exitCode = 1;
  });
}
