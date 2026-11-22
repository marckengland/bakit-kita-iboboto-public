import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const constructors = vi.hoisted(() => ({
  client: vi.fn(function (options: unknown) {
    return { options };
  }),
  adapter: vi.fn(function (config: unknown, options: unknown) {
    return { config, options };
  }),
}));
vi.mock("@prisma/client", () => ({ PrismaClient: constructors.client }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: constructors.adapter }));

import { createPrismaClient } from "./prisma-client";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("DATABASE_URL", "postgresql://localhost/example");
});
afterEach(() => vi.unstubAllEnvs());

describe("Prisma database connection configuration", () => {
  it("rejects missing configuration before a driver can fall back to ambient defaults", () => {
    vi.stubEnv("DATABASE_URL", undefined);
    expect(() => createPrismaClient()).toThrow("DATABASE_URL is required");
    expect(constructors.client).not.toHaveBeenCalled();
    expect(constructors.adapter).not.toHaveBeenCalled();
  });

  it("reports malformed configuration without echoing the connection string", () => {
    const invalid = "https://localhost/private-database";
    vi.stubEnv("DATABASE_URL", invalid);
    expect(() => createPrismaClient()).toThrow("DATABASE_URL must be a PostgreSQL URL");
    try {
      createPrismaClient();
    } catch (error) {
      expect(String(error)).not.toContain(invalid);
    }
    expect(constructors.adapter).not.toHaveBeenCalled();
  });

  it("uses a bounded connection pool without overriding driver TLS validation", () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/example?sslmode=verify-full");
    createPrismaClient({ log: ["error", "warn"] });
    expect(constructors.adapter).toHaveBeenCalledWith(
      {
        connectionString: "postgresql://localhost/example?sslmode=verify-full",
        max: 10,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 300000,
        options: '-c search_path="public"',
      },
      { schema: "public" }
    );
    expect(constructors.client).toHaveBeenCalledWith(
      expect.objectContaining({ log: ["error", "warn"], adapter: expect.any(Object) })
    );
  });

  it("preserves an explicit schema, connection limit, timeout and standard PostgreSQL options", () => {
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://localhost/example?schema=civic&connection_limit=4&connect_timeout=3&application_name=example"
    );
    createPrismaClient();
    expect(constructors.adapter).toHaveBeenCalledWith(
      {
        connectionString: "postgresql://localhost/example?application_name=example",
        max: 4,
        connectionTimeoutMillis: 3000,
        idleTimeoutMillis: 300000,
        options: '-c search_path="civic"',
      },
      { schema: "civic" }
    );
  });

  it.each(["connection_limit=0", "connection_limit=abc", "connect_timeout=-1"])(
    "rejects invalid connection settings: %s",
    (query) => {
      vi.stubEnv("DATABASE_URL", `postgresql://localhost/example?${query}`);
      expect(() => createPrismaClient()).toThrow("must be a positive integer");
      expect(constructors.adapter).not.toHaveBeenCalled();
    }
  );

  it("rejects the old pool_timeout option instead of silently discarding it", () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/example?pool_timeout=10");
    expect(() => createPrismaClient()).toThrow("pool_timeout");
    expect(constructors.adapter).not.toHaveBeenCalled();
  });

  it("rejects embedded schema quotes before Prisma can generate invalid ORM SQL", () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/example?schema=civic%22quoted");
    expect(() => createPrismaClient()).toThrow("schema names containing double quotes");
    expect(constructors.adapter).not.toHaveBeenCalled();
  });

  it("preserves explicit PostgreSQL startup options while setting the selected schema", () => {
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://localhost/example?options=-c%20statement_timeout%3D2500"
    );
    createPrismaClient();
    expect(constructors.adapter).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionString: "postgresql://localhost/example",
        options: '-c statement_timeout=2500 -c search_path="public"',
      }),
      { schema: "public" }
    );
  });

  it("creates independent clients so scripts retain their own disconnect lifecycle", () => {
    const first = createPrismaClient();
    const second = createPrismaClient();
    expect(first).not.toBe(second);
    expect(constructors.client).toHaveBeenCalledTimes(2);
    expect(constructors.adapter).toHaveBeenCalledTimes(2);
  });
});
