import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

beforeEach(() => vi.resetModules());

afterEach(() => vi.unstubAllEnvs());

for (const path of ["/admin", "/admin/reports", "/api/admin/reports"]) {
  describe(`admin proxy for ${path}`, () => {
    it("blocks production even when the local flag is enabled", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("ADMIN_ENABLED", "true");
      const { proxy } = await import("./proxy");
      const response = proxy(
        new NextRequest(`http://localhost${path}`, { headers: { "x-admin-role": "super_admin" } })
      );
      expect(response.status).toBe(404);
    });

    it("blocks access by default", async () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("ADMIN_ENABLED", undefined);
      const { proxy } = await import("./proxy");
      expect(proxy(new NextRequest(`http://localhost${path}`)).status).toBe(404);
    });

    it("allows the explicit local admin mode", async () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("ADMIN_ENABLED", "true");
      const { proxy } = await import("./proxy");
      expect(
        proxy(new NextRequest(`http://localhost${path}`)).headers.get("x-middleware-next")
      ).toBe("1");
    });
  });
}
