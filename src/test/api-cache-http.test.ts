import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";
import ts from "typescript";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = process.cwd();
let fixture: string;
let server: ChildProcess;
let baseUrl: string;

beforeAll(async () => {
  fixture = await mkdtemp(path.join(tmpdir(), "bakit-cache-http-"));
  const profileDir = path.join(fixture, "app/api/auth/profile");
  await mkdir(profileDir, { recursive: true });
  await mkdir(path.join(fixture, "src/i18n"), { recursive: true });
  await mkdir(path.join(fixture, "app/api/forbidden"), { recursive: true });
  await symlink(path.join(root, "node_modules"), path.join(fixture, "node_modules"), "dir");

  // Keep Next's production HTTP handling and the real profile handler/config;
  // replace only session storage so this regression needs no database.
  const profileSource = await readFile(
    path.join(root, "src/app/api/auth/profile/route.ts"),
    "utf8"
  );
  const profileJs = ts
    .transpileModule(profileSource, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    })
    .outputText.replace('"@/services/auth.service"', '"./auth"');

  await Promise.all([
    writeFile(path.join(fixture, "package.json"), '{"private":true}'),
    writeFile(
      path.join(fixture, "next.config.mjs"),
      `import original from ${JSON.stringify(path.join(root, "next.config.mjs"))};
export default {headers: original.headers, poweredByHeader: false, experimental: {cpus: 1}};`
    ),
    writeFile(path.join(fixture, "src/i18n/request.ts"), "export default {};"),
    writeFile(
      path.join(fixture, "app/layout.js"),
      'import {createElement as h} from "react"; export default function Layout({children}) {return h("html",null,h("body",null,children));}'
    ),
    writeFile(path.join(profileDir, "route.js"), profileJs),
    writeFile(
      path.join(profileDir, "auth.js"),
      'export async function validateSession(token) {return {userId: token};} export async function getUser(id) {return {id,isVerified:true,language:"en",createdAt:new Date("2020-01-01"),lastLoginAt:null};}'
    ),
    writeFile(
      path.join(fixture, "app/api/forbidden/route.js"),
      'export async function GET() {return Response.json({error:"Forbidden"},{status:403});}'
    ),
  ]);

  const nextBin = path.join(root, "node_modules/next/dist/bin/next");
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "production",
    NEXT_TELEMETRY_DISABLED: "1",
  };
  execFileSync(process.execPath, [nextBin, "build", "--webpack"], {
    cwd: fixture,
    env,
    timeout: 60_000,
    stdio: "pipe",
  });
  server = spawn(process.execPath, [nextBin, "start", "--hostname", "127.0.0.1", "--port", "0"], {
    cwd: fixture,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise<void>((resolve, reject) => {
    let output = "";
    server.stdout?.on("data", (chunk) => {
      output += chunk.toString();
      const url = output.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
      if (url && output.includes("Ready")) {
        baseUrl = url;
        resolve();
      }
    });
    server.once("error", reject);
    server.once("exit", (code) => reject(new Error(`Cache fixture server exited: ${code}`)));
  });
}, 90_000);

afterAll(async () => {
  if (server && server.exitCode === null) {
    const exited = once(server, "exit");
    server.kill();
    await exited;
  }
  if (fixture) {
    await rm(fixture, { recursive: true, force: true });
  }
});

describe("effective API cache headers over production HTTP", () => {
  it("keeps authenticated profiles private and preserves each user's response", async () => {
    for (const userId of ["user-a", "user-b"]) {
      const response = await fetch(`${baseUrl}/api/auth/profile`, {
        headers: { cookie: `auth_token=${userId}` },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(await response.json()).toMatchObject({ success: true, user: { id: userId } });
    }
  });

  it.each([
    { route: "/api/auth/profile", status: 401 },
    { route: "/api/forbidden", status: 403 },
  ])("prevents caching the $status response at $route", async ({ route, status }) => {
    const response = await fetch(`${baseUrl}${route}`);

    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
